---
sidebar_position: 74
title: "ADR-074: Tenant Model — One Realm, Tenant Groups and a tenant_id Claim"
sidebar_label: "ADR-074: Tenant Model"
description: "Records the tenant model STOA delivers: one Keycloak realm named stoa, one Keycloak group per tenant, and a tenant_id token claim checked by the control plane API and the gateway. Supersedes ADR-026."
keywords: [ADR, tenant model, multi-tenancy, Keycloak, realm, groups, tenant_id, claim, tenant isolation, architecture decision]
---

# ADR-074: Tenant Model — One Realm, Tenant Groups and a tenant_id Claim

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-11-05 |
| **Supersedes** | [ADR-026](./adr-026-multi-iam-federation.md) |
| **Related** | [ADR-046](./adr-046-mcp-federation-architecture.md), [ADR-073](./adr-073-adopt-envoy-data-plane.md) |

## Context

[ADR-026](./adr-026-multi-iam-federation.md) (2026-01-28) chose a federation hub:

- one Keycloak realm per organization;
- each organization's identity provider (OIDC, SAML or LDAP) brokered into its own realm;
- an RFC 8693 token exchange that issues scoped API tokens;
- a `stoa_realm` claim that the gateway compares with the requested tenant.

The platform delivers a different model:

- The control plane API, the Console, the Developer Portal and the gateway work against **one** application realm, named `stoa` by default.
- A tenant is a **Keycloak group** in that realm. The control plane API creates the group when it provisions the tenant.
- Services learn the tenant of a caller from a **`tenant_id` claim** in the access token.
- The realm-per-organization layout and the `stoa_realm` claim exist only in the multi-IAM federation demo. The control plane API and the gateway do not read `stoa_realm`.

ADR-026 still showed "Accepted" and described an architecture the platform does not run. This record states the delivered model and replaces ADR-026 as the reference.

## Decision

### 1. One application realm

STOA uses one Keycloak realm for application identity. Its default name is `stoa`.

- Users, platform roles (`cpi-admin`, `tenant-admin`, `devops`, `viewer`) and the STOA clients live in this realm.
- The control plane API and the gateway each accept tokens from a single issuer: `<Keycloak URL>/realms/<realm>`.
- The realm name is a setting: `KEYCLOAK_REALM` for the control plane API, `STOA_KEYCLOAK_REALM` for the gateway, `keycloakRealm` in the Helm chart values. The default is `stoa` in each of them.

### 2. A tenant is a group

When a tenant is provisioned, the control plane API:

1. Creates a top-level Keycloak group named after the tenant identifier (path `/<tenant_id>`), with the attributes `display_name` and `stoa_tenant_id`.
2. Stops provisioning if the group cannot be created. Group creation is retried, then the tenant is marked as failed.
3. Stores the Keycloak group identifier on the tenant record.

An existing group with the same name is reused only if its `stoa_tenant_id` attribute is absent or equal to the tenant identifier. Otherwise the control plane API refuses to reuse it.

Adding a user to a tenant does two things:

- the user joins the tenant group;
- the user attribute `tenant_id` is set to the tenant identifier.

Deprovisioning a tenant deletes its group (best effort).

### 3. `tenant_id` is the tenant claim

A Keycloak protocol mapper copies the user attribute `tenant_id` into a single-valued string claim `tenant_id` (access token, ID token and userinfo).

- In the local Docker Compose realm, the mapper belongs to the `stoa-identity` client scope. This scope is a default scope of the control plane API, Console, Developer Portal, MCP gateway and identity governance clients.
- The Helm bootstrap job adds the same mapper to the Console, Developer Portal and control plane API clients.
- OAuth clients created for API consumers carry a fixed `tenant_id` claim equal to the tenant identifier.

The claim comes from the user attribute, not from group membership. A token identifies at most one tenant.

Services read `tenant_id` as follows:

| Rule | Control plane API | Gateway |
|------|:-----------------:|:-------:|
| Accepts a non-empty string, or an array with exactly one string | ✅ | ✅ |
| Rejects empty values, values with surrounding spaces and multi-valued arrays | ✅ | ✅ |
| Rejects a token whose legacy `tenant` claim differs from `tenant_id` | ✅ | ✅ |
| Lets a platform administrator (`cpi-admin`) act on any tenant | ✅ | ✅ |
| Denies access to a tenant other than the one in the claim | ✅ (403) | ✅ |
| Rejects a token with no tenant, unless it carries the `cpi-admin` role | No (see below) | ✅ |

In the control plane API, a token without `tenant_id` still authenticates, but every tenant-scoped request then returns 403.

In the gateway, the Envoy external authorization (`ext_authz`) service also returns 403 when the claim is missing or differs from the `tenant_id` of the route.

Roles never identify a tenant.

### 4. Identity brokering is out of scope

This record does not describe identity brokering. Connecting an organization's own identity provider to the `stoa` realm, and how users brokered this way would receive a `tenant_id` attribute, is **not verified in the codebase**.

### 5. The federation demo is kept as evidence

The multi-IAM federation demo built for ADR-026 stays in the `stoa` repository. It shows the explored pattern:

- five demo realms: two identity sources and three organization realms federated through OIDC, SAML 2.0 and LDAP;
- a mock gateway and an OPA policy that isolate organizations by token issuer (one realm per organization); demo tokens also carry a `stoa_realm` claim;
- scripts for login, token exchange and cross-realm isolation tests.

The demo is not part of the product tenant model. It uses its own mock gateway, not the STOA gateway or the control plane API.

