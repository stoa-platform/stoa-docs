---
sidebar_position: 17
title: "Companion Usage"
description: "How the STOA companion answers allow or deny for a host gateway, an application, or a future mesh, and the limits of that integration on current main."
keywords:
  - companion
  - sidecar
  - ext_authz
  - stoa-connect
  - third-party gateway
---

# Companion usage

STOA can run next to an existing gateway as a companion. The same Rust binary, started with `STOA_GATEWAY_MODE=sidecar`, exposes `POST /authz` and does not mount MCP routes. Decisions come from the shared decision engine: identity, tenant, an optional per-consumer rate limit, and scopes when they are configured on the engine. The host keeps authentication, routing, and enforcement of the verdict. A Helm template can place the host and the STOA companion in one pod.

This page is a snapshot of public [`stoa` `a97147e97edfa7c843b3c81dc14c6c039ee45908`](https://github.com/stoa-platform/stoa/commit/a97147e97edfa7c843b3c81dc14c6c039ee45908) (2026-11-05). It is an operator description of what that revision implements. It is not a compatibility statement, a certification, or evidence of a live third-party deployment.

The same revision documents the runtime in more detail:

- [Sidecar usage patterns](https://github.com/stoa-platform/stoa/blob/a97147e97edfa7c843b3c81dc14c6c039ee45908/docs/integrations/sidecar-usage-patterns.md)
- [Gateway deployment modes](https://github.com/stoa-platform/stoa/blob/a97147e97edfa7c843b3c81dc14c6c039ee45908/docs/architecture/gateway-deployment-modes.md)

## Runtime mode and deployment mode

`STOA_GATEWAY_MODE=sidecar` selects the route profile of the Rust binary. A deployment mode describes where that process sits.

| | Standalone gateway | Same-pod companion | External agent |
| --- | --- | --- | --- |
| Deployment mode | `edge` | `sidecar` | `connect` |
| Topology | `native-edge` | `same-pod` | `remote-agent` |
| Process | `stoa-gateway` with `STOA_GATEWAY_MODE=edge-mcp` | `stoa-gateway` with `STOA_GATEWAY_MODE=sidecar` | `stoa-connect` (Go), or a standalone link |
| Who serves the client | STOA | The host gateway or application | The third-party gateway |
| STOA on the request path | Full gateway | `POST /authz` before the host forwards | Absent. The agent syncs the gateway admin API |

A process started in sidecar runtime mode is a same-pod companion only when the pod contains the target gateway and `stoa-sidecar`, and the target calls STOA on `localhost` or `127.0.0.1`. GitOps desired state in that revision declares `edge` and `connect`. Some instances set a runtime `mode: sidecar` and are still classified `connect` (capability `not-a-k8s-sidecar`). None declare deployment mode `sidecar`.

## What `POST /authz` decides

The host sends JSON. `method` and `path` are the fields the parser requires. `user` becomes the principal. With no `user`, the decision is `401`. With no `tenant_id`, the decision is `403`.

```json
{
  "method": "GET",
  "path": "/api/v1/orders",
  "headers": {"x-request-source": "edge"},
  "source_ip": "192.0.2.10",
  "tenant_id": "tenant-a",
  "user": {
    "id": "user-123",
    "roles": ["viewer"],
    "scopes": ["orders:read"]
  },
  "context": {}
}
```

The engine stops at the first denial:

| Stage | When it runs | Denial |
| --- | --- | --- |
| Identity | Always | `401` when `user` is absent |
| Tenant | Always | `403` when `tenant_id` is absent |
| Consumer rate limit | `quota_enforcement_enabled=true` | `429`, key `<tenant_id>:<user.id>` |
| Scopes | Required scopes are set on the engine | `403` when the user holds none of them |

On allow, the engine computes `X-User-ID`, `X-Tenant-ID`, `X-Request-ID`, and `X-User-Scopes` or `X-User-Roles` when those lists are non-empty. The default response format drops those headers. See [Limits](#current-limits).

`SidecarService` converts the JSON and formats the response. It does not add a second policy engine.

## Pattern 1 — same pod, next to a third-party gateway

This is the companion shape the chart can render. The host gateway and `stoa-sidecar` share a Kubernetes pod. The host authenticates the client, calls `POST /authz`, and forwards to the backend only when the answer is `200`.

```text
Client → host gateway → POST /authz → stoa-sidecar
                │                         127.0.0.1:8081
                ← allow or deny ──────────┘
                └── on 200 → backend
```

The chart template `charts/stoa-platform/templates/stoa-sidecar-deployment.yaml` renders that pod when `stoaSidecar.enabled=true`. The value defaults to `false`. Rendering fails unless `stoaSidecar.mainGateway.enabled=true`. The template sets `STOA_GATEWAY_MODE=sidecar`, `STOA_PORT=8081`, and `EXT_AUTHZ_URL=http://localhost:8081/authz` on the target container. The gateway Service publishes the host port. It does not publish `8081`.

The host still has to build the JSON body and call `/authz`. The repository ships no Kong, Envoy, or webMethods plugin that does this. An optional OpenResty example (`stoaSidecar.nginxExample`, default `false`, `targetGateway: nginx`) shows one JSON callout after HTTP Basic authentication. That example is off unless you enable it, and enabling the values is not a recorded live run.

For webMethods specifically, see [webMethods and the companion](./migration/webmethods-sidecar.md). Day-to-day synchronization of a third-party gateway is [stoa-connect](./stoa-connect-quickstart.md), described below.

## Pattern 2 — application or local callout

An application, or a small proxy in front of it, can `POST /authz` before it handles the request. The application then owns authentication, tenant resolution, enforcement, and the choice of what to do when STOA is unreachable.

```text
Client → application → POST /authz → STOA
              ← allow or deny ────────┘
              └── on 200 → handle the request
```

This pattern is a callout to the same endpoint. It is not the same-pod companion contract: the chart refuses to render without `mainGateway.enabled=true`, and the topology values are `native-edge`, `remote-agent`, and `same-pod` (a gateway target plus the sidecar). Leave the deployment kind unset rather than labelling this pod `sidecar`.

`/authz` does not check the identity of its caller. Anyone who can reach the port can submit any `user`.

## Pattern 3 — mesh or micro-gateway

Mesh and micro-gateway adapters are design notes. The decision engine's module comment says future micro-gateway proxying or mesh integration should translate their request into `DecisionInput` and call the same engine. No mesh injector, mesh controller, or micro-gateway adapter is implemented. The header comment on the sidecar module names Envoy, Kong, NGINX, Apigee, and AWS as design targets.

Two Envoy-related pieces exist and are not a mesh product:

- HTTP formatters for an Envoy-style response and a Kong-style response are implemented and unit-tested. `SidecarSettings::from_env()` always selects the status-code format, so those formatters are not reachable from configuration.
- An Envoy gRPC authorization listener (`envoy.service.auth.v3.Authorization`) starts only when its address is configured, in any runtime mode. It validates the bearer JWT itself, then calls the same decision engine. No example manifest in the repository enables it. It is not wired as a service-mesh integration.

## stoa-connect is the GitOps path

`stoa-connect` is the agent that registers with the Control Plane and syncs routes, policies, and credentials to a third-party admin API. Adapters in `stoa-go/internal/connect/adapters/` cover webMethods, Kong, Gravitee, and Envoy. The agent is outside the client request path: the third-party gateway enforces what the agent pushed.

Use `stoa-connect` when the gateway should stay in front of traffic and receive desired state from STOA. Use the companion when a host in the same pod must ask `POST /authz` before it forwards. The two are independent. A sidecar runtime process that targets a remote gateway is classified `connect`, not `sidecar`.

Install and operate the agent with the [stoa-connect quickstart](./stoa-connect-quickstart.md). Registration of a STOA process itself is the [gateway auto-registration](./gateway-auto-registration.md) guide. Management-API translation is the [gateway adapter pattern](../architecture/gateway-adapter-pattern.md).

## Current limits

Checked on `stoa` commit `a97147e97edfa7c843b3c81dc14c6c039ee45908`.

1. **No live third-party proof in the repository.** Route coverage is an in-process test (`sidecar_mode_exposes_authz_without_mcp_routes`). The same-pod chart has been reviewed as a template. No workflow in that revision renders the chart with `stoaSidecar.enabled=true` or records a live webMethods, Kong, Gravitee, or Envoy call to `/authz`. Docker Compose files that call `/authz` use a fixed demo principal on a Docker network. They are not a Kubernetes sidecar and they are not a product demonstration.
2. **The chart does not run a published light companion image.** CI job `companion-image` builds with `FEATURES=` and `NO_DEFAULT_FEATURES=true` and sets `push: false`. The publishing job builds `ghcr.io/stoa-platform/stoa-gateway` with `FEATURES=kafka,pingora,k8s`. `stoaSidecar.image` points at that published repository and a pinned digest. No image size or RSS figure is published for the unpublished profile.
3. **`POST /authz` returns a status code only.** `SidecarSettings::from_env()` sets `DecisionFormat::default()`, which is `StatusCode`. `STOA_DECISION_FORMAT` is not read. The host sees `200`, `401`, `403`, or `429` and an empty body. Enrichment headers, `X-RateLimit-*` headers, and the denial reason are dropped. JSON, Envoy, and Kong formatters exist in code and are not selectable.
4. **Identity is the JSON `user` object.** `STOA_USER_INFO_HEADER`, `STOA_TENANT_ID_HEADER`, and `STOA_UPSTREAM_TYPE` are stored on settings and are not used by `/authz`. The endpoint does not validate a token. The chart still injects Keycloak variables and `STOA_POLICY_ENABLED`. Those variables do not make `/authz` validate tokens or evaluate a policy engine.
5. **The listener is not loopback-only.** `main.rs` binds `0.0.0.0` and `config.port`. `Config.host` (`STOA_HOST`, default `0.0.0.0`) is not the bind address. The sidecar template sets `STOA_HOST=127.0.0.1` with a comment that the port is localhost-only. That comment does not match the bind. With the chart's `STOA_PORT=8081`, `/authz` listens on the pod IP. When `stoaSidecar.serviceMonitor.enabled` is true (the chart default), a separate ClusterIP Service publishes port `8081` on the same listener, so `/metrics` and `/authz` are both reachable through that Service. The chart ships no NetworkPolicy for the sidecar. Isolate the port in the network if the trust model matters: any caller who reaches it can assert any user.
6. **The decision engine has no OPA evaluation and no Kafka metering.** Stages are identity, tenant, an optional in-memory rate limit, and scopes. The `/authz` router never sets required scopes, so the scope stage does not run on that route. The in-memory limiter counts per process. The chart comment that lists a Kafka metering pipeline and OIDC token validation describes neither `DecisionEngine` nor `/authz`. There is no per-decision usage event and no `stoa_sidecar_*` metric in the gateway source. Generic HTTP metrics can record the `/authz` request itself.
7. **The topology proof is a declaration.** The template writes static JSON into `STOA_TOPOLOGY_PROOF` (`declared_in_kubernetes`, container names, `authz_url` on localhost). That declaration does not show that the host called `/authz`.
8. **Mesh packaging is absent.** Patterns 2 and 3 have no mesh adapter. The gRPC listener above is opt-in, has no example manifest, and is not a mesh controller.

## Related

- [Gateway modes](./gateway-modes.md)
- [Connect a third-party gateway with stoa-connect](./stoa-connect-quickstart.md)
- [Gateway auto-registration](./gateway-auto-registration.md)
- [webMethods and the companion](./migration/webmethods-sidecar.md)
- [Gateway adapter pattern](../architecture/gateway-adapter-pattern.md)
- [Configuration sources](../reference/config-sources.md)
