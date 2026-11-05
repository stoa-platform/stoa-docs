---
sidebar_position: 7
title: Incident Response
description: Operate STOA incident response on site — severity triage, containment, investigation, exit verification controls, and hand-back — without publishing live secrets or customer data.
keywords: [incident, severity, on-call, containment, verification, operations, monitoring, rollback]
---

# Incident Response

This page is a **verifiable operations procedure** for handling a production incident on a STOA site. It covers triage, containment, investigation pointers, **exit verification controls**, and hand-back. Detection and alert wiring live in [Monitoring & Alerting](./monitoring). Restore mechanics live in [Backup and Recovery](./backup-recovery). Credential incidents also use [Secret and Key Rotation](./secret-rotation).

:::info Scope of this guide
- **In scope:** severity classes, who owns the call, containment order, what to check, when you may declare the incident closed, and what to write down afterwards.
- **Out of scope:** the operator's PagerDuty / Slack product choice; forensic malware deep-dives; legal breach notification templates (use your counsel and compliance process). Security disclosure of a product vulnerability is a separate path from site ops — escalate to your security contact.
- **Data in tickets and chat:** placeholders only (`stoa-system`, `gateway.example.com`). Never paste production secrets, tokens, personal data, or raw customer payloads into tickets, PRs, or public channels.
:::

The hosted public platform was shut down on 2026-05-23; operators run these steps on their own infrastructure ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first)).

## 1. Severity triage

Assign a severity within the first minutes. When unsure, pick the **higher** severity and downgrade later.

| Severity | User impact | Typical signals | Response target (site policy — adjust) |
|----------|-------------|-----------------|----------------------------------------|
| **SEV-1** | Platform or data plane down for many tenants; data loss risk; security compromise in progress | `StoaGatewayDown`, Control Plane down, DB down, error budget exhausted, confirmed credential leak | Immediate all-hands ops channel; continuous bridge |
| **SEV-2** | Major degradation (high error rate / latency) or single critical dependency failing | Gateway high error rate, OIDC failure, PVC critical, Keycloak down | On-call lead + specialist within minutes |
| **SEV-3** | Partial impact, workaround exists | Warning alerts, single pod crash-loop with remaining capacity | Business hours or next on-call rotation |
| **SEV-4** | Cosmetic / low risk / tooling only | Non-paging warnings | Ticket, no bridge |

Map Alertmanager severities (`critical` / `warning`) from [Monitoring & Alerting](./monitoring) into these classes; do not invent a parallel alert taxonomy on the fly.

## 2. Roles and communication

| Role | Responsibility |
|------|----------------|
| **Incident lead** | Single decision owner: severity, containment order, when to declare exit |
| **Operator** | Runs kubectl / Helm / restore commands on the site |
| **Comms** | Status to internal stakeholders (and tenants if customer-visible) — facts only, no speculation |
| **Scribe** | Timeline in the ticket (UTC or Europe/Paris — pick one and stick to it) |

Open **one** incident ticket (or Linear issue) per event. Post severity, lead name, and next check-in time in the first comment. Prefer a dedicated ops channel; keep public / marketing channels quiet until Comms has an approved sentence.

For air-gapped sites, assume no outbound SaaS paging — use the site's local on-call roster and the same checklist offline ([Offline Installation](../deployment/offline-install) for network constraints).

## 3. First 15 minutes (containment)

Do these before deep root-cause analysis.

1. **Confirm the blast radius** — Which namespaces, tenants, and routes fail? Prefer `kubectl get pods -n stoa-system` and gateway / Control Plane health over guessing.
2. **Stop the bleeding** — Prefer the smallest change that restores service:
   - Bad release → Helm rollback ([Upgrade](./upgrade))
   - Bad secret → restore previous Secret, do not revoke the old credential yet ([Secret and Key Rotation](./secret-rotation) §6)
   - Saturated dependency → shed non-critical load / scale replicas if capacity exists
   - Suspected compromise → isolate the workload (NetworkPolicy / remove public exposure) **and** call your security contact; do not wipe disks before a forensics decision
