const express = require("express");
const router = express.Router();
const { askController } = require("../controllers/aiController");
const { reviewController } = require("../controllers/reviewController");
const { docsController } = require("../controllers/docsController");
const { impactController } = require("../controllers/impactController");
const { geminiGenerateText } = require("../services/geminiService");

router.post("/ask", askController);
router.post("/review", reviewController);
router.post("/docs", docsController);
router.post("/impact", impactController);

// Quick connectivity test — GET http://localhost:5000/api/ai/ping
router.get("/ping", async (_req, res) => {
  try {
    const text = await geminiGenerateText(
      "You are a helpful assistant.",
      "Reply with exactly: pong"
    );
    res.json({ success: true, reply: text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
