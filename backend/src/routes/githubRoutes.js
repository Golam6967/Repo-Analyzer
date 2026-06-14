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
} = require("../controllers/githubController");

router.post("/parse", parseAndFetchController);
router.get("/tree/:owner/:repo", getFileTreeController);
router.get("/content/:owner/:repo", getRepoContentController);
router.get("/file", getSingleFileController);
router.post("/analyze", analyzeRepoController);
router.get("/commits", getFileCommitsController);
router.get("/churn", getChurnController);

module.exports = router;
