import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { diffLines } from 'diff';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { saveAs } from 'file-saver';
import { generateOnboardingPath } from '../lib/graphAlgorithms';
import '../components/styles/features.css';

const BACKEND = import.meta.env.VITE_API_URL;

// ─── Feature 9: Bookmarks & Annotations ──────────────────────────────────────
function Annotations({ nodes }) {
  const LS_KEY = 'graph-annotations';
  const getAll = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };

  const [annotations, setAnnotations] = useState(getAll);
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');
  const [color, setColor] = useState('yellow');
  const [nodeId, setNodeId] = useState('');

  const save = () => {
    if (!nodeId || !text.trim()) return;
    const all = { ...annotations, [nodeId]: { nodeId, text: text.trim(), color, createdAt: new Date().toISOString() } };
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    setAnnotations(all);
    setText(''); setNodeId(''); setEditing(null);
  };

  const del = (id) => {
    const all = { ...annotations };
    delete all[id];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    setAnnotations(all);
  };

  const shareUrl = () => {
    const encoded = btoa(JSON.stringify(annotations));
    const url = `${window.location.origin}${window.location.pathname}#annotations=${encoded}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success('URL copied to clipboard!');
  };

  const sorted = Object.values(annotations).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: 0 }}>📌 Bookmarks & Annotations</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.keys(annotations).length > 0 && <button className="feat-btn outline" style={{ fontSize: 10 }} onClick={shareUrl}>Share URL</button>}
          <button className="feat-btn" style={{ fontSize: 10 }} onClick={() => { setEditing(true); setText(''); setNodeId(''); }}>+ Add Note</button>
        </div>
      </div>

      {editing && (
        <div className="annotation-form">
          <div>
            <div className="feat-label" style={{ marginBottom: 4 }}>Select File</div>
            <select
              className="diff-selector" style={{ width: '100%' }}
              value={nodeId} onChange={e => setNodeId(e.target.value)}
            >
              <option value="">-- choose a file --</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.filePath || n.id}</option>)}
            </select>
          </div>
          <textarea className="annotation-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Write your note here…" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="feat-label" style={{ marginBottom: 4 }}>Color</div>
              <div className="color-picker">
                {['yellow','red','green','blue'].map(c => (
                  <div key={c} className={`color-chip ${c}${color === c ? ' selected' : ''}`} onClick={() => setColor(c)} title={c} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="feat-btn outline" style={{ fontSize: 10 }} onClick={() => setEditing(null)}>Cancel</button>
              <button className="feat-btn" style={{ fontSize: 10 }} onClick={save} disabled={!nodeId || !text.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 && !editing && (
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#4a3d60', padding: '20px 0' }}>No annotations yet. Click "+ Add Note" to start.</div>
      )}

      <div className="annotation-list">
        {sorted.map(a => (
          <div key={a.nodeId} className={`annotation-card ${a.color}`}>
            <div className="annotation-node">{(nodes.find(n => n.id === a.nodeId)?.filePath || a.nodeId).split('/').pop()}</div>
            <div className="annotation-text">{a.text}</div>
            <div className="annotation-meta">
              <span className="annotation-date">{new Date(a.createdAt).toLocaleDateString()}</span>
              <div className="annotation-actions">
                <button className="feat-btn outline" style={{ fontSize: 9 }} onClick={() => { setEditing(true); setNodeId(a.nodeId); setText(a.text); setColor(a.color); del(a.nodeId); }}>Edit</button>
                <button className="feat-btn outline" style={{ fontSize: 9, borderColor: '#ff4455', color: '#ff4455' }} onClick={() => del(a.nodeId)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature 10: Graph Search & Filters ──────────────────────────────────────
function GraphSearch({ nodes, edges }) {
  const [query, setQuery] = useState('');
  const [activeExt, setActiveExt] = useState(null);
  const inputRef = useRef(null);

  const allExts = [...new Set(nodes.map(n => (n.filePath || n.id || '').split('.').pop()).filter(Boolean))].slice(0, 10);

  const connectionCount = (nodeId) => edges.filter(e => (e.source?.id ?? e.source) === nodeId || (e.target?.id ?? e.target) === nodeId).length;

  const filtered = nodes.filter(n => {
    const fp = n.filePath || n.id || '';
    const matchQ = !query || fp.toLowerCase().includes(query.toLowerCase());
    const matchExt = !activeExt || fp.endsWith(`.${activeExt}`);
    return matchQ && matchExt;
  });

  useEffect(() => {
    const handler = (e) => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div>
      <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: '0 0 14px' }}>🔍 Graph Search & Filters</h3>

      <div className="search-bar-wrap">
        <span className="search-icon" style={{ fontSize: 14 }}>⌕</span>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search files… (press / to focus)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="filter-chips">
        {allExts.map(ext => (
          <button
            key={ext}
            className={`filter-chip${activeExt === ext ? ' active' : ''}`}
            onClick={() => setActiveExt(activeExt === ext ? null : ext)}
          >
            .{ext}
          </button>
        ))}
        {(query || activeExt) && (
          <button className="filter-chip active" onClick={() => { setQuery(''); setActiveExt(null); }}>× Clear all</button>
        )}
      </div>

      <div className="search-count">{filtered.length} of {nodes.length} files</div>

      <div className="search-results">
        {filtered.map(n => {
          const fp = n.filePath || n.id || '';
          const ext = fp.split('.').pop();
          const conn = connectionCount(n.id);
          return (
            <div key={n.id} className="search-result-item">
              <span className="search-result-path" title={fp}>{fp}</span>
              {ext && <span className="search-result-badge">.{ext}</span>}
              {conn > 0 && <span className="search-result-badge" style={{ background: 'rgba(90,255,184,0.08)', color: '#5affb8' }}>{conn} links</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Feature 12: Side-by-Side Diff Viewer ─────────────────────────────────────
function DiffViewer({ nodes, repoUrl }) {
  const [file1, setFile1] = useState('');
  const [file2, setFile2] = useState('');
  const [code1, setCode1] = useState('');
  const [code2, setCode2] = useState('');
  const [diffResult, setDiffResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const panel1Ref = useRef(null);
  const panel2Ref = useRef(null);
  let syncingScroll = false;

  const fetchCode = useCallback(async (filePath) => {
    const res = await fetch(`${BACKEND}/api/github/file?repoUrl=${encodeURIComponent(repoUrl)}&filePath=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    return data.success ? data.content : '';
  }, [repoUrl]);

  const compare = useCallback(async () => {
    if (!file1 || !file2) return;
    setLoading(true);
    const [c1, c2] = await Promise.all([fetchCode(file1), fetchCode(file2)]);
    setCode1(c1); setCode2(c2);
    setDiffResult(diffLines(c1, c2));
    setLoading(false);
  }, [file1, file2, fetchCode]);

  const syncScroll = (source, target) => (e) => {
    if (syncingScroll) return;
    syncingScroll = true;
    if (target.current) target.current.scrollTop = e.target.scrollTop;
    setTimeout(() => { syncingScroll = false; }, 10);
  };

  const renderDiffPanel = (side) => {
    const lines = [];
    let lineNum = 0;
    for (const part of diffResult) {
      if (side === 'left' && part.added) continue;
      if (side === 'right' && part.removed) continue;
      const partLines = part.value.split('\n');
      partLines.forEach((text, i) => {
        if (i === partLines.length - 1 && text === '') return;
        lineNum++;
        const cls = part.added ? 'added' : part.removed ? 'removed' : 'context';
        lines.push(
          <div key={`${lineNum}-${i}`} className={`diff-line ${cls}`}>
            <span className="diff-line-num">{lineNum}</span>
            <span className="diff-line-content">{text || ' '}</span>
          </div>
        );
      });
    }
    return lines;
  };

  return (
    <div className="diff-layout" style={{ minHeight: '60vh' }}>
      <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: '0 0 14px' }}>⇄ Side-by-Side Diff Viewer</h3>

      <div className="diff-selectors">
        <select className="diff-selector" value={file1} onChange={e => setFile1(e.target.value)}>
          <option value="">-- File A --</option>
          {nodes.map(n => <option key={n.id} value={n.filePath || n.id}>{n.filePath || n.id}</option>)}
        </select>
        <select className="diff-selector" value={file2} onChange={e => setFile2(e.target.value)}>
          <option value="">-- File B --</option>
          {nodes.map(n => <option key={n.id} value={n.filePath || n.id}>{n.filePath || n.id}</option>)}
        </select>
        <button className="feat-btn" onClick={compare} disabled={!file1 || !file2 || loading}>
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </div>

      {diffResult.length > 0 && (
        <div className="diff-panels" style={{ flex: 1, minHeight: 400 }}>
          <div className="diff-panel" ref={panel1Ref} onScroll={syncScroll(panel1Ref, panel2Ref)}>
            <div className="diff-panel-header">{file1}</div>
            {renderDiffPanel('left')}
          </div>
          <div className="diff-panel" ref={panel2Ref} onScroll={syncScroll(panel2Ref, panel1Ref)}>
            <div className="diff-panel-header">{file2}</div>
            {renderDiffPanel('right')}
          </div>
        </div>
      )}

      {!diffResult.length && !loading && (
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#4a3d60' }}>Select two files above and click Compare to see the diff</div>
      )}
    </div>
  );
}

