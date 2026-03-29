import { useEffect, useState, useRef, useCallback } from 'react';
import type { PatternData } from '../types.js';

interface SpotNode {
  id: string;
  date: string;
  type: string;
  severity: string;
  title: string;
  detail: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spotImage: string; // Which Vector-N.png to use
}

interface Edge {
  source: number;
  target: number;
  strength: number;
}

interface SpotsApiResponse {
  spots: Array<{ date: string; spots: Array<{ id: string; type: string; severity: string; title: string; detail: string }> }>;
  stats: { total: number; byType: Record<string, number>; bySeverity: Record<string, number> };
  patterns: PatternData[];
}

interface Props {
  onClose: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  positive: '#34D399',
  neutral: '#9C9C94',
  warning: '#FBBF24',
  critical: '#F87171',
};

const TYPE_COLORS: Record<string, string> = {
  health: '#6EE7B7',
  behavior: '#93C5FD',
  environment: '#C4B5FD',
  insight: '#FCD34D',
  alert: '#FCA5A5',
  learning: '#D1D5DB',
};

// Assign spot images based on type hash
function getSpotImage(type: string): string {
  const images = ['/Vector-1.png', '/Vector-2.png', '/Vector-3.png'];
  const hash = type.charCodeAt(0) % 3;
  return images[hash]!;
}

function runForceLayout(nodes: SpotNode[], edges: Edge[], width: number, height: number, iterations: number): void {
  const repulsion = 800;
  const attraction = 0.008;
  const damping = 0.85;
  const centerForce = 0.01;
  const cx = width / 2;
  const cy = height / 2;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - (iter / iterations) * 0.7;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i]!.x - nodes[j]!.x;
        const dy = nodes[i]!.y - nodes[j]!.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 200) continue;
        const force = (repulsion / (dist * dist)) * cooling;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i]!.vx += fx; nodes[i]!.vy += fy;
        nodes[j]!.vx -= fx; nodes[j]!.vy -= fy;
      }
    }
    for (const edge of edges) {
      const a = nodes[edge.source]!;
      const b = nodes[edge.target]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction * edge.strength * cooling;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const node of nodes) {
      node.vx += (cx - node.x) * centerForce * cooling;
      node.vy += (cy - node.y) * centerForce * cooling;
      node.x += node.vx * damping;
      node.y += node.vy * damping;
      node.vx *= damping;
      node.vy *= damping;
      node.x = Math.max(50, Math.min(width - 50, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    }
  }
}

