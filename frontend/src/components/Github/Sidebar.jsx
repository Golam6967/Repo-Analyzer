import React, { useState, useEffect } from "react";
import { EXT_COLORS } from "../utils/constants.js";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const getLanguage = (path) => {
  if (!path) return "text";
  const ext = path.split(".").pop().toLowerCase();
  const map = {
    jsx: "jsx",
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    css: "css",
    html: "html",
    json: "json",
    py: "python",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
  };
  return map[ext] || "text";
};

const actionBtn = {
  fontSize: 10,
  padding: "3px 9px",
  background: "transparent",
  border: "1px solid var(--color-border-primary)",
  borderRadius: 4,
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  fontFamily: "'Space Mono', monospace",
  fontWeight: 600,
  letterSpacing: "0.04em",
  transition: "border-color 0.15s, color 0.15s",
};

export default function Sidebar({ node, graphMap, onClose, fileData, isLoading, repoUrl }) {
  const [activeTab, setActiveTab] = useState("info");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab("info");
  }, [node?.id]);

  useEffect(() => {
    if (fileData?.success) {
      setActiveTab("code");
    }
  }, [fileData]);

  if (!node) return null;

  const imports = graphMap[node.id] || [];
  const importedBy = Object.keys(graphMap).filter((k) => graphMap[k].includes(node.id));
  const ec = EXT_COLORS[node.ext] || { bg: "#1c2128", color: "#7d8590" };
  const isCodeTab = activeTab === "code";
  const lineCount = fileData?.content ? fileData.content.split("\n").length : 0;

  const handleCopy = () => {
    if (fileData?.content) {
      navigator.clipboard.writeText(fileData.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleDownload = () => {
    if (fileData?.content) {
      const blob = new Blob([fileData.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = node.id.split("/").pop();
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenGithub = () => {
    if (repoUrl && node.filePath) {
      const base = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
      window.open(`${base}/blob/main/${node.filePath}`, "_blank");
    }
  };

  return (
    <div
      style={{
        width: isCodeTab ? 520 : 280,
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        borderLeft: "1px solid var(--color-border-primary)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        background: "var(--color-background-primary)",
        fontFamily: "'Space Mono', monospace",
        overflow: "hidden",
      }}
    >
      {/* ── header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--color-border-primary)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flex: 1 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 4,
              fontWeight: 700,
              background: ec.bg,
              color: ec.color,
              flexShrink: 0,
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            .{node.ext}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.id.split("/").pop()}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 18,
            lineHeight: 1,
            padding: "0 2px",
            flexShrink: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "var(--color-text-secondary)")}
          onMouseLeave={(e) => (e.target.style.color = "var(--color-text-muted)")}
        >
          ×
        </button>
      </div>

      {/* ── tabs ── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border-primary)",
          flexShrink: 0,
        }}
      >
        {[
          { id: "info", label: "INFO" },
          { id: "code", label: isLoading && !fileData ? "CODE ···" : "CODE" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "9px 0",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
              color:
                activeTab === tab.id
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)",
              fontSize: 10,
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.1em",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "info" ? (
          /* INFO TAB */
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* path */}
            <div style={sectionLabel}>Path</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
                wordBreak: "break-all",
                lineHeight: 1.7,
                marginBottom: 14,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {node.id}
            </div>

            {/* layer */}
            <div style={sectionLabel}>Layer</div>
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "var(--color-background-secondary)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {node.layer}
              </span>
            </div>

            {/* stat pills */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[
                { n: imports.length, l: "imports" },
                { n: importedBy.length, l: "used by" },
              ].map(({ n, l }) => (
                <div
                  key={l}
                  style={{
                    flex: 1,
                    background: "var(--color-background-secondary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: "var(--color-text-primary)",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {n}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      marginTop: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>

            {imports.length > 0 && (
              <>
                <div style={sectionLabel}>Imports</div>
                {imports.map((i) => (
                  <div key={i} style={listItem}>
                    <span style={{ color: "var(--color-text-muted)", marginRight: 6 }}>↳</span>
                    {i.split("/").pop()}
                  </div>
                ))}
              </>
            )}

            {importedBy.length > 0 && (
              <>
                <div style={{ ...sectionLabel, marginTop: 16 }}>Imported by</div>
                {importedBy.map((i) => (
                  <div key={i} style={listItem}>
                    <span style={{ color: "var(--color-text-muted)", marginRight: 6 }}>↑</span>
                    {i.split("/").pop()}
                  </div>
                ))}
              </>
            )}

            {imports.length === 0 && importedBy.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 8 }}>
                No internal connections.
              </div>
            )}

            {/* view code CTA */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setActiveTab("code")}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  background: "var(--color-background-secondary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: 6,
                  color: isLoading ? "var(--color-text-muted)" : "var(--color-accent)",
                  fontSize: 11,
                  fontFamily: "'Space Mono', monospace",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                {isLoading ? "LOADING···" : "VIEW SOURCE →"}
              </button>
            </div>
          </div>
        ) : (
          /* CODE TAB */
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* action bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderBottom: "1px solid var(--color-border-primary)",
                flexShrink: 0,
                background: "var(--color-background-secondary)",
              }}
            >
              {fileData?.content ? (
                <>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      marginRight: "auto",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {lineCount} lines
                  </span>
                  <button onClick={handleCopy} style={actionBtn}>
                    {copied ? "✓ COPIED" : "COPY"}
                  </button>
                  <button onClick={handleDownload} style={actionBtn}>
                    DOWNLOAD
                  </button>
                  <button onClick={handleOpenGithub} style={actionBtn}>
                    GITHUB ↗
                  </button>
                </>
              ) : isLoading ? (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "'Space Mono', monospace" }}>
                  fetching···
                </span>
              ) : null}
            </div>

            {/* code body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "#0d1117",
              }}
            >
              {isLoading && !fileData ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    fontSize: 12,
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  fetching source···
                </div>
              ) : fileData?.success ? (
                <SyntaxHighlighter
                  language={getLanguage(fileData.path)}
                  style={vscDarkPlus}
                  showLineNumbers={true}
                  customStyle={{
                    margin: 0,
                    padding: "16px 12px",
                    fontSize: "12px",
                    lineHeight: "1.65",
                    background: "transparent",
                  }}
                  lineNumberStyle={{
                    color: "#30363d",
                    minWidth: "2.8em",
                    paddingRight: "1em",
                    userSelect: "none",
                  }}
                >
                  {fileData.content}
                </SyntaxHighlighter>
              ) : fileData && !fileData.success ? (
                <div
                  style={{
                    padding: 24,
                    color: "var(--color-text-danger)",
                    fontSize: 12,
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  failed to load source.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sectionLabel = {
  fontSize: 10,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
  marginTop: 4,
  fontFamily: "'Space Mono', monospace",
};

const listItem = {
  fontSize: 11,
  color: "var(--color-text-secondary)",
  padding: "4px 0",
  borderBottom: "1px solid var(--color-border-secondary)",
  wordBreak: "break-all",
  fontFamily: "'Space Mono', monospace",
};
