---
sidebar_position: 25
title: "ADR-025: Gateway Resilience — Anti-Zombie Node Pattern"
description: "Decides the anti-zombie node pattern with deep readiness probes, last-gasp logging, and anomaly detection for gateway resilience."
keywords: [gateway resilience, zombie nodes, readiness probes, anomaly detection, reliability]
---

# ADR-025: Gateway Resilience — Anti-Zombie Node Pattern

## Metadata

| Field | Value |
|-------|-------|
| **Status** | 📋 Proposed |
| **Date** | 2026-01-26 |
| **Linear** | [CAB-957](https://linear.app/hlfh-workspace/issue/CAB-957) |
| **Related ADRs** | [ADR-023](./adr-023-zero-blind-spot-observability.md), [ADR-024](./adr-024-gateway-unified-modes.md) |

## Context

### The Zombie Node Problem

A **Zombie Node** is a gateway instance that:
- Process is alive (PID exists)
- Health check (`/health`) returns 200 OK
- **But requests fail silently** (500 errors, timeouts, or incorrect responses)

The load balancer continues routing traffic to the zombie, causing **silent degradation** across the cluster.

### Real Incident: Enterprise API Gateway

> During a rolling update at a major banking client, a webMethods gateway node reported healthy status, but its API activations had failed. The node returned 500 errors for all business requests while passing health probes.
>
> **Impact:** 15 minutes of partial outage, 23% of requests failed, SLA breach triggered penalty clause.
>
> **Root cause:** Health endpoint checked "process alive" but not "APIs actually routable."

### Why Standard Health Checks Fail

| Check Type | What It Validates | Zombie Detection |
|------------|-------------------|------------------|
| TCP probe | Port open | ❌ No |
| HTTP `/health` | Process responds | ❌ No |
| Readiness probe | Config loaded | ⚠️ Partial |
| **Deep readiness** | Actual routability | ✅ Yes |

## Decision

Implement a **5-component Anti-Zombie pattern** covering both Native (STOA Gateway) and Hybrid (third-party gateways) deployments.

### Architecture Overview

```
                    ┌─────────────────────────────────────────────────────┐
                    │              Anti-Zombie Pattern                     │
                    └─────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Deep Readiness │             │   Last Gasp     │             │  K8s Circuit    │
│     Probe       │             │    Logging      │             │    Breaker      │
│                 │             │                 │             │                 │
│  /ready tests   │             │  503 + headers  │             │ maxUnavailable  │
│  actual routing │             │  + metrics      │             │ minReadySeconds │
└─────────────────┘             └─────────────────┘             └─────────────────┘
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Error Snapshot │             │ Health Aggregator│            │ Anomaly         │
│  Integration    │             │ (Hybrid Mode)    │            │ Detection       │
│                 │             │                  │            │                 │
│  Auto-capture   │             │  Poll 3rd-party  │            │ Traffic vs      │
│  on not_ready   │             │  gateway APIs    │            │ success rate    │
└─────────────────┘             └──────────────────┘            └─────────────────┘
```

---

## Component 1: Deep Readiness Probe (Native)

### Principle

The `/ready` endpoint must validate **actual routability**, not just "config loaded."

### Implementation

```yaml
# stoa-gateway.yaml
gateway:
  probes:
    readiness:
      enabled: true
      path: /ready
      port: 3001
      interval: 5s
      timeout: 3s
      failure_threshold: 2

      # Deep checks (all must pass)
      checks:
        database:
          enabled: true
          query: "SELECT 1"
          timeout: 1s

        keycloak:
          enabled: true
          endpoint: /realms/stoa/.well-known/openid-configuration
          timeout: 2s

        internal_route:
          enabled: true
          # Test actual routing, not just config
          method: GET
          path: /__internal/ping
          expected_status: 200
          timeout: 1s

        upstream_sample:
          enabled: true
          # Verify at least one upstream is reachable
          sample_size: 1
          timeout: 2s
```

### Rust Implementation

```rust
// src/probes/readiness.rs

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

#[derive(Serialize)]
pub struct ReadinessResponse {
    ready: bool,
    checks: ReadinessChecks,
    timestamp: String,
}

#[derive(Serialize)]
pub struct ReadinessChecks {
    database: CheckResult,
    keycloak: CheckResult,
    internal_route: CheckResult,
    upstream_sample: CheckResult,
}

#[derive(Serialize)]
pub struct CheckResult {
    status: &'static str,  // "ok" | "fail" | "degraded"
    latency_ms: u64,
    message: Option<String>,
}

pub async fn readiness_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let checks = ReadinessChecks {
        database: check_database(&state.db_pool).await,
        keycloak: check_keycloak(&state.keycloak_client).await,
        internal_route: check_internal_route(&state.router).await,
        upstream_sample: check_upstream_sample(&state.upstreams).await,
    };

    let all_ok = checks.database.status == "ok"
        && checks.keycloak.status == "ok"
        && checks.internal_route.status == "ok"
        && checks.upstream_sample.status == "ok";

    let response = ReadinessResponse {
        ready: all_ok,
        checks,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    if all_ok {
        (StatusCode::OK, Json(response))
    } else {
        // Return 503 so K8s removes from service
        (StatusCode::SERVICE_UNAVAILABLE, Json(response))
    }
}
```

### Difference: Liveness vs Readiness

| Probe | Purpose | Failure Action | Checks |
|-------|---------|----------------|--------|
| `/health` (liveness) | Process alive? | Kill & restart pod | Process, memory |
| `/ready` (readiness) | Can serve traffic? | Remove from LB | DB, auth, routes |

---

## Component 2: Last Gasp Logging (Native)

### Principle

A node in **not-ready** state that still receives requests MUST:
1. **Log the request** (for debugging)
2. **Return 503** (not 500)
3. **Include diagnostic headers**
4. **Emit metrics**

### Response Format

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
X-STOA-Node-Status: degraded
X-STOA-Node-ID: gateway-7f8b9c-2xk4m
X-STOA-Readiness-Failed: keycloak,upstream_sample
Retry-After: 30

{
  "error": "service_unavailable",
  "code": "GATEWAY_NOT_READY",
  "message": "This gateway node is not ready to serve requests",
  "node_id": "gateway-7f8b9c-2xk4m",
  "failed_checks": ["keycloak", "upstream_sample"],
  "retry_after_seconds": 30,
  "timestamp": "2026-01-26T14:32:00Z"
}
```

### Rust Implementation

```rust
// src/middleware/last_gasp.rs

use axum::{
    middleware::Next,
    http::{Request, Response, StatusCode, HeaderValue},
    body::Body,
};
use prometheus::{IntCounterVec, labels};

lazy_static! {
    static ref REJECTED_REQUESTS: IntCounterVec = register_int_counter_vec!(
        "gateway_requests_rejected_total",
        "Requests rejected by not-ready node",
        &["reason", "node_id", "path"]
    ).unwrap();
}

pub async fn last_gasp_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    // Check if node is ready
    if !state.readiness.load(Ordering::SeqCst) {
        // Log the request we couldn't serve
        tracing::warn!(
            path = %request.uri().path(),
            method = %request.method(),
            node_id = %state.node_id,
            "Last gasp: received request while not ready"
        );

        // Increment metric
        REJECTED_REQUESTS
            .with_label_values(&[
                "not_ready",
                &state.node_id,
                request.uri().path(),
            ])
            .inc();

        // Return 503 with diagnostic headers
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .header("X-STOA-Node-Status", "degraded")
            .header("X-STOA-Node-ID", &state.node_id)
            .header("X-STOA-Readiness-Failed", state.failed_checks())
            .header("Retry-After", "30")
            .body(last_gasp_body(&state))
            .unwrap();
    }

    next.run(request).await
}
```

### Prometheus Metrics

```prometheus
# HELP gateway_requests_rejected_total Requests rejected by not-ready node
# TYPE gateway_requests_rejected_total counter
gateway_requests_rejected_total{reason="not_ready",node_id="gateway-7f8b9c-2xk4m",path="/api/v1/accounts"} 47
gateway_requests_rejected_total{reason="not_ready",node_id="gateway-7f8b9c-2xk4m",path="/api/v1/transfers"} 23

