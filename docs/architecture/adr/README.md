---
title: "Architecture Decision Records"
sidebar_position: 0
description: "Index of all Architecture Decision Records (ADRs) for the STOA Platform, documenting key technical and architectural choices."
keywords: [ADR, architecture decisions, STOA platform, technical decisions]
---

# Architecture Decision Records (ADRs)

> **"Each tool to its purpose"** — No one-size-fits-all

This directory contains important architectural decisions for STOA Platform.

---

## ADR Index

### Core Architecture

| # | Title | Status |
|:---:|-------|:------:|
| [003](./adr-003-monorepo-architecture.md) | Monorepo Architecture — Multi-Service Polyglot | ✅ |
| [004](./adr-004-gateway-adapter-pattern.md) | Gateway Adapter Pattern — Multi-Gateway Orchestration | ✅ |
| [005](./adr-005-event-driven-kafka.md) | Event-Driven Architecture — Kafka Topics Design | ✅ |
| [006](./adr-006-tool-registry-architecture.md) | Tool Registry Architecture — 7-Module Design | ✅ |
| [035](./adr-035-gateway-adapter-pattern.md) | Gateway Adapter Pattern — Multi-Gateway Orchestration | ✅ |
| [045](./adr-045-stoa-yaml-declarative-spec.md) | stoa.yaml Declarative API Specification | ✅ |

### Platform & Infrastructure

| # | Title | Status |
|:---:|-------|:------:|
| [001](./adr-001-api-exposure-strategy.md) | Third-Party API Exposure Strategy — Public API Facade | ✅ |
| [002](./adr-002-stoactl-cli.md) | stoactl CLI Design | 📋 |
| [007](./adr-007-gitops-argocd.md) | GitOps with Argo CD | ✅ |
| [025](./adr-025-gateway-resilience-zombie.md) | Gateway Resilience — Anti-Zombie Node Pattern | 📋 |
| [031](./adr-031-ci-cd-reusable-workflow-architecture.md) | CI/CD Reusable Workflow Architecture | ✅ |
| [040](./adr-040-born-gitops-multi-environment.md) | Born GitOps — Multi-Environment Promotion Architecture | ✅ |
| [043](./adr-043-kafka-mcp-event-bridge.md) | Kafka → MCP Event Bridge Architecture | 📋 |

### Security & Compliance

| # | Title | Status |
|:---:|-------|:------:|
| [011](./adr-011-api-security-modes.md) | API Security Mode Selection — mTLS / OAuth2 / Hybrid | ✅ |
| [015](./adr-015-token-optimization-architecture.md) | Token Optimization Architecture | 📋 |
| [018](./adr-018-security-hardening-p0.md) | Security Hardening P0 — Team Coca Pentest | ✅ |
| [026](./adr-026-multi-iam-federation.md) | Multi-IAM Federation Pattern — Zero User Storage | ✅ |
| [027](./adr-027-x509-header-authentication.md) | X.509 Header Authentication | ✅ |
| [028](./adr-028-rfc8705-certificate-binding.md) | RFC 8705 Certificate Binding | ✅ |
| [029](./adr-029-mtls-certificate-lifecycle.md) | mTLS Certificate Lifecycle | ✅ |
| [039](./adr-039-mtls-cert-bound-tokens.md) | Rust Gateway mTLS Cert-Bound Tokens | ✅ |
| [044](./adr-044-mcp-oauth-gateway-proxy.md) | MCP OAuth 2.1 Gateway Proxy Architecture | ✅ |
| [054](./adr-054-rbac-taxonomy-v2.md) | RBAC Taxonomy v2 — Persona Roles & Display Names | ✅ |
| [056](./adr-056-fapi-2-architecture.md) | FAPI 2.0 Security Architecture | ✅ |

### MCP & AI Gateway

| # | Title | Status |
|:---:|-------|:------:|
| [012](./adr-012-mcp-rbac-architecture.md) | MCP Tools Architecture — RBAC & Multi-Tenant Governance | ✅ |
| [020](./adr-020-runtime-data-governance.md) | Runtime Data Governance | ✅ |
| [021](./adr-021-uac-driven-observability.md) | UAC-Driven Observability | 📋 |
| [022](./adr-022-uac-tenant-architecture.md) | UAC Tenant Architecture | ✅ |
| [023](./adr-023-zero-blind-spot-observability.md) | Zero Blind Spot Observability | ✅ |
| [024](./adr-024-gateway-unified-modes.md) | Unified Gateway Architecture — 4 Deployment Modes | ✅ |
| [046](./adr-046-mcp-federation-architecture.md) | MCP Federation Architecture | 📋 |
| [047](./adr-047-mcp-skills-system.md) | MCP Skills System — Context Injection | 📋 |
| [048](./adr-048-integrated-chat-agent.md) | Integrated Chat Agent Architecture | 📋 |
| [051](./adr-051-lazy-mcp-discovery.md) | Lazy MCP Discovery with Cache-First Pattern | ✅ |
| [067](./adr-067-uac-as-llm-optimized-executable-contract.md) | UAC as LLM-Optimized Executable Contract | 📋 |

