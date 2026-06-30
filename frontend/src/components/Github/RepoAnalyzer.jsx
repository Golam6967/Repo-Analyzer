import React, { useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import ErrorModal from "../ErrorModal";
import AIChatPanel from "./AIChatPanel";
import BugReviewPanel from "./BugReviewPanel";
import DocsPanel from "./DocsPanel";
import { GraphHighlightProvider } from "../../hooks/useGraphHighlight";
import "../styles/RepoAnalyzer.css";
import "../styles/features.css";

function parseRepoFromUrl(url) {
  const clean = url
    .replace(/^(https?:\/\/github\.com\/|git@github\.com:)/, "")
    .replace(/\.git$/, "");
  const parts = clean.split("/");
  return { repoOwner: parts[0] || "", repoName: parts[1] || "" };
}

const TABS = [
  { to: "/analyzer",         label: "Graph",     end: true },
  { to: "/analyzer/visual",  label: "Visual"              },
  { to: "/analyzer/metrics", label: "Metrics"             },
  { to: "/analyzer/tools",   label: "Tools"               },
  { to: "/analyzer/impact",  label: "PR Impact"           },
];

const TAB_ICONS = {
  "Graph":     "◈",
  "Visual":    "◉",
  "Metrics":   "▦",
  "Tools":     "⌥",
  "PR Impact": "⊛",
};

const RepoAnalyzer = () => {
  const [repoUrl, setRepoUrl] = useState("");
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNode, setReviewNode] = useState(null);
  const [nodeReviews, setNodeReviews] = useState({});
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsSelectedNodes, setDocsSelectedNodes] = useState([]);
  const [impactOpen, setImpactOpen] = useState(false);
  const navigate = useNavigate();

  const handleNodeSelect = useCallback((node) => {
    setReviewNode(node);
    setReviewOpen(true);
    setChatOpen(false);
  }, []);

  const handleReviewComplete = useCallback((nodeId, data) => {
    setNodeReviews((prev) => ({ ...prev, [nodeId]: data }));
  }, []);

  const handleMultiSelectChange = useCallback((nodes) => {
    setDocsSelectedNodes(nodes);
    if (nodes.length > 0) {
      setDocsOpen(true);
      setReviewOpen(false);
      setChatOpen(false);
    }
  }, []);

  const handleFixWithAI = useCallback((message) => {
    setReviewOpen(false);
    setChatOpen(true);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("ai-prefill", { detail: { message } }));
    }, 350);
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setErrorOpen(false);
    setGraphData(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/github/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const result = await response.json();
      if (result.success) {
        setGraphData(result.data);
        navigate("/analyzer", { replace: true });
      } else {
        setErrorOpen(true);
      }
    } catch {
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading && repoUrl.trim()) handleAnalyze();
  };

  const { repoOwner, repoName } = parseRepoFromUrl(repoUrl);

  const outletContext = {
    graphData, repoUrl, loading,
    impactOpen, setImpactOpen,
    onNodeSelect: handleNodeSelect,
    nodeReviews,
    onMultiSelectChange: handleMultiSelectChange,
  };

  return (
    <GraphHighlightProvider>
      <div className="analyzer-fullscreen">
        {/* ── Top toolbar ── */}
        <div className="analyzer-toolbar">
          <span className="analyzer-toolbar-brand">
            <span className="brand-dot" />
            HOVERBOARD
          </span>

          <div className="analyzer-input-group">
            <input
              type="text"
              className="analyzer-input"
              placeholder="github.com/owner/repo  or  owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="analyzer-btn"
              onClick={handleAnalyze}
              disabled={loading || !repoUrl.trim()}
            >
              {loading ? "Scanning···" : "Analyze"}
            </button>
          </div>

          {graphData && (
            <span className="analyzer-file-count">
              {graphData.nodes?.length ?? 0} files
            </span>
          )}
        </div>

        <ErrorModal
          open={errorOpen}
          onClose={() => setErrorOpen(false)}
          onRetry={() => { setErrorOpen(false); handleAnalyze(); }}
        />

        {/* ── Tab bar — only shown after a repo is analyzed ── */}
        {graphData && (
          <div className="analyzer-tab-bar">
            <div className="analyzer-tab-bar-links">
              {TABS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `analyzer-nav-tab${isActive ? " active" : ""}`}
                >
                  <span className="tab-icon">{TAB_ICONS[label]}</span>
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Impact toggle — only visible on Graph tab */}
            <NavLink to="/analyzer" end style={{ textDecoration: "none" }}>
              {({ isActive }) =>
                isActive ? (
                  <button
                    className="tab-action-btn"
                    onClick={(e) => { e.preventDefault(); setImpactOpen((o) => !o); setReviewOpen(false); setChatOpen(false); setDocsOpen(false); }}
                    style={impactOpen ? { color: "#f97316", borderColor: "rgba(249,115,22,0.4)", background: "rgba(249,115,22,0.08)" } : {}}
                  >
                    {impactOpen ? "✕ Close Impact" : "⊙ Impact"}
                  </button>
                ) : null
              }
            </NavLink>
          </div>
        )}

        {/* ── Page content via Outlet ── */}
        <Outlet context={outletContext} />

        {/* ── Floating panels (Graph tab only) ── */}
        {graphData && (
          <>
            <AIChatPanel
              graph={{ nodes: graphData.nodes, edges: graphData.links || graphData.edges || [] }}
              repoOwner={repoOwner}
              repoName={repoName}
              isOpen={chatOpen}
              onToggle={() => { setChatOpen((o) => !o); setReviewOpen(false); }}
            />
            <BugReviewPanel
              node={reviewNode}
              repoOwner={repoOwner}
              repoName={repoName}
              isOpen={reviewOpen}
              onClose={() => setReviewOpen(false)}
              onReviewComplete={handleReviewComplete}
              onFixWithAI={handleFixWithAI}
            />
            <DocsPanel
              selectedNodes={docsSelectedNodes}
              repoOwner={repoOwner}
              repoName={repoName}
              isOpen={docsOpen}
              onClose={() => setDocsOpen(false)}
            />
          </>
        )}
      </div>
    </GraphHighlightProvider>
  );
};

export default RepoAnalyzer;
