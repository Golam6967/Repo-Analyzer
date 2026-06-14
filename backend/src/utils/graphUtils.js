// utils/graphUtils.js

const detectCycles = (graph) => {
  // ... keep your existing detectCycles logic exactly the same ...
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  const dfs = (node, path) => {
    visited.add(node);
    recStack.add(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recStack.has(neighbor)) {
        cycles.push([...path, neighbor]);
      }
    }
    recStack.delete(node);
  };

  Object.keys(graph).forEach((node) => {
    if (!visited.has(node)) dfs(node, [node]);
  });

  return cycles;
};

const buildGraphAndCheckCycles = (filesWithContent, getImportsFn) => {
  const rawGraph = {};
  const exactPaths = new Set(filesWithContent.map((file) => file.path));
  filesWithContent.forEach((file) => {
    rawGraph[file.path] = getImportsFn(file.path, file.content);
  });

  const resolvePath = (target) => {
    if (exactPaths.has(target)) return target;

    const candidates = [
      // JS / TS
      ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
      "/index.js", "/index.jsx", "/index.ts", "/index.tsx",
      // Python
      ".py", "/__init__.py",
      // Go
      ".go",
      // Ruby
      ".rb",
      // Rust
      ".rs",
      // PHP
      ".php",
      // Java
      ".java",
      // C / C++
      ".c", ".cc", ".cpp", ".cxx", ".h", ".hpp",
      // C#
      ".cs",
    ];

    for (const suffix of candidates) {
      if (exactPaths.has(target + suffix)) return target + suffix;
    }
    return null;
  };

  // 2. Clean the graph (match extensions and remove external libs)
  const cleanGraph = {};
  Object.entries(rawGraph).forEach(([source, targets]) => {
    cleanGraph[source] = targets.map(resolvePath).filter(Boolean); // This removes any 'null' values
  });

  // 3. Detect Cycles on the newly cleaned graph
  const cycles = detectCycles(cleanGraph);

  return { graph: cleanGraph, cycles };
};

const formatGraphData = (graph, cycles) => {
  const nodes = Object.keys(graph).map((filePath) => ({
    id: filePath,
    filePath: filePath,
    isCircular: cycles.flat().includes(filePath),
  }));

  const links = [];
  Object.entries(graph).forEach(([source, targets]) => {
    targets.forEach((target) => {
      // We know the target exists now because we cleaned it
      links.push({ source, target });
    });
  });

  return { nodes, links };
};

module.exports = { buildGraphAndCheckCycles, detectCycles, formatGraphData };
