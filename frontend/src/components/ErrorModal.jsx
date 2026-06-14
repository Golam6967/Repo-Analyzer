import React, { useEffect } from "react";

export default function ErrorModal({ open, onRetry, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#08050f",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: "36px 40px",
          width: 340,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          animation: "errPop 0.18s ease",
        }}
      >
        {/* icon */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(248,81,73,0.12)",
          border: "1px solid rgba(248,81,73,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#ff4455" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: "1.4rem", fontWeight: 700,
          color: "#e8e0f5", margin: "0 0 8px",
          letterSpacing: "0.05em",
        }}>
          Something went wrong
        </h2>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11, color: "rgba(255,255,255,0.35)",
          margin: "0 0 28px", lineHeight: 1.6,
        }}>
          An unexpected error occurred.<br />Please try again.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 38, borderRadius: 8, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "rgba(255,255,255,0.45)",
              fontFamily: "'Space Mono', monospace", fontSize: 11,
            }}
          >
            Dismiss
          </button>
          <button
            onClick={onRetry}
            style={{
              flex: 1, height: 38, borderRadius: 8, cursor: "pointer",
              border: "none",
              background: "linear-gradient(135deg, #5b21b6, #8b4de0)",
              color: "#e8e0f5",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 14, fontWeight: 700, letterSpacing: "0.08em",
              boxShadow: "0 0 16px rgba(139,77,224,0.45)",
            }}
          >
            Try Again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes errPop {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  );
}
