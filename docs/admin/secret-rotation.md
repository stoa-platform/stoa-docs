---
sidebar_position: 6
title: Secret and Key Rotation
description: Operate secret and credential rotation on a STOA site — pre-checks, dual-credential windows, verification controls, and rollback — without publishing live secrets.
keywords: [rotation, secrets, API keys, TLS, OpenBao, HashiCorp Vault, rollback, operations, on-premises]
---

# Secret and Key Rotation

This page is a **verifiable operations procedure** for rotating credentials that STOA depends on at a site. It expands the checklist in [Security Hardening](./security-hardening) into controls you can run before, during, and after a rotation, plus a deliberate rollback path. Day-2 install and upgrade remain in [Installation](./installation) and [Upgrade](./upgrade). Offline install is covered separately ([Offline Installation](../deployment/offline-install)).

:::info Scope of this guide
- **In scope:** classifying what to rotate, recording a change window, applying dual-credential / grace where the product supports it, verifying with site-local checks, and rolling back when a control fails.
- **Out of scope:** inventing a new secret manager product; consumer-facing API key UX details (see [API Key Rotation](../guides/api-key-rotation)); application data-at-rest encryption key re-wrap without downtime (**[confirm when CAB-2268 ships]** — do not claim zero-downtime app-key rotation until that feature is released and documented).
- **Secrets in this document:** placeholders only (`registry.example.com`, `stoa-system`, `${TOKEN}`). Never paste production values into tickets, PRs, or chat.
:::

The hosted public platform was shut down on 2026-05-23; operators run these steps on their own infrastructure ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first)).

## 1. What you rotate

| Family | Typical owners | Dual / grace | Primary method | Deep guide |
|--------|----------------|--------------|----------------|------------|
| Consumer / subscription API keys | Tenant admin | Yes (grace period hours) | Control Plane API / Portal | [API Key Rotation](../guides/api-key-rotation) |
| Consumer mTLS certificates | Tenant admin | Yes (`grace_period_hours`) | `POST .../certs/rotate` | [Consumer Onboarding](../guides/consumer-onboarding) |
| Webhook delivery secrets | Tenant / integrator | No automatic dual window — coordinate cutover | PATCH webhook config | [Webhooks](../guides/webhooks) |
| Database password | Platform operator | No — plan short reconnect | Secret store → K8s Secret → restart | [Security Hardening](./security-hardening) |
| Keycloak client secrets | Platform operator | No — update IdP then clients | Keycloak Admin + config | [Keycloak](./keycloak) |
| Gateway admin / service tokens | Platform operator | Prefer dual token then drop old | K8s Secret + restart | This page §4 |
| Registry pull credentials | Platform operator | Prefer dual then drop old | ImagePullSecrets | This page §4 |
| TLS certificates (edge / ingress) | Platform operator | cert-manager renewal | cert-manager / site PKI | [Security Hardening](./security-hardening) |
| Application encryption key (data at rest) | Platform operator | **[confirm]** | **[confirm procedure after CAB-2268]** | Track CAB-2268 |

Recommended cadence (align with your policy; defaults from hardening): database, Keycloak clients, and gateway tokens about every 90 days; TLS via automated renewal; API keys on demand or every 90 days for production consumers.

## 2. Pre-rotation controls (do these first)

Record the answers in the change ticket before you touch production.

1. **Inventory** — Name the secret family, where the current value lives (secrets backend / K8s Secret / IdP), and every consumer of that value (Deployments, CronJobs, external callers).
2. **Blast radius** — List namespaces and services that will restart or reconnect. Prefer one family per change window.
3. **Dual-credential plan** — If the product supports a grace period (API keys, consumer certs), set `grace_period_hours` explicitly. If it does not, define an ordered cutover (new secret live → update all consumers → revoke old) and a maximum time-to-revoke.
4. **Backup / restore point** — Confirm a recent successful backup ([Backup and Recovery](./backup-recovery)) and note the Helm revision (`helm history stoa-platform -n stoa-system`) in case config rollback is needed.
5. **Communication** — Notify tenants that own the credential when the rotation is consumer-visible (API keys, mTLS). Platform-only secrets stay on the ops channel.
6. **Offline / air-gapped sites** — Ensure the new secret material is already on the site media path; do not open outbound Internet to fetch credentials ([Offline Installation](../deployment/offline-install)).

Stop if any control is unanswered. Do not rotate “to see what happens”.

## 3. Rotation patterns

### 3.1 Consumer API keys (product grace)

Follow [API Key Rotation](../guides/api-key-rotation) end-to-end:

1. `POST /v1/subscriptions/${SUB_ID}/rotate-key` with an explicit `grace_period_hours`.
2. Store the `new_api_key` once (shown only once).
3. Deploy the new key to callers while both keys work.
4. Confirm traffic moved (subscription `rotation_count` / `last_rotated_at`, gateway metrics).
5. After grace expiry, old key must fail; clear gateway cache only if immediate invalidation is required (see that guide).

**Control after step 4:** a probe with the new key returns HTTP 2xx on a known route; a probe with the old key still succeeds only inside the grace window.

### 3.2 Consumer mTLS certificates

