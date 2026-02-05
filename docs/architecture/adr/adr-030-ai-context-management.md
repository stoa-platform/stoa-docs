# ADR-030: AI-Native Context Management Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-05 |
| **Author** | Christophe Aboulicam + Claude Code |

## Context

STOA Platform is built exclusively with AI (Claude Code) in an "AI Factory" model where an architect supervises autonomous AI workers. Effective context management is critical: each Claude Code session starts fresh and must quickly load all necessary context to produce correct, consistent code.

### Current problems

1. **Duplication**: Two `CLAUDE.md` files (root and `.stoa-ai/`) contain conflicting information. The `.stoa-ai/CLAUDE.md` references `backend/` (old directory name, now `control-plane-api/`) and states coverage target is 80% (actual: 70%).
2. **Two memory systems**: Root `memory.md` is actively maintained; `.stoa-ai/memory.md` is frozen at the CAB-1068 setup session.
3. **Monolithic context**: Root `CLAUDE.md` is 11KB — all rules (Python style, TypeScript style, Rust, testing, security, deployment, git conventions, AI workflow) in a single file, consuming context window unnecessarily.
4. **No component context**: 6 of 8 components lack any `CLAUDE.md`. When Claude Code works deep in `control-plane-api/src/routers/`, it has no component-specific guidance.
5. **Underutilized native features**: Only 1 Claude Code skill (`e2e-test`) exists. Zero hooks configured. Zero `.claude/rules/` files. The `.stoa-ai/templates/PROMPT-ENTRY.md` defines "Mode Audit", "Mode Fix", "Mode Refactor" as copy-paste text instead of native invocable skills.
6. **Permission sprawl**: `settings.local.json` has 280 allow rules accumulated from ad-hoc sessions, including one-off commands that should not persist.
7. **No cross-repo context**: The 5 repos (stoa, stoa-docs, stoa-web, stoa-quickstart, stoactl) have no shared context. Working in stoa-docs gives Claude Code zero knowledge about the stoa monorepo architecture.
8. **ADR numbering conflict**: ADR-027 in `stoa/docs/architecture/adr/` ("Gateway Adapter Pattern") conflicts with ADR-027 in stoa-docs ("X.509 Header Authentication").

### Industry references

| Source | Practice |
|--------|----------|
| Anthropic Claude Code Best Practices | Hierarchical `CLAUDE.md`, `.claude/rules/` for modular instructions, native skills, hooks |
| GitLab Handbook-First | Single source of truth, everything documented in the repo |
| Stripe RFC Process | Design docs (ADRs) before implementation, traced decisions |
| Vercel/Turborepo | Per-package context in monorepos |
| AWS AI-DLC | Adaptive workflows for AI-driven development lifecycle |

## Decision

### 1. Hierarchical CLAUDE.md with modular rules

**Root `CLAUDE.md`** (~3KB) serves as a compact entry point: project overview, component map, key URLs, session workflow, and `@import` for current sprint context. All detailed rules are extracted into `.claude/rules/` files which Claude Code auto-loads based on path patterns.

**8 rule files** in `.claude/rules/`:

| File | Scope | Content |
|------|-------|---------|
| `code-style-python.md` | `**/*.py` | ruff, black, isort, mypy, line length |
| `code-style-typescript.md` | `**/*.{ts,tsx}` | eslint, prettier, path aliases |
| `code-style-rust.md` | `stoa-gateway/**` | cargo fmt, clippy |
| `testing.md` | `**/tests/**` | pytest, vitest, playwright standards |
| `security.md` | `terraform/**, charts/**, deploy/**` | Infrastructure protection, secrets |
| `git-conventions.md` | all | Commit format, branch naming, PR template |
| `deployment.md` | `charts/**, deploy/**` | Helm, Terraform safety, Docker multi-arch |
| `ai-workflow.md` | all | Session rules, review process, anti-drift |

### 2. Component-level CLAUDE.md (lazy-loaded)

Each of the 8 components gets a `CLAUDE.md` (~1-2KB) loaded only when Claude Code reads files in that directory. Contains: overview, tech stack, key commands, directory structure, patterns used, and dependency relationships.

Components: `control-plane-api/`, `control-plane-ui/`, `portal/`, `mcp-gateway/`, `stoa-gateway/`, `cli/`, `e2e/`, `charts/stoa-platform/`.

### 3. Native skills replacing template-based workflows

Convert `.stoa-ai/templates/PROMPT-ENTRY.md` modes into 7 native Claude Code skills invocable via `/` command:

| Skill | Replaces | Purpose |
|-------|----------|---------|
| `/fix-bug` | "Mode Fix Rapide" | Reproduce, fix, verify, commit |
| `/implement-feature` | Standard prompt | Plan, code, test, commit |
| `/audit-component` | "Mode Audit" | Read-only analysis |
| `/refactor` | "Mode Refactor" | Safe refactor with test guard |
| `/create-adr` | (new) | ADR creation from template |
| `/review-pr` | (new) | PR review checklist |
| `/update-memory` | (new) | Update memory.md with current state |

### 4. Hooks for automation and guardrails

Configure `.claude/settings.json` (committed) with:
- **PreToolUse hook** on Edit/Write: Block modifications to protected infrastructure paths (terraform/environments/prod, .github/workflows)

### 5. Single memory.md with structured format

One `memory.md` at root (delete `.stoa-ai/memory.md`). Structured with tables for session state, a decisions section, and known issues. Items older than 2 weeks archived to `docs/archive/`.

### 6. Cross-repo context via ~/.claude/CLAUDE.md

A user-level `~/.claude/CLAUDE.md` provides shared context across all STOA repos: repo table, cross-repo rules (API changes require docs update, quickstart must match Helm defaults), and shared standards.

### 7. Retire .stoa-ai/ entirely

The AI Factory infrastructure (`.stoa-ai/`) predates Claude Code's native skills, hooks, and rules. All useful content is migrated:
- Templates become skills in `.claude/skills/`
- Session workflow becomes a rule in `.claude/rules/ai-workflow.md`
- Scripts (`slack-notify.sh`, `daily-digest.sh`) move to `scripts/ai-ops/`
- Phase plans archived to `docs/archive/phases/`

### 8. Clean permission model

Reduce `settings.local.json` from 280 rules to ~30 using glob patterns (`Bash(cargo:*)` instead of individual cargo subcommands).

## Consequences

### Positive

- **No duplication** — single source of truth for each context type
- **Faster context loading** — 3KB root + lazy component files vs. 11KB monolith
- **Native integration** — skills, hooks, rules work with Claude Code's built-in features
- **Cross-repo awareness** — AI knows about all 5 repos when working in any one
- **Scalable** — adding a new component = adding one CLAUDE.md file
- **Traceable** — decisions logged, patterns documented, ADRs indexed
- **Maintainable** — modular rules are easier to update than a single large file

### Negative

- **More files** — ~35 new files across the repo (rules, skills, component docs)
- **Migration effort** — one-time cost to restructure existing context
- **Learning curve** — team must understand the hierarchical loading model

### Mitigations

- All new files are small (1-2KB each) and focused on one concern
- Migration is automated in a single session
- The hierarchy is documented in this ADR and in the root CLAUDE.md itself

## References

- [Anthropic Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [AWS AI-DLC](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/)
- [GitLab Handbook-First](https://about.gitlab.com/company/culture/all-remote/handbook-first-documentation/)
- ADR-024: Gateway Unified Modes (referenced for component architecture context)
