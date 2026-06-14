const { fetchSingleFile } = require("../services/githubService");
const { groqDocsGenerateText } = require("../services/groqDocsService");

const DOCS_SYSTEM_PROMPT = `You are a technical documentation writer. You have been given multiple source files from a software project. Generate comprehensive markdown documentation covering:
1. Module Overview (2-3 sentences of what this module does)
2. Public API (functions/classes exported, with parameter descriptions)
3. Data Flow (how data moves between these files)
4. Usage Examples (2-3 concrete code examples)
5. Dependencies (what this module needs from the rest of the codebase)
Use proper markdown with headers, code blocks, and tables where appropriate.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function docsController(req, res) {
  const { nodes, repoOwner, repoName } = req.body;

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ success: false, error: "Missing nodes array" });
  }
  if (!repoOwner || !repoName) {
    return res.status(400).json({ success: false, error: "Missing repoOwner or repoName" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // Fetch all file contents in parallel
    const fileResults = await Promise.all(
      nodes.map(async (node) => {
        try {
          const content = await fetchSingleFile(repoOwner, repoName, node.filePath);
          return { filePath: node.filePath, content: content.slice(0, 8000) };
        } catch (err) {
          console.warn(`[docs] could not fetch ${node.filePath}: ${err.message}`);
          return { filePath: node.filePath, content: "(could not fetch file content)" };
        }
      })
    );

    const filesBlock = fileResults
      .map((f) => `### File: ${f.filePath}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");

    const userMessage = `Repository: ${repoOwner}/${repoName}\n\nFiles to document (${nodes.length} file${nodes.length !== 1 ? "s" : ""}):\n\n${filesBlock}`;

    const fullText = await groqDocsGenerateText(DOCS_SYSTEM_PROMPT, userMessage);

    const words = fullText.split(/(\s+)/);
    for (const word of words) {
      if (word) {
        res.write(`data: ${JSON.stringify({ text: word })}\n\n`);
        await sleep(8);
      }
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    console.error("[docs] error:", err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

module.exports = { docsController };
