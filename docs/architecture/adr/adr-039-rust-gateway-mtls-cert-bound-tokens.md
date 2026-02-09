# ADR-039: Rust Gateway mTLS + Certificate-Bound Token Validation

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Date** | 2026-02-09 |
| **Decision Makers** | Platform Team, Security Team |
| **Linear** | CAB-864 |

### Related Decisions

- **ADR-027**: X509 Header-Based Authentication — F5→Keycloak header contract
- **ADR-028**: RFC 8705 Certificate Binding Validation — fingerprint normalization, timing-safe comparison (MCP Gateway, Python)
- **ADR-029**: mTLS Certificate Lifecycle Management — provisioning, rotation, grace period
- **ADR-024**: Gateway Unified Modes
- **CAB-1121**: Consumer OAuth2 Integration (Phase 2, completed)

## Context

ADR-027/028/029 established STOA's mTLS architecture: F5 terminates TLS and forwards X-SSL-* headers, Keycloak validates certificates via its x509cert-lookup SPI, and the MCP Gateway (Python) verifies RFC 8705 `cnf.x5t#S256` binding using `fingerprint_utils.py`.

**The stoa-gateway (Rust/axum) has zero mTLS support today.** It must implement the same certificate-bound token validation as the MCP Gateway, but in Rust — with different patterns due to the language and framework.

### Current Rust Auth Architecture

```
stoa-gateway/src/auth/
├── mod.rs          — exports
├── claims.rs       — Claims struct (sub, exp, tenant, roles, scopes)
│                     StoaRole enum: CpiAdmin, TenantAdmin, DevOps, Viewer
│                     NO cnf field, NO certificate metadata
├── middleware.rs    — combined_auth_middleware: JWT → API Key fallback
│                     AuthenticatedUser, AuthUser/OptionalAuthUser extractors
├── jwt.rs          — JwtValidator: RS256 via JWKS (moka cache 5min)
├── api_key.rs      — ApiKeyValidator: moka cache → CP API /keys/validate
├── oidc.rs         — OIDC discovery + JWKS caching
└── rbac.rs         — RbacEnforcer, Action enum, tenant isolation
```

**Grep for `mtls|x509|certificate|X-SSL|X-Client-Cert|cnf` in `auth/` = zero matches.**

### Why a Separate ADR

ADR-028 covers RFC 8705 binding validation for the **MCP Gateway (Python)**:
- Uses `secrets.compare_digest()` for timing-safe comparison
- Uses `fingerprint_utils.py` for format normalization
- UAC-driven configuration via `security.authentication.mtls.cert_binding.*`

The Rust Gateway requires different implementation decisions:
- Different crypto primitives (no `secrets.compare_digest`, use `subtle::ConstantTimeEq`)
- Different configuration system (Figment + STOA_ env vars, not UAC)
- Different middleware model (axum layers + extractors, not FastAPI dependencies)
- Must integrate with the existing `Claims` struct and `combined_auth_middleware()`

## Decision

### 1. New Module: `auth/mtls.rs`

A dedicated module for mTLS header extraction and certificate-token binding verification.

**Structs:**

```
CertificateInfo
├── fingerprint: String          — SHA-256 hex from X-SSL-Client-Fingerprint
├── fingerprint_b64url: String   — computed: hex → bytes → base64url
├── subject_dn: String           — from X-SSL-Client-S-DN
├── issuer_dn: String            — from X-SSL-Client-I-DN
├── serial: String               — from X-SSL-Client-Serial
├── not_before: Option<DateTime> — from X-SSL-Client-NotBefore
├── not_after: Option<DateTime>  — from X-SSL-Client-NotAfter
└── verify_status: String        — from X-SSL-Client-Verify

MtlsConfig
├── enabled: bool                — default: false (backward compatible)
├── require_binding: bool        — default: true (reject tokens without cnf when cert present)
├── header_verify: String        — default: X-SSL-Client-Verify
├── header_fingerprint: String   — default: X-SSL-Client-Fingerprint
├── header_subject_dn: String    — default: X-SSL-Client-S-DN
├── header_issuer_dn: String     — default: X-SSL-Client-I-DN
├── header_serial: String        — default: X-SSL-Client-Serial
├── header_cert: String          — default: X-SSL-Client-Cert
├── allowed_issuers: Vec<String> — default: empty (accept all)
└── tenant_from_dn: bool         — default: true
```

**Functions:**

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `extract_certificate_from_headers` | `&HeaderMap, &MtlsConfig` | `Result<Option<CertificateInfo>>` | Parse X-SSL-* headers into `CertificateInfo` |
| `verify_certificate_binding` | `&CertificateInfo, &CnfClaim` | `Result<()>` | Compare cert thumbprint with JWT `cnf.x5t#S256` |
| `hex_to_base64url` | `&str` | `Result<String>` | Convert hex fingerprint to base64url for comparison |
| `normalize_fingerprint` | `&str` | `String` | Strip colons, lowercase (consistent with ADR-028 algorithm) |

### 2. Extend Claims Struct

