<div align="center">

# Repo Visualizer

### AI-Powered Code Dependency Graph for GitHub Repositories

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![D3.js](https://img.shields.io/badge/D3.js-Force%20Graph-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Paste a GitHub URL → Get an interactive force graph → AI explains every file**

[Features](#-features) · [Demo Tabs](#-pages--navigation) · [Setup](#-local-setup) · [API](#-api-reference) · [Shortcuts](#%EF%B8%8F-keyboard-shortcuts)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#-tech-stack)
- [Pages & Navigation](#-pages--navigation)
- [Features](#-features)
  - [Core — Dependency Graph](#core--dependency-graph-analyzer)
  - [AI Q&A](#ai-feature-1--natural-language-codebase-qa)
  - [AI Bug Detector](#ai-feature-2--bug--code-smell-detector)
  - [Visual Analysis](#visual-analysis-analyzervisual--features-14-11)
  - [Metrics Dashboard](#metrics-dashboard-analyzermetrics--features-58)
  - [Developer Tools](#developer-tools-analyzertools--features-9-10-1215)
- [Project Structure](#-project-structure)
- [Local Setup](#-local-setup)
- [Environment Variables](#-environment-variables)
- [Getting API Keys](#-getting-api-keys)
- [API Reference](#-api-reference)
- [Keyboard Shortcuts](#%EF%B8%8F-keyboard-shortcuts)
- [Notes](#-notes)

---

## Overview

Repo Visualizer parses any public GitHub repository and renders a **live, interactive dependency graph** using D3 force simulation. On top of the graph, two AI features (Q&A + bug review) and 15 zero-external-API client-side tools let you explore, audit, and document codebases without leaving the browser.

---

## 🛠 Tech Stack

<details>
<summary><strong>Click to expand full stack</strong></summary>

<br>

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, D3.js, acorn, highlight.js |
| Backend | Node.js 18+, Express.js |
| Auth | Clerk |
| Database | PostgreSQL via Prisma |
| AI — Q&A | Groq Llama 3.3 70B |
| AI — Review | Gemini 2.0 Flash / Groq fallback |
| GitHub API | Octokit |
| File storage | Cloudinary |

</details>

---

## 🗂 Pages & Navigation

After analyzing a repository, four tabs appear in the toolbar:

| Tab | Route | What's there |
|---|---|---|
| **Graph** | `/analyzer` | Force-directed dependency graph (original) |
| **Visual** | `/analyzer/visual` | 5 visual analysis modes |
| **Metrics** | `/analyzer/metrics` | Code metrics dashboard — 4 panels |
| **Tools** | `/analyzer/tools` | 6 developer productivity tools |

---

## ✨ Features

### Core — Dependency Graph (`/analyzer`)

<details>
<summary><strong>Force-directed graph powered by D3 + Babel AST</strong></summary>

<br>

Paste any GitHub URL and click **Analyze**. The backend fetches the repo tree, parses imports with Babel AST, and returns a force-directed graph.

| Interaction | What it does |
|---|---|
| Scroll / drag canvas | Zoom & pan |
| Hover a node | Highlights direct neighbors |
| Click a node | Opens file sidebar + triggers AI review |
| `Shift+Click` multiple nodes | Generates multi-file docs |
| Filter chips | Filter by file extension or architectural layer |
| **Impact Analysis** | Paste a git diff — see propagation risk across the graph |

</details>

---

### AI Feature 1 — Natural Language Codebase Q&A

<details>
<summary><strong>Ask questions about the repo in plain English</strong></summary>

<br>

Click **Ask AI** (bottom-right) to open the chat panel. The AI answers from your actual file contents and highlights relevant nodes in **amber** on the graph.

- **Model:** Groq Llama 3.3 70B
- **Endpoint:** `POST /api/ai/ask` (Server-Sent Events stream)
- **No token limit** — responses stream token by token

</details>

---

### AI Feature 2 — Bug & Code Smell Detector

<details>
<summary><strong>Per-file scoring: bugs, security issues, quick wins</strong></summary>

<br>

Click any node to trigger an AI review of that file. The panel shows:

- **Score** 0–100 (higher = healthier)
- Bugs & security issues found
- Code smells
- Quick-win suggestions

The node's ring changes color after review so you can track reviewed files visually.

- **Model:** Gemini 2.0 Flash (falls back to Groq)
- **Endpoint:** `POST /api/ai/review`

</details>

---

### Visual Analysis (`/analyzer/visual`) — Features 1–4, 11

<details>
<summary><strong>5 client-side graph analysis modes — no API calls</strong></summary>

<br>

| # | Mode | What it does |
|---|---|---|
| 1 | **Complexity Heatmap** | Colors nodes by cyclomatic complexity (green → red). Uses acorn AST. |
| 2 | **Dead Code Detector** | Grays out nodes with no incoming edges (zero imports). |
| 3 | **Circular Dependency Finder** | DFS cycle detection — red nodes + animated edges + sidebar listing each cycle chain. |
| 4 | **Dependency Depth Layout** | BFS tiered layout — tier 0 = entry point, tier 1 = direct imports, etc. |
| 11 | **Focus Mode** | Click a node, set hop count (1–5). Everything beyond N hops fades out. |

</details>

---

### Metrics Dashboard (`/analyzer/metrics`) — Features 5–8

<details>
<summary><strong>Code health panels built on D3 charts + GitHub commit history</strong></summary>

<br>

| # | Panel | What it does |
|---|---|---|
| 7 | **Language Breakdown** | Doughnut-style bar chart of file extensions. Click to filter graph. |
| 5 | **File Size Timeline** | D3 line chart of line count across last 20 commits. Red threshold at 300 lines. |
| 6 | **Churn Tracker** | Last 50 commits, counts file appearances. High churn = high risk (red/amber). |
| 8 | **Duplicate Code Detector** | Hashes function bodies with acorn. Flags identical functions across files. |

> Features 5 & 6 use your backend GitHub token — no frontend token needed.

</details>

---

### Developer Tools (`/analyzer/tools`) — Features 9, 10, 12–15

<details>
<summary><strong>6 productivity tools — all client-side, no extra API keys</strong></summary>

<br>

| # | Tool | What it does |
|---|---|---|
| 10 | **Search & Filters** | Real-time file search with extension filter chips. Press `/` to focus. |
| 9 | **Annotations** | Add sticky notes to any file. Persists to `localStorage`. Shareable via URL hash. |
| 12 | **Diff Viewer** | Side-by-side line diff of any two files with syntax highlighting + synchronized scroll. |
| 13 | **Keyboard Shortcuts** | Reference card for all keyboard shortcuts. |
| 14 | **Architecture Export** | Export graph as SVG or PNG (2× retina). Copy SVG to clipboard for Figma/Notion. |
| 15 | **Onboarding Path** | BFS reading order from any entry point. Export as markdown checklist. |

</details>

---

## 📁 Project Structure

<details>
<summary><strong>Click to expand directory tree</strong></summary>

<br>

```
repo-visualizer/
├── backend/
│   └── src/
│       ├── controllers/
│       │   ├── aiController.js        # Q&A streaming
│       │   ├── reviewController.js    # Bug/smell review
│       │   ├── impactController.js    # Change impact analysis
│       │   ├── docsController.js      # Documentation generation
│       │   └── githubController.js    # Graph analysis + file fetch + commits + churn
│       ├── routes/
│       │   ├── aiRoutes.js            # /api/ai/*
│       │   └── githubRoutes.js        # /api/github/*
│       └── services/
│           ├── astService.js          # Babel AST import parsing
│           ├── geminiService.js       # Gemini + Groq wrappers
│           └── githubService.js       # GitHub file fetcher (Octokit)
└── frontend/
    └── src/
        ├── lib/
        │   ├── astUtils.js            # Cyclomatic complexity, function hashing (acorn)
        │   └── graphAlgorithms.js     # Dead code, cycles, BFS depth, N-hop, onboarding
        ├── pages/
        │   ├── GraphView.jsx          # Graph tab (DependencyGraph + ImpactPanel)
        │   ├── VisualAnalysis.jsx     # Visual tab (features 1–4, 11)
        │   ├── MetricsDashboard.jsx   # Metrics tab (features 5–8)
        │   └── DeveloperTools.jsx     # Tools tab (features 9, 10, 12–15)
        ├── components/Github/
        │   ├── DependencyGraph.jsx    # D3 force graph
        │   ├── RepoAnalyzer.jsx       # Toolbar + tab nav + Outlet
        │   ├── AIChatPanel.jsx        # AI Q&A panel
        │   ├── BugReviewPanel.jsx     # AI bug review panel
        │   ├── ImpactPanel.jsx        # Change impact analysis panel
        │   ├── DocsPanel.jsx          # Multi-file documentation
        │   └── Sidebar.jsx            # File code viewer
        ├── hooks/
        │   └── useGraphHighlight.jsx  # Shared graph highlight context
        └── Routing/
            └── Routing.jsx            # React Router with nested analyzer routes
```

</details>

---

## 🚀 Local Setup

```bash
# 1. Clone
git clone https://github.com/<your-username>/repo-visualizer.git
cd repo-visualizer

# 2. Backend
cd backend
cp .env.example .env   # fill in your keys (see below)
npm install
npm run dev            # → http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

> **Requires Node.js 18+** for the native `fetch` API used in the backend.

---

## 🔐 Environment Variables

<details>
<summary><strong><code>backend/.env</code></strong></summary>

<br>

```env
NODE_ENV=development
PORT=5000

# Clerk auth
CLERK_SECRET_KEY=sk_test_...
SIGNING_SECRET=whsec_...
CLERK_WEBHOOK_SECRET=whsec_...

# GitHub — personal access token with repo scope
GITHUB_TOKEN=ghp_...

# AI — Q&A (required)
GROQ_API_KEY=gsk_...

# AI — Review (optional, falls back to Groq if omitted)
GEMINI_API_KEY=AIza...
```

</details>

<details>
<summary><strong><code>frontend/.env</code></strong></summary>

<br>

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

</details>

---

## 🔑 Getting API Keys

| Key | Where to get it | Free tier |
|---|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys | 14,400 req/day |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API Key | 1,500 req/day |
| `GITHUB_TOKEN` | GitHub → Settings → Developer Settings → Personal access tokens → `repo` scope | Free |
| `CLERK_SECRET_KEY` | [clerk.com](https://clerk.com) → Dashboard | Free |

---

## 📡 API Reference

<details>
<summary><strong>Click to expand all endpoints</strong></summary>

<br>

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/github/analyze` | Build dependency graph from a repo URL |
| `GET` | `/api/github/file` | Fetch single file content |
| `GET` | `/api/github/commits` | File commit history (Feature 5) |
| `GET` | `/api/github/churn` | Repo-wide commit churn (Feature 6) |
| `POST` | `/api/ai/ask` | Q&A chat — SSE stream |
| `POST` | `/api/ai/review` | AI bug/smell review — JSON |
| `POST` | `/api/ai/impact` | Change impact analysis |
| `POST` | `/api/ai/docs` | Documentation generation |
| `GET` | `/api/health` | Health check |

</details>

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Focus search bar (Tools → Search tab) |
| `F` | Focus mode on selected node (Visual tab) |
| `Esc` | Clear selection / close panels |
| `Ctrl+E` | Export graph as SVG |
| `?` | Open keyboard shortcuts reference card |

---

## 📝 Notes

- **Zero new external AI calls** — all 15 client-side features run in the browser or use your existing GitHub token via the backend.
- Complexity heatmap fetches files in batches of 5 to stay within GitHub rate limits.
- Churn tracker reads up to 50 commits (GitHub API page limit).
- Annotations live in `localStorage` and can be shared by encoding them into the URL hash.
