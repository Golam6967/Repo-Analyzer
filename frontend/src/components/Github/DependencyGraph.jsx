import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { LAYER_COLORS, LAYER_DIM } from "../utils/constants.js";
import { getLayer, nodeRadius } from "../utils/layerUtils.js";
import { normaliseData } from "../utils/dataUtils.js";
import Sidebar from "./Sidebar.jsx";
import { useGraphHighlight } from "../../hooks/useGraphHighlight.jsx";

export default function DependencyGraph({ data, repoUrl, onNodeSelect, nodeReviews = {}, onMultiSelectChange }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const zoomRef = useRef(null);
  const simNodesRef = useRef([]);
  const nodeSelRef = useRef(null);
  const inDegreeRef = useRef({});
  const nodeReviewsRef = useRef({});
  const onNodeSelectRef = useRef(onNodeSelect);
  const onMultiSelectChangeRef = useRef(onMultiSelectChange);
  const multiSelectedNodesRef = useRef([]);

  const { highlightedNodeIds, impactNodes } = useGraphHighlight();
  const impactTimersRef = useRef([]);

  const [selectedNode, setSelectedNode] = useState(null);
  const [multiSelectedNodes, setMultiSelectedNodes] = useState([]);
  const [fileData, setFileData] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [search, setSearch] = useState("");
  const [extFilter, setExtFilter] = useState("");
  const [layerFilter, setLayerFilter] = useState("");
  const [stats, setStats] = useState({ files: 0, links: 0, layers: 0 });
  const [focusQuery, setFocusQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const {
    nodes: allNodes,
    links: allLinks,
    inDegree: allInDegree,
    graphMap,
  } = React.useMemo(() => normaliseData(data), [data]);

  // Keep mutable refs in sync so D3 handlers always see latest values
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);
  useEffect(() => { onMultiSelectChangeRef.current = onMultiSelectChange; }, [onMultiSelectChange]);
  useEffect(() => {
    nodeReviewsRef.current = nodeReviews;
    applyBadges();
  }, [nodeReviews]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyBadges() {
    if (!nodeSelRef.current) return;
    nodeSelRef.current.each(function(d) {
      const r = nodeReviewsRef.current[d.id];
      if (!r) return;
      const color = r.score >= 80 ? "#22c55e" : r.score >= 50 ? "#f59e0b" : "#ef4444";
      d3.select(this).attr("stroke", color).attr("stroke-width", 2.5);
    });
  }

  const allExts = [...new Set(allNodes.map((n) => n.ext))].sort();
  const allLayers = [...new Set(allNodes.map((n) => n.layer))].sort();

  // ── filter ──
  const getFiltered = useCallback(() => {
    const q = search.toLowerCase();
    const filteredNodes = allNodes.filter((n) => {
      if (extFilter && n.ext !== extFilter) return false;
      if (layerFilter && n.layer !== layerFilter) return false;
      if (q && !n.id.toLowerCase().includes(q)) return false;
      return true;
    });
    const filteredIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = allLinks.filter((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return filteredIds.has(s) && filteredIds.has(t);
    });
    return { filteredNodes, filteredLinks };
  }, [search, extFilter, layerFilter, allNodes, allLinks]);

  const focusResults = React.useMemo(() => {
    const q = focusQuery.trim().toLowerCase();
    if (!q) return [];
    return allNodes
      .filter((n) => n.id.toLowerCase().includes(q))
      .slice(0, 12);
  }, [focusQuery, allNodes]);

  const focusNode = useCallback((nodeId) => {
    setFocusedId(nodeId);
    setDropdownOpen(false);
    setFocusQuery(nodeId.split("/").pop());

    // Zoom to node using its last known simulation position
    const node = simNodesRef.current.find((n) => n.id === nodeId);
    if (node && zoomRef.current && svgRef.current && wrapRef.current) {
      const W = wrapRef.current.clientWidth;
      const H = wrapRef.current.clientHeight;
      const scale = 2.8;
      d3.select(svgRef.current)
        .transition()
        .duration(700)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(W / 2 - node.x * scale, H / 2 - node.y * scale)
            .scale(scale),
        );
    }

    // Highlight the focused node; dim everything else
    if (nodeSelRef.current) {
      nodeSelRef.current
        .attr("stroke", (d) => (d.id === nodeId ? "#fff" : "var(--color-background-primary)"))
        .attr("stroke-width", (d) => (d.id === nodeId ? 3 : 1.5))
        .attr("opacity", (d) => (d.id === nodeId ? 1 : 0.25));
    }
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedId(null);
    setFocusQuery("");
    if (nodeSelRef.current) {
      nodeSelRef.current
        .attr("stroke", "var(--color-background-primary)")
        .attr("stroke-width", 1.5)
        .attr("opacity", 1);
    }
  }, []);

  async function fetchSingleFile(node) {
    setFileLoading(true);
    setFileData(null);
    try {
      const params = new URLSearchParams({
        repoUrl: repoUrl,
        filePath: node.filePath,
      });
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/github/file?${params.toString()}`,
      );
      const result = await response.json();
      setFileData(result);
    } catch (error) {
      console.error("Failed to fetch the file:", error);
      setFileData({ success: false });
    } finally {
      setFileLoading(false);
    }
  }

  // ── render ──
  const render = useCallback(
    ({ filteredNodes, filteredLinks }) => {
      const svgEl = svgRef.current;
      if (!svgEl) return;

      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      const W = wrapRef.current?.clientWidth || 680;
      const H = wrapRef.current?.clientHeight || 480;

      // Recalculate in-degree for this filtered subset
      const inDegree = {};
      filteredNodes.forEach((n) => (inDegree[n.id] = 0));
      filteredLinks.forEach((l) => {
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (inDegree[t] !== undefined) inDegree[t]++;
      });

      inDegreeRef.current = inDegree;

      setStats({
        files: filteredNodes.length,
        links: filteredLinks.length,
        layers: new Set(filteredNodes.map((n) => n.layer)).size,
      });

      // Zoom
      const zoom = d3
        .zoom()
        .scaleExtent([0.05, 6])
        .on("zoom", (e) => gMain.attr("transform", e.transform));
      zoomRef.current = zoom;
      svg.call(zoom);

      const gMain = svg.append("g");

      // Clone — D3 mutates
      const simNodes = filteredNodes.map((d) => ({ ...d }));
      const simLinks = filteredLinks.map((d) => ({
        source: typeof d.source === "object" ? d.source.id : d.source,
        target: typeof d.target === "object" ? d.target.id : d.target,
      }));

      if (simRef.current) simRef.current.stop();

      const chargeStr =
        simNodes.length > 150 ? -80 : simNodes.length > 60 ? -150 : -230;

      const sim = d3
        .forceSimulation(simNodes)
        .force(
          "link",
          d3
            .forceLink(simLinks)
            .id((d) => d.id)
            .distance(70)
            .strength(0.5),
        )
        .force("charge", d3.forceManyBody().strength(chargeStr))
        .force("center", d3.forceCenter(W / 2, H / 2))
        .force(
          "collision",
          d3.forceCollide().radius((d) => nodeRadius(d, inDegree) + 3),
        )
        .alphaDecay(0.025);
      simRef.current = sim;

      // Arrowhead marker
      svg
        .append("defs")
        .append("marker")
        .attr("id", "dep-arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 20)
        .attr("refY", 5)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M2 1L8 5L2 9")
        .attr("fill", "none")
        .attr("stroke", "#b4b2a9")
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round");

      // Links
      const linkSel = gMain
        .append("g")
        .selectAll("line")
        .data(simLinks)
        .join("line")
        .attr("stroke", "#b4b2a9")
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.4)
        .attr("marker-end", "url(#dep-arrow)");

      // Nodes
      const nodeSel = gMain
        .append("g")
        .selectAll("circle")
        .data(simNodes)
        .join("circle");
      nodeSelRef.current = nodeSel;
      nodeSel
        .attr("r", (d) => nodeRadius(d, inDegree))
        .attr("fill", (d) =>
          d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780",
        )
        .attr("stroke", "var(--color-background-primary)")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseover", (e, d) => {
          const neighbors = new Set();
          simLinks.forEach((l) => {
            const s = typeof l.source === "object" ? l.source.id : l.source;
            const t = typeof l.target === "object" ? l.target.id : l.target;
            if (s === d.id) neighbors.add(t);
            if (t === d.id) neighbors.add(s);
          });
          nodeSel
            .attr("fill", (n) =>
              n.id === d.id || neighbors.has(n.id)
                ? n.isCircular
                  ? "#E24B4A"
                  : LAYER_COLORS[n.layer] || "#888780"
                : LAYER_DIM[n.layer] || "#D3D1C7",
            )
            .attr("opacity", (n) =>
              n.id === d.id || neighbors.has(n.id) ? 1 : 0.15,
            );
          linkSel
            .attr("stroke-opacity", (l) => {
              const s = typeof l.source === "object" ? l.source.id : l.source;
              const t = typeof l.target === "object" ? l.target.id : l.target;
              return s === d.id || t === d.id ? 1 : 0.03;
            })
            .attr("stroke", (l) => {
              const s = typeof l.source === "object" ? l.source.id : l.source;
              const t = typeof l.target === "object" ? l.target.id : l.target;
              return s === d.id || t === d.id ? "#378ADD" : "#b4b2a9";
            });
          labelSel.style("display", (n) =>
            showLabels && (n.id === d.id || neighbors.has(n.id)) ? "" : "none",
          );
        })
        .on("mouseout", () => {
          nodeSel
            .attr("fill", (d) =>
              d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780",
            )
            .attr("opacity", 1);
          // Restore review badge / multi-select strokes
          nodeSel.each(function(d) {
            const multiSel = multiSelectedNodesRef.current;
            if (multiSel.some((n) => n.id === d.id)) {
              d3.select(this).attr("stroke", "#a855f7").attr("stroke-width", 3);
            } else {
              const r = nodeReviewsRef.current[d.id];
              if (r) {
                const color = r.score >= 80 ? "#22c55e" : r.score >= 50 ? "#f59e0b" : "#ef4444";
                d3.select(this).attr("stroke", color).attr("stroke-width", 2.5);
              } else {
                d3.select(this)
                  .attr("stroke", "var(--color-background-primary)")
                  .attr("stroke-width", 1.5);
              }
            }
          });
          linkSel.attr("stroke-opacity", 0.4).attr("stroke", "#b4b2a9");
          labelSel.style("display", showLabels ? "" : "none");
        })
        .on("click", (e, d) => {
          e.stopPropagation();
          if (e.shiftKey) {
            // Multi-select toggle
            const existing = multiSelectedNodesRef.current;
            const alreadySelected = existing.some((n) => n.id === d.id);
            const newNodes = alreadySelected
              ? existing.filter((n) => n.id !== d.id)
              : [...existing, d];
            multiSelectedNodesRef.current = newNodes;
            setMultiSelectedNodes([...newNodes]);
            onMultiSelectChangeRef.current?.(newNodes);
            // Apply/remove purple stroke on this node
            nodeSel
              .filter((n) => n.id === d.id)
              .attr("stroke", alreadySelected ? "var(--color-background-primary)" : "#a855f7")
              .attr("stroke-width", alreadySelected ? 1.5 : 3);
          } else {
            setSelectedNode(d);
            fetchSingleFile(d);
            onNodeSelectRef.current?.(d);
          }
        })
        .call(
          d3
            .drag()
            .on("start", (e, d) => {
              if (!e.active) sim.alphaTarget(0.2).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (e, d) => {
              d.fx = e.x;
              d.fy = e.y;
            })
            .on("end", (e, d) => {
              if (!e.active) sim.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }),
        );

      // Labels
      const labelSel = gMain
        .append("g")
        .selectAll("text")
        .data(simNodes)
        .join("text")
        .text((d) => d.id.split("/").pop())
        .attr("font-size", "9px")
        .attr("fill", "#7d8590")
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .style("display", showLabels ? "" : "none");

      sim.on("tick", () => {
        simNodesRef.current = simNodes;
        linkSel
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        nodeSel.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        labelSel
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y + nodeRadius(d, inDegree) + 11);
      });

      svg.on("click", (e) => {
        if (!e.shiftKey) {
          setSelectedNode(null);
        }
      });

      setTimeout(() => {
        svg.call(
          zoom.transform,
          d3.zoomIdentity.translate(W * 0.05, H * 0.05).scale(0.88),
        );
      }, 80);
    },
    [showLabels],
  );

  useEffect(() => {
    if (!data) return;
    render(getFiltered());
  }, [data, search, extFilter, layerFilter, render]);

  // Apply / clear AI highlight on the live D3 selection
  useEffect(() => {
    if (!nodeSelRef.current) return;

    if (highlightedNodeIds.length === 0) {
      nodeSelRef.current
        .attr("fill", (d) => (d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780"))
        .attr("opacity", 1)
        .attr("stroke", "var(--color-background-primary)")
        .attr("stroke-width", 1.5);
      return;
    }

    const idSet = new Set(highlightedNodeIds);

    // Pulse: grow then shrink over 800ms, then settle on amber
    nodeSelRef.current
      .filter((d) => idSet.has(d.id))
      .attr("fill", "#F59E0B")
      .attr("stroke", "#F59E0B")
      .attr("stroke-width", 3)
      .transition()
      .duration(400)
      .attr("r", (d) => nodeRadius(d, inDegreeRef.current) * 1.3)
      .transition()
      .duration(400)
      .attr("r", (d) => nodeRadius(d, inDegreeRef.current));

    nodeSelRef.current
      .filter((d) => !idSet.has(d.id))
      .attr("fill", (d) => (d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780"))
      .attr("opacity", 0.2)
      .attr("stroke", "var(--color-background-primary)")
      .attr("stroke-width", 1.5);

    // Pan graph to first highlighted node
    const firstNode = simNodesRef.current.find((n) => idSet.has(n.id));
    if (firstNode && zoomRef.current && svgRef.current && wrapRef.current) {
      const W = wrapRef.current.clientWidth;
      const H = wrapRef.current.clientHeight;
      const scale = 2.5;
      d3.select(svgRef.current)
        .transition()
        .duration(700)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(W / 2 - firstNode.x * scale, H / 2 - firstNode.y * scale)
            .scale(scale),
        );
    }
  }, [highlightedNodeIds]);

  // Impact ripple animation — groups by propagationOrder, 600ms between waves
  useEffect(() => {
    // Clear any pending timers from a previous impact run
    impactTimersRef.current.forEach(clearTimeout);
    impactTimersRef.current = [];

    if (!nodeSelRef.current) return;

    if (impactNodes.length === 0) {
      // Restore default look
      nodeSelRef.current
        .attr("fill", (d) => (d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780"))
        .attr("opacity", 1)
        .attr("stroke", "var(--color-background-primary)")
        .attr("stroke-width", 1.5);
      return;
    }

    const RISK_COLOR = {
      critical: "#ef4444",
      high: "#f97316",
      medium: "#f59e0b",
      low: "#facc15",
    };

    const byOrder = {};
    impactNodes.forEach((n) => {
      const o = n.propagationOrder || 1;
      if (!byOrder[o]) byOrder[o] = [];
      byOrder[o].push(n);
    });

    const orders = Object.keys(byOrder)
      .map(Number)
      .sort((a, b) => a - b);

    const impactIdSet = new Set(impactNodes.map((n) => n.nodeId));

    // Dim non-affected nodes immediately
    nodeSelRef.current
      .filter((d) => !impactIdSet.has(d.id))
      .attr("opacity", 0.15)
      .attr("fill", (d) => (d.isCircular ? "#E24B4A" : LAYER_COLORS[d.layer] || "#888780"));

    orders.forEach((order, idx) => {
      const delay = idx * 600;
      const timer = setTimeout(() => {
        if (!nodeSelRef.current) return;
        const group = byOrder[order];
        group.forEach(({ nodeId, risk }) => {
          const color = RISK_COLOR[risk] || "#f59e0b";
          nodeSelRef.current
            .filter((d) => d.id === nodeId)
            .attr("fill", color)
            .attr("stroke", color)
            .attr("stroke-width", 3)
            .attr("opacity", 1)
            .transition()
            .duration(300)
            .attr("r", (d) => nodeRadius(d, inDegreeRef.current) * 1.4)
            .transition()
            .duration(300)
            .attr("r", (d) => nodeRadius(d, inDegreeRef.current));
        });
      }, delay);
      impactTimersRef.current.push(timer);
    });

    // Pan to first impacted node after first wave fires
    const firstGroupTimer = setTimeout(() => {
      const firstNode = simNodesRef.current.find(
        (n) => byOrder[orders[0]]?.some((x) => x.nodeId === n.id)
      );
      if (firstNode && zoomRef.current && svgRef.current && wrapRef.current) {
        const W = wrapRef.current.clientWidth;
        const H = wrapRef.current.clientHeight;
        const scale = 2.2;
        d3.select(svgRef.current)
          .transition()
          .duration(700)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
              .translate(W / 2 - firstNode.x * scale, H / 2 - firstNode.y * scale)
              .scale(scale)
          );
      }
    }, 100);
    impactTimersRef.current.push(firstGroupTimer);
  }, [impactNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMultiSelect = useCallback(() => {
    multiSelectedNodesRef.current = [];
    setMultiSelectedNodes([]);
    onMultiSelectChangeRef.current?.([]);
    if (nodeSelRef.current) {
      nodeSelRef.current.each(function(d) {
        const r = nodeReviewsRef.current[d.id];
        if (r) {
          const color = r.score >= 80 ? "#22c55e" : r.score >= 50 ? "#f59e0b" : "#ef4444";
          d3.select(this).attr("stroke", color).attr("stroke-width", 2.5);
        } else {
          d3.select(this)
            .attr("stroke", "var(--color-background-primary)")
            .attr("stroke-width", 1.5);
        }
      });
    }
  }, []);

  // Re-apply purple strokes whenever multiSelectedNodes changes (e.g. after graph re-render)
  useEffect(() => {
    if (!nodeSelRef.current) return;
    const multiIds = new Set(multiSelectedNodes.map((n) => n.id));
    nodeSelRef.current.each(function(d) {
      if (multiIds.has(d.id)) {
        d3.select(this).attr("stroke", "#a855f7").attr("stroke-width", 3);
      }
    });
  }, [multiSelectedNodes]);

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    const W = wrapRef.current?.clientWidth || 680;
    const H = wrapRef.current?.clientHeight || 480;
    if (zoomRef.current) {
      svg
        .transition()
        .duration(500)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(W * 0.05, H * 0.05).scale(0.88),
        );
    }
  };

  if (!data) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--color-text-secondary)",
          fontSize: 14,
        }}
      >
        Pass the API response as the <code>data</code> prop.
      </div>
    );
  }

  const btnStyle = {
    fontSize: 11,
    height: 28,
    padding: "0 10px",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const selStyle = {
    fontSize: 11,
    height: 28,
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 6,
    padding: "0 6px",
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--color-background-primary)",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      {/* ── toolbar ── */}

      {/* ── graph + sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          ref={wrapRef}
          style={{ flex: 1, position: "relative", overflow: "hidden" }}
        >
          <svg
            ref={svgRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />

          {/* ── multi-select toolbar ── */}
          {multiSelectedNodes.length > 0 && (
            <div style={{
              position: "absolute", top: 12, right: 12, zIndex: 20,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(13,17,23,0.95)",
              border: "0.5px solid rgba(167,139,250,0.4)",
              borderRadius: 10, padding: "7px 12px",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#a855f7", boxShadow: "0 0 8px #a855f7", flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: "#e6edf3", fontWeight: 500 }}>
                {multiSelectedNodes.length} file{multiSelectedNodes.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={clearMultiSelect}
                title="Clear selection"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.35)", fontSize: 14, lineHeight: 1, padding: "0 2px",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── floating search box ── */}
          <div style={{ position: "absolute", top: 12, left: 12, width: 280, zIndex: 10 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <svg
                style={{ position: "absolute", left: 9, pointerEvents: "none", opacity: 0.5 }}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search file…"
                value={focusQuery}
                onChange={(e) => { setFocusQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { clearFocus(); setDropdownOpen(false); }
                  if (e.key === "Enter" && focusResults.length > 0) focusNode(focusResults[0].id);
                }}
                style={{
                  width: "100%",
                  height: 34,
                  paddingLeft: 30,
                  paddingRight: focusedId ? 28 : 10,
                  border: "0.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  background: "rgba(10,20,40,0.85)",
                  backdropFilter: "blur(8px)",
                  color: "#e6edf3",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {focusedId && (
                <button
                  onClick={clearFocus}
                  style={{
                    position: "absolute", right: 7, background: "none",
                    border: "none", cursor: "pointer", color: "#7d8590",
                    fontSize: 14, lineHeight: 1, padding: 0,
                  }}
                  title="Clear"
                >✕</button>
              )}
            </div>

            {/* dropdown */}
            {dropdownOpen && focusResults.length > 0 && (
              <div style={{
                marginTop: 4,
                background: "rgba(13,17,23,0.97)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                backdropFilter: "blur(12px)",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}>
                {focusResults.map((node) => {
                  const parts = node.id.split("/");
                  const name = parts.pop();
                  const dir = parts.join("/");
                  return (
                    <div
                      key={node.id}
                      onMouseDown={() => focusNode(node.id)}
                      style={{
                        padding: "7px 12px",
                        cursor: "pointer",
                        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(55,138,221,0.15)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ fontSize: 12, color: "#e6edf3", fontWeight: 500 }}>{name}</div>
                      {dir && <div style={{ fontSize: 10, color: "#7d8590", marginTop: 1 }}>{dir}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Sidebar
          node={selectedNode}
          graphMap={graphMap}
          onClose={() => { setSelectedNode(null); setFileData(null); }}
          fileData={fileData}
          isLoading={fileLoading}
          repoUrl={repoUrl}
        />
      </div>

      {/* ── stats bar ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 12px",
          borderTop: "0.5px solid var(--color-border-tertiary)",
          flexShrink: 0,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {[
          { n: stats.files, l: "files" },
          { n: stats.links, l: "links" },
          { n: stats.layers, l: "layers" },
        ].map(({ n, l }) => (
          <div
            key={l}
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: 6,
              padding: "6px 12px",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1, color: "var(--color-text-primary)" }}>
              {n}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-secondary)",
                marginTop: 2,
              }}
            >
              {l}
            </div>
          </div>
        ))}
        <div
          style={{
            background: "var(--color-background-secondary)",
            borderRadius: 6,
            padding: "6px 12px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1,
              color: data.hasCycles
                ? "var(--color-text-danger)"
                : "var(--color-text-success)",
            }}
          >
            {data.hasCycles
              ? `${data.cycleCount} cycle${data.cycleCount !== 1 ? "s" : ""}`
              : "No cycles"}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-secondary)",
              marginTop: 2,
            }}
          >
            {data.repo || "health"}
          </div>
        </div>
        {/* dynamic legend */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginLeft: "auto",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {allLayers.map((layer) => (
            <span
              key={layer}
              style={{
                fontSize: 10,
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: LAYER_COLORS[layer] || "#888780",
                  display: "inline-block",
                }}
              />
              {layer}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
