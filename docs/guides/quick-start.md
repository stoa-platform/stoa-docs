---
title: "Local R1 Quickstart"
description: "Explore STOA locally with its gateway and control plane."
sidebar_position: 1
slug: /guides/quickstart
---

# Local R1 Quickstart

:::info Validation in progress
This path has been checked by reading the sources. Execution on a fresh clone has not been attested; image availability and results still need confirmation.
:::

Explore STOA with its gateway and control plane. This path uses the Rust gateway. [Envoy is the decided target](/docs/architecture/adr/adr-098-envoy-data-plane/); migration is still ahead.

## Prerequisites

- Git, Docker Engine and Docker Compose; declared Compose minimum: **2.1.1**, pending execution validation.
- Bash, `curl`, `openssl` and GNU `timeout` for the commands below.
- On macOS, consult the supervision alternatives in the `quickstart/` README before starting.
- Access to public dependencies for images, packages and build dependencies.
- The control plane image targets `linux/amd64`; another architecture may require emulation.

Minimum Docker Engine and CPU, memory and disk resources: **[À COMPLÉTER : prerequisites measured on a fresh clone]**. No startup time is guaranteed. Do not run another path using the same ports at the same time.

## Clone and start

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/quickstart
timeout 300 docker compose up --wait
./verify.sh
```

`300` is the declared startup bound, not a completion-time promise. This path requires no environment file copy, Compose profile or Make command. Demonstration placeholders are defined in Compose; do not reuse them for a real deployment.

## What You'll Accomplish

Compose includes PostgreSQL, Keycloak, the control plane, a locally built Rust gateway and a mock backend. It includes neither Console nor Portal, nor a broker.

The script initializes Keycloak and declares a contract directly through `POST /admin/contracts`. Expected results, **not observed here**: accepted declaration (`200` or `201`), rejection without a token (`401`), rejection with an invalid token (`401`), success with a Keycloak token (`200`), then `VERIFY_OK`. No specific business response is guaranteed.

The control plane health check does not demonstrate API publication through it or a migrated, usable database. The script does not validate MCP or a browser interface.

## Local access

| Role | Access from your machine |
|---|---|
| Control plane health | `http://localhost:8000/health` |
| Gateway health | `http://localhost:8081/health` |
| Keycloak base | `http://localhost:8080` |

The canonical Keycloak URL is internal to Compose; a published port does not establish a browser administration path. The script reads administration parameters from containers and generates its call secret; no sensitive values need copying.

## Stop and clean up

From `stoa/quickstart`:

```bash
docker compose down
```

To remove volumes and orphaned containers as well:

```bash
docker compose down --volumes --remove-orphans
```

The second command deletes data in the affected volumes. Compose declares no volumes, but third-party images may create them. The script also writes temporary files: inspect the files it created and remove them after diagnosis. **[À COMPLÉTER : temporary file inventory and validated removal procedure]**.

## Register Your Own API {#register-your-own-api}

This scenario is limited to its verification contract. For another contract, study the [UAC model](/docs/concepts/uac/) and validate authentication and publication separately.

## Other paths

The [stoactl guide](/docs/guides/stoactl-quickstart/) scaffolds a different project and does not validate this path. The public [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) repository remains separate.

For an existing hosted environment, use the addresses and parameters supplied by your administrator (`STOA_CONSOLE_URL`, `STOA_MCP_URL`, `STOA_AUTH_URL`). The [MCP guide](/docs/guides/mcp-developer-guide/) is complementary; do not run its commands against this Compose setup assuming demonstrated compatibility.

## Troubleshooting

Check prerequisites, occupied ports and access to public dependencies. An image reference in the repository does not guarantee anonymous availability. If startup or `verify.sh` fails, keep diagnostics locally without publishing sensitive parameters.
