import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { PatternData } from '../types.js';

interface SpotNode {
  id: string; date: string; type: string; severity: string;
  title: string; detail: string;
  x: number; y: number; vx: number; vy: number; radius: number;
  spotImage: string; cluster: number;
}

interface Edge { source: number; target: number; strength: number; }

interface LearningMilestone {
  date: string; type: string; title: string; detail: string;
  dataPoints: number; confidence: number;
}

interface LearningData {
  milestones: LearningMilestone[];
  totalDaysObserved: number; totalSpotsGenerated: number;
  dataSources: string[]; connectedSources?: string[]; intelligenceScore: number; summary: string;
}

interface SpotsApiResponse {
  spots: Array<{ date: string; spots: Array<{ id: string; type: string; severity: string; title: string; detail: string }> }>;
  stats: { total: number; byType: Record<string, number>; bySeverity: Record<string, number> };
  patterns: PatternData[];
  learning?: LearningData;
}

interface Props { onClose: () => void; }

const TYPE_COLORS: Record<string, string> = {
  health: '#6EE7B7', behavior: '#93C5FD', environment: '#C4B5FD',
  insight: '#FCD34D', alert: '#FCA5A5', learning: '#D1D5DB',
};

const SEVERITY_COLORS: Record<string, string> = {
  positive: '#34D399', neutral: '#9C9C94', warning: '#FBBF24', critical: '#F87171',
};

function getSpotImage(type: string): string {
  const images = ['/Vector-1.png', '/Vector-2.png', '/Vector-3.png'];
  return images[type.charCodeAt(0) % 3]!;
}

// Optimized force layout — runs once, cached
function runForceLayout(nodes: SpotNode[], edges: Edge[], w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  for (let iter = 0; iter < 60; iter++) {
    const cool = 1 - (iter / 60) * 0.7;
    // Repulsion — skip far pairs for speed
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i]!.x - nodes[j]!.x, dy = nodes[i]!.y - nodes[j]!.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 150) continue;
        const f = (600 / (dist * dist)) * cool;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        nodes[i]!.vx += fx; nodes[i]!.vy += fy;
        nodes[j]!.vx -= fx; nodes[j]!.vy -= fy;
      }
    }
    for (const e of edges) {
      const a = nodes[e.source]!, b = nodes[e.target]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = dist * 0.008 * e.strength * cool;
      a.vx += (dx / dist) * f; a.vy += (dy / dist) * f;
      b.vx -= (dx / dist) * f; b.vy -= (dy / dist) * f;
    }
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.012 * cool;
      n.vy += (cy - n.y) * 0.012 * cool;
      n.x += n.vx * 0.85; n.y += n.vy * 0.85;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x = Math.max(50, Math.min(w - 50, n.x));
      n.y = Math.max(50, Math.min(h - 50, n.y));
    }
  }
}

