---
sidebar_position: 3
---

# mTLS Gateway Authentication Flow

Detailed architecture diagrams for mTLS certificate-bound token validation in the STOA Gateway (Rust).

> **Related ADRs**: [ADR-027](adr/adr-027-x509-header-authentication.md) (X509 Headers), [ADR-028](adr/adr-028-rfc8705-certificate-binding.md) (RFC 8705 Binding), [ADR-029](adr/adr-029-mtls-certificate-lifecycle.md) (Certificate Lifecycle), [ADR-039](adr/adr-039-mtls-cert-bound-tokens.md) (Rust Gateway mTLS)
>
> **Linear**: CAB-864

---

## 1. End-to-End mTLS Flow

```
                                                    STOA Platform (K8s Cluster)
                                    ┌──────────────────────────────────────────────────┐
                                    │                                                  │
                    mTLS            │   HTTP + X-SSL-* headers                         │
 ┌──────────┐   (TLS 1.2/1.3)   ┌─────────┐                  ┌───────────────────┐    │
 │          │ ─────────────────► │         │ ────────────────► │                   │    │
 │  Client  │   Client cert +   │   F5    │   X-SSL-Client-*  │   STOA Gateway    │    │
 │   App    │   Bearer token    │  BigIP  │   + Authorization  │   (Rust/axum)     │    │
 │          │ ◄───────────────── │         │ ◄──────────────── │                   │    │
 └──────────┘    Response        └─────────┘    Response        └───────┬───────────┘    │
                                    │                                   │               │
                                    │                                   │ JWKS fetch    │
                                    │                          ┌────────▼────────┐      │
                                    │                          │    Keycloak     │      │
                                    │                          │  (JWKS + cnf)  │      │
                                    │                          └─────────────────┘      │
                                    │                                                  │
                                    └──────────────────────────────────────────────────┘
```

### Step-by-Step Detail

```
Step 1: TLS Handshake + Client Certificate Presentation
════════════════════════════════════════════════════════

  Client                              F5 BigIP
    │                                    │
    │──── ClientHello ──────────────────►│
    │◄─── ServerHello + ServerCert ──────│
    │◄─── CertificateRequest ────────────│   F5 requests client cert
    │──── ClientCertificate ────────────►│   Client sends its X.509 cert
    │──── CertificateVerify ────────────►│   Client proves private key ownership
    │──── Finished ─────────────────────►│
    │◄─── Finished ──────────────────────│
    │                                    │
    │  TLS session established           │


Step 2: F5 Validates Client Certificate
═══════════════════════════════════════

  F5 BigIP (internal validation)
    │
    ├── Verify signature against CA chain
    │     Root CA ──► Intermediate CA ──► Client cert
    │
    ├── Check validity period
    │     NotBefore <= now <= NotAfter
    │
    ├── Check revocation
    │     ├── CRL download (if configured)
    │     └── OCSP request (if configured)
    │
    └── Result: SUCCESS or FAILED:<reason>
          │
          └── FAILED → F5 returns 403 to client, request does NOT reach Gateway


Step 3: F5 Injects Headers and Forwards Request
════════════════════════════════════════════════

  F5 ──────────► STOA Gateway
  Headers injected:
    Authorization: Bearer <jwt>                        (from client)
    X-SSL-Client-Verify: SUCCESS                       (from F5)
    X-SSL-Client-S-DN: CN=acme-consumer,O=Acme Corp   (from F5)
    X-SSL-Client-I-DN: CN=STOA Platform CA,O=STOA     (from F5)
    X-SSL-Client-Serial: 0A:1B:2C:3D:4E:5F            (from F5)
    X-SSL-Client-Fingerprint: a1b2c3d4e5f6...          (from F5, SHA-256 hex)
    X-SSL-Client-NotAfter: 2027-01-01T00:00:00Z        (from F5)


Step 4: Gateway Extracts Certificate Metadata (auth/mtls.rs)
═══════════════════════════════════════════════════════════

  extract_certificate_from_headers(&headers, &config)
    │
    ├── Read X-SSL-Client-Verify
    │     "SUCCESS" → continue
    │     anything else → return Err(MTLS_CERT_INVALID)
    │
    ├── Read X-SSL-Client-Fingerprint
    │     normalize: strip colons, lowercase
    │     compute base64url: hex → bytes → base64url_encode
    │
    ├── Read X-SSL-Client-S-DN → subject_dn
    ├── Read X-SSL-Client-I-DN → issuer_dn
    │     check allowed_issuers (if configured)
    ├── Read X-SSL-Client-Serial → serial
    ├── Read X-SSL-Client-NotAfter → not_after
    │     check expiry: not_after > now
    │
    └── Return Ok(CertificateInfo { ... })
          → stored in request.extensions()


Step 5: Gateway Validates JWT + Extracts cnf (existing + claims.rs extension)
════════════════════════════════════════════════════════════════════════════

  Existing JWT flow (unchanged):
    │
    ├── Extract Bearer token from Authorization header
    ├── Decode JWT header → get kid
    ├── Fetch JWKS from Keycloak (moka cache, 5min TTL)
    ├── Verify RS256 signature
    ├── Validate iss, aud, exp, leeway
    └── Deserialize Claims struct
          │
          └── NEW field: claims.cnf: Option<CnfClaim>
                │
                └── CnfClaim { x5t_s256: Option<String> }
                      = base64url-encoded SHA-256 of client cert DER


Step 6: Gateway Verifies Certificate-Token Binding (auth/mtls.rs)
════════════════════════════════════════════════════════════════

  verify_certificate_binding(&cert_info, &cnf_claim)
    │
    ├── Get cert_info.fingerprint_b64url (computed in Step 4)
    │     "obLD1N5..."
    │
    ├── Get cnf_claim.x5t_s256
    │     "obLD1N5..."
    │
    ├── Decode both to bytes
    │
    ├── Timing-safe comparison (subtle::ConstantTimeEq)
    │     cert_bytes.ct_eq(&token_bytes)
    │
    ├── MATCH → continue to RBAC + handler
    │
    ├── MISMATCH → 403 MTLS_BINDING_MISMATCH
    │
    ├── No cert + mtls_required → 401 MTLS_CERT_REQUIRED
    │
    └── No cnf + cert present + require_binding → 403 MTLS_BINDING_REQUIRED
```

