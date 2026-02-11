---
sidebar_position: 18
title: "ADR-018: Security Hardening P0 — Team Coca Pentest"
description: "Decides the P0 critical security fixes following the internal Team Coca pentest audit including auth, CORS, and injection hardening."
keywords: [security hardening, pentest, P0 fixes, CORS, injection, authentication]
---

# ADR-018: Security Hardening P0 — Team Coca Pentest

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-01-25 |
| **Authors** | Christophe ABOULICAM, Team Coca (Chucky, N3m0, Gh0st, Pr1nc3ss) |
| **Reviewers** | OSS Killer, Archi Vétéran |
| **Tickets** | CAB-938, CAB-939, CAB-945, CAB-950 |
| **Score** | 10/10 (unanimous approval) |

## Context

An internal penetration test conducted by **Team Coca** on 2026-01-25 identified four P0 (critical) security vulnerabilities in STOA Platform:

| Ticket | Vulnerability | Severity | CVSS |
|--------|--------------|----------|------|
| CAB-938 | JWT audience validation disabled | 🔴 Critical | 8.1 |
| CAB-939 | SSE connection exhaustion (Slowloris) | 🔴 Critical | 7.5 |
| CAB-945 | Container security misconfigurations | 🔴 Critical | 7.2 |
| CAB-950 | CORS wildcard allows cross-origin attacks | 🔴 Critical | 6.5 |

### Audit Team

- **🔪 Chucky** — Pentest Lead, Infrastructure
- **🐟 N3m0** — Web Application, Injection
- **👻 Gh0st** — Supply Chain, CI/CD
- **👸 Pr1nc3ss** — Social Engineering, OSINT

### Review Team

- **💀 OSS Killer** — Devil's Advocate
- **🏛️ Archi Vétéran** — Architecture Review (23 years experience)

## Decision

We will implement all four security fixes with the following design decisions:

### CAB-938: JWT Audience Validation

**Before (Vulnerable):**
```python
# mcp-gateway/src/middleware/auth.py:311
payload = jwt.decode(
    token, rsa_key, algorithms=["RS256"],
    options={"verify_aud": False}  # ❌ Any service token accepted!
)
```

**After (Secure):**
```python
payload = jwt.decode(
    token, rsa_key, algorithms=["RS256"],
    audience=self.settings.allowed_audiences_list,
    options={"verify_aud": bool(self.settings.allowed_audiences)}
)
```

**Design Decisions:**
- Default audience: `stoa-mcp-gateway,account` (Keycloak compatibility)
- Empty string disables validation (backwards compatible)
- Rollback: `ALLOWED_AUDIENCES=""`

### CAB-950: CORS Whitelist

**Before (Vulnerable):**
```python
# mcp-gateway/src/config/settings.py:74
cors_origins: str = "*"  # ❌ Any origin can make requests!
```

**After (Secure):**
```python
cors_origins: str = "https://console.stoa.dev,https://portal.stoa.dev,..."
cors_allow_methods: str = "GET,POST,PUT,DELETE,OPTIONS"
cors_allow_headers: str = "Authorization,Content-Type,X-Request-ID,X-Tenant-ID"
cors_expose_headers: str = "X-Request-ID,X-Trace-ID"
cors_max_age: int = 600
```

**Design Decisions:**
- Explicit domain whitelist only
- Restricted methods and headers
- Rollback: `CORS_ORIGINS="*"` (not recommended)

### CAB-939: SSE Connection Limits

**Before (Vulnerable):**
```python
# No limits! An attacker can open 10,000+ connections
async def sse_endpoint():
    while True:  # ❌ Infinite, no timeout
        yield event
```

**After (Secure):**
```python
# New module: mcp-gateway/src/middleware/sse_limiter.py
class SSEConnectionLimiter:
    MAX_PER_IP: int = 10
    MAX_PER_TENANT: int = 100
    MAX_TOTAL: int = 5000
    IDLE_TIMEOUT: int = 30  # seconds
    MAX_DURATION: int = 3600  # 1 hour
    RATE_LIMIT_PER_MIN: int = 5
```

**Design Decisions:**
- Settings passed explicitly to avoid circular imports (OSS Killer fix)
- Trusted proxies default to empty (must configure explicitly)
- Rollback: `SSE_LIMITER_ENABLED=false`

### CAB-945: Container Hardening

**Before (Vulnerable):**
```yaml
# portal/k8s/deployment.yaml
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: false  # ❌ Writable!
  # Missing: capabilities, seccompProfile
```

**After (Secure):**
```yaml
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    fsGroup: 101
containers:
  - securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        drop: [ALL]
      seccompProfile:
        type: RuntimeDefault
```

**Additional Resources Created:**
- `k8s/namespace-pss.yaml` — Pod Security Standards (restricted)
- `k8s/networkpolicy-control-plane.yaml` — Network isolation

