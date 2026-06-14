import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as d3 from 'd3';
import { getCyclomaticComplexity, complexityColor, complexityLabel } from '../lib/astUtils';
import {
  findDeadNodes,
  findCycles,
  computeDepths,
  isEntryPoint,
  getNHopNeighbours,
} from '../lib/graphAlgorithms';
import '../components/styles/features.css';

const MODES = [
  { id: 'complexity', label: '🌡 Complexity' },
  { id: 'deadcode',   label: '💀 Dead Code' },
  { id: 'cycles',     label: '🔄 Cycles' },
  { id: 'depth',      label: '🏗 Depth Layout' },
  { id: 'focus',      label: '🎯 Focus Mode' },
];

const BACKEND = import.meta.env.VITE_API_URL;

export default function VisualAnalysis() {
  const { graphData, repoUrl } = useOutletContext();
  const svgRef = useRef(null);
  const simRef = useRef(null);

  const [mode, setMode] = useState('complexity');
  const [complexityMap, setComplexityMap] = useState({});
  const [loadingComplexity, setLoadingComplexity] = useState(false);
  const [deadNodes, setDeadNodes] = useState(new Set());
  const [cycles, setCycles] = useState([]);
  const [cycleNodes, setCycleNodes] = useState(new Set());
  const [depths, setDepths] = useState(new Map());
  const [focusNode, setFocusNode] = useState(null);
  const [focusHops, setFocusHops] = useState(2);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showCycleSidebar, setShowCycleSidebar] = useState(false);

  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.links ?? graphData?.edges ?? [];

  // ── Compute graph algorithm results ──────────────────────────
  useEffect(() => {
    if (!nodes.length) return;
    setDeadNodes(new Set(findDeadNodes(nodes, edges)));
    const foundCycles = findCycles(nodes, edges);
    setCycles(foundCycles);
    const cn = new Set(foundCycles.flat());
    setCycleNodes(cn);
    const entryIds = nodes.filter(n => isEntryPoint(n)).map(n => n.id);
    if (entryIds.length) setDepths(computeDepths(nodes, edges, entryIds));
  }, [nodes, edges]);

  // ── Fetch complexity scores ───────────────────────────────────
  const loadComplexity = useCallback(async () => {
    if (!repoUrl || !nodes.length) return;
    setLoadingComplexity(true);
    const results = {};
    const jsNodes = nodes.filter(n => /\.[jt]sx?$/.test(n.filePath || n.id || ''));
    for (let i = 0; i < jsNodes.length; i += 5) {
      const batch = jsNodes.slice(i, i + 5);
      await Promise.all(batch.map(async (node) => {
        try {
          const fp = node.filePath || node.id;
          const res = await fetch(`${BACKEND}/api/github/file?repoUrl=${encodeURIComponent(repoUrl)}&filePath=${encodeURIComponent(fp)}`);
          const data = await res.json();
          if (data.success) results[node.id] = getCyclomaticComplexity(data.content);
        } catch { results[node.id] = 1; }
      }));
    }
    setComplexityMap(results);
    setLoadingComplexity(false);
  }, [repoUrl, nodes]);

  useEffect(() => {
    if (mode === 'complexity' && !Object.keys(complexityMap).length) loadComplexity();
  }, [mode]);

  // ── D3 Graph ─────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = svgRef.current.clientWidth || 800;
    const h = svgRef.current.clientHeight || 600;

    const g = svg.append('g');

    svg.call(
      d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => {
        g.attr('transform', event.transform);
      })
    );

    // Determine visible nodes for focus mode
    let visibleIds = null;
    if (mode === 'focus' && focusNode) {
      visibleIds = getNHopNeighbours(focusNode, edges, focusHops);
    }

    // Determine node positions for depth layout
    let depthPositions = null;
    if (mode === 'depth' && depths.size) {
      const maxDepth = Math.max(...depths.values());
      const tierW = w / (maxDepth + 2);
      const grouped = {};
      for (const [id, d] of depths.entries()) {
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(id);
      }
      depthPositions = {};
      for (const [d, ids] of Object.entries(grouped)) {
        const tierH = h / (ids.length + 1);
        ids.forEach((id, i) => {
          depthPositions[id] = { x: tierW * (+d + 1), y: tierH * (i + 1) };
        });
      }
      // Unlinked nodes at bottom
      nodes.filter(n => !depths.has(n.id)).forEach((n, i) => {
        depthPositions[n.id] = { x: tierW * (i % 5 + 1), y: h - 60 };
      });
    }

    // Draw depth tier bands
    if (mode === 'depth' && depths.size) {
      const maxDepth = Math.max(...depths.values());
      const tierW = w / (maxDepth + 2);
      for (let d = 0; d <= maxDepth; d++) {
        g.append('rect')
          .attr('x', tierW * d + tierW / 2)
          .attr('y', 0)
          .attr('width', tierW)
          .attr('height', h)
          .attr('fill', d % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent');
        g.append('text')
          .attr('class', 'depth-tier-label')
          .attr('x', tierW * d + tierW / 2 + 6)
          .attr('y', 20)
          .text(`Tier ${d}`);
      }
    }

    const simNodes = nodes.map(n => {
      const pos = depthPositions?.[n.id];
      return { ...n, x: pos?.x ?? w / 2, y: pos?.y ?? h / 2 };
    });
    const nodeById = Object.fromEntries(simNodes.map(n => [n.id, n]));

    const simEdges = edges
      .filter(e => {
        const s = e.source?.id ?? e.source;
        const t = e.target?.id ?? e.target;
        return nodeById[s] && nodeById[t];
      })
      .map(e => ({
        source: nodeById[e.source?.id ?? e.source],
        target: nodeById[e.target?.id ?? e.target],
        isCyclic: mode === 'cycles' && cycleNodes.has(e.source?.id ?? e.source) && cycleNodes.has(e.target?.id ?? e.target),
      }));

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id(d => d.id).distance(60).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(16));

    if (mode === 'depth' && depthPositions) {
      sim.force('x', d3.forceX(d => depthPositions[d.id]?.x ?? w / 2).strength(0.8));
      sim.force('y', d3.forceY(d => depthPositions[d.id]?.y ?? h / 2).strength(0.4));
    }

    simRef.current = sim;

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow-va').attr('viewBox', '0 -4 8 8').attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#2d2340');

    defs.append('marker')
      .attr('id', 'arrow-cycle').attr('viewBox', '0 -4 8 8').attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#ff4455');

    const link = g.append('g').selectAll('line').data(simEdges).join('line')
      .attr('stroke', d => d.isCyclic ? '#ff4455' : '#1e1830')
      .attr('stroke-width', d => d.isCyclic ? 2 : 1)
      .attr('stroke-dasharray', d => d.isCyclic ? '5,3' : null)
      .attr('marker-end', d => d.isCyclic ? 'url(#arrow-cycle)' : 'url(#arrow-va)')
      .attr('opacity', 0.6);

    const getNodeColor = (n) => {
      const isVisible = !visibleIds || visibleIds.has(n.id);
      if (!isVisible) return '#1e1830';
      if (mode === 'complexity') {
        const score = complexityMap[n.id];
        return score ? complexityColor(score) : '#2d2340';
      }
      if (mode === 'deadcode') return deadNodes.has(n.id) ? '#4a3d60' : '#b47dff';
      if (mode === 'cycles') return cycleNodes.has(n.id) ? '#ff4455' : '#2d2340';
      if (mode === 'depth') {
        const d = depths.get(n.id) ?? -1;
        return d === -1 ? '#2d2340' : d3.interpolateCool(d / Math.max(...depths.values(), 1));
      }
      if (mode === 'focus') return isVisible ? '#b47dff' : '#1e1830';
      return '#b47dff';
    };

    const getNodeOpacity = (n) => {
      if (mode === 'deadcode' && !deadNodes.has(n.id)) return 0.3;
      if (mode === 'focus' && focusNode && !visibleIds?.has(n.id)) return 0.15;
      return 1;
    };

    const nodeGroup = g.append('g').selectAll('g').data(simNodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('click', (e, d) => {
        e.stopPropagation();
        if (mode === 'focus') setFocusNode(d.id);
        setSelectedNode(d);
      });

    nodeGroup.append('circle')
      .attr('r', 10)
      .attr('fill', d => getNodeColor(d))
      .attr('opacity', d => getNodeOpacity(d))
      .attr('stroke', d => d.id === selectedNode?.id ? '#fff' : 'none')
      .attr('stroke-width', 2);

    // Complexity badge
    if (mode === 'complexity') {
      nodeGroup.filter(d => complexityMap[d.id] > 0)
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '7px')
        .attr('fill', '#000')
        .attr('pointer-events', 'none')
        .text(d => complexityMap[d.id] || '');
    }

    // Dead code label
    if (mode === 'deadcode') {
      nodeGroup.filter(d => deadNodes.has(d.id))
        .append('text')
        .attr('dy', '2em')
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', '#4a3d60')
        .attr('pointer-events', 'none')
        .text('unused');
    }

    // Node label
    nodeGroup.append('text')
      .attr('dy', '-1.4em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#4a3d60')
      .attr('pointer-events', 'none')
      .text(d => {
        const fp = d.filePath || d.id || '';
        return fp.split('/').pop()?.slice(0, 16) ?? '';
      });

    svg.on('click', () => { setSelectedNode(null); });

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, edges, mode, complexityMap, deadNodes, cycleNodes, depths, focusNode, focusHops, selectedNode]);

  if (!graphData) {
    return (
      <div className="feature-empty" style={{ height: '100%' }}>
        <span className="feature-empty-icon">⬡</span>
        <p>Analyze a repository first</p>
        <small>Switch to the Graph tab and paste a GitHub URL</small>
      </div>
    );
  }

  return (
    <div className="feature-page">
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Mode controls */}
        <div className="visual-controls" style={{ position: 'relative', padding: '12px', borderRight: '1px solid #1e1830', background: '#100d1a', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {MODES.map(m => (
            <button
              key={m.id}
              className={`visual-mode-btn${mode === m.id ? ' active' : ''}`}
              onClick={() => { setMode(m.id); setSelectedNode(null); }}
            >
              {m.label}
            </button>
          ))}

          {mode === 'focus' && (
            <div style={{ marginTop: 10 }}>
              <div className="feat-label" style={{ marginBottom: 4 }}>HOPS: {focusHops}</div>
              <input
                type="range" min={1} max={5} value={focusHops}
                className="focus-slider"
                onChange={e => setFocusHops(+e.target.value)}
                style={{ width: '100%', accentColor: '#b47dff' }}
              />
              {focusNode && (
                <button
                  className="feat-btn outline" style={{ width: '100%', marginTop: 8, fontSize: 10 }}
                  onClick={() => setFocusNode(null)}
                >Clear Focus</button>
              )}
            </div>
          )}

          {mode === 'cycles' && cycles.length > 0 && (
            <button
              className="feat-btn outline" style={{ marginTop: 8, fontSize: 10 }}
              onClick={() => setShowCycleSidebar(v => !v)}
            >
              {showCycleSidebar ? 'Hide' : 'Show'} Cycles ({cycles.length})
            </button>
          )}

          {mode === 'complexity' && (
            <button
              className="feat-btn" style={{ marginTop: 8, fontSize: 10 }}
              onClick={loadComplexity}
              disabled={loadingComplexity}
            >
              {loadingComplexity ? 'Loading…' : 'Reload'}
            </button>
          )}

          {/* Stats */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #1e1830' }}>
            <div className="feat-label" style={{ marginBottom: 6 }}>STATS</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a3d60', lineHeight: 1.8 }}>
              <div>{nodes.length} files</div>
              <div>{edges.length} links</div>
              {mode === 'deadcode' && <div style={{ color: '#8070a0' }}>{deadNodes.size} unused</div>}
              {mode === 'cycles' && <div style={{ color: '#ff4455' }}>{cycles.length} cycle{cycles.length !== 1 ? 's' : ''}</div>}
              {mode === 'complexity' && loadingComplexity && <div className="feat-loading"><span className="feat-spinner" />Scanning…</div>}
            </div>
          </div>
        </div>

        {/* Graph canvas */}
        <div className="visual-graph-wrap" style={{ flex: 1, position: 'relative' }}>
          <svg ref={svgRef} className="visual-graph-svg" />

          {/* Legend */}
          {mode === 'complexity' && (
            <div className="visual-legend">
              {[['#10B981','1–5 Simple'],['#F59E0B','6–10 Moderate'],['#F97316','11–20 Complex'],['#EF4444','21+ Critical']].map(([c, l]) => (
                <div key={l} className="visual-legend-item">
                  <span className="visual-legend-dot" style={{ background: c }} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}

          {mode === 'deadcode' && (
            <div className="visual-legend">
              <div className="visual-legend-item"><span className="visual-legend-dot" style={{ background: '#b47dff' }} /><span>Active</span></div>
              <div className="visual-legend-item"><span className="visual-legend-dot" style={{ background: '#4a3d60' }} /><span>Possibly unused</span></div>
            </div>
          )}

          {mode === 'cycles' && (
            <div className="visual-legend">
              <div className="visual-legend-item"><span className="visual-legend-dot" style={{ background: '#ff4455' }} /><span>In cycle</span></div>
              <div className="visual-legend-item"><span className="visual-legend-dot" style={{ background: '#2d2340' }} /><span>No cycle</span></div>
              {cycles.length > 0 && (
                <div style={{ marginTop: 8, padding: '4px 0', borderTop: '1px solid #1e1830' }}>
                  <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#ff4455' }}>⚠ {cycles.length} circular dep{cycles.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}

          {mode === 'focus' && !focusNode && (
            <div className="visual-legend">
              <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60' }}>Click a node to focus</span>
            </div>
          )}

          {mode === 'focus' && focusNode && (
            <div className="visual-legend">
              <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#b47dff', marginBottom: 4 }}>
                Focused: {(nodes.find(n => n.id === focusNode)?.filePath || focusNode).split('/').pop()}
              </div>
              <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60' }}>
                {focusHops} hop{focusHops > 1 ? 's' : ''} · {getNHopNeighbours(focusNode, edges, focusHops).size} nodes
              </div>
            </div>
          )}

          {/* Selected node info */}
          {selectedNode && (
            <div className="visual-info-panel">
              <h4>Selected File</h4>
              <div className="visual-info-item"><span>File</span><span style={{ textAlign: 'right', wordBreak: 'break-all' }}>{selectedNode.filePath?.split('/').pop() || selectedNode.id}</span></div>
              {mode === 'complexity' && complexityMap[selectedNode.id] && (
                <>
                  <div className="visual-info-item"><span>Complexity</span><span style={{ color: complexityColor(complexityMap[selectedNode.id]) }}>{complexityMap[selectedNode.id]}</span></div>
                  <div className="visual-info-item"><span>Rating</span><span style={{ color: complexityColor(complexityMap[selectedNode.id]) }}>{complexityLabel(complexityMap[selectedNode.id])}</span></div>
                </>
              )}
              {mode === 'deadcode' && <div className="visual-info-item"><span>Status</span><span style={{ color: deadNodes.has(selectedNode.id) ? '#8070a0' : '#5affb8' }}>{deadNodes.has(selectedNode.id) ? 'Possibly unused' : 'Active'}</span></div>}
              {mode === 'cycles' && <div className="visual-info-item"><span>In cycle</span><span style={{ color: cycleNodes.has(selectedNode.id) ? '#ff4455' : '#5affb8' }}>{cycleNodes.has(selectedNode.id) ? 'Yes' : 'No'}</span></div>}
              {mode === 'depth' && <div className="visual-info-item"><span>Tier</span><span>{depths.get(selectedNode.id) ?? 'Unlinked'}</span></div>}
            </div>
          )}

          {/* Cycle sidebar */}
          {mode === 'cycles' && showCycleSidebar && cycles.length > 0 && (
            <div className="cycle-sidebar">
              <h4>⚠ Circular Dependencies</h4>
              {cycles.map((cycle, i) => (
                <div
                  key={i}
                  className="cycle-item"
                  style={{ borderColor: selectedCycle === i ? '#EF4444' : undefined }}
                  onClick={() => setSelectedCycle(i === selectedCycle ? null : i)}
                >
                  <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#4a3d60', marginBottom: 4 }}>Cycle {i + 1} · {cycle.length} files</div>
                  <div className="cycle-chain">
                    {cycle.map((id, j) => (
                      <span key={id}>
                        <span>{id.split('/').pop()}</span>
                        {j < cycle.length - 1 && <span> → </span>}
                      </span>
                    ))}
                    <span> → <span style={{ color: '#EF4444' }}>{cycle[0]?.split('/').pop()}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
