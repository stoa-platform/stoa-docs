---
title: "ADR-064: Controller framework — keep ad-hoc Python workers, defer kopf and Go"
sidebar_position: 64
---

# ADR-064: Controller framework — keep ad-hoc Python workers, defer kopf and Go

- **Status**: Accepted
- **Date**: 2026-04-16
- **Deciders**: Christophe, Claude Code
- **Relates to**: ADR-057 (product lineup — stoactl, stoa-link, stoa-connect), ADR-059 (simplified deployment SSE), ADR-063 (SDD L1 + stoa-impact MCP)
- **Parent ticket**: [CAB-2053](https://linear.app/hlfh-workspace/issue/CAB-2053) Phase 7 (feature freeze + CLI-first stabilization)

## Context

CAB-2053 Phase 7 leaves one question open: what framework should host future reconciliation loops in the Control Plane API? The MEGA spec lists three options without preselecting one — `kopf`, ad-hoc Python workers, or Go via `stoa-connect` (ADR-057).

The question exists because nine async Python workers already run in `control-plane-api/src/workers/`:

| Worker | Purpose | Trigger |
| -- | -- | -- |
| `gateway_health_worker` | health probe loop over registered gateways | polling (30s) |
| `gateway_reconciler` | reconcile `gateway_instances` table from ArgoCD Applications | polling (60s) |
| `sync_engine` | push tenant/API/consumer state to gateways | event + polling |
| `git_sync_worker` | sync ArgoCD Application manifests from Git | polling |
| `billing_metering_consumer` | drain `stoa.metering` Kafka topic | Kafka consumer |
| `chat_metering_consumer` | drain chat usage events | Kafka consumer |
| `error_snapshot_consumer` | persist `stoa.errors` → OpenSearch snapshots | Kafka consumer |
| `security_alert_consumer` | fan-out `stoa.security.*` events | Kafka consumer |
| `telemetry_worker` | periodic metrics export | polling |

All nine are database-driven or Kafka-driven. **None are CRD-driven.** STOA's reconciliation is built on SQLAlchemy rows and Kafka topics, not Kubernetes custom resources. The `charts/stoa-platform/crds/` directory exists for future use but no controller currently watches a CRD.

## Decision

### 1. Keep ad-hoc async Python workers as the default reconciler pattern

No migration of the existing nine workers. They ship with the CP API process, run in the same event loop, and share the SQLAlchemy session factory. This is the least-surprise choice for a team that is Python-first on the Control Plane and already runs the pattern in prod.

### 2. Extract shared middleware into `src/workers/_base.py` (separate ticket)

Each worker today reimplements the same plumbing: periodic tick loop, graceful shutdown on `asyncio.CancelledError`, structured logging, error backoff, and the "single instance per pod" dance. Consolidate into a small internal library — no new runtime dependency.

Scope of `_base.py` (non-exhaustive):

- `PeriodicWorker(name, interval, run_fn)` — tick loop + cancellation-safe shutdown.
- `KafkaConsumerWorker(name, topic, handler)` — thin wrapper over `aiokafka`.
- `backoff_on_error(max_retries, base_delay)` — exponential retry decorator.
- `leader_lock(redis_or_pg)` — optional single-leader election for multi-replica deployments.

Target: 200–300 LOC total. No behaviour change from current workers until they are migrated one at a time.

### 3. Defer `kopf` until a CRD-native reconciler is actually needed

`kopf` is the right tool when the state to reconcile lives in `kubectl get`, not in Postgres. STOA's `GatewayInstance`, `Subscription`, and `Tenant` are rows, not CRDs. Adopting `kopf` today means:

- A new runtime dependency on `kubernetes_asyncio` + `kopf`.
- K8s API access required at dev time (breaks `docker-compose` and `stoa-quickstart`).
- A parallel reconciliation surface — rows and CRDs — with drift potential.

Re-evaluate `kopf` when we promote a first-class resource (e.g. `GatewayInstance`) to an actual CRD managed by the operator. That is a separate, Council-gated decision; no target date.

### 4. Defer Go-based controllers until stoa-connect justifies a Go rewrite of CP API workers

ADR-057 positions `stoa-connect` as the VPS-side Go agent bridging third-party gateways (Kong, Gravitee, webMethods) to the Control Plane. That is Go-appropriate: static binary, edge deployment, low memory footprint.

Rewriting the nine CP API workers in Go delivers no user-visible improvement and burns weeks of Python → Go porting for a team that writes Python daily. The CP API stays Python. `stoa-connect` stays Go. The two do not converge.

## Consequences

### Positive

- **Zero migration cost** for the current nine workers; they keep shipping with every CP API release.
- **`_base.py` extraction** removes ~150 LOC of duplicated plumbing and makes the tenth worker cheaper to write.
- **No new runtime deps** — no `kopf`, no `kubernetes_asyncio`, no Go build step in CP API.
- **Local dev unchanged**: `docker-compose up` and `stoa-quickstart` continue to work without a K8s API.
- **Door stays open** for kopf when the first real CRD controller lands, and for Go when a VPS-edge reconciler is needed.

### Negative

- **No CRD-native reconciliation.** If a future tenant admin writes `kubectl apply -f tenant.yaml`, nothing happens today. That shape of UX is out of scope for the current roadmap but would require kopf (or a Go operator) to unlock.
- **Leader election is opt-in, not framework-provided.** Teams writing a new worker must remember to call `leader_lock()` if they scale past one replica. The `_base.py` extraction should make this explicit through the worker constructor signature.

### Neutral

- Existing workers continue to use `_get_session_factory()` and `settings` directly. The `_base.py` extraction is **additive**, not a forced refactor.

## Options evaluated and rejected

### Option A — Adopt `kopf` now

`kopf` is a mature Python framework for Kubernetes operators (handler-based, CRD watchers, built-in leader election). Rejected because nothing in STOA today is CRD-driven: reconciliation state lives in Postgres and Kafka, not in the K8s API. Introducing `kopf` adds a parallel state surface with drift risk and breaks local (non-K8s) development.

### Option B — Rewrite workers in Go via `stoa-connect`

`stoa-connect` is a Go agent per ADR-057. Go is the right language for edge VPS reconcilers bridging third-party gateways, not for in-process workers that share a SQLAlchemy session with the CP API. A Go rewrite doubles the runtime surface of the Control Plane with no feature gain. Rejected as premature.

### Option C — Ad-hoc Python + `_base.py` extraction *(chosen)*

Small, incremental, reversible. Keeps the team shipping and leaves future framework decisions for when a CRD-native need actually appears.

## Council Validation — 8.25/10 (Go)

| Persona | Score | Verdict |
| -- | -- | -- |
| Chucky (Devil's Advocate) | 8/10 | Go |
| OSS Killer (VC Skeptique) | 8/10 | Go |
| Archi 50x50 (Architecte Veteran) | 9/10 | Go |
| Better Call Saul (Legal/IP) | 8/10 | Go |

### Per-persona rationale

- **Chucky**: "Pas de framework" is a valid choice only if the `_base.py` extraction happens. Without it, the 9 workers keep drifting. Commit to a separate ticket that ships `_base.py` in C17 or C18. Concern noted in Consequences.
- **OSS Killer**: No new runtime dependency = no new license exposure, no new attack surface. Postgres + Kafka stack is already part of the STOA story. Correct call to stay on it.
- **Archi 50x50**: The framework question is a red herring when the state surface is Postgres, not CRDs. The right question is "what does reconciliation converge against?" and the honest answer is "a row, not a resource". That answer picks the tool.
- **Saul**: kopf (Apache 2.0) and kubernetes_asyncio (Apache 2.0) would be compatible, but deferring their adoption means one less transitive dep graph to audit. No IP concerns with the status quo.

### Adjustments applied

1. `_base.py` extraction is **tracked** as a follow-up — see CAB-2053 Phase 7 close comment for the ticket link. It is not implicit.
2. Re-evaluation trigger for `kopf`: first controller that needs to watch a K8s CRD (not a DB row). ADR must be revisited, not silently skipped.
3. Re-evaluation trigger for Go: any reconciler that needs to live outside the CP API process (edge VPS, K8s operator container, standalone daemon). `stoa-connect` already occupies that slot.

## Links

- ADR-057 — Product lineup (stoactl, stoa-link, stoa-connect).
- ADR-059 — Simplified deployment via SSE.
- `control-plane-api/src/workers/` — current nine workers.
- [kopf project](https://kopf.readthedocs.io/) — for reference, not adopted.
