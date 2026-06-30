import React, { useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import '../components/styles/features.css';

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

function buildForwardAdj(links) {
  const fwd = {};
  for (const l of links) {
    const src = l.source?.id ?? l.source;
    const tgt = l.target?.id ?? l.target;
    if (!fwd[src]) fwd[src] = [];
    fwd[src].push(tgt);
  }
  return fwd;
}

// BFS level by level — returns array of levels, each level = [{id, via}]
function getImpactCascade(nodeId, revAdj) {
  const levels = [];
  const visited = new Set([nodeId]);
  let frontier = [{ id: nodeId, via: null }];

  while (true) {
    const nextFrontier = [];
    const levelNodes = [];
    for (const { id } of frontier) {
      for (const dep of (revAdj[id] || [])) {
        if (!visited.has(dep)) {
          visited.add(dep);
          levelNodes.push({ id: dep, via: id });
          nextFrontier.push({ id: dep, via: id });
        }
      }
    }
    if (levelNodes.length === 0) break;
    levels.push(levelNodes);
    frontier = nextFrontier;
  }
  return levels;
}

function nodeHasTest(nodeId, testFileSet) {
  const base = nodeId.replace(/\.[jt]sx?$/, '').split('/').pop();
  for (const tf of testFileSet) {
    if (tf.includes(base)) return true;
  }
  return false;
}

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
    reasons.push('no test coverage — blast radius is unguarded');
  }

  score = Math.min(score, 100);
  const level = score >= 65 ? 'critical' : score >= 40 ? 'high' : score >= 18 ? 'medium' : 'low';
  return { score, level, reasons };
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const map = {
    critical: { bg: '#ff445522', color: '#ff4455', border: '#ff445544' },
    high:     { bg: '#f9731622', color: '#f97316', border: '#f9731644' },
    medium:   { bg: '#F59E0B22', color: '#F59E0B', border: '#F59E0B44' },
    low:      { bg: '#5affb822', color: '#5affb8', border: '#5affb844' },
  };
  const s = map[level] || map.medium;
  return (
    <span style={{
      fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'Space Mono',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: 1,
    }}>{level}</span>
  );
}

function StatusBadge({ status }) {
  const colors = { added: '#5affb8', removed: '#ff4455', modified: '#F59E0B', renamed: '#b47dff' };
  const c = colors[status] || '#8070a0';
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 3, fontFamily: 'Space Mono',
      background: `${c}22`, color: c, border: `1px solid ${c}44`,
      textTransform: 'uppercase', letterSpacing: 1,
    }}>{status}</span>
  );
}

