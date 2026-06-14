import { getLayer } from "./layerUtils.js";

export function normaliseData(data) {
  let rawNodes = [];
  let rawLinks = [];

  console.log(data);
  // ── Shape B: backend already gives nodes + links arrays ──
  if (Array.isArray(data?.nodes) && Array.isArray(data?.links)) {
    rawNodes = data.nodes;
    rawLinks = data.links;
  }
  // ── Shape A: raw adjacency map under data.graph ──
  else if (data?.graph && typeof data.graph === "object") {
    const map = data.graph;
    rawNodes = Object.keys(map).map((id) => ({
      id,
      filePath: id,
      isCircular: false,
    }));
    Object.keys(map).forEach((id) => {
      const internalSet = new Set(Object.keys(map));
      (map[id] || []).forEach((imp) => {
        const norm = imp.replace(/\\/g, "/");
        const match = rawNodes.find(
          (m) =>
            m.id === norm ||
            m.id === norm + ".js" ||
            m.id === norm + ".ts" ||
            m.id === norm + ".jsx" ||
            m.id === norm + ".tsx" ||
            m.id.endsWith("/" + norm.split("/").pop()) ||
            m.id.endsWith("/" + norm.split("/").pop() + ".jsx") ||
            m.id.endsWith("/" + norm.split("/").pop() + ".tsx"),
        );
        if (match && match.id !== id && internalSet.has(match.id)) {
          rawLinks.push({ source: id, target: match.id });
        }
      });
    });
  }

  // Enrich nodes with layer + ext (use filePath OR id)
  const nodes = rawNodes.map((n) => {
    const path = n.filePath || n.id || "";
    return {
      ...n,
      id: n.id || path,
      layer: n.layer || getLayer(path),
      ext: path.split(".").pop() || "js",
    };
  });

  // In-degree map
  const inDegree = {};
  nodes.forEach((n) => (inDegree[n.id] = 0));
  rawLinks.forEach((l) => {
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (inDegree[t] !== undefined) inDegree[t]++;
  });

  // graphMap for sidebar (imports per file)
  // Build from links since Shape B doesn't include the raw import strings
  const graphMap = {};
  nodes.forEach((n) => (graphMap[n.id] = []));
  rawLinks.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (graphMap[s] !== undefined) graphMap[s].push(t);
  });

  return { nodes, links: rawLinks, inDegree, graphMap };
}
