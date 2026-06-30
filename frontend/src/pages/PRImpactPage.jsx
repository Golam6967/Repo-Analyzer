import React, { useState, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../components/styles/features.css';

const BACKEND = import.meta.env.VITE_API_URL;
const TEST_PATTERN = /\.(test|spec)\.[jt]sx?$|__tests__\//i;

// ─── Graph helpers ─────────────────────────────────────────────────────────────

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

function getPerFileBlast(nodeId, revAdj) {
  const affected = new Set();
  const queue = [nodeId];
  const visited = new Set([nodeId]);
  while (queue.length) {
    const id = queue.shift();
    for (const dep of (revAdj[id] || [])) {
      if (!visited.has(dep)) {
        visited.add(dep);
        affected.add(dep);
        queue.push(dep);
      }
    }
  }
  const directCount = (revAdj[nodeId] || []).length;
  return { total: affected.size, direct: directCount };
}

function nodeHasTest(nodeId, testFileSet) {
  const base = nodeId.replace(/\.[jt]sx?$/, '').split('/').pop();
  for (const tf of testFileSet) {
    if (tf.includes(base)) return true;
  }
  return false;
}

// Risk heuristic — no AI yet, pure structural analysis
function computeRisk(directDeps, blastTotal, churn, hasTests) {
  let score = 0;
  const reasons = [];

  if (directDeps >= 8)      { score += 40; reasons.push(`${directDeps} files import this directly`); }
  else if (directDeps >= 4) { score += 28; reasons.push(`${directDeps} direct importers`); }
  else if (directDeps >= 2) { score += 16; reasons.push(`${directDeps} direct importers`); }
  else if (directDeps === 1){ score += 8;  reasons.push('1 direct importer'); }

  if (blastTotal >= 20)      { score += 30; reasons.push(`${blastTotal} files transitively affected`); }
  else if (blastTotal >= 10) { score += 20; reasons.push(`${blastTotal} files in blast radius`); }
  else if (blastTotal >= 4)  { score += 10; reasons.push(`${blastTotal} files in blast radius`); }

  if (churn >= 10)      { score += 20; reasons.push(`modified ${churn}× (highly volatile)`); }
  else if (churn >= 5)  { score += 12; reasons.push(`modified ${churn}× recently`); }
  else if (churn >= 3)  { score += 6;  reasons.push(`modified ${churn}× recently`); }

  if (!hasTests && (directDeps > 0 || blastTotal > 0)) {
    score += 12;
    reasons.push('no test coverage');
  }

  score = Math.min(score, 100);
  const level = score >= 65 ? 'critical' : score >= 40 ? 'high' : score >= 18 ? 'medium' : 'low';
  return { score, level, reasons };
}

function extractPrNumber(input) {
  const t = input.trim();
  if (/^\d+$/.test(t)) return t;
  const m = t.match(/\/pull\/(\d+)/);
  return m ? m[1] : null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const map = {
    critical: { bg: '#ff445522', color: '#ff4455', border: '#ff445544' },
    high:     { bg: '#f9731622', color: '#f97316', border: '#f9731644' },
    medium:   { bg: '#F59E0B22', color: '#F59E0B', border: '#F59E0B44' },
    low:      { bg: '#4ade8022', color: '#4ade80', border: '#4ade8044' },
  };
  const s = map[level] || map.medium;
  return (
    <span style={{
      fontSize: 9, padding: '2px 7px', borderRadius: 6, fontFamily: 'IBM Plex Mono',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0,
    }}>{level}</span>
  );
}

function StatusBadge({ status }) {
  const colors = { added: '#4ade80', removed: '#ff4455', modified: '#F59E0B', renamed: '#c0c0c0' };
  const c = colors[status] || '#888888';
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 6, fontFamily: 'IBM Plex Mono',
      background: `${c}22`, color: c, border: `1px solid ${c}44`,
      textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0,
    }}>{status}</span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      border: `1px solid ${color}33`, borderRadius: 12,
      padding: '10px 14px', textAlign: 'center', minWidth: 90,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'IBM Plex Mono' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#777777', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// A single clickable file card in the grid
