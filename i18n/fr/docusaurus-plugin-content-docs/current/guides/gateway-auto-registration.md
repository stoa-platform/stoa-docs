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
    │  (edge-mcp)     │              │ + Kong         │
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
export STOA_CONTROL_PLANE_URL="https://api.<YOUR_DOMAIN>"
export STOA_CONTROL_PLANE_API_KEY="<GATEWAY_API_KEY>"

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
  selector:
    matchLabels:
      app: kong-with-stoa-sidecar
  template:
    metadata:
      labels:
        app: kong-with-stoa-sidecar
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
          image: ghcr.io/stoa-platform/stoa-gateway:latest
          env:
            - name: STOA_GATEWAY_MODE
              value: "sidecar"
            - name: STOA_PORT
              value: "8081"
            - name: STOA_CONTROL_PLANE_URL
              value: "https://api.<YOUR_DOMAIN>"
            - name: STOA_CONTROL_PLANE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: stoa-sidecar-secrets
                  key: STOA_CONTROL_PLANE_API_KEY
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
  --from-literal=GATEWAY_API_KEYS="<GATEWAY_API_KEY>,<SECOND_GATEWAY_API_KEY>"
```

**Format des clés** : N'importe quelle chaîne, mais nous recommandons le format `gw_{environment}_{random}`.

**Rotation des clés** : Plusieurs clés sont supportées (séparées par des virgules). Ajoutez une nouvelle clé avant de supprimer l'ancienne.

### 2. Déployer le Plan de Contrôle avec les Clés

Patcher le déploiement du Plan de Contrôle :

```bash
kubectl patch deployment stoa-control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'
```

Le chart `stoa-platform` ne déploie pas l’API du Plan de Contrôle et ne propose pas de paramètre `controlPlane.env`. Configurez `GATEWAY_API_KEYS` dans votre déploiement existant du Plan de Contrôle.

## Référence de Configuration Gateway

### Variables d'Environnement

| Variable | Requis | Défaut | Description |
|----------|----------|---------|-------------|
| `STOA_CONTROL_PLANE_URL` | Oui | - | URL de l'API du Plan de Contrôle |
| `STOA_CONTROL_PLANE_API_KEY` | Oui | - | Secret partagé pour l'authentification |
| `STOA_GATEWAY_MODE` | Non | `edge-mcp` | Mode gateway : `edge-mcp`, `sidecar`, `proxy`, `shadow` |
| `STOA_ENVIRONMENT` | Non | `dev` | Identifiant d'environnement pour le regroupement |

Le commentaire du chart mentionne aussi `connect`, mais le runtime Rust ne l’accepte pas pour `STOA_GATEWAY_MODE`. Utilisez `edge-mcp`, `sidecar`, `proxy` ou `shadow` pour `stoaGateway.mode`.

Le gateway Rust s’enregistre avec `tenant_id: null` (à l’échelle de la plateforme) ; `STOA_TENANT_ID` n’est pas un paramètre pris en charge par le runtime et ne fournit pas d’isolation par tenant.

### Payload d'Enregistrement

Le gateway envoie ce payload au démarrage :

```json
{
  "hostname": "<GATEWAY_HOSTNAME>",
  "mode": "edge-mcp",
  "version": "0.1.0",
  "environment": "prod",
  "capabilities": ["rest", "mcp", "sse", "oidc", "rate_limiting"],
  "admin_url": "http://<GATEWAY_HOSTNAME>:8080",
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

La normalisation du mode supprime uniquement les traits de soulignement ; le trait d’union de `edge-mcp` est conservé.

| Nom d'Hôte | Mode | Environnement | Nom Dérivé |
|----------|------|-------------|--------------|
| `stoa-gw-abc123` | `edge-mcp` | `prod` | `stoa-gw-abc123-edge-mcp-prod` |
| `kong-sidecar-xyz` | `sidecar` | `staging` | `kong-sidecar-xyz-sidecar-staging` |

Cela permet :
- **Enregistrement idempotent** : Le même redémarrage du gateway met à jour plutôt que de dupliquer
- **Nommage clair** : Facile à identifier dans la Console
- **Filtrage par environnement** : Regrouper les gateways par environnement

## Configuration du Chart Helm

### STOA Gateway (Niveau 1)

Définissez `stoaGateway.secretName` sur un Secret Kubernetes existant. Pour l’alimenter depuis Vault, activez l’ExternalSecret optionnel ci-dessous ; cela nécessite External Secrets Operator et un `ClusterSecretStore` existant nommé `vault-backend` :

```yaml
# values.yaml
stoaGateway:
  enabled: true
  replicas: 2

  # Connexion au Plan de Contrôle
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:80"

  # Secret keys: STOA_CONTROL_PLANE_API_KEY, STOA_KEYCLOAK_CLIENT_SECRET
  # STOA_CONTROL_PLANE_API_KEY is required for auto-registration.
  # Without it, the gateway skips registration and runs in standalone mode.
  secretName: stoa-gateway-secrets

  # ExternalSecret (soutenu par Vault) — synchronise les secrets de Vault dans le Secret K8s
  externalSecret:
    enabled: true
    refreshInterval: 1h
    secretStoreRef: vault-backend
    vaultPath: "<VAULT_GATEWAY_PATH>"  # Must contain both STOA_* properties listed above
```

Le template de déploiement injecte le secret comme variable d'environnement :

```yaml
- name: STOA_CONTROL_PLANE_API_KEY
  valueFrom:
    secretKeyRef:
      name: stoa-gateway-secrets
      key: STOA_CONTROL_PLANE_API_KEY
      optional: true  # Gateway runs standalone if missing
```

:::caution Clé Vault Requise
Remplacez `<VAULT_GATEWAY_PATH>` par un chemin Vault contenant `STOA_CONTROL_PLANE_API_KEY` et `STOA_KEYCLOAK_CLIENT_SECRET`. L’ExternalSecret utilise ces noms exacts pour les propriétés Vault et les clés du Secret Kubernetes. Des propriétés manquantes empêchent la synchronisation du secret ; sans `STOA_CONTROL_PLANE_API_KEY`, le gateway ignore l’auto-enregistrement.
:::

### STOA Sidecar (Niveau 2)

Configuration complète dans `charts/stoa-platform/values.yaml` :

```yaml
stoaSidecar:
  enabled: true
  targetGateway: webmethods  # or kong, gravitee, agentgateway, apigee, aws_apigateway, azure_apim

  image:
    repository: ghcr.io/stoa-platform/stoa-gateway
    tag: latest

  replicas: 2
  environment: prod

  # Connexion au Plan de Contrôle
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:80"
  secretName: stoa-sidecar-secrets  # Must contain STOA_CONTROL_PLANE_API_KEY

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
| DEGRADED | Statut de l’instance signalé comme dégradé par le Plan de Contrôle | Badge de statut jaune |

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

Chaque heartbeat accepté définit le statut de l’instance sur `ONLINE`. Un taux d’erreur supérieur à 5% met en évidence la métrique du taux d’erreur dans le panneau de détail ; il ne définit pas le statut de l’instance sur `DEGRADED`.

## Sonde de Préparation Approfondie

L’endpoint `/ready` du gateway vérifie l’état requis des politiques, la connectivité au Plan de Contrôle lorsqu’il est configuré et l’accessibilité du fournisseur OIDC lorsque l’authentification est activée avant de signaler qu’il est prêt.

Si une vérification échoue, l'endpoint retourne `503 SERVICE UNAVAILABLE` avec un message descriptif :
- `NOT READY: Control Plane unreachable`
- `NOT READY: OIDC provider unreachable`

Cela empêche Kubernetes d'acheminer le trafic vers des gateways qui ne peuvent pas appliquer les politiques ou valider les tokens.

## Récupération de Configuration

Le Plan de Contrôle expose un endpoint de configuration pour les gateways enregistrés :

```
GET /v1/internal/gateways/{id}/config
Header: X-Gateway-Key: <GATEWAY_API_KEY>
```

La réponse inclut :
- **pending_deployments** — Déploiements d'API ciblant ce gateway
- **pending_policies** — Politiques de limitation de débit, contrôle d'accès et gouvernance

Le cycle d’enregistrement du gateway Rust enregistre l’instance et envoie des heartbeats. Il ne consulte pas automatiquement cet endpoint et n’applique pas les déploiements et politiques en attente qu’il retourne.

## Dépannage

### Gateway N'Apparaissant pas dans la Console

1. **Vérifiez les logs du gateway pour des erreurs d'enregistrement :**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-gateway | grep -i register
   ```

2. **Vérifiez que le Plan de Contrôle a les clés API configurées :**
   ```bash
   kubectl describe secret stoa-gateway-api-keys -n stoa-system
   ```

3. **Vérifiez les logs du Plan de Contrôle :**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-control-plane-api | grep -i gateway
   ```

4. **Testez l'endpoint d'enregistrement manuellement :**
   ```bash
   curl -X POST "${STOA_CONTROL_PLANE_URL}/v1/internal/gateways/register" \
     -H "X-Gateway-Key: <GATEWAY_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{
       "hostname": "<GATEWAY_HOSTNAME>",
       "mode": "edge-mcp",
       "version": "0.1.0",
       "environment": "dev",
       "capabilities": ["rest"],
       "admin_url": "http://<GATEWAY_HOSTNAME>:8080"
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
     curl --fail --silent --show-error http://stoa-control-plane-api.stoa-system.svc.cluster.local:80/health/live
   ```

### L'Enregistrement Retourne 503

**Cause** : `GATEWAY_API_KEYS` non configuré dans le Plan de Contrôle.

**Solution** :
```bash
kubectl create secret generic stoa-gateway-api-keys \
  --namespace stoa-system \
  --from-literal=GATEWAY_API_KEYS="<GATEWAY_API_KEY>"

kubectl patch deployment stoa-control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'

kubectl rollout status deployment/stoa-control-plane-api -n stoa-system
```

### L'Enregistrement Retourne 401

**Cause** : La clé API du gateway ne correspond à aucune clé dans `GATEWAY_API_KEYS`.

**Solution** : Vérifiez que le Secret contient `GATEWAY_API_KEYS`, puis comparez sa valeur avec le secret du gateway dans votre gestionnaire de secrets sans afficher aucune des deux valeurs :
```bash
kubectl describe secret stoa-gateway-api-keys -n stoa-system
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
