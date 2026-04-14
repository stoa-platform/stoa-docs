---
slug: how-we-built-ai-factory-ships-72-points-per-day
title: "AI Factory: How One Developer Ships 72 Story Points/Day"
description: "505 story points in 7 days with Claude Code, MCP integrations, and multi-instance coordination. The architecture behind our AI-powered dev workflow."
authors: [stoa-team]
tags: [ai, architecture, open-source, tutorial]
keywords:
  - ai factory software development
  - claude code productivity
  - ai agent software engineering
  - mcp ai development workflow
  - ai-assisted software development
  - ai pair programming at scale
  - autonomous ai coding agent
  - claude code multi-instance
  - ai development velocity
---
<!-- last verified: 2026-02 -->

**A single developer shipping 72 story points per day across 7 components, 22 PRs per week, with zero regressions on main.** This is not a theoretical exercise — it is the measured output of STOA Platform's AI Factory during Cycle 7 (February 9-15, 2026). This article explains the architecture, the coordination protocols, and the hard lessons that make it work.

If you are building an [MCP gateway](/blog/what-is-mcp-gateway) or any complex open-source platform, the patterns described here are directly reusable. They are not tied to STOA — we extracted them into a reusable pattern library (HEGEMON) that any project can adopt.

<!-- truncate -->

## The Problem: Solo Developer, Enterprise Scope

STOA Platform is an open-source API gateway with 7 major components: a Rust gateway, a Python control plane API, two React frontends (Console + Portal), a Go CLI, E2E tests, and Helm charts. The codebase spans ~50,000 lines across 4 languages.

Building this alone would take years with traditional development. The challenge is not writing code — Claude Code and similar AI coding agents handle that well. The challenge is **coordination**: how do you run 4 parallel AI instances without them stepping on each other? How do you maintain quality when code is generated at 10x speed? How do you keep a trunk-based workflow where main is always deployable?

The AI Factory is our answer. It is a set of rules, protocols, and automation that turns Claude Code from a single coding assistant into a **coordinated development team**.

## Architecture Overview

The AI Factory operates at 5 levels of autonomy:

```
Level 1: Interactive       — Claude responds to direct requests
Level 2: Scheduled         — Daily CI health checks, weekly audits
Level 3: Linear Pipeline   — Ticket → Council validation → PR → merge
Level 4: Self-Improving    — Weekly retrospective, rule updates
Level 5: Multi-Agent       — Parallel ticket implementation (experimental)
```

Levels 1-3 are in daily use. Level 4 runs weekly. Level 5 is used for MEGA tickets (20+ story points).

The key insight: **autonomy without governance is chaos**. Every level has a kill-switch (GitHub repository variable), a cost cap, and a human gate. The AI Factory is not "let the AI run wild" — it is a disciplined pipeline where AI agents operate within clearly defined boundaries.

## The 5 Pillars

### 1. Council Validation — The Quality Gate

Every feature, bug fix, or architecture decision above 5 story points must pass a **Council validation** before implementation begins. The Council is a 4-persona review that scores the proposal:

| Persona | Role | Focus |
|---------|------|-------|
| **Chucky** | Devil's Advocate | Risk, hidden complexity, scope creep |
| **OSS Killer** | VC Skeptic | Market value, competitive moat, ROI |
| **Archi 50x50** | Veteran Architect | Technical quality, maintainability, patterns |
| **Better Call Saul** | Legal/Compliance | Licenses, GDPR, competitive claims |

Each persona scores 1-10. Average >= 8.0 is an automatic Go. Between 6.0-7.9, adjustments are mandatory. Below 6.0, the proposal is rejected.

This is not theater. The Council has rejected proposals, forced scope reductions, and caught legal risks (like Anthropic ToS violations in our chat agent architecture design). It adds 5 minutes to the process and saves hours of wasted implementation.

The Council report is automatically posted to Linear (our project tracker) and becomes the ticket's context. When an AI instance picks up the ticket later, it has the full rationale, adjustments, and definition of done.

### 2. Ship/Show/Ask — The Merge Model

Not all changes need the same review level. Inspired by GitHub's internal model:

| Mode | When | Human Involvement |
|------|------|-------------------|
| **Ship** | Zero-risk (docs, config, deps) | None — merge immediately |
| **Show** | Low-risk (refactor, tests, style) | Merge first, review async |
| **Ask** | Any risk (features, security, DB) | Stop after PR, wait for human |

Claude Code determines the mode based on a decision matrix. A `.claude/rules/` config change is Ship. A new API endpoint is Ask. A test addition is Show.

This eliminates the bottleneck of "waiting for review" on trivial changes while ensuring human oversight on anything that matters.

### 3. Phase Ownership — Multi-Instance Coordination

This is the hardest problem. When you open 3 terminal windows, each running Claude Code on the same codebase, how do you prevent conflicts?

