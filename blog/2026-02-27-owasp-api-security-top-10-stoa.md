---
slug: owasp-api-security-top-10-stoa
title: "OWASP API Security Top 10: Gateway Controls That Help"
description: "Map each OWASP API risk to gateway-level controls. Which risks a gateway mitigates, which need app-level fixes, and where gaps remain."
authors: [stoa-team]
tags: [security, comparison, tutorial, api-gateway]
keywords:
  - OWASP API security top 10 2023
  - OWASP API1 broken object level authorization
  - API security gateway OWASP
  - OWASP API security checklist
  - API gateway security compliance
  - API security best practices 2026
  - broken function level authorization API
  - unrestricted resource consumption API
  - OWASP API4 unrestricted resource consumption
  - OWASP compliance API gateway
---
<!-- last verified: 2026-02 -->

The OWASP API Security Top 10 (2023) lists the most critical API security risks. An API gateway like STOA helps address several of these at the infrastructure layer — but not all of them. This article maps each OWASP risk to STOA's controls, with an honest assessment of what requires application-level implementation.

<!-- truncate -->

:::info
This article discusses OWASP API Security Top 10 (2023 edition). Feature comparisons reflect STOA Platform capabilities as of 2026-02. For architecture details, see [STOA Security Architecture](/blog/stoa-api-security-architecture). For AI agent-specific patterns, see [AI Agent Security: 5 Authentication Patterns](/blog/ai-agent-security-authentication-patterns).
:::

> Feature comparisons are based on publicly available OWASP documentation and STOA Platform documentation as of 2026-02. API security is a shared responsibility — gateway-level controls address the infrastructure layer. Application-level security requires implementation in backend services. STOA supports compliance efforts but does not constitute a guarantee of OWASP compliance.

## Summary Table

<!-- last verified: 2026-02 -->

| OWASP Risk | Category | STOA Coverage | Notes |
|------------|----------|--------------|-------|
| API1: Broken Object Level Authorization | Access Control | Partial | STOA enforces scope + OPA policies; object-level authz requires backend implementation |
| API2: Broken Authentication | Authentication | Strong | OAuth 2.1 + PKCE + mTLS certificate binding |
| API3: Broken Object Property Level Authorization | Access Control | Partial | Response filtering configurable; full field-level enforcement requires backend |
| API4: Unrestricted Resource Consumption | Rate Limiting | Strong | Per-consumer rate limiting, quota enforcement, burst protection |
| API5: Broken Function Level Authorization | Access Control | Moderate | OPA policies on paths + HTTP methods; requires policy configuration |
| API6: Unrestricted Access to Sensitive Business Flows | Business Logic | Partial | OPA flow policies; business logic enforcement requires application-level implementation |
| API7: Server Side Request Forgery | SSRF | Moderate | SSRF blocklist on outbound requests; requires backend validation |
| API8: Security Misconfiguration | Configuration | Moderate | Secure defaults; requires operator review |
| API9: Improper Inventory Management | Governance | Moderate | API registry with deployed versions; shadow API detection requires additional tooling |
| API10: Unsafe Consumption of APIs | Supply Chain | Partial | Input validation + schema enforcement; third-party API risks require separate controls |

## Detailed Coverage by Risk

### API1: Broken Object Level Authorization (BOLA)

**Risk**: API endpoints that accept object IDs from clients without verifying that the calling user is authorized to access that specific object. For example: `GET /orders/1234` where `1234` belongs to a different tenant.

**STOA's contribution**: STOA enforces authentication and coarse-grained authorization (JWT scopes, OPA policies on paths). Multi-tenant isolation is enforced at the tenant level — requests are attributed to a consumer and tenant, and cross-tenant access is blocked at the routing layer.

**What requires backend implementation**: Object-level authorization (does this specific consumer own order `1234`?) requires the backend service to validate the requesting identity against the resource owner. An API gateway doesn't have visibility into application data models.

**Relevant STOA features**: Consumer identity propagation (X-Consumer-ID header), multi-tenant routing, OPA path policies.

---

### API2: Broken Authentication

**Risk**: Weak or absent authentication mechanisms enabling attackers to impersonate legitimate users or bypass authentication entirely.

**STOA's contribution**: This is an area where STOA provides strong coverage:

- **OAuth 2.1 with PKCE**: industry-standard authorization, resistant to authorization code interception
- **mTLS certificate binding (RFC 8705)**: access tokens are cryptographically bound to client certificates; stolen tokens cannot be replayed from a different client
- **Token validation on every request**: JWT signature, expiry, issuer, audience verified per call
- **Short-lived tokens**: 15-minute access tokens minimize the stolen-token window
- **Keycloak-backed identity**: Keycloak manages identity with MFA, brute-force protection, and credential policies

For AI agents (public clients), the combination of OAuth 2.1 PKCE + mTLS certificate binding addresses OWASP API2 at the gateway layer. See [OAuth 2.1 + PKCE for MCP Gateways](/blog/oauth-pkce-mcp-gateway) for the complete flow, and [AI Agent Security: 5 Authentication Patterns](/blog/ai-agent-security-authentication-patterns) for broader patterns.

**What requires additional configuration**: Authentication mechanisms only work if properly configured. Weak credential policies, missing MFA for admin accounts, or improperly configured token lifetimes undermine authentication.

---

### API3: Broken Object Property Level Authorization (BOPLA)

**Risk**: Exposing too many object properties to callers, including sensitive fields they shouldn't see, or allowing mass assignment where users can modify fields they shouldn't.

**STOA's contribution**: STOA supports **response filtering** — OPA policies can be configured to strip fields from responses based on consumer tier. For example, an analytics consumer might receive aggregated data without PII fields.

**What requires backend implementation**: Field-level authorization in complex data models requires the backend to understand the data schema. Mass assignment protection requires server-side input validation. STOA helps at the layer of what data leaves the gateway, but backend services must implement their own field filtering.

---

### API4: Unrestricted Resource Consumption

**Risk**: APIs without limits on request volume, payload size, or query complexity, enabling denial-of-service and resource exhaustion attacks.

**STOA's contribution**: Strong coverage at the gateway layer:

- **Rate limiting**: per-consumer, per-endpoint, configurable windows (per second, per minute, per hour)
- **Quota enforcement**: hard limits on daily/monthly call volumes by subscription tier
- **Burst protection**: token bucket algorithm handles traffic spikes without rejecting legitimate requests
- **Request size limits**: configurable maximum payload size per endpoint
- **Response size limits**: guardrails can truncate oversized responses
- **Concurrent connection limits**: configurable per consumer

STOA's rate limiting is backed by an in-memory store with configurable policies. Consumers exceeding limits receive `429 Too Many Requests` with a `Retry-After` header.

---

### API5: Broken Function Level Authorization

**Risk**: Access control enforced on data objects but not on API functions (HTTP methods and endpoint paths). Users can call administrative functions by guessing endpoint URLs.

**STOA's contribution**: OPA policies in STOA can be written to enforce authorization by HTTP method and path:

```rego
# Block POST/PUT/DELETE for read-only consumers
deny {
    input.consumer.scope == "stoa:read"
    input.method != "GET"
    input.method != "HEAD"
    input.method != "OPTIONS"
}

# Block /admin/* for non-admin consumers
deny {
    not contains(input.consumer.scope, "stoa:admin")
    startswith(input.path, "/admin/")
}
```

**Coverage level**: This provides function-level authorization at the gateway, but only for endpoints that are proxied through STOA. If backend services expose endpoints directly (bypassing the gateway), gateway-level policies don't apply.

---

### API6: Unrestricted Access to Sensitive Business Flows

**Risk**: APIs exposed to automated abuse of business logic (e.g., bulk account creation, credential stuffing, mass coupon redemption).

**STOA's contribution**: OPA policies can implement flow-level controls:
- Limit specific sequences of operations (e.g., max 3 password resets per hour)
- Detect anomalous usage patterns via rate limiting on specific paths
- Block known automation patterns via user-agent policies

**Limitations**: True business flow protection requires understanding application logic. STOA can rate-limit specific paths, but complex multi-step flow abuse (cart manipulation, sequential discount stacking) requires application-level detection.

---

### API7: Server Side Request Forgery (SSRF)

**Risk**: Attacker-controlled input causes the API server to make HTTP requests to internal resources (cloud metadata APIs, internal services).

