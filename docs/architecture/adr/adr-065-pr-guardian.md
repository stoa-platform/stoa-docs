---
title: "ADR-065: STOA PR Guardian — Advisory AI Review on GitHub Actions"
description: "Establishes an advisory-only PR review automation built on GitHub Actions + a versioned Claude Code skill + a separated policy pack. Binary GO/NO-GO verdict with confidence, fail-visible not fail-silent, no merge gate."
keywords: [pr-review, ai-factory, github-actions, claude-code, policy, advisory, quality-gate]
---

# ADR-065: STOA PR Guardian — Advisory AI Review on GitHub Actions

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Date** | 2026-04-16 |
| **Decision Makers** | Christophe, Claude Code |
| **Linear** | (to be filed) |

### Related Decisions

- **ADR-012**: MCP Tools Architecture — RBAC & Multi-Tenant Governance (scope enforcement the Guardian verifies)
- **ADR-041**: Plugin Architecture — Community Core vs Enterprise Extensions (boundary the Guardian flags)
- **ADR-055**: Portal/Console Governance (Producer/Consumer split the Guardian enforces on Portal code)
- **ADR-061**: Council Multi-Stage Review (pre-ticket and pre-merge human/AI review — complementary, not overlapping)

## Context

Roughly 85% of STOA code lands via AI co-authoring. Human reviewers already carry a wide surface (3 stacks, ~70 tickets per cycle, multi-repo). Recurring review burdens keep landing on them:

1. **ADR drift** — code silently crosses Portal/Console lines (ADR-055), Community/Enterprise lines (ADR-041), or bypasses declared RBAC scopes (ADR-012). These are cheap to spot but only if someone remembers to look.
2. **Security regressions** — hardcoded secrets in fixtures, auth decorators forgotten on a new route, unsafe deserialization patterns (cf. webMethods JSONPath single-item array bug) that pass tests but leak at runtime.
3. **AI code smell** — dead code, single-call helper wrappers, duplicated logic across files, WHAT-not-WHY comments, swallowed exceptions. Each one is trivial; ten per week is a tax.

None of these need a human on the first pass. They need a checklist that never forgets. But the review must stay *advisory* — the moment it blocks merge, contributors work around it, and the checklist becomes a lie.

We already run `claude-review.yml` (ADR-060, `/review` skill, Haiku, Ship/Show/Ask classification). It is useful but generic — one prompt, one verdict, no axis separation, no ADR cross-reference, no Slack escalation. The Guardian is a **different shape**: three explicit axes, binary GO/NO-GO, idempotent comments, fail-visible.

### Why not Anthropic Routines

Routines ship Claude workflows as a managed product: scheduling, auth, state, retries handled by Anthropic. Valid tool — we use it elsewhere. Wrong fit here:

| Concern | GitHub Actions | Routines |
|---|---|---|
| Audit trail for DORA/compliance | Native (workflow runs, logs, artifacts, signed commits) | External dashboard, separate export |
| Portability to self-hosted STOA installs | Runs on any Actions-compatible runner | Requires Anthropic tenancy |
| Policy evolution velocity | `git diff` on `docs/ai/pr-guardian-policy.md` | UI-driven, no PR review on policy changes |
| Scale across repos (stoa, stoa-docs, stoa-web…) | Drop-in workflow per repo | Per-repo setup + per-run cost |
| Kill-switch | Repo variable, instant | Config change, delayed propagation |

Framing: *fitness for purpose*. Routines are the right answer when you want managed scheduling + managed state for a single tenant. We want an advisory gate that is versioned, auditable, forkable, and self-hostable. That is GitHub Actions.

### Non-overlap with `claude-review.yml`

| Dimension | `claude-review.yml` (existing) | PR Guardian (new) |
|---|---|---|
| Purpose | Generic Ship/Show/Ask on diff quality | Structured checklist on ADR / SEC / SMELL |
| Verdict | Ship \| Show \| Ask + Low/Medium/High | Binary GO / NO-GO + confidence |
| ADR awareness | None | Loads ADR-012, ADR-041, ADR-055, dynamic |
| Escalation | PR comment only | Slack `#stoa-reviews` on NO-GO |
| Idempotence | New comment on each run | Single edited comment via HTML marker |
| Policy surface | Inline prompt | External `docs/ai/pr-guardian-policy.md` |

Both run advisory, both skip Dependabot/forks/drafts, both use Sonnet or smaller. They complement — review covers breadth (reviewer vibe), Guardian covers depth (checklist never forgets). No plan to retire `claude-review.yml`.

## Decision

**Ship an advisory-only PR Guardian as four separated artefacts.**

### 1. GitHub Actions workflow — `.github/workflows/pr-guardian.yml`

- Trigger: `pull_request` events `opened`, `ready_for_review`, `synchronize`.
- Concurrency: `guardian-<PR#>`, `cancel-in-progress: true`. Resync replaces in-flight runs.
- Kill-switch: repo variable `DISABLE_PR_GUARDIAN=true` (same pattern as `DISABLE_CONTEXT_COMPILER`, `DISABLE_L1_REVIEW`).
- Skip conditions: author matches `*[bot]`, PR is draft, label `skip-guardian` or `wip`, fork PR (secrets protection).
- Diff guard: compute size via `gh pr diff --patch | wc -l` BEFORE invoking Claude. If over 1000 lines, post one comment "Diff too large — human review required" and exit 0.
- Idempotence: HTML marker `<!-- stoa-pr-guardian -->`. Workflow finds and edits the previous summary comment; does not spam on every resync.
- Failure mode: if Claude invocation fails, post "Guardian unavailable — PR not analyzed" AND alert Slack `#stoa-ops` (or channel behind `SLACK_WEBHOOK_GUARDIAN_ALERTS`). **Never silent.**
- Permissions: `pull-requests: write`, `contents: read`, `issues: write`. Nothing else.
- Model: Claude Sonnet 4.6 (CI policy, CLAUDE.md).

