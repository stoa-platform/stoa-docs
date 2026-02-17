---
slug: api-gateway-circuit-breaker-patterns
title: API Gateway Circuit Breaker Patterns Explained
description: How circuit breaker patterns prevent cascading failures in API gateways. State diagrams, configuration, and monitoring.
authors: [stoa-team]
tags: [tutorial, api-gateway, architecture]
unlisted: true
keywords:
  - api gateway circuit breaker
  - circuit breaker pattern
  - api resilience patterns
  - cascade failure prevention
  - api gateway fault tolerance
  - circuit breaker configuration
  - microservices resilience
---

<!-- last verified: 2026-02 -->

Circuit breakers are critical resilience patterns that prevent cascading failures in distributed systems by temporarily blocking requests to unhealthy backends. In API gateways, they act as automatic safety switches that detect failures, stop forwarding traffic to failing services, and allow systems time to recover before resuming normal operations.

<!-- truncate -->

## What is a Circuit Breaker?

A circuit breaker is a design pattern borrowed from electrical engineering that protects distributed systems from cascading failures. Just as an electrical circuit breaker stops current flow when a circuit overloads, an API gateway circuit breaker stops traffic to a failing backend service.

### The Problem: Cascade Failures

Without circuit breakers, a single slow or failing backend can trigger a domino effect:

1. **Backend service slows down** due to high load, database issues, or downstream failures
2. **Gateway threads pile up** waiting for responses that never arrive or timeout slowly
3. **Resource exhaustion** occurs as connection pools, threads, and memory fill up
4. **Healthy services suffer** as the gateway becomes unresponsive to all traffic
5. **Complete system failure** as the entire API infrastructure collapses

Consider an e-commerce platform where the payment service fails. Without circuit breakers:

```
Client Request → Gateway (waiting...) → Payment Service (down)
                    ↓ (300 threads blocked)
Client Request → Gateway (waiting...) → Payment Service (down)
                    ↓ (600 threads blocked)
Client Request → Gateway (TIMEOUT) → All Services (unreachable)
```

The gateway's connection pool is exhausted waiting for a service that won't respond. Now even healthy services like product catalog or user profiles become unreachable.

### The Solution: Fail Fast

Circuit breakers implement a "fail fast" strategy. Instead of waiting for timeouts on every request, the gateway detects failure patterns and immediately rejects requests to unhealthy backends:

```
Client Request → Gateway (Circuit OPEN) → 503 Service Unavailable (instant)
                    ↓ (0 threads blocked)
Client Request → Gateway (Circuit OPEN) → 503 Service Unavailable (instant)
```

This prevents resource exhaustion and allows the system to degrade gracefully. Clients receive immediate errors they can handle, rather than hanging indefinitely.

## Why API Gateways Need Circuit Breakers

API gateways sit at the entry point of your distributed system, making them the ideal location for circuit breaker implementation. Here's why:

### 1. Centralized Failure Detection

The gateway sees all traffic patterns across all backends. It can detect:
- Rising error rates (5xx responses)
- Increasing latency (slow response times)
- Connection failures (refused connections, DNS errors)
- Timeout patterns (requests exceeding deadlines)

### 2. Protection for All Clients

A circuit breaker at the gateway protects all downstream clients, regardless of their implementation. Whether you have web browsers, mobile apps, or internal microservices making API calls, they all benefit from the gateway's resilience logic.

### 3. Backend Service Protection

When a backend struggles under load, continued traffic makes recovery harder. Circuit breakers give failing services breathing room by temporarily stopping incoming requests, allowing them to:
- Clear backlogged work queues
- Restore database connections
- Scale up resources
- Complete ongoing transactions

### 4. Observable Failure Boundaries

Circuit breaker state changes are highly observable events. When a circuit opens, it signals a system health issue that operations teams can investigate. This makes incident response faster and more targeted.

For a deeper understanding of how circuit breakers fit into modern API gateway architectures, see our [API Gateway Architecture Guide](/docs/concepts/architecture).

## The Three States: Closed, Open, Half-Open

Circuit breakers operate as finite state machines with three distinct states. Understanding these states is crucial for effective configuration.

### State Diagram

