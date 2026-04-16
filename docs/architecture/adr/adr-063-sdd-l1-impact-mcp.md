---
title: "ADR-063: SDD Level 1 + stoa-impact MCP knowledge agent"
sidebar_position: 63
---

# ADR-063: SDD Level 1 + stoa-impact MCP knowledge agent

- **Status**: Accepted (trial window, review 2026-04-30)
- **Date**: 2026-04-16
- **Deciders**: Christophe, Claude Code
- **Relates to**: ADR-061 (Council multi-stage review), ADR-062 (CLAUDE.md hierarchy)
- **Parent ticket**: [CAB-2066](https://linear.app/hlfh-workspace/issue/CAB-2066) (split from CAB-2059 after Council S1bis 8.00/10)

## Context

Two operational gaps slowed MEGA execution through Q1 2026:

1. **No shared spec surface for MEGAs.** Acceptance criteria, sub-tasks, and
   dependency order were scattered across Linear comments, `plan.md`, commit
   messages, and ad-hoc docs. Resuming a MEGA mid-flight required reading
   five places to reconstruct "what is done, what is next, when is it done."
2. **Impact DB accessible only via shell.** `docs/stoa-impact.db` carries the
   dependency DAG, contracts, scenarios, and risks — but the only consumers
   were `docs/scripts/*.sh`. Subagents without Bash permission (the default
   for `security-reviewer`, `docs-writer`, `content-reviewer`,
   `competitive-analyst`, `verify-app`, `k8s-ops`) could not use it, so they
   fell back to `grep` and missed structured relationships.

Spec-Driven Development (SDD) has three well-known levels of adoption:

- **L1** — structure only. A convention + templates, no tooling enforcement.
- **L2** — spec-anchored. CI lints code against the spec.
- **L3** — spec-as-source. Codegen from spec.

Both [github/spec-kit](https://github.com/github/spec-kit) (v0.7.1, MIT, 88K
stars) and [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) (v3.0.2, MIT,
3K stars) target L2–L3 use cases but can be mined for L1 templates alone.

## Decision

### 1. Adopt SDD Level 1 only

- Add a lightweight `.sdlc/` convention at the repo root: `context/`
  (architecture + conventions pointers, no duplication of `CLAUDE.md`),
  `templates/` (requirement + task), `specs/` (one directory per formalized
  MEGA).
- **Pin cc-sdd v3.0.2** as the template inspiration. Borrow the frontmatter
  state-machine (`pending → in_progress → done`) from it. **Do not install
  the CLI.** STOA is Claude-Code-only; the CLI's multi-agent surface is
  unused.
- **Opt-in per MEGA.** A MEGA without a `.sdlc/specs/MEGA-<ID>/` entry is
  still valid. Adoption is measured over two weeks.

### 2. Expose `stoa-impact.db` via a local MCP server

- New file: `docs/scripts/stoa_impact_mcp.py`.
- **Pure Python stdlib** (no `@modelcontextprotocol/sdk` dep) — matches the
  existing "manual JSON-RPC protocol" pattern used by `hegemon-mcp` and
  `stoa-gateway`, and keeps the server trivially runnable on any dev
  machine with Python 3.11+.
- **JSON-RPC 2.0 over stdio** (not HTTP/SSE) — aligns with the invocation
  model already used by `linear`, `playwright`, and `context7` in
  `.mcp.json`.
- **Read-only by construction**: `sqlite3.connect("file:...?mode=ro", uri=True)`.
  Writes fail at the driver layer, not at the application layer. Validated
  by a regression test.
- **No raw-SQL tool**. Eight purpose-built tools with parameterized queries
  and `additionalProperties: false` on every input schema:
  - `list_components`, `get_component`
  - `get_contracts` (direction: in / out / both)
  - `get_impacted_scenarios`, `get_risks`
  - `get_dependency_matrix`, `get_untyped_contracts`,
    `get_component_risk_score`
- Register in `.mcp.json` as a local `command: python3` entry.

### 3. Kill-criteria

The L1 convention and the MCP server ship together but are evaluated
independently on **2026-04-30**. Kill triggers are recorded in
`.sdlc/KILL-CRITERIA.md` in the `stoa` repo:

- Zero real MEGA (excluding the dogfood CAB-2066 spec) formalized in
  `.sdlc/specs/` within 14 days.
- Spec drift: a shipped MEGA whose `.sdlc/` entry no longer matches Linear
  or the merged code, with no reconciling commit.
- Two distinct contributor complaints about duplication.
- MEGA cycle-time regression > +10% over the trial window.

If any trigger fires, `.sdlc/` is removed in one commit and this ADR is
marked **Superseded / Rejected** with a post-mortem note.

For the MCP server, a separate kill signal: if the server causes CI churn
(flaky tests, perf regression in `build-context.sh`-based hooks) or if the
delta vs `impact-check.sh` turns out to be < 5× ergonomic improvement for
non-Bash subagents, remove the `.mcp.json` entry and delete the module.

## Rationale

- **L1 before L2.** We have no data that formalized specs are worth the
  write cost for this team. Starting at L2 (spec-anchored CI) risks
  locking in a convention nobody uses.
- **Templates over tooling.** `cc-sdd` and `spec-kit` both assume an
  `@agent` CLI surface. STOA already has a standardized Claude Code entry
  point; adding a second CLI layer would fragment muscle memory.
- **cc-sdd over spec-kit.** spec-kit is larger (88K stars) and
  Microsoft-backed, but targets multi-agent codegen (L2–L3). cc-sdd is
  smaller, Claude-native, and its template frontmatter is closer to what
  we need for L1. Both are MIT; licensing is a wash.
- **MCP over shell for subagents.** `impact-check.sh` takes ~30ms;
  equivalent MCP calls take ~40ms. Latency is a non-factor. The real win
  is that subagents without Bash (security-reviewer, docs-writer,
  content-reviewer) can now use the impact graph. The delta is not
  performance — it is reach.
- **Pure stdlib server.** The official `mcp` Python SDK exists but is not
  already in use. Adding a dep for a ~400-line local tool is not worth
  it. The JSON-RPC 2.0 surface the spec requires is trivial to hand-roll
  and has better cache/startup behavior than an SDK-wrapped server.
- **No write-path MCP tool.** The impact DB has one writer
  (`populate-db.py`) and an append-only learning script
  (`post-change-learn.sh`). Exposing any write surface via MCP would break
  that invariant and open the door to LLM-authored schema drift. Hard no.

## Consequences

### Positive

- **Subagents gain structured impact queries.** Security and docs reviews
  now cite component + scenario relationships instead of eyeballing
  `grep` output.
- **Spec dogfood.** CAB-2066 itself is the first formalized MEGA under
  `.sdlc/specs/MEGA-CAB-2066/` — four tasks with a state machine.
- **No net new deps.** The server is stdlib-only; the convention is
  markdown-only.
- **Kill path is cheap.** Removing `.sdlc/` or the MCP entry is a
  single-commit operation with no runtime-infra impact.

### Negative / risks

- **Documentation debt if unused.** If the convention dies, the four
  template files and the kill-criteria are dead weight for the
  ~2-week trial window. Mitigated by the hard review date.
- **MCP error messages are now opaque.** Per the security review,
  SQL-layer errors are logged to stderr and replaced with generic client
  strings. Debugging a malformed query now requires reading the MCP
  server's stderr, not the tool call output. Acceptable for a local
  tool.
- **Python 3.11+ required on any machine that wants to use the MCP
  server.** Already the baseline for `cli/` and `control-plane-api/`, so
  no new constraint.

## Alternatives considered

### A. Adopt spec-kit fully (L2)

- Install `specify` CLI, run spec-anchored checks in CI.
- **Rejected.** No evidence teammates write specs first today; L2 locks
  in an unvalidated habit. Revisit after L1 trial.

### B. Pure Python MCP SDK (`mcp` on PyPI)

- Use the official SDK for schema + transport.
- **Rejected.** Adds a dep for < 200 non-SDK LOC. Dep churn risk. The
  SDK also defaults to HTTP/SSE, which doesn't match the stdio-based
  local-server pattern already in `.mcp.json`.

### C. Rust MCP server matching `hegemon-mcp` pattern

- Match the existing Rust Axum custom-protocol pattern for consistency.
- **Rejected.** `hegemon-mcp` uses HTTP/SSE for cross-service access;
  this tool is stdio-local. Rewriting in Rust for consistency doubles
  the implementation effort with zero user-visible benefit.

### D. Expose the DB as a read-only endpoint on the gateway

- Add a gateway route that serves the DB as JSON.
- **Rejected.** The impact DB is a dev-time artifact. Exposing it through
  a production-path gateway conflates two very different operational
  tiers.

### E. Skip the MCP entirely — add more `docs/scripts/*.sh`

- Write more shell wrappers for common queries.
- **Rejected.** Does not unlock non-Bash subagents, which was the
  motivating constraint.

## Review

- **Review date**: 2026-04-30.
- **Owner**: @PotoMitan.
- **Artifacts to inspect**: `.sdlc/specs/` (count of real MEGAs
  formalized), `.mcp.json` (still present?), grep for
  `stoa_impact_mcp` calls in session logs (usage signal), Linear
  cycle-time dashboard.

## References

- Linear MEGA: [CAB-2066](https://linear.app/hlfh-workspace/issue/CAB-2066)
- Parent Council validation: CAB-2059 S1bis 8.00/10
- Unblocked by: CAB-2065 (Agent Teams canary Go, 2026-04-16)
- Repo artifacts: `.sdlc/`, `docs/scripts/stoa_impact_mcp.py`, `.mcp.json`
- Related ADRs: ADR-061 (Council multi-stage), ADR-062 (CLAUDE.md hierarchy)
