---
sidebar_position: 5
title: "Contributing to STOA: Developer Guide"
description: How to contribute to STOA Platform — development setup, coding standards, PR workflow, testing, and community guidelines
keywords: [contributing, development, pull request, coding standards, open source]
---

# Contributing to STOA

Whether you're fixing a typo or building a major feature, every contribution matters. This guide helps you get started.

---

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/stoa.git
cd stoa

# 2. Pick a component
cd control-plane-api   # Python 3.11, FastAPI
cd portal              # React 18, TypeScript, Vite
cd control-plane-ui    # React 18, TypeScript, Vite
cd stoa-gateway        # Rust, Tokio, axum

# 3. Install dependencies
make setup             # or per-component: npm install / pip install -e ".[dev]"

# 4. Run tests
make test              # all components
```

---

## Find Something to Work On

### Good First Issues

We maintain a curated list of beginner-friendly issues:

- [**All good-first-issues**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — Start here
- [**Beginner difficulty**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3A%22difficulty%3Abeginner%22) — No prior STOA knowledge needed
- [**Documentation**](https://github.com/stoa-platform/stoa/issues?q=is%3Aopen+label%3Adocumentation+label%3A%22good+first+issue%22) — Improve guides and examples

Each issue includes:
- A clear description of what to do
- Expected outcome
- Relevant files and commands
- Difficulty rating (beginner / intermediate / advanced)

### Other Ways to Contribute

| Type | Where | Impact |
|------|-------|--------|
| Bug reports | [GitHub Issues](https://github.com/stoa-platform/stoa/issues/new) | Help us find problems |
| Documentation | [stoa-docs](https://github.com/stoa-platform/stoa-docs) | Help others learn |
| Translations | `i18n/` directories | Reach more users |
| Code reviews | Open PRs | Improve quality |
| Community help | Discord `#help` | Support new users |

---

## Development Setup

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| Python | 3.11+ | API, MCP Gateway, CLI |
| Node.js | 20+ | Portal, Console UI |
| Rust | stable | STOA Gateway |
| Docker | latest | Local services |
| kubectl | latest | K8s development (optional) |

### Per-Component Setup

#### Control Plane API (Python)

```bash
cd control-plane-api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ --cov=src -q
```

#### Portal or Console UI (TypeScript)

```bash
cd portal  # or control-plane-ui
npm install
npm run dev          # Dev server
npm run test -- --run  # Tests
npm run lint         # Lint check
```

#### STOA Gateway (Rust)

```bash
cd stoa-gateway
cargo build
cargo test
cargo clippy --all-targets --all-features
```

---

## PR Workflow

### 1. Create a Branch

```bash
git checkout -b feat/add-rate-limiting   # or fix/, docs/, test/
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`

### 2. Make Changes

- Keep PRs focused — one concern per PR
- Add tests for new functionality
- Update documentation if behavior changes

### 3. Commit with Conventional Commits

```bash
git commit -s -m "feat(api): add rate limiting per tenant"
```

Format: `type(scope): description`

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `test` | Tests |
| `refactor` | Code restructuring |
| `chore` | Maintenance |

The `-s` flag adds your DCO sign-off (required).

### 4. Run Quality Checks

```bash
# Python
ruff check . && black --check . && pytest tests/ -q

# TypeScript
npm run lint && npm run format:check && npm run test -- --run

# Rust
cargo fmt --check && cargo clippy --all-targets && cargo test
```

### 5. Submit Your PR

```bash
git push -u origin HEAD
```

Then open a PR on GitHub. Include:
- What changed and why
- How to test it
- Link to the related issue (if any)

---

## Code Style

| Language | Formatter | Linter | Line Length |
|----------|-----------|--------|-------------|
| Python | black | ruff | 120 (API), 100 (others) |
| TypeScript | prettier | eslint | 100 |
| Rust | cargo fmt | clippy | standard |

### License Headers

All source files need an Apache 2.0 header:

```python
# Copyright 2026 STOA Platform Authors
# SPDX-License-Identifier: Apache-2.0
```

Run `python scripts/add-license-headers.py --check .` to verify.

---

## Testing

Every PR should include tests. We use:

| Component | Framework | Run |
|-----------|-----------|-----|
| API | pytest + pytest-asyncio | `pytest tests/ -q` |
| Portal / UI | vitest + React Testing Library | `npm run test -- --run` |
| Gateway | cargo test | `cargo test --all-features` |
| E2E | Playwright + BDD | `npx playwright test` |

---

## Getting Help

- **Discord** — [discord.gostoa.dev](https://discord.gostoa.dev) — ask in `#contributors`
- **GitHub Discussions** — [stoa-platform/stoa/discussions](https://github.com/stoa-platform/stoa/discussions)
- **Email** — [contributors@gostoa.dev](mailto:contributors@gostoa.dev)

---

## Recognition

All contributors are recognized in [CONTRIBUTORS.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTORS.md) and release notes. Contributions also earn points toward our [Rewards Program](/docs/community/rewards).

---

*See the full [CONTRIBUTING.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md) on GitHub for additional details.*
