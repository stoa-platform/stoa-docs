---
sidebar_position: 38
title: "ADR-038: Sidecar Deployment on VM Infrastructure"
description: "Decides the sidecar deployment strategies for running STOA Gateway alongside applications on VM-based infrastructure without Kubernetes."
keywords: [sidecar, VM deployment, systemd, gateway, non-Kubernetes, infrastructure]
---

# ADR-038: Sidecar Deployment Strategies on VM-Based Infrastructure

## Status

Proposed

## Date

2026-02-08

## Context

STOA Gateway supports 4 deployment modes (`shadow`, `proxy`, `edge-mcp`, `sidecar`) as defined in [ADR-024](./adr-024-gateway-unified-modes.md) (CAB-958). The **sidecar mode** is specifically designed to coexist with existing third-party gateways (webMethods, Kong, Apigee) without replacing them.

A critical gap exists: many enterprise clients — particularly in banking, insurance, and public sector — run their gateways on **bare-metal or VM infrastructure** (RHEL, CentOS, Windows Server), not Kubernetes. The sidecar pattern originates from the service mesh / Kubernetes world (Envoy, Istio, Linkerd), but the vast majority of STOA's target clients are **not on Kubernetes** for their API gateway layer.

### The Problem

> "Our webMethods gateway runs on a RHEL 8 VM. How do we deploy the STOA sidecar?"
> — Every regulated enterprise prospect

We need a clear, opinionated deployment strategy for sidecar mode on VM-based infrastructure, with fallback options for environments where Docker/Podman is not permitted.

### Constraints

- Zero modification to the existing gateway (webMethods, Kong, Apigee)
- Zero downtime during sidecar deployment
- Compatible with enterprise change management processes (CAB approval, rollback plan)
- Must work in air-gapped or restricted network environments
- Must support existing monitoring stacks (Nagios, Zabbix, SCOM) alongside STOA observability

## Decision

We support **three deployment strategies** for sidecar mode on VM infrastructure, with a clear recommendation order:

### Strategy A: Container on Host (RECOMMENDED)

Deploy `stoa-gateway --mode=sidecar` as a Docker/Podman container on the same VM as the existing gateway.

```
┌──────────────────────────────────────────────┐
│                    VM (RHEL/CentOS)           │
│                                               │
│  ┌─────────────────┐   ┌──────────────────┐  │
│  │   webMethods     │   │  stoa-gateway    │  │
│  │   Gateway        │   │  (container)     │  │
│  │                  │   │                  │  │
│  │   :5555 (HTTP)   │◄──│  :8080 (proxy)   │  │
│  │   :9999 (admin)  │   │  :9090 (metrics) │  │
│  └─────────────────┘   └──────────────────┘  │
│                                               │
│          localhost / bridge network           │
└──────────────────────────────────────────────┘
         │
         │ metrics (outbound HTTPS)
         ▼
┌──────────────────┐
│  STOA Control    │
│  Plane (cloud)   │
└──────────────────┘
```

**Configuration:**

```yaml
# docker-compose.yml (or podman equivalent)
services:
  stoa-sidecar:
    image: ghcr.io/hlfh/stoa-gateway:latest
    command: ["--mode=sidecar"]
    network_mode: host  # or bridge with port mapping
    restart: unless-stopped
    environment:
      STOA_UPSTREAM_HOST: "localhost"
      STOA_UPSTREAM_PORT: "5555"
      STOA_CONTROL_PLANE_URL: "https://cp.gostoa.dev"
      STOA_TENANT_ID: "${TENANT_ID}"
    volumes:
      - ./stoa-gateway.yaml:/etc/stoa/gateway.yaml:ro
      - ./certs:/etc/stoa/certs:ro
    ports:
      - "8080:8080"   # Sidecar proxy port
      - "9090:9090"   # Prometheus metrics
```

**Pros:**
- Isolation between sidecar and gateway processes (different filesystem, libs, runtime)
- Independent update cycle — upgrade sidecar without touching gateway
- Rollback = `docker stop stoa-sidecar` (instant)
- Image signature verification (Cosign/Notary)
- Resource limits via cgroups (`--memory=512m --cpus=0.5`)
- Compatible with existing container registries and CI/CD pipelines
- Works with Podman (rootless) for environments that prohibit Docker daemon