function FileCard({ file, revAdj, churnMap, testFileSet, onClick }) {
  const { nodeId, filename, status, additions, deletions } = file;
  const short = filename.split('/').pop();
  const dir   = filename.includes('/') ? filename.split('/').slice(0, -1).join('/') + '/' : '';
  const blast = getPerFileBlast(nodeId, revAdj);
  const churn = churnMap[nodeId] || 0;
  const hasTests = nodeHasTest(nodeId, testFileSet);
  const risk = computeRisk(blast.direct, blast.total, churn, hasTests);

  const riskColors = {
    critical: '#ff4455',
    high: '#f97316',
    medium: '#F59E0B',
    low: '#4ade80',
  };
  const rc = riskColors[risk.level];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#11111144',
        border: `1px solid ${rc}33`,
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${rc}0f`;
        e.currentTarget.style.borderColor = `${rc}66`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#11111144';
        e.currentTarget.style.borderColor = `${rc}33`;
      }}
    >
      {/* Top row: status + risk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusBadge status={status} />
        <RiskBadge level={risk.level} />
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#555555', fontFamily: 'IBM Plex Mono' }}>
          {risk.score}/100
        </span>
      </div>

      {/* Filename */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, color: '#555555', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>{dir}</div>
        <div style={{ fontSize: 13, color: '#d8d8d8', fontFamily: 'IBM Plex Mono', fontWeight: 700, wordBreak: 'break-all' }}>
          {short}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {additions > 0 && (
          <span style={{ fontSize: 10, color: '#4ade80', fontFamily: 'IBM Plex Mono' }}>+{additions}</span>
        )}
        {deletions > 0 && (
          <span style={{ fontSize: 10, color: '#ff4455', fontFamily: 'IBM Plex Mono' }}>-{deletions}</span>
        )}
        {blast.direct > 0 && (
          <span style={{ fontSize: 10, color: '#f97316', fontFamily: 'IBM Plex Mono' }}>
            {blast.direct} direct dep{blast.direct !== 1 ? 's' : ''}
          </span>
        )}
        {blast.total > 0 && (
          <span style={{ fontSize: 10, color: '#c0c0c0', fontFamily: 'IBM Plex Mono' }}>
            {blast.total} at risk
          </span>
        )}
        {churn > 0 && (
          <span style={{ fontSize: 10, color: '#F59E0B', fontFamily: 'IBM Plex Mono' }}>
            🔥 ×{churn}
          </span>
        )}
      </div>

      {/* Test + "view detail" row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: hasTests ? '#4ade80' : '#ff445577', fontFamily: 'IBM Plex Mono' }}>
          {hasTests ? '✓ tests' : '✗ no tests'}
        </span>
        <span style={{ fontSize: 9, color: rc, fontFamily: 'IBM Plex Mono' }}>
          View relations →
        </span>
      </div>
    </div>
  );
}

// ─── Main list page ─────────────────────────────────────────────────────────────

export default function PRImpactPage() {
  const { graphData, repoUrl } = useOutletContext();
  const navigate = useNavigate();

  const [prInput, setPrInput]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [posting, setPosting]   = useState(false);
  const [prData, setPrData]     = useState(null);
  const [changedNodes, setChangedNodes] = useState([]);
  const [churnMap, setChurnMap] = useState({});
  const [unmappedCount, setUnmappedCount] = useState(0);

  const nodes = graphData?.nodes ?? [];
  const links = graphData?.links ?? graphData?.edges ?? [];

  const revAdj = useMemo(() => buildReverseAdj(links), [links]);

  const testFileSet = useMemo(
    () => new Set(nodes.filter(n => TEST_PATTERN.test(n.id)).map(n => n.id)),
    [nodes]
  );

  // Sort changed nodes by risk (highest first)
  const sortedFiles = useMemo(() => {
    if (!changedNodes.length) return [];
    return [...changedNodes]
      .map(f => {
        const blast = getPerFileBlast(f.nodeId, revAdj);
        const churn = churnMap[f.nodeId] || 0;
        const hasTests = nodeHasTest(f.nodeId, testFileSet);
        const risk = computeRisk(blast.direct, blast.total, churn, hasTests);
        return { ...f, blast, churn, hasTests, risk };
      })
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [changedNodes, revAdj, churnMap, testFileSet]);

  // Summary counts by risk level
  const riskCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of sortedFiles) counts[f.risk.level]++;
    return counts;
  }, [sortedFiles]);

  const totalBlastAcrossAll = useMemo(() => {
    const allAffected = new Set();
    for (const f of changedNodes) {
      const b = getPerFileBlast(f.nodeId, revAdj);
      // We don't have individual sets here easily; use the aggregate blast
    }
    // Compute global blast from all changed nodes
    const changedSet = new Set(changedNodes.map(f => f.nodeId));
    const queue = [...changedSet];
    const visited = new Set(changedSet);
    while (queue.length) {
      const id = queue.shift();
      for (const dep of (revAdj[id] || [])) {
        if (!visited.has(dep)) {
          visited.add(dep);
          if (!changedSet.has(dep)) allAffected.add(dep);
          queue.push(dep);
        }
      }
    }
    return allAffected.size;
  }, [changedNodes, revAdj]);

  const analyze = useCallback(async () => {
    if (!graphData) return toast.error('Analyze a repository first');
    const prNum = extractPrNumber(prInput);
    if (!prNum) return toast.error('Enter a valid PR number or GitHub PR URL');

    setLoading(true);
    setPrData(null);
    setChangedNodes([]);
    setChurnMap({});
    setUnmappedCount(0);

    try {
      const [prRes, churnRes] = await Promise.all([
        fetch(`${BACKEND}/api/github/pr-impact?repoUrl=${encodeURIComponent(repoUrl)}&pr=${prNum}`),
        fetch(`${BACKEND}/api/github/churn?repoUrl=${encodeURIComponent(repoUrl)}`),
      ]);
      const [prJson, churnJson] = await Promise.all([prRes.json(), churnRes.json()]);
      if (!prJson.success) throw new Error(prJson.message || 'Failed to fetch PR');

      const pr = prJson.data;
      setPrData(pr);
      const cm = churnJson.success ? (churnJson.data || {}) : {};
      setChurnMap(cm);

      const nodeIds = new Set(nodes.map(n => n.id));
      const matched = [];
      let unmatched = 0;
      for (const f of pr.changedFiles) {
        if (nodeIds.has(f.filename)) {
          matched.push({ ...f, nodeId: f.filename });
        } else {
          const stripped = f.filename.replace(/^[^/]+\//, '');
          if (nodeIds.has(stripped)) {
            matched.push({ ...f, nodeId: stripped });
          } else {
            unmatched++;
          }
        }
      }
      setChangedNodes(matched);
      setUnmappedCount(unmatched);

      // Persist analysis for detail page navigation
      sessionStorage.setItem('pr-impact-analysis', JSON.stringify({
        prData: pr,
        changedNodes: matched,
        churnMap: cm,
        repoUrl,
      }));
    } catch (err) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [prInput, graphData, repoUrl, nodes]);

  const buildCommentBody = useCallback(() => {
    if (!prData) return '';
    const changedList = changedNodes.map(f =>
      `- \`${f.filename}\` (+${f.additions} -${f.deletions}) \`${f.status}\``
    ).join('\n');
    return `## PR Impact Analysis 🔍

**PR:** [#${prData.prNumber} — ${prData.prTitle}](${prData.prUrl})
**Branch:** \`${prData.headBranch}\` → \`${prData.baseBranch}\`

### Summary
| Changed (in graph) | Global Blast Radius | +Lines | -Lines |
|---|---|---|---|
| ${changedNodes.length} | ${totalBlastAcrossAll} | +${prData.totalAdditions} | -${prData.totalDeletions} |

### Risk Breakdown
| Level | Files |
|---|---|
| 🔴 Critical | ${riskCounts.critical} |
| 🟠 High | ${riskCounts.high} |
| 🟡 Medium | ${riskCounts.medium} |
| 🟢 Low | ${riskCounts.low} |

### Changed Files
${changedList || '_No tracked source files changed_'}

_Generated by [Hoverboard](${window.location.origin}) — Repo Visualizer_`;
  }, [prData, changedNodes, totalBlastAcrossAll, riskCounts]);

  const copyComment = useCallback(() => {
    navigator.clipboard.writeText(buildCommentBody())
      .then(() => toast.success('PR comment copied!'))
      .catch(() => toast.error('Clipboard copy failed'));
  }, [buildCommentBody]);

  const postToGitHub = useCallback(async () => {
    if (!prData) return;
    const prNum = extractPrNumber(prInput);
    setPosting(true);
    try {
      const res = await fetch(`${BACKEND}/api/github/pr-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, pr: prNum, body: buildCommentBody() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to post comment');
      toast.success('Comment posted to GitHub PR!');
      if (json.commentUrl) window.open(json.commentUrl, '_blank');
    } catch (err) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  }, [prData, prInput, repoUrl, buildCommentBody]);

  const handleFileClick = useCallback((file) => {
    navigate(`/analyzer/impact/file/${file.nodeId}`, {
      state: {
        analysisData: {
          prData,
          changedNodes,
          churnMap,
          repoUrl,
        },
      },
    });
  }, [navigate, prData, changedNodes, churnMap, repoUrl]);

  const noGraph = !graphData;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', fontFamily: 'IBM Plex Mono' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, color: '#d8d8d8', margin: '0 0 4px', letterSpacing: 1 }}>
          PR Impact Analysis
        </h2>
        <p style={{ fontSize: 10, color: '#555555', margin: 0 }}>
          Click any changed file to see its dependency relations and risk breakdown
        </p>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="analyzer-input"
          placeholder="PR number or github.com/owner/repo/pull/123"
          value={prInput}
          onChange={e => setPrInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
          disabled={loading || noGraph}
          style={{ flex: 1, maxWidth: 460 }}
        />
        <button className="analyzer-btn" onClick={analyze} disabled={loading || noGraph || !prInput.trim()}>
          {loading ? 'Analyzing···' : 'Analyze PR'}
        </button>
        {prData && (
          <>
            <button className="feat-btn outline" onClick={copyComment}>Copy Comment</button>
            <button
              className="feat-btn outline"
              onClick={postToGitHub}
              disabled={posting}
              style={{ borderColor: '#5affb8', color: '#5affb8' }}
            >
              {posting ? 'Posting···' : 'Post to GitHub'}
            </button>
          </>
        )}
      </div>

      {noGraph && (
        <div style={{
          background: '#11111144', border: '1px dashed #282828', borderRadius: 14,
          padding: '40px 20px', textAlign: 'center', color: '#555555', fontSize: 12,
        }}>
          Analyze a repository first, then come back here to assess PR impact.
        </div>
      )}

      {prData && (
        <>
          {/* PR meta */}
          <div style={{
            background: '#11111144', border: '1px solid #282828', borderRadius: 14,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 8,
                background: prData.prState === 'open' ? '#4ade8022' : '#77777722',
                color: prData.prState === 'open' ? '#4ade80' : '#777777',
                border: `1px solid ${prData.prState === 'open' ? '#4ade8044' : '#77777744'}`,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>{prData.prState}</span>
              <a
                href={prData.prUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: '#d8d8d8', fontWeight: 600, textDecoration: 'none' }}
              >
                #{prData.prNumber} — {prData.prTitle}
              </a>
            </div>
            <div style={{ fontSize: 10, color: '#555555', marginTop: 5 }}>
              by <span style={{ color: '#c0c0c0' }}>{prData.prAuthor}</span>
              {' · '}
              <span style={{ color: '#777777' }}>{prData.headBranch}</span>
              <span style={{ color: '#333333' }}> → </span>
              <span style={{ color: '#777777' }}>{prData.baseBranch}</span>
            </div>
          </div>

          {/* Stat row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="files in graph" value={changedNodes.length} color="#c0c0c0" />
            <StatCard label="global blast radius" value={totalBlastAcrossAll} color="#f97316" />
            <StatCard label="critical" value={riskCounts.critical} color="#ff4455" />
            <StatCard label="high" value={riskCounts.high} color="#f97316" />
            <StatCard label="medium" value={riskCounts.medium} color="#F59E0B" />
            <StatCard label="low" value={riskCounts.low} color="#4ade80" />
            <StatCard label="+lines" value={`+${prData.totalAdditions}`} color="#4ade80" />
            <StatCard label="-lines" value={`-${prData.totalDeletions}`} color="#ff4455" />
            {unmappedCount > 0 && (
              <StatCard label="non-source" value={unmappedCount} color="#555555" />
            )}
          </div>

          {/* File cards grid */}
          {sortedFiles.length === 0 ? (
            <div style={{
              background: '#11111144', border: '1px dashed #282828', borderRadius: 14,
              padding: '40px 20px', textAlign: 'center', color: '#555555', fontSize: 12,
            }}>
              No changed files matched graph nodes. The PR may only touch config or asset files.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: '#555555', marginBottom: 12 }}>
                {sortedFiles.length} changed source file{sortedFiles.length !== 1 ? 's' : ''} — sorted by risk · click to explore relations
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}>
                {sortedFiles.map(file => (
                  <FileCard
                    key={file.nodeId}
                    file={file}
                    revAdj={revAdj}
                    churnMap={churnMap}
                    testFileSet={testFileSet}
                    onClick={() => handleFileClick(file)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
