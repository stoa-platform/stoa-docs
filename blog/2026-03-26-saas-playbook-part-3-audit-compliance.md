---
unlisted: true
slug: saas-playbook-3-audit-compliance
title: "SaaS Audit Logging: GDPR, SOC 2, and Per-Tenant Isolation"
description: "Build audit-ready multi-tenant APIs. Immutable logs, GDPR data subject requests, SOC 2 evidence collection, and per-tenant log isolation."
authors: [stoa-team]
tags: [tutorial, compliance, architecture]
keywords:
  - API audit logging SaaS
  - multi-tenant compliance API gateway
  - GDPR API audit trail
  - SOC 2 API logging
  - per-tenant audit logs
  - API compliance SaaS
  - STOA audit logging
---
<!-- last verified: 2026-02 -->

Every SaaS product eventually faces a compliance question. An enterprise customer asks for a SOC 2 Type II report. A European customer requests a GDPR audit log. A financial services customer needs proof that no one accessed their data without authorization. How you answer these questions — and whether you can answer them at all — depends entirely on decisions you made when building your logging infrastructure.

This is Part 3 of the **SaaS Playbook** series. Part 1 covered [multi-tenancy fundamentals](/blog/saas-playbook-1-multi-tenancy-101). Part 2 covered [rate limiting strategies](/blog/saas-playbook-2-rate-limiting-saas). Here we tackle audit logging and compliance.

<!-- truncate -->

## Why Audit Logging Is a First-Class Concern

Logging is not a feature you add later. The decisions you make in the first six months of your product's life determine whether you can answer compliance questions two years later. The most common failure mode: a startup grows to enterprise scale, wins a large customer, gets asked for SOC 2 evidence, and discovers their audit trail has gaps because they never implemented per-tenant log isolation.

The three compliance scenarios you will most commonly face as a B2B SaaS company:

**GDPR Article 30 (Records of processing activities)**: You must maintain records of all processing activities that include the purposes of processing, categories of data subjects, and any transfers to third parties. For API management, this means knowing exactly which APIs accessed which data, on whose behalf, and when.

**SOC 2 Type II (Common Criteria 6 — Logical and physical access controls)**: Auditors want to see that you can demonstrate who accessed what, when, and whether that access was authorized. This requires tamper-evident audit logs that cannot be modified after the fact.

**HIPAA (for US healthcare)**: The Security Rule requires audit controls that record and examine activity in information systems that contain or use protected health information. This is a hard requirement, not a best practice.

The good news: building a proper audit logging system for a multi-tenant API gateway is not as complex as compliance certifications make it sound. The fundamentals are straightforward.

## The Four Properties of a Compliant Audit Log

Before implementing anything, define what a compliant audit log entry must contain and guarantee.

### Property 1: Completeness

Every API call must produce an audit log entry. No sampling. No filtering of "unimportant" requests. Compliance auditors will ask: "How do you know this log is complete?" Your answer must be: "Every request through the gateway produces an entry. There is no code path that skips logging."

### Property 2: Tamper Evidence

Once written, audit entries must be immutable. An attacker who compromises your application should not be able to delete evidence of their access. At minimum, this means append-only log storage. For higher assurance, this means cryptographic chaining (each entry includes a hash of the previous entry, like a blockchain).

### Property 3: Tenant Isolation

Tenant A's audit logs must never be accessible to Tenant B, or to any operator who does not have explicit authorization for Tenant A. This is not just a security requirement — it is a compliance requirement for GDPR (processing records must be kept separate) and contractual requirement for most enterprise MSAs.

### Property 4: Structured and Queryable

Audit logs that cannot be queried efficiently are compliance theater. You need to answer questions like "show me all requests by user X to endpoint Y in the past 90 days" within seconds, not hours.

## STOA Audit Log Architecture

STOA implements per-tenant audit logging as a core feature, not a plugin. Every request through the gateway produces a structured audit log entry in the tenant's isolated log stream.