Add `cnf` field to `Claims` in `auth/claims.rs`:

```
Claims (extended)
├── ... (existing fields: sub, exp, iat, iss, aud, tenant, etc.)
└── cnf: Option<CnfClaim>          [NEW]

CnfClaim
└── x5t_s256: Option<String>       — maps to JSON key "x5t#S256"
                                      (serde rename: #[serde(rename = "x5t#S256")])
```

This is a **non-breaking** change: `cnf` is `Option`, existing tokens without it deserialize identically.

### 3. Middleware Pipeline Integration

Insert mTLS processing into the existing `combined_auth_middleware()` in two stages:

```
Request
  │
  ▼
┌─────────────────────────────────────────────────┐
│ Rate Limiter (existing)                         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ [NEW] mTLS Header Extraction                    │
│   if mtls_enabled:                              │
│     parse X-SSL-Client-* headers                │
│     verify X-SSL-Client-Verify = "SUCCESS"      │
│     build CertificateInfo                       │
│     store in request.extensions                 │
│   else:                                         │
│     no-op (zero overhead)                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ JWT / API Key Authentication (existing)         │
│   try JWT → fallback API Key                    │
│   extract Claims + build AuthenticatedUser      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ [NEW] Certificate-Token Binding Verification    │
│   if CertificateInfo present in extensions:     │
│     extract claims.cnf.x5t_s256                 │
│     compare fingerprints (timing-safe)          │
│     match → continue                            │
│     mismatch → 403 MTLS_BINDING_MISMATCH        │
│   if no CertificateInfo + mtls_required:        │
│     → 401 MTLS_CERT_REQUIRED                    │
│   if no cnf + require_binding + cert present:   │
│     → 403 MTLS_BINDING_REQUIRED                 │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ RBAC Enforcement (existing)                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ OPA Policy Evaluation (existing)                │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
  Handler (AuthUser + CertInfo extractors)
```

**Key design choice**: mTLS extraction happens **before** JWT validation (to fail fast on invalid certificates), binding verification happens **after** (needs both cert and JWT claims).

### 4. Timing-Safe Comparison

Use `subtle::ConstantTimeEq` (from the `subtle` crate) for thumbprint comparison, matching the security guarantees of ADR-028's `secrets.compare_digest()`.

```
cert_fingerprint_hex (normalized) → bytes
cnf_x5t_s256 (base64url decoded) → bytes
bytes.ct_eq(&other_bytes)         → timing-safe comparison
```

**Not** `==` or `PartialEq` — those may short-circuit on first differing byte.

### 5. Fingerprint Normalization (Consistent with ADR-028)

Reimplement the same normalization algorithm from `fingerprint_utils.py` in Rust:

```
Input format detection:
  contains ':'  → hex_colons → strip colons → lowercase
  matches [a-fA-F0-9]+ → hex → lowercase
  otherwise → base64url → decode → hex lowercase

All comparisons done on hex lowercase (consistent with ADR-028).
```

### 6. Configuration (Figment)

New fields in `config.rs` under the existing Figment configuration system:

| Env Variable | Type | Default | Description |
|-------------|------|---------|-------------|
| `STOA_MTLS_ENABLED` | bool | `false` | Master switch |
| `STOA_MTLS_REQUIRE_BINDING` | bool | `true` | Reject tokens without `cnf` when cert present |
| `STOA_MTLS_HEADER_VERIFY` | String | `X-SSL-Client-Verify` | Verify status header name |
| `STOA_MTLS_HEADER_FINGERPRINT` | String | `X-SSL-Client-Fingerprint` | Fingerprint header name |
| `STOA_MTLS_HEADER_SUBJECT_DN` | String | `X-SSL-Client-S-DN` | Subject DN header name |
| `STOA_MTLS_HEADER_ISSUER_DN` | String | `X-SSL-Client-I-DN` | Issuer DN header name |
| `STOA_MTLS_HEADER_SERIAL` | String | `X-SSL-Client-Serial` | Serial number header name |
| `STOA_MTLS_HEADER_CERT` | String | `X-SSL-Client-Cert` | PEM cert header name |
| `STOA_MTLS_ALLOWED_ISSUERS` | String (comma-separated) | empty | Allowed issuer DNs |
| `STOA_MTLS_TENANT_FROM_DN` | bool | `true` | Extract tenant from Subject DN OU |

Header names are configurable to support different TLS terminators (F5, nginx, Envoy, HAProxy) per ADR-028's philosophy.

### 7. New Axum Extractor: `CertInfo`

```
CertInfo(pub Option<CertificateInfo>)
```

Handlers that need certificate metadata use this extractor. Returns `None` when mTLS is disabled or no certificate was presented (does not fail — optional by design).

### 8. Error Responses

