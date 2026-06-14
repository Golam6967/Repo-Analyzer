import React, { useState, useCallback } from "react";
import { useGraphHighlight } from "../../hooks/useGraphHighlight";

const RISK_META = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Critical" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "High" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Medium" },
  low:      { color: "#facc15", bg: "rgba(250,204,21,0.12)", label: "Low" },
};

function RiskChip({ risk }) {
  const meta = RISK_META[risk] || RISK_META.medium;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
      padding: "2px 7px", borderRadius: 4,
      background: meta.bg, color: meta.color,
      textTransform: "uppercase", flexShrink: 0,
    }}>
      {meta.label}
    </span>
  );
}

function generateMarkdownReport(result, diff) {
  const lines = [
    "# Change Impact Report",
    "",
    "## Summary",
    result.summary,
    "",
    "## Affected Files",
    "",
    "| File | Risk | Propagation Order | Reason |",
    "|------|------|-------------------|--------|",
    ...result.affectedNodes.map((n) =>
      `| \`${n.nodeId}\` | ${n.risk} | ${n.propagationOrder} | ${n.reason} |`
    ),
    "",
  ];

  if (result.testFilesToRun.length > 0) {
    lines.push("## Tests to Run", "");
    result.testFilesToRun.forEach((t) => lines.push(`- \`${t}\``));
    lines.push("");
  }

  lines.push("## Diff Applied", "", "```diff", diff.slice(0, 3000), "```");

  return lines.join("\n");
}

export default function ImpactPanel({ graph, isOpen, onClose }) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { highlightImpact, clearImpact } = useGraphHighlight();

  const handleAnalyze = useCallback(async () => {
    if (!diff.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    clearImpact();

    try {
      const slimGraph = {
        nodes: (graph?.nodes || []).map((n) => ({
          id: n.id,
          layer: n.layer,
          ext: n.ext,
          filePath: n.filePath,
        })),
        edges: (graph?.edges || graph?.links || []).map((l) => ({
          source: typeof l.source === "object" ? l.source.id : l.source,
          target: typeof l.target === "object" ? l.target.id : l.target,
        })),
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff: diff.trim(), graph: slimGraph }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Analysis failed");

      setResult(json.data);
      highlightImpact(json.data.affectedNodes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [diff, graph, highlightImpact, clearImpact]);

  const handleClear = useCallback(() => {
    setDiff("");
    setResult(null);
    setError("");
    clearImpact();
  }, [clearImpact]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const md = generateMarkdownReport(result, diff);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "impact-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [result, diff]);

  if (!isOpen) return null;

  const groupedByRisk = { critical: [], high: [], medium: [], low: [] };
  if (result) {
    result.affectedNodes.forEach((n) => {
      const key = n.risk in groupedByRisk ? n.risk : "medium";
      groupedByRisk[key].push(n);
    });
  }

  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: 360,
      height: "100%",
      background: "rgba(10,15,28,0.97)",
      borderRight: "0.5px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
      zIndex: 30,
      boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 12px",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#f97316", boxShadow: "0 0 8px #f97316",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>
            Change Impact
          </span>
        </div>
        <button
          onClick={() => { handleClear(); onClose(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", fontSize: 16, lineHeight: 1, padding: "2px 4px",
          }}
        >✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Diff input */}
        <div>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>
            Paste your Git diff here
          </label>
          <textarea
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            placeholder={"diff --git a/src/auth.js b/src/auth.js\n--- a/src/auth.js\n+++ b/src/auth.js\n@@..."}
            rows={10}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#c9d1d9",
              fontSize: 11,
              fontFamily: "monospace",
              padding: "10px 12px",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleAnalyze}
            disabled={loading || !diff.trim()}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              border: "none",
              background: loading || !diff.trim()
                ? "rgba(249,115,22,0.3)"
                : "linear-gradient(135deg,#f97316,#ea580c)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading || !diff.trim() ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Analyzing···" : "Analyze Impact"}
          </button>
          {(result || diff) && (
            <button
              onClick={handleClear}
              style={{
                height: 34, padding: "0 14px", borderRadius: 8,
                border: "0.5px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "rgba(255,255,255,0.45)",
                fontSize: 12, cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.3)",
            borderRadius: 8, padding: "10px 12px",
            fontSize: 12, color: "#fca5a5",
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <div style={{
              background: "rgba(249,115,22,0.08)", border: "0.5px solid rgba(249,115,22,0.2)",
              borderRadius: 8, padding: "10px 12px",
            }}>
              <div style={{ fontSize: 10, color: "#f97316", fontWeight: 700, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Summary
              </div>
              <p style={{ fontSize: 12, color: "#c9d1d9", margin: 0, lineHeight: 1.6 }}>
                {result.summary}
              </p>
            </div>

            {/* Affected nodes grouped by risk */}
            {["critical", "high", "medium", "low"].map((risk) => {
              const nodes = groupedByRisk[risk];
              if (nodes.length === 0) return null;
              const meta = RISK_META[risk];
              return (
                <div key={risk}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: meta.color,
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
                  }}>
                    {meta.label} Risk ({nodes.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {nodes.map((n) => (
                      <div key={n.nodeId} style={{
                        background: meta.bg,
                        border: `0.5px solid ${meta.color}40`,
                        borderRadius: 7, padding: "8px 10px",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 11, color: "#e6edf3", fontFamily: "monospace",
                            wordBreak: "break-all", lineHeight: 1.4,
                          }}>
                            {n.nodeId.split("/").pop()}
                          </span>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                            <span style={{
                              fontSize: 9, color: "rgba(255,255,255,0.35)",
                              background: "rgba(255,255,255,0.06)",
                              borderRadius: 3, padding: "1px 5px",
                            }}>
                              hop {n.propagationOrder}
                            </span>
                            <RiskChip risk={n.risk} />
                          </div>
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>
                          {n.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Tests to run */}
            {result.testFilesToRun.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#60a5fa",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
                }}>
                  Tests to Run ({result.testFilesToRun.length})
                </div>
                <div style={{
                  background: "rgba(96,165,250,0.07)",
                  border: "0.5px solid rgba(96,165,250,0.2)",
                  borderRadius: 7, padding: "8px 10px",
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  {result.testFilesToRun.map((t) => (
                    <span key={t} style={{
                      fontSize: 11, color: "#93c5fd", fontFamily: "monospace",
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Export */}
            <button
              onClick={handleExport}
              style={{
                height: 34, borderRadius: 8,
                border: "0.5px solid rgba(96,165,250,0.3)",
                background: "rgba(96,165,250,0.08)",
                color: "#60a5fa", fontSize: 12, cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Export Report (.md)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
