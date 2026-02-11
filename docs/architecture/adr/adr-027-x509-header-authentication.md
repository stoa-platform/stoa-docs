---
title: "ADR-027: X509 Header-Based Authentication"
description: "Decides how STOA validates mTLS client certificates via HTTP headers when TLS is terminated at the edge load balancer."
keywords: [mTLS, X509, certificate authentication, TLS termination, Keycloak, security]
---

# ADR-027: X509 Header-Based Authentication

## Status

Accepted

## Date

2026-01-31

## Context

STOA supports mTLS for API client authentication (RFC 8705 Certificate-Bound Access Tokens). In production, TLS is terminated at the edge load balancer (F5) — not at Keycloak. Keycloak must therefore validate client certificates received via HTTP headers injected by the trusted proxy.

### Related Decisions

- **ADR-026**: Multi-IAM Federation — mTLS between components
- **ADR-011**: API Security Modes — mTLS for CORE internal APIs
- **CAB-865**: Client certificate provisioning
- **CAB-866**: Keycloak certificate sync (x509.certificate.sha256 attributes)

## Decision

Use Keycloak's **built-in `x509cert-lookup` SPI** with the nginx provider mode. No custom Java SPI is required.

### Architecture

```
Client (mTLS) ──→ F5 / Nginx (terminates TLS) ──→ Keycloak (reads headers)
                        │
                        └─ Injects: SSL_CLIENT_CERT, SSL_CLIENT_VERIFY,
                                    SSL_CLIENT_S_DN, SSL_CLIENT_FINGERPRINT
```

### Header Contract (F5 → Keycloak)

| Header | Content | Format |
|--------|---------|--------|
| `SSL_CLIENT_CERT` | Client certificate | URL-encoded PEM |
| `SSL_CLIENT_CERT_CHAIN_0` | Issuing CA certificate | URL-encoded PEM |
| `SSL_CLIENT_VERIFY` | Verification result | `SUCCESS` / `FAILED` / `NONE` |
| `SSL_CLIENT_S_DN` | Subject Distinguished Name | `CN=client-123.client.stoa.internal` |
| `SSL_CLIENT_FINGERPRINT` | SHA-256 fingerprint | Hex string |

### Authentication Flow

The `x509-client-credentials` flow uses:
1. **X509 authenticator** (ALTERNATIVE, priority 10) — matches certificate fingerprint against `x509.certificate.sha256` client attribute (set by CAB-866)
2. **Client secret** (ALTERNATIVE, priority 20) — fallback for clients without certificates

### Configuration

Keycloak environment variables:
```
KC_SPI_X509CERT_LOOKUP_PROVIDER=nginx
KC_SPI_X509CERT_LOOKUP_NGINX_SSL_CLIENT_CERT=SSL_CLIENT_CERT
KC_SPI_X509CERT_LOOKUP_NGINX_SSL_CERT_CHAIN_PREFIX=SSL_CLIENT_CERT_CHAIN
KC_SPI_X509CERT_LOOKUP_NGINX_CERTIFICATE_CHAIN_LENGTH=1
```

## Security Considerations

1. **Trusted Proxy Only**: A Kubernetes `NetworkPolicy` restricts which sources may send X509 headers to Keycloak. Without this, any pod could spoof `SSL_CLIENT_CERT`.
2. **Header Validation**: Keycloak validates the certificate fingerprint against the registered client's `x509.certificate.sha256` attribute.
3. **Audit Logging**: Keycloak logs all authentication attempts. Failed X509 auth (missing/invalid cert) is logged at WARN level.
4. **No PEM in Logs**: Only fingerprints are logged; full certificate PEM is never written to logs.

## Consequences

### Positive

- No custom Java code to build, test, or maintain
- Uses battle-tested Keycloak SPI (supported since Keycloak 4.x)
- Compatible with any TLS-terminating proxy (F5, nginx, HAProxy, AWS ALB)
- Graceful fallback to client_secret for non-mTLS clients

### Negative

- Depends on correct proxy configuration (wrong header name = silent auth failure)
- Network policy is critical — misconfiguration allows header spoofing

### Mitigations

- Nginx dev proxy mimics F5 headers for local testing
- Integration tests validate all auth scenarios (valid cert, invalid, missing, expired, revoked)
- NetworkPolicy is mandatory (enforced via Helm values)
