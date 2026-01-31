# ADR-029: mTLS Certificate Lifecycle Management

## Status

Accepted

## Date

2026-02-01

## Context

Enterprise clients operating 100+ API consumers with mTLS certificates face operational challenges:
- Manual certificate rotation takes 5-10 days per certificate
- Zero downtime is required during rotation (SLA commitments)
- Compliance (PCI-DSS, SOC2) requires a complete audit trail of all certificate operations
- Grace periods must allow both old and new certificates to coexist during migration

### Related Decisions

- **ADR-028**: RFC 8705 Certificate Binding Validation — how fingerprints are compared
- **ADR-027**: X509 Header-Based Authentication — header contract
- **CAB-865**: Client certificate provisioning API
- **CAB-866**: Keycloak certificate sync
- **CAB-869**: Certificate rotation with grace period

## Decision

### 1. Automated provisioning via API

Clients are provisioned via `POST /v1/clients` which generates a certificate and returns the private key **once** (never stored server-side).

Two certificate providers:

| Provider | Use Case | Implementation |
|----------|----------|----------------|
| `MockCertificateProvider` | Development, demos | Self-signed certs via `cryptography` library |
| `VaultPKIProvider` | Production | HashiCorp Vault PKI secrets engine (P1) |

The provider is selected via configuration. Both implement the same interface: `generate_certificate(cn, tenant_id) → (cert_pem, key_pem, fingerprint, serial)`.

### 2. Grace period rotation

When a certificate is rotated (`POST /v1/clients/{id}/rotate`):

1. New certificate is generated
2. Old fingerprint moves to `certificate_fingerprint_previous`
3. `previous_cert_expires_at` is set to `now + grace_period`
4. Keycloak user attribute updated with **both** fingerprints
5. Private key returned **once** in the response
6. Both old and new certificates are valid during the grace period

```
┌──────────┐     Rotate      ┌──────────────────────────────┐     Grace Expires     ┌──────────┐
│ Cert A   │  ──────────→    │ Cert A (grace) + Cert B      │  ──────────────→      │ Cert B   │
│ (active) │                 │ (both valid)                  │                       │ (active) │
└──────────┘                 └──────────────────────────────┘                       └──────────┘
```

### 3. Time-based grace period (not request-count)

**Chosen**: Grace period expires after a configurable duration (default: 24 hours, range: 1h-168h).

**Rejected alternative**: Request-count-based grace (e.g., "old cert valid for 1000 more requests"):
- Harder to predict when migration is complete
- Requires distributed counter across gateway instances
- Edge case: low-traffic clients may never exhaust the count

Time-based grace is simpler, predictable, and sufficient for all observed use cases.

### 4. Event-driven cleanup

Certificate lifecycle events are published to Kafka (`stoa.metering.events`):

| Event | Trigger | Consumer Action |
|-------|---------|-----------------|
| `ClientCreatedEvent` | `POST /v1/clients` | Sync fingerprint to Keycloak |
| `CertificateRotatedEvent` | `POST /v1/clients/{id}/rotate` | Update Keycloak with both fingerprints |
| `GracePeriodExpiredEvent` | Scheduled check or TTL | Clear `certificate_fingerprint_previous` in DB and Keycloak |
| `ClientRevokedEvent` | `DELETE /v1/clients/{id}` | Remove from Keycloak, mark revoked in DB |

All consumers are **idempotent** — safe to replay events after failure.

### 5. Database schema

```sql
-- Migration 013: Create clients table
CREATE TABLE clients (
    id                              UUID PRIMARY KEY,
    tenant_id                       VARCHAR(255) NOT NULL,
    name                            VARCHAR(255) NOT NULL,
    certificate_cn                  VARCHAR(255) NOT NULL,
    certificate_serial              VARCHAR(255),
    certificate_fingerprint         VARCHAR(255),
    certificate_pem                 TEXT,
    certificate_not_before          TIMESTAMPTZ,
    certificate_not_after           TIMESTAMPTZ,
    status                          clientstatus DEFAULT 'active',
    created_at                      TIMESTAMPTZ DEFAULT now(),
    updated_at                      TIMESTAMPTZ DEFAULT now()
);

-- Migration 014: Add rotation fields
ALTER TABLE clients ADD COLUMN certificate_fingerprint_previous VARCHAR(255);
ALTER TABLE clients ADD COLUMN previous_cert_expires_at         TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN last_rotated_at                  TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN rotation_count                   INTEGER DEFAULT 0;
```

Grace period is determined by comparing `previous_cert_expires_at` against current time:

```python
@property
def is_in_grace_period(self) -> bool:
    if not self.previous_cert_expires_at:
        return False
    return datetime.now(timezone.utc) < self.previous_cert_expires_at
```

### 6. Revocation

Revocation is a soft delete: `status` is set to `revoked`, the client remains in the database for audit purposes. The Keycloak user attribute is cleared, and the certificate is no longer valid for authentication.

## Consequences

### Positive

- **Zero downtime rotation** — both certificates valid during grace period
- **Audit trail** — all operations recorded via Kafka events + DB timestamps
- **Configurable grace period** — per-rotation, adapts to client migration speed
- **Idempotent events** — safe to replay, resilient to consumer failures
- **Separation of concerns** — API handles provisioning, Kafka handles sync

### Negative

- **Two fingerprints active** — slightly larger attack surface during grace period (mitigated by time-bounded expiry)
- **Delayed cleanup** — grace period expiry is async via Kafka (not immediate)
- **Private key exposure** — returned once in API response; must be transmitted over mTLS/HTTPS
- **MockCertificateProvider** — not suitable for production (self-signed certs)

### Risks

- **Kafka unavailability** — if Kafka is down, Keycloak sync is delayed. Mitigated by `fail_closed` mode: new clients cannot authenticate until sync completes.
- **Clock skew** — grace period expiry depends on server time. Mitigated by using UTC everywhere and NTP sync on all nodes.
- **Orphaned grace periods** — if the cleanup consumer is down, old fingerprints linger. Mitigated by periodic reconciliation job.
