---
sidebar_position: 31
title: "ADR-031: CI/CD Reusable Workflow Architecture"
description: "Decides the reusable GitHub Actions workflow architecture for consistent CI/CD pipelines across all STOA platform components."
keywords: [CI/CD, GitHub Actions, reusable workflows, automation, pipelines]
---

# ADR-031: CI/CD Reusable Workflow Architecture

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-02-05 |
| **Author** | Christophe Aboulicam + Claude Code |
| **Linear** | CAB-1094 |

## Context

The STOA Platform monorepo contains **17 GitHub Actions workflows** across 7 components (Python, TypeScript, Rust). An audit revealed critical issues:

### Current Problems

| Problem | Impact |
|---------|--------|
| 5 component CI pipelines (~350 lines each) with ~78% duplication | Maintenance x5, drift risk |
| `mcp-gateway-ci.yml` uses `pytest ... \|\| echo` — tests can never fail | False green, silent regressions |
| Coverage mismatch: `control-plane-api` enforces 45% in CI vs 70% in pyproject.toml | Inconsistent quality gates |
| Zero `concurrency:` blocks across all 17 workflows | Duplicate runs on every PR push |
| All GitHub Actions pinned by mutable tags (`@v4`, `@master`) | Supply chain attack vector |
| `aquasecurity/trivy-action@master` pinned to branch, not SHA | Critical security risk |
| `mypy` runs with `continue-on-error: true` everywhere | Type safety not enforced |
| Deploy uses raw `kubectl set image` with no rollback | Broken deploys persist until manual fix |
| Dependabot missing 4 ecosystems (control-plane-ui, e2e, stoa-gateway, cli) | Unmonitored dependencies |
| E2E tests run single-threaded (`workers: 1`), no sharding | ~20 min wall time |
| No Codecov, no JUnit XML upload, no test reporting | Zero coverage visibility |

### Duplication Map

The following blocks are copy-pasted across 5+ workflows:

- **Docker Build + Push to ECR** (~50 lines): AWS OIDC, ECR login, QEMU, Buildx, metadata, build-push
- **Kubernetes Deploy** (~40 lines): AWS creds, EKS check, kubeconfig, kubectl set image, rollout
- **Smoke Test** (~45 lines): Node setup, Playwright install, BDD gen, 12 persona secrets
- **Slack Notification** (~35 lines): Status fields, color logic, webhook

## Decision

Adopt a **3-layer architecture** for all CI/CD workflows:

```
Layer 1: Composite Actions     (.github/actions/*)
         Setup sequences — Python, Node, Rust, Docker, E2E

Layer 2: Reusable Workflows    (.github/workflows/reusable-*.yml)
         Complete job pipelines — CI, Docker, Deploy, Smoke, Notify

Layer 3: Orchestrators          (.github/workflows/<component>-ci.yml)
         Thin wrappers — path triggers + uses: calls (~80 lines each)
```

### 1. Composite Actions (5)

| Action | Purpose |
|--------|---------|
| `setup-python-env` | Checkout + Python version + pip/poetry install + cache |
| `setup-node-env` | Checkout + Node.js + npm ci + cache |
| `setup-rust-env` | Checkout + rust-toolchain + Swatinem/rust-cache |
| `docker-metadata` | QEMU + Buildx + ECR login + metadata tags |
| `e2e-setup` | Node + Playwright browsers + BDD generation |

### 2. Reusable Workflows (7)

| Workflow | Inputs | Purpose |
|----------|--------|---------|
| `reusable-python-ci` | component, python-version, coverage-threshold, mypy-enforce | Ruff + mypy + pytest + JUnit + coverage |
| `reusable-node-ci` | component, node-version, run-build | ESLint + vitest + build + artifact |
| `reusable-rust-ci` | component, run-audit | fmt ‖ clippy, test, cargo-audit |
| `reusable-docker-ecr` | component, ecr-repository, platforms, build-args | Multi-arch build + push ECR |
| `reusable-k8s-deploy` | component, image-tag, namespace, verify-endpoint | Deploy + save rollback state |
| `reusable-smoke-test` | component, test-grep | E2E @smoke with persona auth |
| `reusable-notify` | component, ci-result, deploy-result | Slack notification |

### 3. Security Hardening

- **SHA pinning**: All 22 distinct GitHub Actions pinned by immutable SHA digest
- **SLSA Level 2**: `actions/attest-build-provenance` on all Docker images
- **CodeQL**: Python + JavaScript analysis (weekly + PR)
- **Dependency Review**: Block PRs introducing HIGH+ vulnerabilities
- **OpenSSF Scorecard**: Weekly monitoring
- **Automated rollback**: `kubectl rollout undo` on smoke test failure

### 4. Test Infrastructure

- **Fix false greens**: Remove `|| echo` pattern, enforce real thresholds
- **Codecov integration**: Coverage upload for Python (XML), TypeScript (Cobertura), Rust (tarpaulin)
- **E2E sharding**: 3 Playwright shards with merged reports
- **JUnit XML**: All CI workflows produce machine-readable test results
- **dorny/test-reporter**: PR annotations for test failures

### 5. Concurrency Controls

All 17 workflows get:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```
PR runs cancel stale predecessors. Push-to-main runs queue (no cancellation to preserve deploy ordering).

## Consequences

### Positive

- **Single point of change**: Docker/deploy/notify updates require editing 1 file instead of 5-6
- **78% line reduction** per component workflow (350 → 80 lines)
- **Automated rollback** prevents broken deploys from persisting
- **Supply chain security**: SHA-pinned actions + SLSA provenance + Cosign signing
- **Coverage visibility**: Codecov dashboard with per-component flags and PR comments
- **E2E 50% faster**: Sharding reduces wall time from ~20min to ~10min
- **No duplicate runs**: Concurrency groups cancel stale PR runs

### Negative

- **Path trigger complexity**: Orchestrators must list reusable workflow files in `paths:` filter
- **Debug depth**: Reusable workflow logs are nested, slightly harder to navigate
- **Secret passing**: Using `secrets: inherit` passes all secrets (acceptable for same-repo workflows)

### Mitigations

- Document path trigger requirements in workflow comments
- GitHub Actions UI handles nested workflow visualization well
- `secrets: inherit` risk is minimal for a single-repository monorepo

## References

- [GitHub Reusable Workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub Composite Actions](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
- [SLSA Framework](https://slsa.dev/)
- ADR-024: Gateway Architecture (4 modes)
- ADR-030: AI-Native Context Management Architecture