3. **Preserve evidence** — Note alert firing times, `helm history`, recent deploys, and export relevant logs to a secure store. Do not “clean up” pods that hold evidence on SEV-1 security incidents.
4. **Decide: mitigate vs restore** — If data integrity is in doubt, freeze writes and move to [Backup and Recovery](./backup-recovery) rather than improvising SQL.

Do **not** push speculative config to Git or public registries during the bridge.

## 4. Investigation pointers

Use site-local tooling. Link detail pages instead of duplicating them.

| Symptom | Start here |
|---------|------------|
| Gateway errors / latency / down | [Monitoring & Alerting](./monitoring) gateway alerts + Gateway RED / Platform Overview dashboards |
| Auth / login failures | Keycloak alerts; [Keycloak](./keycloak) admin checks |
| Control Plane API errors | Control Plane dashboard; recent Helm revision |
| Disk / PVC | Disk alerts; free space before any restore |
| Suspected bad credential rotation | [Secret and Key Rotation](./secret-rotation) rollback |
| Need full rebuild | [Backup and Recovery](./backup-recovery) DR table and verification checklist |
| Observability gaps | [Observability](../guides/observability) |

Record hypotheses and **falsifying checks** in the ticket. Avoid parallel changes from two operators without the lead's OK.

## 5. Exit verification controls

You may declare the incident **mitigated** only when every applicable control below is green. Closing without them is a defect.

| Control | How | Pass |
|---------|-----|------|
| Alert quiet | Firing critical alerts for this incident cleared or explicitly accepted as residual | No unexplained critical paging |
| Workloads Ready | `kubectl get pods -n stoa-system` (and other affected namespaces) | Desired replicas Ready, no CrashLoopBackOff on critical Deployments |
| Synthetic / smoke | Hit a known healthy route through the gateway with a **non-production** probe credential | HTTP 2xx within site SLO |
| Error rate | Grafana / Prometheus error rate for gateway and Control Plane | Back under warning threshold for the agreed soak window (suggest ≥ 15 min for SEV-1/2) |
| Auth path | Login or token flow used by tenants | Success |
| Data integrity (if DB touched) | Backup-recovery verification checklist after restore | Checklist complete |
| Secrets | No emergency plaintext secrets left in tickets, shell history shared panes, or ConfigMaps | Ticket clean; follow-up rotation scheduled if a secret was exposed |
| Comms | Stakeholders told current status (mitigated / monitoring) | Message sent |

Soak window: keep the bridge open through the soak for SEV-1 and SEV-2. SEV-3 may soak asynchronously with a clear owner.

## 6. Hand-back and post-incident

1. **Downgrade severity** in the ticket when impact is gone; keep the same ticket ID.
2. **Hand back** to the normal on-call with: what broke, what fixed it, residual risk, follow-up tickets.
3. **Post-incident review** (within your policy window, suggest ≤ 5 business days for SEV-1/2):
   - Timeline (detect → mitigate → verify)
   - Triggering change or external cause
   - What detection missed
   - Action items with owners (docs, alerts, runbooks, product)
4. **Update this procedure** if a control was missing — open a docs PR rather than leaving knowledge only in chat.

## 7. Quick reference card

```text
1. Severity (1–4) + Incident lead
2. Contain (rollback / secret restore / isolate) — smallest change
3. Preserve evidence (SEV-1 security especially)
4. Investigate with monitoring + linked runbooks
5. Exit controls green (§5) + soak
6. Hand-back + post-incident actions
```

## 8. Related

- [Monitoring & Alerting](./monitoring) — alerts, SLO, dashboards
- [Backup and Recovery](./backup-recovery) — restore and DR verification
- [Secret and Key Rotation](./secret-rotation) — credential incidents and rollback
- [Upgrade](./upgrade) — Helm rollback
- [Observability](../guides/observability) — broader telemetry
- [Offline Installation](../deployment/offline-install) — air-gapped constraints during response
