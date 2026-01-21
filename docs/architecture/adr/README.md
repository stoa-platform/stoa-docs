# Architecture Decision Records (ADRs)

> **"Each tool to its purpose"** — Pas de one-size-fits-all

Ce répertoire contient les décisions architecturales importantes de STOA Platform.

## Index des ADRs

| ADR | Titre | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./adr-001-api-exposure-strategy.md) | Third-Party API Exposure Strategy — Public API Façade | ✅ Accepted | Jan 2026 |
| [ADR-007](./adr-007-gitops-argocd.md) | GitOps avec Argo CD | ✅ Accepted | Jan 2026 |
| [ADR-010](./adr-010-blockchain-decision.md) | Blockchain - Generique=Non, Euro Numérique=Oui 2027 | ✅ Accepted | Jan 2026 |
| [ADR-011](./adr-011-api-security-modes.md) | API Security Mode Selection — mTLS / OAuth2 / Hybrid | ✅ Accepted | Jan 2026 |
| [ADR-012](./adr-012-mcp-rbac-architecture.md) | MCP Tools Architecture — RBAC & Multi-Tenant Governance | ✅ Accepted | Jan 2026 |
| [ADR-013](./adr-013-idempotency-saga.md) | Idempotency & Saga Patterns — Exactly-Once for B2B | ✅ Accepted | Jan 2026 |
| [ADR-014](./adr-014-delivery-guardrails.md) | Delivery Guardrails — Break-Glass, Canary & SLO Auto-Freeze | ✅ Accepted | Jan 2026 |
| [ADR-015](./adr-015-sender-constrained-tokens.md) | Sender-Constrained Tokens — mTLS Binding, DPoP & DCR | ✅ Accepted | Jan 2026 |
| [ADR-016](./adr-016-release-engineering.md) | Release Engineering — Git Workflow, Versioning, Multi-Staging | ✅ Accepted | Jan 2026 |
| [ADR-017](./adr-017-kafka-internal-only.md) | Kafka/Redpanda Internal-Only — Zero External Exposure | ✅ Accepted | Jan 2026 |
| [ADR-018](./adr-018-mcp-streaming.md) | MCP Streaming Response Architecture — Lazy References | ✅ Accepted | Jan 2026 |

## Technology Choices Overview

| Catégorie | Choix STOA | Alternatives | Raison |
|-----------|------------|--------------|--------|
| **Messaging** | Kafka (Redpanda) | RabbitMQ, UM, NATS | Event sourcing, replay, scale |
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