## Architecture

### Before (Vulnerable)

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY GAPS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 JWT: verify_aud=False                                   │
│     └── Any Keycloak token from any service accepted        │
│                                                             │
│  🔴 CORS: origins="*"                                       │
│     └── Cross-origin requests from any domain               │
│                                                             │
│  🔴 SSE: No limits                                          │
│     └── Slowloris attack can exhaust server resources       │
│                                                             │
│  🔴 Containers: Writable filesystem, no capability drop     │
│     └── Container escape → node compromise possible         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### After (Hardened)

```
┌─────────────────────────────────────────────────────────────┐
│                    DEFENSE IN DEPTH                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ JWT: verify_aud=True, audience="stoa-mcp-gateway"       │
│     └── Only tokens issued for this service accepted        │
│                                                             │
│  ✅ CORS: Explicit whitelist (*.stoa.dev, *.gostoa.dev)     │
│     └── Only known frontends can make requests              │
│                                                             │
│  ✅ SSE: 10/IP, 100/tenant, 30s idle, 1h max                │
│     └── Connection exhaustion attacks mitigated             │
│                                                             │
│  ✅ Containers: Read-only, capabilities dropped, seccomp    │
│     └── Attack surface minimized, PSS enforced              │
│                                                             │
│  ✅ NetworkPolicy: Control plane isolated                   │
│     └── East-west traffic restricted to known services      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive

- **Attack surface reduced** — All four P0 vulnerabilities closed
- **Defense in depth** — Multiple layers of security
- **Compliance ready** — PSS restricted, audit logging, RBAC
- **Rollback capability** — Each fix has environment variable toggle
- **Documented** — ADR, changelog, configuration guide

### Negative

- **Breaking change potential** — JWT audience validation may reject legacy tokens
- **Configuration required** — Trusted proxies must be explicitly set
- **Monitoring needed** — SSE limiter requires Prometheus metrics (P1)

### Neutral

- **Performance impact** — Minimal (~1ms for SSE limit check)
- **Migration path** — Backwards compatible with env var toggles

## Compliance

| Standard | Requirement | Status |
|----------|-------------|--------|
| OWASP API Security | API8:2023 Security Misconfiguration | ✅ Fixed |
| CIS Kubernetes | 5.2.* Pod Security Standards | ✅ Implemented |
| NIS2 | Network segmentation | ✅ NetworkPolicy |
| DORA | Incident response | ✅ Rollback plan |

## References

### External

- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Slowloris Attack](https://en.wikipedia.org/wiki/Slowloris_(computer_security))
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)

### Internal

- [CAB-938](https://linear.app/hlfh-workspace/issue/CAB-938) — JWT Validation
- [CAB-939](https://linear.app/hlfh-workspace/issue/CAB-939) — SSE Exhaustion
- [CAB-945](https://linear.app/hlfh-workspace/issue/CAB-945) — Container Hardening
- [CAB-950](https://linear.app/hlfh-workspace/issue/CAB-950) — UI/CLI Hardening

## Appendix: Review Trail

### Review Scores

| Reviewer | Role | v1 | v2 | v3 | v4 (Final) |
|----------|------|-----|-----|-----|------------|
| 🔪 Chucky | Infra | 7/10 | 9/10 | 9/10 | 10/10 |
| 🐟 N3m0 | Web | 8/10 | 9/10 | 9/10 | 10/10 |
| 👻 Gh0st | CI/CD | 6/10 | 8.5/10 | 9/10 | 10/10 |
| 👸 Pr1nc3ss | OSINT | 9/10 | 10/10 | 10/10 | 10/10 |
| 💀 OSS Killer | Adversarial | - | - | 8.5/10 | 10/10 |
| 🏛️ Archi Vétéran | Architecture | - | - | 9/10 | 10/10 |

### Key Corrections by Reviewer

| Reviewer | Issue Found | Fix Applied |
|----------|-------------|-------------|
| Chucky | Missing `automountServiceAccountToken` | Added to deployments |
| Chucky | NetworkPolicy health checks too open | Restricted to cluster CIDR |
| N3m0 | Keycloak default audience | Added `account` to defaults |
| N3m0 | Missing `expose_headers` | Added CORS setting |
| Pr1nc3ss | X-Forwarded-For spoofing | Trusted proxy validation |
| Gh0st | No tests in plan | Tests in same commit |
| Gh0st | No rollback plan | Env var toggles |
| OSS Killer | Circular import risk | Settings passed explicitly |
| OSS Killer | Trusted proxies too broad | Default to empty |
| Archi Vétéran | No documentation | SECURITY-CHANGELOG added |

---

*Team Coca Pentest — 2026-01-25 🍫*
