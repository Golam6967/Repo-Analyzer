import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../components/styles/features.css';

const BACKEND = import.meta.env.VITE_API_URL;

// Build reverse adjacency: for each node, who imports it?
function buildReverseAdj(links) {
  const rev = {};
  for (const l of links) {
    const src = l.source?.id ?? l.source;
    const tgt = l.target?.id ?? l.target;
    if (!rev[tgt]) rev[tgt] = [];
    rev[tgt].push(src);
  }
  return rev;
}

// BFS outward through reverse edges to find everything that depends on changedIds
function getBlastRadius(changedIds, links) {
  const changedSet = new Set(changedIds);
  const rev = buildReverseAdj(links);
  const affected = new Set();
  const queue = [...changedIds];

  while (queue.length) {
    const id = queue.shift();
    for (const dep of (rev[id] || [])) {
      if (!changedSet.has(dep) && !affected.has(dep)) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }
  return affected;
}

function statusColor(status) {
  if (status === 'added') return '#5affb8';
  if (status === 'removed') return '#ff4455';
  if (status === 'renamed') return '#b47dff';
  return '#F59E0B';
}

function statusBadge(status) {
  const colors = { added: '#5affb8', removed: '#ff4455', modified: '#F59E0B', renamed: '#b47dff' };
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Space Mono', padding: '2px 6px',
      borderRadius: 3, background: `${colors[status] || '#8070a0'}22`,
      color: colors[status] || '#8070a0', border: `1px solid ${colors[status] || '#8070a0'}44`,
      textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0,
    }}>{status}</span>
  );
}

function FileRow({ filename, status, additions, deletions }) {
  const shortName = filename.split('/').pop();
  const dir = filename.includes('/') ? filename.split('/').slice(0, -1).join('/') + '/' : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      borderBottom: '1px solid #1e1730', fontSize: 11, fontFamily: 'Space Mono',
    }}>
      <span style={{ color: '#4a3d60', fontSize: 10, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        <span style={{ color: '#6b5b8a' }}>{dir}</span>
        <span style={{ color: '#e8e0f5' }}>{shortName}</span>
      </span>
      {statusBadge(status)}
      {additions > 0 && <span style={{ color: '#5affb8', fontSize: 10, flexShrink: 0 }}>+{additions}</span>}
      {deletions > 0 && <span style={{ color: '#ff4455', fontSize: 10, flexShrink: 0 }}>-{deletions}</span>}
    </div>
  );
}

