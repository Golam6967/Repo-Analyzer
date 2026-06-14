const { fetchSingleFile } = require("../services/githubService");
const { reviewWithAI } = require("../services/geminiService");

const REVIEW_SYSTEM_PROMPT = `You are a senior code reviewer. Review the following file and respond with ONLY a JSON object in this exact format (no markdown, no explanation outside the JSON):
{
  "bugs": [{ "line": <number>, "description": "<string>", "severity": "high"|"medium"|"low" }],
  "smells": [{ "description": "<string>" }],
  "security": [{ "description": "<string>", "severity": "critical"|"high"|"medium" }],
  "quickWins": [{ "description": "<string>" }],
  "score": <number between 0 and 100>
}
Keep each array to a maximum of 5 items. Only return valid JSON — no markdown fences.`;

async function reviewController(req, res) {
  const { nodeId, filePath, repoOwner, repoName, language } = req.body;

  if (!filePath || !repoOwner || !repoName) {
    return res.status(400).json({ success: false, error: "Missing filePath, repoOwner, or repoName" });
  }

  try {
    const fileContent = await fetchSingleFile(repoOwner, repoName, filePath);

    const userMessage = `Language: ${language || "auto-detect"}
File path: ${filePath}

--- FILE CONTENT START ---
${fileContent.slice(0, 12000)}
--- FILE CONTENT END ---`;

    const rawText = await reviewWithAI(REVIEW_SYSTEM_PROMPT, userMessage);

    // Extract JSON — the model may wrap it in markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned a non-JSON response");

    const review = JSON.parse(jsonMatch[0]);

    // Ensure all fields exist with safe defaults
    const normalised = {
      bugs: review.bugs || [],
      smells: review.smells || [],
      security: review.security || [],
      quickWins: review.quickWins || [],
      score: typeof review.score === "number" ? review.score : 50,
    };

    return res.json({ success: true, nodeId, review: normalised });
  } catch (err) {
    console.error("[review] error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { reviewController };
