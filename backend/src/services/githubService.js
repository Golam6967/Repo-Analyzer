const { Octokit } = require("octokit");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const getRepoDetails = async (owner, repo) => {
  try {
    const { data } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    return data;
  } catch (error) {
    throw new Error(`GitHub API Error: ${error.message}`);
  }
};
const TRACKED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".go",
  ".rb",
  ".rs",
  ".php",
  ".c",
  ".cc",
  ".cpp",
  ".cxx",
  ".h",
  ".hpp",
  ".cs",
]);

const getRepoFileTree = async (owner, repo, branch = null) => {
  try {
    const targetBranch = branch || (await getDefaultBranch(owner, repo));
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: targetBranch,
      recursive: "1",
    });

    return data.tree
      .filter((item) => item.type === "blob")
      .filter((item) => {
        const dot = item.path.lastIndexOf(".");
        return (
          dot !== -1 &&
          TRACKED_EXTENSIONS.has(item.path.slice(dot).toLowerCase())
        );
      });
  } catch (error) {
    throw new Error(`GitHub Tree API Error: ${error.message}`);
  }
};

// We use the 'raw' media type to get the file content directly
const fetchFileContents = async (owner, repo, files, branch = "main") => {
  try {
    const promises = files.map(async (file) => {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3.raw",
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch ${file.path}`);
      return { path: file.path, content: await response.text() };
    });
    return await Promise.all(promises);
  } catch (error) {
    throw new Error(`Parallel Fetch Error: ${error.message}`);
  }
};
const getDefaultBranch = async (owner, repo) => {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return data.default_branch;
};
const fetchSingleFile = async (owner, repo, filePath, branch) => {
  const targetBranch = branch || (await getDefaultBranch(owner, repo));

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${filePath}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.raw",
    },
  });

  if (!response.ok)
    throw new Error(`Failed to fetch ${filePath} from ${targetBranch}`);
  return await response.text();
};
const parseGitHubUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  // Normalise: trim, strip trailing slash/whitespace
  let url = rawUrl.trim().replace(/\/+$/, "");

  // Support SSH git@github.com:owner/repo.git
  const sshMatch = url.match(
    /^git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i,
  );
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      branch: null,
      type: "repo root",
    };
  }

  // Support bare "owner/repo" shorthand (no protocol, no dots)
  const shorthand = url.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand && !url.includes("://")) {
    return {
      owner: shorthand[1],
      repo: shorthand[2].replace(/\.git$/, ""),
      branch: null,
      type: "repo root",
    };
  }

  // raw.githubusercontent.com
  const rawMatch = url.match(
    /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)/i,
  );
  if (rawMatch) {
    return {
      owner: rawMatch[1],
      repo: rawMatch[2].replace(/\.git$/, ""),
      branch: rawMatch[3],
      type: "raw file",
    };
  }

  // Standard github.com URLs (http/https)
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/([^/]+)(?:\/([^/]+))?)?(?:[?#]|$)/i,
  );
  if (!match) return null;

  const [, owner, repo, verb, ref] = match;
  const branchVerbs = ["tree", "blob", "commits", "blame"];
  let branch = null;
  let type = "repo root";

  if (verb === "compare") {
    const parts = url.split("/compare/")[1]?.split(/[?#]/)[0];
    const sides = parts?.match(/^(.+?)\.{2,3}(.+)$/);
    return { owner, repo, branch: sides ? sides[2] : parts, type: "compare" };
  }
  if (verb === "commit") {
    return { owner, repo, branch: null, sha: ref, type: "commit" };
  }
  if (verb === "releases" && url.includes("/releases/tag/")) {
    const tag = url.split("/releases/tag/")[1]?.split(/[?#]/)[0];
    return { owner, repo, branch: tag, type: "release tag" };
  }
  if (branchVerbs.includes(verb)) {
    const afterVerb = url.match(new RegExp(`/${verb}/([^?#]+)`))?.[1];
    branch = afterVerb?.split("/")[0] ?? null;
    type =
      verb === "tree" ? "branch tree" : verb === "blob" ? "file blob" : verb;
  } else if (verb) {
    type = verb;
  }

  return { owner, repo, branch, type };
};

module.exports = {
  parseGitHubUrl,
  getRepoDetails,
  getRepoFileTree,
  fetchFileContents,
  fetchSingleFile,
  getDefaultBranch,
};
