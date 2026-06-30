const express = require("express");
const router = express.Router();
const {
  parseAndFetchController,
  getFileTreeController,
  getRepoContentController,
  getSingleFileController,
  analyzeRepoController,
  getFileCommitsController,
  getChurnController,
  getPRImpactController,
  postPRCommentController,
} = require("../controllers/githubController");

router.post("/parse", parseAndFetchController);
router.get("/tree/:owner/:repo", getFileTreeController);
router.get("/content/:owner/:repo", getRepoContentController);
router.get("/file", getSingleFileController);
router.post("/analyze", analyzeRepoController);
router.get("/commits", getFileCommitsController);
router.get("/churn", getChurnController);
router.get("/pr-impact", getPRImpactController);
router.post("/pr-comment", postPRCommentController);

module.exports = router;
