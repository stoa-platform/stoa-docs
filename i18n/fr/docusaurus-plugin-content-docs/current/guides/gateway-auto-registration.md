---
sidebar_label: Enregistrement Automatique du Gateway
title: "Enregistrement Automatique du Gateway"
description: "Configurez les gateways STOA pour s'enregistrer automatiquement auprès du Plan de Contrôle au démarrage — zéro configuration manuelle."
keywords: [gateway, auto-registration, control plane, deployment, ADR-036]
---

# Guide d'Enregistrement Automatique du Gateway

Ce guide explique comment configurer et déployer les gateways STOA avec l'enregistrement automatique auprès du Plan de Contrôle.

:::info Référence ADR
Cette fonctionnalité est définie dans [ADR-036 : Enregistrement Automatique du Gateway](../architecture/adr/adr-036-gateway-auto-registration.md).
:::

## Vue d'Ensemble

Les gateways STOA peuvent s'enregistrer automatiquement auprès du Plan de Contrôle au démarrage, éliminant le besoin d'enregistrement manuel via des appels API. Cela offre une expérience "écosystème Apple" où les gateways apparaissent dans la Console en quelques secondes après le déploiement.

**Avantages clés :**
- Déploiement zéro configuration (2 variables d'environnement)
- Re-enregistrement automatique au redémarrage
- Visibilité de santé en temps réel via heartbeat
- Auto-guérison (la récupération du gateway est automatique)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Control Plane API                            │
│                                                                 │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Gateway Internal   │    │   Gateway Health Worker        │  │
│  │  /v1/internal/gateways   │   Marks stale gateways OFFLINE │  │
│  │  - /register        │    │   (90s timeout)                │  │
│  │  - /{id}/heartbeat  │    └────────────────────────────────┘  │
│  │  - /{id}/config     │                                        │
│  └─────────┬───────────┘                                        │
└────────────┼────────────────────────────────────────────────────┘
             │
             │ HTTPS (X-Gateway-Key header)
             │
    ┌────────┴────────┐              ┌────────────────┐
    │  STOA Gateway   │              │ STOA Sidecar   │
    │  (edge-mcp)     │              │ + Kong/Envoy   │
    │                 │              │                │
    │  1. Register    │              │  ext_authz     │
    │  2. Heartbeat   │              │  ↓             │
    │     (30s)       │              │  Policy/Meter  │
    └─────────────────┘              └────────────────┘
```

## Démarrage Rapide

### Niveau 1 : Gateway STOA Natif

Déployez un gateway STOA avec enregistrement automatique :

```bash
# Configuration minimale (2 variables d'environnement)
export STOA_CONTROL_PLANE_URL=https://api.<YOUR_DOMAIN>
export STOA_CONTROL_PLANE_API_KEY=gw_your_key_here

# Démarrer le gateway
./stoa-gateway
```

Le gateway va :
1. Dériver l'identité depuis le nom d'hôte + mode + environnement
2. Appeler `POST /v1/internal/gateways/register`
3. Démarrer la boucle heartbeat (toutes les 30 secondes)
4. Apparaître dans la Console à `/gateways`

### Niveau 2 : Mode Sidecar

Déployez STOA comme sidecar aux côtés d'un gateway tiers :

```yaml
# Exemple de déploiement Kubernetes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-with-stoa-sidecar
spec:
  template:
    spec:
      containers:
        # Gateway principal (Kong)
        - name: kong
          image: kong:3.5
          env:
            - name: KONG_PLUGINS
              value: "ext-authz"
            - name: KONG_EXT_AUTHZ_URL
              value: "http://localhost:8081/authz"
          ports:
            - containerPort: 8000

        # STOA sidecar
        - name: stoa-sidecar
          image: ghcr.io/stoa/stoa-gateway:latest
          env:
            - name: STOA_GATEWAY_MODE
              value: "sidecar"
            - name: STOA_CONTROL_PLANE_URL
              value: "https://api.<YOUR_DOMAIN>"
            - name: STOA_CONTROL_PLANE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: stoa-sidecar-secrets
                  key: control-plane-api-key
          ports:
            - containerPort: 8081  # endpoint ext_authz
```

## Configuration du Plan de Contrôle

### 1. Créer des Clés API Gateway

Configurez le Plan de Contrôle pour accepter les enregistrements de gateways :

```bash
# Créer un secret Kubernetes avec les clés API
kubectl create secret generic stoa-gateway-api-keys \
  --namespace stoa-system \
  --from-literal=GATEWAY_API_KEYS="gw_prod_key_abc123,gw_staging_key_xyz789"
```

**Format des clés** : N'importe quelle chaîne, mais nous recommandons le format `gw_{environment}_{random}`.

**Rotation des clés** : Plusieurs clés sont supportées (séparées par des virgules). Ajoutez une nouvelle clé avant de supprimer l'ancienne.

### 2. Déployer le Plan de Contrôle avec les Clés

Patcher le déploiement du Plan de Contrôle :

```bash
kubectl patch deployment control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'
```

Ou via Helm :

```yaml
# values.yaml
controlPlane:
  env:
    GATEWAY_API_KEYS:
      secretKeyRef:
        name: stoa-gateway-api-keys
        key: GATEWAY_API_KEYS
```

## Référence de Configuration Gateway

### Variables d'Environnement

| Variable | Requis | Défaut | Description |
|----------|----------|---------|-------------|
| `STOA_CONTROL_PLANE_URL` | Oui | - | URL de l'API du Plan de Contrôle |
| `STOA_CONTROL_PLANE_API_KEY` | Oui | - | Secret partagé pour l'authentification |
| `STOA_GATEWAY_MODE` | Non | `edge-mcp` | Mode gateway : `edge-mcp`, `sidecar`, `proxy`, `shadow` |
| `STOA_ENVIRONMENT` | Non | `dev` | Identifiant d'environnement pour le regroupement |
| `STOA_TENANT_ID` | Non | - | Restriction optionnelle au tenant |

### Payload d'Enregistrement

Le gateway envoie ce payload au démarrage :

```json
{
  "hostname": "stoa-gateway-7f8b9c",
  "mode": "edge-mcp",
  "version": "0.1.0",
  "environment": "prod",
  "capabilities": ["rest", "mcp", "sse", "oidc", "rate_limiting"],
  "admin_url": "http://10.0.1.50:8080",
  "tenant_id": null
}
```

### Payload Heartbeat

Toutes les 30 secondes :

```json
{
  "uptime_seconds": 3600,
  "routes_count": 15,
  "policies_count": 5,
  "requests_total": 10000,
  "error_rate": 0.01
}
```

## Dérivation d'Identité

L'identité du gateway est déterministe : `{hostname}-{mode_normalized}-{environment}`

| Nom d'Hôte | Mode | Environnement | Nom Dérivé |
|----------|------|-------------|--------------|
| `stoa-gw-abc123` | `edge-mcp` | `prod` | `stoa-gw-abc123-edgemcp-prod` |
| `kong-sidecar-xyz` | `sidecar` | `staging` | `kong-sidecar-xyz-sidecar-staging` |

Cela permet :
- **Enregistrement idempotent** : Le même redémarrage du gateway met à jour plutôt que de dupliquer
- **Nommage clair** : Facile à identifier dans la Console
- **Filtrage par environnement** : Regrouper les gateways par environnement

## Configuration du Chart Helm

### STOA Gateway (Niveau 1)

Le chart Helm gère le secret `STOA_CONTROL_PLANE_API_KEY` via un ExternalSecret soutenu par Vault :

```yaml
# values.yaml
stoaGateway:
  enabled: true
  replicas: 2

  # Connexion au Plan de Contrôle
  controlPlaneUrl: "http://control-plane-api.stoa-system.svc.cluster.local:8000"

  # Secret contenant CONTROL_PLANE_API_KEY, JWT_SECRET, KEYCLOAK_CLIENT_SECRET, ADMIN_API_TOKEN
  # CONTROL_PLANE_API_KEY est REQUIS pour l'auto-enregistrement.
  # Sans lui, le gateway passe l'enregistrement et s'exécute en mode autonome.
  secretName: stoa-gateway-secrets

  # ExternalSecret (soutenu par Vault) — synchronise les secrets de Vault dans le Secret K8s
  externalSecret:
    enabled: true
    refreshInterval: 1h
    secretStoreRef: vault-backend
    vaultPath: stoa/data/gateway  # Doit contenir control_plane_api_key
```

Le template de déploiement injecte le secret comme variable d'environnement :

```yaml
- name: STOA_CONTROL_PLANE_API_KEY
  valueFrom:
    secretKeyRef:
      name: stoa-gateway-secrets
      key: control-plane-api-key
      optional: true  # Le gateway s'exécute en mode autonome si absent
```

:::caution Clé Vault Requise
Le chemin Vault (`stoa/data/gateway`) doit contenir une propriété `control_plane_api_key`. Sans elle, l'ExternalSecret créera une clé vide et le gateway passera l'auto-enregistrement.
:::

### STOA Sidecar (Niveau 2)

Configuration complète dans `charts/stoa-platform/values.yaml` :

```yaml
stoaSidecar:
  enabled: true
  targetGateway: webmethods  # ou kong, envoy, apigee, generic

  image:
    repository: ghcr.io/stoa/stoa-gateway
    tag: latest

  replicas: 2
  environment: prod

  # Connexion au Plan de Contrôle
  controlPlaneUrl: "http://control-plane-api.stoa-system.svc.cluster.local:8000"
  secretName: stoa-sidecar-secrets  # Doit contenir control-plane-api-key

  # Keycloak OIDC (pour la validation des tokens)
  keycloakUrl: "https://auth.<YOUR_DOMAIN>"
  keycloakRealm: stoa
  keycloakClientId: stoa-sidecar

  # Application des politiques
  policyEnabled: true

  # Conteneur du gateway principal (s'exécute en parallèle)
  mainGateway:
    enabled: true
    image:
      repository: softwareag/webmethods-api-gateway
      tag: "10.15"
    port: 9072
    env:
      - name: EXT_AUTHZ_ENABLED
        value: "true"
```

## Console

Après l'enregistrement, les gateways apparaissent dans **Console > Gateways** avec une actualisation automatique toutes les 30 secondes (via TanStack React Query). Aucune actualisation manuelle nécessaire.

| Colonne | Description |
|--------|-------------|
| Nom | Nom d'instance dérivé |
| Type | `stoa`, `stoa_sidecar`, `webmethods`, etc. |
| Statut | `ONLINE`, `OFFLINE`, `DEGRADED` |
| Environnement | `dev`, `staging`, `prod` |
| Indicateur en Direct | Point vert pulsant si heartbeat reçu dans les 90s |
| Capacités | Badges de fonctionnalités |

### Indicateurs de Statut

| Statut | Signification | Visuel |
|--------|---------|--------|
| ONLINE | Heartbeat reçu dans les 90s | Point vert pulsant |
| OFFLINE | Pas de heartbeat depuis > 90s | Point gris |
| DEGRADED | En ligne mais taux d'erreur > 5% | Badge orange dans le panneau de détail |

### Panneau de Détail du Gateway

Cliquez sur une carte de gateway pour ouvrir le panneau de détail affichant les métriques de heartbeat :

| Métrique | Source | Exemple |
|--------|--------|---------|
| Disponibilité | `health_details.uptime_seconds` | `1h 30m` |
| Routes | `health_details.routes_count` | `15` |
| Politiques | `health_details.policies_count` | `5` |
| Requêtes | `health_details.requests_total` | `10 000` |
| Taux d'Erreur | `health_details.error_rate` | `2,0%` |
| Enregistré le | `health_details.registered_at` | `2026-02-06` |

Lorsque le taux d'erreur dépasse 5%, le panneau affiche un badge d'avertissement dégradé.

## Sonde de Préparation Approfondie

L'endpoint `/ready` du gateway effectue de véritables vérifications de dépendances avant de signaler la préparation :

1. **Connectivité au Plan de Contrôle** — HTTP GET vers `{STOA_CONTROL_PLANE_URL}/health` avec un timeout de 3 secondes
2. **Accessibilité du fournisseur OIDC** — Récupère la configuration OIDC depuis Keycloak (si l'auth est activée)

Si l'une ou l'autre vérification échoue, l'endpoint retourne `503 SERVICE UNAVAILABLE` avec un message descriptif :
- `NOT READY: Control Plane unreachable`
- `NOT READY: OIDC provider unreachable`

Cela empêche Kubernetes d'acheminer le trafic vers des gateways qui ne peuvent pas appliquer les politiques ou valider les tokens.

## Récupération de Configuration

Après l'enregistrement, les gateways récupèrent périodiquement leur configuration depuis le Plan de Contrôle :

```
GET /v1/internal/gateways/{id}/config
Header: X-Gateway-Key: gw_xxx
```

La réponse inclut :
- **pending_deployments** — Déploiements d'API ciblant ce gateway
- **pending_policies** — Politiques de limitation de débit, contrôle d'accès et gouvernance

Cela permet au Plan de Contrôle de pousser les modifications de configuration aux gateways sans nécessiter de redémarrage.

## Dépannage

### Gateway N'Apparaissant pas dans la Console

1. **Vérifiez les logs du gateway pour des erreurs d'enregistrement :**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-gateway | grep -i register
   ```

2. **Vérifiez que le Plan de Contrôle a les clés API configurées :**
   ```bash
   kubectl get secret stoa-gateway-api-keys -n stoa-system -o jsonpath='{.data.GATEWAY_API_KEYS}' | base64 -d
   ```

3. **Vérifiez les logs du Plan de Contrôle :**
   ```bash
   kubectl logs -n stoa-system deployment/control-plane-api | grep -i gateway
   ```

4. **Testez l'endpoint d'enregistrement manuellement :**
   ```bash
   curl -X POST ${STOA_API_URL}/v1/internal/gateways/register \
     -H "X-Gateway-Key: gw_your_key" \
     -H "Content-Type: application/json" \
     -d '{
       "hostname": "test-gateway",
       "mode": "edge-mcp",
       "version": "0.1.0",
       "environment": "dev",
       "capabilities": ["rest"],
       "admin_url": "http://localhost:8080"
     }'
   ```

### Gateway Affiche OFFLINE

1. **Vérifiez que le heartbeat est envoyé :**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-gateway | grep heartbeat
   ```

2. **Vérifiez la connectivité réseau au Plan de Contrôle :**
   ```bash
   kubectl exec -n stoa-system deployment/stoa-gateway -- \
     curl -s http://control-plane-api.stoa-system.svc.cluster.local:8000/health
   ```

### L'Enregistrement Retourne 503

**Cause** : `GATEWAY_API_KEYS` non configuré dans le Plan de Contrôle.

**Solution** :
```bash
kubectl create secret generic stoa-gateway-api-keys \
  --namespace stoa-system \
  --from-literal=GATEWAY_API_KEYS="gw_your_key_here"

kubectl patch deployment control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'

kubectl rollout status deployment/control-plane-api -n stoa-system
```

### L'Enregistrement Retourne 401

**Cause** : La clé API du gateway ne correspond à aucune clé dans `GATEWAY_API_KEYS`.

**Solution** : Vérifiez que la clé correspond :
```bash
kubectl get secret stoa-gateway-api-keys -n stoa-system \
  -o jsonpath='{.data.GATEWAY_API_KEYS}' | base64 -d
```

## Considérations de Sécurité

### Gestion des Clés API

- **Ne jamais committer les clés dans Git** : Utilisez les Secrets Kubernetes ou un gestionnaire de secrets externe
- **Utilisez des clés spécifiques à l'environnement** : Des clés différentes pour dev, staging, prod
- **Rotation périodique des clés** : Ajoutez une nouvelle clé → mettez à jour les gateways → supprimez l'ancienne clé
- **Auditez les enregistrements** : Vérifiez les logs du Plan de Contrôle pour des enregistrements inattendus

### Sécurité Réseau

- Les endpoints internes (`/v1/internal/*`) ne doivent PAS être exposés via un ingress public
- Utilisez les NetworkPolicies Kubernetes pour restreindre quels pods peuvent appeler l'API interne
- Considérez le mTLS pour les déploiements haute sécurité (amélioration future)

### Procédure de Rotation des Clés

1. Ajoutez une nouvelle clé au Plan de Contrôle (séparée par une virgule)
2. Redémarrez le Plan de Contrôle pour prendre en compte la nouvelle clé
3. Mettez à jour les gateways pour utiliser la nouvelle clé
4. Supprimez l'ancienne clé une fois tous les gateways mis à jour

## Documentation Associée

- [ADR-036 : Enregistrement Automatique du Gateway](../architecture/adr/adr-036-gateway-auto-registration.md) — Décision d'architecture
- [ADR-024 : Architecture Gateway Unifiée](../architecture/adr/adr-024-gateway-unified-modes.md) — Modes du gateway
- [ADR-035 : Pattern Adaptateur Gateway](../architecture/adr/adr-035-gateway-adapter-pattern.md) — Comment le CP orchestre les gateways
- [Intégration Sidecar WebMethods](./migration/webmethods-sidecar.md) — Guide spécifique pour WebMethods