# HELP gateway_readiness_check_duration_seconds Duration of readiness checks
# TYPE gateway_readiness_check_duration_seconds histogram
gateway_readiness_check_duration_seconds_bucket{check="database",le="0.1"} 9823
gateway_readiness_check_duration_seconds_bucket{check="keycloak",le="0.5"} 9801

# HELP gateway_readiness_status Current readiness status (1=ready, 0=not ready)
# TYPE gateway_readiness_status gauge
gateway_readiness_status{node_id="gateway-7f8b9c-2xk4m"} 0
```

### AlertManager Rule

```yaml
# alertmanager/rules/zombie.yaml
groups:
  - name: zombie_detection
    rules:
      - alert: GatewayZombieNode
        expr: |
          increase(gateway_requests_rejected_total{reason="not_ready"}[5m]) > 10
          AND
          gateway_readiness_status == 0
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Zombie node detected: {{ $labels.node_id }}"
          description: "Node {{ $labels.node_id }} is not ready but receiving traffic. {{ $value }} requests rejected in 5 minutes."
          runbook: https://docs.gostoa.dev/runbooks/zombie-node
```

---

## Component 3: Circuit Breaker K8s Configuration

### Deployment Strategy

```yaml
# k8s/gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stoa-gateway
  namespace: stoa-system
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # CRITICAL: Never have 0 ready pods during update
      maxUnavailable: 0
      maxSurge: 1

  # Wait for stability before marking ready
  minReadySeconds: 30

  template:
    spec:
      containers:
        - name: gateway
          image: ghcr.io/hlfh/stoa-gateway:latest

          # Liveness: is the process alive?
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3

          # Readiness: can it serve traffic?
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 2
            # Aggressive timeout to catch slow zombies
            timeoutSeconds: 3

          # Startup: give time for initialization
          startupProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30  # 150s max startup time
