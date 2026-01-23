# Architecture Decision Records (ADRs)

> **"Each tool to its purpose"** — No one-size-fits-all

This directory contains important architectural decisions for STOA Platform.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./adr-001-api-exposure-strategy.md) | Third-Party API Exposure Strategy — Public API Façade | ✅ Accepted | Jan 2026 |
| [ADR-007](./adr-007-gitops-argocd.md) | GitOps with Argo CD | ✅ Accepted | Jan 2026 |
| [ADR-011](./adr-011-api-security-modes.md) | API Security Mode Selection — mTLS / OAuth2 / Hybrid | ✅ Accepted | Jan 2026 |
| [ADR-012](./adr-012-mcp-rbac-architecture.md) | MCP Tools Architecture — RBAC & Multi-Tenant Governance | ✅ Accepted | Jan 2026 |

## Planned ADRs

| ADR | Title | Status |
|-----|-------|--------|
| ADR-010 | Blockchain Decision — Digital Euro 2027+ | 📋 Draft |
| ADR-013 | Idempotency & Saga Patterns — Exactly-Once for B2B | 📋 Draft |
| ADR-014 | Delivery Guardrails — Canary & SLO Auto-Freeze | 📋 Draft |
| ADR-015 | Sender-Constrained Tokens — mTLS Binding, DPoP & DCR | 📋 Draft |
| ADR-016 | Release Engineering — Git Workflow & Versioning | 📋 Draft |
| ADR-017 | Kafka/Redpanda Internal-Only — Zero External Exposure | 📋 Draft |
| ADR-018 | MCP Streaming Response Architecture | 📋 Draft |
| ADR-019 | Error Snapshots — Flight Recorder for Debugging | 📋 Draft |
| ADR-020 | AI Gateway — LLM Cost Optimization | 📋 Draft |

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
