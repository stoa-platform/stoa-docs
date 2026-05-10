---
title: "ADR-068: Audit Log Actor and Resource Views"
sidebar_label: "ADR-068: Audit Actor/Resource Views"
sidebar_position: 68
description: "Defines audit-log resource and actor dimensions, cross-tenant visibility, and the authorization doctrine for by_resource and by_actor views."
keywords: [ADR, audit log, observability, RBAC, multi-tenant, compliance]
---

# ADR-068 - Audit Log Actor and Resource Views

## 1. Status

**Status:** Accepted

**Date:** 2026-05-10

**Deciders:** STOA Core Team

**Scope:** Product and authorization doctrine only. This ADR does not add code, does not add an Alembic migration, and does not modify the `audit_events` schema.

**References:**

- `stoa/docs/plans/2026-05-09-observability-data-visibility.md`, Phase 4.
- `stoa/docs/decisions/2026-05-09-observability-data-visibility.md`, Q8.3 challenger verdict.
- `stoa/docs/audits/2026-05-09-observability-data-visibility/findings.md`, Gap 2.
- `stoa/control-plane-api/alembic/versions/044_create_audit_events.py`, current audit schema context.

## 2. Context

The current audit log is a resource-owned audit trail.

In the current `audit_events` table, `tenant_id` means the tenant that owns the
resource affected by the event. It does not mean the tenant of the caller.

That model is correct for the existing `by_resource` view:

- show me what happened to resources owned by my tenant;
- preserve a compliance trail for the target tenant;
- keep cross-tenant operations visible to the tenant whose resource changed.

The model is incomplete for actor accountability.

Cross-tenant operators can act on resources outside the workspace or tenant they
used to initiate the request. A `cpi-admin` can act on tenant B while operating
from tenant A or from a platform context. The resulting event belongs to tenant
B in the current model, so tenant A cannot answer "what did our actors do?"
without a separate actor-oriented dimension.

The Phase 4 plan requires this ADR before any schema migration. The challenger
verdict for Q8.3 also requires this ADR to recommend a direction, not merely
list options.

## 3. Current Schema Interpretation

The current schema contains:

| Current field | Doctrine name | Meaning |
|---------------|---------------|---------|
| `audit_events.tenant_id` | `resource_tenant_id` | Tenant that owns the affected resource. |
| `audit_events.actor_id` | `actor_subject_id` | Stable subject that performed the action: user, service account, or API token subject. |
| `audit_events.actor_type` | `actor_type` | Actor class such as user, service account, API token, or platform actor. |

The current schema has an actor index, but that is not enough to define
tenant-scoped actor visibility. A subject can belong to several tenants, and a
platform actor can act without a tenant-owned home.

## 4. Decision

STOA will support two audit views as product concepts:

1. `by_resource`: the current and default view.
2. `by_actor`: an additional accountability view scoped by actor dimensions.

`by_resource` remains authoritative for resource-owner compliance. It answers:

> What happened to resources owned by this tenant?

`by_actor` answers a different question:

> What did actors associated with this tenant or platform scope do?

The two views are not interchangeable. `resource_tenant_id` must not be reused
as actor ownership, and `actor_tenant_id` must not be introduced as a one-shot
field with ambiguous semantics.

Any future implementation that follows this ADR must preserve the named
dimensions below. The implementation can decide storage shape separately, but it
must not collapse resource ownership and actor context into one tenant field.

This ADR does not implement a migration; the migration follows separately if the
verdict is `accepted`.

## 5. Required Dimensions

### `resource_tenant_id`

`resource_tenant_id` is the tenant that owns the resource affected by the audit
event.

For the current schema, this is `audit_events.tenant_id`.

Rules:

- It is required for tenant-owned resources.
- It remains the primary filter for `by_resource`.
- It is not the caller's tenant.
- It is not rewritten when the actor comes from another tenant.
- Platform-level resources may use a platform scope only when the resource is
  not tenant-owned.

### `actor_subject_id`

`actor_subject_id` is the stable subject that performed the action.

