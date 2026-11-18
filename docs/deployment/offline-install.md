---
sidebar_position: 3
title: Offline Installation
description: Prepare and install STOA on a site with no outbound Internet access — package the Helm chart from a repository checkout, mirror digest-pinned images, load into a private registry, and verify offline.
keywords: [deployment, offline, air-gapped, private registry, helm, mirror, digest, sovereign, on-premises]
---

# Offline Installation

This page is a **verifiable procedure** for installing STOA when the target site must not open outbound connections to the Internet. It complements [Sovereign Deployment](/docs/deployment/sovereign) (topology and isolation), [Deployment Prerequisites](/docs/deployment/prerequisites) (ports, DNS, sizing), and the [Installation Guide](/docs/admin/installation). The public hosted platform was shut down on 2026-05-23; STOA is installed on the operator's own infrastructure ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first)).

:::info Scope of this guide
- **In scope:** packaging `charts/stoa-platform` from a verified `stoa-platform/stoa` checkout on a connected machine, mirroring digest-pinned images, transferring the bundle, pushing to an on-site OCI registry, installing the gateway chart against that registry, and running an offline verification checklist.
- **Chart boundary (`charts/stoa-platform` `v0.1.0`):** deploys **only the Rust STOA Gateway** (`stoa-gateway`), the 5 CRDs (`crds/*.yaml`), and optional sidecar/sync/bootstrap/monitoring objects (`charts/stoa-observability` packages optional telemetry). Control Plane API, Console, Developer Portal, Keycloak (`quay.io/keycloak/keycloak`), PostgreSQL, Redpanda, and OpenBao are deployed via separate manifests or upstream charts and must be mirrored alongside `stoa-gateway` when deploying a full on-site control plane.
- **Data plane ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)):** upstream Envoy is the target data plane. At `stoa` `main` (`639e8b9a`), opt-in loopback mTLS ADS (`STOA_GATEWAY_TYPE=envoy` in `stoa-connect`) and the Rust `ext_authz` gRPC server in `stoa-gateway` exist in source, while `charts/stoa-platform` renders the Rust `stoa-gateway` Deployment (Envoy Helm packaging and full cut-over remain in progress).
- **Out of scope:** choosing the operator's registry product, TLS termination at the site edge, and day-2 operations ([maintenance](/docs/admin/maintenance), [secret rotation](/docs/admin/secret-rotation), [incident response](/docs/admin/incident-response)).
:::

Names below are placeholders (`registry.example.com`, `stoa-system` namespace). No real hostnames, IP addresses, or credentials appear in this document.

## 1. What "offline" means here

| Phase | Network | Who |
|-------|---------|-----|
| Prepare the bundle | Connected machine (build or bastion with GitHub + registry pull rights, Git, Helm 3.12+, Docker / Skopeo) | Operator |
| Transfer | Removable media, approved file transfer, or a one-way diode — **no** live pull from the public Internet on the target site | Operator |
| Install and run | Target site with **no** required outbound Internet ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Operator |

If the site pulls from an internal registry fed by a controlled mirror pipeline, reuse the same digest-pinned image list and Helm values; the transfer step becomes "promote through the mirror" instead of "copy media".

## 2. Inputs you need before starting