**Cons:**
- Requires Docker or Podman runtime on the VM
- Some organizations have policies prohibiting containers on "legacy" VMs
- Slight additional resource overhead (~50MB RAM baseline)

**When to use:** Default choice. Works for 80%+ of enterprise environments.

### Strategy B: Native Binary (FALLBACK)

Deploy `stoa-gateway` as a native Linux binary managed by systemd. No container runtime required.

```
┌──────────────────────────────────────────────┐
│                    VM (RHEL/CentOS)           │
│                                               │
│  ┌─────────────────┐   ┌──────────────────┐  │
│  │   webMethods     │   │  stoa-gateway    │  │
│  │   (JVM process)  │   │  (native binary) │  │
│  │                  │   │                  │  │
│  │   :5555          │◄──│  :8080           │  │
│  └─────────────────┘   └──────────────────┘  │
│                                               │
│  systemctl start stoa-gateway                 │
└──────────────────────────────────────────────┘
```

**Configuration:**

```ini
# /etc/systemd/system/stoa-gateway.service
[Unit]
Description=STOA Gateway Sidecar
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=stoa
Group=stoa
ExecStart=/opt/stoa/bin/stoa-gateway --mode=sidecar --config=/etc/stoa/gateway.yaml
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/stoa /var/lib/stoa
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Pros:**
- Zero dependency on container runtime
- Familiar to ops teams managing traditional infrastructure (systemd, RPM/DEB)
- Minimal attack surface — single static binary (Rust target: `x86_64-unknown-linux-musl`)
- Smallest resource footprint (~30MB RAM)
- Compatible with SELinux, AppArmor policies
- Distributable as RPM/DEB package or tarball

**Cons:**
- Less isolation than container (shared filesystem, libs)
- Update requires binary replacement + service restart
- Must match target OS architecture (provide `x86_64` + `aarch64` builds)
- No built-in resource limits (must use systemd cgroups or cgroup v2 manually)

**When to use:** When container runtime is prohibited by security policy. Common in central banks, defense, and highly regulated environments.

### Strategy C: Adjacent VM (EDGE CASE)

Deploy `stoa-gateway` on a dedicated lightweight VM, proxying traffic to the gateway VM.

```
┌────────────────────┐         ┌────────────────────┐
│  VM-1 (Gateway)    │         │  VM-2 (STOA)       │
│                    │         │                    │
│  ┌──────────────┐  │  network│  ┌──────────────┐  │
│  │  webMethods   │◄─┼────────┼──│ stoa-gateway  │  │
│  │  :5555        │  │        │  │ :8080         │  │
│  └──────────────┘  │        │  └──────────────┘  │
└────────────────────┘         └────────────────────┘
```

**Pros:**
- Total isolation — gateway VM completely untouched
- Independent lifecycle management
- Simplifies change management approval (no modification to production VM)

**Cons:**
- Network latency between VMs (1-5ms depending on infrastructure)
- More complex networking (firewall rules, VLANs)
- Not a true "sidecar" pattern — this is a reverse proxy / node proxy
- Additional VM cost and management overhead
- Must handle VM-2 failure independently (no shared fate with gateway)

**When to use:** Only when absolutely no software can be installed on the gateway VM. Rare in practice, but required for some legacy mainframe-adjacent architectures.

## Decision Matrix

| Criterion                  | A: Container  | B: Native Binary | C: Adjacent VM |
|----------------------------|:-------------:|:----------------:|:--------------:|
| Isolation                  | ★★★★☆        | ★★★☆☆           | ★★★★★          |
| Ease of deployment         | ★★★★★        | ★★★★☆           | ★★★☆☆          |
| Ease of rollback           | ★★★★★        | ★★★★☆           | ★★★★☆          |
| Resource overhead          | ★★★★☆        | ★★★★★           | ★★★☆☆          |
| Network latency            | ★★★★★        | ★★★★★           | ★★★☆☆          |
| Change management friction | ★★★★☆        | ★★★★☆           | ★★★★★          |
| Enterprise acceptance      | ★★★★☆        | ★★★★★           | ★★★☆☆          |
| Air-gapped support         | ★★★★☆        | ★★★★★           | ★★★★☆          |

**Recommendation:** A > B > C (try in order, fall back only if blocked by policy)

## Traffic Interception Patterns

Regardless of deployment strategy, the sidecar must intercept traffic. Two patterns:

### Pattern 1: Explicit Proxy (RECOMMENDED)

Consumers are configured to send traffic to the sidecar port instead of the gateway directly. The sidecar forwards to the gateway after processing.

```
Consumer → :8080 (stoa-sidecar) → :5555 (webMethods) → Backend
```

- Requires consumer reconfiguration (DNS alias or load balancer update)
- Full visibility on request AND response
- Can enforce policies before traffic reaches gateway

### Pattern 2: Passive Tap (Shadow-compatible)

Traffic flows normally to the gateway. The sidecar receives a mirrored copy via port mirroring, iptables TPROXY, or application-level duplication.

```
Consumer → :5555 (webMethods) → Backend
                    │
                    └── mirror → :8080 (stoa-sidecar, read-only)
