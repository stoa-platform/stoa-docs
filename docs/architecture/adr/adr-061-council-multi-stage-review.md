# ADR-061 — Council Multi-Stage Review System

**Status:** Accepted (S1+S2 live, S3 implementation in progress — CAB-2046)
**Date:** 2026-04-11
**Author:** Christophe (CAB Ingenierie)
**Parent Tickets:** CAB-2046 [MEGA] Council Stage 3 — Automated Code Review, CAB-2047 (CLI), CAB-2048 (pre-push hook), CAB-2049 (CI workflow), CAB-2050 (history rotation), CAB-2051 (shadow mode)

---

## Context

STOA's AI Factory runs up to five parallel Claude Code instances (backend, frontend, auth, mcp, qa) that generate, review, and merge code largely without human intervention. At scale, three classes of failure slip through a purely test-based gate:

1. **Wrong work** — an instance picks a ticket that is too vague, mis-scoped, or already obsolete, and spends hours building something that nobody needs.
2. **Wrong plan** — a plan is technically valid but conflicts with a recent architectural decision, misreads the blast radius, or ignores a compliance constraint.
3. **Wrong code** — the implementation passes lint, tests, and typecheck, but introduces subtle debt, widens the attack surface, breaks a cross-component contract, or violates a convention that no automated linter catches.

Lint, tests, and CodeQL are necessary but not sufficient. They detect syntactic and known-pattern issues; they do not evaluate *judgment*.

A naïve answer is "have a human review every PR." That does not scale when 5 parallel instances push 15-30 PRs per day, and it wastes the most expensive resource (Christophe) on PRs that an LLM could validate correctly 95% of the time.

**What we need**: a validation system that injects LLM judgment at the three decision points above — before work starts, before code is written, and before code is merged — at a bounded cost, with a clear kill-switch, and with reasoning visible to humans for audit.

---

## Decision

Implement a **3-stage Council system** where each stage gates the next. Stages 1 and 2 evaluate prose artifacts (tickets, plans) through an **8-persona LLM jury** (the canonical Team Coca set defined in `hegemon/patterns/validation/HEG-PAT-003`). Stage 3 evaluates code diffs through a 4-axis parallel LLM review via a CLI tool (`scripts/council-review.sh`).

```
┌──────────────────┐   ┌────────────────┐   ┌─────────────┐   ┌──────────────────┐
│ S1: ticket       │ → │ S2: plan       │ → │ implement   │ → │ S3: code review  │ → merge
│ pertinence       │   │ validation     │   │             │   │ (4 axes, diff)   │
│ (prose,          │   │ (prose,        │   │             │   │ (CLI,            │
│  8 personas)     │   │  8 personas)   │   │             │   │  parallel API)   │
└──────────────────┘   └────────────────┘   └─────────────┘   └──────────────────┘
```

Each stage emits a binary verdict: **Go** (proceed), **Fix** (apply adjustments, re-run), or **Redo** (reject, rewrite from scratch). A global score of ≥ 8.0/10 is required to Go.

### Stage 1 — Ticket Pertinence (live since C11; promoted to 8-persona jury via CAB-2054)

Invoked by the `/council` skill on a feature/ADR description *before* any work begins. The full 8-persona Team Coca jury (canonical set defined in `hegemon/patterns/validation/HEG-PAT-003`) evaluates the *ticket itself*:

| Persona | Role | Focus |
|---------|------|-------|
| **Chucky** (Devil's Advocate) | Penetration testing / risk | Risk, edge cases, failure modes, hidden complexity |
| **N3m0** (Webapp Security) | Frontend / UX / DX | A11y, exposed UI surfaces, keyboard flows, error message leaks |
| **Gh0st** (Supply Chain) | Dependencies / SBOM | Trusted-by-default deps, lockfile drift, transitive CVEs |
| **Pr1nc3ss** (Social Engineering) | Trust boundaries | Phishing vectors, bypass via human factors, error-message info leak |
| **OSS Killer** (VC Skeptic) | Market viability | Competitive moat, user value, ROI, me-too risk |
| **Archi 50x50** (Veteran Architect) | Technical quality | Coupling, scalability, pattern fit, tech debt |
| **Better Call Saul** (Legal/IP) | Legal/compliance | License, GDPR/DORA, competitive claims, disclaimers |
| **Gekk0** (Monetization / GTM) | Time-to-revenue | Pricing tier fit, monetization hook, sales enablement, GTM messaging |

Each persona returns a score /10 + verdict + specific *adjustments* to apply. The average is combined with the Context Compiler **Impact Score** modifier (LOW 0, MEDIUM 0, HIGH −0.5, CRITICAL −1.0) to produce a final score. Threshold: ≥ 8.0 → Go.

Persona names are pop-culture archetypes (Chucky = Child's Play, Gekk0 = Gordon Gekko / "Wall Street", Better Call Saul = Breaking Bad universe, etc.) used as internal aliases for the adversarial roles. They are not commercial trademarks.

Stage 1 catches: mis-scoped work, features with no measurable value, scope creep, unverified competitive claims, overly-vague acceptance criteria, supply-chain naivety, unmonetizable features, accessibility gaps. It runs in ~60 seconds (one Sonnet call per persona, parallelized by the Council skill).

### Stage 2 — Plan Validation (live since C11; promoted to 8-persona jury via CAB-2054)

Invoked by the same `/council` skill on a *completed implementation plan* (files to touch, steps, expected LOC, alternatives considered). Same 8-persona jury, same scoring, same adjustment loop — but the questions now focus on technical correctness of the plan, not pertinence of the work.

Stage 2 catches: files in the wrong component, steps with hidden ordering dependencies, LOC estimates off by 2-5×, alternatives that weren't considered, security holes in the proposed approach, breaking contract changes masquerading as refactors.

Plans scoring < 8.0 receive numbered adjustments that the plan author applies, then Stage 2 re-runs on the revised plan. Tickets labeled `ship-fast-path` (≤ 5 pts Ship-mode) skip Stage 2 entirely — the expected value of plan validation is lower than its cost at that size.

### Stage 3 — Automated Code Review (implementation in progress — CAB-2046)

Invoked *after* implementation on the actual git diff. Unlike S1/S2, Stage 3 is a **CLI tool** (`scripts/council-review.sh`), not a Claude skill. It runs four Anthropic API calls in parallel isolated subshells, one per axis, and aggregates their scores into a single verdict.

| Axis | Evaluates | Context Injected |
|------|-----------|------------------|
| **conformance** | Coding conventions, commit format, naming, dead code, TODO hygiene | Linear ticket title + description (read-only via `issueSearch`) |
| **debt** | Tech debt, duplication, dead code, complexity, borderline abstractions | Diff only |
| **attack_surface** | New endpoints, secret handling, SSRF, input validation, auth bypass | Trivy JSON report (best-effort) |
| **contract_impact** | Cross-component contracts, breaking API changes, schema drift | `docs/stoa-impact.db` extract — affected components + contracts |

Each axis is strictly isolated: a separate subshell, a separate tempfile, a separate system prompt loaded from `scripts/council-prompts/<axis>.md`. PIDs are captured incrementally (one assignment immediately after each `&`, not a single trailing `$!` — bash only returns the most recent background PID). A `wait` loop tallies failures and routes results to a pure `aggregate_scores` function that emits the verdict JSON.

**Stage 3 is wired to two enforcement points**:

1. **Pre-push hook** (CAB-2048) — runs on every `git push`. Blocks push if verdict is REWORK or error. Can be disabled locally via `DISABLE_COUNCIL_GATE=1` for emergencies.
2. **CI workflow** (`council-gate.yml`, CAB-2049) — runs on every PR. Status check, required for merge. Feature-flagged on `vars.COUNCIL_S3_ENABLED` for phased rollout (shadow mode first — CAB-2051).

### Hard guardrails (applied before any API call)

All three stages share five guardrails enforced by the CLI:

1. **`COUNCIL_DISABLE=1` kill-switch** — fast-path exit 0, no review. Redundant with CI feature flag and pre-push `DISABLE_COUNCIL_GATE`, but covers manual invocation.
2. **Daily cost cap** — `COUNCIL_DAILY_CAP_EUR` (default €5). Before each run, the CLI reads `council-history.jsonl`, sums today's `cost_eur`, and exits 0 (not 2) if the total is at cap. The intent is "skip review today", not "fail the PR".
3. **SHA dedup** — SHA1 of the full diff. Identical diffs in the same day (CI retries, cherry-picks, empty pushes) skip the review. Bypass: `COUNCIL_FORCE_DEDUP=0`.
4. **Gitleaks pre-flight (BLOCKING)** — the diff is scanned by `gitleaks` with `--exit-code 1` *before any API call*. Any leak → exit 2, no API traffic. This is the cheapest possible guard against exfiltrating secrets to Anthropic.
5. **Diff truncation** — 10 000-line hard cap on the diff sent to the model. Truncation is logged and recorded in the JSONL entry (`diff_truncated: true`).

Every run, whether APPROVED/REWORK/error/BYPASSED, appends one JSONL entry to `council-history.jsonl`:

```json
{
  "timestamp": "2026-04-11T17:39:01Z",
  "ticket": "CAB-2047",
  "status": "APPROVED",
  "global_score": 8.50,
  "axes_evaluated": 4,
  "db_fresh": true,
  "model": "claude-sonnet-4-5",
  "tokens": 3200,
  "input_tokens": 2800,
  "output_tokens": 400,
  "cost_eur": 0.014,
  "diff_lines": 142,
  "diff_truncated": false,
  "duration_ms": 18500,
  "diff_sha": "ab2a795c7ca0924f21cac2d606fde5666de17bb1"
}
```

This file is the authoritative cost ledger for the daily cap, the dedup cache, and the audit trail for security/compliance. It is gitignored (machine-local) and rotated at 500 lines by CAB-2050.

### Language choice: bash, not Python (Adj #12)

CAB-2047 Council S2 flagged the ~400-LOC size of the CLI as a bash red flag and asked explicitly whether Python would be better. The answer is bash, for four reasons:

1. **Consistency** with `scripts/ai-ops/ai-factory-notify.sh` (232 LOC) and `scripts/ai-ops/model-router.sh` (120 LOC) — all CI tooling is already bash.
2. **Zero new CI toolchain** — GitHub Actions runners have bash + jq + curl + gitleaks preinstalled. Python would add venv/pip/requirements to every CI run that invokes Council S3.
3. **Testable pure function** — the core logic (`aggregate_scores`) is a pure function over a tempdir of JSON files. It's trivially testable via bats-core against fabricated fixtures, without shell-injection risk.
4. **Cheap adversarial hardening** — shellcheck `-S style` catches most bash footguns. `set -euo pipefail`, explicit variable quoting, and whitelisted component-id regex (`^[a-zA-Z0-9_-]+$`) before any SQL interpolation cover the remaining cases.

Fragility risk is mitigated by the guardrails above, by shellcheck in CI, and by the MOCK_API fixture suite (`MOCK_API=1` short-circuits every API call to a local JSON fixture — enables fast, hermetic, zero-cost tests).

### Scoring rubric

All three stages use the same rubric. Each axis/persona returns an integer 1-10:

| Score | Verdict |
|-------|---------|
| 9-10 | Perfect or near-perfect. No blockers. |
| 8 | Acceptable. Minor non-blocking comments. **Minimum to Go.** |
| 6-7 | Fix required. Specific adjustments must be applied, then re-run. |
| 1-5 | Redo. The underlying approach is wrong; start over. |

The global score is the arithmetic average of the valid axes (S3) or the 8 personas (S1/S2), optionally adjusted by the Context Compiler Impact modifier. A stage Goes if the global score is ≥ 8.0 **and** no axis/persona individually returned a Redo.

### Cost model

| Stage | Trigger | Model | Typical cost | Frequency |
|-------|---------|-------|--------------|-----------|
| S1 | `/council` skill on ticket description | Sonnet 4.5 × 8 personas | ~€0.010 per run | 5-15/day |
| S2 | `/council` skill on plan | Sonnet 4.5 × 8 personas | ~€0.016 per run | 3-10/day |
| S3 | pre-push hook + CI on every diff | Sonnet 4.5 × 4 parallel axes | ~€0.03-0.06 per run | 15-30/day |

Expected steady-state daily cost: **€1-2/day** (well under the €5 cap). The CAB-2054 promotion from 4-persona to 8-persona S1/S2 jury added ~+€0.30-0.60/day (linear in jury size at constant prompt length), which stays well within the existing budget envelope. The cap exists as a circuit breaker for pathological loops (e.g., a CI retry storm), not as a budget target.

---

## Alternatives Considered

### A. Human-only review

**Rejected.** With 5 parallel instances pushing 15-30 PRs/day, this puts Christophe on a 2-hour review backlog and blocks the entire factory on one person's availability. It also wastes human judgment on PRs where an LLM would correctly approve 95% of them.

### B. Lint + tests only (no Council)

**Rejected.** This is the pre-Council baseline. It misses the three failure classes Council targets: wrong work, wrong plan, subtle code issues that syntactic tools cannot see. CAB-1944 shipped 5 regressions at mocked test boundaries that 5 700 passing tests did not catch — a Stage 3 check on the diff would have flagged the boundary mocking pattern.

### C. Single-stage Council (code review only)

**Rejected.** S3 alone catches bad code, not bad work. An instance that spends 6 hours implementing the wrong ticket will pass S3 easily (the code is clean) and waste the time. S1 and S2 catch failures hours to days earlier, when the cost of reversal is minimal.

### D. Local open-source LLM (no API calls)

**Rejected for now.** The quality gap between Sonnet 4.5 and self-hosted 8B-70B models on structured code review is still large (verified April 2026 — local models hallucinate blockers or miss real ones). API cost at €1-2/day is cheap compared to the engineering time lost to a bad merge. Revisit when local models close the quality gap or when API cost drives >€20/day.

### E. Python CLI for S3 (instead of bash)

**Rejected.** See "Language choice" above. Python was the default assumption coming out of Council S2, but the actual analysis favored bash on three of four dimensions (consistency, CI toolchain, hardening) and tied on the fourth (testability — bats-core matches pytest for pure-function tests).

### F. Single-axis S3 (conformance only)

**Rejected as the final target, but accepted as the MVP path.** Steps 1-3b of CAB-2047 shipped conformance-only as an intermediate gate while the orchestration was wired up. Step 3c completed the transition to all 4 axes. The single-axis fallback is preserved as a debug option via `COUNCIL_AXES_ONLY=conformance`.

---

## Consequences

### Positive

- **Three independent safety nets** against AI Factory regressions, each catching a different failure class.
- **Reasoning is visible.** Every Go/Fix/Redo comes with per-axis feedback and a list of adjustments. Humans auditing a merge can read the Council reasoning, not just the score.
- **Cost is bounded and observable.** `council-history.jsonl` gives exact cost-per-review, and the daily cap is a hard circuit breaker.
- **Kill-switches at every layer.** `COUNCIL_DISABLE`, `DISABLE_COUNCIL_GATE`, `vars.COUNCIL_S3_ENABLED`, `COUNCIL_FORCE_DEDUP=0` — any instance, CI workflow, or operator can disable any piece independently.
- **Shadow-mode rollout** (CAB-2051) de-risks production enforcement: S3 runs on every PR but its verdict is non-blocking for 2-3 weeks. We calibrate thresholds against real diffs before flipping the required-check flag.
- **Gitleaks pre-flight** prevents secret exfiltration to Anthropic, addressing the most acute privacy concern about LLM-based code review.
- **Canonical alignment with HEG-PAT-003** (CAB-2054). The S1/S2 jury is now exactly the 8-persona Team Coca canonical set defined in `hegemon/patterns/validation/HEG-PAT-003`. Drift between the canonical pattern and the implementation is eliminated, and the jury composition is auditable from a single source of truth.

### Negative

- **LLM judgment is not deterministic.** The same diff reviewed twice can score 8.1 and 7.9. We accept this; the threshold is an average over 4 axes (S3) or 8 personas (S1/S2). For S1/S2, doubling the jury from 4 to 8 personas reduces per-run variance by approximately √2 (law of large numbers), which more than offsets the additional per-call noise from the larger jury — the 8-persona average is therefore *more* stable than the previous 4-persona average, not less.
- **Prompt calibration is iterative.** Steps 4 and 5 of CAB-2047 will tune per-axis prompts against real diffs before S3 is enforced. Expect 2-3 rounds of prompt iteration in the first month.
- **Additional API dependency.** S3 depends on the Anthropic API being reachable from CI. Outages block merges. Mitigations: the daily cap is a soft skip (exit 0), the 30s timeout + 2 retries covers transient failures, and `COUNCIL_DISABLE=1` is always available.
- **Cost drift risk.** A runaway loop or a model price change could blow through the cap. The cap is the first line of defense; the second is a weekly audit of `council-history.jsonl`.

### Neutral

- **Bash maintenance cost.** The CLI is ~1 300 LOC of bash. Shellcheck and bats-core cover most of the risk, but a large refactor would still be more effort than in Python. We accept this trade because it's CI tooling that changes rarely.
- **MOCK_API fixtures drift.** Fixture JSONs must be updated when we change the `record_review` tool schema. Mitigations: schema is simple (score, feedback, blockers) and changes are rare; any drift shows up immediately in the MOCK_API test runs.

---

## Rollout Plan (CAB-2046 phases)

| Phase | Ticket | Description | Status |
|-------|--------|-------------|--------|
| 1 | CAB-2047 | `scripts/council-review.sh` CLI + 4 axes + bats tests + doc | In progress (Steps 1-3c merged, Step 4 next) |
| 2 | CAB-2048 | Pre-push hook extension — invoke council-review.sh locally | Blocked by CAB-2047 |
| 3 | CAB-2049 | `council-gate.yml` CI workflow + feature flag | Blocked by CAB-2047 |
| 4 | CAB-2050 | Rotation of `council-history.jsonl` (500-line rolling window) | Blocked by CAB-2047 |
| 5 | CAB-2051 | Shadow mode observation (2-3 weeks non-blocking) → flip to required | Blocked by CAB-2048 + CAB-2049 + CAB-2050 |

Enforcement becomes mandatory only after Phase 5 completes and shadow-mode data confirms calibration (false-positive rate < 10%, false-negative rate < 5% against a manual-review ground truth).

---

## Verification

- **S1/S2 coverage**: every new ticket with estimate ≥ 5 pts OR label `council-review`. Skill: `/council <description>`.
- **S3 coverage**: every `git push` (pre-push hook, local) AND every PR (CI, remote). Fail-closed once shadow mode ends.
- **Audit trail**: `council-history.jsonl` (local), Linear comments with `council:ticket-go` / `council:plan-go` labels for S1/S2, GitHub status check history for S3.
- **Cost observability**: weekly audit via `scripts/ai-ops/council-audit.sh` (CAB-2050 deliverable) — reports total runs, cost, verdict distribution, calibration drift.

---

## References

- CAB-2046 — `[MEGA] Council Stage 3 — Automated Code Review` (parent)
- CAB-2047 — `council-review.sh` CLI (13 pts, in progress)
- CAB-2048 — pre-push hook extension
- CAB-2049 — `council-gate.yml` CI workflow
- CAB-2050 — `council-history.jsonl` rotation
- CAB-2051 — Shadow mode observation
- CAB-2054 — Align Council S1/S2 to 8 personas per HEG-PAT-003 (this amendment)
- `hegemon/patterns/validation/HEG-PAT-003-team-coca-adversarial-validation.md` — canonical 8-persona Team Coca pattern (source of truth)
- `.claude/skills/council/SKILL.md` — S1/S2 runbook
- `.claude/rules/council-s3.md` — S3 runbook (CAB-2047 Step 4 deliverable)
- `scripts/council-review.sh` — S3 CLI implementation
- `scripts/council-prompts/{conformance,debt,attack_surface,contract_impact}.md` — per-axis system prompts (externalized in CAB-2047 Step 3a)
- ADR-050 — Guardrails, Token Budget, State Machine (Council first used here, score 7.25/10 Fix)
- ADR-056 — FAPI 2.0 Architecture (Council 8.13/10 Go)
- ADR-059 — Simplified Deployment SSE (Council 8.00/10 Go, CRITICAL impact)
- ADR-060 — AI-Verified UI Testing (complementary — Council validates judgment, ADR-060 validates visual output)

## Reviewers

| Role | Status |
|---|---|
| **Council S1** | 8.125/10 Go (on CAB-2046) — re-scored 8.5/10 Go on CAB-2054 amendment |
| **Council S2** | 8.5/10 Go (on CAB-2046, 13 adjustments applied) — re-scored 8.0/10 Go on CAB-2054 amendment (5 adjustments applied) |
| **Architect** | Christophe (CAB Ingenierie) |
| **Impact Score** | HIGH (20) — cross-component (CI, pre-push hook, scripts/), feature-flagged rollout, kill-switches at every layer. Amendment CAB-2054 is MEDIUM (~10) — docs-only, no runtime change |