```

### PodDisruptionBudget

```yaml
# k8s/gateway/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: stoa-gateway-pdb
  namespace: stoa-system
spec:
  # Always keep at least 2 pods available
  minAvailable: 2
  selector:
    matchLabels:
      app: stoa-gateway
```

### Graceful Shutdown

```yaml
# In deployment.yaml spec.template.spec
terminationGracePeriodSeconds: 60

lifecycle:
  preStop:
    exec:
      command:
        - /bin/sh
        - -c
        - |
          # Mark not ready immediately
          touch /tmp/shutdown
          # Wait for load balancer to drain
          sleep 15
          # Graceful shutdown signal
          kill -SIGTERM 1
```

---

## Component 4: Error Snapshot Integration

### Principle

When a node transitions to **not-ready**, automatically capture context for debugging.

### Kafka Event

```json
{
  "event_type": "gateway.readiness.changed",
  "timestamp": "2026-01-26T14:32:00.123Z",
  "node_id": "gateway-7f8b9c-2xk4m",
  "namespace": "stoa-system",
  "cluster": "prod-eu-west-1",

  "transition": {
    "from": "ready",
    "to": "not_ready",
    "duration_ready_ms": 3600000
  },

  "failed_checks": [
    {
      "name": "keycloak",
      "error": "connection timeout after 2000ms",
      "latency_ms": 2001
    },
    {
      "name": "upstream_sample",
      "error": "0/5 upstreams reachable",
      "details": {
        "upstream_count": 5,
        "reachable": 0,
        "unreachable": ["svc-a:8080", "svc-b:8080", "svc-c:8080", "svc-d:8080", "svc-e:8080"]
      }
    }
  ],

  "snapshot": {
    "active_connections": 142,
    "requests_in_flight": 23,
    "memory_mb": 512,
    "cpu_percent": 45,
    "goroutines": 1247,
    "last_successful_request": "2026-01-26T14:31:55.000Z",
    "config_version": "v2.3.1-abc123",
    "uptime_seconds": 86400
  },

  "recent_errors": [
    {
      "timestamp": "2026-01-26T14:31:58.000Z",
      "path": "/api/v1/accounts",
      "status": 502,
      "error": "upstream connection refused"
    }
  ]
}
```

### Integration with ADR-023 (Zero Blind Spot)

```rust
// src/observability/snapshot.rs

pub async fn capture_error_snapshot(
    state: &AppState,
    reason: ReadinessFailure,
) -> ErrorSnapshot {
    let snapshot = ErrorSnapshot {
        node_id: state.node_id.clone(),
        timestamp: Utc::now(),
        failed_checks: reason.checks,
        active_connections: state.connection_pool.active_count(),
        requests_in_flight: state.inflight_requests.load(Ordering::SeqCst),
        recent_errors: state.error_buffer.drain().collect(),
        // ... additional fields
    };

    // Emit to Kafka for centralized analysis
    state.kafka_producer
        .send("stoa.gateway.snapshots", &snapshot)
        .await;

    // Also log locally for immediate access
    tracing::error!(
        snapshot = ?snapshot,
        "Error snapshot captured on readiness failure"
    );

    snapshot
}
```

---

## Component 5: Hybrid Mode (Third-Party Gateways)

For deployments where STOA operates as a sidecar behind Kong, IBM webMethods, or Apigee.

### Health Aggregator

```yaml
# stoa-gateway.yaml (sidecar mode)
gateway:
  mode: sidecar

  health_aggregator:
    enabled: true
    poll_interval: 5s

    adapters:
      kong:
        type: kong
        admin_url: http://kong-admin:8001
        endpoints:
          status: /status
          health: /health
        metrics_path: /metrics  # Prometheus plugin

      webmethods:
        type: webmethods
        admin_url: https://webmethods-is:5555
        auth:
          type: basic
          secret_ref: webmethods-admin-credentials
        endpoints:
          server_status: /invoke/wm.server/getServerStatistics
          package_status: /invoke/wm.server.packages/packageList

      apigee:
        type: apigee
        management_url: https://api.enterprise.apigee.com
        auth:
          type: oauth2
          secret_ref: apigee-service-account
        organization: my-org
        environment: prod

      generic:
        type: openmetrics
        scrape_url: http://custom-gateway:9090/metrics
        metrics:
          - name: gateway_requests_total
          - name: gateway_errors_total
          - name: gateway_upstream_health