```

- Zero consumer reconfiguration
- Read-only — cannot enforce, only observe
- Ideal for initial rollout + UAC contract generation (shadow mode)
- Can transition to Pattern 1 once trust is established

## Consequences

### Positive

- Clear deployment guide for every client infrastructure type
- No hard dependency on Kubernetes — removes adoption blocker for 70%+ of enterprise targets
- Progressive path: Passive Tap (shadow) → Explicit Proxy (sidecar) → Full STOA (proxy mode)
- RPM/DEB packaging opens traditional enterprise distribution channels
- Competitive advantage: neither Kong nor Apigee document VM sidecar deployment patterns

### Negative

- Three strategies to maintain, test, and document
- Native binary requires cross-compilation pipeline (Rust `musl` targets)
- Must provide installation scripts / Ansible roles for each strategy
- Container strategy depends on client's Docker/Podman version compatibility

## Alternatives Considered

### Kubernetes DaemonSet

Standard sidecar injection via Kubernetes admission controller. Rejected because the target audience for sidecar mode is explicitly non-Kubernetes infrastructure. If the client has Kubernetes, they should use `proxy` or `edge-mcp` mode with Helm chart deployment.

### Java Agent (JVM Instrumentation)

Attach to the gateway's JVM process (e.g., webMethods IS runs on JVM). Rejected because it modifies the gateway runtime, creates coupling with gateway JVM version, and violates the "zero modification" constraint. Also doesn't work for non-JVM gateways.

### eBPF-based Sidecar

Use eBPF programs to intercept traffic at kernel level without a proxy process. Deferred to post-Rust migration (Phase 19+). Requires Linux kernel 5.10+ and elevated privileges. Very promising for the passive tap pattern but premature for MVP.

## Implementation Plan

| Phase | Deliverable | Target |
|-------|-------------|--------|
| MVP (Feb 2026) | Strategy A: Docker Compose + sample configs | Demo 24/02 |
| v0.2 | Strategy B: Static binary + systemd unit + RPM | Q2 2026 |
| v0.3 | Strategy C: Adjacent VM Ansible role | Q3 2026 |
| v1.0 | eBPF passive tap (post-Rust migration) | Q4 2026+ |

## References

- [ADR-024: Unified Gateway Architecture with Mode-Based Configuration](./adr-024-gateway-unified-modes.md) (CAB-958)
- [Envoy Sidecar Deployment on VMs](https://www.envoyproxy.io/docs/envoy/latest/start/sandboxes/)
- [Consul Connect on VMs](https://developer.hashicorp.com/consul/docs/connect)
- [HashiCorp Nomad — Non-Kubernetes Sidecar Pattern](https://www.nomadproject.io/)
- RFC 8693 — OAuth 2.0 Token Exchange (for sidecar authentication)