```
                    ┌─────────────┐
                    │   CLOSED    │ ◄─── Initial state
                    │ (healthy)   │
                    └──────┬──────┘
                           │
                  Failure threshold
                   reached (e.g., 5
                  consecutive errors)
                           │
                           ▼
                    ┌─────────────┐
            ┌───────┤    OPEN     │
            │       │  (failing)  │
            │       └──────┬──────┘
            │              │
    Requests fail     Sleep window
    immediately       expires (e.g.,
    with 503         30 seconds)
            │              │
            │              ▼
            │       ┌─────────────┐
            │       │ HALF-OPEN   │
            │       │  (testing)  │
            │       └──────┬──────┘
            │              │
            │        ┌─────┴─────┐
            │        │           │
            │  Success       Failure
            │  threshold     threshold
            │  met           met
            │        │           │
            └────────┴───────────┘
```

### Closed State (Normal Operation)

**Behavior**: All requests pass through to the backend. The circuit breaker monitors responses.

**Monitoring**:
- Count consecutive failures
- Track error rates over sliding windows
- Measure response latencies

**Transition to Open**:
When failure threshold is crossed. Common triggers:
- 5+ consecutive failures
- 50%+ error rate over 10 requests
- 3+ timeouts in 30 seconds

**Configuration Example** (YAML):

```yaml
circuitBreaker:
  state: closed
  failureThreshold: 5
  successThreshold: 2
  timeout: 30s
  monitoringWindow: 60s
```

### Open State (Blocking Traffic)

**Behavior**: All requests fail immediately with `503 Service Unavailable`. No backend calls are made.

**Purpose**:
- Prevent resource exhaustion
- Give backend time to recover
- Fail fast for clients

**Transition to Half-Open**:
After a configurable sleep window (e.g., 30 seconds). This window allows the backend to recover before testing begins.

**Client Response**:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Retry-After: 30

{
  "error": "circuit_breaker_open",
  "message": "Backend service is temporarily unavailable",
  "retry_after_seconds": 30
}
```

### Half-Open State (Testing Recovery)

**Behavior**: A limited number of test requests are allowed through to check if the backend has recovered.

**Test Strategy**:
- Allow 1-3 probe requests
- If all succeed → transition to Closed
- If any fail → transition back to Open

**Configuration Example**:

```yaml
circuitBreaker:
  halfOpen:
    maxRequests: 3      # Number of test requests
    successThreshold: 2  # Successes needed to close
    timeout: 10s        # Timeout per test request
```

**Why This Matters**: Half-open prevents the "thundering herd" problem. Without it, when the sleep window expires, all blocked requests would simultaneously hit the recovering backend, potentially causing it to fail again.

## Implementation Patterns

Circuit breakers can be scoped at different levels in your gateway architecture. Each has trade-offs.

### 1. Per-Route Circuit Breakers

**Scope**: One circuit breaker per API endpoint.

**Use Case**: Fine-grained control when different routes have different reliability characteristics.

**Configuration**:

```yaml
routes:
  - path: /api/v1/payments
    backend: http://payment-service:8080
    circuitBreaker:
      enabled: true
      failureThreshold: 3
      timeout: 20s
      sleepWindow: 60s

  - path: /api/v1/products
    backend: http://catalog-service:8080
    circuitBreaker:
      enabled: true
      failureThreshold: 10
      timeout: 5s
      sleepWindow: 30s
```

**Advantages**:
- Isolated failures: `/payments` circuit opening doesn't affect `/products`
- Tuned thresholds: critical endpoints can have stricter thresholds
- Granular monitoring: per-route metrics for operations teams

**Disadvantages**:
- Configuration complexity: each route needs tuning
- Memory overhead: one circuit breaker state per route

### 2. Per-Backend Circuit Breakers

**Scope**: One circuit breaker per backend service (shared across all routes to that service).

**Use Case**: When routes to the same backend should share failure detection.

**Configuration**:

```yaml
backends:
  payment-service:
    url: http://payment-service:8080
    circuitBreaker:
      enabled: true
      failureThreshold: 5
      timeout: 30s

routes:
  - path: /api/v1/payments/create
    backend: payment-service

  - path: /api/v1/payments/status
    backend: payment-service
```

**Advantages**:
- Simpler configuration: one circuit breaker definition per service
- Shared failure state: if the backend is down, all routes stop calling it
- Lower memory footprint

**Disadvantages**:
- Coarse-grained: one slow route can trigger circuit for all routes
- Less flexibility: can't tune per-route behavior

### 3. Global Circuit Breakers

**Scope**: One circuit breaker protecting the entire gateway.

**Use Case**: Emergency shutoff to protect the gateway itself from overload.

**Configuration**:

```yaml
global:
  circuitBreaker:
    enabled: true
    failureThreshold: 100  # High threshold
    errorRate: 0.5         # 50% error rate
    monitoringWindow: 10s
    sleepWindow: 60s