```

### Adapter Implementations

#### Kong Adapter

```rust
// src/adapters/kong.rs

pub struct KongAdapter {
    admin_client: reqwest::Client,
    admin_url: String,
}

impl GatewayAdapter for KongAdapter {
    async fn check_health(&self) -> AdapterHealthResult {
        // Check Kong node status
        let status: KongStatus = self.admin_client
            .get(format!("{}/status", self.admin_url))
            .send()
            .await?
            .json()
            .await?;

        // Check database connectivity
        let db_reachable = status.database.reachable;

        // Check upstream targets
        let upstreams = self.get_upstream_health().await?;
        let healthy_targets = upstreams.iter()
            .filter(|u| u.health == "HEALTHY")
            .count();

        AdapterHealthResult {
            gateway_type: "kong",
            healthy: db_reachable && healthy_targets > 0,
            checks: vec![
                Check::new("database", db_reachable),
                Check::new("upstreams", healthy_targets > 0),
            ],
            metrics: KongMetrics {
                connections_active: status.server.connections_active,
                connections_accepted: status.server.connections_accepted,
                total_requests: status.server.total_requests,
            },
        }
    }
}
```

#### webMethods Adapter

```rust
// src/adapters/webmethods.rs

pub struct WebMethodsAdapter {
    is_client: reqwest::Client,
    is_url: String,
}

impl GatewayAdapter for WebMethodsAdapter {
    async fn check_health(&self) -> AdapterHealthResult {
        // Get server statistics
        let stats: WmServerStats = self.is_client
            .get(format!("{}/invoke/wm.server/getServerStatistics", self.is_url))
            .send()
            .await?
            .json()
            .await?;

        // CRITICAL: Check if APIs are actually activated
        // This was the root cause of the zombie incident
        let packages: WmPackageList = self.is_client
            .get(format!("{}/invoke/wm.server.packages/packageList", self.is_url))
            .send()
            .await?
            .json()
            .await?;

        let api_packages_enabled = packages.packages.iter()
            .filter(|p| p.name.starts_with("API_"))
            .all(|p| p.enabled);

        AdapterHealthResult {
            gateway_type: "webmethods",
            healthy: stats.server_running && api_packages_enabled,
            checks: vec![
                Check::new("server_running", stats.server_running),
                Check::new("api_packages_enabled", api_packages_enabled),  // The zombie killer
                Check::new("license_valid", stats.license_days_remaining > 0),
            ],
            warnings: if !api_packages_enabled {
                vec!["API packages not enabled - potential zombie state".to_string()]
            } else {
                vec![]
            },
        }
    }
}
```

### Anomaly Detection

Detect zombies even when health endpoints lie:

```rust
// src/detection/anomaly.rs

pub struct AnomalyDetector {
    window: Duration,
    threshold: f64,
}