---

## 2. Consumer Onboarding (Certificate Registration)

This extends the CAB-1121 Phase 2 consumer onboarding with certificate binding.

```
  ┌──────────────┐
  │   Operator   │
  │  (Console)   │
  └──────┬───────┘
         │
         │ POST /api/v1/consumers
         │ Body: { external_id, display_name, tenant_id, certificate_pem }
         ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     Control Plane API                           │
  │                                                                 │
  │  1. Validate certificate (existing: certificates.py)            │
  │     ├── Parse PEM → X.509                                      │
  │     ├── Check expiry (warn if < 30 days)                       │
  │     ├── Verify minimum key size (2048 RSA / P-256 EC)          │
  │     └── Extract: subject, issuer, SAN, key size, fingerprint   │
  │                                                                 │
  │  2. Compute certificate thumbprint for RFC 8705                │
  │     ├── DER-encode the certificate                              │
  │     ├── SHA-256 hash                                            │
  │     └── Base64url encode → x5t_s256                             │
  │                                                                 │
  │  3. Create Keycloak client (existing: CAB-1121 Phase 2)        │
  │     ├── Client ID: {tenant}-{consumer_external_id}             │
  │     ├── Grant type: client_credentials                          │
  │     ├── Service account: enabled                                │
  │     ├── Client attribute: x5t_s256 = <thumbprint>              │
  │     └── Client attribute: x509.certificate.sha256 = <hex>      │
  │                (for Keycloak x509 authenticator, ADR-027)       │
  │                                                                 │
  │  4. Configure cnf protocol mapper on client                    │
  │     ├── Mapper type: Hardcoded claim                            │
  │     ├── Token claim name: cnf                                   │
  │     ├── Claim JSON type: JSON                                   │
  │     ├── Value: {"x5t#S256": "<x5t_s256>"}                     │
  │     ├── Add to access token: true                               │
  │     └── Add to ID token: false                                  │
  │                                                                 │
  │  5. Store consumer record                                      │
  │     ├── consumer_id, tenant_id, external_id                    │
  │     ├── keycloak_client_id                                     │
  │     ├── certificate_fingerprint (SHA-256 hex)                  │
  │     ├── certificate_fingerprint_b64url (for binding check)     │
  │     ├── certificate_subject_dn, certificate_not_after          │
  │     └── mtls_enabled = true                                    │
  │                                                                 │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Bulk Onboarding Flow (Phase 3)

```
  Operator prepares CSV (max 100 rows):
  ┌──────────────────────────────────────────────────────────────────┐
  │ external_id,display_name,tenant_id,certificate_pem              │
  │ acme-svc-001,Acme Service 1,tenant-acme,-----BEGIN CERT...      │
  │ acme-svc-002,Acme Service 2,tenant-acme,-----BEGIN CERT...      │
  │ ...                                                              │
  │ acme-svc-100,Acme Service 100,tenant-acme,-----BEGIN CERT...    │
  └──────────────────────────────────────────────────────────────────┘
        │
        │  POST /api/v1/admin/consumers/bulk
        │  Content-Type: multipart/form-data
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     Control Plane API                           │
  │                                                                 │
  │  Per row (sequential, each row is atomic):                      │
  │  ┌─────────────────────────────────────────────────────────┐    │
  │  │ 1. Validate certificate PEM                             │    │
  │  │ 2. Compute x5t_s256 thumbprint                          │    │
  │  │ 3. Create Keycloak client + cnf protocol mapper         │    │
  │  │ 4. Store consumer record in DB                          │    │
  │  │                                                         │    │
  │  │ On success: { row, status: "success", consumer_id }     │    │
  │  │ On failure: rollback row, { row, status: "error", ... } │    │
  │  └─────────────────────────────────────────────────────────┘    │
  │                                                                 │
  │  All rows processed (failures do not stop batch).               │
  └──────────────────────────────────────────────────────────────────┘
        │
        ▼
  Response:
  {
    "total": 100,
    "success": 97,
    "failed": 3,
    "results": [
      { "row": 1,  "status": "success", "consumer_id": "...", "client_id": "..." },
      { "row": 42, "status": "error",   "error": "certificate expired" },
      ...
    ]
  }