// ─── Feature 13: Keyboard Shortcuts ───────────────────────────────────────────
function KeyboardShortcutsPanel() {
  const shortcuts = [
    { key: '/', desc: 'Focus search bar' },
    { key: 'F', desc: 'Enter focus mode on selected node' },
    { key: 'Esc', desc: 'Clear selection / close panels' },
    { key: 'H', desc: 'Highlight nodes that depend on selection' },
    { key: 'D', desc: 'Highlight nodes selection depends on' },
    { key: 'C', desc: 'Toggle complexity heatmap' },
    { key: 'X', desc: 'Toggle dead code view' },
    { key: 'Ctrl+E', desc: 'Export current view as SVG' },
    { key: 'Ctrl+K', desc: 'Open command palette' },
    { key: '?', desc: 'Open this keyboard shortcuts panel' },
    { key: '1–5', desc: 'Set focus mode hop count' },
    { key: 'G → D', desc: 'Go to Dependency Depth layout' },
    { key: 'G → H', desc: 'Go to Complexity Heatmap' },
  ];

  return (
    <div>
      <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: '0 0 14px' }}>⌨ Keyboard Shortcuts</h3>
      <div className="shortcuts-grid">
        {shortcuts.map(({ key, desc }) => (
          <div key={key} className="shortcut-row">
            <kbd className="kbd">{key}</kbd>
            <span className="shortcut-desc">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature 14: Architecture SVG Export ──────────────────────────────────────
function ArchitectureExport({ nodes }) {
  const exportSVG = () => {
    const svgEl = document.querySelector('.dependency-graph-svg') || document.querySelector('svg');
    if (!svgEl) { toast.error('No graph SVG found. Go to the Graph tab first.'); return; }
    const clone = svgEl.cloneNode(true);
    clone.insertAdjacentHTML('afterbegin', '<rect width="100%" height="100%" fill="#08050f"/>');
    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    saveAs(blob, 'architecture.svg');
  };

  const exportPNG = async () => {
    const svgEl = document.querySelector('.dependency-graph-svg') || document.querySelector('svg');
    if (!svgEl) { toast.error('No graph SVG found. Go to the Graph tab first.'); return; }
    const clone = svgEl.cloneNode(true);
    clone.insertAdjacentHTML('afterbegin', '<rect width="100%" height="100%" fill="#08050f"/>');
    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => saveAs(b, 'architecture.png'));
  };

  const copyToClipboard = () => {
    const svgEl = document.querySelector('.dependency-graph-svg') || document.querySelector('svg');
    if (!svgEl) { toast.error('No graph SVG found. Go to the Graph tab first.'); return; }
    const str = new XMLSerializer().serializeToString(svgEl);
    navigator.clipboard.writeText(str).then(() => toast.success('SVG copied to clipboard!')).catch(() => toast.error('Copy failed.'));
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: '0 0 8px' }}>📤 Architecture Export</h3>
      <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60', margin: '0 0 16px' }}>
        Export the dependency graph as a file. Open the Graph tab and analyze a repo first.
      </p>
      <div className="export-options">
        <div className="export-btn-row" onClick={exportSVG}>
          <span className="export-btn-icon">🖼</span>
          <div className="export-btn-info">
            <h4>Export as SVG</h4>
            <p>Vector format — scalable, paste into Figma, Notion, docs</p>
          </div>
        </div>
        <div className="export-btn-row" onClick={exportPNG}>
          <span className="export-btn-icon">📷</span>
          <div className="export-btn-info">
            <h4>Export as PNG (2×)</h4>
            <p>High-resolution raster — perfect for presentations & READMEs</p>
          </div>
        </div>
        <div className="export-btn-row" onClick={copyToClipboard}>
          <span className="export-btn-icon">📋</span>
          <div className="export-btn-info">
            <h4>Copy SVG to Clipboard</h4>
            <p>Paste directly into Figma, Inkscape, or any SVG-aware tool</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature 15: Onboarding Path Generator ────────────────────────────────────
function OnboardingPath({ nodes, edges }) {
  const [entryId, setEntryId] = useState('');
  const [path, setPath] = useState([]);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    if (!entryId) return;
    setPath(generateOnboardingPath(entryId, nodes, edges));
  };

  const grouped = path.reduce((acc, step) => {
    const tier = step.depth === 0 ? 'Start here' : step.depth === 1 ? 'Core modules' : step.depth === 2 ? 'Business logic' : 'Utilities';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(step);
    return acc;
  }, {});

  const toMarkdown = () => {
    const lines = ['## Getting Started with this Codebase', ''];
    let stepNum = 1;
    for (const [group, steps] of Object.entries(grouped)) {
      lines.push(`### ${group}`);
      for (const s of steps) {
        lines.push(`- [ ] \`${s.filePath}\``);
        stepNum++;
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const exportMd = () => {
    const blob = new Blob([toMarkdown()], { type: 'text/markdown' });
    saveAs(blob, 'onboarding.md');
  };

  const copyMd = () => {
    navigator.clipboard.writeText(toMarkdown()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  return (
    <div>
      <h3 style={{ fontFamily: 'Space Mono', fontSize: 13, color: '#e8e0f5', margin: '0 0 14px' }}>🗺 Onboarding Path Generator</h3>
      <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#4a3d60', margin: '0 0 14px' }}>
        Generates a suggested reading order for new developers — from entry point outward using BFS.
      </p>

      <div className="onboarding-selectors">
        <select className="diff-selector" style={{ flex: 1 }} value={entryId} onChange={e => setEntryId(e.target.value)}>
          <option value="">-- Select entry point file --</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.filePath || n.id}</option>)}
        </select>
        <button className="feat-btn" onClick={generate} disabled={!entryId}>Generate</button>
      </div>

      {path.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className="feat-btn outline" style={{ fontSize: 10 }} onClick={exportMd}>Export .md</button>
            <button className="feat-btn outline" style={{ fontSize: 10 }} onClick={copyMd}>{copied ? 'Copied!' : 'Copy for README'}</button>
          </div>

          <div className="onboarding-path-list">
            {Object.entries(grouped).map(([group, steps]) => (
              <div key={group} className="onboarding-group">
                <div className="onboarding-group-title">{group}</div>
                {steps.map(step => (
                  <div key={step.nodeId} className="onboarding-step">
                    <span className="onboarding-step-num">{step.readingOrder}</span>
                    <span className="onboarding-step-path" title={step.filePath}>{step.filePath}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Developer Tools Page ──────────────────────────────────────────────────────
const TOOLS = [
  { id: 'search',    label: '🔍 Search', icon: '🔍' },
  { id: 'notes',     label: '📌 Notes', icon: '📌' },
  { id: 'diff',      label: '⇄ Diff', icon: '⇄' },
  { id: 'shortcuts', label: '⌨ Shortcuts', icon: '⌨' },
  { id: 'export',    label: '📤 Export', icon: '📤' },
  { id: 'onboard',   label: '🗺 Onboarding', icon: '🗺' },
];

export default function DeveloperTools() {
  const { graphData, repoUrl } = useOutletContext();
  const [activeTool, setActiveTool] = useState('search');

  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.links ?? graphData?.edges ?? [];

  const renderTool = () => {
    switch (activeTool) {
      case 'search':    return <GraphSearch nodes={nodes} edges={edges} />;
      case 'notes':     return <Annotations nodes={nodes} />;
      case 'diff':      return <DiffViewer nodes={nodes} repoUrl={repoUrl} />;
      case 'shortcuts': return <KeyboardShortcutsPanel />;
      case 'export':    return <ArchitectureExport nodes={nodes} />;
      case 'onboard':   return <OnboardingPath nodes={nodes} edges={edges} />;
      default:          return null;
    }
  };

  if (!graphData && activeTool !== 'shortcuts') {
    return (
      <div className="feature-page">
        <div className="tools-layout">
          <div className="tools-sidebar">
            {TOOLS.map(t => (
              <button key={t.id} className={`tools-sidebar-btn${activeTool === t.id ? ' active' : ''}`} onClick={() => setActiveTool(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="tools-main">
            {activeTool === 'shortcuts' ? <KeyboardShortcutsPanel /> : (
              <div className="feature-empty" style={{ height: '80%' }}>
                <span className="feature-empty-icon">🔧</span>
                <p>Analyze a repository first</p>
                <small>Switch to the Graph tab and paste a GitHub URL</small>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feature-page">
      <div className="tools-layout">
        <div className="tools-sidebar">
          {TOOLS.map(t => (
            <button key={t.id} className={`tools-sidebar-btn${activeTool === t.id ? ' active' : ''}`} onClick={() => setActiveTool(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="tools-main">{renderTool()}</div>
      </div>
    </div>
  );
}
