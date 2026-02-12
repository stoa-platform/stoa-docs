---
title: "Architecture Decision Records"
description: "Index of all Architecture Decision Records (ADRs) for the STOA Platform, documenting key technical and architectural choices."
keywords: [ADR, architecture decisions, STOA platform, technical decisions]
---

# Architecture Decision Records (ADRs)

> **"Each tool to its purpose"** — No one-size-fits-all

This directory contains important architectural decisions for STOA Platform.

---

## 📚 ADR Index

### 🏛️ Core Architecture

| # | Title | Status |
|:---:|-------|:------:|
| [003](./adr-003-monorepo-architecture.md) | Monorepo Architecture — Multi-Service Polyglot | ✅ |
| [004](./adr-004-gateway-adapter-pattern.md) | Gateway Adapter Pattern — Multi-Gateway Orchestration | ✅ |
| [005](./adr-005-event-driven-kafka.md) | Event-Driven Architecture — Kafka Topics Design | ✅ |
| [006](./adr-006-tool-registry-architecture.md) | Tool Registry Architecture — 7-Module Design | ✅ |

### ⚡ Performance & Reliability

| # | Title | Status |
|:---:|-------|:------:|
| [008](./adr-008-semantic-caching.md) | Semantic Response Caching — pgvector Strategy | ✅ |
| [009](./adr-009-error-snapshots.md) | Error Snapshots — Time-Travel Debugging | ✅ |

### 🏗️ Platform & Infrastructure

| # | Title | Status |
|:---:|-------|:------:|
| [001](./adr-001-api-exposure-strategy.md) | Third-Party API Exposure Strategy — Public API Façade | ✅ |
| [002](./adr-002-stoactl-cli.md) | stoactl CLI Design | 📋 |
| [007](./adr-007-gitops-argocd.md) | GitOps with Argo CD | ✅ |
| [025](./adr-025-gateway-resilience-zombie.md) | Gateway Resilience — Anti-Zombie Node Pattern | 📋 |
| [026](./adr-026-multi-iam-federation.md) | Multi-IAM Federation Pattern — Zero User Storage | ✅ |

### 🔐 Security & Compliance

| # | Title | Status |
|:---:|-------|:------:|
| [011](./adr-011-api-security-modes.md) | API Security Mode Selection — mTLS / OAuth2 / Hybrid | ✅ |
| [018](./adr-018-security-hardening-p0.md) | Security Hardening P0 — Team Coca Pentest | ✅ |

### 🤖 MCP & AI Gateway

| # | Title | Status |
|:---:|-------|:------:|
| [012](./adr-012-mcp-rbac-architecture.md) | MCP Tools Architecture — RBAC & Multi-Tenant Governance | ✅ |
| [020](./adr-020-runtime-data-governance.md) | Runtime Data Governance | ✅ |
| [021](./adr-021-uac-driven-observability.md) | UAC-Driven Observability | 📋 |
| [022](./adr-022-uac-tenant-architecture.md) | UAC Tenant Architecture | ✅ |
| [023](./adr-023-zero-blind-spot-observability.md) | Zero Blind Spot Observability | ✅ |
| [024](./adr-024-gateway-unified-modes.md) | Unified Gateway Architecture — 4 Deployment Modes | ✅ |

### 💼 Business & Strategy

| # | Title | Status |
|:---:|-------|:------:|
| [019](./adr-019-business-model-moat-strategy.md) | Business Model & Moat Strategy | ✅ |
| [041](./adr-041-plugin-architecture-community-enterprise.md) | Plugin Architecture — Community Core vs Enterprise Extensions | ✅ |

### 🛠️ Developer Experience & AI Workflow

| # | Title | Status |
|:---:|-------|:------:|
| [030](./adr-030-ai-context-management.md) | AI-Native Context Management Architecture | ✅ |
| [031](./adr-031-ci-cd-reusable-workflow-architecture.md) | CI/CD Reusable Workflow Architecture | ✅ |
| [032](./adr-032-response-transformation.md) | Response Transformation — Pluggable Adapters | ✅ |

### 🎨 Frontend & UX

| # | Title | Status |
|:---:|-------|:------:|
| [033](./adr-033-shared-ui-components.md) | Shared UI Components — Theme Abstraction | ✅ |

### 🦀 Evolution

| # | Title | Status |
|:---:|-------|:------:|
| [034](./adr-034-python-rust-migration.md) | Python to Rust Migration Strategy | ✅ |

### 🌐 Gateway & Deployment

| # | Title | Status |
|:---:|-------|:------:|
| [035](./adr-035-gateway-adapter-pattern.md) | Gateway Adapter Pattern — Multi-Gateway Orchestration | ✅ |
| [036](./adr-036-gateway-auto-registration.md) | Gateway Auto-Registration — Zero-Config Onboarding | ✅ |
| [037](./adr-037-deployment-modes-sovereign-first.md) | Deployment Modes — Sovereign First Strategy | ✅ |

---

## 🔮 Planned ADRs

| # | Title | Priority |
|:---:|-------|:--------:|
| 010 | Blockchain Decision — Digital Euro 2027+ | 🔵 |
| 013 | Idempotency & Saga Patterns — Exactly-Once for B2B | 🟡 |
| 014 | Delivery Guardrails — Canary & SLO Auto-Freeze | 🟡 |
| 015 | Sender-Constrained Tokens — mTLS Binding, DPoP & DCR | 🟡 |
| 016 | Release Engineering — Git Workflow & Versioning | 🟢 |
| 017 | Kafka/Redpanda Internal-Only — Zero External Exposure | 🟡 |

**Legend:** ✅ Accepted · 📋 Draft · 🟢 High · 🟡 Medium · 🔵 Low

## Technology Choices Overview

| Category | STOA Choice | Alternatives | Rationale |
|----------|-------------|--------------|-----------|
| **Messaging** | Kafka (Redpanda) | RabbitMQ, NATS | Event sourcing, replay, scale |
| **Database** | PostgreSQL | MySQL, MongoDB | ACID, JSON, extensions |
| **Auth** | Keycloak | Auth0, Okta | Self-hosted, full OIDC |
| **Observability** | Prometheus + Grafana + Loki | Datadog, ELK | Open source, K8s-native |
| **GitOps** | ArgoCD | Flux, Jenkins | UI, multi-cluster |
| **Automation** | AWX (Ansible) | Terraform | Idempotent, auditable |
| **Gateway v1** | webMethods | Kong, APISIX | Legacy expertise |
| **Gateway v2** | Rust + eBPF | Go, C++ | Performance, safety |
| **Search** | OpenSearch | Elasticsearch | Apache 2.0, AWS-free |

## Guiding Principles

| Principle | Application |
|-----------|-------------|
| **Open Source first** | Avoid lock-in, contribute upstream |
| **K8s-native** | Operators, CRDs, GitOps |
| **Right tool for the job** | Kafka for events, PostgreSQL for ACID |
| **Self-hosted possible** | No mandatory SaaS dependency |
| **Permissive license** | Apache 2.0, MIT — avoid GPL, SSPL |
| **Cloud-agnostic** | No mandatory managed service |

## ADR Template

Use the template below to create new ADRs.

```markdown
# ADR-XXX: [Title]

## Metadata
| Field | Value |
|-------|-------|
| **Status** | 📋 Draft / ✅ Accepted / ❌ Rejected / 🔄 Superseded |
| **Date** | YYYY-MM-DD |
| **Linear** | [CAB-XXX](link) |

## Context
[Why is this decision needed?]

## Decision
[What was decided?]

## Consequences
### Positive
### Negative
### Mitigations

## References
```
