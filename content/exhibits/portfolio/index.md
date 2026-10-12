---
title: This portfolio, built the way I'd build it at work
hook: A hockey puck, a rink, and a repo where every decision has a paper trail.
summary: |
  What you're steering through is a small 3D world — a low-poly puck on a rink, built with React
  Three Fiber and Rapier. The puck is the fun part; the point is how it was made. Before any code
  existed I spent an evening being interviewed by the agent until the design had no open branches,
  then froze a spec with acceptance criteria. Claude Code implemented ticket by ticket on its own
  branch. A second AI session with no shared context reviewed every PR. CI gates — lint, types,
  tests, secret scan — decided what counts as green; I decided what gets merged. Every non-obvious
  choice, from the physics engine to how the ice should feel to where the site is hosted, is an ADR
  in the repo. So is the workflow guide itself, versioned right next to the code it produced. If the
  process drifted, the diff would show it.
role: "Owner: intent, decisions, review, merge. Agents: implementation and first-pass review."
tech:
  - TypeScript
  - React Three Fiber
  - Rapier
  - Vite
  - GitHub Actions
  - Claude Code + mattpocock/skills
year: "2026"
links:
  - label: Repository
    url: https://github.com/cov1983/portfolio
  - label: Workflow guide
    url: https://github.com/cov1983/portfolio/blob/main/docs/workflow-guide.md
images:
  - src: workflow-one-page.png
    alt: Flowchart of the six-phase development workflow, from Seed and Align through Plan, Build loop, Deliver and Operate, with the Build loop highlighted.
whatIdDoDifferently: |
  Written after increment one ships — the honest answer needs a finished increment behind it.
visibility: personal
---