For the current schema, this is `audit_events.actor_id`.

Rules:

- It can identify a user, service account, API token, or platform actor.
- It must remain stable enough for audit correlation.
- It is not sufficient by itself for tenant-scoped `by_actor` authorization.
- If the subject is unknown, the event remains visible in `by_resource` with
  actor fields marked as unknown or redacted according to the matrix below.

### `actor_workspace_tenant_id`

This ADR chooses `actor_workspace_tenant_id` as the tenant-scoped actor
dimension when the request context has an unambiguous active workspace tenant at
the time of the action.

Rules:

- It means "the tenant workspace under which the actor authenticated or
  intentionally operated for this request."
- It may differ from `resource_tenant_id`.
- It must be captured from request-time authorization context, not inferred from
  current user memberships after the fact.
- It is nullable when no unambiguous workspace tenant exists.
- It is the preferred tenant filter for tenant-scoped `by_actor` when present.

### `actor_home_tenant_id`

`actor_home_tenant_id` may be used only when the identity model defines a stable
single home tenant for the subject at request time.

Rules:

- It must not be derived from a many-to-many membership table when the user has
  several tenants.
- It must not be guessed from `resource_tenant_id`.
- It may be useful for service accounts or API tokens whose issuer or owner
  tenant is immutable.
- If home semantics are not guaranteed, the field is absent or null and
  authorization must rely on `actor_workspace_tenant_id` or platform scope.

## 6. Multi-Tenant User Behavior

A user subject can belong to several tenants.

For a multi-tenant user, `actor_subject_id` identifies the person or principal,
but it does not decide which tenant is allowed to see the actor view.

Rules:

- `by_actor` for tenant A includes actions performed while the request's
  `actor_workspace_tenant_id` was tenant A.
- `by_actor` for tenant B includes actions performed while the request's
  `actor_workspace_tenant_id` was tenant B.
- A user who belongs to tenants A and B does not make all of that user's events
  visible to both tenants.
- If tenant A's actor changes tenant B's resource, tenant A may see an outbound
  cross-tenant action, but tenant B identifiers and resource details are
  redacted unless the viewer is `cpi-admin`.
- Tenant B may see the resource-owned event in `by_resource`, but tenant A's
  actor identity is redacted unless the viewer is `cpi-admin` or the same
  subject is also visible inside tenant B by policy.

This keeps membership from becoming an accidental audit data bridge across
tenants.

## 7. Service Accounts, API Tokens, and Platform Admins

Service accounts and API tokens are actors. They must use `actor_subject_id`
with `actor_type` set to the appropriate actor class.

Backfill and interpretation rules for any future migration:

- Preserve `resource_tenant_id` from the existing event's resource owner.
- Preserve `actor_subject_id` from the existing actor field when present.
- Backfill `actor_workspace_tenant_id` only from immutable request-time context
  if that context already exists.
- Backfill token or service-account tenant ownership only when the issuer or
  owner tenant was unambiguous at event time.
- Do not backfill a tenant dimension from current memberships when the actor is
  a multi-tenant user.
- Do not backfill a tenant dimension from `resource_tenant_id`.
- When the actor tenant is absent, keep it absent. Do not invent a synthetic
  actor tenant.

Service-account and API-token behavior:

- Tenant-owned service accounts are visible in that tenant's `by_actor` view.
- Tenant-owned API tokens are visible in that tenant's `by_actor` view.
- Platform-scoped service accounts or tokens are visible only to `cpi-admin`
  unless a resource tenant has a resource-owned `by_resource` event.
- When token ownership is unknown, tenant-scoped `by_actor` must not expose the
  event based on guesswork.

Platform-admin behavior:

- A platform admin has an `actor_subject_id`.
- If the admin acted through an explicit tenant workspace, that workspace may be
  represented as `actor_workspace_tenant_id`.
- If the admin acted from a global platform context, actor tenant dimensions are
  null or platform-scoped.
- Tenant views show platform-admin activity only as resource-owned events, with
  platform identity redacted unless the viewer is `cpi-admin`.

