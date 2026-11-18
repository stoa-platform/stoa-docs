---
sidebar_position: 3
title: Installation hors ligne
description: Préparer et installer STOA sur un site sans accès Internet sortant — empaqueter le chart Helm depuis un checkout du dépôt, miroiter les images épinglées par digest vers un registre privé et vérifier hors ligne.
keywords: [déploiement, hors ligne, air-gapped, registre privé, helm, miroir, digest, souverain, sur site]
---

# Installation hors ligne

Cette page décrit une **procédure vérifiable** pour installer STOA lorsque le site cible ne doit ouvrir aucune connexion sortante vers Internet. Elle complète le [Déploiement souverain](/docs/deployment/sovereign) (topologie et isolation), les [Prérequis de déploiement](/docs/deployment/prerequisites) (ports, DNS, dimensionnement) et le [Guide d'installation](/docs/admin/installation). La plateforme publique hébergée a été arrêtée le 23 mai 2026 ; STOA s'installe sur l'infrastructure de l'opérateur ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first)).

:::info Périmètre de ce guide
- **Inclus :** empaquetage de `charts/stoa-platform` depuis un checkout vérifié de `stoa-platform/stoa` sur un poste connecté, mise en miroir des images épinglées par digest, transfert de l'archive, publication dans un registre OCI sur site, installation Helm du gateway face à ce registre et liste de contrôle post-installation sans Internet.
- **Périmètre du chart (`charts/stoa-platform` `v0.1.0`) :** déploie **uniquement le STOA Gateway Rust** (`stoa-gateway`), les 5 CRDs (`crds/*.yaml`) et des objets optionnels sidecar/sync/bootstrap/monitoring (`charts/stoa-observability` empaquette la télémétrie optionnelle). Control Plane API, Console, Portail Développeur, Keycloak (`quay.io/keycloak/keycloak`), PostgreSQL, Redpanda et OpenBao se déploient via des manifestes ou charts distincts et doivent être miroités en complément lors d'un déploiement complet sur site.
- **Plan de données ([ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) :** Envoy upstream est le plan de données cible. Sur `stoa` `main` (`639e8b9a`), le serveur ADS mTLS en boucle locale (`STOA_GATEWAY_TYPE=envoy` dans `stoa-connect`) et le service `ext_authz` gRPC Rust dans `stoa-gateway` existent dans le code, tandis que `charts/stoa-platform` déploie aujourd'hui le `stoa-gateway` Rust (le packaging Helm Envoy et la bascule complète restent en cours).
- **Hors périmètre :** choix du produit de registre OCI, terminaison TLS en bordure de site et opérations jour-2 ([maintenance](/docs/admin/maintenance), [rotation des secrets](/docs/admin/secret-rotation), [réponse à incident](/docs/admin/incident-response)).
:::

Les noms utilisés ci-dessous sont des valeurs génériques (`registry.example.com`, namespace `stoa-system`). Aucun nom d'hôte réel, adresse IP ou secret ne figure dans ce document.

## 1. Définition du mode « hors ligne »

| Phase | Réseau | Acteur |
|-------|--------|--------|
| Préparation du bundle | Poste connecté (machine de build ou bastion autorisé à cloner GitHub et tirer les images, avec Git, Helm 3.12+, Docker / Skopeo) | Opérateur |
| Transfert | Support amovible, transfert de fichiers homologué ou diode unidirectionnelle — **aucun** tirage direct depuis Internet sur le site cible | Opérateur |
| Installation et exécution | Site cible **sans** accès Internet sortant requis ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first), [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) | Opérateur |

Si le site tire ses artefacts depuis un registre interne alimenté par une chaîne de miroir contrôlée, réutilisez la même liste d'images épinglées par digest et les mêmes surcharges Helm ; l'étape de transfert devient une promotion dans le miroir.

## 2. Éléments requis avant de commencer

