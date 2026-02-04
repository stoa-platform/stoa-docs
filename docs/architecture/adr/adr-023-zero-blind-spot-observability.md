---
sidebar_position: 23
title: "ADR-023: Zero Blind Spot Observability"
---

# ADR-023: Zero Blind Spot Observability

**Status:** Accepted
**Date:** 2026-01-26
**Decision Makers:** Christophe ABOULICAM
**Related Tickets:** CAB-960, CAB-961, CAB-962, CAB-397

---

## Context

### The Problem

Real-world incident at a major financial institution:
- Intermittent 502 errors affecting 5% of users
- Root cause: Corporate proxy (Cisco) degradation
- **Zero visibility** because proxy had no instrumentation
- Diagnosis required: Manual dump + vendor ticket + weeks of analysis

This is the "blind spot" problem that plagues traditional API management:
- Errors occur outside the gateway's visibility
- Impact is diffuse (affects subset of users)
- Correlation requires manual effort across multiple systems
- MTTR measured in hours or days

### The Anti-Pattern

```
┌──────────┐      ┌──────────────┐      ┌─────────┐
│  Client  │──▶──│  Proxy/LB    │──▶──│ Gateway │──▶── Backend
└──────────┘      └──────────────┘      └─────────┘
                        │
                   ❌ NO METRICS
                   ❌ NO TRACES
                   ❌ NO CORRELATION
```

Many traditional gateways treat observability as **opt-in**:
- Plugins must be enabled
- Configuration is fragmented (metrics ≠ traces ≠ logs)
- Can be disabled by misconfiguration
- No visibility into intermediate hops

---

## Decision

### The Principle

> **"If a request passes through STOA, we know what happened — by design."**

Observability in STOA is not a feature — it's a **property of the system**.

### Implementation

#### 1. Observability is NATIVE (not opt-in)

Every request through STOA Gateway automatically generates:
- **Metrics** (Prometheus) — latency, status codes, throughput
- **Traces** (OpenTelemetry) — distributed tracing with span context
- **Logs** (structured JSON) — request/response metadata
- **Error Snapshots** — full context capture on failures

```rust
// Pseudo-code: Every request handler
fn handle_request(req: Request) -> Response {
    // Trace ID is MANDATORY
    let trace_id = req.header("X-Trace-ID")
        .unwrap_or_else(|| generate_trace_id());

    let span = tracer.start_span("gateway.request")
        .with_trace_id(trace_id);

    // Metrics are AUTOMATIC
    let timer = metrics.request_duration.start_timer();

    // Processing...
    let response = process(req);

    // Error Snapshot on failure (AUTOMATIC)
    if response.status >= 400 {
        capture_error_snapshot(req, response, span);
    }

    timer.observe_duration();
    response
}
```

#### 2. Zero Configuration Required

| Traditional Approach | STOA Approach |
|---------------------|--------------|
| Plugin-based observability to enable | Native, active by default |
| Separate config for metrics/traces/logs | Unified by default |
| Can be disabled | Core, non-disableable |
| Requires tuning | Works out-of-the-box |

#### 3. Trace ID is Mandatory

- If `X-Trace-ID` header present → propagated
- Otherwise → auto-generated (UUID v4)
- By design, every request receives a correlation ID

#### 4. Timing Inference for Blind Spots

Even when intermediate hops (proxies, load balancers) have no instrumentation:

```
T_network = T_total - T_gateway - T_backend
```

If `T_network > baseline + 3σ` → **Network anomaly detected**

```yaml
# stoa.yaml
apis:
  - name: payment-api
    upstream: https://backend.internal

    networkPath:
      hops:
        - name: corporate-proxy
          address: proxy.corp.local:8080
      monitoring:
        enabled: true  # DEFAULT
        alertOnDegradation: true
```

---

## Consequences

### Positive

1. **MTTR: Minutes, not hours**
   - Full context available immediately on any error
   - No need to search across multiple systems

2. **Self-Diagnostic capability**
   - System can identify probable root cause automatically
   - Alerts include actionable context

3. **Competitive differentiation**
   - Deep native observability as a core differentiator
   - Resonates strongly with enterprise ops teams

4. **Trust building**
   - Designed so operators have full context on every request
   - Reduces finger-pointing between teams

### Negative

1. **Storage costs**
   - Error Snapshots require S3/MinIO storage
   - Mitigated by retention policies and compression

2. **Performance overhead**
   - Designed for minimal overhead per request for instrumentation
   - Tracing is sampled in high-volume scenarios

3. **Complexity**
   - More components to maintain (Prometheus, Loki, OpenTelemetry collector)
   - Mitigated by Helm charts with sane defaults

---

## Implementation Roadmap

| Phase | Ticket | Component | Priority |
|-------|--------|-----------|----------|
| 1 | CAB-960 | Observability by Default (Architecture) | P0 |
| 2 | CAB-397 | Error Snapshot / Flight Recorder | P1 ✅ Done |
| 3 | CAB-961 | Self-Diagnostic Engine | P1 |
| 4 | CAB-962 | Intermediate Hop Detection | P2 |

---

## Validation Criteria

### Success Metrics

1. **Any error can be diagnosed in `<5 minutes`** with native STOA data
2. By design, all requests have a trace ID in production
3. All 5xx errors captured in Error Snapshots by default
4. **Network anomalies detected** within 30 seconds

### Test Scenarios

1. Backend timeout → Error Snapshot captures full context
2. Proxy degradation → Timing inference detects anomaly
3. Intermittent failures → Pattern analysis identifies scope
4. Cross-tenant correlation → Self-diagnostic pinpoints root cause

---

## References

- [CAB-960: Observability by Default](https://linear.app/hlfh-workspace/issue/CAB-960)
- [CAB-961: Self-Diagnostic Engine](https://linear.app/hlfh-workspace/issue/CAB-961)
- [CAB-962: Intermediate Hop Detection](https://linear.app/hlfh-workspace/issue/CAB-962)
- [CAB-397: Error Snapshot](https://linear.app/hlfh-workspace/issue/CAB-397)
- Inspiration: AWS X-Ray Insights, Datadog Watchdog, Honeycomb BubbleUp

---

## Quotes

> *"L'observabilité n'est pas une feature, c'est une propriété du système."*

> *"Avec un gateway traditionnel, une erreur 502 peut nécessiter de chercher dans plusieurs dashboards. Avec STOA, le contexte complet est disponible en un clic."*

---

*Document generated from production incident analysis — Proxy blind spot case (January 2026)*