### Audit Log Entry Structure

```json
{
  "timestamp": "2026-03-17T14:23:41.123Z",
  "event_id": "01HXK4J8P2QRST3UV5WXY6Z7A",
  "tenant_id": "acme",
  "request_id": "req_7f3a2b1c",
  "session_id": "sess_abc123",
  "actor": {
    "type": "user",
    "id": "user-123",
    "email": "alice@acme.example.com",
    "ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0 ..."
  },
  "action": {
    "method": "POST",
    "path": "/billing-api/v1/invoices",
    "query": {},
    "response_status": 201,
    "latency_ms": 43
  },
  "authorization": {
    "token_type": "jwt",
    "scopes": ["billing-api:write"],
    "decision": "allowed",
    "policy_matched": "professional-tier-billing"
  },
  "data": {
    "request_size_bytes": 1024,
    "response_size_bytes": 512,
    "pii_detected": false,
    "guardrails_triggered": []
  },
  "chain_hash": "sha256:a3f2b1c4d5e6f7..."
}
```

Key fields for compliance:
- `event_id`: ULID format — lexicographically sortable, globally unique
- `actor.email`: The human identity behind the request (from JWT claims)
- `authorization.decision`: Was the request allowed or denied? Denials are equally important to log
- `chain_hash`: Hash of the previous entry + this entry's content — enables tamper detection
- `pii_detected`: Whether GuardrailPolicy detected PII in the request payload

### Enabling Audit Logging in STOA

Audit logging is enabled per-tenant in the UAC:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: acme-contract
  namespace: tenant-acme
spec:
  audit:
    enabled: true
    level: full              # full | summary | errors-only
    retention:
      days: 365              # GDPR: typically 90-365 days
      immutable: true        # Append-only storage
    destination:
      type: postgresql       # postgresql | s3 | elasticsearch | loki
      encryption: aes256     # Encrypt at rest
    pii:
      detection: enabled
      action: redact         # redact | flag | block
```

`level: full` logs every request including successful ones. For GDPR compliance, you typically need `full`. For SOC 2, `full` or `summary` is acceptable. `errors-only` is only appropriate for debugging, never for compliance.

### Per-Tenant Log Isolation

Audit entries are written to tenant-scoped storage. In the default PostgreSQL backend:

```sql
-- Each tenant has a dedicated schema
-- acme tenant entries go to: schema audit_acme
-- globex tenant entries go to: schema audit_globex
-- No cross-schema reads without explicit grant

SELECT * FROM audit_acme.events
WHERE actor_email = 'alice@acme.example.com'
AND timestamp >= NOW() - INTERVAL '90 days'
ORDER BY timestamp DESC;
```

The gateway service account for Tenant A has INSERT on `audit_acme.events` — it cannot read from or write to `audit_globex.events`. This is enforced at the database level, not just the application level.

## GDPR Compliance: Data Subject Requests

GDPR grants data subjects the right to access all data processed about them (Article 15), the right to erasure (Article 17), and the right to portability (Article 20). For your API audit logs, this has specific implications.

### Right of Access (Article 15)

When a user submits a data subject access request (DSAR), they are entitled to receive all records of processing that relate to them. For audit logs, this means you must be able to query "all API events where actor.email = 'user@example.com'" and export the results in a readable format.

```bash
# STOA CLI: export DSAR for a user
stoactl tenants dsar export \
  --tenant acme \
  --email alice@acme.example.com \
  --from 2024-01-01 \
  --to 2026-01-01 \
  --format json