**STOA's contribution**: STOA maintains an SSRF blocklist for outbound requests:
- Blocks requests to `169.254.169.254` (AWS/GCP metadata)
- Blocks requests to `localhost`, `127.0.0.1`, `::1`
- Blocks requests to private IP ranges (`10.x`, `172.16.x`, `192.168.x`) unless explicitly allowed

This applies to requests where STOA acts as a proxy or where backend URLs are configurable.

**Limitations**: SSRF in backend application code is not addressable at the gateway layer. Applications that construct URLs from user input must validate those URLs independently of the gateway.

---

### API8: Security Misconfiguration

**Risk**: Insecure defaults, incomplete configurations, improper permissions, missing encryption, or excessive error verbosity.

**STOA's contribution**: Secure defaults throughout:
- TLS 1.2+ enforced, TLS 1.0/1.1 disabled
- Detailed error messages returned to clients contain no internal stack traces or system details
- Security headers set automatically (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`)
- OPA defaults to deny (missing policy = reject)
- All API management operations require authentication

**What requires operator review**: Gateway configurations are only as secure as how they're deployed. Operators must: enable mTLS in production, set appropriate token TTLs, review OPA policies for unintended permissiveness, and restrict access to the STOA admin API.

---

### API9: Improper Inventory Management

**Risk**: Outdated or shadow API versions exposed in production that lack the security controls of current versions.

**STOA's contribution**: The STOA control plane maintains a registry of all deployed APIs with their version, status, and endpoint configuration. Operators can view and deprecate old API versions via the Console or API.

**Limitations**: STOA manages APIs that are registered with the platform. Shadow APIs (deployed directly to backend services, bypassing STOA) are not visible without separate network-layer discovery tooling.

---

### API10: Unsafe Consumption of APIs

**Risk**: Applications trusting third-party API data without validation, enabling injection via upstream APIs.

**STOA's contribution**: Request and response schema validation ensures data conforms to expected OpenAPI specifications. Guardrails scan response payloads for injection patterns before forwarding to clients. This partially addresses third-party API trust issues when STOA sits between clients and upstream APIs.

**Limitations**: Validating semantic trust (is this data legitimate?) requires application-level logic. Schema validation catches structure violations, not semantic manipulation.

## Implementation Recommendations

To maximize OWASP coverage with STOA:

1. **Enable mTLS for all agent connections** — addresses API2 at the transport layer
2. **Define OPA policies for every consumer tier** — addresses API1, API5, API6 at the gateway layer
3. **Configure per-endpoint rate limits** — addresses API4
4. **Enable guardrails + response filtering** — addresses API3, API7, API10 partially
5. **Use STOA's API registry for version management** — addresses API9
6. **Review the security hardening checklist** — see [API Gateway Security Hardening](/blog/api-gateway-security-hardening-guide)

**What STOA does not replace**: Application-level authorization, business logic validation, and third-party API trust decisions require implementation in backend services and are out of scope for an API gateway.

## Frequently Asked Questions

### Does using STOA make my APIs OWASP-compliant?

STOA helps address several OWASP API Security Top 10 risks at the infrastructure layer. OWASP compliance is not a binary state — it's an assessment of whether specific controls are implemented for specific risks. Using STOA addresses the gateway layer controls. Application-layer risks (object ownership, business logic, third-party trust) require backend implementation. Organizations seeking formal compliance assessment should engage a qualified security assessor.

### Which OWASP risks does STOA address most strongly?

STOA provides the strongest coverage for API2 (authentication), API4 (resource consumption), and API8 (configuration). These are infrastructure-layer concerns that an API gateway is specifically designed to address. API1, API3, API5, API6 require a combination of gateway policies and backend implementation.

### Is the OWASP API Security Top 10 the same as the OWASP Top 10?

No. The OWASP Top 10 covers web application vulnerabilities (injection, XSS, CSRF, etc.). The OWASP API Security Top 10 is a separate list focused on API-specific risks. Some overlap exists (authentication, security misconfiguration), but the API list addresses patterns specific to API design — object authorization, property exposure, business flow abuse — that are not prominent in web application contexts.

---

*STOA Platform is open-source (Apache 2.0). Explore the [security documentation](https://docs.gostoa.dev/docs/reference/security) or [deploy the gateway](https://docs.gostoa.dev/docs/guides/quickstart).*
