---
sidebar_position: 2
title: Implementation Review Loop
description: Standard Marchemalo - Code quality validation process for STOA Platform
keywords: [governance, review, quality, security, architecture]
---

# 🏛️ Standard Marchemalo — Implementation Review Loop

> **"No code in production without Council validation at 9+/10"**

## Overview

Every **significant** implementation ticket follows an iterative validation loop until achieving a score ≥9/10 from the Council.

### What is "Significant"?

A ticket is significant if it meets **both** criteria:
- ≥3 story points
- **AND** at least one of:
  - 🔒 Security-related
  - 💥 Breaking change
  - 🆕 New pattern (not yet in codebase)
  - 🏗️ Critical infrastructure

## The Review Loop

```
                    ┌──────────────────────────────────────────────┐
                    │              MAX 3 ITERATIONS                │
                    │         (then escalate/split)                │
                    ▼                                              │
┌─────────────────────────────────────┐                           │
│         STEP 1: Code Scan           │                           │
│                                     │                           │
│  • Scan existing structure          │                           │
│  • Identify patterns to follow      │                           │
│  • Produce implementation PLAN      │                           │
│  • Include proposed code            │                           │
│                                     │                           │
│  ⏱️ Timebox: 2h max                 │                           │
└──────────────────┬──────────────────┘                           │
                   │                                              │
                   ▼                                              │
┌─────────────────────────────────────┐                           │
│      STEP 2: Council Review         │                           │
│                                     │                           │
│  JUDGES (context-dependent):        │                           │
│  • Archi 50x50 (always)             │                           │
│  • Team Coca (if security)          │                           │
│  • OSS Killer (if scope/business)   │                           │
│  • Better Call Saul (if IP/legal)   │                           │
│                                     │                           │
│  ⏱️ Timebox: 1h max                 │                           │
└──────────────────┬──────────────────┘                           │
                   │                                              │
                   ▼                                              │
┌─────────────────────────────────────┐                           │
│      STEP 3: Verdict                │                           │
│                                     │                           │
│  Score = MINIMUM of all reviewers   │                           │
│  (not average - strictest wins)     │                           │
│                                     │                           │
│  Score < 9/10 + iteration < 3?      │                           │
│      → Corrections → Back to STEP 1 │───────────────────────────┘
│                                     │         LOOP
│  Score < 9/10 + iteration = 3?      │
│      → ESCALATE (see below)         │
│                                     │
│  Score ≥ 9/10?                      │
│      → STEP 4                       │
└──────────────────┬──────────────────┘
                   │
                   ▼ (Score ≥ 9/10 only)
┌─────────────────────────────────────┐
│      STEP 4: Implementation         │
│                                     │
│  Score 10/10:                       │
│    → Direct to prod, flag OFF       │
│                                     │
│  Score 9/10:                        │
│    → Prod with feature flag ON      │
│    → Enhanced monitoring 48h        │
│    → Post-deploy review             │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│      STEP 5: Capitalization         │
│                                     │
│  If new pattern validated:          │
│    → Create ADR                     │
│    → Add to Patterns Library        │
│                                     │
│  Always:                            │
│    → Log in review history          │
│    → Update metrics                 │
└─────────────────────────────────────┘
```

## Fast-Track (Security Hotfix)

For **critical security hotfixes** only:

| Criteria | Value |
|----------|-------|
| Conditions | Active CVE or ongoing breach, immediate prod impact |
| Process | Team Coca review ONLY |
| Threshold | ≥8/10 sufficient |
| Timebox | 4h max total |
| Follow-up | Full review within 48h post-deploy |

## Arbitration

### Reviewer Disagreement

**Rule: MINIMUM score prevails.**

```
Example:
  Archi 50x50:  9/10
  Team Coca:    7/10
  OSS Killer:   9/10

  → Final score = 7/10 (Team Coca)
  → Corrections required on Coca's points
```

### Deadlock (>24h without consensus)

1. Each reviewer presents arguments (5min each)
2. BDFL makes final decision
3. Decision documented in ADR
4. No appeal

### After 3 Iterations Without ≥9/10

| Option | Description |
|--------|-------------|
| **SPLIT** | Break ticket into smaller parts |
| **DEFER** | Postpone to next cycle with new scope |
| **BDFL** | Escalate for forced decision (rare) |

## Scoring Scale

| Score | Meaning | Action | Deployment |
|-------|---------|--------|------------|
| 10/10 | Perfect | ✅ Implement | Direct to prod |
| 9/10 | Excellent — minor risks identified | ✅ Implement | Prod + feature flag |
| 8/10 | Good — issues to monitor | ❌ Corrections | (Staging if fast-track) |
| 7/10 | Acceptable — significant issues | ❌ Corrections | — |
| <7/10 | Insufficient | ❌ Major rework | — |

## The Council

### Reviewers and Activation

| Reviewer | Activated if... | Focus |
|----------|-----------------|-------|
| **Archi 50x50** | ALWAYS | Patterns, consistency, maintainability |
| **Team Coca** | Tag `security` OR auth/crypto/input | Full security review |
| **OSS Killer** | New feature OR unclear scope | Business value, over-engineering |
| **Better Call Saul** | Tag `legal` OR IP/licensing/data | Compliance, legal risks |

### Minimum Composition