- Un cluster Kubernetes 1.28+ conforme aux [Prérequis de déploiement](/docs/deployment/prerequisites) (CPU/RAM, stockage, DNS interne).
- Un registre OCI sur site joignable depuis les nœuds du cluster (`registry.example.com` dans les exemples).
- Helm 3.12+ et `kubectl` configurés pour le cluster cible sur le poste d'installation.
- Un SHA de commit ou tag vérifié de [`stoa-platform/stoa`](https://github.com/stoa-platform/stoa) (aucun dépôt Helm public `charts.gostoa.dev`, artefact OCI `oci://ghcr.io/stoa-platform/charts/...` ni archive GitHub Release `helm-v*` n'est publié aujourd'hui — construisez toujours l'archive du chart depuis le checkout du dépôt).
- Une liste écrite de **digests immuables `@sha256:<64-hex>`** — `charts/stoa-platform/templates/_helpers.tpl` (`stoa-platform.pinnedImage`) **refuse** tout digest absent ou non SHA-256 et ignore `image.tag`.

## 3. Préparer le bundle miroir (poste connecté)

### 3.1 Liste des images

Miroitez `stoa-gateway` pour `charts/stoa-platform`, ainsi que les images Control Plane et d'infrastructure utilisées par vos manifestes séparés :

| Composant | Référence publique source | Utilisé par |
|-----------|---------------------------|-------------|
| STOA Gateway (Rust) | `ghcr.io/stoa-platform/stoa-gateway@sha256:<digest>` (défaut dans `charts/stoa-platform/values.yaml` : `sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e`) | `charts/stoa-platform` (`stoaGateway.image`) |
| Control Plane API | `ghcr.io/stoa-platform/control-plane-api@sha256:<digest>` | Manifeste Control Plane séparé |
| Console UI | `ghcr.io/stoa-platform/control-plane-ui@sha256:<digest>` | Manifeste Control Plane séparé |
| Portail Développeur | `ghcr.io/stoa-platform/portal@sha256:<digest>` | Manifeste Control Plane séparé |
| Keycloak 26 | `quay.io/keycloak/keycloak@sha256:<digest>` | Manifeste IAM séparé (realm `stoa`) |
| PostgreSQL 16 | `docker.io/library/postgres@sha256:<digest>` | Manifeste base de données séparé |
| Images des Jobs optionnels du chart | `curlimages/curl@sha256:...` (`gatewaySync.image`), `python@sha256:...` (`stoa.bootstrap.firstAdmin.image`), `postgres@sha256:...` (`vault.credentialsCheck.image`) | Uniquement si ces options sont activées |

### 3.2 Empaqueter le chart Helm depuis le checkout et sauvegarder les images

```bash
# Poste connecté de préparation
STOA_REF="639e8b9a2217695cfc2f590e246ed9d4ce4d4913"   # SHA main stoa vérifié
BUNDLE_DIR="$PWD/stoa-offline-${STOA_REF:0:8}"
mkdir -p "${BUNDLE_DIR}/charts" "${BUNDLE_DIR}/crds" "${BUNDLE_DIR}/images"

# 1. Cloner stoa et empaqueter charts/stoa-platform en archive .tgz
git clone https://github.com/stoa-platform/stoa.git
cd stoa
git checkout "${STOA_REF}"

helm lint ./charts/stoa-platform
helm package ./charts/stoa-platform --destination "${BUNDLE_DIR}/charts"
cp ./charts/stoa-platform/crds/*.yaml "${BUNDLE_DIR}/crds/"
cd ..
```

Tirez les images par digest immuable et exportez une **archive Docker** (`.tar`) via `docker save` (si vous copiez plutôt avec `skopeo`, utilisez `skopeo copy --preserve-digests` — avec `--all` pour un index multi-architecture — sachant que `skopeo` échoue explicitement si une conversion de format modifierait le digest ; avec `docker pull` / `docker save` / `docker push`, relevez le digest affiché par `docker push` ou lu directement sur le registre du site) :

```bash
GW_DIGEST="sha256:0ea4741d3b83c4de5f5f221a42969e4afbee17ed1d66d40fb92500d77dce991e"

docker pull --platform linux/amd64 "ghcr.io/stoa-platform/stoa-gateway@${GW_DIGEST}"
docker tag  "ghcr.io/stoa-platform/stoa-gateway@${GW_DIGEST}" \
  "registry.example.com/stoa/stoa-gateway:0.9.25"
docker save -o "${BUNDLE_DIR}/images/stoa-gateway.tar" \
  "registry.example.com/stoa/stoa-gateway:0.9.25"

# Répéter pour control-plane-api, control-plane-ui, portal, keycloak, postgres
# et toute image de Job optionnel activée.

(cd "${BUNDLE_DIR}" && shasum -a 256 charts/*.tgz crds/*.yaml images/*.tar > SHA256SUMS)
```

### 3.3 Arborescence du bundle

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
    ...                              # archives additionnelles Control Plane / infra
  values-offline-example.yaml        # surcharges hors secrets uniquement
```

## 4. Transférer et charger sur site

1. Copiez `stoa-offline-639e8b9a/` via le canal de transfert homologué.
2. Depuis un poste d'administration joignant `registry.example.com` et l'API Kubernetes :

```bash
cd stoa-offline-639e8b9a
shasum -a 256 -c SHA256SUMS

for f in images/*.tar; do
  docker load -i "$f"
done

docker push registry.example.com/stoa/stoa-gateway:0.9.25
# Relever la ligne `digest: sha256:<SITE_GW_DIGEST>` affichée par `docker push`, ou filtrer `.RepoDigests`
# explicitement sur `registry.example.com/` (`.RepoDigests[0]` peut encore désigner `ghcr.io`) :
docker inspect --format='{{range .RepoDigests}}{{println .}}{{end}}' \
  registry.example.com/stoa/stoa-gateway:0.9.25 | grep '^registry\.example\.com/'
# Exemple : registry.example.com/stoa/stoa-gateway@sha256:<SITE_GW_DIGEST>
```

3. Créez le namespace, le secret d'authentification au registre privé, puis attachez `imagePullSecrets` au `ServiceAccount` utilisé par `stoa-gateway` (`charts/stoa-platform` ne lit **ni** `global.imageRegistry` **ni** `global.imagePullSecrets` ; lorsque `stoaGateway.k8s.enabled` vaut `false` par défaut, `templates/stoa-gateway-deployment.yaml` utilise `stoaGateway.serviceAccount` — `"default"` par défaut, remplacé par `stoa-gateway-sa` ci-dessous — tandis que `stoaGateway.k8s.enabled: true` fige `serviceAccountName: stoa-gateway`, auquel cas patchez `stoa-gateway`) :

```bash
kubectl create namespace stoa-system --dry-run=client -o yaml | kubectl apply -f -

# Créer le Secret site-registry-pull avec les identifiants locaux (ne jamais commiter de secret),
# puis l'attacher à un ServiceAccount dédié :
kubectl create serviceaccount stoa-gateway-sa -n stoa-system --dry-run=client -o yaml | kubectl apply -f -
kubectl patch serviceaccount stoa-gateway-sa -n stoa-system \
  -p '{"imagePullSecrets": [{"name": "site-registry-pull"}]}'
```

## 5. Installer avec Helm depuis l'archive locale (sans tirage externe)

Le helper `stoa-platform.pinnedImage` (`charts/stoa-platform/templates/_helpers.tpl`) génère `image: "<repository>@<digest>"` : renseignez **à la fois** `stoaGateway.image.repository` et `stoaGateway.image.digest` vers votre registre sur site, et désactivez les hooks/moniteurs optionnels dont les images externes ou opérateurs ne sont pas présents :

```yaml
# values-offline-example.yaml — placeholders uniquement, aucun secret
stoa:
  domain: "internal.example.com"
  bootstrap:
    enabled: false

stoaGateway:
  enabled: true
  serviceAccount: stoa-gateway-sa
  image:
    repository: registry.example.com/stoa/stoa-gateway
    digest: "sha256:<64_CARACTERES_HEX_MINUSCULES_DU_REGISTRE_SITE>"
    pullPolicy: IfNotPresent
  controlPlaneUrl: "https://api.internal.example.com"
  keycloakUrl: "https://auth.internal.example.com"
  secretName: stoa-gateway-secrets
  # Requis lorsque controlPlaneUrl est défini pour satisfaire /ready après chargement des politiques signées (ADR-070 §4) :
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

:::warning Monter le Secret de clé `private_key_jwt` avant d'attendre `1/1 Ready`
`values-offline-example.yaml` seul ne suffit **pas** à amener les pods à `1/1 Ready` (`/health` teste uniquement la vivacité du processus, tandis que `/ready` vérifie `policyBootTenants` et la fraîcheur des permissions d'outils signées). Au commit `639e8b9a`, `charts/stoa-platform` ne monte que les volumes `tmp` (`emptyDir`) et `stoa-gateway-policies` (`ConfigMap`) — aucun volume de Secret n'est monté via `secretName` ou `extraEnv`. Montez le Secret contenant la clé de signature `private_key_jwt` (`STOA_KEYCLOAK_CLIENT_KEY_PATH`, plus `STOA_KEYCLOAK_CLIENT_KEY_ID` via `extraEnv`) au moyen d'un overlay Deployment, d'un patch Kustomize ou d'un `--post-renderer` Helm comme documenté dans [Politiques au Démarrage et Readiness](/docs/admin/installation#politiques-au-démarrage-et-readiness).
:::

Installez depuis l'archive `.tgz` locale en passant l'exécutable post-renderer préparé sur site (`./site-post-render.sh`, ou votre étape d'overlay Deployment Kustomize/GitOps) afin de monter le volume du Secret `private_key_jwt` avant de contrôler `Ready` (Helm installe les CRDs absents depuis le dossier `crds/` de l'archive lors de l'installation initiale ; lors d'une mise à jour, appliquez d'abord `crds/*.yaml` manuellement) :

```bash
# ./site-post-render.sh est l'exécutable post-renderer préparé sur site qui monte le volume du Secret private_key_jwt
helm upgrade --install stoa-platform ./charts/stoa-platform-0.1.0.tgz \
  --namespace stoa-system \
  --values values-offline-example.yaml \
  --post-renderer ./site-post-render.sh
```

Ne laissez **jamais** `stoaGateway.image.repository` pointer vers `ghcr.io` sur un site isolé. Si vous activez `gatewaySync`, `stoa.bootstrap.firstAdmin`, `vault.credentialsCheck` ou `stoaSidecar`, miroitez également leurs images et surchargez chaque clé `image` (`<repo>@sha256:<digest>` ou `{repository, digest}`) dans `values-offline-example.yaml`.

## 6. Liste de contrôle de vérification (sans Internet)

Exécutez ces contrôles sur site. Chaque étape doit réussir sans accès Internet sortant :

- [ ] `shasum -a 256 -c SHA256SUMS` validé avant le chargement des archives.
- [ ] `kubectl get crd | grep gostoa.dev` liste les 5 CRDs (`gatewaybindings`, `gatewayinstances`, `skills`, `tools`, `toolsets`).
- [ ] `kubectl -n stoa-system get pods -l app.kubernetes.io/name=stoa-gateway -o jsonpath='{.items[*].spec.containers[*].image}'` pointe vers `registry.example.com/stoa/stoa-gateway@sha256:...` (jamais `ghcr.io`).
- [ ] `kubectl -n stoa-system get pods` affiche les pods `stoa-gateway` à `1/1 Ready` une fois l'overlay de montage du Secret `private_key_jwt` appliqué et le Control Plane sur site, Keycloak et les politiques signées de `policyBootTenants` chargés ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)).
- [ ] Aucun paramètre d'exécution n'appelle d'hôte hors du périmètre du site ([ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first)).

Si un pod reste en `ImagePullBackOff`, vérifiez le digest présent sur `registry.example.com` et le patch `imagePullSecrets` sur `stoa-gateway-sa` — n'ouvrez pas d'accès Internet temporaire sans dérogation de sécurité tracée.

## 7. Pages connexes

| Sujet | Page |
|-------|------|
| Valeurs du chart Helm gateway & readiness | [Guide d'installation](/docs/admin/installation) |
| Topologie souveraine et isolation | [Déploiement souverain](/docs/deployment/sovereign) |
| Ports, DNS, dimensionnement et registre privé | [Prérequis de déploiement](/docs/deployment/prerequisites) |
| Stratégie souveraineté en premier | [ADR-037](/docs/architecture/adr/adr-037-deployment-modes-sovereign-first) |
| Posture fail-closed du gateway (`policyBootTenants`) | [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) |
| Plan de données Envoy et miroir JWKS / images hors ligne | [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane) |
