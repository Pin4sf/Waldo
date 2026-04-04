/**
 * Waldo Router Worker — entry point for all Cloudflare requests.
 *
 * Routes every request to the correct user's Durable Object.
 * Each user's DO is identified by their Supabase user_id.
 *
 * Routes:
 *   POST /provision/:userId    → provision a new user's DO (called by user-register EF)
 *   POST /chat/:userId         → user sends a message
 *   POST /trigger/:userId      → external trigger (check-triggers EF calls this)
 *   GET  /status/:userId       → current DO state (web console)
 *   GET  /health               → worker health check
 *   DELETE /reset/:userId      → wipe DO (admin only)
 *
 * Auth:
 *   All routes except /health require the x-waldo-secret header.
 *   Set WALDO_WORKER_SECRET via: wrangler secret put WALDO_WORKER_SECRET
 */

import { WaldoAgent } from './agent';
import type { Env } from './types';

export { WaldoAgent };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-waldo-secret, x-admin-key',
        },
      });
    }

    // Health check (no auth)
    if (path === '/health') {
      return Response.json({ status: 'ok', ts: new Date().toISOString(), env: env.ENVIRONMENT });
    }

    // Auth: all other routes require the worker secret
    // This prevents unauthorized provisioning or message injection
    const workerSecret = (env as any).WALDO_WORKER_SECRET;
    if (workerSecret) {
      const provided = request.headers.get('x-waldo-secret');
      if (provided !== workerSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse path: /action/userId or /action
    const segments = path.split('/').filter(Boolean);
    const action = segments[0];
    const userId = segments[1];

    if (!userId && action !== 'health') {
      return Response.json({ error: 'user_id required in path: /action/:userId' }, { status: 400 });
    }

    // Get or create the DO for this user
    const doId = env.WALDO_AGENT.idFromName(userId!);
    const stub = env.WALDO_AGENT.get(doId);

    // Forward the request to the DO with the action as the path
    const doRequest = new Request(`https://internal/${action}`, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });

    return stub.fetch(doRequest);
  },
};