```

**Advantages**:
- Ultimate protection: prevents total gateway collapse
- Simple to reason about: one state for the entire system

**Disadvantages**:
- Too coarse: healthy backends suffer when others fail
- Rarely used: typically a last-resort mechanism

### Recommended Hybrid Approach

In production systems, combine per-backend and global circuit breakers:

```yaml
# Per-backend circuit breakers for service-level isolation
backends:
  payment-service:
    circuitBreaker:
      failureThreshold: 5
      timeout: 30s
  catalog-service:
    circuitBreaker:
      failureThreshold: 10
      timeout: 10s

# Global circuit breaker as emergency shutoff
global:
  circuitBreaker:
    failureThreshold: 1000
    errorRate: 0.8
    monitoringWindow: 30s
```

This provides service-level isolation while protecting against catastrophic failures.

For more patterns on resilient gateway architectures, see [Kubernetes-Native API Gateway Patterns](/blog/kubernetes-native-api-gateway-patterns).

## Configuration Best Practices

Effective circuit breaker configuration requires understanding your traffic patterns and failure modes.

### 1. Set Failure Thresholds Based on Traffic Volume

**Low-traffic routes** (< 10 requests/minute):
```yaml
failureThreshold: 3  # 3 consecutive failures
timeout: 60s
```

**High-traffic routes** (> 100 requests/minute):
```yaml
failureThreshold: 10
slidingWindow: 20  # Monitor last 20 requests
errorRate: 0.5     # Open at 50% error rate
timeout: 30s
```

**Why**: Low-traffic routes need consecutive failure counts (absolute). High-traffic routes need error rate percentages (relative) to avoid false positives from occasional failures.

### 2. Tune Sleep Windows for Backend Recovery Time

**Fast-recovering services** (stateless microservices):
```yaml
sleepWindow: 10s  # Quick retry
```

**Slow-recovering services** (databases, legacy systems):
```yaml
sleepWindow: 120s  # Give more recovery time
```

**Why**: Sleep windows should match your backend's observed recovery patterns. Too short and you'll repeatedly hit a failing service. Too long and you'll prolong outages.

### 3. Configure Half-Open Test Requests

**Conservative testing**:
```yaml
halfOpen:
  maxRequests: 1
  successThreshold: 3  # Need 3 successes to close
```

**Aggressive testing**:
```yaml
halfOpen:
  maxRequests: 5
  successThreshold: 3  # 3 out of 5 successes to close
```

**Why**: Conservative testing (1 request at a time) is safer for critical backends. Aggressive testing (multiple simultaneous probes) speeds up recovery detection.

### 4. Align Timeouts with Circuit Breaker Logic

Your circuit breaker timeout should be shorter than your request timeout:

```yaml
request:
  timeout: 10s  # Overall request deadline

circuitBreaker:
  timeout: 8s   # Circuit breaker timeout (shorter)
  failureThreshold: 3
```

**Why**: If the circuit breaker timeout is longer than the request timeout, the request will fail due to timeout before the circuit breaker counts it as a failure.

### 5. Use Different Thresholds for Different Error Types

Some errors are retryable, others are not:

```yaml
circuitBreaker:
  failureThreshold: 5

  # Errors that trigger circuit
  triggerOn:
    - 500  # Internal Server Error
    - 502  # Bad Gateway
    - 503  # Service Unavailable
    - 504  # Gateway Timeout
    - connection_refused
    - timeout

  # Errors that don't trigger circuit
  ignoreOn:
    - 400  # Bad Request (client error)
    - 401  # Unauthorized (auth error)
    - 404  # Not Found (routing error)
```

**Why**: Client errors (4xx) usually indicate bad requests, not backend failures. Only server errors (5xx) and network failures should count toward circuit breaker thresholds.

### Example: Production-Ready Configuration

```yaml
routes:
  - path: /api/v1/payments/charge
    backend: payment-service
    circuitBreaker:
      enabled: true

      # Failure detection
      failureThreshold: 5
      slidingWindow: 10
      errorRate: 0.5

      # Timeouts
      timeout: 8s
      sleepWindow: 30s

      # Half-open testing
      halfOpen:
        maxRequests: 2
        successThreshold: 2

      # Error classification
      triggerOn:
        - 500
        - 502
        - 503
        - 504
        - timeout
        - connection_error

      # Monitoring
      metrics:
        enabled: true
        labels:
          service: payment
          criticality: high