The answer is **file-based claims**. Each Claude Code instance generates a unique ID at startup (e.g., `t4821`) and claims work by writing to a JSON claim file:

```json
{
  "mega": "CAB-1290",
  "phases": [
    {
      "id": 1,
      "name": "API + Gateway",
      "tickets": ["CAB-1350", "CAB-1351"],
      "owner": "t4821",
      "claimed_at": "2026-02-16T14:05",
      "deps": [],
      "completed_at": null
    },
    {
      "id": 2,
      "name": "E2E Tests",
      "tickets": ["CAB-1352"],
      "owner": null,
      "deps": [1],
      "completed_at": null
    }
  ]
}
```

Rules:
- **First-claim-wins**: write PID, sleep 100ms, re-read, verify own PID still there
- **End-to-end ownership**: an instance that claims a phase finishes it entirely
- **Stale detection**: claims older than 2 hours with no active PID are auto-released
- **Phase chaining**: after completing a phase, the instance checks for the next unclaimed phase

This gives us parallel execution with zero coordination overhead. Instance 1 works on the API, Instance 2 works on the Gateway, Instance 3 writes docs — all simultaneously, all on separate branches, all merging independently to main.

### 4. State Files — The Shared Memory

AI instances are stateless by default. Each starts with a fresh context window. The state files bridge this gap:

| File | Purpose | Updated By |
|------|---------|-----------|
| `memory.md` | Sprint status, decisions, known issues | Every session |
| `plan.md` | Cycle-driven view synced from Linear | `/sync-plan` skill |
| `operations.log` | Append-only session traceability | Every session start/end |
| `checkpoints/` | Pre-merge snapshots for crash recovery | Before risky operations |

The `operations.log` is the crash recovery mechanism. Every session logs `SESSION-START` and `SESSION-END`. If a session crashes (context window overflow, network failure, user interrupt), the next session detects the missing `SESSION-END` and offers to resume from the last checkpoint.

This is not sophisticated distributed systems engineering. It is simple file-based coordination that works because the failure modes are predictable and the recovery is deterministic.

### 5. Binary Definition of Done — The Quality Floor

Every task has a 10-point checklist that must ALL pass. No partial credit:

1. Code compiles (zero errors)
2. Tests pass (zero failures)
3. No regressions (existing tests green)
4. Lint clean (zero new warnings)
5. Format clean (zero diffs)
6. No secrets (gitleaks scan)
7. PR created
8. CI green (3 required checks)
9. State files updated
10. Session logged

Component-specific checks add coverage thresholds (70% for Python, zero warnings for Rust clippy), and post-merge checks verify the full CD pipeline (CI on main, Docker build, pod update).

The key insight: **the AI will cut corners if you let it**. Without a binary DoD, you get code that "mostly works" with TODO comments, skipped tests, and unchecked edge cases. The DoD makes quality non-negotiable.

## The Numbers: Cycle 7 Results

| Metric | Value |
|--------|-------|
| **Duration** | 7 days (Feb 9-15, 2026) |
| **Story Points** | 505 completed |
| **Velocity** | 72 pts/day |
| **Issues Closed** | 44 |
| **PRs Merged** | 22 |
| **Components Touched** | 7 (gateway, API, console, portal, CLI, E2E, docs) |
| **Regressions on Main** | 0 |

Based on typical Scrum team estimates, a solo developer ships 5-10 story points per day and a team of 4-5 engineers ships 40-60 per sprint (2 weeks). The AI Factory achieves output in that team-level range with one person's oversight.

The velocity is not constant. Some days are 100+ points (parallel MEGA execution). Some days are 20 points (blocked on infrastructure or debugging). The 72 pts/day is the average across the full cycle.

### What Does 505 Points Look Like?

Cycle 7 included:

- **Rust gateway**: 559 tests (unit + integration + contract + E2E + resilience + security), reqwest 0.12 upgrade, circuit breaker, SSRF protection
- **Python API**: 528 new tests (coverage 53% to 72%), deployment lifecycle API, Kafka event bridge, auth completion
- **React Console**: 959 tests, 24 test files, deploy dashboard with rollback
- **React Portal**: 680 tests, 24 test files, consumer management, UAC subscriptions
- **Go CLI**: deploy create/list/get/rollback commands
- **E2E**: 5 deployment scenarios, 9 SaaS BDD scenarios
- **Infrastructure**: K8s production hardening, security jobs pipeline, arena performance optimization

Each of these was a separate PR, independently deployable, with its own tests and CI verification.

## Hard Lessons

### 1. Context Window is the Real Bottleneck

AI coding agents are limited by context window, not speed. A Claude Code session that tries to hold the entire codebase in context degrades after ~60% usage. The solution: **aggressive delegation**.

