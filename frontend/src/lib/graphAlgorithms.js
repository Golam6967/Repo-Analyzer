export function buildAdjacencyList(edges) {
  const adj = {};
  for (const e of edges) {
    const src = e.source?.id ?? e.source;
    const tgt = e.target?.id ?? e.target;
    if (!adj[src]) adj[src] = [];
    adj[src].push(tgt);
  }
  return adj;
}

const ENTRY_PATTERNS = /(?:^|\/)(?:index|main|app|server|entry)\.[jt]sx?$/i;

export function isEntryPoint(node) {
  return ENTRY_PATTERNS.test(node.filePath || node.id || '');
}

export function findDeadNodes(nodes, edges) {
  const hasIncoming = new Set(edges.map(e => e.target?.id ?? e.target));
  return nodes
    .filter(n => !hasIncoming.has(n.id))
    .filter(n => !isEntryPoint(n))
    .map(n => n.id);
}

export function findCycles(nodes, edges) {
  const adj = buildAdjacencyList(edges);
  const visited = new Set();
  const inStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of (adj[node] || [])) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (inStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) cycles.push(path.slice(cycleStart));
      }
    }
    inStack.delete(node);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id, [n.id]);
  }
  return cycles;
}

export function computeDepths(nodes, edges, entryIds) {
  const adj = buildAdjacencyList(edges);
  const depths = new Map();
  const queue = entryIds.map(id => ({ id, depth: 0 }));

  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depths.has(id)) continue;
    depths.set(id, depth);
    for (const neighbor of (adj[id] || [])) {
      queue.push({ id: neighbor, depth: depth + 1 });
    }
  }
  return depths;
}

export function getNHopNeighbours(startId, edges, hops) {
  const visible = new Set([startId]);
  let frontier = new Set([startId]);

  for (let i = 0; i < hops; i++) {
    const next = new Set();
    for (const e of edges) {
      const src = e.source?.id ?? e.source;
      const tgt = e.target?.id ?? e.target;
      if (frontier.has(src)) next.add(tgt);
      if (frontier.has(tgt)) next.add(src);
    }
    for (const n of next) visible.add(n);
    frontier = next;
  }
  return visible;
}

export function generateOnboardingPath(entryId, nodes, edges) {
  const adj = buildAdjacencyList(edges);
  const visited = new Set();
  const queue = [{ id: entryId, depth: 0 }];
  const path = [];

  while (queue.length) {
    const { id, depth } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find(n => n.id === id);
    if (!node) continue;
    path.push({ nodeId: id, filePath: node.filePath || id, depth, readingOrder: path.length + 1 });
    for (const neighbor of (adj[id] || [])) {
      queue.push({ id: neighbor, depth: depth + 1 });
    }
  }
  return path;
}

export function getLanguageCounts(nodes) {
  const extMap = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript',
    jsx: 'JavaScript', py: 'Python', go: 'Go',
    rs: 'Rust', java: 'Java', css: 'CSS', md: 'Markdown',
    cpp: 'C++', c: 'C', cs: 'C#', rb: 'Ruby', php: 'PHP',
  };
  return nodes.reduce((acc, node) => {
    const fp = node.filePath || node.id || '';
    const ext = fp.split('.').pop()?.toLowerCase() || 'other';
    const lang = extMap[ext] || 'Other';
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});
}