function BlastRow({ nodeId, depth }) {
  const shortName = nodeId.split('/').pop();
  const dir = nodeId.includes('/') ? nodeId.split('/').slice(0, -1).join('/') + '/' : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      borderBottom: '1px solid #1e1730', fontSize: 11, fontFamily: 'Space Mono',
    }}>
      <span style={{ color: '#f97316', fontSize: 9, flexShrink: 0 }}>{'→ '.repeat(Math.min(depth, 3))}</span>
      <span style={{ color: '#4a3d60', fontSize: 10, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#6b5b8a' }}>{dir}</span>
        <span style={{ color: '#e8e0f5' }}>{shortName}</span>
      </span>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#13102200', border: `1px solid ${color}33`, borderRadius: 8,
      padding: '12px 16px', minWidth: 100, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Space Mono' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b5b8a', fontFamily: 'Space Mono', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function PRImpactPage() {
  const { graphData, repoUrl } = useOutletContext();
  const [prInput, setPrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [prData, setPrData] = useState(null);
  const [changedNodes, setChangedNodes] = useState([]);
  const [blastRadius, setBlastRadius] = useState(new Set());
  const [unmappedFiles, setUnmappedFiles] = useState([]);

  const nodes = graphData?.nodes ?? [];
  const links = graphData?.links ?? graphData?.edges ?? [];

  const extractPrNumber = (input) => {
    const trimmed = input.trim();
    // plain number
    if (/^\d+$/.test(trimmed)) return trimmed;
    // GitHub PR URL: .../pull/123
    const match = trimmed.match(/\/pull\/(\d+)/);
    if (match) return match[1];
    return null;
  };

  const analyze = useCallback(async () => {
    if (!graphData) return toast.error('Analyze a repository first');
    const prNum = extractPrNumber(prInput);
    if (!prNum) return toast.error('Enter a valid PR number or GitHub PR URL');

    setLoading(true);
    setPrData(null);
    setChangedNodes([]);
    setBlastRadius(new Set());
    setUnmappedFiles([]);

    try {
      const res = await fetch(
        `${BACKEND}/api/github/pr-impact?repoUrl=${encodeURIComponent(repoUrl)}&pr=${prNum}`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to fetch PR');

      const pr = json.data;
      setPrData(pr);

      // Match PR changed files against graph nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      const matched = [];
      const unmatched = [];

      for (const f of pr.changedFiles) {
        if (nodeIds.has(f.filename)) {
          matched.push({ ...f, nodeId: f.filename });
        } else {
          // Try stripping common prefixes (some repos have frontend/ or src/ prefix)
          const stripped = f.filename.replace(/^[^/]+\//, '');
          if (nodeIds.has(stripped)) {
            matched.push({ ...f, nodeId: stripped });
          } else {
            unmatched.push(f);
          }
        }
      }

      setChangedNodes(matched);
      setUnmappedFiles(unmatched);

      const changedIds = matched.map(m => m.nodeId);
      setBlastRadius(getBlastRadius(changedIds, links));
    } catch (err) {
      toast.error(err.message || 'Failed to load PR data');
    } finally {
      setLoading(false);
    }
  }, [prInput, graphData, repoUrl, nodes, links]);

  const copyPRComment = () => {
    if (!prData) return;
    const changedList = changedNodes.map(f =>
      `- \`${f.filename}\` (+${f.additions} -${f.deletions}) \`${f.status}\``
    ).join('\n');
    const blastList = [...blastRadius].slice(0, 20).map(id => `- \`${id}\``).join('\n');
    const moreLine = blastRadius.size > 20 ? `\n- *...and ${blastRadius.size - 20} more*` : '';

    const comment = `## PR Impact Analysis 🔍

**PR:** [#${prData.prNumber} — ${prData.prTitle}](${prData.prUrl})
**Branch:** \`${prData.headBranch}\` → \`${prData.baseBranch}\`

### Summary
| Changed files (in graph) | Blast radius | +Lines | -Lines |
|---|---|---|---|
| ${changedNodes.length} | ${blastRadius.size} | +${prData.totalAdditions} | -${prData.totalDeletions} |

### Directly Changed
${changedList || '_No tracked source files changed_'}

### Modules at Risk (depend on changed files)
${blastList || '_No dependents found_'}${moreLine}

*Generated by [Hoverboard](${window.location.origin}) — Repo Visualizer*`;

    navigator.clipboard.writeText(comment).then(() => {
      toast.success('PR comment copied to clipboard!');
    }).catch(() => {
      toast.error('Copy failed — check clipboard permissions');
    });
  };

  const noGraph = !graphData;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto', fontFamily: 'Space Mono' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, color: '#e8e0f5', margin: '0 0 6px', letterSpacing: 1 }}>
          PR Impact Analysis
        </h2>
        <p style={{ fontSize: 11, color: '#4a3d60', margin: 0 }}>
          Enter a PR number to see which graph nodes change and what the blast radius is.
        </p>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center' }}>
        <input
          type="text"
          className="analyzer-input"
          placeholder="PR number  or  github.com/owner/repo/pull/123"
          value={prInput}
          onChange={e => setPrInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
          disabled={loading || noGraph}
          style={{ flex: 1, maxWidth: 480 }}
        />
        <button
          className="analyzer-btn"
          onClick={analyze}
          disabled={loading || noGraph || !prInput.trim()}
        >
          {loading ? 'Loading···' : 'Analyze PR'}
        </button>
        {prData && (
          <button className="feat-btn outline" onClick={copyPRComment}>
            Copy PR Comment
          </button>
        )}
      </div>

      {noGraph && (
        <div style={{
          background: '#13102244', border: '1px dashed #2d2340', borderRadius: 10,
          padding: '40px 20px', textAlign: 'center', color: '#4a3d60', fontSize: 12,
        }}>
          Analyze a repository first using the input above, then come back here to assess PR impact.
        </div>
      )}

      {/* PR Meta */}
      {prData && (
        <>
          <div style={{
            background: '#13102244', border: '1px solid #2d2340', borderRadius: 10,
            padding: '14px 18px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, padding: '3px 8px', borderRadius: 4, fontFamily: 'Space Mono',
                background: prData.prState === 'open' ? '#5affb822' : '#6b5b8a22',
                color: prData.prState === 'open' ? '#5affb8' : '#6b5b8a',
                border: `1px solid ${prData.prState === 'open' ? '#5affb844' : '#6b5b8a44'}`,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>{prData.prState}</span>
              <span style={{ fontSize: 13, color: '#e8e0f5', fontWeight: 600 }}>
                #{prData.prNumber} — {prData.prTitle}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#4a3d60', marginTop: 6 }}>
              by <span style={{ color: '#b47dff' }}>{prData.prAuthor}</span>
              {' · '}
              <span style={{ color: '#6b5b8a' }}>{prData.headBranch}</span>
              {' → '}
              <span style={{ color: '#6b5b8a' }}>{prData.baseBranch}</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="files changed (PR total)" value={prData.changedFiles.length} color="#b47dff" />
            <StatCard label="matched in graph" value={changedNodes.length} color="#5affb8" />
            <StatCard label="blast radius" value={blastRadius.size} color="#f97316" />
            <StatCard label="lines added" value={`+${prData.totalAdditions}`} color="#5affb8" />
            <StatCard label="lines removed" value={`-${prData.totalDeletions}`} color="#ff4455" />
          </div>

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Changed files */}
            <div style={{ background: '#13102244', border: '1px solid #2d2340', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid #2d2340',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: '#e8e0f5', fontFamily: 'Space Mono' }}>
                  Directly Changed
                </span>
                <span style={{ fontSize: 10, color: '#5affb8', fontFamily: 'Space Mono' }}>
                  {changedNodes.length} tracked
                </span>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {changedNodes.length === 0 ? (
                  <div style={{ padding: 20, color: '#4a3d60', fontSize: 11, textAlign: 'center' }}>
                    No changed files matched graph nodes
                  </div>
                ) : (
                  changedNodes.map(f => (
                    <FileRow key={f.filename} {...f} />
                  ))
                )}
                {unmappedFiles.length > 0 && (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: '#4a3d60', borderTop: '1px solid #1e1730' }}>
                    +{unmappedFiles.length} non-source files (config, assets, docs) not in graph
                  </div>
                )}
              </div>
            </div>

            {/* Blast radius */}
            <div style={{ background: '#13102244', border: '1px solid #f9731622', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid #f9731622',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: '#e8e0f5', fontFamily: 'Space Mono' }}>
                  Blast Radius
                </span>
                <span style={{ fontSize: 10, color: '#f97316', fontFamily: 'Space Mono' }}>
                  {blastRadius.size} at risk
                </span>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {blastRadius.size === 0 ? (
                  <div style={{ padding: 20, color: '#4a3d60', fontSize: 11, textAlign: 'center' }}>
                    {changedNodes.length === 0
                      ? 'Analyze a PR to see dependents'
                      : 'No other modules depend on these files'}
                  </div>
                ) : (
                  [...blastRadius].map(id => (
                    <BlastRow key={id} nodeId={id} depth={1} />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
