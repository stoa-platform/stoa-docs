---
sidebar_position: 2
title: Configuration sources
description: Where a STOA setting comes from, which source wins, and how to change it without writing secrets into Git.
keywords: [configuration, Helm, precedence, ExternalSecret, environment variables, provenance]
---

# Configuration sources

This page records **where a setting comes from** and **which source wins**. It was checked against public [`stoa`](https://github.com/stoa-platform/stoa) commit `a97147e` (2026-11-05). The `stoa-infra` repository was not readable for this pass. Re-read the chart before treating a default as current.

[Configuration Reference](/docs/reference/configuration) shows example blocks. Those examples are not a render of the charts. Use this page before you change a live site.

Placeholders only: `<base-domain>`, `stoa-system`, `${TOKEN}`. Do not paste production hosts or secret values into Git, tickets, or this site.

## Layers

Four layers show up in the public tree. They are not interchangeable.

| Layer | What it is on this revision | What it is not |
| --- | --- | --- |
| Process environment | The control plane reads field-named variables through `Settings` (`control-plane-api/src/config.py`). The gateway reads `STOA_*` (and a short legacy list) through Figment (`stoa-gateway/src/config/loader.rs`). | A Helm value the process never receives. |
| Helm values | Typed keys in `charts/stoa-platform/values.yaml`, overridable with later `-f` files and `--set`. The gateway Deployment copies selected keys into container `env`. `stoaGateway.extraEnv` and `stoaSidecar.extraEnv` are appended lists. `stoaSidecar.mainGateway.env` is the companion container's list. | A single generic `env:` map for every workload. That shape is not what `main` renders. See [open question 1](#open-questions). |
| Secret material | Kubernetes Secrets. Optional External Secrets (`stoaGateway.externalSecret`, off by default). Optional Infisical init container (`infisical.enabled`, off by default) writing files under `/secrets`. Helm-generated `stoa-internal-keys` (first install only; preserved on upgrade). | A safe place to commit a password. Keep material in the secret store. See [Secret and Key Rotation](/docs/admin/secret-rotation). |
| Desired runtime state | API and route intent in [`stoa.yaml`](/docs/reference/stoa-yaml). `GatewayBinding.spec.desiredState` on the CRD `gatewaybindings.gostoa.dev`. Chart ConfigMaps `stoa-chat-config` and `stoa-signup-settings`. | Process boot configuration. A binding does not set `STOA_LOG_LEVEL`. |

Control Plane API, Console, Portal, and Keycloak Deployments are **not** installed by `charts/stoa-platform`. The chart's own comments say Keycloak and Vault are deployed elsewhere, and `networkPolicy` says control plane, UI, portal, and identity workloads belong to separate charts. Those charts are not in the public `stoa` tree reviewed here.

## Precedence by family

Change the row's source of truth. Editing a downstream copy does not stick once the owner reconciles.

| Family | Source of truth on this revision | Override order (first loses) | Notes |
| --- | --- | --- | --- |
| Public service URLs on the control plane | `BASE_DOMAIN`, unless the specific URL variable is already present | Field default → `.env` → environment → explicit empty string kept → derivation fills **absent** keys only | Derivation uses `setdefault`. `KEYCLOAK_URL=` (empty) is kept. A missing `KEYCLOAK_URL` becomes `https://auth.<base-domain>`. Fallback domain when `BASE_DOMAIN` is missing inside the validator is `gostoa.dev` (the same default as `stoa.domain` in `values.yaml`). An empty `BASE_DOMAIN` fails startup. | |
| `stoa.domain` | Helm `stoa.domain` (chart default `gostoa.dev`) | `values.yaml` → later `-f` → `--set` | Consumed by the bootstrap Job when bootstrap is enabled: Keycloak redirect URIs `https://console.<domain>` and `https://portal.<domain>`. It does **not** set control-plane `BASE_DOMAIN` or `stoaGateway.keycloakUrl`. |
| Gateway feature knobs (mode, log level, Kafka on/off, policy on/off, replica count, environment name) | Typed `stoaGateway.*` / `stoaSidecar.*` keys rendered into `env` | Chart values → environment values file → `--set` → container env as rendered | `environment=prod` without `STOA_MCP_AUDIENCE` refuses to start. The Helm template does not set `STOA_MCP_AUDIENCE`. |
| Gateway secrets (`STOA_CONTROL_PLANE_API_KEY`, `STOA_KEYCLOAK_CLIENT_SECRET`) | Secret named by `stoaGateway.secretName` (default `stoa-gateway-secrets`) | Create the Secret yourself, **or** enable `stoaGateway.externalSecret` so External Secrets owns that Secret | Both keys are `optional: true`. Missing key: the gateway skips auto-registration and runs standalone. See [Gateway Auto-Registration](/docs/guides/gateway-auto-registration). |
| Gateway nested settings (mTLS, and other nested structs) | `STOA_<SECTION>__<FIELD>` | Defaults → one YAML file → `STOA_*` → legacy flat env | Single-underscore `STOA_MTLS_ENABLED` does not set `mtls.enabled`. Use `STOA_MTLS__ENABLED`. |
| Control-plane process settings | Env vars whose names match `Settings` fields, injected by the Deployment | `.env` file if present in the image working directory, then the process environment. Explicit `env` on the Pod overrides `envFrom`. Later `envFrom` sources override earlier ones for the same name. | `control-plane-api/k8s/deployment.yaml` `envFrom` order: ConfigMap `stoa-control-plane-api-config`, Secret `stoa-control-plane-api-secrets`, optional Secret `stoa-opensearch-secret`, optional Secret `anthropic-api-key`, optional ConfigMap `stoa-chat-config`. The first two objects are **not** defined in this chart. |
| Chat kill switch | Helm `stoa.anthropicApiKey` → ConfigMap `stoa-chat-config` key `CHAT_KILL_SWITCH` | Empty key → `"true"`. Non-empty key → `"false"`. | The control-plane Deployment loads that ConfigMap last among `envFrom`, and does not set `CHAT_KILL_SWITCH` in its explicit `env`, so this value reaches the process **if** that Deployment is the one in the cluster. Putting the API key in a committed values file stores it in Git and copies it into Secret `stoa-internal-keys`. Leave the Helm field empty and inject the key from the secret store. |
| Signup mode | Helm `controlPlaneApi.signupMode` (`invite` or `open`; other values fail `helm template`) → ConfigMap `stoa-signup-settings` | Chart value only, as far as this repo shows | The public control-plane Deployment does not reference `stoa-signup-settings`. See [open question 4](#open-questions). |
| API deployment intent | [`stoa.yaml`](/docs/reference/stoa-yaml) via `stoactl`, Console import, or the control plane | Not a Helm value | Independent of gateway boot env. |
| Telemetry pipeline endpoints | `charts/stoa-observability` `alloyConfig.*` and `global.platform` / `global.environment` | That chart's `values.yaml` → `values-dev.yaml` or `values-prod.yaml` | The gateway only learns the collector address from `stoaGateway.otelEndpoint` (or sidecar equivalent). |
| Object-storage credentials for error snapshots | Control-plane env `STOA_API_SNAPSHOT_*` | Legacy `STOA_SNAPSHOTS_*` still fills a field when the new name is unset; both set to different values fails boot | `charts/minio` does not deploy the control plane. It is an upstream MinIO values file plus local Secret and Job manifests. |

### URLs the control plane fills in when the variable is absent

| Variable | Value written |
| --- | --- |
| `KEYCLOAK_URL` | `https://auth.<base-domain>` |
| `GATEWAY_URL` | `https://vps-wm.<base-domain>` |
| `GATEWAY_ADMIN_PROXY_URL` | `https://apis.<base-domain>/gateway/Gateway-Admin-API/1.0` |
| `ARGOCD_URL`, `ARGOCD_EXTERNAL_URL` | `https://argocd.<base-domain>` |
| `GRAFANA_URL` | `https://grafana.<base-domain>` |
| `PROMETHEUS_URL` | `https://prometheus.<base-domain>` |
| `LOGS_URL` | `https://grafana.<base-domain>/explore` |
| `VAULT_ADDR` | `https://hcvault.<base-domain>` |
| `CORS_ORIGINS` | `https://console.<base-domain>`, `https://portal.<base-domain>`, the `staging-` and `dev-` console and portal names, plus local dev origins baked into the validator |

Sites that do not use the `vps-wm` or `hcvault` prefixes must set those variables explicitly. Derivation will not guess a different hostname.

`KEYCLOAK_INTERNAL_URL` is not derived. When it is set, backend calls use it and token `iss` checks still use `KEYCLOAK_URL`. The gateway mirrors that with `STOA_KEYCLOAK_INTERNAL_URL` versus `STOA_KEYCLOAK_URL`.

### Gateway load order

`Config::load` merges in this order. Later wins.

1. Built-in defaults.
2. The first file that exists among `config.yaml`, `config.yml`, and `/etc/stoa/config.yaml`. The Helm chart does not mount any of these.
3. `STOA_*` variables. `__` splits nested fields.
4. Legacy names, which therefore beat `STOA_*` when both are set: `PORT`, `HOST`, `JWT_SECRET`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_PROJECT_ID`, `GITHUB_TOKEN`, `GITHUB_ORG`, `GITHUB_CATALOG_REPO`, `GITHUB_GITOPS_REPO`, `GITHUB_WEBHOOK_SECRET`, `GIT_PROVIDER`.

Startup checks that refuse to boot include: port `0`; `mtls.enabled` with an empty trusted-proxy list; federation enabled with no upstreams; sender constraint enabled without mTLS or DPoP; `environment=prod` with no MCP audience.

## Charts in the public tree

`charts/` on this revision contains three directories: `stoa-platform`, `stoa-observability`, and `minio`.

### `stoa-platform` — what the chart owns

| Owned by the chart | Read by the process |
| --- | --- |
| Gateway Deployment, Service, Ingress (off unless enabled), ServiceAccount when the CRD watcher is on, policy ConfigMap, ServiceMonitor, HPA, PDB | Gateway reads the env list the Deployment rendered, then Figment. Policy files from the ConfigMap when `stoaGateway.policies.enabled` is true (path default `/etc/stoa/policies/default.rego`). |
| `stoaGateway.extraEnv` appended after the typed env entries | Same container. A repeated name is not a documented no-op. Confirm with `printenv` ([open question 6](#open-questions)). |
| ExternalSecret `stoa-gateway-secrets` when `stoaGateway.externalSecret.enabled` is true | Syncs only `STOA_CONTROL_PLANE_API_KEY` and `STOA_KEYCLOAK_CLIENT_SECRET` from `vaultPath` (values default `stoa/data/gateway`) through ClusterSecretStore `vault-backend`. Requires External Secrets Operator. |
| Secret `stoa-internal-keys` (`gateway-consumer-key`, `chat-internal-key`, `jwt-signing-key`) | Gateway env `GATEWAY_API_KEYS` from `gateway-consumer-key` (`optional: true`). Control-plane manifest reads `chat-internal-key` into `CHAT_GATEWAY_API_KEY`. Keys are generated once and not rotated by Helm. |
| Sidecar Deployment when `stoaSidecar.enabled` is true | Sidecar container env from typed fields, then `stoaSidecar.extraEnv`. Companion container env from `stoaSidecar.mainGateway.env`, then a chart-appended `EXT_AUTHZ_URL=http://localhost:8081/authz`. |
| OpenAPI sync CronJob when `gatewaySync.enabled` is true (on in `values.yaml`) | Job env: control-plane URL, gateway admin URL, and Secret `gatewaySync.credentialsSecret` keys `username` and `password`. This is not the Rust gateway's boot config. |
| ConfigMap `stoa-chat-config` | `CHAT_KILL_SWITCH`, and `CHAT_GATEWAY_URL` pointing at the gateway Service. The public control-plane Deployment also sets `CHAT_GATEWAY_URL` in explicit `env`, which overrides the ConfigMap for that key. |
| ConfigMap `stoa-signup-settings` | Not mounted by `control-plane-api/k8s/deployment.yaml`. |
| HPA and PDB objects for control plane, UI, portal, and the Python MCP gateway name | They select Deployments this chart does not create. |
| Vault ServiceMonitor, PrometheusRule, and a credential-check CronJob | Off by default. They observe a Vault install this chart does not deploy. |
| Bootstrap Job when `stoa.bootstrap.enabled` is true and `keycloak.operator.enabled` is false | One-shot Keycloak realm and client setup. Inline `stoa.bootstrap.keycloak.adminPassword` fails the render; the Job reads `existingSecret`. |
| Infisical init container when `infisical.enabled` is true | Writes `/secrets/<secretKey>` on an in-memory volume and mounts it on the gateway. `Config::load` does not read that directory ([open question 5](#open-questions)). |

Typed gateway env the template sets (non-secret): `STOA_PORT` `8080`, `STOA_HOST` `0.0.0.0`, `STOA_CONTROL_PLANE_URL`, `STOA_KEYCLOAK_URL`, `STOA_KEYCLOAK_REALM`, `STOA_KEYCLOAK_CLIENT_ID`, `STOA_LOG_LEVEL`, `STOA_LOG_FORMAT`, `STOA_GATEWAY_MODE`, `STOA_AUTO_REGISTER`, `STOA_ENVIRONMENT`, plus policy, Kubernetes watcher, Kafka, and `STOA_OTEL_ENDPOINT` when those blocks are enabled.

That list is the main gateway Deployment. The sidecar template sets `STOA_PORT` to `8081` and `STOA_HOST` to `127.0.0.1`. The process binds `0.0.0.0` and `config.port`; `STOA_HOST` is not the listen address. See [Companion usage](../guides/companion-usage.md).

The values comment on `secretName` also names `JWT_SECRET` and `ADMIN_API_TOKEN`. The Deployment and the ExternalSecret do not project those keys. Set them with `extraEnv` from a Secret if you need them, or expect the gateway defaults (admin API stays closed without `STOA_ADMIN_API_TOKEN`).

`values.yaml` defaults that operators miss when they trust the chart README instead of the file:

| Key | `values.yaml` | Chart `README.md` table |
| --- | --- | --- |
| `stoaGateway.controlPlaneUrl` | `http://stoa-control-plane-api.stoa-system.svc.cluster.local:80` | `http://control-plane-api:8000` |
| `stoaGateway.keycloakUrl` | empty | `http://keycloak:8080` |
| `stoaGateway.ingress.enabled` | `false` | `true` |
| `stoaGateway.resources.limits.memory` | `512Mi` | `256Mi` |
| `gatewaySync.enabled` | `true` | `false` |
| `gatewaySync.schedule` | `0 */6 * * *` | `*/30 * * * *` |

Render `helm template` and read the output. The README table is not the renderer.

`values-prod.yaml` sets real knobs under `stoaGateway` (replicas, `environment: prod`, ingress host, Kafka, CRD watcher). The same file also sets `global`, `replicaCount`, `postgresql`, `observability`, `ingress`, and `keycloak.replicas`. No template under `charts/stoa-platform/templates` reads those paths. `keycloak.replicas` is commented as reference-only for a chart that is not in this repository. They do not change `helm template` of `stoa-platform`.

### Second gateway manifest

`stoa-gateway/k8s/deployment.yaml` is a separate Deployment, also named `stoa-gateway` in `stoa-system`. It pins env directly. On this revision it points `STOA_CONTROL_PLANE_URL` at port **8000**. The chart default points at the Service port **80** (the Service forwards to container port 8000). It also sets `STOA_MCP_AUDIENCE`, which the Helm template never sets.

If both objects are applied, the last writer owns the Pod spec. See [open question 3](#open-questions). The raw manifest also contains site-specific upstream URLs. Do not copy it into a values file. Nested API-proxy keys in that manifest use a single underscore; the loader comment says those names are not bound. The bound form uses `STOA_API_PROXY__...` with a double underscore.

`values-prod.yaml` sets `stoaGateway.environment: prod` and still does not set an MCP audience. A gateway that actually receives that env and no audience exits on the prod check. Supply `STOA_MCP_AUDIENCE` through `extraEnv` until the chart grows a typed field ([open question 11](#open-questions)).

### `stoa-observability` — what the chart owns

Helm chart with subcharts Alloy, Tempo, and (optional) blackbox exporter. It owns the collector pipeline, not application flags.

| Chart value | Effect |
| --- | --- |
| `alloyConfig.prometheusRemoteWriteUrl`, `lokiUrl`, `tempoEndpoint`, `logNamespaces`, `scrapeInterval` | Rendered into ConfigMap `stoa-alloy-config`. |
| `global.platform`, `global.environment` | Labels on that pipeline. |
| `tempo.tempo.retention`, `tempo.persistence` | Passed to the Tempo subchart. `retention` default in this chart's values is `7d`. That is a chart default, not a published service objective. |
| `grafana.tempoDataSource.*` | Grafana datasource manifest when Tempo and the datasource flag are on. |
| `tenantTiers`, `alloyConfig.logLabels` | Present in `values.yaml`. No template in this chart references them ([open question 10](#open-questions)). |

The gateway export address is `stoaGateway.otelEndpoint` on the platform chart (default `http://stoa-alloy-otlp.stoa-monitoring:4317`). This observability chart creates the Alloy Service; it does not edit the gateway.

### `minio` — values overlay, not a packaged chart

There is no `Chart.yaml`. `charts/minio/README.md` installs upstream `minio/minio` with `values.yaml`, then applies `secret.yaml` and `setup-job.yaml`.

| Owned here | Read by the control plane |
| --- | --- |
| Upstream values: mode, persistence, `existingSecret` (default name `minio-credentials`, keys `rootUser` and `rootPassword`), bucket name `error-snapshots` | Nothing, until you set `STOA_API_SNAPSHOT_*` on the control plane. Canonical prefix is `STOA_API_SNAPSHOT_` (`control-plane-api/src/features/error_snapshots/config.py`). |
| Setup Job lifecycle | Bucket and expiration job. The MinIO README still shows the legacy `STOA_SNAPSHOTS_*` names ([open question 12](#open-questions)). |

Root credentials belong in `existingSecret`, not in `rootUser` / `rootPassword` in Git. The values file already leaves those strings empty.

## Safe change

1. Name the family in the table above. One family per change.
2. Read the live release before editing: `helm get values stoa-platform -n stoa-system`. If the site is not installed from this chart, stop and find the manifest that last wrote the Deployment (`kubectl -n stoa-system get deploy stoa-gateway -o jsonpath='{.metadata.labels}'`).
3. Edit Git. For a feature knob, edit the values file the release already uses. For a secret, edit the secret store and sync the Kubernetes Secret. Do not put the secret in `values.yaml`, a ConfigMap, or `--set`. Rotation steps: [Secret and Key Rotation](/docs/admin/secret-rotation).
4. For a URL, set the explicit variable when the hostname is not the derived prefix. Setting only `stoa.domain` does not move the gateway or the control plane.
5. Render and read env **names** only:

```bash
helm template stoa-platform charts/stoa-platform -n stoa-system -f <your-values>.yaml
```

6. Upgrade from the same file. Install and rollback context: [Installation](/docs/admin/installation), [Upgrade](/docs/admin/upgrade).

```bash
helm upgrade stoa-platform stoa/stoa-platform -n stoa-system -f <your-values>.yaml
kubectl -n stoa-system rollout status deploy/stoa-gateway
```

7. Roll back the Helm release if the new Pods do not become Ready: `helm rollback stoa-platform <REVISION> -n stoa-system`. A secret change is rolled back by restoring the previous Secret from the store and restarting, not by inventing a third value.

`kubectl edit` on a live Deployment is wiped the next time Helm or the raw manifest is applied. Use it only as an incident bridge and reconcile Git in the same window.

## Verification

Confirm the Pod you think you changed is the one that rolled.

- Non-secret knob: list env names and the value you changed.

```bash
kubectl -n stoa-system get deploy stoa-gateway \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"="}{.value}{"\n"}{end}'
```

  `valueFrom` lines print empty. That is expected. Do not add `-o yaml` of a Secret to a ticket.

- Secret key presence, not the secret:

```bash
kubectl -n stoa-system get secret stoa-gateway-secrets -o jsonpath='{.data}'
```

  You want the key names. Do not base64-decode them into logs.

- Gateway probes are `/health` and `/ready` on port 8080. Control-plane probes are `/health/live`, `/health/ready`, and `/health/startup` on container port 8000. A Pod that becomes Ready after the rollout has passed the probes defined on that Deployment.
- Prod gateway: if the process exits before Ready, read the log line. `environment=prod requires mcp_audience` means `STOA_MCP_AUDIENCE` never reached the process.
- URL change: call one route that uses that URL (OIDC discovery or control-plane health through the gateway's configured base). A Ready Pod does not prove an upstream hostname is right.
- Chat kill switch: the process value is the explicit `env` entry if one exists, otherwise the last `envFrom` source. On the public control-plane manifest, `CHAT_KILL_SWITCH` comes from `stoa-chat-config` and `CHAT_GATEWAY_URL` comes from the explicit `env` entry.
- Signup mode: after changing `controlPlaneApi.signupMode`, confirm the control-plane process environment actually contains `SIGNUP_MODE`. Updating the ConfigMap alone is not enough until [open question 4](#open-questions) is resolved.

## Open questions

Unresolved on commit `a97147e`. Do not document these as done.

1. **Helm env-block refactor (INFRA-1b, CAB-2200) is not on `main`.** Workloads still get typed values copied to individual env entries, plus `extraEnv` / `mainGateway.env` lists. There is no chart-wide `env:` source of truth.
2. **`stoa-infra` was not readable.** ConfigMap `stoa-control-plane-api-config`, Secret `stoa-control-plane-api-secrets`, the Keycloak chart, and the Vault chart are referenced and not defined in public `stoa`. Their source of truth is unconfirmed.
3. **Two gateway Deployments.** Helm template versus `stoa-gateway/k8s/deployment.yaml` (Service port 80 versus URL port 8000; MCP audience set only on the raw manifest). Which apply path is live is unconfirmed.
4. **`SIGNUP_MODE` wiring.** The chart writes ConfigMap `stoa-signup-settings`. The public control-plane Deployment does not mount it. Whether another chart projects that key is unconfirmed.
5. **Infisical files.** The init container writes `/secrets/<key>` and the gateway mounts the volume. Gateway load does not read those files. Whether a wrapper exports them is unconfirmed. Leave `infisical.enabled` false until that path is proven.
6. **Duplicate names in one `env` list** (`extraEnv` repeating a chart variable). Confirm on the cluster with `printenv` inside the new Pod. This page does not claim a Kubernetes-version rule.
7. **Chart README and `charts/stoa-platform/CLAUDE.md`.** The README table disagrees with `values.yaml` (see above). `CLAUDE.md` still describes `stoaGateway.enabled: false` and a Python gateway as current; `values.yaml` sets `stoaGateway.enabled: true` and comments the Rust gateway as primary. Treat `values.yaml` plus `helm template` as the chart.
8. **Dead keys in `values-prod.yaml`.** `global`, `replicaCount`, `postgresql`, `observability`, `ingress`, and `keycloak.replicas` do not affect this chart's templates. Whether an out-of-repo chart shares the file is unconfirmed.
9. **`GatewayBinding.spec.desiredState`.** The CRD allows the object (`x-kubernetes-preserve-unknown-fields: true`). No reader in the public gateway or control-plane trees references `desiredState`. A controller elsewhere is unconfirmed.
10. **`tenantTiers` and `alloyConfig.logLabels`.** Values only. No `stoa-observability` template reads them.
11. **MCP audience on the Helm prod path.** `values-prod.yaml` sets `environment: prod`. The template never sets `STOA_MCP_AUDIENCE`. The intended injection field is unconfirmed; until then use `extraEnv` and prove the process started.
12. **Snapshot env prefix.** Code uses `STOA_API_SNAPSHOT_*` and still accepts legacy `STOA_SNAPSHOTS_*`. `charts/minio/README.md` documents the legacy names. The alias sunset is unconfirmed.
13. **No service objectives are stated here.** Retention numbers in the observability values are chart defaults only.

## Related

- [Configuration Reference](/docs/reference/configuration) — example env and Helm blocks
- [stoa.yaml Reference](/docs/reference/stoa-yaml) — declarative API deployment spec
- [Installation](/docs/admin/installation) — chart install and post-install checks
- [Upgrade](/docs/admin/upgrade) — upgrade order and Helm rollback
- [Secret and Key Rotation](/docs/admin/secret-rotation) — secret-store changes and rollback
- [Security Configuration](/docs/reference/security-configuration) — JWT, CORS, SSE limits
- [mTLS Configuration](/docs/guides/mtls-configuration) — certificate-bound tokens
- [Gateway Auto-Registration](/docs/guides/gateway-auto-registration) — `STOA_CONTROL_PLANE_API_KEY`