### 2. Versioned skill — `.claude/skills/pr-guardian/SKILL.md`

- Invocable locally as `/pr-guardian <PR#>` for policy tuning and historical PR replay.
- Owns the prompt, the three-axis review structure, and the verdict computation.
- Delegates stack detection, ADR loading, and Slack notification to sibling scripts.

### 3. Policy pack — `docs/ai/pr-guardian-policy.md`

Separated from the skill because the rubric evolves faster than the skill logic. Contains:

- Three review axes: `[ADR-XXX]`, `[SEC]`, `[SMELL]` with concrete examples.
- Verdict rules: any `[SEC]` → NO-GO; ≥ 3 `[ADR]`+`[SMELL]` combined → NO-GO; otherwise GO.
- Confidence rules: full analysis = high; partial ADR load or mixed stack = medium; ADR fetch failed or diff near 1000-line cap = low.

Editing the policy is a PR against one file. Any team member can propose a rubric change without touching the skill or the workflow.

### 4. Runbook — `docs/ai/pr-guardian-runbook.md`

Operational surface: kill-switch procedure, per-PR skip label, local invocation for testing, known failure modes, log inspection, policy iteration. Not the place to explain *why* — that is this ADR.

### Hard rules (enforced in skill prompt)

- Never approve a PR. Never request changes via GitHub API. Comment only.
- Signal risk, explain why, suggest optional fixes. Do not prescribe.
- Terse comments, max 4 lines each, no preamble, no emoji, no `TODO` follow-ups injected into reviewed code.
- English in GitHub comments. French allowed in Slack alert if that matches team convention.

## Alternatives Considered

### Option B — Anthropic Routines

Managed scheduling + managed state for the Guardian prompt. Rejected for reasons above (portability, audit trail in repo, policy PR review, self-hosted parity).

### Option C — Merge-blocking required check

Configure branch protection to require Guardian check before merge. Rejected because:
- Forces contributors to bypass on false positives (policy drift becomes policy fiction).
- Turns an advisory signal into a hard gate without human calibration period.
- Contradicts the "fail-visible, not fail-closed" rule from ADR-061 Stage 3.

Re-evaluate after two sprints of advisory data (false positive rate, NO-GO acceptance rate). No target date.

### Option D — Extend `claude-review.yml` with axes

Add ADR-awareness and three-axis output to the existing workflow. Rejected because:
- Conflates two different feedback shapes (generic vibe check vs structured checklist).
- Single prompt becomes a 400-line monolith that nobody edits.
- Loses the policy/skill separation that lets non-coders propose rubric changes.

### Option E — Single-artefact workflow with embedded prompt

Ship everything in one YAML file. Rejected because the prompt is ~200 lines; inlining kills diff review on policy edits and prevents local skill invocation for replay.

## Consequences

### Positive

- **Advisory only, low social cost.** Contributors see a signal, not a block. No workaround culture.
- **Binary verdict + confidence** is readable in < 5 seconds. Reviewers skim, act, move on.
- **Fail-visible** means Guardian outages never hide. No ghost state where PRs land unreviewed.
- **Policy pack is a PR away** — rubric drift requires review like any other change.
- **Portable**: forks and self-hosted installs run the same Guardian without Anthropic tenancy.
- **Auditable via `git log` + GitHub Actions logs** — sufficient for DORA + compliance.

### Negative

- **Token cost** — every PR resync hits Sonnet. Mitigated by concurrency-cancel, bot-author skip, 1000-line diff guard, draft skip.
- **False positives on early policy** — expected. Mitigated by advisory-only mode: contributors ignore noise without workflow pressure.
- **Duplicate signal** with `claude-review.yml` until we consolidate. Acceptable for the advisory phase; consolidation is a follow-up.

### Neutral

- Does not change merge rules, branch protection, or CODEOWNERS.
- Does not consume RBAC scopes — workflow runs with GITHUB_TOKEN, posts comments only.
- Existing `/review` and `/parallel-review` skills unaffected.

## Rollout Plan

**Phase 1 — Advisory (from merge).** Workflow runs on every non-bot, non-draft, non-fork PR. Comments posted, Slack alerts on NO-GO. No merge gate. Collect 2 sprints of signal quality data.

**Phase 2 — Calibration.** Review false-positive rate and NO-GO acceptance rate. Tune policy pack. Decide whether to promote to required check, keep advisory, or retire.

No date on Phase 2. It starts when Phase 1 has enough signal.

## Compliance

- No impact on RBAC (ADR-012) — Guardian reads, does not write.
- No impact on Community/Enterprise boundary (ADR-041) — Guardian flags violations, does not create them.
- Aligns with ADR-055 Portal/Console boundary as an enforcement surface.
- Aligns with ADR-061 Council Stage 3 philosophy (advisory, axis-based, fail-visible).

## References

- `claude-review.yml` — existing generic PR review workflow
- `docs/ai/pr-guardian-policy.md` — the rubric applied by the Guardian
- `docs/ai/pr-guardian-runbook.md` — operational procedures
- `.claude/skills/pr-guardian/SKILL.md` — skill source and local invocation
