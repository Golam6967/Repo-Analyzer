import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as d3 from 'd3';
import { hashFunctions } from '../lib/astUtils';
import { getLanguageCounts } from '../lib/graphAlgorithms';
import '../components/styles/features.css';

const BACKEND = import.meta.env.VITE_API_URL;
const LANG_COLORS = [
  '#b47dff','#5affb8','#F59E0B','#ff4455','#e0aaff',
  '#ec4899','#14b8a6','#f97316','#8070a0','#84cc16',
];

// ─── Feature 7: Language Breakdown ───────────────────────────────────────────
function LanguageBreakdown({ nodes, onFilter }) {
  const counts = getLanguageCounts(nodes);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [active, setActive] = useState(null);

  const toggle = (lang) => {
    const next = active === lang ? null : lang;
    setActive(next);
    onFilter(next);
  };

  return (
    <div className="metric-card">
      <h3>📊 <span>Language Breakdown</span></h3>
      <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#4a3d60' }}>{total} files total</div>
      <div className="lang-list">
        {sorted.map(([lang, count], i) => {
          const pct = (count / total * 100).toFixed(1);
          return (
            <div
              key={lang}
              className="lang-bar-row"
              onClick={() => toggle(lang)}
              style={{ opacity: active && active !== lang ? 0.4 : 1 }}
            >
              <span className="lang-name">{lang}</span>
              <div className="lang-bar">
                <div className="lang-bar-fill" style={{ width: `${pct}%`, background: LANG_COLORS[i % LANG_COLORS.length] }} />
              </div>
              <span className="lang-count">{count}</span>
            </div>
          );
        })}
      </div>
      {active && (
        <button className="feat-btn outline" style={{ marginTop: 4, fontSize: 10 }} onClick={() => { setActive(null); onFilter(null); }}>
          Clear filter
        </button>
      )}
    </div>
  );
}

