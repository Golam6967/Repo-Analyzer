import React, { useState, useRef, useEffect, useCallback } from "react";

function MarkdownRenderer({ content }) {
  const lines = content.split("\n");
  const elements = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={keyCounter++} style={{
          background: "rgba(0,0,0,0.4)", border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "10px 14px", margin: "8px 0",
          fontSize: 11, fontFamily: "monospace", color: "#e2e8f0",
          overflowX: "auto", whiteSpace: "pre",
        }}>
          {lang && <span style={{ display: "block", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lang}</span>}
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={keyCounter++} style={{ fontSize: 17, fontWeight: 700, color: "#e6edf3", margin: "16px 0 6px", lineHeight: 1.3 }}>
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={keyCounter++} style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", margin: "14px 0 5px", lineHeight: 1.3, borderBottom: "0.5px solid rgba(167,139,250,0.2)", paddingBottom: 4 }}>
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={keyCounter++} style={{ fontSize: 12, fontWeight: 600, color: "#93c5fd", margin: "10px 0 4px", lineHeight: 1.3 }}>
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // H4
    if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={keyCounter++} style={{ fontSize: 11, fontWeight: 600, color: "#c9d1d9", margin: "8px 0 3px" }}>
          {renderInline(line.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={keyCounter++} style={{ border: "none", borderTop: "0.5px solid rgba(255,255,255,0.1)", margin: "10px 0" }} />);
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1]?.includes("|---")) {
      const headers = line.split("|").filter(Boolean).map(h => h.trim());
      i += 2; // skip header and separator
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").filter(Boolean).map(c => c.trim()));
        i++;
      }
      elements.push(
        <table key={keyCounter++} style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, margin: "8px 0" }}>
          <thead>
            <tr>
              {headers.map((h, hi) => (
                <th key={hi} style={{ padding: "5px 8px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: 600, textAlign: "left", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "5px 8px", color: "#c9d1d9", border: "0.5px solid rgba(255,255,255,0.06)", verticalAlign: "top" }}>
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // Unordered list item
    if (line.match(/^[\s]*[-*+] /)) {
      const indent = line.match(/^(\s*)/)[1].length;
      elements.push(
        <div key={keyCounter++} style={{ display: "flex", gap: 6, margin: "2px 0", paddingLeft: indent * 8 }}>
          <span style={{ color: "#a78bfa", fontSize: 10, flexShrink: 0, marginTop: 3 }}>◆</span>
          <span style={{ fontSize: 11, color: "#c9d1d9", lineHeight: 1.6 }}>{renderInline(line.replace(/^[\s]*[-*+] /, ""))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Ordered list item
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)[1];
      elements.push(
        <div key={keyCounter++} style={{ display: "flex", gap: 8, margin: "2px 0" }}>
          <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 600, flexShrink: 0, minWidth: 16 }}>{num}.</span>
          <span style={{ fontSize: 11, color: "#c9d1d9", lineHeight: 1.6 }}>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      elements.push(<div key={keyCounter++} style={{ height: 4 }} />);
      i++;
      continue;
    }

    // Plain paragraph
    elements.push(
      <p key={keyCounter++} style={{ fontSize: 11, color: "#c9d1d9", lineHeight: 1.7, margin: "3px 0" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let key = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    if (match[2]) {
      parts.push(<strong key={key++} style={{ color: "#e6edf3", fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++} style={{ color: "#e6edf3", fontStyle: "italic" }}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={key++} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", color: "#93c5fd" }}>
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      parts.push(<span key={key++} style={{ color: "#a78bfa", textDecoration: "underline" }}>{match[5]}</span>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

export default function DocsPanel({ selectedNodes, repoOwner, repoName, isOpen, onClose }) {
  const [streaming, setStreaming] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const abortRef = useRef(null);
  const bodyRef = useRef(null);

  const generateDocs = useCallback(async () => {
    if (!selectedNodes || selectedNodes.length === 0) return;

    setStreaming(true);
    setMarkdown("");
    setError(null);
    setDone(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: selectedNodes.map((n) => ({ nodeId: n.id, filePath: n.filePath || n.id })),
          repoOwner,
          repoName,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            setDone(true);
            continue;
          }
          try {
            const { text, error: err } = JSON.parse(payload);
            if (err) { setError(err); break; }
            if (text) setMarkdown((prev) => prev + text);
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setStreaming(false);
    }
  }, [selectedNodes, repoOwner, repoName]);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (streaming && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [markdown, streaming]);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).catch(() => {});
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `docs-${repoName || "module"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  if (!isOpen) return null;

  const fileNames = selectedNodes?.map((n) => (n.filePath || n.id).split("/").pop()).join(", ");

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: "60vh",
      background: "rgba(10,14,20,0.98)",
      borderTop: "0.5px solid rgba(167,139,250,0.3)",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
      zIndex: 95,
      boxShadow: "0 -12px 48px rgba(0,0,0,0.7)",
      animation: "docsSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", flexShrink: 0,
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 8px #a78bfa",
        }} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: 0.2 }}>
            Documentation Generator
          </div>
          {selectedNodes?.length > 0 && (
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.35)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1,
            }}>
              {selectedNodes.length} file{selectedNodes.length !== 1 ? "s" : ""} — {fileNames}
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

        {/* Toolbar buttons */}
        {markdown && (
          <>
            <button
              onClick={handleCopy}
              title="Copy Markdown"
              style={{
                fontSize: 10, padding: "4px 10px", borderRadius: 6,
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                color: "#c9d1d9", cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              Copy MD
            </button>
            <button
              onClick={handleDownload}
              title="Download .md"
              style={{
                fontSize: 10, padding: "4px 10px", borderRadius: 6,
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                color: "#c9d1d9", cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              Download .md
            </button>
          </>
        )}

        {!streaming && selectedNodes?.length > 0 && (
          <button
            onClick={generateDocs}
            style={{
              fontSize: 11, padding: "5px 14px", borderRadius: 6,
              background: streaming ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.2)",
              border: "0.5px solid rgba(167,139,250,0.5)",
              color: "#a78bfa", cursor: "pointer", fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.2)")}
          >
            {markdown ? "Regenerate" : "Generate Docs"}
          </button>
        )}

        <button
          onClick={handleClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", fontSize: 18, lineHeight: 1, padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
        {!markdown && !streaming && !error && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 12,
            color: "rgba(255,255,255,0.25)", textAlign: "center",
          }}>
            <span style={{ fontSize: 28 }}>📄</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {selectedNodes?.length > 0
                ? `Ready to document ${selectedNodes.length} file${selectedNodes.length !== 1 ? "s" : ""}`
                : "No files selected"}
            </span>
            <span style={{ fontSize: 11, lineHeight: 1.6 }}>
              {selectedNodes?.length > 0
                ? "Click Generate Docs to create comprehensive documentation"
                : "Shift+click nodes in the graph to select files, then click Generate Docs"}
            </span>
          </div>
        )}

        {streaming && !markdown && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 16,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#a78bfa",
                  animation: `docs-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              Fetching files and generating docs…
            </span>
          </div>
        )}

        {error && (
          <div style={{
            padding: "12px 14px", borderRadius: 8, marginBottom: 12,
            background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.3)",
            fontSize: 12, color: "#f87171", lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        {markdown && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <MarkdownRenderer content={markdown} />
            {streaming && (
              <span style={{
                display: "inline-block", width: 8, height: 14, background: "#a78bfa",
                marginLeft: 2, verticalAlign: "middle",
                animation: "docs-blink 0.8s step-end infinite",
              }} />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes docsSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes docs-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1.2);  }
        }
        @keyframes docs-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
