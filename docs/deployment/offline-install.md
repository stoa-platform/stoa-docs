---
sidebar_position: 3
title: Offline Installation
description: Prepare and install STOA on a site with no outbound Internet access — mirror images, transfer the bundle, install from a private registry, and verify without external network.
keywords: [deployment, offline, air-gapped, private registry, helm, mirror, sovereign, on-premises]
---

# Offline Installation

This page is a **verifiable procedure** for installing STOA when the target site must not open outbound connections to the Internet. It complements [Sovereign Deployment](./sovereign) (topology and isolation) and [Deployment Prerequisites](./prerequisites) (ports, DNS, sizing). The hosted public platform was shut down on 2026-05-23; STOA is installed on the operator's own infrastructure ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first)).

:::info Scope of this guide
- **In scope:** preparing a mirror bundle on a connected machine, transferring it, loading images into an on-site registry, installing with Helm against that registry, and a post-install checklist that needs no Internet.
- **Out of scope:** choosing the operator's registry product, TLS termination at the site edge, and day-2 operations (backup, key rotation, incident response) — see the related tickets under CAB-2288.
- **Data plane:** [ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane) decides upstream Envoy configured only over xDS. Mirror the pinned Envoy image your chart references, in addition to the STOA images listed below. The Link xDS server is decided but not yet implemented (ADR-073 §7).
:::

Names below are placeholders (`registry.example.com`, `stoa` namespace). No real hostnames, IP addresses, or credentials appear in this document.

## 1. What “offline” means here

| Phase | Network | Who |
|-------|---------|-----|
| Prepare the bundle | Connected machine (build or bastion with registry pull rights) | Operator |
| Transfer | Removable media, approved file transfer, or a one-way diode — **no** live pull from the public Internet on the target site | Operator |
| Install and run | Target site with **no** required outbound Internet ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first), [ADR-073 Mitigations](../architecture/adr/adr-073-adopt-envoy-data-plane)) | Operator |

If the site can pull from a private registry that itself is fed by a controlled mirror pipeline, reuse the same image list and Helm overrides; the transfer step becomes “promote through the mirror” instead of “copy media”.

## 2. Inputs you need before starting

- Kubernetes cluster meeting [Deployment Prerequisites](./prerequisites) (CPU/RAM, storage, DNS inside the site).
- An on-site OCI registry reachable from the cluster (`registry.example.com` in the examples).
- Helm 3 and a kubeconfig for the target cluster (used only on the install workstation).
- A written list of **pinned** image references (tag or digest) matching the STOA release you install — do **not** use floating `latest` for an offline cut.
- Chart version / OCI chart reference matching that release.

Record the release identifier (git tag or chart version) on the transfer checklist so the install can be reproduced.

## 3. Prepare the mirror bundle (connected machine)

### 3.1 Image list (STOA components)

The images published for STOA include at least:

| Component | Example public reference (prep only) |
|-----------|--------------------------------------|
| Control Plane API | `ghcr.io/stoa-platform/control-plane-api:<pin>` |
| Control Plane UI | `ghcr.io/stoa-platform/control-plane-ui:<pin>` |
| Portal | `ghcr.io/stoa-platform/portal:<pin>` |
| STOA Gateway (current data plane, maintenance) | `ghcr.io/stoa-platform/stoa-gateway:<pin>` |
| Keycloak (STOA build) | `ghcr.io/stoa-platform/keycloak:<pin>` |
| Upstream Envoy (target data plane, ADR-073) | Pin from the chart / release notes — **[confirm digest in the release you install]** |

Replace `<pin>` with the semver tag or digest from the release notes. Pulling `latest` is acceptable only on the connected prep machine if you immediately retag to an immutable pin before transfer.

### 3.2 Pull, retag, and save