export function ConstellationView({ onClose }: Props) {
  const [data, setData] = useState<SpotsApiResponse | null>(null);
  const [nodes, setNodes] = useState<SpotNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [colorBy, setColorBy] = useState<'severity' | 'type'>('type');
  const [animationProgress, setAnimationProgress] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const WIDTH = 1100;
  const HEIGHT = 600;

  useEffect(() => {
    fetch('/api/spots').then(r => r.json()).then(d => setData(d as SpotsApiResponse)).catch(() => {});
  }, []);

  // Animate edges drawing in
  useEffect(() => {
    if (edges.length === 0) return;
    setAnimationProgress(0);
    const duration = 1200;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(1 - Math.pow(1 - progress, 3)); // ease-out
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [edges.length]);

  useEffect(() => {
    if (!data) return;
    const allSpots: Array<{ date: string; type: string; severity: string; title: string; detail: string; id: string }> = [];
    for (const day of data.spots) {
      for (const spot of day.spots) {
        if (filter !== 'all' && spot.severity !== filter && spot.type !== filter) continue;
        allSpots.push({ ...spot, date: day.date });
      }
    }

    let sampled = allSpots;
    if (sampled.length > 400) {
      const important = sampled.filter(s => s.severity === 'critical' || s.severity === 'warning' || s.severity === 'positive');
      const rest = sampled.filter(s => s.severity === 'neutral');
      const sampleRate = Math.ceil(rest.length / (400 - important.length));
      const sampledRest = rest.filter((_, i) => i % sampleRate === 0);
      sampled = [...important, ...sampledRest];
    }

    const typeAngles: Record<string, number> = { health: 0, behavior: 60, alert: 120, insight: 180, environment: 240, learning: 300 };
    const newNodes: SpotNode[] = sampled.map((spot, i) => {
      const angle = ((typeAngles[spot.type] ?? 0) + Math.random() * 40 - 20) * Math.PI / 180;
      const dist = 100 + Math.random() * 200;
      return {
        ...spot, id: spot.id || `spot-${i}`,
        x: WIDTH / 2 + Math.cos(angle) * dist, y: HEIGHT / 2 + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        radius: spot.severity === 'critical' ? 14 : spot.severity === 'warning' ? 12 : spot.severity === 'positive' ? 11 : 8,
        spotImage: getSpotImage(spot.type),
      };
    });

    const newEdges: Edge[] = [];
    for (let i = 0; i < newNodes.length; i++) {
      for (let j = i + 1; j < newNodes.length; j++) {
        const a = newNodes[i]!; const b = newNodes[j]!;
        if (a.type === b.type) {
          const dayDiff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000;
          if (dayDiff <= 3) newEdges.push({ source: i, target: j, strength: 1.5 });
          else if (dayDiff <= 7) newEdges.push({ source: i, target: j, strength: 0.5 });
        }
        if (a.date === b.date && a.type !== b.type) {
          newEdges.push({ source: i, target: j, strength: 0.3 });
        }
      }
    }
    runForceLayout(newNodes, newEdges, WIDTH, HEIGHT, 80);
    setNodes(newNodes); setEdges(newEdges);
  }, [data, filter]);

  const getColor = useCallback((node: SpotNode) => {
    return colorBy === 'severity' ? (SEVERITY_COLORS[node.severity] ?? '#999') : (TYPE_COLORS[node.type] ?? '#999');
  }, [colorBy]);

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

  const hovered = hoveredNode !== null ? nodes[hoveredNode] : null;
  const hoveredEdges = hoveredNode !== null
    ? new Set(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).flatMap(e => [e.source, e.target]))
    : null;

  return (
    <div className="constellation-overlay">
      <div className="constellation-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/waldo_logo_dark.png" alt="" style={{ width: 28, height: 28 }} />
            <div>
              <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 22, fontWeight: 700, margin: 0 }}>The constellation</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                {nodes.length} spots · {edges.length} connections · {data.patterns.length} patterns
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-surface)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
          }}>×</button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 16, padding: '10px 28px', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['all', 'critical', 'warning', 'positive', 'health', 'alert', 'behavior', 'insight'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: filter === f ? 'var(--text)' : 'var(--bg-surface)',
                color: filter === f ? 'var(--bg)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: filter === f ? 600 : 400,
                transition: 'all 0.2s ease',
              }}>{f}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {(['type', 'severity'] as const).map(c => (
              <button key={c} onClick={() => setColorBy(c)} style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: colorBy === c ? 'var(--text)' : 'var(--bg-surface)',
                color: colorBy === c ? 'var(--bg)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', transition: 'all 0.2s ease',
              }}>by {c}</button>
            ))}
          </div>
        </div>

        {/* SVG Graph */}
        <div style={{ flex: 1, padding: '12px 28px', overflow: 'hidden', position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)' }}>
            <defs>
              {/* Animated dash for edges */}
              <style>{`
                @keyframes dashDraw {
                  from { stroke-dashoffset: 100; }
                  to { stroke-dashoffset: 0; }
                }
                .edge-line {
                  transition: stroke 0.3s ease, opacity 0.3s ease, stroke-width 0.3s ease;
                }
                .node-group {
                  transition: opacity 0.3s ease;
                }
                .node-group:hover .spot-glow {
                  opacity: 0.4;
                }
              `}</style>
            </defs>

            {/* Edges — animated draw-in */}
            {edges.map((edge, i) => {
              const a = nodes[edge.source]!;
              const b = nodes[edge.target]!;
              const isHighlighted = hoveredEdges?.has(edge.source) && hoveredEdges?.has(edge.target);
              const isAnyHovered = hoveredNode !== null;

              // Animate: only draw portion based on progress
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const progress = Math.min(animationProgress, 1);
              const endX = a.x + dx * progress;
              const endY = a.y + dy * progress;

              return (
                <line key={`e-${i}`} className="edge-line"
                  x1={a.x} y1={a.y} x2={endX} y2={endY}
                  stroke={isHighlighted ? getColor(a) : 'var(--border)'}
                  strokeWidth={isHighlighted ? 2 : 0.4}
                  opacity={isAnyHovered ? (isHighlighted ? 0.9 : 0.04) : 0.2}
                />
              );
            })}

            {/* Nodes — dalmatian spot images */}
            {nodes.map((node, i) => {
              const color = getColor(node);
              const isHovered = hoveredNode === i;
              const isConnected = hoveredEdges?.has(i);
              const isOtherHovered = hoveredNode !== null && !isConnected;
              const size = isHovered ? node.radius * 2 + 8 : node.radius * 2;

              return (
                <g key={`n-${i}`} className="node-group"
                  onMouseEnter={() => setHoveredNode(i)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => {
                    setSelectedNode(i);
                    fetch(`/api/day/${node.date}`).then(r => r.json()).then(d => setSelectedDayData(d as Record<string, unknown>)).catch(() => {});
                  }}
                  style={{ cursor: 'pointer', opacity: isOtherHovered ? 0.12 : 1 }}
                >
                  {/* Color tint circle behind the spot */}
                  <circle cx={node.x} cy={node.y} r={size / 2 + 2}
                    fill={color} opacity={isHovered ? 0.3 : 0.15} />

                  {/* Glow ring on hover */}
                  <circle className="spot-glow" cx={node.x} cy={node.y} r={size / 2 + 8}
                    fill="none" stroke={color} strokeWidth={1.5} opacity={isHovered ? 0.5 : 0} />

                  {/* The actual dalmatian spot image */}
                  <image
                    href={node.spotImage}
                    x={node.x - size / 2} y={node.y - size / 2}
                    width={size} height={size}
                    opacity={isOtherHovered ? 0.2 : 0.85}
                    style={{ transition: 'width 0.2s ease, height 0.2s ease, opacity 0.2s ease' }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hovered && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--text)', color: 'var(--bg)', padding: '12px 20px',
              borderRadius: 10, fontSize: 13, maxWidth: 450, textAlign: 'center',
              border: `1px solid ${getColor(hovered)}40`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.15)`,
              animation: 'cardIn 0.15s ease both',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getColor(hovered) }} />
                <span style={{ fontWeight: 600 }}>{hovered.title}</span>
              </div>
              <div style={{ opacity: 0.7 }}>{hovered.detail}</div>
              <div style={{ opacity: 0.4, marginTop: 4, fontSize: 11 }}>
                {hovered.date} · {hovered.type} · {hovered.severity} · click for details
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ position: 'absolute', top: 20, right: 40, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)80', padding: '8px 12px', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
            {Object.entries(colorBy === 'type' ? TYPE_COLORS : SEVERITY_COLORS).map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Patterns */}
        {data.patterns.length > 0 && (
          <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border-light)', maxHeight: 120, overflow: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 8 }}>
              Patterns discovered
            </div>
            {data.patterns.map(p => (
              <div key={p.id} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{p.summary}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 8 }}>{p.confidence} · {p.evidenceCount} points</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedNode !== null && nodes[selectedNode] && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }} onClick={() => { setSelectedNode(null); setSelectedDayData(null); }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 16, padding: 28, maxWidth: 480,
            width: '90%', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'cardIn 0.2s ease both',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img src={nodes[selectedNode]!.spotImage} alt="" style={{ width: 24, height: 24 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{nodes[selectedNode]!.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {nodes[selectedNode]!.date} · {nodes[selectedNode]!.type} · {nodes[selectedNode]!.severity}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              {nodes[selectedNode]!.detail}
            </div>

            {selectedDayData && (() => {
              const d = selectedDayData;
              const crs = d['crs'] as Record<string, unknown> | undefined;
              const sleep = d['sleep'] as Record<string, unknown> | undefined;
              const activity = d['activity'] as Record<string, unknown> | undefined;
              const dayAct = d['dayActivity'] as Record<string, unknown> | undefined;
              const strain = d['strain'] as Record<string, unknown> | undefined;
              return (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: 12 }}>
                    Day overview
                  </div>
                  {crs && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>CRS</span>
                    <span style={{ fontWeight: 600 }}>{crs['score'] as number} ({crs['zone'] as string})</span>
                  </div>}
                  {sleep && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sleep</span>
                    <span>{sleep['durationHours'] as number}h · {sleep['efficiency'] as number}% eff</span>
                  </div>}
                  {strain && (strain['score'] as number) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Strain</span>
                    <span>{strain['score'] as number}/21 · peak {strain['peakHR'] as number} bpm</span>
                  </div>}
                  {activity && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Activity</span>
                    <span>{(activity['steps'] as number).toLocaleString()} steps</span>
                  </div>}
                  {dayAct && (dayAct['morningWag'] as string | null) && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, borderLeft: '3px solid var(--accent)' }}>
                      {dayAct['morningWag'] as string}
                    </div>
                  )}
                </div>
              );
            })()}
            <button className="btn btn-ghost" onClick={() => { setSelectedNode(null); setSelectedDayData(null); }}
              style={{ width: '100%', marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
