---
sidebar_position: 6
title: "Hardware Requirements & Sizing Guide"
description: "CPU, memory, and disk requirements for STOA Platform across Docker, VPS, Kubernetes, and bare metal deployments."
keywords:
  - hardware requirements
  - sizing guide
  - deployment
  - kubernetes
  - docker
  - vps
  - bare metal
  - resource limits
  - api gateway sizing
---

<!-- last verified: 2026-02 -->

# Hardware Requirements & Sizing Guide

STOA Gateway runs on as little as **1 vCPU / 128 MB RAM** in standalone mode. A full platform deployment (gateway + control plane + auth + UI) needs **4 vCPU / 4 GB RAM**. Production HA starts at **3 nodes / 8 GB each**.

This guide covers four deployment profiles, from a developer laptop to a multi-tenant Kubernetes cluster.

## Deployment Profiles

| Profile | Target | CPU | RAM | Disk | APIs | RPS Target |
|---------|--------|-----|-----|------|------|-----------|
| **Docker Compose** | Dev / local | 4 vCPU | 8 GB | 20 GB | 10-50 | 1,000 |
| **Single VPS** | Small prod | 2 vCPU | 4 GB | 20 GB SSD | 50-200 | 5,000 |
| **Managed K8s** (3 nodes) | Production HA | 3x 4 vCPU | 3x 8 GB+ | 3x 80 GB | 500+ | 20,000+ |
| **K3s bare metal** (3-5 nodes) | Staging / edge | 3-5x 2 vCPU | 3-5x 4 GB | 3-5x 40 GB | 200-500 | 10,000 |

### Docker Compose (Developer)

Recommended for local development and evaluation. Runs the full stack on a single machine.

```
Minimum: 4 vCPU, 8 GB RAM, 20 GB disk
Includes: Gateway, Control Plane API, Console, Portal, Keycloak, PostgreSQL
Optional: OpenSearch, Prometheus, Grafana, Loki (+2 GB RAM)
```

### Single VPS (Small Production)

A single VPS can run the Gateway standalone for small API catalogs.

```
Minimum: 2 vCPU, 4 GB RAM, 20 GB SSD
Runs: Gateway only (or Gateway + PostgreSQL + Keycloak for full stack)
Best for: Solo developers, small teams, < 200 APIs
```

### Managed Kubernetes (Production HA)

Production-grade HA deployment with any managed Kubernetes provider.

```
Recommended: 3 nodes, 4 vCPU / 8 GB+ RAM each
Total: 12 vCPU, 24+ GB RAM
Includes: All components (2 replicas each) + observability stack
Database: Managed PostgreSQL recommended (separate service)
```

### K3s Bare Metal (Staging / Edge)

Lightweight Kubernetes for staging, edge, or air-gapped environments.

```
Recommended: 3-5 nodes, 2 vCPU / 4 GB RAM each
Layout: 1 control plane + 2-4 workers
Includes: All components + Traefik ingress + cert-manager
```

## Component Sizing

### STOA Gateway (Rust)

| Setting | Request | Limit | Notes |
|---------|---------|-------|-------|
| CPU | 100m | 500m | Scales linearly with RPS |
| Memory | 64 Mi | 256 Mi | In-memory route/policy cache |
| Replicas | 2 | -- | HA: min 2 in production |
| Disk | None | -- | Stateless; CP API is source of truth |

The Gateway is the lightest component. A single instance handles thousands of requests per second on 100m CPU. Increase CPU limits for high-throughput workloads; memory stays low regardless of traffic.

### Control Plane API (Python / FastAPI)

| Setting | Request | Limit | Notes |
|---------|---------|-------|-------|
| CPU | 200m | 1000m | Scales with API management operations |
| Memory | 256 Mi | 512 Mi | SQLAlchemy connection pool |
| Replicas | 2 | -- | HA: min 2 in production |
| Disk | None | -- | State in PostgreSQL |

### Keycloak (Java)

| Setting | Request | Limit | Notes |
|---------|---------|-------|-------|
| CPU | 500m | 2000m | JVM startup is CPU-intensive |
| Memory | 512 Mi | 1536 Mi | JVM heap: set to 50-75% of memory limit |
| Replicas | 1 | -- | Single instance sufficient for most deployments |
| Disk | None | -- | State in PostgreSQL |

Keycloak is the heaviest component. For deployments under 1,000 concurrent users, a single instance is sufficient. Scale horizontally with Infinispan cache for larger deployments.

### Console UI (React / nginx)

| Setting | Request | Limit | Notes |
|---------|---------|-------|-------|
| CPU | 50m | 200m | Static file serving |
| Memory | 64 Mi | 128 Mi | nginx worker processes |
| Replicas | 1-2 | -- | CDN recommended for production |

### Developer Portal (React / nginx)

| Setting | Request | Limit | Notes |
|---------|---------|-------|-------|
| CPU | 50m | 200m | Static file serving |
| Memory | 64 Mi | 128 Mi | nginx worker processes |
| Replicas | 1-2 | -- | CDN recommended for production |

### PostgreSQL

