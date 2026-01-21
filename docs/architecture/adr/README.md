# Architecture Decision Records (ADRs)

> **"Each tool to its purpose"** — Pas de one-size-fits-all

Ce répertoire contient les décisions architecturales importantes de STOA Platform.

## Index des ADRs

| ADR | Titre | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./adr-001-api-exposure-strategy.md) | Third-Party API Exposure Strategy — Public API Façade | ✅ Accepted | Jan 2026 |
| [ADR-007](./adr-007-gitops-argocd.md) | GitOps avec Argo CD | ✅ Accepted | Jan 2026 |
| [ADR-011](./adr-011-api-security-modes.md) | API Security Mode Selection — mTLS / OAuth2 / Hybrid | ✅ Accepted | Jan 2026 |
| [ADR-012](./adr-012-mcp-rbac-architecture.md) | MCP Tools Architecture — RBAC & Multi-Tenant Governance | ✅ Accepted | Jan 2026 |

## Planned ADRs

| ADR | Titre | Status |
|-----|-------|--------|
| ADR-010 | Blockchain Decision — Euro Numérique 2027+ | 📋 Draft |
| ADR-013 | Idempotency & Saga Patterns — Exactly-Once for B2B | 📋 Draft |
| ADR-014 | Delivery Guardrails — Canary & SLO Auto-Freeze | 📋 Draft |
| ADR-015 | Sender-Constrained Tokens — mTLS Binding, DPoP & DCR | 📋 Draft |
| ADR-016 | Release Engineering — Git Workflow & Versioning | 📋 Draft |
| ADR-017 | Kafka/Redpanda Internal-Only — Zero External Exposure | 📋 Draft |
| ADR-018 | MCP Streaming Response Architecture | 📋 Draft |
| ADR-019 | Error Snapshots — Flight Recorder for Debugging | 📋 Draft |
| ADR-020 | AI Gateway — LLM Cost Optimization | 📋 Draft |

## Technology Choices Overview

| Catégorie | Choix STOA | Alternatives | Raison |
|-----------|------------|--------------|--------|
| **Messaging** | Kafka (Redpanda) | RabbitMQ, NATS | Event sourcing, replay, scale |
| **Database** | PostgreSQL | MySQL, MongoDB | ACID, JSON, extensions |
| **Auth** | Keycloak | Auth0, Okta | Self-hosted, OIDC complet |
| **Observabilité** | Prometheus + Grafana + Loki | Datadog, ELK | Open source, K8s-native |
| **GitOps** | ArgoCD | Flux, Jenkins | UI, multi-cluster |
| **Automation** | AWX (Ansible) | Terraform | Idempotent, auditable |
| **Gateway v1** | webMethods | Kong, APISIX | Expertise legacy |
| **Gateway v2** | Rust + eBPF | Go, C++ | Performance, safety |
| **Search** | OpenSearch | Elasticsearch | Apache 2.0, AWS-free |

## Principes directeurs

| Principe | Application |
|----------|-------------|
| **Open Source first** | Éviter lock-in, contribuer upstream |
| **K8s-native** | Operators, CRDs, GitOps |
| **Right tool for the job** | Kafka pour events, PostgreSQL pour ACID |
| **Self-hosted possible** | Pas de dépendance SaaS obligatoire |
| **Licence permissive** | Apache 2.0, MIT — éviter GPL, SSPL |
| **Cloud-agnostic** | Pas de service managed obligatoire |

## ADR Template

Utiliser le template ci-dessous pour créer de nouveaux ADRs.

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