```

The export includes all audit events where the user was the actor, including denied requests (which are often the most relevant from a DSAR perspective — they reveal what the user tried to do and was blocked from doing).

### Right to Erasure (Article 17)

Erasure for audit logs is more nuanced than for application data. Audit logs serve a legitimate interest (security, compliance, legal defense) that often overrides the erasure right. However, you should:

1. **Pseudonymize** rather than delete where possible: replace `actor.email` with a hash of the email for events older than your retention period
2. **Have a documented policy**: clearly state your audit log retention period and legal basis in your privacy policy
3. **Separate PII from events**: store actor identity in a separate user table, linked by user ID. If a user is deleted, their identity can be removed while the events (with pseudonymized actor IDs) remain for compliance purposes

### PII Detection and Redaction

If your API accepts or returns PII in request/response bodies (names, emails, account numbers, etc.), you need to control how that data appears in audit logs.

STOA's `GuardrailPolicy` supports PII detection using pattern matching:

```yaml
spec:
  contentFilter:
    piiDetection: enabled
    patterns:
      - type: email
        action: redact       # Replace with [REDACTED:EMAIL]
      - type: credit-card
        action: block        # Reject the request entirely
      - type: ssn
        action: redact
    auditPiiEvents: true     # Log that PII was detected, but not the PII itself
```

The audit log records that PII was detected (`pii_detected: true`) and what pattern was triggered, without including the actual PII value. This lets you satisfy compliance requirements ("we detected and blocked/redacted PII in N requests this month") without creating a honeypot of sensitive data in your audit logs.

## SOC 2 Type II: Building Your Evidence Trail

SOC 2 Type II audits cover a 6-12 month observation period. The auditor will ask for evidence that your controls were operating effectively throughout the period. For API access controls, your evidence is your audit log.

### What Auditors Look For

| CC | Control | Evidence | Source |
|---|---|---|---|
| CC6.1 | Logical access is restricted to authorized individuals | API key / JWT token validation events | STOA audit log |
| CC6.2 | New access is provisioned based on authorization | Tenant creation + API registration events | STOA admin audit |
| CC6.3 | Access is modified when roles change | Token revocation events | STOA + Keycloak |
| CC6.7 | Restricted data transmitted over encrypted channels | TLS enforcement, cert events | STOA access log |
| CC7.2 | Anomalous activity is detected | Rate limit violation events | STOA metrics |

### Generating SOC 2 Evidence Reports

```bash
# Export SOC 2 evidence for a time period
stoactl compliance soc2-report \
  --tenant acme \
  --from 2025-04-01 \
  --to 2026-03-31 \
  --output soc2-evidence-2025-2026.pdf
```

The report includes:
- Total API calls per month (shows volume of activity audited)
- Authorization success/failure rates
- Number of denied access attempts (demonstrates access controls are active)
- API key provisioning and revocation events
- Rate limit violations (demonstrates abuse detection)

### Ensuring Log Integrity

For SOC 2, you need to demonstrate that audit logs cannot be modified after the fact. STOA uses two mechanisms:

**Cryptographic chaining**: Each audit entry includes a `chain_hash` that is the SHA-256 of the previous entry's hash + the current entry's content. Any modification of a past entry breaks the chain — detectable by re-running the hash validation.

**Append-only storage**: The database role used by the audit writer has INSERT access but not UPDATE or DELETE. Even if an attacker compromises the application process, they cannot modify past entries.

```bash
# Verify audit log integrity (run periodically or before audits)
stoactl tenants audit verify \
  --tenant acme \
  --from 2025-01-01 \
  --to 2026-01-01
# Output: "Audit chain verified: 3,241,891 entries, 0 integrity violations"
```

## Log Retention and Storage

### Retention Policy

| Regulation | Minimum Retention | Recommended |
|---|---|---|
| GDPR | No specific minimum; must be "no longer than necessary" | 90 days for API logs, 1 year for security events |
| SOC 2 | 1 year for evidence period + buffer | 2 years |
| HIPAA | 6 years | 7 years |
| PCI-DSS | 1 year (3 months immediately available) | 2 years |
| No specific requirement | 90 days | 1 year |

STOA supports tiered retention: hot storage (PostgreSQL, last 90 days, fast query), warm storage (S3/object storage, 90 days to 2 years, slow query), cold storage (Glacier/archive, beyond 2 years, retrieval on request).

```yaml
spec:
  audit:
    retention:
      hot:
        days: 90
        storage: postgresql
      warm:
        days: 730           # 2 years
        storage: s3
        bucket: stoa-audit-${tenant_id}
      cold:
        days: 2190          # 6 years (HIPAA)
        storage: glacier
