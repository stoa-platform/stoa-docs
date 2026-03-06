# ADR-056: FAPI 2.0 Security Architecture

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-03-06 |
| **Ticket** | CAB-1733 |
| **Author** | Christophe Aboulicam |
| **Reviewers** | Council 8.13/10 |

## Context

STOA Gateway (65K LOC Rust) already implements sender-constrained tokens via DPoP (RFC 9449) and mTLS (RFC 8705) — the two hardest FAPI 2.0 requirements. However, full FAPI 2.0 Security Profile conformance requires additional capabilities (PAR, private_key_jwt, confidential clients) that are currently missing.

Production Keycloak 26.5.3 supports FAPI 2.0 client profiles natively (`fapi-2-security-profile`, `fapi-2-dpop-security-profile`). No Keycloak upgrade is needed — only configuration activation and gateway-side implementation of missing flows.

### Current State (Spike Results)

**Implemented (FAPI 2.0 compliant)**:
- DPoP proof validation — full RFC 9449 Section 4.3, 843 LOC, replay prevention via moka cache
- mTLS certificate binding — full RFC 8705, 1,122 LOC, cnf.x5t#S256 verification
- Unified sender-constraint middleware — DPoP + mTLS in single pipeline, 621 LOC
- PKCE S256 enforcement — via DCR client patching
- OAuth discovery — RFC 9728 + RFC 8414 metadata
- Token exchange — RFC 8693 in Control Plane API (10 test cases)

**Missing (required for FAPI 2.0)**:
- PAR (Pushed Authorization Requests, RFC 9126) — no code exists
- private_key_jwt client authentication (RFC 7523) — only client_secret supported
- Confidential client enforcement — current MCP OAuth uses public clients (PKCE without secret)
- Token revocation proxy — Keycloak handles it, gateway doesn't proxy

**Missing (recommended/optional)**:
- JARM (JWT-Secured Authorization Response Mode)
- RAR (Rich Authorization Requests, RFC 9396)
- CIBA (Client-Initiated Backchannel Authentication)

## Decision

Adopt a **phased approach** to FAPI 2.0 conformance with a dual-mode transition period:

### Architecture

```
                        FAPI 2.0 Security Profile
                        ========================

Client                  STOA Gateway                    Keycloak 26.5.3
  |                         |                               |
  |--- PAR Request -------->| POST /oauth/par               |
  |                         |--- Forward PAR ------------->  |
  |<-- request_uri ---------|<-- request_uri + expiry ------|
  |                         |                               |
  |--- Auth Request ------->| (validate request_uri)        |
  |                         |--- Forward auth ------------> |
  |<-- auth code -----------|<-- auth code -----------------|
  |                         |                               |
  |--- Token Request ------>| POST /oauth/token             |
  |  + client_assertion     |--- Validate JWT assertion --->|
  |  + code_verifier        |--- Forward token req -------->|
  |  + DPoP proof           |<-- access_token + cnf.jkt ----|
  |<-- access_token --------|                               |
  |                         |                               |
  |--- API Request -------->| Verify:                       |
  |  + DPoP proof           |  1. JWT signature             |
  |  + mTLS cert            |  2. DPoP binding (cnf.jkt)    |
  |                         |  3. mTLS binding (cnf.x5t)    |
  |                         |  4. OPA policy                |
  |<-- Response ------------|                               |
```

### Threat Model (STRIDE)

