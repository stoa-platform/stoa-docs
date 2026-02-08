---
sidebar_position: 3
---

# ADR-003: Monorepo Architecture — Multi-Service Polyglot Design

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | N/A (Foundational) |

## Context

STOA Platform is a comprehensive API Management solution comprising multiple services: a control plane API, multiple frontends, an AI-native gateway, infrastructure automation, and tooling. These components share common dependencies, require coordinated releases, and benefit from unified CI/CD pipelines.

The architectural decision on repository structure significantly impacts:

- **Developer Experience** — How easy is it to contribute across components?
- **CI/CD Complexity** — How do we build, test, and deploy interdependent services?
- **Code Sharing** — How do we share utilities, types, and components?
- **Release Coordination** — How do we version and release the platform?

### The Problem

> "Should each service live in its own repository (polyrepo) or should everything coexist in a single repository (monorepo)?"

This is a foundational decision that affects every aspect of development workflow.

## Considered Options

### 1. Monorepo (Single Repository)

All application code, infrastructure definitions, and shared components in one repository. Separate repositories only for runtime configuration (GitOps) and infrastructure-as-code secrets.

### 2. Polyrepo (Multiple Repositories)

Each service in its own repository: `stoa-api`, `stoa-console`, `stoa-portal`, `stoa-gateway`, `stoa-cli`, etc.

### 3. Hybrid (Monorepo + Satellites)

Core services in a monorepo, with specialized components (infrastructure, docs) in separate repositories.

## Decision Outcome

**Chosen option: Hybrid Monorepo** — Core application code in `stoa`, with dedicated repos for infrastructure (`stoa-infra`), documentation (`stoa-docs`), quickstart (`stoa-quickstart`), and CLI (`stoactl`).

### Repository Structure

| Repository | Purpose | Content |
|------------|---------|---------|
| **stoa** | Application monorepo | All services, shared code, CI/CD |
| **stoa-infra** | Infrastructure IaC | Terraform, Ansible, Helm (canonical) |
| **stoa-docs** | Documentation | Docusaurus site, ADRs |
| **stoa-quickstart** | Self-hosted quickstart | Docker Compose |
| **stoactl** | CLI tool | Go + Cobra |
| **stoa-gitops** | Runtime config | Tenant configs, ArgoCD apps |

## Monorepo Structure

```
stoa/
├── control-plane-api/       # Python 3.11 — FastAPI backend
├── control-plane-ui/        # React 18 + TypeScript — Console UI
├── portal/                  # React 18 + TypeScript — Developer Portal
├── mcp-gateway/             # Python 3.11 — MCP Gateway (current)
├── stoa-gateway/            # Rust (stable) — Future unified gateway
├── cli/                     # Python — Internal CLI
├── e2e/                     # Playwright + BDD — E2E tests
├── landing-api/             # Python 3.12 — Landing page API
│
├── shared/                  # Shared frontend components
│   ├── components/          # React components (Toast, CommandPalette)
│   └── contexts/            # React contexts (Theme)
│
├── charts/                  # Helm charts (synced with stoa-infra)
│   └── stoa-platform/       # Main platform chart
│
├── deploy/                  # Deployment configurations
│   ├── argocd/              # ArgoCD ApplicationSets
│   ├── demo/                # Demo tenant seeding
│   ├── docker-compose/      # Local development
│   └── platform-bootstrap/  # Initial platform setup
│
├── ansible/                 # Ansible playbooks
│   └── reconcile-webmethods/ # Gateway reconciliation
│
├── scripts/                 # Utility scripts
├── docs/                    # Internal documentation
├── services/                # Supporting services
│   └── kafka-bridge/        # Kafka bridge service
│
├── stoa-catalog/            # UAC schemas and templates
├── stoa-policy-engine-rs/   # Rust OPA evaluation library
│
├── .github/workflows/       # CI/CD workflows
└── CLAUDE.md                # AI context file
```

## Technology Stack Matrix

| Component | Language | Framework | Runtime |
|-----------|----------|-----------|---------|
| **control-plane-api** | Python 3.11 | FastAPI, SQLAlchemy 2.0 | Async |
| **control-plane-ui** | TypeScript | React 18, Vite, Zustand | Node 20 |
| **portal** | TypeScript | React 18, Vite | Node 20 |
| **mcp-gateway** | Python 3.11 | FastAPI, OPA | Async |
| **stoa-gateway** | Rust (stable) | Tokio, Axum | Native |
| **cli** | Python 3.11 | Typer, Rich | Sync |
| **e2e** | TypeScript | Playwright, BDD | Node 20 |
| **landing-api** | Python 3.12 | FastAPI | Async |

## CI/CD Architecture

### Path-Based Triggers

Each component has its own CI workflow triggered by path changes:

```yaml
# .github/workflows/control-plane-api-ci.yml
on:
  push:
    paths:
      - 'control-plane-api/**'
      - 'shared/**'  # Shared dependencies
```

### Workflow Matrix

| Component | Workflow | Triggers | Actions |
|-----------|----------|----------|---------|
| control-plane-api | `control-plane-api-ci.yml` | `control-plane-api/**` | ruff, mypy, pytest, bandit |
| control-plane-ui | `control-plane-ui-ci.yml` | `control-plane-ui/**`, `shared/**` | eslint, vitest |
| mcp-gateway | `mcp-gateway-ci.yml` | `mcp-gateway/**` | ruff, mypy, pytest |
| stoa-gateway | `stoa-gateway-ci.yml` | `stoa-gateway/**` | cargo test, clippy |
| portal | `portal-ci.yml` | `portal/**`, `shared/**` | eslint, vitest |
| e2e | `e2e-tests.yml` | Manual, PR | Playwright BDD |

