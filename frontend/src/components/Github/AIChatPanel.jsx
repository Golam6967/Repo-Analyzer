import React, { useState, useRef, useCallback, useEffect } from "react";
import { useGraphHighlight } from "../../hooks/useGraphHighlight";

function extractHighlightNodes(text) {
  const match = text.match(/\{\s*"highlightNodes"\s*:\s*\[([\s\S]*?)\]\s*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(`{"highlightNodes":[${match[1]}]}`);
    return Array.isArray(parsed.highlightNodes) ? parsed.highlightNodes : [];
  } catch {
    return [];
  }
}

function stripJsonBlock(text) {
  return text.replace(/\{\s*"highlightNodes"\s*:\s*\[[\s\S]*?\]\s*\}/g, "").trim();
}

export default function AIChatPanel({ graph, repoOwner, repoName, isOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef(null);
  const { highlight, clearHighlight } = useGraphHighlight();

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const question = input.trim();
    setInput("");
    clearHighlight();

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "", nodeIds: [] }]);

    try {
      const slimGraph = {
        nodes: (graph?.nodes || []).map((n) => ({
          id: n.id,
          layer: n.layer,
          ext: n.ext,
        })),
        edges: (graph?.edges || graph?.links || []).map((l) => ({
          source: typeof l.source === "object" ? l.source.id : l.source,
          target: typeof l.target === "object" ? l.target.id : l.target,
        })),
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          graph: slimGraph,
          repoOwner,
          repoName,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const json = JSON.parse(raw);
            if (json.error) throw new Error(json.error);
            if (json.text) {
              fullText += json.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  text: fullText,
                  nodeIds: [],
                };
                return updated;
              });
              scrollToBottom();
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const nodeIds = extractHighlightNodes(fullText);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: fullText,
          nodeIds,
        };
        return updated;
      });
      if (nodeIds.length > 0) highlight(nodeIds);
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: `Error: ${err.message || "Failed to reach AI service."}`,
          nodeIds: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      scrollToBottom();
    }
  }, [input, isStreaming, graph, repoOwner, repoName, highlight, clearHighlight]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.message) setInput(e.detail.message);
    };
    window.addEventListener("ai-prefill", handler);
    return () => window.removeEventListener("ai-prefill", handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
          height: 42,
          padding: "0 18px",
          background: isOpen ? "rgba(55,138,221,0.15)" : "#378ADD",
          color: "#fff",
          border: isOpen ? "0.5px solid rgba(55,138,221,0.5)" : "none",
          borderRadius: 21,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: isOpen ? "none" : "0 4px 18px rgba(55,138,221,0.4)",
          transition: "all 0.2s",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          )}
        </svg>
        {isOpen ? "Close" : "Ask AI"}
      </button>

      {/* Sliding panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: isOpen ? 0 : -400,
          width: 380,
          height: "100vh",
          background: "rgba(10,14,20,0.97)",
          borderLeft: "0.5px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(14px)",
          display: "flex",
          flexDirection: "column",
          zIndex: 90,
          transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: isOpen ? "-12px 0 40px rgba(0,0,0,0.6)" : "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "13px 16px",
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#378ADD",
              boxShadow: "0 0 8px #378ADD",
            }}
          />
          <span
            style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: 0.2 }}
          >
            AI Codebase Assistant
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              background: "rgba(55,138,221,0.12)",
              color: "#378ADD",
              padding: "2px 9px",
              borderRadius: 10,
              border: "0.5px solid rgba(55,138,221,0.3)",
            }}
          >
            Groq Llama 3.3
          </span>
        </div>

        {/* Message list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                color: "rgba(230,237,243,0.3)",
                fontSize: 12,
                textAlign: "center",
                marginTop: 48,
                lineHeight: 2,
              }}
            >
              Ask anything about this codebase.
              <br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                Try: "Where is auth handled?" · "What calls githubService?"
              </span>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "88%",
                  background:
                    msg.role === "user"
                      ? "rgba(55,138,221,0.18)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    msg.role === "user"
                      ? "0.5px solid rgba(55,138,221,0.3)"
                      : "0.5px solid rgba(255,255,255,0.07)",
                  borderRadius:
                    msg.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                  padding: "9px 13px",
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: "#e6edf3",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {stripJsonBlock(msg.text) || (
                  <span style={{ opacity: 0.4, fontStyle: "italic" }}>
                    Thinking…
                  </span>
                )}

                {msg.nodeIds?.length > 0 && (
                  <button
                    onClick={() => highlight(msg.nodeIds)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 9,
                      padding: "4px 11px",
                      fontSize: 11,
                      background: "rgba(55,138,221,0.15)",
                      border: "0.5px solid rgba(55,138,221,0.35)",
                      borderRadius: 8,
                      color: "#378ADD",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(55,138,221,0.28)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "rgba(55,138,221,0.15)")
                    }
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Jump to {msg.nodeIds.length} node
                    {msg.nodeIds.length !== 1 ? "s" : ""} in graph
                  </button>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div style={{ display: "flex", gap: 5, paddingLeft: 6, marginTop: 2 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#378ADD",
                    animation: `ai-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "10px 12px 14px",
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this codebase…"
              disabled={isStreaming}
              rows={1}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "8px 12px",
                color: "#e6edf3",
                fontSize: 12,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.55,
                maxHeight: 100,
                overflowY: "auto",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(55,138,221,0.5)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  isStreaming || !input.trim()
                    ? "rgba(55,138,221,0.15)"
                    : "#378ADD",
                border: "none",
                cursor:
                  isStreaming || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.18)",
              marginTop: 7,
              textAlign: "center",
            }}
          >
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ai-dot-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}
