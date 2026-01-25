---
sidebar_position: 10
title: Security Configuration
description: Security hardening guide for STOA Platform — JWT, CORS, SSE limits, and Kubernetes
---

# Security Configuration

This guide covers the security settings introduced in the **Team Coca P0 Security Fixes** (ADR-018).

:::tip Summary
All security features are **enabled by default** with secure settings. You only need to configure them if you're customizing for your environment.
:::

## Quick Reference

| Feature | Setting | Default | Rollback |
|---------|---------|---------|----------|
| JWT Audience | `ALLOWED_AUDIENCES` | `stoa-mcp-gateway,account` | Set to `""` |
| CORS | `CORS_ORIGINS` | Whitelist | Set to `"*"` |
| SSE Limits | `SSE_LIMITER_ENABLED` | `true` | Set to `false` |
| Trusted Proxies | `SSE_TRUSTED_PROXIES` | `""` (none) | Configure CIDRs |

---

## JWT Audience Validation (CAB-938)

### What It Does

Validates that JWT tokens were issued specifically for the MCP Gateway, preventing token reuse from other Keycloak clients.

### Configuration

```bash
# Environment variables
ALLOWED_AUDIENCES=stoa-mcp-gateway,account

# Or in settings.py
allowed_audiences: str = "stoa-mcp-gateway,account"
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ALLOWED_AUDIENCES` | string | `stoa-mcp-gateway,account` | Comma-separated list of valid JWT audiences |

### Keycloak Configuration

Ensure your Keycloak client is configured to include the audience:

```json
{
  "clientId": "stoa-mcp-gateway",
  "protocolMappers": [
    {
      "name": "audience-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "config": {
        "included.client.audience": "stoa-mcp-gateway",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### Testing

```bash
# Decode a token and check the audience
echo $TOKEN | cut -d. -f2 | base64 -d | jq '.aud'
# Should include: "stoa-mcp-gateway"
```

### Rollback

If JWT validation breaks authentication:

```bash
# Disable audience validation (temporary!)
export ALLOWED_AUDIENCES=""
```

:::warning
Disabling audience validation is a security risk. Only use for debugging.
:::

---

## CORS Configuration (CAB-950)

### What It Does

Restricts which origins can make cross-origin requests to the API, preventing CSRF and data exfiltration attacks.

### Configuration

```bash
# Environment variables
CORS_ORIGINS=https://console.stoa.dev,https://portal.stoa.dev
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Authorization,Content-Type,X-Request-ID,X-Tenant-ID
CORS_EXPOSE_HEADERS=X-Request-ID,X-Trace-ID
CORS_MAX_AGE=600
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `CORS_ORIGINS` | string | See below | Comma-separated allowed origins |
| `CORS_ALLOW_METHODS` | string | `GET,POST,PUT,DELETE,OPTIONS` | Allowed HTTP methods |
| `CORS_ALLOW_HEADERS` | string | `Authorization,Content-Type,...` | Allowed request headers |
| `CORS_EXPOSE_HEADERS` | string | `X-Request-ID,X-Trace-ID` | Headers exposed to browser |
| `CORS_MAX_AGE` | int | `600` | Preflight cache duration (seconds) |

### Default Origins

```
https://console.stoa.dev
https://portal.stoa.dev
https://console.gostoa.dev
https://portal.gostoa.dev
```

### Local Development

For local development, add localhost origins:

```bash
CORS_ORIGINS=https://console.stoa.dev,http://localhost:3000,http://localhost:5173
```

### Testing

```bash
# Test CORS preflight
curl -X OPTIONS https://api.stoa.dev/v1/tools \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should return 403 or missing Access-Control-Allow-Origin
```

### Rollback

```bash
# Allow all origins (NOT RECOMMENDED!)
export CORS_ORIGINS="*"
```

:::danger
Never use `CORS_ORIGINS="*"` in production. This allows any website to make authenticated requests to your API.
:::

---

## SSE Connection Limits (CAB-939)

### What It Does

Prevents connection exhaustion attacks (Slowloris) by limiting SSE connections per IP, per tenant, and globally.

### Configuration

```bash
# Environment variables
SSE_LIMITER_ENABLED=true
SSE_TRUSTED_PROXIES=10.100.0.0/16  # Your cluster CIDR
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `SSE_LIMITER_ENABLED` | bool | `true` | Enable/disable rate limiting |
| `SSE_TRUSTED_PROXIES` | string | `""` | Trusted proxy CIDRs for X-Forwarded-For |

### Built-in Limits

These limits are hardcoded but can be adjusted via code:

| Limit | Value | Description |
|-------|-------|-------------|
| `MAX_PER_IP` | 10 | Max connections from single IP |
| `MAX_PER_TENANT` | 100 | Max connections per tenant |
| `MAX_TOTAL` | 5000 | Global connection limit |
| `IDLE_TIMEOUT` | 30s | Close idle connections after |
| `MAX_DURATION` | 1h | Maximum connection lifetime |
| `RATE_LIMIT_PER_MIN` | 5 | New connections per IP per minute |

### Trusted Proxies

:::important
If you're behind a load balancer or ingress controller, you **must** configure trusted proxies to get accurate client IPs.
:::

```bash
# EKS example
SSE_TRUSTED_PROXIES=10.100.0.0/16

