---
sidebar_position: 6
title: "Security Hardening"
description: "Harden STOA Platform for production — network policies, TLS configuration, container security, RBAC, secrets management, and compliance alignment."
keywords:
  - security hardening
  - TLS
  - network policies
  - container security
  - compliance
---

# Security Hardening

Production security checklist and hardening guide for STOA Platform.

## Security Layers

```
┌─────────────────────────────────────────┐
│ Network (TLS, NetworkPolicy, firewall)  │
├─────────────────────────────────────────┤
│ Identity (Keycloak, OIDC, mTLS)         │
├─────────────────────────────────────────┤
│ Application (RBAC, quotas, SSRF block)  │
├─────────────────────────────────────────┤
│ Container (PSS, seccomp, read-only FS)  │
├─────────────────────────────────────────┤
│ Data (encryption at rest, audit trail)  │
└─────────────────────────────────────────┘
```

## TLS Configuration

### Ingress TLS

All external endpoints must use TLS 1.2+:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stoa-gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
spec:
  tls:
    - secretName: gateway-tls
      hosts:
        - mcp.<YOUR_DOMAIN>
```

### Internal TLS

For service-to-service encryption within the cluster, enable mTLS via the gateway. See [mTLS Configuration](/docs/guides/mtls-configuration).

## Network Policies

### Tenant Isolation

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: stoa-system
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: stoa-system
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: TCP
          port: 53
        - protocol: UDP
          port: 53
    - to:
        - podSelector: {}
```

### Gateway Egress Restriction

Limit gateway outbound connections to known backends:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: gateway-egress
  namespace: stoa-system
spec:
  podSelector:
    matchLabels:
      app: stoa-gateway
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: control-plane-api
      ports:
        - port: 8000
    - to:
        - namespaceSelector: {}
      ports:
        - port: 443    # HTTPS backends
        - port: 53     # DNS
          protocol: UDP
```

## Container Security

### Pod Security Standards

Apply the `restricted` Pod Security Standard:

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

### Security Context (All Containers)

```yaml
securityContext:
  privileged: false
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true    # Not for nginx containers
  capabilities:
    drop:
      - ALL
  seccompProfile:
    type: RuntimeDefault
```

## SSRF Protection

The STOA Gateway includes a built-in SSRF blocklist that rejects backend URLs pointing to:

- Loopback addresses (`127.0.0.0/8`, `::1`)
- Private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Link-local (`169.254.0.0/16` — AWS metadata)
- IPv6 unique-local (`fd00::/8`)

This is defense-in-depth: backend URLs come from admin-configured data, but a compromised Control Plane could inject internal targets.

## Security Headers

The gateway automatically adds these headers to every response:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `0` | Disable legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restrict browser APIs |

## Secrets Management

### Recommended Architecture

```
Infisical (self-hosted) → K8s Secrets → Pod env vars
```

- Never hardcode secrets in code, Helm values, or ConfigMaps
- Use `secretRef` in pod specs to reference K8s Secrets
- Rotate secrets via Infisical; pods pick up changes on restart

See [Secrets Management](/docs/reference/security-configuration) for detailed configuration.

### Secret Rotation Checklist

| Secret | Rotation Frequency | Method |
|--------|-------------------|--------|
| Database password | 90 days | Infisical + pod restart |
| Keycloak client secrets | 90 days | Keycloak Admin + config update |
| Gateway admin token | 90 days | K8s Secret + pod restart |
| TLS certificates | Auto (cert-manager) | cert-manager handles renewal |
| API keys | On demand | Consumer-initiated via API |

## Compliance Alignment

### DORA (Digital Operational Resilience Act)

| DORA Requirement | STOA Capability |
|------------------|-----------------|
| ICT risk management | RBAC, audit trail, monitoring |
| Incident reporting | Alertmanager + audit logs |
| Operational resilience testing | Gateway Arena benchmarks |
| Third-party risk | Multi-gateway adapter pattern |
| Information sharing | OpenSearch audit trail |

### NIS2 (Network and Information Security)

| NIS2 Requirement | STOA Capability |
|------------------|-----------------|
| Risk analysis | Security headers, SSRF blocklist |
| Incident handling | Prometheus alerts, audit trail |
| Supply chain security | SBOM generation (CI), signed commits |
| Encryption | TLS 1.2+, mTLS support |
| Access control | Keycloak RBAC, 4 roles |

> STOA Platform provides technical capabilities that support regulatory compliance efforts. This does not constitute legal advice or a guarantee of compliance. Organizations should consult qualified legal counsel for compliance requirements.

## Production Hardening Checklist

- [ ] TLS on all ingress endpoints
- [ ] NetworkPolicy applied to `stoa-system` namespace
- [ ] Pod Security Standard set to `restricted`
- [ ] Keycloak brute force protection enabled
- [ ] Token lifespans shortened (5min access, 15min idle)
- [ ] SSRF blocklist active (default)
- [ ] Security headers active (default)
- [ ] Secrets in Infisical/Vault (not in env or ConfigMap)
- [ ] RBAC roles assigned (no default admin access)
- [ ] Audit trail enabled (OpenSearch)
- [ ] Alerting configured (Alertmanager)
- [ ] Container images scanned (Trivy in CI)
- [ ] Signed commits enforced

## Related

- [mTLS Configuration](/docs/guides/mtls-configuration) -- Certificate-bound tokens
- [RBAC Permissions](/docs/reference/rbac-permissions) -- Role matrix
- [Security Configuration](/docs/reference/security-configuration) -- JWT, CORS, SSE limits
- [Monitoring & Alerting](/docs/admin/monitoring) -- Alert setup
- [Keycloak Administration](/docs/admin/keycloak) -- Identity hardening