| Condition | HTTP | Code | Body |
|-----------|------|------|------|
| `X-SSL-Client-Verify` missing, `mtls_enabled=true` | 401 | `MTLS_CERT_REQUIRED` | `client certificate required` |
| `X-SSL-Client-Verify != SUCCESS` | 403 | `MTLS_CERT_INVALID` | `client certificate validation failed` |
| JWT missing `cnf`, cert present, `require_binding=true` | 403 | `MTLS_BINDING_REQUIRED` | `certificate-bound token required` |
| Fingerprint mismatch | 403 | `MTLS_BINDING_MISMATCH` | `certificate binding mismatch` |
| Certificate expired (NotAfter in past) | 403 | `MTLS_CERT_EXPIRED` | `client certificate expired` |
| Issuer not in allowed list | 403 | `MTLS_ISSUER_DENIED` | `certificate issuer not allowed` |

Error format follows existing Gateway JSON pattern: `{"error": "...", "detail": "..."}`.

### 9. Bulk Onboarding Endpoint (Phase 3)

`POST /api/v1/admin/consumers/bulk` on the Control Plane API (Python):

- Input: CSV (multipart/form-data), max 100 rows
- Columns: `external_id, display_name, tenant_id, certificate_pem`
- Per row (atomic): validate cert → compute x5t_s256 → create Keycloak client + protocol mapper → store consumer
- Response: `{ total, success, failed, results: [{ row, status, consumer_id?, client_id?, error? }] }`
- Rows that fail do not block other rows
- Requires `cpi-admin` or `tenant-admin` role

This endpoint reuses the existing consumer creation flow from CAB-1121 Phase 2, adding certificate processing and batch orchestration.

## Consequences

### Positive

- **Parity with MCP Gateway**: same RFC 8705 binding validation, same normalization algorithm (ADR-028), implemented in Rust
- **Zero overhead when disabled**: `mtls_enabled=false` skips all header parsing and binding checks
- **Backward compatible**: `cnf: Option<CnfClaim>` on Claims does not break existing JWT deserialization
- **Timing-safe**: `subtle::ConstantTimeEq` prevents side-channel attacks on fingerprint comparison
- **Vendor-flexible**: configurable header names (ADR-028 principle carried forward)
- **Bulk onboarding**: enables provisioning 100 mTLS consumers in a single API call

### Negative

- **Duplicated normalization logic**: Rust re-implements `fingerprint_utils.py` (different runtimes, cannot share code). Must stay in sync manually.
- **Two middleware stages**: mTLS extraction (pre-JWT) and binding verification (post-JWT) adds complexity to the middleware pipeline
- **`subtle` crate dependency**: adds a new dependency for timing-safe comparison (small, well-audited crate)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Normalization divergence between Python and Rust | Medium | High | Shared test vectors; CI test that verifies both produce identical output for reference inputs |
| `serde(rename = "x5t#S256")` fails on `#` in field name | Low | High | Integration test with real Keycloak-issued token containing `cnf` claim |
| Header spoofing from inside cluster | Low | High | K8s NetworkPolicy restricting X-SSL-* header sources (ADR-027) |
| Performance regression with mTLS enabled | Low | Low | Benchmark: header parsing + SHA-256 comparison < 5us per request |

## Implementation Plan

### Phase 2: Gateway mTLS Module (CAB-864 P2)

| Step | Files | Description |
|------|-------|-------------|
| 1 | `auth/mtls.rs` | `MtlsConfig`, `CertificateInfo`, `CnfClaim`, header extraction, binding verification, `hex_to_base64url` |
| 2 | `auth/claims.rs` | Add `cnf: Option<CnfClaim>` to `Claims` struct |
| 3 | `auth/middleware.rs` | Insert mTLS extraction (pre-JWT) and binding verification (post-JWT) into pipeline |
| 4 | `auth/mod.rs` | Export `mtls` module, `CertInfo` extractor |
| 5 | `config.rs` | Add `MtlsConfig` section with Figment env var mapping |
| 6 | `Cargo.toml` | Add `subtle` and `base64` crate dependencies |
| 7 | `auth/mtls.rs` (tests) | Unit tests: header parsing, fingerprint normalization, binding match/mismatch, timing-safe comparison |
| 8 | `auth/middleware.rs` (tests) | Integration tests: full pipeline with mTLS headers + JWT + cnf claim; backward compat (disabled) |

### Phase 3: Bulk Onboarding (CAB-864 P3)

| Step | Files (control-plane-api) | Description |
|------|--------------------------|-------------|
| 1 | `routers/consumers.py` | `POST /v1/admin/consumers/bulk` endpoint |
| 2 | `services/consumer_service.py` | Batch processing logic with per-row atomicity |
| 3 | `services/keycloak_service.py` | Protocol mapper auto-configuration for `cnf` claim |
| 4 | `tests/test_consumers_bulk.py` | Unit + integration tests for bulk endpoint |

## References

- [RFC 8705 — OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens](https://datatracker.ietf.org/doc/html/rfc8705)
- [subtle crate — Constant-time operations for Rust](https://crates.io/crates/subtle)
- ADR-027: X509 Header-Based Authentication
- ADR-028: RFC 8705 Certificate Binding Validation
- ADR-029: mTLS Certificate Lifecycle Management
- `control-plane-api/src/services/fingerprint_utils.py` — Python normalization reference