| Ticket Type | Required Reviewers |
|-------------|-------------------|
| Standard feature | Archi |
| Feature + security | Archi + Team Coca |
| Feature + new scope | Archi + OSS Killer |
| Security fix | Team Coca (fast-track possible) |
| Anything with IP/data | Archi + Better Call Saul |

## Reviewer Criteria

### Archi 50x50 (40 years XP)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| Patterns | 100% follows existing | 1 justified deviation | Inconsistent |
| Lifecycle | status + soft delete + audit | 1 minor missing | Major gaps |
| Config | Pydantic Settings | Acceptable mix | os.getenv everywhere |
| Tests | Unit + Integration + Edge | Unit + Integration | Insufficient |
| Docs | Docstrings + README | Docstrings | Nothing |

### Team Coca (Security Red Team)

Score = minimum of all 4 sub-reviewers.

#### Chucky (Crypto)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| Private key | Never stored/logged | — | Any violation |
| Entropy | Crypto secure | — | random() |
| X.509 extensions | All present | — | Missing |

#### N3m0 (Injection)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| Input validation | Regex + sanitize | Sanitize only | None |
| Injection tests | Complete parametrized | Basic | None |

#### Gh0st (Secrets)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| Logs | No secrets | Warning if debug | Secret in logs |
| Errors | Generic messages | — | Stack traces |

#### Pr1nc3ss (Access Control)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| RBAC | Complete + tested | Complete | Missing |
| Isolation | 404 (not 403) + tested | 404 | Info disclosure |
| Rate limit | Implemented | Documented TODO | Absent |

### OSS Killer (Skeptical VC)

| Criterion | 10/10 | 9/10 | <9/10 |
|-----------|-------|------|-------|
| Scope | Exactly the ticket | +1 nice-to-have | Scope creep |
| YAGNI | No "just in case" code | 1 future abstraction | Over-engineering |
| Business value | Clear and measurable | Clear | Vague |
| E2E Tests | Automated | Semi-auto | Manual curl |

## Review Template

```markdown
## Council Review — [TICKET-ID] [Title]

**Iteration:** X/3
**Date:** YYYY-MM-DD
**Activated Reviewers:** [Archi] [Coca] [OSS] [Saul]

### Scores

| Reviewer | Score | Blockers | Comment |
|----------|-------|----------|---------|
| Archi 50x50 | X/10 | 0 | ... |
| Team Coca | X/10 | X | ... |
| OSS Killer | X/10 | 0 | ... |

**Final Score: X/10** (minimum)

### P0 Corrections (Blocking for 9+)

1. [ ] ...
2. [ ] ...

### P1 Corrections (Recommended)

1. [ ] ...

### Verdict

- [ ] ✅ **APPROVED 10/10** — Direct to prod
- [ ] ✅ **APPROVED 9/10** — Prod + feature flag + 48h monitoring
- [ ] ❌ **REJECTED** — Corrections required (iteration X/3)
- [ ] 🚨 **ESCALATE** — 3 iterations reached, BDFL decision required

### Capitalization

- [ ] New pattern → Create ADR
- [ ] Existing pattern validated → Ref: ADR-XXX
```

## Metrics to Track

| Metric | Target | Alert if... |
|--------|--------|-------------|
| Avg review time | <1h | >2h |
| Avg iterations | <2 | >2.5 |
| 1st iteration approval rate | >30% | <20% |
| BDFL escalation rate | <5% | >10% |
| Review/code overhead | <30% | >50% |

## Anti-Patterns

| ❌ Forbidden | ✅ Alternative |
|--------------|----------------|
| "Good enough for MVP" | Simplify scope to reach 9+ |
| "We'll fix in v2" | Fix now or split ticket |
| "Time pressure" | Fast-track if truly critical |
| "It's just internal" | Same standard everywhere |
| "Tests later" | Tests in initial plan |
| "Review = overhead" | Review = quality investment |

## Applicability Matrix

| Type | Review Loop? | Reviewers |
|------|--------------|-----------|
| Feature ≥3pts + criterion | ✅ YES | Per tags |
| Feature ≥3pts simple | ⚠️ Light Archi | Archi only |
| Feature <3pts | ❌ Standard PR review | — |
| Security fix | ✅ Fast-track | Team Coca |
| Critical hotfix | ✅ Fast-track | Team Coca |
| Major refactor | ✅ YES | Archi + OSS |
| Config change | ⚠️ Per impact | Archi |
| Doc/typo | ❌ NO | — |

## Storage Locations

| What | Where |
|------|-------|
| This standard | `docs.gostoa.dev/governance/` |
| Review template | Linear (ticket template) |
| Review history | Notion (confidential, CIR) |
| Metrics | Grafana dashboard |
| ADRs | `docs.gostoa.dev/adr/` |
| Patterns Library | `docs.gostoa.dev/patterns/` |

---

## Changelog

### v1.1 (2026-01-28)

- Changed threshold from 10/10 to 9/10 (pragmatic)
- Added timeboxing: max 3 iterations
- Added arbitration: minimum score + BDFL escalation
- Added fast-track for security hotfixes
- Refined scope: ≥3pts AND (security OR breaking OR new pattern)
- Added capitalization: ADR + Patterns Library
- Added tracking metrics

### v1.0 (2026-01-28)

- Initial version
- Reviewed by OSS Killer (7/10) and Archi 50x50 (8/10)
- Did not pass its own test → v1.1 created
