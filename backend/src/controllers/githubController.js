const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 600 });

const {
  octokit,
  getRepoDetails,
  getRepoFileTree,
  fetchFileContents,
  parseGitHubUrl,
  fetchSingleFile,
  getDefaultBranch,
} = require("../services/githubService");
const { buildGraphAndCheckCycles, formatGraphData } = require("../utils/graphUtils");
const { getImports } = require("../services/astService");
const { asyncHandler } = require("../middleware/errorHandler");

const parseAndFetchController = asyncHandler(async (req, res) => {
  const { repoUrl } = req.body;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    const err = new Error("Invalid or unrecognised GitHub URL");
    err.statusCode = 400;
    throw err;
  }
  const repoData = await getRepoDetails(parsed.owner, parsed.repo);
  res.status(200).json({ success: true, data: repoData });
});

const getFileTreeController = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const fileList = await getRepoFileTree(owner, repo);
  res.status(200).json({ success: true, count: fileList.length, files: fileList });
});

const getRepoContentController = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const fileList = await getRepoFileTree(owner, repo);
  const filesWithContent = await fetchFileContents(owner, repo, fileList);
  res.status(200).json({ success: true, data: filesWithContent });
});

const getSingleFileController = asyncHandler(async (req, res) => {
  const { repoUrl, filePath } = req.query;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    const err = new Error("Invalid repository URL");
    err.statusCode = 400;
    throw err;
  }
  const { owner, repo, branch } = parsed;
  const content = await fetchSingleFile(owner, repo, filePath, branch);
  res.status(200).json({ success: true, path: filePath, content });
});

const analyzeRepoController = asyncHandler(async (req, res) => {
  const { repoUrl } = req.body;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    const err = new Error("Invalid or unrecognised GitHub URL");
    err.statusCode = 400;
    throw err;
  }
  const { repo, owner } = parsed;
  const branch = parsed.branch || await getDefaultBranch(owner, repo);
  const fileList = await getRepoFileTree(owner, repo, branch);
  const filesWithContent = await fetchFileContents(owner, repo, fileList, branch);
  const { graph, cycles } = buildGraphAndCheckCycles(filesWithContent, getImports);
  const formattedData = formatGraphData(graph, cycles);
  res.status(200).json({
    success: true,
    repo: `${owner}/${repo}`,
    hasCycles: cycles.length > 0,
    cycleCount: cycles.length,
    cycles,
    graph,
    data: formattedData,
  });
});

const getFileCommitsController = asyncHandler(async (req, res) => {
  const { repoUrl, filePath } = req.query;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) { const err = new Error("Invalid repository URL"); err.statusCode = 400; throw err; }
  const { owner, repo } = parsed;

  const cacheKey = `commits:${owner}/${repo}:${filePath}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const branch = parsed.branch || await getDefaultBranch(owner, repo);

  const { data: commits } = await octokit.rest.repos.listCommits({
    owner, repo, path: filePath, per_page: 50,
  });

  const results = await Promise.all(
    commits.slice(0, 20).map(async (commit) => {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${filePath}`;
        const resp = await fetch(url, { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } });
        if (!resp.ok) return null;
        const text = await resp.text();
        return {
          sha: commit.sha.slice(0, 7),
          date: commit.commit.author?.date,
          message: commit.commit.message?.split('\n')[0]?.slice(0, 60),
          lines: text.split('\n').length,
        };
      } catch { return null; }
    })
  );

  const data = results.filter(Boolean).reverse();
  cache.set(cacheKey, data);
  res.json({ success: true, data });
});

const getChurnController = asyncHandler(async (req, res) => {
  const { repoUrl } = req.query;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) { const err = new Error("Invalid repository URL"); err.statusCode = 400; throw err; }
  const { owner, repo } = parsed;

  const cacheKey = `churn:${owner}/${repo}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const { data: commits } = await octokit.rest.repos.listCommits({ owner, repo, per_page: 50 });

  const churnMap = {};
  await Promise.all(commits.map(async (commit) => {
    try {
      const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: commit.sha });
      for (const file of (data.files || [])) {
        churnMap[file.filename] = (churnMap[file.filename] || 0) + 1;
      }
    } catch { /* skip */ }
  }));

  cache.set(cacheKey, churnMap);
  res.json({ success: true, data: churnMap });
});

const postPRCommentController = asyncHandler(async (req, res) => {
  const { repoUrl, pr, body } = req.body;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) { const err = new Error("Invalid repository URL"); err.statusCode = 400; throw err; }
  const { owner, repo } = parsed;
  const prNum = parseInt(pr, 10);
  if (!prNum || prNum < 1) { const err = new Error("Invalid PR number"); err.statusCode = 400; throw err; }
  if (!body || typeof body !== 'string' || !body.trim()) { const err = new Error("Comment body is required"); err.statusCode = 400; throw err; }

  const { data } = await octokit.rest.issues.createComment({ owner, repo, issue_number: prNum, body });
  res.json({ success: true, commentUrl: data.html_url });
});

const getPRImpactController = asyncHandler(async (req, res) => {
  const { repoUrl, pr } = req.query;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) { const err = new Error("Invalid repository URL"); err.statusCode = 400; throw err; }
  const { owner, repo } = parsed;
  const prNum = parseInt(pr, 10);
  if (!prNum || prNum < 1) { const err = new Error("Invalid PR number"); err.statusCode = 400; throw err; }

  const cacheKey = `pr-impact:${owner}/${repo}:${prNum}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const { data: prData } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNum });

  const files = [];
  for (let page = 1; files.length < 300; page++) {
    const { data } = await octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNum, per_page: 100, page });
    files.push(...data);
    if (data.length < 100) break;
  }

  const data = {
    prNumber: prNum,
    prTitle: prData.title,
    prUrl: prData.html_url,
    prState: prData.state,
    prAuthor: prData.user?.login,
    baseBranch: prData.base?.ref,
    headBranch: prData.head?.ref,
    totalAdditions: prData.additions,
    totalDeletions: prData.deletions,
    changedFiles: files.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
    })),
  };

  cache.set(cacheKey, data);
  res.json({ success: true, data });
});

module.exports = {
  parseAndFetchController,
  getFileTreeController,
  getRepoContentController,
  getSingleFileController,
  analyzeRepoController,
  getFileCommitsController,
  getChurnController,
  getPRImpactController,
  postPRCommentController,
};