- Kubernetes 1.28+ cluster meeting [Deployment Prerequisites](/docs/deployment/prerequisites) (CPU/RAM, storage, internal DNS).
- An on-site OCI registry reachable from cluster nodes (`registry.example.com` in the examples).
- Helm 3.12+ and `kubectl` configured for the target cluster on the install workstation.
- A verified commit SHA or release tag of [`stoa-platform/stoa`](https://github.com/stoa-platform/stoa) (no public `charts.gostoa.dev` repository, `oci://ghcr.io/stoa-platform/charts/...` artifact, or `helm-v*` GitHub Release tarball is published today — always package the chart archive from the repository checkout).
- A written list of **immutable `@sha256:<64-hex>` digests** — `charts/stoa-platform/templates/_helpers.tpl` (`stoa-platform.pinnedImage`) **rejects** missing or non-SHA-256 digests and ignores `image.tag`.

## 3. Prepare the mirror bundle (connected machine)

### 3.1 Image list

Mirror `stoa-gateway` for `charts/stoa-platform`, plus the Control Plane and infrastructure images used by your separate Control Plane deployment:

| Component | Source image reference | Used by |
|-----------|------------------------|---------|
| STOA Gateway (Rust) | `ghcr.io/stoa-platform/stoa-gateway@sha256:<digest>` (default in `charts/stoa-platform/values.yaml`: `sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e`) | `charts/stoa-platform` (`stoaGateway.image`) |
| Control Plane API | `ghcr.io/stoa-platform/control-plane-api@sha256:<digest>` | Separate Control Plane manifest |
| Console UI | `ghcr.io/stoa-platform/control-plane-ui@sha256:<digest>` | Separate Control Plane manifest |
| Developer Portal | `ghcr.io/stoa-platform/portal@sha256:<digest>` | Separate Control Plane manifest |
| Keycloak 26 | `quay.io/keycloak/keycloak@sha256:<digest>` | Separate IAM manifest (`stoa` realm) |
| PostgreSQL 16 | `docker.io/library/postgres@sha256:<digest>` | Separate database manifest |
| Optional chart job images | `curlimages/curl@sha256:...` (`gatewaySync.image`), `python@sha256:...` (`stoa.bootstrap.firstAdmin.image`), `postgres@sha256:...` (`vault.credentialsCheck.image`) | Only if those chart options are enabled |

### 3.2 Package the Helm chart from checkout and save images

```bash
# Connected prep machine
STOA_REF="639e8b9a2217695cfc2f590e246ed9d4ce4d4913"   # verified stoa main SHA
BUNDLE_DIR="$PWD/stoa-offline-${STOA_REF:0:8}"
mkdir -p "${BUNDLE_DIR}/charts" "${BUNDLE_DIR}/crds" "${BUNDLE_DIR}/images"

# 1. Clone stoa and package charts/stoa-platform into a .tgz archive
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout "${STOA_REF}"

helm lint ./charts/stoa-platform
helm package ./charts/stoa-platform --destination "${BUNDLE_DIR}/charts"
cp ./charts/stoa-platform/crds/*.yaml "${BUNDLE_DIR}/crds/"
cd ..
```

Pull by immutable digest and export a **Docker tar archive** via `docker save` (if you mirror directly between registries with `skopeo` instead, pass `skopeo copy --preserve-digests` — plus `--all` for multi-arch indexes — and note that `skopeo` fails explicitly if schema conversion would alter the digest; when using `docker pull` / `docker save` / `docker push`, record the digest reported by `docker push` or queried from the target site registry):

```bash
GW_DIGEST="sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e"

docker pull --platform linux/amd64 "ghcr.io/stoa-platform/stoa-gateway@${GW_DIGEST}"
docker tag  "ghcr.io/stoa-platform/stoa-gateway@${GW_DIGEST}" \
  "registry.example.com/stoa/stoa-gateway:0.9.25"
docker save -o "${BUNDLE_DIR}/images/stoa-gateway.tar" \
  "registry.example.com/stoa/stoa-gateway:0.9.25"

# Repeat for control-plane-api, control-plane-ui, portal, keycloak, postgres,
# and any optional chart job images you plan to enable.

(cd "${BUNDLE_DIR}" && shasum -a 256 charts/*.tgz crds/*.yaml images/*.tar > SHA256SUMS)
```

### 3.3 Bundle layout

```text
stoa-offline-639e8b9a/
  SHA256SUMS
  charts/stoa-platform-0.1.0.tgz
  crds/
    gatewaybindings.gostoa.dev.yaml
    gatewayinstances.gostoa.dev.yaml
    skills.gostoa.dev.yaml
    tools.gostoa.dev.yaml
    toolsets.gostoa.dev.yaml
  images/
    stoa-gateway.tar
    ...                              # additional Control Plane / infra tarballs
  values-offline-example.yaml        # non-secret overrides only
```

## 4. Transfer and load on site

1. Copy `stoa-offline-639e8b9a/` across your approved transfer boundary.
2. On an install workstation that can reach `registry.example.com` and the Kubernetes API:

```bash
cd stoa-offline-639e8b9a
shasum -a 256 -c SHA256SUMS

for f in images/*.tar; do
  docker load -i "$f"
done

docker push registry.example.com/stoa/stoa-gateway:0.9.25
# Record the `digest: sha256:<SITE_GW_DIGEST>` line printed by `docker push`, or filter `.RepoDigests`
# specifically for `registry.example.com/` (`.RepoDigests[0]` may still reference `ghcr.io`):
docker inspect --format='{{range .RepoDigests}}{{println .}}{{end}}' \
  registry.example.com/stoa/stoa-gateway:0.9.25 | grep '^registry\.example\.com/'
# Example output: registry.example.com/stoa/stoa-gateway@sha256:<SITE_GW_DIGEST>
```

3. Create the namespace, the registry pull secret, and attach `imagePullSecrets` to the ServiceAccount used by `stoa-gateway` (`charts/stoa-platform` does **not** read `global.imageRegistry` or `global.imagePullSecrets`; when `stoaGateway.k8s.enabled` is `false` as by default, `templates/stoa-gateway-deployment.yaml` uses `stoaGateway.serviceAccount` — default `"default"`, overridden to `stoa-gateway-sa` below — whereas enabling `stoaGateway.k8s.enabled: true` hardcodes `serviceAccountName: stoa-gateway`, in which case patch `stoa-gateway` instead):

```bash
kubectl create namespace stoa-system --dry-run=client -o yaml | kubectl apply -f -

# Create site-registry-pull Secret using your site-local credentials (never commit secrets),
# then attach it to a dedicated ServiceAccount:
kubectl create serviceaccount stoa-gateway-sa -n stoa-system --dry-run=client -o yaml | kubectl apply -f -
kubectl patch serviceaccount stoa-gateway-sa -n stoa-system \
  -p '{"imagePullSecrets": [{"name": "site-registry-pull"}]}'
```

## 5. Install with Helm from the packaged archive (no outbound pulls)

Because `stoa-platform.pinnedImage` (`charts/stoa-platform/templates/_helpers.tpl`) renders `image: "<repository>@<digest>"`, set **both** `stoaGateway.image.repository` and `stoaGateway.image.digest` to your on-site registry coordinates, and disable optional hooks/monitors whose external images or operators are absent:

```yaml
# values-offline-example.yaml — placeholders only, no secrets
stoa:
  domain: "internal.example.com"
  bootstrap:
    enabled: false

stoaGateway:
  enabled: true
  serviceAccount: stoa-gateway-sa
  image:
    repository: registry.example.com/stoa/stoa-gateway
    digest: "sha256:<64_LOWERCASE_HEX_DIGEST_FROM_SITE_REGISTRY>"
    pullPolicy: IfNotPresent
  controlPlaneUrl: "https://api.internal.example.com"
  keycloakUrl: "https://auth.internal.example.com"
  secretName: stoa-gateway-secrets
  # Required when controlPlaneUrl is set so /ready can pass once signed policies load (ADR-070 §4):
  policyBootTenants:
    - "<TENANT_ID>"
  serviceMonitor:
    enabled: false
  otelEndpoint: ""

stoaSidecar:
  enabled: false
gatewaySync:
  enabled: false
controlPlaneApi:
  serviceMonitor:
    enabled: false
gateway:
  edgeMcp:
    enabled: false
vault:
  credentialsCheck:
    enabled: false
```

:::warning Mount the `private_key_jwt` signing-key Secret before expecting `1/1 Ready`
`values-offline-example.yaml` alone is **not** sufficient for `1/1 Ready` (`/health` tests process liveness only, whereas `/ready` enforces `policyBootTenants` and fresh signed tool permissions). At commit `639e8b9a`, `charts/stoa-platform` mounts only `tmp` (`emptyDir`) and `stoa-gateway-policies` (`ConfigMap`) — it does **not** mount a Secret volume via `secretName` or `extraEnv`. Mount the `private_key_jwt` signing-key Secret (`STOA_KEYCLOAK_CLIENT_KEY_PATH`, plus `STOA_KEYCLOAK_CLIENT_KEY_ID` via `extraEnv`) using a Deployment manifest overlay, Kustomize patch, or Helm `--post-renderer` as documented in [Startup Policy and Readiness](/docs/admin/installation#startup-policy-and-readiness).
:::

Install from the local `.tgz` archive (Helm installs missing CRDs from the archive's `crds/` folder on initial install; on upgrades, apply `crds/*.yaml` manually first):

```bash
helm upgrade --install stoa-platform ./charts/stoa-platform-0.1.0.tgz \
  --namespace stoa-system \
  --values values-offline-example.yaml
```

Do **not** leave `stoaGateway.image.repository` pointing to `ghcr.io` on an offline cluster. If you enable `gatewaySync`, `stoa.bootstrap.firstAdmin`, `vault.credentialsCheck`, or `stoaSidecar`, mirror their images too and override each component's `image` (`<repo>@sha256:<digest>` or `{repository, digest}`) in `values-offline-example.yaml`.

## 6. Verification checklist (no Internet required)

Run these on site. Every step must succeed without outbound Internet access:

- [ ] `shasum -a 256 -c SHA256SUMS` passed before loading artifacts.
- [ ] `kubectl get crd | grep gostoa.dev` lists all 5 CRDs (`gatewaybindings`, `gatewayinstances`, `skills`, `tools`, `toolsets`).
- [ ] `kubectl -n stoa-system get pods -l app.kubernetes.io/name=stoa-gateway -o jsonpath='{.items[*].spec.containers[*].image}'` resolves to `registry.example.com/stoa/stoa-gateway@sha256:...` (never `ghcr.io`).
- [ ] `kubectl -n stoa-system get pods` shows `stoa-gateway` pods `1/1 Ready` once the `private_key_jwt` signing-key Secret volume overlay is applied and the on-site Control Plane, Keycloak, and `policyBootTenants` signed policies are loaded ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)).
- [ ] No runtime setting calls endpoints outside the site perimeter ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first)).

If a pod stays in `ImagePullBackOff`, verify the digest in `registry.example.com` and the `imagePullSecrets` patch on `stoa-gateway-sa` — never open temporary Internet access without a recorded security exception.

## 7. Related pages

| Topic | Page |
|-------|------|
| Gateway Helm chart values & readiness | [Installation Guide](/docs/admin/installation) |
| Sovereign topology and isolation | [Sovereign Deployment](/docs/deployment/sovereign) |
| Ports, DNS, sizing, private-registry prerequisites | [Deployment Prerequisites](/docs/deployment/prerequisites) |
| Sovereign-first modes | [ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first) |
| Fail-closed gateway readiness (`policyBootTenants`) | [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) |
| Envoy data plane and offline JWKS / image mirroring | [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