Research goes to `Explore` subagents (haiku model, cheap). Test writing goes to `test-writer` subagents (sonnet). Security review goes to `security-reviewer` (read-only, can't break anything). The main session stays lean and focused on coordination.

### 2. Rules Beat Prompts

Early versions of the AI Factory used long system prompts. They were fragile — a single ambiguous instruction caused cascading errors. The current version uses **22 rule files** with `globs:` frontmatter that loads only relevant rules per file type. This saves ~5K tokens per session and makes each rule independently testable.

Rules are versioned in `.claude/rules/` and follow the same PR workflow as code. When a rule causes a problem, you fix it like a bug — not by rewriting a 2000-word prompt.

### 3. MCP Integrations Change Everything

The AI Factory connects to [Linear](/blog/connecting-ai-agents-enterprise-apis) (tickets), Cloudflare (DNS), Vercel (deploys), and n8n (automation) via MCP. This means Claude Code can:

- Fetch a ticket's Definition of Done before starting work
- Update ticket status to "Done" after PR merge
- Post a Council validation report as a Linear comment
- Check Vercel deploy status after a docs PR merge

This closes the loop between "AI writes code" and "AI manages the project." The AI Factory does not just generate PRs — it manages the full ticket lifecycle from backlog to production.

### 4. Trunk-Based Development is Non-Negotiable

Every experiment with long-lived branches failed. Merge conflicts accumulate exponentially when 3 AI instances work in parallel. The solution: **squash merge to main, always**. Each PR is under 300 LOC, independently deployable, and merged within hours of creation.

This means main is always deployable. It also means any instance can start from a fresh `git pull origin main` and know it has the latest code. No rebasing, no conflict resolution, no branch management overhead.

## What's Next: AI Factory v3

The current architecture (v2) works for a solo developer with 3-4 parallel instances. v3 adds:

- **Enriched checkpoints** with progress metadata for smarter crash recovery
- **Phase chaining** — instances auto-claim the next unblocked phase without restarting
- **L3 pipeline hardening** — Linear ticket to PR in one automated pipeline
- **Prompt context optimization** — reducing token waste across sessions

The AI Factory is open source. The rules live in `stoa/.claude/rules/`, the agents in `stoa/.claude/agents/`, and the reusable patterns in the HEGEMON pattern library. If you are building with Claude Code, Cursor, or any AI coding agent, these patterns are directly applicable to your workflow.

## Getting Started

If you want to try these patterns in your own project:

1. **Start with rules, not prompts**. Create `.claude/rules/` with focused rule files for your workflow.
2. **Add a Definition of Done**. A 10-point binary checklist prevents quality drift.
3. **Use state files**. `memory.md` + `operations.log` give your AI sessions continuity across context windows.
4. **Ship/Show/Ask from day one**. Classify every change by risk level. Ship the safe stuff automatically.
5. **Add Council for anything above trivial**. Even a simplified 2-persona review catches mistakes that cost hours to fix later.

The full AI Factory configuration is in the [STOA repository](https://github.com/stoa-platform/stoa/tree/main/.claude). For the broader context on MCP and AI agents, see [What is an MCP Gateway](/blog/what-is-mcp-gateway) and [Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis).

## FAQ

### How much does running the AI Factory cost?

Claude Code with Sonnet for subagents and Opus for main sessions. For reference, a typical day of parallel instance usage costs $50-80 in API calls for 3-4 parallel instances.

### Does this replace developers?

No. The AI Factory replaces the repetitive parts of development: boilerplate, test generation, lint fixes, PR creation, CI monitoring. The human (me) still makes all architecture decisions, reviews Ask-mode PRs, and handles anything the AI gets wrong. Think of it as a team where you are the tech lead and the AI agents are junior developers who never sleep.

### Can this work with other AI coding agents?

The patterns (rules, state files, phase ownership, Council) are agent-agnostic. The MCP integrations are specific to Claude Code's MCP support. The HEGEMON pattern library documents these patterns in a tool-neutral way.

### What happens when the AI makes a mistake?

The binary DoD catches most errors before merge. When something slips through, the post-merge CD verification catches it (pod health check, ArgoCD sync status). In 505 points of Cycle 7 output, we had zero regressions on main — not because the AI never made mistakes, but because the quality gates caught them before merge.

### How do you handle security?

The `security-reviewer` subagent runs on every code change. It is read-only (cannot modify code) and produces a binary Go/Fix/Redo verdict. Any P0 finding blocks the PR. Additionally, CI runs gitleaks (secrets), Bandit (Python SAST), clippy SAST (Rust), and Trivy (container scanning) on every PR.

> Product names mentioned in this article are trademarks of their respective owners. STOA Platform is not affiliated with or endorsed by any mentioned vendor.


---

## Ready to bridge your existing APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
