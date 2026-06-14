const {
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
  const branch = parsed.branch || await getDefaultBranch(owner, repo);
  const { Octokit } = require("octokit");
  const octokit = new (require("octokit").Octokit)({ auth: process.env.GITHUB_TOKEN });

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

  res.json({ success: true, data: results.filter(Boolean).reverse() });
});

const getChurnController = asyncHandler(async (req, res) => {
  const { repoUrl } = req.query;
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) { const err = new Error("Invalid repository URL"); err.statusCode = 400; throw err; }
  const { owner, repo } = parsed;
  const { Octokit } = require("octokit");
  const octokit = new (require("octokit").Octokit)({ auth: process.env.GITHUB_TOKEN });

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

  res.json({ success: true, data: churnMap });
});

module.exports = {
  parseAndFetchController,
  getFileTreeController,
  getRepoContentController,
  getSingleFileController,
  analyzeRepoController,
  getFileCommitsController,
  getChurnController,
};