// ─── Feature 5: File Size Timeline ───────────────────────────────────────────
function FileSizeTimeline({ nodes, repoUrl }) {
  const chartRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const jsNodes = nodes.filter(n => /\.[jt]sx?$/.test(n.filePath || n.id || '')).slice(0, 50);

  const fetchTimeline = useCallback(async (node) => {
    setSelectedFile(node);
    setLoading(true);
    setTimelineData([]);
    try {
      const fp = node.filePath || node.id;
      const res = await fetch(`${BACKEND}/api/github/commits?repoUrl=${encodeURIComponent(repoUrl)}&filePath=${encodeURIComponent(fp)}`);
      const data = await res.json();
      if (data.success) setTimelineData(data.data);
    } catch { setTimelineData([]); }
    setLoading(false);
  }, [repoUrl]);

  useEffect(() => {
    if (!chartRef.current || !timelineData.length) return;
    const w = chartRef.current.clientWidth || 380;
    const h = 180;
    const margin = { top: 16, right: 16, bottom: 40, left: 40 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const x = d3.scalePoint()
      .domain(timelineData.map((_, i) => i))
      .range([0, iw]);
    const yMax = Math.max(...timelineData.map(d => d.lines), 300);
    const y = d3.scaleLinear().domain([0, yMax]).range([ih, 0]).nice();

    const gEl = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    gEl.append('g').attr('transform', `translate(0,${ih})`).call(
      d3.axisBottom(x).tickFormat(i => timelineData[i]?.sha ?? '').tickSize(0)
    ).select('.domain').attr('stroke', '#2d2340');
    gEl.selectAll('.tick text').attr('fill', '#4a3d60').attr('font-size', 9).attr('transform', 'rotate(-30)').attr('text-anchor', 'end');

    gEl.append('g').call(d3.axisLeft(y).ticks(4).tickSize(-iw)).call(g => {
      g.select('.domain').remove();
      g.selectAll('.tick line').attr('stroke', '#1e1830');
      g.selectAll('.tick text').attr('fill', '#4a3d60').attr('font-size', 9);
    });

    // 300-line threshold
    gEl.append('line')
      .attr('x1', 0).attr('x2', iw).attr('y1', y(300)).attr('y2', y(300))
      .attr('stroke', '#ff4455').attr('stroke-dasharray', '4,2').attr('stroke-width', 1);
    gEl.append('text').attr('x', iw - 4).attr('y', y(300) - 4).attr('fill', '#ff4455').attr('font-size', 9).attr('text-anchor', 'end').text('300 lines');

    const line = d3.line().x((_, i) => x(i)).y(d => y(d.lines)).curve(d3.curveMonotoneX);
    gEl.append('path').datum(timelineData).attr('d', line).attr('fill', 'none').attr('stroke', '#b47dff').attr('stroke-width', 2);

    const tooltip = d3.select('body').append('div')
      .style('position', 'fixed').style('background', '#100d1a').style('border', '1px solid #2d2340')
      .style('padding', '6px 10px').style('border-radius', '6px').style('font-size', '10px')
      .style('font-family', 'Space Mono').style('color', '#e8e0f5').style('pointer-events', 'none')
      .style('opacity', 0).style('z-index', 9999);

    gEl.selectAll('circle').data(timelineData).join('circle')
      .attr('cx', (_, i) => x(i)).attr('cy', d => y(d.lines))
      .attr('r', 4).attr('fill', '#b47dff').attr('stroke', '#08050f').attr('stroke-width', 2)
      .on('mouseover', (e, d) => {
        tooltip.transition().duration(100).style('opacity', 1);
        tooltip.html(`<strong>${d.sha}</strong><br/>${d.lines} lines<br/>${d.message || ''}`);
      })
      .on('mousemove', (e) => tooltip.style('left', `${e.clientX + 12}px`).style('top', `${e.clientY - 20}px`))
      .on('mouseout', () => tooltip.transition().duration(100).style('opacity', 0).on('end', () => tooltip.remove()));

    return () => d3.selectAll('.d3-tooltip-va').remove();
  }, [timelineData]);

  return (
    <div className="metric-card">
      <h3>📈 <span>File Size Timeline</span></h3>
      <div className="timeline-node-list">
        {jsNodes.slice(0, 15).map(n => {
          const fp = n.filePath || n.id;
          return (
            <button
              key={n.id}
              className={`timeline-node-btn${selectedFile?.id === n.id ? ' selected' : ''}`}
              onClick={() => fetchTimeline(n)}
            >
              {fp.split('/').pop()}
            </button>
          );
        })}
      </div>
      {loading && <div className="feat-loading"><span className="feat-spinner" />Fetching commit history…</div>}
      {!loading && timelineData.length > 0 && <svg ref={chartRef} style={{ width: '100%' }} />}
      {!loading && !timelineData.length && !selectedFile && (
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#4a3d60' }}>Select a file above to see its growth timeline</div>
      )}
    </div>
  );
}

// ─── Feature 6: Churn Tracker ─────────────────────────────────────────────────
function ChurnTracker({ repoUrl, complexityMap }) {
  const [churnData, setChurnData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchChurn = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/github/churn?repoUrl=${encodeURIComponent(repoUrl)}`);
      const data = await res.json();
      if (data.success) setChurnData(data.data);
    } catch { setChurnData({}); }
    setLoading(false);
    setLoaded(true);
  }, [repoUrl]);

  const sorted = Object.entries(churnData).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const maxChurn = sorted[0]?.[1] ?? 1;

  return (
    <div className="metric-card">
      <h3>🔥 <span>Churn Tracker</span></h3>
      <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60', margin: 0 }}>Files changed most frequently in last 50 commits. High churn = high risk.</p>
      {!loaded && !loading && (
        <button className="feat-btn" onClick={fetchChurn}>Load Churn Data</button>
      )}
      {loading && <div className="feat-loading"><span className="feat-spinner" />Fetching commits…</div>}
      {loaded && sorted.length > 0 && (
        <div className="churn-list">
          {sorted.map(([file, count]) => {
            const pct = count / maxChurn;
            const isDanger = pct > 0.7;
            const isWarning = pct > 0.4;
            return (
              <div key={file} className={`churn-row${isDanger ? ' danger' : isWarning ? ' warning' : ''}`}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="churn-name" title={file}>{file.split('/').pop()}</div>
                  <div className="lang-bar" style={{ height: '3px', marginTop: 3 }}>
                    <div className="lang-bar-fill" style={{ width: `${pct * 100}%`, background: isDanger ? '#ff4455' : isWarning ? '#F59E0B' : '#b47dff' }} />
                  </div>
                </div>
                <span className="churn-count">{count}×</span>
              </div>
            );
          })}
        </div>
      )}
      {loaded && sorted.length === 0 && (
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#4a3d60' }}>No commit data available</div>
      )}
    </div>
  );
}

// ─── Feature 8: Duplicate Code Detector ──────────────────────────────────────
function DuplicateDetector({ nodes, repoUrl }) {
  const [dupes, setDupes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const detect = useCallback(async () => {
    setLoading(true);
    const jsNodes = nodes.filter(n => /\.[jt]sx?$/.test(n.filePath || n.id || '')).slice(0, 30);
    const fileHashes = {};

    for (let i = 0; i < jsNodes.length; i += 5) {
      const batch = jsNodes.slice(i, i + 5);
      await Promise.all(batch.map(async (node) => {
        try {
          const fp = node.filePath || node.id;
          const res = await fetch(`${BACKEND}/api/github/file?repoUrl=${encodeURIComponent(repoUrl)}&filePath=${encodeURIComponent(fp)}`);
          const data = await res.json();
          if (data.success) {
            const hashes = hashFunctions(data.content);
            for (const [fnName, hash] of hashes.entries()) {
              if (!fileHashes[hash]) fileHashes[hash] = [];
              fileHashes[hash].push({ file: fp.split('/').pop(), fn: fnName, path: fp });
            }
          }
        } catch { /* skip */ }
      }));
    }

    const found = Object.entries(fileHashes)
      .filter(([, entries]) => entries.length > 1)
      .map(([, entries]) => entries);
    setDupes(found);
    setLoading(false);
    setRan(true);
  }, [nodes, repoUrl]);

  const copy = (entries) => {
    const txt = `// Duplicate function found in:\n${entries.map(e => `// - ${e.path}`).join('\n')}\n// Consider extracting to a shared utility.`;
    navigator.clipboard.writeText(txt).catch(() => {});
  };

  return (
    <div className="metric-card">
      <h3>🔍 <span>Duplicate Code</span></h3>
      <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60', margin: 0 }}>Detects identical function bodies across files. Scans first 30 JS/TS files.</p>
      {!ran && !loading && <button className="feat-btn" onClick={detect}>Run Detection</button>}
      {loading && <div className="feat-loading"><span className="feat-spinner" />Scanning functions…</div>}
      {ran && dupes.length === 0 && <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#10B981' }}>No duplicate functions found!</div>}
      {ran && dupes.length > 0 && (
        <div className="dup-list">
          {dupes.slice(0, 10).map((entries, i) => (
            <div key={i} className="dup-item">
              <div className="dup-fn">{entries[0].fn}()</div>
              <div className="dup-files">
                Found in {entries.length} files:
                {entries.map(e => <span key={e.path}>• {e.file}</span>)}
              </div>
              <button className="feat-btn outline" style={{ marginTop: 6, fontSize: 9 }} onClick={() => copy(entries)}>
                Copy extract suggestion
              </button>
            </div>
          ))}
          {dupes.length > 10 && <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60' }}>…and {dupes.length - 10} more</div>}
        </div>
      )}
    </div>
  );
}

// ─── Metrics Dashboard Page ───────────────────────────────────────────────────
export default function MetricsDashboard() {
  const { graphData, repoUrl } = useOutletContext();
  const [langFilter, setLangFilter] = useState(null);

  if (!graphData) {
    return (
      <div className="feature-empty" style={{ height: '100%' }}>
        <span className="feature-empty-icon">📊</span>
        <p>Analyze a repository first</p>
        <small>Switch to the Graph tab and paste a GitHub URL</small>
      </div>
    );
  }

  const nodes = graphData.nodes ?? [];
  const filteredNodes = langFilter
    ? nodes.filter(n => {
        const fp = (n.filePath || n.id || '').toLowerCase();
        const extMap = { typescript: ['.ts', '.tsx'], javascript: ['.js', '.jsx'], python: ['.py'], go: ['.go'], rust: ['.rs'], java: ['.java'], 'c#': ['.cs'], ruby: ['.rb'], php: ['.php'], 'c++': ['.cpp', '.cc', '.cxx'], c: ['.c'], markdown: ['.md'], css: ['.css'] };
        const exts = extMap[langFilter.toLowerCase()] || [`.${langFilter.toLowerCase()}`];
        return exts.some(ext => fp.endsWith(ext));
      })
    : nodes;

  return (
    <div className="feature-page">
      <div className="metrics-grid" style={{ flex: 1, overflowY: 'auto' }}>
        <LanguageBreakdown nodes={nodes} onFilter={setLangFilter} />
        <FileSizeTimeline nodes={filteredNodes} repoUrl={repoUrl} />
        <ChurnTracker repoUrl={repoUrl} />
        <DuplicateDetector nodes={filteredNodes} repoUrl={repoUrl} />
      </div>
    </div>
  );
}