### Reusable Workflows

```
.github/workflows/
├── reusable-python-ci.yml    # Python linting, testing, coverage
├── reusable-node-ci.yml      # Node linting, testing
├── reusable-rust-ci.yml      # Rust build, test, clippy
├── reusable-docker-ecr.yml   # Docker build, ECR push
└── reusable-k8s-deploy.yml   # Kubernetes deployment
```

## Shared Code Strategy

### Frontend Shared Components

```
shared/
├── components/
│   ├── CommandPalette/       # Global search
│   ├── Toast/                # Notifications
│   ├── ThemeToggle/          # Dark/light mode
│   ├── Breadcrumb/
│   ├── ConfirmDialog/
│   ├── EmptyState/
│   ├── FormWizard/
│   └── Skeleton/
└── contexts/
    └── ThemeContext.tsx      # Theme provider
```

Both `control-plane-ui` and `portal` import from `shared/`:

```typescript
// portal/src/App.tsx
import { ThemeProvider } from '../../shared/contexts/ThemeContext';
import { Toast } from '../../shared/components/Toast';
```

### Python Shared Patterns

Python components share patterns via copy (not packages) due to different deployment contexts:

- **Auth patterns**: RBAC decorators, Keycloak integration
- **Logging**: structlog configuration
- **OPA integration**: Policy evaluation client

## Dependency Management

### Python (pyproject.toml per component)

```toml
# control-plane-api/pyproject.toml
[project]
name = "control-plane-api"
requires-python = ">=3.11"

[tool.ruff]
line-length = 120

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### Node (package.json per component + root)

```json
// Root package.json — workspace management
{
  "workspaces": ["control-plane-ui", "portal", "e2e"],
  "devDependencies": {
    "commitlint": "^19.0.0",
    "husky": "^9.0.0"
  }
}
```

### Rust (Cargo.toml per component)

```toml
# stoa-gateway/Cargo.toml
[package]
name = "stoa-gateway"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
axum = "0.7"
```

## Cross-Repo Synchronization Rules

| Rule | Source | Destination |
|------|--------|-------------|
| API changes | `stoa/control-plane-api` | `stoa-docs/docs/api/` |
| Helm charts | `stoa/charts/` | `stoa-infra/charts/` |
| CRD definitions | `stoa-infra/charts/stoa-platform/crds/` | Source of truth |
| CLI commands | `stoa/cli/` or `stoactl/` | `stoa-docs/docs/reference/cli.md` |

## Consequences

### Positive

- **Atomic Changes** — Cross-component changes are single PRs with unified review
- **Shared CI** — Reusable workflows reduce maintenance overhead
- **Dependency Visibility** — Breaking changes are caught at PR time
- **Simplified Onboarding** — One clone, one setup script
- **Coordinated Releases** — Release Please manages versioning across components

### Negative

- **Repository Size** — Clone includes all components (~500MB with history)
- **CI Complexity** — Path-based triggers require careful configuration
- **Partial Failures** — One broken component can block main branch
- **IDE Performance** — Large monorepo can slow some IDEs

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Large clone | Shallow clone for CI (`--depth=1`) |
| CI complexity | Reusable workflows + clear ownership |
| Partial failures | Required status checks per component |
| IDE performance | Component-specific `.vscode/` configs |

## Rationale for Satellite Repos

### stoa-infra (Separate)

- **Security** — Terraform state, AWS credentials, Vault secrets
- **Access Control** — Restricted to platform operators
- **Audit Trail** — Separate git history for compliance

### stoa-docs (Separate)

- **Public Site** — docs.gostoa.dev served via Vercel
- **Community Contributions** — Lower barrier for doc PRs
- **Docusaurus Build** — Independent build pipeline

### stoa-quickstart (Separate)

- **Self-Contained** — Users clone without full monorepo
- **Docker Compose** — Simple local setup
- **Versioned** — Tags match platform releases

### stoactl (Separate)

- **Go Binary** — Different build toolchain
- **Independent Release** — CLI can release faster than platform
- **Distribution** — Homebrew, apt, direct download

## Validation

### OSS Contributor Persona

> *"Je veux contribuer une feature au portal. Je dois tout cloner?"*

**Response:**

```bash
# Repository access granted to beta participants
# Request access: christophe@hlfh.io
git clone --depth=1 <repository-url>
cd stoa/portal
npm install
npm run dev
```

Full history unnecessary. Path-based CI runs only portal tests.

### Enterprise Architect Persona

> *"Comment vous gérez les dépendances entre control-plane-api et mcp-gateway?"*

**Response:**
- Both are Python 3.11 with shared patterns (copy, not package)
- API changes require both CI pipelines to pass
- Integration tested via E2E suite
- Shared schemas in `stoa-catalog/`

## References

- [ADR-024 — Unified Gateway Architecture](./adr-024-gateway-unified-modes.md)
- [ADR-031 — CI/CD Reusable Workflows](./adr-031-ci-cd-reusable-workflow-architecture.md)
- [CONTRIBUTING.md](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- [Monorepo vs Polyrepo — Thoughtworks](https://www.thoughtworks.com/insights/blog/monorepos)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