```

### Encryption at Rest

Audit logs must be encrypted at rest. STOA uses AES-256 for PostgreSQL (via transparent data encryption or pgcrypto column encryption) and server-side encryption for S3 storage.

For tenants with data residency requirements, STOA supports per-tenant encryption keys — a compromise of one tenant's key does not expose another tenant's audit data.

## Practical: Querying Your Audit Trail

The most common audit queries you will run:

```bash
# Who accessed the billing API in the last 7 days?
stoactl tenants audit query \
  --tenant acme \
  --api billing-api \
  --from -7d

# All denied access attempts (security review)
stoactl tenants audit query \
  --tenant acme \
  --decision denied \
  --from -30d \
  --format csv

# All events for a specific user (DSAR or incident investigation)
stoactl tenants audit query \
  --tenant acme \
  --actor alice@acme.example.com \
  --from -365d \
  --format json | jq '.events | length'

# PII events summary
stoactl tenants audit query \
  --tenant acme \
  --filter pii_detected=true \
  --from -30d \
  --group-by day
```

## What Comes Next

With multi-tenancy (Part 1), rate limiting (Part 2), and audit logging (Part 3) in place, your SaaS API has the three pillars of enterprise readiness. The next challenge: keeping all of this working as you scale from 50 tenants to 5000.

**Complete SaaS Playbook:**
1. [Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isolating your tenants
2. [Part 2: Rate Limiting Strategies](/blog/saas-playbook-2-rate-limiting-saas) — Per-tenant quotas and burst handling
3. **Part 3: Audit & Compliance** — This article
4. [Part 4: Scaling Multi-Tenant APIs](/blog/saas-playbook-4-scaling-multi-tenant) — From 50 to 5000 tenants
5. [Part 5: Production Checklist](/blog/saas-playbook-5-production-checklist) — 20-point go-live gate
6. [Build vs Buy: API Gateway Cost Analysis](/blog/saas-playbook-build-vs-buy-api-gateway) — TCO analysis for your decision

## FAQ

### Do I need to log denied requests, not just successful ones?

Yes, absolutely. Denied requests are often the most forensically valuable entries in your audit log. They reveal who tried to access what they should not have, which is critical for both security incident investigations and compliance demonstrations. STOA logs all authorization decisions — allowed and denied — at `level: summary` and above.

### How long should I retain API audit logs?

For most B2B SaaS companies without specific regulatory requirements, 1 year of hot storage is a good starting point. If you serve regulated industries (healthcare, finance), check the relevant regulatory minimum and add a buffer. STOA's tiered retention (hot/warm/cold) lets you keep data for years while controlling storage costs.

### What is the difference between an access log and an audit log?

An **access log** records that a request happened: IP, method, path, status code, latency. It is primarily used for debugging and performance analysis. An **audit log** records who did what and whether it was authorized: actor identity, authorization decision, what data was accessed. Access logs serve operations; audit logs serve compliance and security.

### Can I disable audit logging for non-sensitive APIs to reduce storage costs?

STOA allows configuring `level: errors-only` or `level: summary` for specific APIs via per-API audit overrides in the UAC. However, for compliance purposes you generally should not disable audit logging entirely for any API that touches tenant data. Consult your compliance framework before disabling.

### How do I demonstrate that my audit log is tamper-proof to an auditor?

Show them the cryptographic chain verification command and its output: "Audit chain verified: N entries, 0 integrity violations." Also demonstrate that the database role used for audit writing lacks UPDATE and DELETE privileges. For high-assurance environments, consider streaming audit events to an immutable external sink (AWS CloudTrail, Azure Monitor) as a secondary record.
