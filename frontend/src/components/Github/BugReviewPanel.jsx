import React, { useState, useEffect, useCallback } from "react";

const SEVERITY_COLORS = {
  critical: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#ef4444" },
  high:     { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)", text: "#f87171" },
  medium:   { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  low:      { bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.3)", text: "#818cf8" },
};

function SeverityChip({ severity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low;
  return (
    <span style={{
      fontSize: 9, padding: "2px 7px", borderRadius: 10, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, border: `0.5px solid ${c.border}`, color: c.text,
      flexShrink: 0,
    }}>
      {severity}
    </span>
  );
}

function Section({ title, count, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e6edf3", flex: 1 }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center",
          padding: "1px 6px", borderRadius: 9,
          background: count > 0 ? color + "22" : "rgba(255,255,255,0.06)",
          color: count > 0 ? color : "rgba(255,255,255,0.3)",
          border: `0.5px solid ${count > 0 ? color + "55" : "rgba(255,255,255,0.08)"}`,
        }}>
          {count}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: "0 14px 10px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ScoreDial({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "18px 0 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        width: 70, height: 70, borderRadius: "50%",
        border: `4px solid ${color}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", background: color + "11",
        boxShadow: `0 0 18px ${color}44`,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: color + "bb", fontWeight: 600, letterSpacing: "0.06em", marginTop: 1 }}>{label}</span>
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>Code Quality Score</span>
    </div>
  );
}

export default function BugReviewPanel({ node, repoOwner, repoName, isOpen, onClose, onFixWithAI, onReviewComplete }) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  const fetchReview = useCallback(async () => {
    if (!node || !repoOwner || !repoName) return;
    setLoading(true);
    setReview(null);
    setError(null);

    try {
      const ext = node.ext || "";
      const langMap = {
        js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
        py: "python", go: "go", java: "java", rs: "rust", rb: "ruby",
        php: "php", cs: "csharp", cpp: "cpp", c: "c",
      };
      const language = langMap[ext] || ext || "text";

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          filePath: node.filePath || node.id,
          repoOwner,
          repoName,
          language,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Review failed");
      setReview(data.review);
      const hasCrit = data.review.security?.some((s) => s.severity === "critical");
      onReviewComplete?.(node.id, { score: data.review.score, hasCritical: hasCrit });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [node, repoOwner, repoName]);

  // Reset review when a different node is selected
  useEffect(() => {
    setReview(null);
    setError(null);
  }, [node?.id]);

  const hasCritical = review?.security?.some((s) => s.severity === "critical");

  return (
    <>
      {/* Sliding panel */}
      <div style={{
        position: "fixed", top: 0, left: isOpen ? 0 : -420,
        width: 400, height: "100vh",
        background: "rgba(10,14,20,0.97)",
        borderRight: "0.5px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(14px)",
        display: "flex", flexDirection: "column",
        zIndex: 90,
        transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: isOpen ? "12px 0 40px rgba(0,0,0,0.6)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "13px 16px", flexShrink: 0,
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: hasCritical ? "#ef4444" : "#a78bfa",
            boxShadow: `0 0 8px ${hasCritical ? "#ef4444" : "#a78bfa"}`,
          }} />
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: 0.2 }}>
              AI Code Review
            </div>
            {node && (
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.35)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1,
              }}>
                {node.id.split("/").pop()}
              </div>
            )}
          </div>
          <span style={{
            fontSize: 10,
            background: "rgba(167,139,250,0.12)", color: "#a78bfa",
            padding: "2px 9px", borderRadius: 10,
            border: "0.5px solid rgba(167,139,250,0.3)",
          }}>
            Groq Llama 3.3
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", fontSize: 18, lineHeight: 1, padding: "0 2px",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "60px 20px", gap: 16,
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#a78bfa",
                    animation: `bug-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                Analysing with AI…
              </span>
            </div>
          )}

          {error && !loading && (
            <div style={{
              margin: 16, padding: "12px 14px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.3)",
              fontSize: 12, color: "#f87171", lineHeight: 1.6,
            }}>
              {error}
            </div>
          )}

          {review && !loading && (
            <>
              <ScoreDial score={review.score} />

              {hasCritical && (
                <div style={{
                  margin: "10px 14px 0",
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.1)",
                  border: "0.5px solid rgba(239,68,68,0.4)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#f87171",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  Critical security issue detected
                </div>
              )}

              {/* Bugs */}
              <Section title="Bugs" count={review.bugs.length} color="#f87171" defaultOpen={review.bugs.length > 0}>
                {review.bugs.length === 0
                  ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No bugs found.</p>
                  : review.bugs.map((b, i) => (
                    <div key={i} style={{
                      padding: "8px 0",
                      borderBottom: i < review.bugs.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                        <SeverityChip severity={b.severity} />
                        {b.line && (
                          <span style={{
                            fontSize: 9, padding: "2px 6px", borderRadius: 4,
                            background: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.4)", fontFamily: "monospace",
                          }}>
                            L{b.line}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#c9d1d9", lineHeight: 1.55 }}>
                        {b.description}
                      </p>
                      <FixButton description={b.description} onFixWithAI={onFixWithAI} />
                    </div>
                  ))
                }
              </Section>

              {/* Security */}
              <Section title="Security" count={review.security.length} color="#ef4444" defaultOpen={review.security.length > 0}>
                {review.security.length === 0
                  ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No security issues found.</p>
                  : review.security.map((s, i) => (
                    <div key={i} style={{
                      padding: "8px 0",
                      borderBottom: i < review.security.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none",
                    }}>
                      <div style={{ marginBottom: 4 }}>
                        <SeverityChip severity={s.severity} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#c9d1d9", lineHeight: 1.55 }}>
                        {s.description}
                      </p>
                      <FixButton description={s.description} onFixWithAI={onFixWithAI} />
                    </div>
                  ))
                }
              </Section>

              {/* Code Smells */}
              <Section title="Code Smells" count={review.smells.length} color="#f59e0b">
                {review.smells.length === 0
                  ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No code smells found.</p>
                  : review.smells.map((s, i) => (
                    <div key={i} style={{
                      padding: "8px 0",
                      borderBottom: i < review.smells.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none",
                    }}>
                      <p style={{ margin: 0, fontSize: 11, color: "#c9d1d9", lineHeight: 1.55 }}>
                        {s.description}
                      </p>
                      <FixButton description={s.description} onFixWithAI={onFixWithAI} />
                    </div>
                  ))
                }
              </Section>

              {/* Quick Wins */}
              <Section title="Quick Wins" count={review.quickWins.length} color="#22c55e">
                {review.quickWins.length === 0
                  ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No quick wins found.</p>
                  : review.quickWins.map((q, i) => (
                    <div key={i} style={{
                      padding: "8px 0",
                      borderBottom: i < review.quickWins.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none",
                    }}>
                      <p style={{ margin: 0, fontSize: 11, color: "#c9d1d9", lineHeight: 1.55 }}>
                        {q.description}
                      </p>
                      <FixButton description={q.description} onFixWithAI={onFixWithAI} />
                    </div>
                  ))
                }
              </Section>
            </>
          )}

          {!loading && !review && !error && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "48px 20px", gap: 16, textAlign: "center",
            }}>
              {node ? (
                <>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
                    Ready to analyse<br />
                    <span style={{ color: "#a78bfa", fontWeight: 500 }}>
                      {node.id.split("/").pop()}
                    </span>
                  </div>
                  <button
                    onClick={fetchReview}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "9px 22px",
                      borderRadius: 8, cursor: "pointer",
                      background: "rgba(167,139,250,0.15)",
                      border: "0.5px solid rgba(167,139,250,0.5)",
                      color: "#a78bfa",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.28)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.15)")}
                  >
                    Detect Bugs
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 2 }}>
                  Click a node in the graph to select a file.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bug-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.2);  }
        }
      `}</style>
    </>
  );
}

function FixButton({ description, onFixWithAI }) {
  if (!onFixWithAI) return null;
  return (
    <button
      onClick={() => onFixWithAI(`How do I fix this issue: "${description}"?`)}
      style={{
        marginTop: 6, fontSize: 10, padding: "3px 10px",
        background: "rgba(167,139,250,0.1)",
        border: "0.5px solid rgba(167,139,250,0.3)",
        borderRadius: 6, color: "#a78bfa", cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
    >
      Fix with AI →
    </button>
  );
}