```

For comprehensive gateway configuration options, see the [Configuration Reference](/docs/reference/configuration).

## Monitoring and Alerting

Circuit breakers are only effective if you monitor their state changes and respond to incidents.

### Key Metrics to Track

**Circuit State Metrics**:
```
circuit_breaker_state{route="/api/v1/payments", backend="payment-service"}
  Values: 0 (closed), 1 (open), 2 (half-open)

circuit_breaker_state_changes_total{route="/api/v1/payments", backend="payment-service", from="closed", to="open"}
  Counter: increments when circuit opens
```

**Failure Metrics**:
```
circuit_breaker_failures_total{route="/api/v1/payments", backend="payment-service"}
  Counter: total failures detected

circuit_breaker_consecutive_failures{route="/api/v1/payments", backend="payment-service"}
  Gauge: current consecutive failure count
```

**Request Metrics**:
```
circuit_breaker_requests_total{route="/api/v1/payments", backend="payment-service", result="success|failure|rejected"}
  Counter: total requests by result

circuit_breaker_request_duration_seconds{route="/api/v1/payments", backend="payment-service"}
  Histogram: request latency distribution
```

### Alerting Rules

**Critical Alert: Circuit Opened**

```yaml
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state{criticality="high"} == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker opened for {{ $labels.route }}"
    description: "Backend {{ $labels.backend }} is failing. Circuit opened to protect system."
