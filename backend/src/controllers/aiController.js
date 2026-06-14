const { geminiGenerateText } = require("../services/geminiService");

const QA_SYSTEM_PROMPT = `You are a code navigation assistant. You have been given a call graph of a GitHub repository as JSON.
When the user asks a question, answer it clearly and concisely AND return a JSON block at the very end of your response in this exact format:
{ "highlightNodes": ["nodeId1", "nodeId2"] }
Only include node IDs from the provided graph that directly answer the question. Max 8 nodes.
If no specific nodes are relevant, return an empty array: { "highlightNodes": [] } and if nothing relevant then say sorry cannot answer`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askController(req, res) {
  const { question, graph, repoOwner, repoName } = req.body;

  if (!question || !graph) {
    return res
      .status(400)
      .json({ success: false, error: "Missing question or graph" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const userMessage = `Repository: ${repoOwner || "unknown"}/${repoName || "unknown"}

Dependency graph (nodes with their layer/type, and edges showing imports):
${JSON.stringify(graph)}

User question: ${question}`;

    const fullText = await geminiGenerateText(QA_SYSTEM_PROMPT, userMessage);
    console.log(fullText);

    // Stream word-by-word so the frontend gets a typing effect
    const words = fullText.split(/(\s+)/);
    for (const word of words) {
      if (word) {
        res.write(`data: ${JSON.stringify({ text: word })}\n\n`);
        await sleep(18);
      }
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

module.exports = { askController };
