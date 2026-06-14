const { groqImpactAnalyze } = require("../services/groqImpactService");

const IMPACT_SYSTEM_PROMPT = `You are a software architect analyzing change impact. You have a Git diff and a dependency graph of the codebase. Analyze which modules will be affected by this change.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation outside the JSON):
{
  "affectedNodes": [
    {
      "nodeId": "<string matching an id from the graph nodes>",
      "risk": "critical"|"high"|"medium"|"low",
      "reason": "<short explanation>",
      "propagationOrder": <number starting at 1>
    }
  ],
  "summary": "<2-3 sentence summary of the overall impact>",
  "testFilesToRun": ["<file path>"]
}

Order affectedNodes by propagationOrder (1 = directly affected, 2 = one hop away, etc).
Only include node IDs that actually exist in the provided graph. Keep affectedNodes to a maximum of 20 items.`;

async function impactController(req, res) {
  const { diff, graph } = req.body;

  if (!diff || !graph) {
    return res.status(400).json({ success: false, error: "Missing diff or graph" });
  }

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    return res.status(400).json({ success: false, error: "graph.nodes must be an array" });
  }

  try {
    const slimNodes = graph.nodes.map((n) => ({
      id: n.id,
      layer: n.layer,
      ext: n.ext,
      filePath: n.filePath,
    }));

    const slimEdges = (graph.edges || graph.links || []).map((l) => ({
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
    }));

    const userMessage = `Git diff to analyze:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Dependency graph (nodes and edges):
${JSON.stringify({ nodes: slimNodes, edges: slimEdges }, null, 0).slice(0, 12000)}`;

    const rawText = await groqImpactAnalyze(IMPACT_SYSTEM_PROMPT, userMessage);

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned a non-JSON response");

    const result = JSON.parse(jsonMatch[0]);

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const normalised = {
      affectedNodes: (result.affectedNodes || [])
        .filter((n) => nodeIds.has(n.nodeId))
        .map((n) => ({
          nodeId: n.nodeId,
          risk: ["critical", "high", "medium", "low"].includes(n.risk) ? n.risk : "medium",
          reason: n.reason || "",
          propagationOrder: typeof n.propagationOrder === "number" ? n.propagationOrder : 1,
        })),
      summary: result.summary || "",
      testFilesToRun: Array.isArray(result.testFilesToRun) ? result.testFilesToRun : [],
    };

    return res.json({ success: true, data: normalised });
  } catch (err) {
    console.error("[impact] error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { impactController };