function FileChip({ nodeId, highlight, dimmed, label }) {
  const short = nodeId.split('/').pop();
  const dir   = nodeId.includes('/') ? nodeId.split('/').slice(0, -1).join('/') + '/' : '';
  const color = highlight === 'changed' ? '#5affb8' :
                highlight === 'dep'     ? '#f97316' :
                highlight === 'import'  ? '#b47dff' : '#e8e0f5';
  return (
    <div style={{
      padding: '7px 10px',
      borderBottom: '1px solid #1e1730',
      opacity: dimmed ? 0.45 : 1,
    }}>
      {label && (
        <span style={{ fontSize: 8, color: '#4a3d60', fontFamily: 'Space Mono',
          background: '#2d234022', padding: '1px 4px', borderRadius: 2,
          marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 9, color: '#4a3d60', fontFamily: 'Space Mono' }}>{dir}</span>
      <span style={{ fontSize: 10, color, fontFamily: 'Space Mono', fontWeight: 600 }}>{short}</span>
    </div>
  );
}

function SectionBox({ title, count, color, children, emptyMsg }) {
  return (
    <div style={{
      background: '#13102244',
      border: `1px solid ${color}33`,
      borderRadius: 10,
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${color}22`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: '#e8e0f5', fontFamily: 'Space Mono' }}>{title}</span>
        <span style={{ fontSize: 10, color, fontFamily: 'Space Mono' }}>{count}</span>
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {count === 0 ? (
          <div style={{ padding: '20px 14px', fontSize: 10, color: '#4a3d60', fontFamily: 'Space Mono' }}>
            {emptyMsg}
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Main detail page ──────────────────────────────────────────────────────────

export default function PRImpactFilePage() {
  const { '*': filePath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { graphData } = useOutletContext();

  // Analysis data from navigation state or sessionStorage fallback
  const analysisData = useMemo(() => {
    if (location.state?.analysisData) return location.state.analysisData;
    try { return JSON.parse(sessionStorage.getItem('pr-impact-analysis') || 'null'); } catch { return null; }
  }, [location.state]);

  const prData      = analysisData?.prData ?? null;
  const changedNodes = analysisData?.changedNodes ?? [];
  const churnMap    = analysisData?.churnMap ?? {};

  const nodes = graphData?.nodes ?? [];
  const links = graphData?.links ?? graphData?.edges ?? [];

  const revAdj = useMemo(() => buildReverseAdj(links), [links]);
  const fwdAdj = useMemo(() => buildForwardAdj(links), [links]);

  const testFileSet = useMemo(
    () => new Set(nodes.filter(n => TEST_PATTERN.test(n.id)).map(n => n.id)),
    [nodes]
  );

  // Which changed files are also in this PR (for highlighting in dependency columns)
  const changedSet = useMemo(() => new Set(changedNodes.map(f => f.nodeId)), [changedNodes]);

  // This file's info from the PR
  const fileInfo = changedNodes.find(f => f.nodeId === filePath);

  // Compute relationships
  const imports       = useMemo(() => fwdAdj[filePath] || [], [filePath, fwdAdj]);
  const importers     = useMemo(() => revAdj[filePath] || [], [filePath, revAdj]);
  const cascadeLevels = useMemo(() => getImpactCascade(filePath, revAdj), [filePath, revAdj]);
  const totalAffected = cascadeLevels.reduce((sum, lvl) => sum + lvl.length, 0);

  // Risk
  const hasTests = nodeHasTest(filePath, testFileSet);
  const churn    = churnMap[filePath] || 0;
  const risk     = computeRisk(importers.length, totalAffected, churn, hasTests);

  const riskColor = {
    critical: '#ff4455', high: '#f97316', medium: '#F59E0B', low: '#5affb8',
  }[risk.level];

  const short = filePath.split('/').pop();
  const dir   = filePath.includes('/')
    ? filePath.split('/').slice(0, -1).join('/') + '/'
    : '';

  const noGraph = !graphData;

  if (noGraph) {
    return (
      <div style={{ padding: '24px 28px', fontFamily: 'Space Mono' }}>
        <button
          onClick={() => navigate('/analyzer/impact')}
          style={{ background: 'none', border: 'none', color: '#6b5b8a', cursor: 'pointer', fontSize: 11, padding: 0, marginBottom: 20 }}
        >
          ← Back
        </button>
        <div style={{ color: '#4a3d60', fontSize: 12 }}>
          Analyze a repository first to see file relations.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'Space Mono' }}>

      {/* Back button */}
      <button
        onClick={() => navigate('/analyzer/impact')}
        style={{
          background: 'none', border: 'none', color: '#6b5b8a', cursor: 'pointer',
          fontSize: 11, padding: 0, marginBottom: 20, letterSpacing: 0.5,
        }}
      >
        ← {prData ? `PR #${prData.prNumber} — ${prData.prTitle}` : 'Back to PR Impact'}
      </button>

      {/* File header */}
      <div style={{
        background: `${riskColor}0d`,
        border: `1px solid ${riskColor}44`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          {fileInfo && <StatusBadge status={fileInfo.status} />}
          <RiskBadge level={risk.level} />
        </div>
        <div style={{ fontSize: 9, color: '#4a3d60', marginBottom: 4 }}>{dir}</div>
        <div style={{ fontSize: 18, color: '#e8e0f5', fontWeight: 700, marginBottom: 8 }}>{short}</div>
        {fileInfo && (
          <div style={{ display: 'flex', gap: 16 }}>
            {fileInfo.additions > 0 && (
              <span style={{ fontSize: 11, color: '#5affb8' }}>+{fileInfo.additions} lines added</span>
            )}
            {fileInfo.deletions > 0 && (
              <span style={{ fontSize: 11, color: '#ff4455' }}>-{fileInfo.deletions} lines removed</span>
            )}
          </div>
        )}
        {!fileInfo && (
          <div style={{ fontSize: 10, color: '#4a3d60' }}>
            This file is in the dependency graph but was not directly changed in the PR — viewing its graph position.
          </div>
        )}
      </div>

      {/* Risk breakdown */}
      <div style={{
        background: '#13102244',
        border: `1px solid ${riskColor}44`,
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {/* Score circle */}
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${riskColor}22`, border: `2px solid ${riskColor}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 6px',
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: riskColor }}>{risk.score}</span>
          </div>
          <div style={{ fontSize: 8, color: '#4a3d60', letterSpacing: 1, textTransform: 'uppercase' }}>risk score</div>
        </div>

        {/* Quick stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 24px',
          flex: 1,
          minWidth: 200,
        }}>
          {[
            { label: 'direct importers', value: importers.length, color: '#f97316' },
            { label: 'total blast radius', value: totalAffected, color: '#b47dff' },
            { label: 'churn frequency', value: churn > 0 ? `×${churn}` : 'stable', color: churn >= 5 ? '#F59E0B' : '#5affb8' },
            { label: 'test coverage', value: hasTests ? 'yes' : 'none', color: hasTests ? '#5affb8' : '#ff4455' },
            { label: 'this file imports', value: imports.length, color: '#6b5b8a' },
            { label: 'impact levels', value: cascadeLevels.length, color: '#4a3d60' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 9, color: '#4a3d60', letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Risk reasons */}
        {risk.reasons.length > 0 && (
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 9, color: '#4a3d60', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
              Risk factors
            </div>
            {risk.reasons.map((r, i) => (
              <div key={i} style={{
                fontSize: 10, color: '#e8e0f5', marginBottom: 5,
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <span style={{ color: riskColor, flexShrink: 0 }}>▸</span>
                {r}
              </div>
            ))}
            {risk.reasons.length === 0 && (
              <div style={{ fontSize: 10, color: '#4a3d60' }}>No significant risk factors detected.</div>
            )}
          </div>
        )}
      </div>

      {/* Two-column: imports / imported by */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>

        <SectionBox
          title="This file imports"
          count={imports.length}
          color="#b47dff"
          emptyMsg="This file has no in-repo dependencies tracked in the graph."
        >
          {imports.map(id => (
            <FileChip
              key={id}
              nodeId={id}
              highlight={changedSet.has(id) ? 'changed' : 'import'}
              label={changedSet.has(id) ? 'also changed' : undefined}
            />
          ))}
        </SectionBox>

        <SectionBox
          title="Files that import this"
          count={importers.length}
          color="#f97316"
          emptyMsg="Nothing in the graph imports this file directly."
        >
          {importers.map(id => (
            <FileChip
              key={id}
              nodeId={id}
              highlight={changedSet.has(id) ? 'changed' : 'dep'}
              label={changedSet.has(id) ? 'also changed' : undefined}
            />
          ))}
        </SectionBox>

      </div>

      {/* Impact cascade */}
      {cascadeLevels.length > 0 && (
        <div style={{
          background: '#13102244',
          border: '1px solid #2d2340',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #2d2340',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#e8e0f5' }}>Impact Cascade</span>
            <span style={{ fontSize: 9, color: '#4a3d60' }}>
              {totalAffected} file{totalAffected !== 1 ? 's' : ''} across {cascadeLevels.length} level{cascadeLevels.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ padding: '12px 16px', maxHeight: 460, overflowY: 'auto' }}>
            {/* Root file */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#4a3d60', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Changed file (root)
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#5affb822', border: '1px solid #5affb844',
                borderRadius: 6, padding: '5px 10px',
              }}>
                <span style={{ fontSize: 9, color: '#4a3d60' }}>{dir}</span>
                <span style={{ fontSize: 11, color: '#5affb8', fontWeight: 700 }}>{short}</span>
              </div>
            </div>

            {/* Each cascade level */}
            {cascadeLevels.map((level, li) => {
              const levelColor = li === 0 ? '#f97316' : li === 1 ? '#F59E0B' : '#6b5b8a';
              return (
                <div key={li} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 9, color: levelColor, letterSpacing: 1,
                    textTransform: 'uppercase', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ color: '#2d2340' }}>{'─'.repeat(li + 1)}▶</span>
                    Level {li + 1} — {li === 0 ? 'direct importers' : `${li + 1} hops away`}
                    <span style={{ color: '#2d2340' }}>({level.length} file{level.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: (li + 1) * 14 }}>
                    {level.map(({ id, via }) => {
                      const s = id.split('/').pop();
                      const d = id.includes('/') ? id.split('/').slice(0, -1).join('/') + '/' : '';
                      const viaShort = via?.split('/').pop();
                      const inPR = changedSet.has(id);
                      return (
                        <div
                          key={id}
                          title={`${id}\nvia ${via}`}
                          style={{
                            background: inPR ? '#5affb811' : `${levelColor}11`,
                            border: `1px solid ${inPR ? '#5affb833' : `${levelColor}33`}`,
                            borderRadius: 6, padding: '4px 8px',
                            cursor: 'default',
                          }}
                        >
                          <div style={{ fontSize: 9, color: '#4a3d60' }}>{d}</div>
                          <div style={{ fontSize: 10, color: inPR ? '#5affb8' : levelColor, fontWeight: 600 }}>{s}</div>
                          {via !== filePath && viaShort && (
                            <div style={{ fontSize: 8, color: '#2d2340', marginTop: 1 }}>via {viaShort}</div>
                          )}
                          {inPR && (
                            <div style={{ fontSize: 8, color: '#5affb8', marginTop: 1 }}>● in PR</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cascadeLevels.length === 0 && (
        <div style={{
          background: '#13102244', border: '1px solid #2d2340', borderRadius: 10,
          padding: '24px', textAlign: 'center', color: '#4a3d60', fontSize: 11,
        }}>
          No files depend on <span style={{ color: '#e8e0f5' }}>{short}</span> — changes here are isolated.
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: 16,
        display: 'flex', gap: 16, flexWrap: 'wrap',
        fontSize: 9, color: '#4a3d60', fontFamily: 'Space Mono',
      }}>
        <span><span style={{ color: '#5affb8' }}>■</span> Also changed in this PR</span>
        <span><span style={{ color: '#f97316' }}>■</span> Direct dependent (Level 1)</span>
        <span><span style={{ color: '#F59E0B' }}>■</span> Two hops away (Level 2)</span>
        <span><span style={{ color: '#b47dff' }}>■</span> Imported by this file</span>
      </div>
    </div>
  );
}
