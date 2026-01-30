---
sidebar_position: 10
title: Implementation Status
description: Current implementation vs Future Vision
---

# Implementation Status

## Current Implementation

| Component | Technology | Status |
|-----------|------------|--------|
| Control Plane API | Python 3.11 + FastAPI | Production |
| MCP Gateway | Python 3.11 + FastAPI + OPA | Production |
| API Gateway | webMethods | Production |
| Database | PostgreSQL | Production |
| Event Streaming | Kafka/Redpanda | Production |
| Auth | Keycloak (OIDC) | Production |
| Secrets | HashiCorp Vault | Production |
| Observability | Prometheus + Grafana + Loki | Production |
| GitOps | ArgoCD | Production |
| Automation | AWX (Ansible) | Production |

## Future Vision

| Feature | Technology | Target | Phase |
|---------|------------|--------|-------|
| High-performance Gateway | Rust + Tokio + eBPF | Q4 2026 | Phase 16+ |
| CLI Tool | `stoa` CLI | Q3 2026 | Phase 14 |
| Public Helm Registry | charts.gostoa.dev | Q3 2026 | Phase 14 |

:::info
Items listed under "Future Vision" are planned but not yet implemented. The current Python/FastAPI stack is production-ready and actively maintained.
:::