# GKE example
SSE_TRUSTED_PROXIES=10.0.0.0/8

# Multiple CIDRs
SSE_TRUSTED_PROXIES=10.100.0.0/16,172.16.0.0/12
```

If not configured, the limiter will use the direct connection IP (which may be your load balancer).

### Testing

```bash
# Test rate limit (should get 429 on 11th connection)
for i in {1..15}; do
  curl -N "https://api.stoa.dev/mcp/sse" \
    -H "Authorization: Bearer $TOKEN" &
done

# Check active connections (if you have access)
curl https://api.stoa.dev/metrics | grep stoa_sse
```

### Response Codes

| Code | Meaning | Header |
|------|---------|--------|
| 429 | Too Many Requests | `Retry-After: 60` |

### Rollback

```bash
# Disable SSE rate limiting
export SSE_LIMITER_ENABLED=false
```

---

## Container Security (CAB-945)

### Pod Security Standards

STOA enforces the **restricted** Pod Security Standard on the `stoa-system` namespace:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: stoa-system
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Deployment Security Context

All STOA deployments use this security context:

```yaml
spec:
  automountServiceAccountToken: false  # Unless needed
  securityContext:
    runAsNonRoot: true
    fsGroup: 1000

  containers:
    - securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
        seccompProfile:
          type: RuntimeDefault
```

### Network Policies

The control plane is isolated with NetworkPolicy:

```yaml
# Ingress: Only from MCP Gateway and Ingress
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: stoa-mcp-gateway
  - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx

# Egress: Only to known services
egress:
  - to:
      - podSelector:
          matchLabels:
            app: postgresql
  - to:
      - podSelector:
          matchLabels:
            app: redis
  # ... and DNS
```

### Verification

```bash
# Check PSS enforcement
kubectl get ns stoa-system -o jsonpath='{.metadata.labels}' | jq

# Check security context
kubectl get pod -n stoa-system -o jsonpath='{.items[0].spec.securityContext}'

# Test NetworkPolicy (should fail from random pod)
kubectl run test --rm -it --image=alpine -- wget -O- http://stoa-control-plane:8080
```

---

## Monitoring

### Prometheus Metrics (P1)

These metrics will be added in a follow-up release:

```promql
# SSE active connections
stoa_sse_connections_total{tenant="acme"}

# SSE rejected connections
stoa_sse_rejected_total{reason="ip_limit"}

# JWT validation failures
stoa_jwt_validation_failures_total{reason="invalid_audience"}
```

### Alerts

Recommended alerts:

```yaml
- alert: STOAHighSSERejectionRate
  expr: rate(stoa_sse_rejected_total[5m]) > 10
  labels:
    severity: warning
  annotations:
    summary: High SSE rejection rate (possible attack)

- alert: STOAJWTValidationFailures
  expr: rate(stoa_jwt_validation_failures_total[5m]) > 5
  labels:
    severity: warning
  annotations:
    summary: JWT validation failures detected
```

---

## Troubleshooting

### JWT Validation Errors

**Symptom:** `401 Unauthorized` with message "Invalid audience"

**Solution:**
1. Check token audience: `echo $TOKEN | cut -d. -f2 | base64 -d | jq '.aud'`
2. Verify Keycloak client mapper configuration
3. Temporarily disable: `ALLOWED_AUDIENCES=""`

### CORS Errors

**Symptom:** Browser console shows "CORS policy" errors

**Solution:**
1. Check origin is in whitelist: `echo $CORS_ORIGINS`
2. Add origin: `CORS_ORIGINS="...,https://your-domain.com"`
3. Check for typos (http vs https)

### SSE Rate Limiting

**Symptom:** `429 Too Many Requests` with `Retry-After: 60`

**Solution:**
1. Check if legitimate traffic or attack
2. Verify client IP detection: `curl -v ... | grep X-Forwarded-For`
3. Configure trusted proxies: `SSE_TRUSTED_PROXIES=...`
4. Temporarily disable: `SSE_LIMITER_ENABLED=false`

### Container Security

**Symptom:** Pod fails to start with "container has runAsNonRoot and image will run as root"

**Solution:**
1. Use non-root base image
2. Add `USER 1000` to Dockerfile
3. Set `runAsUser` in deployment

---

## References

- [ADR-018: Security Hardening P0](/docs/architecture/adr/adr-018-security-hardening-p0)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)

---

*Last updated: 2026-01-25 — Team Coca Security Audit 🍫*