export function ConstellationView({ onClose }: Props) {
  const [data, setData] = useState<SpotsApiResponse | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [colorBy, setColorBy] = useState<'severity' | 'type'>('type');
  const [view, setView] = useState<'graph' | 'timeline'>('graph');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<SpotNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animFrameRef = useRef<number>(0);

  const W = 1100, H = 580;

  useEffect(() => {
    const USE_CLOUD = (import.meta as any).env?.VITE_USE_CLOUD !== 'false';
    if (USE_CLOUD) {
      import('../supabase-api.js').then(async (api) => {
        const [spots, summary] = await Promise.all([api.fetchSpots(), api.fetchSummary()]);
        // Group spots by date
        const byDate = new Map<string, typeof spots>();
        const byType: Record<string, number> = {};
        for (const s of spots) {
          if (!byDate.has(s.date)) byDate.set(s.date, []);
          byDate.get(s.date)!.push(s);
          byType[s.type] = (byType[s.type] ?? 0) + 1;
        }
        const grouped = [...byDate.entries()].map(([date, daySpots]) => ({ date, spots: daySpots }));
        // Build the full SpotsApiResponse shape expected by the component
        const bySeverity: Record<string, number> = {};
        for (const s of spots) { bySeverity[s.severity] = (bySeverity[s.severity] ?? 0) + 1; }
        setData({
          spots: grouped,
          patterns: [],
          stats: { total: spots.length, byType, bySeverity },
          learning: {
            intelligenceScore: summary.intelligenceScore ?? 54,
            totalDaysObserved: summary.totalDays ?? byDate.size,
            totalSpotsGenerated: spots.length,
            dataSources: summary.connectedSources ?? ['Apple Health', 'Google Calendar', 'Gmail', 'Google Tasks', 'Google Fit', 'Weather'],
            connectedSources: summary.connectedSources ?? [],
            milestones: [],
            summary: '',
          },
        } as unknown as SpotsApiResponse);
      }).catch((err) => { console.error('[Waldo] Constellation load error:', err); });
    } else {
      fetch('/api/spots').then(r => r.json()).then(d => setData(d as SpotsApiResponse)).catch(() => {});
    }
  }, []);

  // Build graph — memoized by filter
  const graphData = useMemo(() => {
    if (!data) return null;

    let allSpots: Array<{ date: string; type: string; severity: string; title: string; detail: string; id: string }> = [];
    for (const day of data.spots) {
      for (const spot of day.spots) {
        if (filter !== 'all' && spot.severity !== filter && spot.type !== filter) continue;
        allSpots.push({ ...spot, date: day.date });
      }
    }

    // Aggressive sampling: max 250 nodes. Prioritize important spots.
    if (allSpots.length > 250) {
      const critical = allSpots.filter(s => s.severity === 'critical');
      const warning = allSpots.filter(s => s.severity === 'warning');
      const positive = allSpots.filter(s => s.severity === 'positive');
      const neutral = allSpots.filter(s => s.severity === 'neutral');

      const budget = 250;
      const keep = [...critical];
      const remaining = budget - keep.length;

      if (remaining > 0) {
        const warnSample = warning.slice(0, Math.min(warning.length, Math.floor(remaining * 0.4)));
        keep.push(...warnSample);
        const posSample = positive.slice(0, Math.min(positive.length, Math.floor(remaining * 0.3)));
        keep.push(...posSample);
        const neutSample = neutral.filter((_, i) => i % Math.ceil(neutral.length / Math.max(1, remaining - warnSample.length - posSample.length)) === 0);
        keep.push(...neutSample.slice(0, budget - keep.length));
      }
      allSpots = keep.slice(0, budget);
    }

    const typeAngles: Record<string, number> = { health: 0, behavior: 60, alert: 120, insight: 180, environment: 240, learning: 300 };
    const nodes: SpotNode[] = allSpots.map((spot, i) => {
      const angle = ((typeAngles[spot.type] ?? 0) + Math.random() * 40 - 20) * Math.PI / 180;
      const dist = 80 + Math.random() * 180;
      return {
        ...spot, id: spot.id || `s-${i}`,
        x: W / 2 + Math.cos(angle) * dist, y: H / 2 + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        radius: spot.severity === 'critical' ? 12 : spot.severity === 'warning' ? 10 : spot.severity === 'positive' ? 9 : 6,
        spotImage: getSpotImage(spot.type), cluster: 0,
      };
    });

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!;
        if (a.type === b.type) {
          const dayDiff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000;
          if (dayDiff <= 3) edges.push({ source: i, target: j, strength: 1.5 });
          else if (dayDiff <= 7 && edges.length < 800) edges.push({ source: i, target: j, strength: 0.4 });
        }
        if (a.date === b.date && a.type !== b.type && edges.length < 800) {
          edges.push({ source: i, target: j, strength: 0.3 });
        }
      }
    }

    runForceLayout(nodes, edges, W, H);
    return { nodes, edges };
  }, [data, filter]);

  // Store refs for canvas rendering
  useEffect(() => {
    if (graphData) {
      nodesRef.current = graphData.nodes;
      edgesRef.current = graphData.edges;
    }
  }, [graphData]);

  const getColor = useCallback((node: SpotNode) => {
    return colorBy === 'severity' ? (SEVERITY_COLORS[node.severity] ?? '#999') : (TYPE_COLORS[node.type] ?? '#999');
  }, [colorBy]);

  // Canvas rendering — much faster than SVG for 250+ elements
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#F0EFEB';
    ctx.fillRect(0, 0, W, H);

    // Edges
    const hovEdges = hoveredNode !== null
      ? new Set(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).flatMap(e => [e.source, e.target]))
      : null;

    for (const e of edges) {
      const a = nodes[e.source]!, b = nodes[e.target]!;
      const highlighted = hovEdges && hovEdges.has(e.source) && hovEdges.has(e.target);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = highlighted ? getColor(a) : '#E0DFD9';
      ctx.lineWidth = highlighted ? 2 : 0.3;
      ctx.globalAlpha = hoveredNode !== null ? (highlighted ? 0.9 : 0.03) : 0.15;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const color = getColor(n);
      const isHov = hoveredNode === i;
      const isConn = hovEdges?.has(i);
      const isFaded = hoveredNode !== null && !isConn;
      const r = isHov ? n.radius + 4 : n.radius;

      ctx.globalAlpha = isFaded ? 0.1 : isHov ? 1 : 0.8;

      // Color tint
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.2;
      ctx.fill();
      ctx.globalAlpha = isFaded ? 0.1 : isHov ? 1 : 0.8;

      // Dark spot shape (irregular oval)
      ctx.beginPath();
      ctx.ellipse(n.x, n.y, r, r * 0.85, (i * 0.7) % Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = '#1A1A1A';
      ctx.globalAlpha *= 0.85;
      ctx.fill();

      // Hover glow
      if (isHov) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    // Cluster labels
    const typeCenters = new Map<string, { x: number; y: number; count: number }>();
    for (const n of nodes) {
      if (!typeCenters.has(n.type)) typeCenters.set(n.type, { x: 0, y: 0, count: 0 });
      const c = typeCenters.get(n.type)!;
      c.x += n.x; c.y += n.y; c.count++;
    }
    ctx.font = '10px DM Sans, sans-serif';
    ctx.fillStyle = '#9C9C94';
    ctx.globalAlpha = 0.6;
    for (const [type, center] of typeCenters) {
      if (center.count < 3) continue;
      const cx = center.x / center.count;
      const cy = center.y / center.count - 20;
      ctx.textAlign = 'center';
      ctx.fillText(type, cx, cy);
    }
    ctx.globalAlpha = 1;
  }, [hoveredNode, getColor]);

  // Redraw on state changes
  useEffect(() => { draw(); }, [draw, graphData]);

  // Mouse interaction on canvas
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let closest = -1;
    let closestDist = 20; // Max hover distance
    for (let i = 0; i < nodesRef.current.length; i++) {
      const n = nodesRef.current[i]!;
      const d = Math.sqrt((mx - n.x) ** 2 + (my - n.y) ** 2);
      if (d < closestDist) { closest = i; closestDist = d; }
    }
    setHoveredNode(closest >= 0 ? closest : null);
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredNode !== null && nodesRef.current[hoveredNode]) {
      setSelectedNode(hoveredNode);
      const node = nodesRef.current[hoveredNode]!;
      const USE_CLOUD = (import.meta as any).env?.VITE_USE_CLOUD !== 'false';
      if (USE_CLOUD) {
        import('../supabase-api.js').then(api => api.fetchDay(node.date)).then(d => setSelectedDayData(d as unknown as Record<string, unknown>)).catch(() => {});
      } else {
        fetch(`/api/day/${node.date}`).then(r => r.json()).then(d => setSelectedDayData(d as Record<string, unknown>)).catch(() => {});
      }
    }
  }, [hoveredNode]);

  if (!data) {
    return (
      <div className="constellation-overlay">
        <div className="loading" style={{ flex: 1 }}>
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          <span style={{ marginLeft: 12 }}>Loading constellation...</span>
        </div>
      </div>
    );
  }

  const hovered = hoveredNode !== null ? nodesRef.current[hoveredNode] : null;

  return (
    <div className="constellation-overlay">
      <div className="constellation-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/watching-light-mode.svg" alt="" className="mascot-watching" style={{ width: 36, height: 36 }} />
            <div>
              <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 20, fontWeight: 700, margin: 0 }}>The constellation</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                {data.stats.total.toLocaleString()} spots · {data.patterns.length} patterns · {Object.keys(data.stats.byType).length} signal types
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {(['graph', 'timeline'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '5px 14px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: view === v ? 'var(--text)' : 'var(--bg-surface)',
                color: view === v ? 'var(--bg)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: view === v ? 600 : 400,
                transition: 'all 0.2s',
              }}>{v === 'graph' ? 'Constellation' : 'How Waldo learned'}</button>
            ))}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-surface)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Learning timeline view */}
        {view === 'timeline' && data.learning && (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
            {/* Intelligence score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 'var(--radius)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-headline)', fontSize: 48, fontWeight: 700, color: 'var(--accent)' }}>
                  {data.learning.intelligenceScore}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>intelligence score</div>
              </div>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                <div>{(data.learning.totalDaysObserved ?? 0).toLocaleString()} days observed · {(data.learning.totalSpotsGenerated ?? 0).toLocaleString()} observations</div>
                <div>Sources: {(data.learning.dataSources ?? data.learning.connectedSources ?? []).join(', ')}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-dim)' }}>
                  Every new data source multiplies Waldo's intelligence. More sources = exponentially more cross-correlations.
                </div>
              </div>
            </div>

            {/* Milestone timeline */}
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 16 }}>
              How Waldo learned — milestone by milestone
            </div>
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 7, top: 4, bottom: 4, width: 2, background: 'var(--border)', borderRadius: 1 }} />

              {(data.learning.milestones ?? []).map((m, i) => {
                const typeColors: Record<string, string> = {
                  data_source: '#93C5FD', baseline: '#6EE7B7', pattern: '#FCD34D',
                  insight: '#C4B5FD', adaptation: '#F97316', cross_source: '#FCA5A5',
                };
                const color = typeColors[m.type] ?? 'var(--text-dim)';
                return (
                  <div key={i} style={{ marginBottom: 20, position: 'relative', animation: 'cardIn 0.3s ease both', animationDelay: `${i * 0.05}s` }}>
                    {/* Dot on timeline */}
                    <div style={{
                      position: 'absolute', left: -20, top: 4,
                      width: 12, height: 12, borderRadius: '50%',
                      background: color, border: '2px solid var(--bg)',
                      boxShadow: `0 0 0 2px ${color}40`,
                    }} />
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                      {m.date} · {m.type.replace('_', ' ')} · {m.dataPoints} data points · {Math.round(m.confidence * 100)}% confidence
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>
                      {m.detail}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Patterns at the bottom */}
            {data.patterns.length > 0 && (
              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 10 }}>
                  Patterns connected from these milestones
                </div>
                {data.patterns.map(p => (
                  <div key={p.id} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{p.summary}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 6 }}>{p.confidence} · {p.evidenceCount} data points</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Graph view */}
        {view === 'graph' && <>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 16, padding: '10px 28px', borderBottom: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)' }}>
          {Object.entries(data.stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: filter === type ? 1 : 0.6 }}
              onClick={() => setFilter(filter === type ? 'all' : type)}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[type] ?? '#999' }} />
              <span style={{ fontWeight: filter === type ? 600 : 400 }}>{type}</span>
              <span style={{ opacity: 0.5 }}>{count}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['type', 'severity'] as const).map(c => (
              <button key={c} onClick={() => setColorBy(c)} style={{
                padding: '2px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: colorBy === c ? 'var(--text)' : 'transparent',
                color: colorBy === c ? 'var(--bg)' : 'var(--text-dim)',
                fontFamily: 'var(--font-body)',
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, padding: '8px 28px', overflow: 'hidden', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', borderRadius: 'var(--radius)', cursor: hoveredNode !== null ? 'pointer' : 'default' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={handleClick}
          />

          {/* Hover tooltip */}
          {hovered && (
            <div style={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--text)', color: 'var(--bg)', padding: '10px 16px',
              borderRadius: 8, fontSize: 12, maxWidth: 420, textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{hovered.title}</div>
              <div style={{ opacity: 0.7 }}>{hovered.detail}</div>
              <div style={{ opacity: 0.4, marginTop: 2, fontSize: 10 }}>{hovered.date} · {hovered.type} · click for details</div>
            </div>
          )}
        </div>

        </>}

        {/* Bottom panel: patterns or learning timeline */}
        {view === 'graph' && data.patterns.length > 0 && (
          <div style={{ padding: '12px 28px', borderTop: '1px solid var(--border-light)', maxHeight: 100, overflow: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 6 }}>
              Patterns discovered
            </div>
            {data.patterns.map(p => (
              <div key={p.id} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 3 }}>
                <span style={{ fontWeight: 500 }}>{p.summary}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 6 }}>{p.confidence} · {p.evidenceCount} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedNode !== null && nodesRef.current[selectedNode] && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }} onClick={() => { setSelectedNode(null); setSelectedDayData(null); }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 460,
            width: '90%', maxHeight: '75vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'cardIn 0.2s ease both',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(nodesRef.current[selectedNode]!) }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{nodesRef.current[selectedNode]!.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {nodesRef.current[selectedNode]!.date} · {nodesRef.current[selectedNode]!.type}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              {nodesRef.current[selectedNode]!.detail}
            </div>

            {selectedDayData && (() => {
              const d = selectedDayData;
              const crs = d['crs'] as Record<string, unknown> | undefined;
              const sleep = d['sleep'] as Record<string, unknown> | undefined;
              const activity = d['activity'] as Record<string, unknown> | undefined;
              const dayAct = d['dayActivity'] as Record<string, unknown> | undefined;
              const strain = d['strain'] as Record<string, unknown> | undefined;
              const cogLoad = d['cognitiveLoad'] as Record<string, unknown> | undefined;
              return (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 14, fontSize: 13 }}>
                  {crs && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nap Score</span>
                    <span style={{ fontWeight: 600 }}>{String(crs['score'] ?? '—')} ({String(crs['zone'] ?? '—')})</span>
                  </div>}
                  {sleep && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sleep</span>
                    <span>{String(sleep['durationHours'] ?? '—')}h · {String(sleep['efficiency'] ?? '—')}%</span>
                  </div>}
                  {strain && ((strain['score'] as number | undefined) ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Strain</span>
                    <span>{String(strain['score'] ?? 0)}/21</span>
                  </div>}
                  {cogLoad && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cognitive Load</span>
                    <span>{String(cogLoad['score'] ?? '—')}/100 ({String(cogLoad['level'] ?? '—')})</span>
                  </div>}
                  {activity && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Steps</span>
                    <span>{((activity['steps'] as number | undefined) ?? 0).toLocaleString()}</span>
                  </div>}
                  {dayAct && (dayAct['morningWag'] as string | null) && (
                    <div style={{ marginTop: 10, padding: 10, background: 'var(--bg)', borderRadius: 6, fontSize: 12, lineHeight: 1.5, borderLeft: '3px solid var(--accent)' }}>
                      {dayAct['morningWag'] as string}
                    </div>
                  )}
                </div>
              );
            })()}
            <button className="btn btn-ghost" onClick={() => { setSelectedNode(null); setSelectedDayData(null); }}
              style={{ width: '100%', marginTop: 12, fontSize: 12 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
