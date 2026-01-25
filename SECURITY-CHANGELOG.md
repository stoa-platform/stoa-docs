# Security Changelog

All security-related changes to STOA Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Prometheus metrics for SSE limiter (P1 follow-up)

---

## [1.x.x] - 2026-01-25

### Security Audit: Team Coca P0 Fixes

Internal penetration test conducted by Team Coca identified and fixed four critical vulnerabilities.

**Audit Team:** Chucky, N3m0, Gh0st, Pr1nc3ss
**Review:** OSS Killer, Archi Vétéran
**Score:** 10/10 (unanimous approval)
**ADR:** [ADR-018](/docs/architecture/adr/adr-018-security-hardening-p0)

---

### CAB-938: JWT Audience Validation

**Severity:** 🔴 Critical (CVSS 8.1)
**Component:** MCP Gateway Authentication

#### Changed
- JWT audience validation now **enabled by default**
- Default audience: `stoa-mcp-gateway,account`

#### Configuration
```bash
# Default (secure)
ALLOWED_AUDIENCES=stoa-mcp-gateway,account

# Disable validation (NOT RECOMMENDED)
ALLOWED_AUDIENCES=""
```

#### Migration
- Existing tokens with `account` audience continue to work
- New tokens should include `stoa-mcp-gateway` audience
- Configure Keycloak audience mapper for full security

#### Files Changed
- `mcp-gateway/src/middleware/auth.py`
- `mcp-gateway/src/config/settings.py`

---

### CAB-950: CORS Hardening

**Severity:** 🔴 Critical (CVSS 6.5)
**Component:** MCP Gateway CORS

#### Changed
- CORS restricted to explicit whitelist (was `*`)
- Added `expose_headers` configuration
- Added `max_age` for preflight caching

#### Configuration
```bash
# Default whitelist
CORS_ORIGINS=https://console.stoa.dev,https://portal.stoa.dev,https://console.gostoa.dev,https://portal.gostoa.dev

# Additional settings
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Authorization,Content-Type,X-Request-ID,X-Tenant-ID
CORS_EXPOSE_HEADERS=X-Request-ID,X-Trace-ID
CORS_MAX_AGE=600
```

#### Migration
- Add your frontend domains to `CORS_ORIGINS`
- Local dev: include `http://localhost:3000,http://localhost:5173`

#### ⚠️ Breaking Change
Requests from unlisted origins will be rejected. Ensure all legitimate frontend domains are whitelisted.

#### Files Changed
- `mcp-gateway/src/config/settings.py`
- `mcp-gateway/src/main.py`

---

### CAB-939: SSE Connection Rate Limiting

**Severity:** 🔴 Critical (CVSS 7.5)
**Component:** MCP Gateway SSE Endpoints

#### Added
- Connection limits per IP (10), per tenant (100), global (5000)
- Idle timeout (30s) and max duration (1h)
- Rate limit for new connections (5/min per IP)
- Trusted proxy validation for accurate client IP detection

#### Configuration
```bash
# Enable/disable (default: enabled)
SSE_LIMITER_ENABLED=true

# Trusted proxy CIDRs (default: empty = trust nothing)
# IMPORTANT: Set to your ingress controller IPs
SSE_TRUSTED_PROXIES=10.100.0.0/16
```

#### Response Codes
| Code | Meaning | Header |
|------|---------|--------|
| 429 | Rate limited | `Retry-After: 60` |

#### Migration
- Configure `SSE_TRUSTED_PROXIES` for accurate IP detection behind load balancer
- Monitor 429 responses to tune limits if needed

#### Files Changed
- `mcp-gateway/src/middleware/sse_limiter.py` (NEW)
- `mcp-gateway/src/handlers/mcp_sse.py`
- `mcp-gateway/src/config/settings.py`

---

### CAB-945: Container Hardening

**Severity:** 🔴 Critical (CVSS 7.2)
**Component:** Kubernetes Deployments

#### Changed

**Portal Deployment:**
- `readOnlyRootFilesystem: true` (was `false`)
- `automountServiceAccountToken: false`
- `capabilities.drop: [ALL]`
- `seccompProfile: RuntimeDefault`
- Added emptyDir volumes for nginx writable paths

**MCP Gateway Deployment:**
- `runAsNonRoot: true` at pod level
- `capabilities.drop: [ALL]`
- `seccompProfile: RuntimeDefault`

#### Added
- `k8s/namespace-pss.yaml` — Pod Security Standards (restricted)
- `k8s/networkpolicy-control-plane.yaml` — Network isolation

#### Pod Security Standards
```yaml
labels:
  pod-security.kubernetes.io/enforce: restricted
  pod-security.kubernetes.io/audit: restricted
  pod-security.kubernetes.io/warn: restricted
```

#### Network Policy
- Ingress: MCP Gateway, Ingress controller only
- Egress: PostgreSQL, Redis, Keycloak, Vault, DNS only
- Health checks: Cluster CIDR only (10.0.0.0/8)

#### Migration
- Apply namespace PSS labels
- Apply NetworkPolicy before deployment
- If using CronJobs/migrations, add pod selectors to NetworkPolicy

#### Files Changed
- `portal/k8s/deployment.yaml`
- `mcp-gateway/k8s/deployment.yaml`
- `k8s/namespace-pss.yaml` (NEW)
- `k8s/networkpolicy-control-plane.yaml` (NEW)

---

## Rollback Guide

Each fix can be rolled back via environment variables:

| Fix | Env Var | Rollback Value | Risk |
|-----|---------|----------------|------|
| CAB-938 | `ALLOWED_AUDIENCES` | `""` | ⚠️ High |
| CAB-950 | `CORS_ORIGINS` | `"*"` | 🔴 Critical |
| CAB-939 | `SSE_LIMITER_ENABLED` | `false` | ⚠️ High |
| CAB-945 | N/A | Revert manifests | ⚠️ High |

---

## Compliance

| Standard | Requirement | Status |
|----------|-------------|--------|
| OWASP API Security | API8:2023 Security Misconfiguration | ✅ Fixed |
| CIS Kubernetes | 5.2.* Pod Security Standards | ✅ Implemented |
| NIS2 | Network segmentation | ✅ NetworkPolicy |
| DORA | Incident response | ✅ Rollback plan |

---

## References

- [ADR-018: Security Hardening P0](/docs/architecture/adr/adr-018-security-hardening-p0)
- [Security Configuration Guide](/docs/reference/security-configuration)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

---

## Reporting Security Issues

Please email **security@gostoa.dev** for security vulnerabilities.
Do not open public GitHub issues for security concerns.

---

*Team Coca Security Audit — 2026-01-25 🍫*
