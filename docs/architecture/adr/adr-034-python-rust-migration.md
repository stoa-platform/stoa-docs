---
sidebar_position: 34
title: "ADR-034: Python to Rust Migration Strategy"
description: "Decides the phased migration strategy from Python MCP Gateway to Rust-based STOA Gateway for performance and safety improvements."
keywords: [Python, Rust, migration, gateway, performance, safety, Tokio]
---

import MigrationArchitecture from '@site/src/components/MigrationArchitecture';

# ADR-034: Python to Rust Migration Strategy

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | N/A (Strategic) |
| **Related** | ADR-024 (Gateway Unified Modes) |

## Context

The MCP Gateway is currently implemented in Python (FastAPI). While Python excels at rapid development, Rust offers:

- **Performance** — Lower latency, higher throughput
- **Memory Safety** — No GC pauses, predictable performance
- **Native OPA** — regorus library for embedded policy evaluation
- **Single Binary** — Simplified deployment

### The Problem

> "How do we migrate from Python to Rust without disrupting production?"

## Decision

Implement a **phased migration** with shadow validation, targeting Q4 2026 for full Rust deployment.

### Migration Phases

<MigrationArchitecture />

### Phase Details

| Phase | Timeline | Scope | Validation |
|-------|----------|-------|------------|
| **1** | Q1 2026 | Python production | Baseline metrics |
| **2** | Q2 2026 | Rust edge-mcp mode | Shadow mirror |
| **3** | Q3 2026 | Rust proxy + sidecar | Canary deployment |
| **4** | Q4 2026 | Rust shadow mode | Full migration |

## Shadow Mirror Validation

During Phase 2, both implementations run in parallel:

*See the interactive **Shadow Validation** tab above for the full request flow and comparison metrics.*

## Feature Parity Checklist

| Feature | Python | Rust | Status |
|---------|--------|------|--------|
| MCP SSE Transport | ✅ | 🔄 | In progress |
| Tool Registry | ✅ | 📋 | Planned |
| OPA Policy Evaluation | ✅ (sidecar) | ✅ (regorus) | Complete |
| Semantic Cache | ✅ | 📋 | Planned |
| Error Snapshots | ✅ | 📋 | Planned |
| K8s CRD Watcher | ✅ | 📋 | Planned |
| OpenTelemetry | ✅ | 🔄 | API stabilizing |
| Keycloak JWT | ✅ | 📋 | Planned |

## Rust Implementation Structure

```
stoa-gateway/
├── src/
│   ├── main.rs                 # Entry point, --mode flag
│   ├── modes/
│   │   ├── mod.rs              # Mode trait
│   │   ├── edge_mcp.rs         # MCP protocol
│   │   ├── sidecar.rs          # Behind existing gateway
│   │   ├── proxy.rs            # Inline enforcement
│   │   └── shadow.rs           # Traffic observation
│   ├── auth/
│   │   └── oidc.rs             # Keycloak JWT validation
│   ├── policy/
│   │   └── opa.rs              # regorus integration
│   └── observability/
│       └── metrics.rs          # Prometheus
├── Cargo.toml
└── Dockerfile
```

## Rollback Plan

If Rust implementation shows issues:

1. **Immediate** — Route 100% to Python via load balancer
2. **Investigation** — Compare shadow logs
3. **Fix** — Patch Rust, redeploy shadow
4. **Validate** — 48h shadow validation
5. **Resume** — Gradual traffic shift

## Performance Targets

| Metric | Python | Rust Target | Improvement |
|--------|--------|-------------|-------------|
| P50 latency | 15ms | 5ms | 3x |
| P99 latency | 80ms | 20ms | 4x |
| RPS per pod | 1000 | 5000 | 5x |
| Memory | 512MB | 64MB | 8x |
| Cold start | 3s | 100ms | 30x |

## Consequences

### Positive

- **Performance** — Significant latency reduction
- **Cost** — Fewer pods needed for same throughput
- **Reliability** — Memory safety, no GC pauses
- **Native OPA** — regorus eliminates sidecar

### Negative

- **Development Velocity** — Rust slower to write
- **Dual Maintenance** — Two codebases during migration
- **Team Skills** — Rust learning curve

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Velocity | Python for experiments, Rust for stable features |
| Dual maintenance | Feature freeze on Python post-Phase 2 |
| Skills | Internal Rust training, code reviews |

## References

- [stoa-gateway/](https://github.com/stoa-platform/stoa/tree/main/stoa-gateway/)
- [ADR-024 — Unified Gateway Architecture](./adr-024-gateway-unified-modes.md)
- [regorus — Rust OPA Engine](https://github.com/microsoft/regorus)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
