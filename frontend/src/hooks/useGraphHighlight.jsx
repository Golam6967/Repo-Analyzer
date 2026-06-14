import { createContext, useContext, useState, useCallback } from "react";

const GraphHighlightContext = createContext(null);

export function GraphHighlightProvider({ children }) {
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [impactNodes, setImpactNodes] = useState([]);

  const highlight = useCallback((nodeIds) => {
    setHighlightedNodeIds(Array.isArray(nodeIds) ? nodeIds : []);
    setImpactNodes([]);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeIds([]);
  }, []);

  // affectedNodes: Array<{ nodeId, risk, reason, propagationOrder }>
  const highlightImpact = useCallback((affectedNodes) => {
    setImpactNodes(Array.isArray(affectedNodes) ? affectedNodes : []);
    setHighlightedNodeIds([]);
  }, []);

  const clearImpact = useCallback(() => {
    setImpactNodes([]);
  }, []);

  return (
    <GraphHighlightContext.Provider
      value={{ highlightedNodeIds, highlight, clearHighlight, impactNodes, highlightImpact, clearImpact }}
    >
      {children}
    </GraphHighlightContext.Provider>
  );
}

export function useGraphHighlight() {
  const ctx = useContext(GraphHighlightContext);
  if (!ctx)
    return {
      highlightedNodeIds: [],
      highlight: () => {},
      clearHighlight: () => {},
      impactNodes: [],
      highlightImpact: () => {},
      clearImpact: () => {},
    };
  return ctx;
}