impl AnomalyDetector {
    /// Detect zombie by comparing traffic received vs success rate
    ///
    /// Zombie pattern: traffic > 0 AND success_rate ≈ 0
    pub fn detect_zombie(&self, metrics: &GatewayMetrics) -> Option<ZombieAlert> {
        let traffic_received = metrics.requests_total_last_window(self.window);
        let success_count = metrics.requests_success_last_window(self.window);

        if traffic_received == 0 {
            return None;  // No traffic, can't determine
        }

        let success_rate = success_count as f64 / traffic_received as f64;

        if success_rate < self.threshold {
            return Some(ZombieAlert {
                node_id: metrics.node_id.clone(),
                traffic_received,
                success_count,
                success_rate,
                detection_method: "anomaly_traffic_vs_success",
                confidence: 1.0 - success_rate,
                timestamp: Utc::now(),
            });
        }

        None
    }
}
```

### Prometheus Rules for Hybrid Detection

```yaml
# prometheus/rules/hybrid-zombie.yaml
groups:
  - name: hybrid_zombie_detection
    rules:
      # Kong zombie detection
      - alert: KongZombieNode
        expr: |
          increase(kong_http_requests_total[5m]) > 100
          AND
          increase(kong_http_requests_total{code=~"5.."}[5m])
            / increase(kong_http_requests_total[5m]) > 0.9
        for: 2m
        labels:
          severity: critical
          gateway: kong
        annotations:
          summary: "Kong zombie node detected"

      # webMethods zombie detection (the real one from the incident)
      - alert: WebMethodsZombieNode
        expr: |
          webmethods_package_enabled{package=~"API_.*"} == 0
          AND
          webmethods_server_running == 1
        for: 1m
        labels:
          severity: critical
          gateway: webmethods
        annotations:
          summary: "webMethods zombie: server running but API packages disabled"

      # Generic anomaly detection
      - alert: GatewayZombieAnomaly
        expr: |
          (
            increase(gateway_requests_total[5m]) > 50
            AND
            increase(gateway_requests_success_total[5m])
              / increase(gateway_requests_total[5m]) < 0.1
          )
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Potential zombie: high traffic, very low success rate"
```

---

## Capability Comparison

| Capability | Native STOA Gateway | Hybrid (Kong/wM/Apigee) |
|------------|---------------------|-------------------------|
| **Deep Readiness Probe** | ✅ Full control over checks | ⚠️ Depends on gateway admin API |
| **Last Gasp Logging** | ✅ Complete with headers | ❌ Not available (gateway handles responses) |
| **Custom 503 Response** | ✅ Full control | ❌ Gateway returns its own errors |
| **Anomaly Detection** | ✅ Real-time in-process | ⚠️ Polling interval (5-30s) |
| **Error Snapshot** | ✅ Complete with request context | ⚠️ Partial (external metrics only) |
| **Metric Granularity** | ✅ Per-request, per-check | ⚠️ Aggregated metrics only |
| **Remediation Speed** | ✅ Immediate (same process) | ⚠️ Detection + alert + action |

---

## Consequences

### Positive

- **Eliminates silent failures** — Zombie nodes are detected and removed from rotation
- **Faster incident detection** — From 15 minutes (incident) to < 2 minutes (target)
- **Clear degradation signals** — 503 + headers vs cryptic 500s
- **Debugging accelerated** — Error snapshots capture context automatically
- **Works with existing infrastructure** — No changes to load balancers required
- **Hybrid support** — Monitors third-party gateways through adapters

### Negative

- **Increased probe complexity** — More checks = more potential false positives
- **Additional monitoring overhead** — More metrics, more alerts to tune
- **Hybrid mode limitations** — Cannot match native capabilities
- **Adapter maintenance** — Each gateway type needs specific adapter code

### Mitigations

| Risk | Mitigation |
|------|------------|
| False positives | Tunable thresholds, `failureThreshold: 2` |
| Probe timeout cascades | Independent timeouts per check, circuit breaker |
| Adapter drift | Version pinning, adapter health self-check |
| Alert fatigue | Severity tiers, smart grouping, runbook links |

---

## Implementation Phases

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1** | Deep readiness probe in stoa-gateway | Q1 2026 |
| **Phase 2** | Last gasp logging + 503 responses | Q1 2026 |
| **Phase 3** | K8s deployment config + PDB | Q1 2026 |
| **Phase 4** | Error snapshot integration (link to ADR-023) | Q2 2026 |
| **Phase 5** | Kong adapter | Q2 2026 |
| **Phase 6** | webMethods adapter | Q2 2026 |
| **Phase 7** | Apigee + Generic OpenMetrics adapters | Q3 2026 |

---

## References

- [Envoy Outlier Detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier) — Passive health checking patterns
- [Kubernetes Probes Best Practices](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) — Official K8s documentation
- [ADR-023: Zero Blind Spot Observability](./adr-023-zero-blind-spot-observability.md) — Error snapshot framework
- [ADR-024: Unified Gateway Architecture](./adr-024-gateway-unified-modes.md) — Gateway modes (sidecar, proxy, etc.)
- [Kong Admin API Reference](https://docs.konghq.com/gateway/latest/admin-api/) — Kong health endpoints
- [webMethods Integration Server Built-In Services](https://documentation.softwareag.com/) — IS admin services

---

## Decision Record

| Date | Decision | Author |
|------|----------|--------|
| 2026-01-26 | ADR created based on real incident analysis | CAB-957 |
