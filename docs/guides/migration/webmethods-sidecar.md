---
sidebar_label: webMethods and the companion
title: "webMethods and the STOA companion"
description: "What a same-pod STOA companion does next to a host gateway, and why this repository does not demonstrate a live webMethods integration."
keywords: [webMethods, sidecar, companion, migration, API gateway]
---

# webMethods and the STOA companion

A same-pod STOA companion can answer `POST /authz` for a host that calls it. This repository does not demonstrate that call with Software AG webMethods API Gateway. There is no recorded live webMethods run, no webMethods plugin in the tree, and no GitOps `GatewayInstance` with deployment mode `sidecar`.

Use this page to avoid the older recipe on this URL. That recipe described OPA policy evaluation, JWT validation, a Kafka usage pipeline, a console row for a live sidecar, and Prometheus series named `stoa_sidecar_*`. None of those are what `POST /authz` does on current `main`. The decision engine stages are identity, tenant, an optional in-memory rate limit, and scopes. The `/authz` router does not set required scopes, does not evaluate OPA, and does not emit a Kafka metering event. `stoa_sidecar_*` names do not appear in the gateway source.

The behavior, the three usage patterns, and the full limit list are in [Companion usage](../companion-usage.md). The snapshot is public `stoa` commit `a97147e97edfa7c843b3c81dc14c6c039ee45908` (2026-11-05).

## What to use for webMethods today

[`stoa-connect`](../stoa-connect-quickstart.md) is the GitOps path. The Go agent talks to the webMethods admin API and to the Control Plane. It is not on the client request path. The third-party gateway enforces the desired state the agent pushed. Adapters for webMethods, Kong, Gravitee, and Envoy live under `stoa-go/internal/connect/adapters/`.

A STOA process with `STOA_GATEWAY_MODE=sidecar` that targets a remote webMethods gateway is classified `connect` / `remote-agent`, not a same-pod companion.

## What the chart will render

`charts/stoa-platform/templates/stoa-sidecar-deployment.yaml` renders a two-container pod when `stoaSidecar.enabled=true` and `stoaSidecar.mainGateway.enabled=true`. `stoaSidecar.enabled` defaults to `false`. The template sets:

- `STOA_GATEWAY_MODE=sidecar` and `STOA_PORT=8081` on `stoa-sidecar`
- `EXT_AUTHZ_URL=http://localhost:8081/authz` on the target container
- `STOA_HOST=127.0.0.1`

The binary binds `0.0.0.0` and the port. `STOA_HOST` is not the listen address, so the chart comment that the port is localhost-only does not match the process. The main gateway Service does not publish port `8081`. With the chart default `stoaSidecar.serviceMonitor.enabled=true`, a separate ClusterIP Service does publish `8081`, and that listener also serves `/authz`.

`stoaSidecar.image` is the published `ghcr.io/stoa-platform/stoa-gateway` image, pinned by digest. The CI job that builds a lighter profile (`FEATURES=` and `NO_DEFAULT_FEATURES=true`) does not push that image, and the chart does not reference it.

The template reads the API key from the secret key `STOA_CONTROL_PLANE_API_KEY`, with `optional: true`. A secret that only contains `control-plane-api-key` does not populate the variable, and the pod still starts. The chart also injects Keycloak settings and `STOA_POLICY_ENABLED`. Those values do not make `/authz` validate tokens.

Supply your own webMethods image repository and digest if you render a target container. This site does not publish a webMethods image name, tag, or pull secret. Whether webMethods honors `EXT_AUTHZ_URL` or `apigw_ext_authz_*` is not shown in the repository. The host must send the JSON body documented in [Companion usage](../companion-usage.md). Forwarding the original request unchanged does not match `POST /authz`.

## Related

- [Companion usage](../companion-usage.md)
- [Connect a third-party gateway with stoa-connect](../stoa-connect-quickstart.md)
- [Gateway auto-registration](../gateway-auto-registration.md)
- [webMethods migration guide](./ibm-webmethods.md)
