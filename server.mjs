import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

// Load .env
const envPath = join(import.meta.dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...val] = line.split('=');
    if (key?.trim() && val.length) process.env[key.trim()] = val.join('=').trim();
  }
}

const PORT = process.env.PORT || 3333;
const ROOT = import.meta.dirname;
const apiKeyLoaded = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-key-here');
console.log(apiKeyLoaded ? '  AI Chat:      API key loaded from .env' : '  AI Chat:      NO API KEY — set ANTHROPIC_API_KEY in .env');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // API proxy endpoint
  if (req.method === 'POST' && req.url === '/api/chat') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your-key-here') {
      console.log('  [chat] BLOCKED — no API key in .env');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Set ANTHROPIC_API_KEY in docs-site/.env' }));
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    const { question, context, pageContent } = JSON.parse(body);
    console.log(`  [chat] Q: "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"${context ? ' (with selection)' : ''}`);

    const systemPrompt = `You are OneSync's documentation assistant. Answer concisely about OneSync — a personal AI health agent (React Native + Expo, Claude Haiku, Telegram, CRS algorithm). Use bullet points. If user selected text, answer in that context.

Key facts: CRS = Sleep(35%) + HRV(25%) + Circadian(25%) + Activity(15%). 8 MVP tools. Samsung has NO HRV in Health Connect. Rules pre-filter saves 60-80% of Claude calls. Agent OS has 25-field prompt builder, 10 hooks, 5 personality zones, 3-tier memory, 4-phase nudge, 5 quality gates. Built from 12 open-source agent projects.

Page context (first 3000 chars):
${(pageContent || '').substring(0, 3000)}`;

    let userContent = question;
    if (context) userContent = `Selected text: "${context}"\n\nQuestion: ${question}`;

    try {
      // OAuth tokens (sk-ant-oat01-) use Bearer auth; API keys (sk-ant-api03-) use x-api-key
      const isOAuth = apiKey.startsWith('sk-ant-oat01');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      if (isOAuth) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['x-api-key'] = apiKey;
      }

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      const data = await apiRes.json();
      if (apiRes.ok) {
        const answer = data.content?.[0]?.text || '';
        console.log(`  [chat] A: "${answer.substring(0, 80)}${answer.length > 80 ? '...' : ''}" (${data.usage?.output_tokens || '?'} tokens)`);
      } else {
        console.log(`  [chat] ERROR ${apiRes.status}: ${data.error?.message || JSON.stringify(data)}`);
      }
      res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      console.log(`  [chat] EXCEPTION: ${e.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static file serving
  let filePath = join(ROOT, req.url === '/' ? 'index.html' : req.url);

  // Try adding .html extension
  if (!existsSync(filePath) && existsSync(filePath + '.html')) filePath += '.html';
  // Default to index.html for Docsify SPA (but not for real files)
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // If it looks like a docsify route (no extension), serve index.html
    if (!extname(req.url)) filePath = join(ROOT, 'index.html');
  }

  if (!existsSync(filePath)) {
    res.writeHead(404); return res.end('Not found');
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`\n  OneSync Docs running at:\n`);
  console.log(`    Docs:         http://localhost:${PORT}`);
  console.log(`    Presentation: http://localhost:${PORT}/presentation.html`);
  console.log(`    AI Chat:      Powered by .env ANTHROPIC_API_KEY\n`);
});