| Threat | Category | Mitigation |
|--------|----------|------------|
| Token theft + replay | Spoofing | DPoP binding (cnf.jkt) — token unusable without private key |
| Man-in-the-middle | Tampering | mTLS binding (cnf.x5t#S256) — cert pinned to token |
| Authorization code injection | Tampering | PAR — auth params sent server-side, not in URL |
| Client impersonation | Spoofing | private_key_jwt — no shared secrets, asymmetric proof |
| Token exfiltration | Info Disclosure | Sender constraints — stolen token requires matching DPoP/cert |
| Scope escalation | Elevation | OPA policy enforcement + RAR (Phase 2) |

### Dual-Mode Transition

During transition, gateway supports **two client security profiles** simultaneously:

| Profile | Auth Method | Clients | Timeline |
|---------|-------------|---------|----------|
| **Standard** (current) | Public PKCE + `auth_method: none` | Claude.ai, MCP clients | Now → Phase 2 end |
| **FAPI 2.0** | Confidential + `private_key_jwt` + DPoP/mTLS | Financial/regulated clients | Phase 1 → permanent |

Per-client profile is determined by Keycloak client configuration. Existing MCP clients continue working unchanged. New FAPI clients get the full security profile.

### Gateway ↔ Control Plane API Boundary

| Concern | Gateway (Rust) | CP API (Python) |
|---------|---------------|-----------------|
| PAR endpoint proxy | `POST /oauth/par` → KC | N/A |
| Client assertion validation | JWT signature verify | N/A |
| Sender constraint enforcement | DPoP + mTLS middleware | N/A |
| Token exchange | N/A (future Phase 2) | `POST /v1/consumers/.../token-exchange` |
| Client lifecycle | DCR proxy + PKCE patch | `create_consumer_client()` with FAPI config |
| FAPI client profile assignment | N/A | KC admin API — set client profile |

## Implementation Phases

### Phase 1 — FAPI 2.0 Foundation ✅ (completed PR #1526)

1. ✅ **PAR proxy** (`POST /oauth/par`) — new endpoint, forward to KC, return `request_uri`
2. ✅ **Enable KC FAPI profile** — `fapi-2-security-profile` on new clients
3. ✅ **OTel activation** — runtime kill-switch (`OTEL_ENABLED=true/false`), not compile-time only
4. ✅ **ADR + docs** — this document
5. ✅ **Unify KC versions** — quickstart/E2E to 26.5.3

### Phase 2 — Confidential Clients + Governance (3-6 months)

6. ✅ **private_key_jwt** — client assertion parsing, JWKS validation, discovery metadata update (PR #1531)
7. **Token exchange in gateway** — RFC 8693 proxy for agent delegation chains
8. **RAR** — rich authorization requests for fine-grained API access
9. **Agent delegation model** — `on_behalf_of` claim, intent tracking, consent

### Phase 3 — Certification (6-12 months)

10. **FAPI 2.0 conformance test suite** — OpenID Foundation tests
11. **Formal certification** — OpenID Foundation listing
12. **STRIDE threat model** — formal security review

### Phase 4 — Innovation (12-18 months)

13. **eBPF sidecar mode** — kernel-level policy enforcement
14. **eIDAS 2.0** — EU Digital Identity Wallet integration
15. **FAPI 2.0 Message Signing** — request/response non-repudiation

## Consequences

### Positive
- STOA becomes one of the first open-source API gateways with FAPI 2.0 conformance
- Unlocks regulated market segments (finance, health, e-government)
- Existing DPoP + mTLS investment (2,586 LOC) is directly reused
- Keycloak 26.5.3 already deployed — no infrastructure upgrade needed
- Dual-mode prevents breaking existing MCP integrations

### Negative
- PAR adds latency (extra round-trip to KC before authorization)
- private_key_jwt requires client key management (JWKS endpoints per client)
- Confidential client requirement breaks current Claude.ai MCP flow (mitigated by dual-mode)
- FAPI certification has ongoing maintenance cost (annual re-certification)

### Risks
- Claude.ai may not support private_key_jwt for MCP OAuth (mitigation: keep standard profile)
- Keycloak FAPI 2.0 profiles may have edge cases not covered by KC tests (mitigation: own conformance suite)
- OTel runtime toggle may have performance impact even when disabled (mitigation: benchmark)

## References

- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-security-profile-id2-2-01.html)
- [RFC 9449 — DPoP](https://www.rfc-editor.org/rfc/rfc9449)
- [RFC 8705 — mTLS](https://www.rfc-editor.org/rfc/rfc8705)
- [RFC 9126 — PAR](https://www.rfc-editor.org/rfc/rfc9126)
- [RFC 7523 — JWT Bearer Client Auth](https://www.rfc-editor.org/rfc/rfc7523)
- [RFC 8693 — Token Exchange](https://www.rfc-editor.org/rfc/rfc8693)
- [Keycloak 26 FAPI 2.0 Support](https://www.keycloak.org/docs/latest/securing_apps/#_fapi-2-0-support)