```

**Warning Alert: Frequent State Changes**

```yaml
- alert: CircuitBreakerFlapping
  expr: rate(circuit_breaker_state_changes_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Circuit breaker flapping for {{ $labels.route }}"
    description: "Circuit changing state frequently. Backend may be unstable."
```

### Dashboard Example

A production circuit breaker dashboard should include:

1. **State Overview Panel**: Current state of all circuits (green = closed, red = open, yellow = half-open)
2. **State Timeline**: Graph showing state changes over time
3. **Error Rate Panel**: Error rate per backend with threshold line
4. **Latency Panel**: Response time percentiles (p50, p95, p99)
5. **Request Volume Panel**: Requests accepted vs rejected
6. **Time in State Panel**: How long each circuit has been in current state

**Sample Prometheus Query**:

```promql
# Circuit breaker states across all backends
sum by (backend, state) (circuit_breaker_state)

# Error rate over last 5 minutes
rate(circuit_breaker_failures_total[5m])
  / rate(circuit_breaker_requests_total[5m])

# Request rejection rate
rate(circuit_breaker_requests_total{result="rejected"}[1m])
```

For more on observability patterns, see [API Gateway Security Hardening Guide](/blog/api-gateway-security-hardening-guide) which covers monitoring security events.

## Real-World Example: E-Commerce Platform

Let's walk through a practical scenario of circuit breakers in action.

### System Architecture

```
Client → API Gateway → [ Payment Service ]
                    → [ Inventory Service ]
                    → [ Notification Service ]
```

### Scenario: Payment Service Database Failure

**Timeline**:

**T+0s**: Payment service database runs out of connections. Queries start timing out.

**T+5s**: Gateway detects 5 consecutive timeout errors on `/api/v1/payments/charge`. Circuit breaker opens.

```bash
# Gateway logs
[INFO] Circuit breaker OPENED for route=/api/v1/payments/charge backend=payment-service
[INFO] Reason: 5 consecutive timeouts exceeded threshold
```

**T+6s**: New payment requests receive immediate 503 responses:

```bash
curl -X POST https://api.example.com/api/v1/payments/charge \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "USD"}'

# Response (instant, no backend call)
HTTP/1.1 503 Service Unavailable
Retry-After: 30

{
  "error": "circuit_breaker_open",
  "message": "Payment service is temporarily unavailable",
  "retry_after_seconds": 30
}
```

**T+35s**: Sleep window expires. Circuit transitions to half-open.

**T+36s**: Gateway sends test request to payment service. Backend has recovered. Request succeeds.

**T+37s**: Second test request succeeds.

**T+38s**: Success threshold met (2/2 test requests succeeded). Circuit closes.

```bash
# Gateway logs
[INFO] Circuit breaker CLOSED for route=/api/v1/payments/charge backend=payment-service
[INFO] Reason: 2 consecutive successes in half-open state
```

**T+39s**: Normal operations resume. All payment requests flow through.

### What Happened Behind the Scenes

1. **Resource Protection**: During the 30-second open state, the gateway didn't waste threads or connections trying to reach the failing payment service. Inventory and notification services continued operating normally.

2. **Fast Failure**: Clients received immediate errors they could handle (e.g., show "payment temporarily unavailable" message) instead of hanging for 30+ seconds waiting for timeouts.

3. **Automatic Recovery**: The half-open testing mechanism detected when the payment service recovered and automatically restored normal operations without human intervention.

4. **Observability**: Operations team received a "Circuit Opened" alert at T+5s, investigated the payment service database, and resolved the connection pool issue.

For performance benchmarking of circuit breaker overhead, see [STOA Gateway Performance Benchmarks](/blog/stoa-gateway-performance-benchmarks).

## Circuit Breakers in Modern API Gateway Ecosystems

Circuit breakers are just one component of a resilient API gateway architecture. They work best when combined with:

- **Timeouts**: Prevent requests from hanging indefinitely
- **Retries with exponential backoff**: Handle transient failures
- **Rate limiting**: Prevent overload before it causes failures
- **Health checks**: Proactive detection of backend issues
- **Request hedging**: Send duplicate requests to reduce tail latency
- **Bulkhead isolation**: Separate thread pools per backend

For a comprehensive overview of these patterns, see our [API Gateway Glossary](/blog/api-gateway-glossary-2026) and [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026).

## FAQ

### How do circuit breakers differ from retries?

Circuit breakers prevent requests from reaching failing backends, while retries attempt requests multiple times. They serve complementary purposes:

- **Retries** handle transient failures (temporary network glitches, single failed request). They make sense when the failure is random and the next attempt might succeed.
- **Circuit breakers** handle persistent failures (service crash, database down). When a backend is truly broken, retrying wastes resources. Circuit breakers detect the pattern and stop attempting requests entirely.

In practice, use both: configure retries (2-3 attempts with exponential backoff) for transient failures, and circuit breakers to detect when retries are no longer useful.

### What happens to in-flight requests when a circuit opens?

In-flight requests (those already sent to the backend before the circuit opened) are allowed to complete. The circuit breaker only affects new incoming requests. This prevents abruptly canceling requests that might succeed.

However, configure your gateway to respect request timeouts even for in-flight requests. If a request exceeds its timeout, the gateway should cancel it and return an error to the client, regardless of circuit state.

### How do I test circuit breakers in staging environments?

Effective circuit breaker testing requires simulating failure scenarios:

1. **Chaos engineering**: Use tools like Chaos Monkey to randomly kill backend pods or inject latency. Verify circuits open as expected.

2. **Synthetic failures**: Create test endpoints on your backends that return errors on demand. Example: `GET /test/circuit-breaker?error_rate=0.5` returns 50% errors.

3. **Load testing**: Use tools like k6 or Gatling to send high request volumes while introducing backend failures. Monitor circuit state transitions.

4. **Manual triggering**: Some gateways support admin APIs to manually open/close circuits for testing: `POST /admin/circuit-breaker/payments/open`.

Test both the happy path (circuit remains closed during normal operations) and failure scenarios (circuit opens, transitions to half-open, and closes again).

## Next Steps

Circuit breakers are a foundational resilience pattern for production API gateways. To continue learning:

- **Architecture deep-dive**: Read our [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026) for comprehensive coverage of gateway patterns
- **Implementation details**: Check the [STOA Gateway Performance Benchmarks](/blog/stoa-gateway-performance-benchmarks) to see circuit breaker overhead measurements
- **Hands-on practice**: Deploy a Kubernetes-native gateway with circuit breakers using patterns from [Kubernetes-Native API Gateway Patterns](/blog/kubernetes-native-api-gateway-patterns)
- **Security integration**: Learn how circuit breakers integrate with security controls in [API Gateway Security Hardening Guide](/blog/api-gateway-security-hardening-guide)

Circuit breakers won't prevent all failures, but they'll ensure your system fails gracefully, recovers automatically, and provides a better experience for your users during incidents.
