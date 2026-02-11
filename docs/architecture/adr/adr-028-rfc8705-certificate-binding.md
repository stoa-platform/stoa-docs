---
title: "ADR-028: RFC 8705 Certificate Binding Validation"
description: "Decides how the MCP Gateway validates certificate-bound JWT tokens using RFC 8705 fingerprint normalization and timing-safe comparison."
keywords: [RFC 8705, certificate binding, JWT, mTLS, fingerprint, security]
---

# ADR-028: RFC 8705 Certificate Binding Validation

## Status

Accepted

## Date

2026-02-01

## Context

STOA supports mTLS for API client authentication using RFC 8705 Certificate-Bound Access Tokens. JWT tokens contain a `cnf.x5t#S256` claim with the client certificate's SHA-256 fingerprint. The MCP Gateway must validate that the certificate presented by the client (via the TLS-terminating proxy header) matches the fingerprint bound to the JWT.

The challenge: different systems in the chain use different fingerprint formats.

| System | Format | Example |
|--------|--------|---------|
| RFC 8705 JWT (`cnf.x5t#S256`) | base64url | `hLmVMvjnmCm_I4d8_3nw5A` |
| F5 / Nginx (default) | hex lowercase | `84b99532f8e79829bf23877cff79f0e4` |
| OpenSSL CLI output | hex with colons | `84:B9:95:32:F8:E7:98:29:BF:23:87:7C:FF:79:F0:E4` |

Additionally, the header name injected by the TLS-terminating proxy varies per deployment (`X-SSL-Client-Cert-SHA256`, `X-Client-Cert-Fingerprint`, `SSL_CLIENT_FINGERPRINT`, etc.).

### Related Decisions

- **ADR-027**: X509 Header-Based Authentication — header contract between F5 and Keycloak
- **ADR-011**: API Security Modes — mTLS for CORE internal APIs
- **CAB-868**: Certificate Binding Metrics
- **CAB-1024**: UAC-Driven Certificate Binding Policy

## Decision

### 1. Normalize to hex lowercase for all comparisons

All three fingerprint formats are normalized to lowercase hex (no separators) before comparison. This avoids case-sensitivity issues and format ambiguity.

```
base64url  →  decode  →  hex lowercase
hex upper  →  lower   →  hex lowercase
hex:colons →  strip   →  hex lowercase
```

### 2. Timing-safe comparison

All fingerprint comparisons use `secrets.compare_digest()` to prevent timing-based side-channel attacks. This applies to both the MCP Gateway middleware and the shared `fingerprint_utils` module.

### 3. Auto-detect format when not specified

`detect_format(fingerprint)` inspects the string pattern:
- Contains `:` → `hex_colons`
- Matches `^[a-fA-F0-9]+$` → `hex`
- Otherwise → `base64url` (with charset validation: `^[A-Za-z0-9\-_]+$`)

### 4. UAC-driven configuration

All certificate binding parameters are configurable per tenant via the UAC (Universal API Contract) schema:

| UAC Path | Type | Default | Description |
|----------|------|---------|-------------|
| `security.authentication.mtls.cert_binding.enabled` | boolean | `true` | Enable cert binding validation |
| `security.authentication.mtls.cert_binding.header_name` | string | `X-SSL-Client-Cert-SHA256` | Header from TLS proxy |
| `security.authentication.mtls.cert_binding.fingerprint_format` | enum | `hex` | Format: `base64url`, `hex`, `hex_colons` |
| `security.authentication.mtls.cert_binding.jwt_claim` | string | `cnf.x5t#S256` | JWT claim path |
| `security.authentication.mtls.cert_binding.strict_mode` | boolean | `true` | Reject if `cnf` present but header absent |

### 5. Centralized utilities

All format conversion logic lives in `control-plane-api/src/services/fingerprint_utils.py`:
- `FingerprintFormat` enum
- `detect_format()`, `normalize_to_hex()`, `hex_to_base64url()`
- `fingerprints_match()` — timing-safe cross-format comparison

The MCP Gateway duplicates normalization inline (cannot import from control-plane-api), but follows the same algorithm.

### 6. webMethods policy generation

The UAC cert_binding config generates a webMethods `requestProcessing` policy action via `mappers.py`, passing header name, format, JWT claim, and strict mode as input mapping parameters.

## Consequences

### Positive

- **Works with any F5/LB configuration** — header name and format are configurable, not hardcoded
- **No code changes per deployment** — UAC schema drives all configuration
- **Secure against timing attacks** — `secrets.compare_digest` throughout
- **Cross-format matching** — same fingerprint in hex, base64url, or colons all match correctly
- **Feature flag** — `cert_binding_enabled` allows progressive rollout

### Negative

- **Three format conversions** — must handle base64url, hex, and hex_colons correctly
- **UAC schema complexity** — adds a nested `cert_binding` object to `security.authentication.mtls`
- **Duplicated normalization** — MCP Gateway and control-plane-api each have their own implementation (different runtimes)

### Risks

- **Base64url ambiguity** — a hex string like `abcdef1234` could be misdetected as hex when it's actually base64url. Mitigated by explicit format hints in UAC config.
- **Header spoofing** — if the proxy header is not stripped from external requests, an attacker could inject a forged fingerprint. Mitigated by F5/Nginx configuration (trusted proxy only).
