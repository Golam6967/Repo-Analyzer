# PR Impact Analysis — How It Works & Roadmap to Production

## What This Feature Does

Given a Pull Request number, it answers two questions:

1. **Which files in the dependency graph does this PR touch?**
2. **Which other files will break or be affected because they import those files?**

No AI is involved. It is 100% graph algorithms + GitHub API data.

---

## How It Works (Technical Breakdown)

### Step 1 — Fetch PR data from GitHub (Backend)

File: `backend/src/controllers/githubController.js` → `getPRImpactController`

```
GET /api/github/pr-impact?repoUrl=<repo>&pr=<number>
```

Uses the **GitHub REST API via Octokit**:

- `octokit.rest.pulls.get(...)` — fetches PR title, author, state, branch names, total +/- lines
- `octokit.rest.pulls.listFiles(...)` — fetches every file changed in the PR with its status
  (`added` / `modified` / `removed` / `renamed`) and line counts

Results are **cached for 10 minutes** using `node-cache` to avoid burning GitHub rate limits.

No AI. No LLM. Just the GitHub API.

---

### Step 2 — Match changed files to graph nodes (Frontend)

File: `frontend/src/pages/PRImpactPage.jsx`

When you analyze a repo, `graphData.nodes` is built — each node has an `id` which is the
**file path relative to repo root** (e.g. `src/components/Button.jsx`).

GitHub's PR API also returns file paths relative to repo root.

So matching is a simple Set lookup:

```js
const nodeIds = new Set(nodes.map(n => n.id));

for (const file of pr.changedFiles) {
  if (nodeIds.has(file.filename)) {
    // matched — this PR change is in our graph
  }
}
```

Files that don't match (config files, assets, docs) are counted but shown separately.

---

### Step 3 — Compute blast radius via Reverse BFS (Frontend)

File: `frontend/src/pages/PRImpactPage.jsx` → `buildReverseAdj` + `getBlastRadius`

The dependency graph edges point **source → target** meaning "source imports target".

To find who will be *affected* by a change, we need to walk **backwards**:
"who imports the changed file?" and then "who imports those files?" and so on.

```
Normal edge:  A → B  (A imports B)
Reverse edge: B → A  (if B changes, A is affected)
```

**Algorithm:**

```js
// 1. Build reverse adjacency list
function buildReverseAdj(links) {
  const rev = {};
  for (const link of links) {
    const src = link.source?.id ?? link.source;
    const tgt = link.target?.id ?? link.target;
    if (!rev[tgt]) rev[tgt] = [];
    rev[tgt].push(src);
  }
  return rev;
}

// 2. BFS from changed nodes through reverse edges
function getBlastRadius(changedIds, links) {
  const rev = buildReverseAdj(links);
  const affected = new Set();
  const queue = [...changedIds];

  while (queue.length) {
    const id = queue.shift();
    for (const dependent of (rev[id] || [])) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);  // keep walking up the import chain
      }
    }
  }
  return affected;
}
```

This finds **every module in the codebase that transitively depends on any changed file**.

---

### Step 4 — Copy PR Comment

Generates a Markdown table formatted as a GitHub PR comment and copies it to clipboard.
No API call needed — just `navigator.clipboard.writeText(...)`.

---

## What Is NOT Happening (Common Misconceptions)

| What you might assume | What actually happens |
|---|---|
| AI reads the code changes | No — files are never fetched or read |
| LLM assesses risk | No — risk is purely structural (graph position) |
| It runs tests | No — it only checks import relationships |
| It reads git history | No — only the GitHub PR API is called |

The power is that **import relationships are a proxy for coupling**, and coupling is the real
risk factor in a code change. A file with 20 dependents is riskier to change than one with 0.

---

## What Would Make This the Ultimate Feature for Real Developers

These are the gaps between what exists now and what a team would actually pay for:

### Tier 1 — Quick wins (hours of work each)

**1. AI Risk Scoring via Groq (already available in this project)**

Currently the blast radius is a flat count. Add a call to Groq/Gemini that reads:
- The list of changed files + their diff size
- The blast radius count
- Whether any changed file is in a cycle (already detected in the graph)
- Whether changed files have high cyclomatic complexity (already computed)

And returns a **risk score (Low / Medium / High / Critical)** with a one-line reason.

```
"HIGH — Button.jsx has 14 dependents and is in a circular dependency.
Any interface change here will cascade across the entire UI layer."
```

This takes the feature from "interesting metric" to "actionable recommendation".

**2. Post PR comment directly to GitHub**

Right now you copy the comment and paste it manually. Add a GitHub OAuth scope
(`pull_requests: write`) and call:

```
POST /repos/{owner}/{repo}/issues/{pr_number}/comments
```

One button: "Post to GitHub". This is what makes it feel like a real tool,
not a prototype.

**3. Churn × Blast Radius = Danger Score**

The churn endpoint already exists (`GET /api/github/churn`). Cross-reference:
- Files that are **high churn** (changed often historically)
- AND have a **large blast radius** (many dependents)

These are the most dangerous files in the PR. Flag them with a red warning.

---

### Tier 2 — Makes it genuinely powerful (days of work each)

**4. Show the dependency path, not just the count**

Currently blast radius is a flat list. Developers want to know:
*"Why is `src/pages/Checkout.jsx` at risk? What's the import chain?"*

Show the path: `Button.jsx → Form.jsx → CheckoutForm.jsx → Checkout.jsx`

This requires BFS with parent tracking instead of just visited sets.

**5. Test coverage overlay**

Parse the repo's test files (files matching `*.test.*`, `*.spec.*`) and check if:
- Changed files have corresponding test files
- Blast radius files have test coverage

Show a badge: `✅ has tests` vs `⚠️ no tests`. A large blast radius with no tests = critical risk.

**6. GitHub Actions integration**

Create a GitHub Action that:
1. Triggers on `pull_request` event
2. Calls your backend `/api/github/pr-impact`
3. Posts the impact report as an automatic PR comment on every PR

This removes the manual step entirely and makes the tool invisible infrastructure.
Teams adopt tools they never have to think about.

**7. Breaking change detection**

Fetch the content of changed files (before and after), parse with acorn (already used
in `astUtils.js`), and compare exported function signatures.

If an exported function is renamed, has new required parameters, or is deleted —
that's a **breaking change** for all blast radius consumers. Flag it specifically.

**8. Historical impact tracking**

Store past PR impact analyses (PR number, blast radius size, risk score) in a database.
Over time you can answer: "Which files cause the most disruption when changed?"

This is genuinely useful for architecture decisions — it tells you where to invest
in decoupling.

---

### Tier 3 — Enterprise features (weeks of work)

**9. Slack notification**
When a high-risk PR is opened, ping the relevant team channel with the impact summary.

**10. Multi-repo blast radius**
For monorepos or microservices that share libraries, trace impact across repo boundaries.

**11. PR comparison**
"PR #45 vs PR #47 — which is safer to merge first?" Side-by-side blast radius comparison.

---

## Summary

| Layer | Current state | Ultimate state |
|---|---|---|
| Data source | GitHub PR API (file list only) | PR API + file content + test files |
| Analysis | Reverse BFS (structural) | BFS + AI risk score + churn correlation |
| Output | Clipboard markdown | Direct GitHub comment + Slack notification |
| Trigger | Manual (user visits page) | Automatic (GitHub Action on PR open) |
| Storage | None (stateless) | DB of historical impact scores |

The current implementation is the correct foundation. The graph + reverse BFS is the right
core algorithm — everything in Tier 1 and 2 builds on top of it without changing it.
