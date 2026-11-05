---
sidebar_position: 1
slug: /guides/quickstart
title: "Quickstart: Run STOA Locally"
description: "Prepare the local STOA stack with Docker Compose, set every required variable by name, validate the configuration statically and start the selected services."
---

# Quickstart: Run STOA Locally

**Sovereign iPaaS — API & integration platform**

This is the single startup path for STOA. It uses the Docker Compose stack of the main [stoa repository](https://github.com/stoa-platform/stoa/tree/main/deploy/docker-compose) and includes the Console, the Developer Portal, the control plane API, the gateway, Keycloak and the observability services (Prometheus, Grafana, Loki, Tempo, OpenSearch). Hosted access is **available on request** through [our team](mailto:sales@gostoa.dev).

:::info Validation scope
The Compose configuration of the current `main` branch was validated statically with `docker compose config --quiet`, with every variable listed below set. No container was started. Startup, sign-in, demo data seeding and a first API call still require runtime verification; no startup duration is promised.
:::

## Prerequisites

- Git, Docker and Docker Compose v2.
- A dedicated local Docker environment with at least 8 GB of RAM allocated to Docker, as recommended by the repository.
- Free host ports for every `PORT_*` variable in `.env`, and no existing container using the fixed `stoa-*` container names of the Compose file. A project name alone does not isolate fixed container names. Resolve collisions before starting; do not stop or recreate another installation.
- Time and disk space for the first start: the control plane API, the Console and the gateway images are built from source (the gateway is a Rust build).

## 1. Prepare the configuration

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env
```

Edit `.env` locally before continuing. Every variable below is required by Compose: it is declared with no value in `.env.example`, and Compose refuses to interpolate the configuration while one of them is empty. Set your own value for each of them; do not copy values from any example, and do not publish or commit this file. `OPENSEARCH_PASSWORD` is **not** present in `.env.example`: add the line yourself.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL, migrations, API, Keycloak | Database authentication. |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak, API | Keycloak administrator, with the username set in `KEYCLOAK_ADMIN`. |
| `GATEWAY_API_KEY` | API, gateway | Shared key between the control plane and the gateway. |
| `GRAFANA_PASSWORD` | Grafana | Grafana administrator, with the username set in `GRAFANA_USER`. |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak, API | Control plane client in the application realm. |
| `MCP_KEYCLOAK_CLIENT_SECRET` | Keycloak | MCP gateway client. |
| `IDENTITY_GOVERNANCE_CLIENT_SECRET` | Keycloak | Identity governance client. |
| `E2E_DPOP_CLIENT_SECRET` | Keycloak, traffic seeder | DPoP test client. |
| `OAUTH2_PROXY_CLIENT_SECRET` | Keycloak | Observability OIDC client, used by the optional `monitoring-oidc` profile. |
| `OPENSEARCH_OIDC_CLIENT_SECRET` | Keycloak, OpenSearch Dashboards | OpenSearch Dashboards identity client. |
| `OPENSEARCH_ADMIN_PASSWORD` | OpenSearch, security initialization, API, Grafana | OpenSearch administration and security initialization. |
| `OPENSEARCH_DASHBOARDS_PASSWORD` | OpenSearch Dashboards, security initialization | Dashboards service account. |
| `OPENSEARCH_LOGWRITER_PASSWORD` | Security initialization | Log ingestion account. |
| `OPENSEARCH_PASSWORD` | Data Prepper | Trace ingestion into OpenSearch. With the default `OPENSEARCH_USER`, use the same value as `OPENSEARCH_ADMIN_PASSWORD`. |
| `LDAP_ADMIN_PASSWORD` | Keycloak, OpenLDAP (`federation` profile) | LDAP administrator referenced by the federation realm import. |
| `FEDERATION_ALPHA_BROKER_SECRET` | Keycloak | Identity broker between the federation demo realms. |
| `FEDERATION_DEMO_CLIENT_SECRET` | Keycloak | Federation demo client. |
| `DEMO_DEMO_ORG_ALPHA_DEMO_ALPHA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |
| `DEMO_DEMO_ORG_BETA_DEMO_BETA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |
| `DEMO_IDP_SOURCE_ALPHA_ALICE_ALPHA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |
| `DEMO_IDP_SOURCE_ALPHA_BOB_ALPHA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |
| `DEMO_IDP_SOURCE_BETA_CAROL_BETA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |
| `DEMO_IDP_SOURCE_BETA_DAVE_BETA_PASSWORD` | Keycloak | Demo user of a federation demo realm. |

Keycloak imports the federation demo realms at every start, which is why their variables are required even when the `federation` profile is not enabled.

Also recommended, although validation passes without them: `GRAFANA_OIDC_CLIENT_SECRET` for Grafana sign-in through Keycloak, and `OAUTH2_PROXY_COOKIE_SECRET` for the optional `monitoring-oidc` profile. `GATEWAY_ADMIN_TOKEN` can be set in `.env` for gateway administration workflows; the Compose file provides a default.

Validate without starting services:

```bash
docker compose -p stoa-local-check -f docker-compose.yml config --quiet
```

A silent exit with status 0 means the configuration interpolates. An error naming a variable means that variable is still unset or empty in `.env`. This check validates configuration only, not image availability, port availability or application health.

## 2. Start the selected services

After resolving local conflicts, start this explicit service set:

```bash
docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo
```

Through their declared dependencies, these five entries start 19 services: the application stack (PostgreSQL, Redpanda, Keycloak, the database migration job, the control plane API, the Console, the Portal, the gateway and the nginx reverse proxy), OpenSearch with its security and index initialization jobs, Prometheus, Grafana, Loki, Tempo and Data Prepper. The selection leaves out Promtail, which mounts the Docker socket and reads the logs of every container on the host, as well as the demo-only gateways, the traffic seeder and Alertmanager. Do not replace it with an unqualified `docker compose up -d`. The separate `stoa-quickstart` repository is not an alternative path in this guide.

Follow the startup with `docker compose ps -a` until the long-running services report `healthy` and the one-shot jobs (`db-migrate`, `redpanda-init`, `opensearch-security-init`, `opensearch-init`) have exited with status 0. The repository script `scripts/demo/check-health.sh --wait` expects Promtail and Alertmanager and therefore never completes with this selection.

## 3. Create the first administrator and sign in

Open the reverse proxy on the host port set by `PORT_PROXY`: the Console is at `/`, the Developer Portal at `/portal`, API documentation at `/api/docs`, Keycloak at `/auth`, Grafana at `/grafana`, OpenSearch Dashboards at `/logs`, and gateway health at `/gateway/health`.

The imported application realm contains no human user, and registration is invitation-only. Sign in to the Keycloak administration console at `/auth` with the account defined by `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD`, switch to the application realm (its name is set by `KEYCLOAK_REALM` in the Compose file), create a user, assign the `cpi-admin` realm role and set a non-temporary password. The repository also provides a scripted path, `deploy/docker-compose/scripts/first-admin.sh`, described in its runbook `docs/runbooks/first-admin-bootstrap.md`. Then sign in to the Console with that user.

### Optional: seed demo data

Demo seeding uses the application administrator you created. Export its username as `ANORAK_USER` and its password as `ANORAK_PASSWORD` in your shell without echoing them, load `.env` into the same shell, then run the seed script from the Compose directory:

```bash
set -a
. ./.env
set +a
../../scripts/demo/seed-all.sh --skip-traffic
```

The script needs Python with the `httpx` package on the host. This step has not been verified at runtime for this path.

## Register your own API {#register-your-own-api}

After sign-in works, use **Backend APIs** in the Console to register your backend. Continue with [MCP for Developers](/docs/guides/mcp-developer-guide) for agent access and [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) for subscriptions.

## Troubleshooting

| Problem | Action |
| --- | --- |
| Configuration validation fails | Set the variable named by Compose in your local `.env`; remember that `OPENSEARCH_PASSWORD` must be added by hand. |
| Port or container-name collision | Use a dedicated environment; leave existing installations untouched. |
| Health check script never completes | `check-health.sh --wait` expects Promtail and Alertmanager, which this selection does not start; use `docker compose ps -a` instead. |
| Sign-in fails after startup | Verify the user, its `cpi-admin` role and its non-temporary password in the application realm. |
| Service unavailable after configuration validation | Check application readiness locally; static validation does not prove runtime health. |

## See also

- [Installation guide](/docs/deployment/hybrid)
- [MCP for Developers](/docs/guides/mcp-developer-guide)
