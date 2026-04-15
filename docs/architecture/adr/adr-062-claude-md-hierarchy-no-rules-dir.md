---
title: "ADR-062: CLAUDE.md hierarchy replaces .claude/rules/"
sidebar_position: 62
---

# ADR-062: CLAUDE.md hierarchy replaces `.claude/rules/`

- **Status**: Accepted
- **Date**: 2026-04-15
- **Deciders**: Christophe, Claude Code
- **Supersedes**: implicit "rules dir" pattern (never formally recorded)

## Context

The `.claude/rules/` directory had grown to 31 files totaling ~3886 lines, all auto-loaded into every Claude Code session via the `globs:` frontmatter mechanism. Combined with the root `CLAUDE.md` (206 lines) and user-global `~/.claude/CLAUDE.md` (51 lines), every session started with ~4247 lines of auto-loaded context before the user even typed a prompt.

Observed pain:

- **Token cost**: ~12-15K tokens burned at session start regardless of task relevance. A docs-only fix paid the same tax as a cross-component MEGA.
- **Signal dilution**: critical GO/NOGO rules ("CI red = P0", "Council ≥ 8/10") drowned in protocol detail (full crash-recovery state machine, detailed Arena scoring formulas, gateway adapter method tables).
- **Drift risk**: rules frontmatter globs were aspirational — in practice nothing enforced which rules loaded when. Claude read them all.
- **Audit gap**: no clear boundary between "must always know" and "read when touching X".

## Decision

Replace `.claude/rules/` with a two-tier model:

1. **`CLAUDE.md` hierarchy** (root + per-service) — auto-loaded. Contains **only** binary GO/NOGO decisions, in imperative one-liners. Hard cap: 250 lines per file, enforced by `claude-md-budget-lint.sh` in CI.
2. **`.claude/docs/<topic>.md`** — never auto-loaded. Contains protocols, tables, examples, troubleshooting. Loaded on-demand when a skill/command references it or when Claude explicitly pulls it for a relevant task.

Per-service `CLAUDE.md` files live in:

- `/CLAUDE.md` (transversal rules)
- `stoa-gateway/CLAUDE.md` (Rust, gateway-specific)
- `control-plane-api/CLAUDE.md` (Python, adapters)
- `control-plane-ui/CLAUDE.md`, `portal/CLAUDE.md` (TS, tests)
- `charts/stoa-platform/CLAUDE.md` (K8s, Helm)
- `e2e/CLAUDE.md` (Playwright, audit protocol)
- `cli/CLAUDE.md` (stoactl)

A pre-commit hook (`.claude/hooks/block-rules-dir.sh`) blocks recreation of `.claude/rules/`.

## Rationale

- **94% context reduction** at session start (4247 → 257 lines).
- **Locality**: a Rust change loads Rust rules; it doesn't pay for SEO content rules.
- **Enforceability**: 250-line cap is a machine check, not a convention. Drift is caught in CI.
- **Clarity**: "GO/NOGO → CLAUDE.md, details → docs/" is a one-sentence rule anyone can apply.

## Consequences

### Positive

- Fresh sessions start lean. Delegation to subagents more efficient (they inherit less noise).
- Per-service `CLAUDE.md` is a natural home for team ownership (gateway team owns `stoa-gateway/CLAUDE.md`).
- `.claude/docs/` is browseable as reference documentation, independent of session loading.

### Negative

- **Duplication risk**: decisions in `CLAUDE.md` and their full protocol in `docs/` — if both drift, docs lie. Mitigated by: decisions are one-liners (hard to drift); docs are reference-only (rarely edited).
- **Discoverability**: Claude must know to read `.claude/docs/<topic>.md` when relevant. Mitigated by explicit pointers from `CLAUDE.md` sections and by skills referencing them.
- **Onboarding**: contributors used to browsing `.claude/rules/` must learn the new layout. Mitigated by the backup dir being preserved during transition and by this ADR.

### Neutral

- Per-service CLAUDE.md count can grow indefinitely — but 250-line cap per file prevents any single one from becoming the next `rules/`.

## Enforcement

| Layer | Mechanism |
|-------|-----------|
| Local | `.git/hooks/pre-commit` → `.claude/hooks/block-rules-dir.sh` (blocks `.claude/rules/` with any `.md` file) |
| CI | `.github/workflows/claude-md-budget.yml` → `scripts/ai-ops/claude-md-budget-lint.sh` (hard-fails on any `CLAUDE.md` > 250 lines) |
| Kill-switch | `DISABLE_CLAUDE_MD_BUDGET=1` env var (emergency only) |

## References

- Migration commit: `a2c47bd7` (refactor: nuke .claude/rules/ → CLAUDE.md per service + .claude/docs/)
- Backup: `.claude/rules-backup-20260415/` (removed after validation)
- Related: ADR-061 (Council multi-stage review) — the `council-s3.md` rule was migrated to `.claude/docs/` per this ADR