```

---

## 4. Failure Modes

| # | Failure | Where | HTTP | Error Code | Recovery |
|---|---------|-------|------|------------|----------|
| F1 | Client cert expired | F5 | TLS error (no HTTP) | N/A | Client renews cert with CA |
| F2 | Client cert revoked | F5 | TLS error (no HTTP) | N/A | Re-issue cert, update CRL |
| F3 | Unknown CA | F5 | TLS error (no HTTP) | N/A | Import CA into F5 trust store |
| F4 | F5 verify = FAILED | Gateway | 403 | `MTLS_CERT_INVALID` | Check F5 logs for reason |
| F5 | No cert headers + mtls required | Gateway | 401 | `MTLS_CERT_REQUIRED` | Client must present cert |
| F6 | JWT expired | Gateway | 401 | `TOKEN_EXPIRED` | Refresh token |
| F7 | JWT missing `cnf` claim | Gateway | 403 | `MTLS_BINDING_REQUIRED` | Register cert on Keycloak client, get new token |
| F8 | Thumbprint mismatch | Gateway | 403 | `MTLS_BINDING_MISMATCH` | Token was issued for different cert |
| F9 | Cert rotated, old token | Gateway | 403 | `MTLS_BINDING_MISMATCH` | Get new token (ADR-029 grace period) |
| F10 | Issuer not in allowed list | Gateway | 403 | `MTLS_ISSUER_DENIED` | Add issuer to `STOA_MTLS_ALLOWED_ISSUERS` |
| F11 | Header spoofing | Gateway | 403 | `MTLS_CERT_INVALID` | Enforce K8s NetworkPolicy (ADR-027) |
| F12 | Keycloak mapper missing | Keycloak | 403 | `MTLS_BINDING_REQUIRED` | Configure cnf protocol mapper on client |

---

## 5. Certificate Rotation (ADR-029 Integration)

```
  Day 0                            Day 0+grace_period
    │                                    │
    ▼                                    ▼
  ┌──────────┐     Rotate      ┌──────────────────────┐     Grace expires    ┌──────────┐
  │ Cert A   │  ──────────→    │ Cert A + Cert B      │  ──────────────→     │ Cert B   │
  │ (active) │                 │ (both valid)          │                      │ (active) │
  └──────────┘                 └──────────────────────┘                      └──────────┘

  PUT /api/v1/consumers/{id}/certificate
    │
    ├── Validate new certificate
    ├── Compute new x5t_s256
    ├── Store old fingerprint as certificate_fingerprint_previous
    ├── Set previous_cert_expires_at = now + grace_period (default: 24h)
    ├── Update Keycloak client attribute with new x5t_s256
    └── During grace period: Gateway accepts tokens bound to EITHER thumbprint
```

---

## 6. Network Security

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                     Kubernetes Cluster                         │
  │                                                                │
  │   ┌─────────────┐    NetworkPolicy     ┌──────────────────┐   │
  │   │   F5 BigIP  │───(ingress: allow)──►│  STOA Gateway    │   │
  │   │   (pod)     │    X-SSL-* trusted   │  (pod)           │   │
  │   └─────────────┘                      └──────────────────┘   │
  │                                                                │
  │   ┌─────────────┐    NetworkPolicy     ┌──────────────────┐   │
  │   │  Other Pod  │───(BLOCKED)────X────►│  STOA Gateway    │   │
  │   │             │    X-SSL-* stripped   │  (pod)           │   │
  │   └─────────────┘                      └──────────────────┘   │
  │                                                                │
  │   Defense in depth: Gateway strips X-SSL-* from non-F5         │
  │   sources even if NetworkPolicy is misconfigured.              │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 7. Observability

### Prometheus Metrics

```
stoa_gateway_mtls_requests_total{status="success|binding_mismatch|cert_invalid|cert_required|binding_required"}
stoa_gateway_mtls_binding_duration_seconds{quantile="0.5|0.9|0.99"}
stoa_gateway_mtls_cert_expiry_days{consumer_id, tenant_id}
```

### Structured Log Fields

```json
{
  "event": "mtls_auth",
  "status": "success",
  "cert_subject_dn": "CN=acme-consumer,O=Acme Corp,C=FR",
  "cert_serial": "0A:1B:2C:3D:4E:5F",
  "cert_not_after": "2027-01-01T00:00:00Z",
  "binding_match": true,
  "user_id": "acme-consumer-001",
  "tenant_id": "tenant-acme",
  "trace_id": "abc123"
}
```

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| `MtlsBindingMismatchRate` | binding_mismatch rate &gt; 0.1/s over 5m | Warning |
| `MtlsCertExpiringSoon` | cert_expiry_days &lt; 30 | Warning |
| `MtlsCertExpired` | cert_expiry_days &lt;= 0 | Critical |
| `MtlsHighFailureRate` | failure rate &gt; 5% over 5m | Critical |