```bash
curl -X POST "${STOA_API_URL}/v1/consumers/${TENANT_ID}/${CONSUMER_ID}/certs/rotate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "new_certificate_pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "grace_period_hours": 48
  }'
```

During grace, both certificates are accepted. Distribute the matching private key through the tenant's own secret path — never through this documentation site.

**Control:** handshake with the new cert succeeds; handshake with the old cert succeeds only until grace ends.

### 3.3 Platform secrets via the secrets backend → Kubernetes

Pattern from [Security Hardening](./security-hardening):

```text
Secrets backend (OpenBao or HashiCorp Vault) → Kubernetes Secret → Pod env / volume → restart
```

The secrets backend is reached through the Vault HTTP API: OpenBao by default, or a HashiCorp Vault you already run ([ADR-075](../architecture/adr/adr-075-secrets-backend-openbao)).

Operator sequence:

1. Write the **new** value in the secrets backend (or your site secret store). Keep the old value readable until post-controls pass.
2. Sync or apply the Kubernetes Secret in `stoa-system` (name is site-local — do not publish real names).
3. Restart only the Deployments that consume that Secret (`kubectl rollout restart deployment/<name> -n stoa-system`).
4. Watch rollout: `kubectl rollout status deployment/<name> -n stoa-system`.
5. Run §5 verification controls.
6. Only then revoke or delete the old value in the secrets backend.

Never commit the new secret to Git, Helm `values.yaml`, or ConfigMaps.

### 3.4 Dual token then drop (gateway admin / pull secrets)

When the runtime accepts only one active token at a time:

1. Create **token B** alongside **token A** in the secret store.
2. Update the Secret so the workload prefers B but can fall back to A if your chart supports dual keys; otherwise update all replicas in one controlled rollout.
3. Verify with §5.
4. Remove A from the store and from any external registry ACL.

If the chart has no dual-key field, treat this as a short maintenance window and keep Helm rollback ready ([Upgrade](./upgrade)).

### 3.5 Application encryption key

Zero-downtime re-wrap of the application encryption key is tracked as product work (internal ticket CAB-2268). Until that lands and is documented here:

- Do **not** rotate the data-at-rest key with an ad-hoc `kubectl` edit.
- Prefer restoring from backup over a half-applied re-encrypt.
- Mark any site runbook that claims zero-downtime app-key rotation as **stale** until CAB-2268 is Done and this section is updated.

## 4. Change window checklist (operator)

Copy into the ticket; tick in order.

- [ ] Pre-controls (§2) recorded
- [ ] Family and dual/grace plan chosen (§1 / §3)
- [ ] Backup age and Helm revision noted
- [ ] New material generated and stored (never in the ticket body)
- [ ] Rotation command or Secret apply executed
- [ ] Rollout / grace window started
- [ ] Verification controls (§5) green
- [ ] Old credential revoked or expired
- [ ] Ticket closed with time stamps (start, verify, revoke)

## 5. Verification controls

Run these on the site network (no Internet required).

| Control | How | Pass |
|---------|-----|------|
| Workload ready | `kubectl get pods -n stoa-system` | Desired replicas Ready |
| Control Plane health | Site health endpoint or `kubectl` probe used in your install guide | HTTP 2xx / Ready |
| Auth with new credential | Call a known API with the new API key, cert, or token | Success |
| Auth with old credential | Same call with the old credential | Fails after grace / revoke; still OK only inside documented grace |
| No secret leakage | `kubectl get secret <name> -n stoa-system -o yaml` reviewed only on a secure console; ticket contains **no** secret values | Ticket clean |
| Logs | Platform logs show expected reconnect / rotation events, not crash loops | Stable |

Fail any control → go to §6 before revoking the old credential.

## 6. Rollback

Rollback means **restore service with the previous credential**, not “force the new one”.

1. **Stop revoking** — If the old credential is still valid (grace or dual), leave it valid.
2. **Restore Secret** — Re-apply the previous Kubernetes Secret from the secret store history (secrets backend version history / sealed backup). Do not invent a third value mid-incident.
3. **Restart** — `kubectl rollout restart` on the affected Deployments; wait for Ready.
4. **Helm** — If the rotation shipped as a values change, `helm rollback stoa-platform <REVISION> -n stoa-system` ([Upgrade](./upgrade)).
5. **API key / cert grace** — If callers were updated to a bad new key, point them back to the old key while grace remains; open a new rotation later with a fresh new key.
6. **Data-at-rest** — If an unsupported app-key change was attempted, restore from backup ([Backup and Recovery](./backup-recovery)) rather than improvising decrypt tooling.
7. **Record** — Note which control failed, keep the new material quarantined, schedule a follow-up window.

## 7. Related

- [Configuration sources](../reference/config-sources) — which Secret, ExternalSecret, or values key actually reaches the process
- [API Key Rotation](../guides/api-key-rotation) — consumer keys and gateway cache
- [Consumer Onboarding](../guides/consumer-onboarding) — certificate rotate
- [Security Hardening](./security-hardening) — secrets architecture and cadence table
- [Upgrade](./upgrade) — Helm rollback
- [Backup and Recovery](./backup-recovery) — restore point before irreversible revoke
- [Offline Installation](../deployment/offline-install) — no outbound pulls when rotating on an air-gapped site
