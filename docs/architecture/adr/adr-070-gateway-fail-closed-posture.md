---
sidebar_position: 70
title: "ADR-070: Gateway Fail-Closed Posture"
sidebar_label: "ADR-070: Gateway Fail-Closed"
description: "Deny-by-default posture for STOA tool-permission enforcement: deny when no fresh Control Plane-signed policy is available, never extend a cached policy locally, revocation overrides cache, readiness reflects real enforcement state."
keywords: [ADR, gateway, fail-closed, deny by default, signed policy, Ed25519, JWS, readiness, revocation, DORA, NIS2, sovereign]
---

# ADR-070: Gateway Fail-Closed Posture

:::info Accepted
The posture was drafted on 2026-05-13 and accepted on 2026-11-03, together with the signed policy artifact contract in the [annex](#annex-signed-policy-artifact-contract). Items marked **[To be confirmed]** are implementation details still open; they do not change the decision.
:::

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-05-13 |
| **Updated** | 2026-11-03 — accepted; signed artifact contract (annex) and readiness contract fixed |
| **Decision Makers** | Christophe Aboulicam |
| **Related** | [ADR-024](/docs/architecture/adr/adr-024-gateway-unified-modes), [ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first), [ADR-067](/docs/architecture/adr/adr-067-uac-as-llm-optimized-executable-contract), [ADR-068](/docs/architecture/adr/adr-068-audit-log-actor-resource-views), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |

## Context

The component that enforces MCP tool permissions (STOA Gateway today, and the STOA logic that runs alongside Envoy under [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) depends on the Control Plane API (CP-API) for its policy. When that dependency degrades (CP-API unreachable, policy load failure, stale cache, missed revocation), the behaviour must be explicit and safe by default.

For regulated tenants (DORA, NIS2), an enforcement point that silently allows calls when its source of truth is missing is not acceptable. Choosing deny-by-default has a product cost: a CP-API outage can turn into an access outage on the data plane. This ADR records that trade-off as an explicit decision.

## Decision

Tool-permission enforcement is **deny-by-default**. Every exception is explicit, scoped to a tenant, signed by the CP-API, bounded in time, and audited.

### 1. Fail-closed invariants

| Condition | Behaviour |
|-----------|-----------|
| CP-API unreachable and no valid signed policy artifact | **Deny new calls** with 503, `Retry-After` and a stable error code. In-flight calls drain. |
| CP-API unreachable and a valid signed policy artifact exists | **Allow per artifact, only until its `expires_at`.** Validity is never extended locally. |
| Policy load fails at boot | **Readiness fails.** No call subject to permissions is allowed. |
| Permission for a (tenant, MCP server, tool) absent from the artifact | **Deny.** Audit event with a stable reason. |
| Revocation received for a tenant | **Invalidate immediately**, even if the artifact has not expired. Revocation overrides cache. |
| `requires_human_approval=true` without a valid approval token | **Deny.** |
| `inputSchema` validation fails | **Deny.** No tool invocation. |
| `outputSchema` validation fails | Replace the response with an error; never return a malformed contract. |

### 2. Signed policy artifact

The cache used during a CP-API outage is a first-class artifact issued and signed by the CP-API, not an in-memory shortcut. Its contract is fixed in the [annex](#annex-signed-policy-artifact-contract). The artifact is verified on every decision, including cache hits. A missing, invalid, expired or out-of-scope artifact is treated as "no artifact".

### 3. No implicit read-only fallback

There is no degraded "read-only" mode. STOA does not yet have a machine-readable, signed proof that an operation has no side effects (see [ADR-067](/docs/architecture/adr/adr-067-uac-as-llm-optimized-executable-contract)). Any future read-only mode requires an amendment to this ADR.

### 4. Readiness and liveness

| Probe | Meaning | Conditions for OK |
|-------|---------|-------------------|
| **Liveness** | Process is up | The process responds. |
| **Readiness** | The gateway can faithfully enforce policy | (a) the trusted signing keys are loaded and valid; (b) a policy artifact was successfully fetched and verified within the last 60 minutes; (c) the durable audit spool is below its high-water mark. |

A missing artifact for a single tenant leads to per-request denial for that tenant, not to a readiness failure. Failing readiness stops new traffic; liveness is not affected.

### 5. Observability

Every fail-closed transition emits a structured audit event (`action=health_degrade`, with reason and verified `policy_version`), a Prometheus gauge `stoa_gateway_failclosed_active{reason=...}`, and an OTLP span. An alert fires when the gauge stays above 0 for more than 60 seconds.

### 6. Durable audit of denials

Denials and approval-gated events are written to a durable local spool before being forwarded to the CP-API (schema per [ADR-068](/docs/architecture/adr/adr-068-audit-log-actor-resource-views)). Rules:

1. A restart keeps unflushed events.
2. Crossing the high-water mark (default 80 % of capacity) fails readiness.
3. No silent drop: if the spool cannot accept an event, the gateway declares an `audit_gap_declared` event locally and denies every call in scope.
4. On recovery, the spool drains oldest-first and emits `audit_chain_resumed`.
5. Spool depth, oldest entry age and gap count are exported as metrics.

## Consequences

### Positive

- One citable answer to "what does the gateway do when the Control Plane is down?".
- Degraded states are detectable, alertable and covered by a runbook (DORA Art. 5 and 9).
- A gateway cannot forge or extend its own policy.

### Negative

- A CP-API outage longer than the artifact lifetime becomes an access outage; the SLO of the data plane is coupled to the CP-API. This is accepted.
- More signals to monitor (readiness, spool, artifact freshness).
- A signing key to provision, protect and rotate.

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep permissive fallbacks and document them | ❌ Paper compliance |
| Allow a stale cache indefinitely during an outage | ❌ Policy drift and invisible revocations |
| Shared-secret MAC instead of a signature | ❌ Any gateway could mint its own policy |
| Deny after a few missed refreshes, regardless of artifact validity | ❌ Turns a 2-minute CP-API blip into an outage; a short artifact lifetime gives the same bound |
| Implicit read-only fallback | ❌ No machine-readable proof of read-only yet |
| **Deny-by-default, signed short-lived artifact, readiness gate, durable audit of denials** | ✅ Selected |

## Annex: signed policy artifact contract

**A1. Format and algorithm.** Compact JWS (RFC 7515), `alg=EdDSA` with Ed25519 (RFC 8037), header `typ="stoa-tool-policy+jws"` and a mandatory `kid`. Any other `alg` (including `none`) is rejected. Headers `jwk`, `jku`, `x5u`, `x5c` and `crit` are rejected and never followed. The signature covers the exact emitted bytes; no canonicalization is needed.

**A2. Payload.** `iss="stoa-control-plane"`, `aud` (default `"stoa-gateway"`, configurable per deployment), `typ`, `tenant_id`, `tenant_uuid`, `policy_version` (integer), `issued_at` and `expires_at` (integer Unix seconds, UTC), `deny_default=true`, and `allow_set`: a sorted list of unique `{mcp_server, tool}` pairs. A duplicate or malformed entry rejects the whole artifact. `issued_at` and `expires_at` are validated explicitly by STOA code, not by library defaults.

**A3. Size.** At most 5000 entries and 1 MiB. The CP-API refuses to issue beyond that; the gateway limits the HTTP body before decoding and counts entries after signature verification. Oversized artifacts are rejected, never truncated.

**A4. Lifetime and clock.** Default lifetime 900 seconds (deployed value at most 900 s), hard cap 3600 seconds checked on both sides. Valid if and only if `now < expires_at`. Rejected if `issued_at` is more than 30 seconds in the future, or if `expires_at <= issued_at`. Clock synchronisation (NTP, local on premises) is a security prerequisite.

**A5. Keys and trust.** The CP-API signing key is dedicated to this use, mounted read-only and readable only by the CP-API service account. It never appears in a repository, image, environment file, ConfigMap, log or health output. Gateways trust a pinned JWKS file (`kty=OKP`, `crv=Ed25519`), with at most two keys; a non-conforming JWKS is rejected as a whole. Write access to the JWKS is as restricted as the private key. The control plane reads the dedicated private signing key from a mounted Kubernetes secret file whose path is given by `STOA_POLICY_SIGNING_KEY_FILE` (PEM PKCS#8, Ed25519); gateways verify with a pinned JWKS file whose path is given by `STOA_POLICY_TRUST_JWKS_FILE`.

**A6. Rotation.** `kid` format `cp-policy-YYYYMM-n`. (1) Add the new public key to every gateway and confirm. (2) Switch every CP-API instance to the new key. (3) Remove the old key no earlier than 65 minutes after step 2 is complete on all instances. A backup key is kept in the second JWKS slot. On suspected compromise, remove the key immediately; artifacts it signed are then denied until reissued.

**A7. Delivery.** A dedicated CP-API sub-route returns the complete tenant snapshot in a single artifact, without pagination. Gateways refresh every 30 seconds with jitter and `If-None-Match`; the CP-API reissues when less than half of the lifetime remains. At startup, a gateway accepts only artifacts issued after it started, and never falls back to an earlier artifact before the first fresh one.

**A8. Versioning and revocation.** `policy_version` is a per-tenant counter, incremented in the same transaction as any permission change; snapshots read version and permissions consistently. The gateway keeps a per-tenant floor and rejects any artifact below it; at equal version, `issued_at` must not go backwards. After committing a change that removes a permission, the CP-API notifies gateways through the existing CP-to-gateway administration channel (with retries, failures logged and visible in health), which raises the floor (raise-only, idempotent, rate-limited). The periodic refresh is the backstop. Worst-case revocation window: 30 seconds when the CP-API is reachable, one artifact lifetime when it is not.