```bash
# Connected prep machine — example pins; replace with your release pins
REG_PUBLIC=ghcr.io/stoa-platform
REG_SITE=registry.example.com/stoa
PIN=1.2.3   # example only

for img in control-plane-api control-plane-ui portal stoa-gateway keycloak; do
  docker pull "${REG_PUBLIC}/${img}:${PIN}"
  docker tag  "${REG_PUBLIC}/${img}:${PIN}" "${REG_SITE}/${img}:${PIN}"
  docker save -o "${img}-${PIN}.tar" "${REG_SITE}/${img}:${PIN}"
done

# Envoy: pull the exact reference required by your chart, then:
# docker tag <envoy-ref> ${REG_SITE}/envoy:${PIN}
# docker save -o envoy-${PIN}.tar ${REG_SITE}/envoy:${PIN}
```

Also save the Helm chart archive (or an `helm pull` OCI artifact) for the same release:

```bash
helm pull oci://ghcr.io/stoa-platform/charts/stoa-platform --version "${PIN}" --destination ./charts
```

If your release ships a checksums file, keep it next to the tarballs. If it does not, compute SHA-256 yourself and store the sums on the transfer media:

```bash
shasum -a 256 *.tar charts/*.tgz > SHA256SUMS
```

### 3.3 Bundle layout (suggested)

```text
stoa-offline-${PIN}/
  SHA256SUMS
  charts/stoa-platform-${PIN}.tgz
  images/control-plane-api-${PIN}.tar
  images/control-plane-ui-${PIN}.tar
  images/portal-${PIN}.tar
  images/stoa-gateway-${PIN}.tar
  images/keycloak-${PIN}.tar
  images/envoy-${PIN}.tar          # when required by the chart
  values-offline-example.yaml      # registry overrides only — no secrets
```

## 4. Transfer and load on site

1. Copy `stoa-offline-${PIN}/` to the site with the approved transfer path.
2. On a workstation that can reach `registry.example.com` and the cluster:

```bash
cd stoa-offline-${PIN}
shasum -a 256 -c SHA256SUMS

for f in images/*.tar; do
  docker load -i "$f"
done

# Push each loaded image to the on-site registry (auth is site-local — not documented here)
for img in control-plane-api control-plane-ui portal stoa-gateway keycloak; do
  docker push "registry.example.com/stoa/${img}:${PIN}"
done
# docker push registry.example.com/stoa/envoy:${PIN}   # when applicable
```

3. Create the image-pull secret in the target namespace with the site registry credentials (operator-managed secret; never commit it).

## 5. Install with Helm (no outbound pulls)

Minimal values (registry only — complete the rest from [Prerequisites](./prerequisites) and your site policy):

```yaml
# values-offline-example.yaml — placeholders only
global:
  imageRegistry: registry.example.com/stoa
  imagePullSecrets:
    - name: site-registry-pull

# Pin each component to the same PIN you mirrored.
# Exact keys follow the chart of the release you install — verify against that chart's values schema.
```

```bash
kubectl create namespace stoa --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install stoa ./charts/stoa-platform-${PIN}.tgz \
  --namespace stoa \
  --values values-offline-example.yaml
```

Do **not** point `imageRegistry` at a public host on an offline site. If a subchart still references an external image, mirror that image too or disable the subchart per the chart documentation for that release.

## 6. Verification checklist (no Internet required)

Run these on site. Every step should succeed without outbound access.

- [ ] `shasum -a 256 -c SHA256SUMS` matched before load.
- [ ] `kubectl -n stoa get pods` shows the expected workloads Ready (names depend on the chart).
- [ ] Images on running pods resolve under `registry.example.com/stoa/…:${PIN}` (or your chosen registry), not a public registry.
- [ ] Control Plane API health endpoint responds on the in-cluster or ingress URL you configured.
- [ ] No Installation or runtime configuration requires calling hosts outside the site perimeter ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first)).
- [ ] Envoy (or current gateway) admin interface remains on loopback only ([ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane)).

If a pod stays `ImagePullBackOff`, fix the registry mirror or pull secret — do not open temporary Internet access as a workaround without a recorded exception.

## 7. Related pages

| Topic | Page |
|-------|------|
| Sovereign topology and isolation | [Sovereign Deployment](./sovereign) |
| Ports, DNS, sizing, short private-registry note | [Deployment Prerequisites](./prerequisites) |
| Sovereign-first modes | [ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first) |
| Envoy data plane and offline JWKS / image mirroring | [ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane) |