### Performance & Observability

| # | Title | Status |
|:---:|-------|:------:|
| [008](./adr-008-semantic-caching.md) | Semantic Response Caching — pgvector Strategy | ✅ |
| [009](./adr-009-error-snapshots.md) | Error Snapshots — Time-Travel Debugging | ✅ |
| [049](./adr-049-enterprise-ai-native-benchmark.md) | Enterprise AI-Native Gateway Benchmark | ✅ |
| [050](./adr-050-guardrails-token-budget-state.md) | Guardrails V2 — Token Budget State Management | ✅ |
| [052](./adr-052-benchmark-opensearch-persistence.md) | Benchmark OpenSearch Persistence & LLM Routing | ✅ |
| [053](./adr-053-llm-cost-aware-routing.md) | LLM Cost-Aware Routing | ✅ |

### Gateway & Deployment

| # | Title | Status |
|:---:|-------|:------:|
| [034](./adr-034-python-rust-migration.md) | Python to Rust Migration Strategy | ✅ |
| [036](./adr-036-gateway-auto-registration.md) | Gateway Auto-Registration — Zero-Config Onboarding | ✅ |
| [037](./adr-037-deployment-modes-sovereign-first.md) | Deployment Modes — Sovereign First Strategy | ✅ |
| [038](./adr-038-sidecar-deployment-strategies-vm.md) | Sidecar Deployment on VM Infrastructure | 📋 |
| [057](./adr-057-product-lineup-gateway-link-connect.md) | Product Lineup — STOA Gateway, STOA Link, STOA Connect | ✅ |
| [058](./adr-058-pingora-integration.md) | Pingora Integration — Embedded Connection Pool | ✅ |

### Frontend & UX

| # | Title | Status |
|:---:|-------|:------:|
| [032](./adr-032-response-transformation.md) | Response Transformation — Pluggable Adapters | ✅ |
| [033](./adr-033-shared-ui-components.md) | Shared UI Components — Theme Abstraction | ✅ |
| [055](./adr-055-portal-console-governance.md) | Portal/Console Governance — Clear Separation of Concerns | ✅ |

### Business & Strategy

| # | Title | Status |
|:---:|-------|:------:|
| [019](./adr-019-business-model-moat-strategy.md) | Business Model & Moat Strategy | ✅ |
| [041](./adr-041-plugin-architecture-community-enterprise.md) | Plugin Architecture — Community Core vs Enterprise Extensions | ✅ |

### Developer Experience & AI Workflow

| # | Title | Status |
|:---:|-------|:------:|
| [030](./adr-030-ai-context-management.md) | AI-Native Context Management Architecture | ✅ |
| [065](./adr-065-pr-guardian.md) | STOA PR Guardian — Advisory AI Review on GitHub Actions | ✅ |

---

## Planned ADRs

| # | Title | Priority |
|:---:|-------|:--------:|
| 010 | Blockchain Decision — Digital Euro 2027+ | Low |
| 013 | Idempotency & Saga Patterns — Exactly-Once for B2B | Medium |
| 014 | Delivery Guardrails — Canary & SLO Auto-Freeze | Medium |
| 016 | Release Engineering — Git Workflow & Versioning | High |
| 017 | Kafka/Redpanda Internal-Only — Zero External Exposure | Medium |

**Legend:** ✅ Accepted · 📋 Draft/Proposed

## Technology Choices Overview

| Category | STOA Choice | Alternatives | Rationale |
|----------|-------------|--------------|-----------|
| **Messaging** | Kafka (Redpanda) | RabbitMQ, NATS | Event sourcing, replay, scale |
| **Database** | PostgreSQL | MySQL, MongoDB | ACID, JSON, extensions |
| **Auth** | Keycloak | Auth0, Okta | Self-hosted, full OIDC |
| **Observability** | Prometheus + Grafana + Loki | Datadog, ELK | Open source, K8s-native |
| **GitOps** | ArgoCD | Flux, Jenkins | UI, multi-cluster |
| **Automation** | ArgoCD + Gateway Adapters | Terraform | Idempotent, auditable |
| **Gateway v1** | webMethods | Kong, APISIX | Legacy expertise |
| **Gateway v2** | Rust (Pingora) | Go, C++ | Performance, safety |
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