- [Federation demo walkthrough](https://github.com/stoa-platform/stoa/tree/main/scripts/demo-federation)
- [Federation demo stack](https://github.com/stoa-platform/stoa/tree/main/deploy/demo-federation)
- The local stack imports the demo realms at every start; its `federation` profile adds OpenLDAP and the mock gateway. See the [Quickstart](../../guides/quick-start.md) for the related variables.

## Consequences

### Positive

- The documentation matches the code: one realm, one group per tenant, one `tenant_id` claim.
- Each service validates a single issuer and a single set of realm signing keys.
- The control plane API and the gateway apply the same shape rules to the tenant claim.
- The control plane API drives the tenant lifecycle: it creates the group during provisioning and deletes it during deprovisioning.

### Negative

- All tenants share one realm. Realm-level settings (password policy, session lifetimes, brute-force protection, signing keys) apply to every tenant.
- Isolation relies on the `tenant_id` attribute and on the checks in each service, not on realm boundaries. A wrong attribute value gives a user access to another tenant.
- Users are stored in the `stoa` realm. The "zero user storage" goal of ADR-026 is not delivered.
- A token carries one tenant. Membership in several tenant groups is not reflected in the claim.

### Mitigations

- In the realm user profile, only administrators can view or edit the `tenant_id` attribute (local Compose realm and Helm bootstrap job).
- The `stoa_tenant_id` group attribute prevents a group from being reused for another tenant.
- Both consumers reject malformed, multi-valued or conflicting tenant claims.

### Not verified in the codebase

- Realm definitions maintained outside the `stoa` repository were not reviewed.
- Whether every Envoy route in a deployment carries a `tenant_id` value for the external authorization check was not verified.

## Relation to ADR-026

| ADR-026 element | Delivered state |
|-----------------|-----------------|
| One realm per organization | Not delivered. One realm, `stoa`; tenants are groups. |
| `stoa_realm` claim checked by the gateway | Not delivered. Services read `tenant_id`. `stoa_realm` appears only in the federation demo. |
| Identity provider brokering per organization (OIDC, SAML, LDAP) | Shown in the federation demo only. |
| RFC 8693 token exchange for scoped API tokens | Delivered in a different form. The control plane API exchanges a token through an API consumer's client in the `stoa` realm (`POST /v1/consumers/{tenant_id}/{consumer_id}/token-exchange`); the exchanged token carries the consumer's `tenant_id`. MCP federation sub-accounts can also have a token exchange client ([ADR-046](./adr-046-mcp-federation-architecture.md)). The per-organization, cross-realm exchange is shown in the federation demo only. |
| Zero user storage | Not delivered. Users are stored in the `stoa` realm. |

The realm-creation (tenant provisioning) route was removed in [stoa PR #3045](https://github.com/stoa-platform/stoa/pull/3045) as part of this model.
ADR-026 stays published, marked as superseded, for history.

## Evidence

Paths in the [`stoa` repository](https://github.com/stoa-platform/stoa), `main` branch, reviewed on 2026-11-05.

| Claim | Evidence |
|-------|----------|
| Realm `stoa` in the local stack | `deploy/docker-compose/init/keycloak-realm.json` (`"realm": "stoa"`) |
| Default realm, control plane API | `control-plane-api/src/config.py` (`KEYCLOAK_REALM`) |
| Default realm, Helm chart | `charts/stoa-platform/values.yaml` (`keycloakRealm`), `charts/stoa-platform/templates/bootstrap-job.yaml` (realm creation) |
| Single issuer, control plane API | `control-plane-api/src/auth/dependencies.py` (`_kc_issuer_url`) |
| Single issuer, gateway | `stoa-gateway/src/state.rs` (JWT validator setup) |
| Tenant = Keycloak group | `control-plane-api/src/services/keycloak_service.py` (`setup_tenant_group`, `_adopt_tenant_group`, `delete_tenant_group`) |
| Group created during provisioning | `control-plane-api/src/services/tenant_provisioning_service.py` (`provision_tenant`, `deprovision_tenant`), `control-plane-api/src/routers/tenants.py`, `control-plane-api/src/models/tenant.py` (`kc_group_id`) |
| User joins the group and gets the `tenant_id` attribute | `control-plane-api/src/services/keycloak_service.py` (`add_user_to_tenant`, `create_user`) |
| `tenant_id` mapper | `deploy/docker-compose/init/keycloak-realm.json` (client scope `stoa-identity`, mapper `tenant-id`), `deploy/keycloak/tenant-id-mapper.json`, `charts/stoa-platform/templates/bootstrap-job.yaml` |
| Fixed claim on consumer clients | `control-plane-api/src/services/keycloak_service.py` (`create_consumer_client`) |
| Token exchange for API consumers | `control-plane-api/src/routers/consumers.py` (`exchange_consumer_token`), `control-plane-api/src/models/federation.py` (`SubAccount`) |
| Claim consumed by the control plane API | `control-plane-api/src/auth/dependencies.py` (`_normalize_tenant_claim`, `get_current_user`), `control-plane-api/src/auth/rbac.py` (`decide_tenant_access`) |
| Claim consumed by the gateway | `stoa-gateway/src/auth/claims.rs` (`deserialize_tenant`, `tenant_id`, `validate_tenant`), `stoa-gateway/src/auth/middleware.rs`, `stoa-gateway/src/auth/rbac.rs`, `stoa-gateway/src/authz/ext_authz_grpc.rs` |
| `stoa_realm` only in the federation demo | `deploy/demo-federation/`, `scripts/demo-federation/` |

## References

- [ADR-026: Multi-IAM Federation Pattern](./adr-026-multi-iam-federation.md) (superseded)
- [ADR-046: MCP Federation Architecture](./adr-046-mcp-federation-architecture.md)
- [ADR-073: Adopt Envoy as the STOA Data Plane](./adr-073-adopt-envoy-data-plane.md)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/) (groups, client scopes and protocol mappers)