## 8. Visibility and Cross-Tenant Redaction

The statement "user from tenant A acted on a resource of tenant B" is sensitive.
It reveals both an actor relationship and a resource relationship.

Visibility rules:

- `cpi-admin` can see the full cross-tenant statement.
- Tenant A's tenant-admin can see that one of tenant A's actors performed an
  outbound cross-tenant action, but tenant B identity and resource details are
  redacted.
- Tenant B's tenant-admin can see that an external actor affected tenant B's
  resource, but tenant A identity and actor details are redacted.
- Viewers and devops users receive narrower role-specific access as defined in
  the authorization matrix.

Default redaction when crossing a tenant boundary:

| Field family | Actor-side tenant sees outbound event | Resource-side tenant sees inbound event |
|--------------|----------------------------------------|------------------------------------------|
| Other tenant id/name | Redacted as `external_tenant` | Redacted as `external_actor_tenant` |
| Actor subject id/email | Visible only if actor belongs to viewer's scope | Redacted unless same subject is visible in resource tenant |
| Actor type | Visible at coarse level | Visible at coarse level |
| Resource id/name | Redacted | Visible if resource belongs to viewer's tenant |
| Resource type/action/outcome/time | Visible | Visible |
| Path, diff, details payload | Redacted unless all referenced data belongs to viewer's tenant | Visible only under existing tenant data rules |

Redaction must be applied before export, API response serialization, and UI
rendering. Export endpoints must not bypass the view policy.

## 9. Authorization Matrix

| Role | `by_resource` access | `by_actor` access | Cross-tenant visibility |
|------|----------------------|-------------------|-------------------------|
| `cpi-admin` | All resource tenants. | All actor subjects and all actor tenant dimensions. | Full actor and resource context, subject to baseline secret redaction. |
| `tenant-admin` | Own tenant resources. External actor identity redacted by default. | Actors whose `actor_workspace_tenant_id` or unambiguous tenant-owned service/token owner matches the tenant. | Sees own actors' outbound actions with external resource tenant redacted; sees inbound external actors on own resources with external actor redacted. |
| `viewer` | Own tenant resources, read-only, with external actor identity redacted. | Self-audit only for the viewer's own `actor_subject_id` when exposed; no tenant-wide actor browsing. | Sees only redacted external markers needed to understand that an event crossed a boundary. |
| `devops` | Own tenant operational resources needed for deploy, promote, and runtime support workflows. | Own subject plus tenant-owned service accounts or API tokens used for operational workflows. | Sees operational action, outcome, and coarse external marker; no external tenant or actor identity. |

If a user holds several roles, the most privileged applicable role governs the
specific request. Tenant scope still applies unless the role is `cpi-admin`.

## 10. Consequences

### Positive

- Clarifies that `audit_events.tenant_id` is resource ownership.
- Adds a clear actor-accountability target without weakening `by_resource`.
- Prevents multi-tenant membership from leaking audit data across tenants.
- Gives future API, UI, export, and migration work one authorization doctrine.
- Allows platform operations to remain accountable without exposing platform
  staff identity to tenant-scoped viewers.

### Negative

- A future implementation will need schema and API changes.
- Historical events may have null actor tenant dimensions when request-time
  context was not captured.
- Tenant-scoped actor searches will be intentionally incomplete for old or
  ambiguous events.
- Redaction rules add complexity to API responses, exports, and UI rendering.

### Mitigations

- Preserve `by_resource` as the default compliance view.
- Treat null actor tenant dimensions as unknown, not as authorization failures.
- Keep `cpi-admin` as the only role with full cross-tenant actor/resource
  visibility.
- Require future implementation work to include API, UI, and export redaction tests.

## 11. Implementation Boundary

This ADR is not a migration plan. It does not prescribe an Alembic revision,
concrete column list, index names, backfill SQL, repository methods, API route
names, or UI component changes. Any follow-up implementation must cite this ADR
as the doctrine source and prove that the authorization matrix and redaction
rules are enforced.

## 12. Verdict

accepted: implement by_actor view (with the dimensions above)