| Workload | CPU | Memory | Disk |
|----------|-----|--------|------|
| Small (< 100 APIs) | 500m | 512 Mi | 5 Gi |
| Medium (100-1,000 APIs) | 2000m | 4 Gi | 20 Gi |
| Large (1,000+ APIs) | 4000m+ | 8 Gi+ | 50 Gi+ |

A managed PostgreSQL service is recommended for production. A single instance serves both the Control Plane API and Keycloak.

## Container Image Sizes

| Component | Base Image | Compressed Size |
|-----------|-----------|----------------|
| stoa-gateway | `debian:bookworm-slim` | ~30 MB |
| control-plane-api | `python:3.11-slim` | ~180 MB |
| console | `nginx:alpine` | ~40 MB |
| portal | `nginx:alpine` | ~40 MB |
| keycloak | `quay.io/keycloak/keycloak:23.0` | ~400 MB |

All images are published to `ghcr.io/stoa-platform/` and support `linux/amd64`.

## External Dependencies

### PostgreSQL 15+

Required for Control Plane API and Keycloak.

| Concurrent Users | Recommended | Disk |
|-----------------|-------------|------|
| < 500 | 1 vCPU, 1 GB | 5 Gi |
| 500-5,000 | 2 vCPU, 4 GB | 20 Gi |
| 5,000+ | 4 vCPU, 8 GB | 50 Gi+ |

### Keycloak 23+

Authentication and RBAC. JVM heap should be 50-75% of container memory limit.

| Concurrent Users | Heap | CPU |
|-----------------|------|-----|
| < 500 | 512 MB | 500m |
| 500-5,000 | 1 GB | 1000m |
| 5,000+ | 2 GB | 2000m |

### OpenSearch 2.x (optional)

API analytics and log aggregation. Not required for core functionality.

| Log Volume | Heap | Disk |
|------------|------|------|
| < 1 GB/day | 512 MB | 10 Gi |
| 1-10 GB/day | 2 GB | 50 Gi |
| 10+ GB/day | 4 GB | 200 Gi+ |

### Prometheus + Grafana (optional)

Metrics and dashboards. Minimal overhead for most deployments.

| Component | CPU | Memory |
|-----------|-----|--------|
| Prometheus | 100m | 256 Mi |
| Grafana | 100m | 128 Mi |

## Scaling Guidance

### When to Scale Horizontally

| Signal | Action |
|--------|--------|
| Gateway CPU > 70% sustained | Add Gateway replicas |
| API response time P99 > 100 ms (gateway overhead) | Add Gateway replicas |
| CP API response time > 500 ms | Add CP API replicas |

### When to Scale Vertically

| Signal | Action |
|--------|--------|
| Gateway memory > 200 Mi | Increase limit (large route tables) |
| Keycloak startup > 120s | Increase CPU limit |
| PostgreSQL slow queries | Increase `shared_buffers` and RAM |
| OOM kills in any pod | Increase memory limit by 50% |

## Network Requirements

### Ports

| Port | Component | Protocol | Notes |
|------|-----------|----------|-------|
| 8080 | Gateway | HTTP | Runtime proxy + admin API |
| 8000 | CP API | HTTP | Control plane REST API |
| 8443 | Keycloak | HTTPS | Authentication (OIDC) |
| 80/443 | Console/Portal | HTTP/S | Web UIs (via ingress) |
| 5432 | PostgreSQL | TCP | Database |
| 9200 | OpenSearch | HTTP | Analytics (optional) |
| 9090 | Prometheus | HTTP | Metrics (optional) |

### Bandwidth

- Gateway overhead per proxied request: ~1 KB (headers, logging)
- Metrics scrape: negligible

### TLS

Production deployments should terminate TLS at the ingress controller. STOA supports:

- **cert-manager** with Let's Encrypt (recommended for Kubernetes)
- Manual certificate provisioning
- mTLS between Gateway and upstream APIs ([ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens))

## FAQ

### How much RAM does STOA Gateway need?

The Gateway runs with as little as 64 MB of RAM. The default Kubernetes request is 64 Mi with a limit of 256 Mi. Memory usage grows with the number of registered APIs and cached policies. For 1,000 APIs, expect ~100 MB.

### Can STOA run on a Raspberry Pi?

STOA Gateway compiles for `linux/arm64` and runs on ARM devices. A Raspberry Pi 4 (4 GB) can run the Gateway standalone. The full platform (with Keycloak and PostgreSQL) needs at least 4 GB RAM, so a Pi 4 with 8 GB is recommended for the complete stack.

### What is the minimum production deployment?

A single VPS with 2 vCPU and 4 GB RAM can run the Gateway standalone and handle thousands of requests per second. For HA with the full platform, start with 3 Kubernetes nodes (4 vCPU, 8 GB each).

### How does STOA compare in resource usage?

STOA Gateway's Rust runtime uses significantly less memory than JVM-based gateways. A single STOA Gateway instance (64 Mi default) handles comparable throughput to gateways that typically require 256 Mi-1 Gi. See [Performance Benchmarks](/docs/reference/performance-benchmarks) for detailed measurements.
