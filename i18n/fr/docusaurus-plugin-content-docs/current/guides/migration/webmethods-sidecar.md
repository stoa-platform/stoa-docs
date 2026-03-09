---
sidebar_label: WebMethods + Sidecar STOA
title: "WebMethods + Sidecar STOA"
description: "Déployez Software AG webMethods API Gateway avec le sidecar STOA pour l'application des politiques, la limitation de débit et le métering d'utilisation."
keywords: [webMethods, sidecar, migration, Software AG, API gateway]
---

# Intégration WebMethods Gateway + Sidecar STOA

Ce guide explique comment déployer Software AG webMethods API Gateway avec le sidecar STOA pour l'application des politiques, la limitation de débit et le métering d'utilisation.

:::info Référence ADR
Cette intégration utilise [ADR-036 : Auto-enregistrement des Gateways](../../architecture/adr/adr-036-gateway-auto-registration.md) et [ADR-035 : Pattern Adaptateur Gateway](../../architecture/adr/adr-035-gateway-adapter-pattern.md).
:::

## Vue d'Ensemble de l'Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Pod                           │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │   webMethods API     │    │      STOA Sidecar             │  │
│  │      Gateway         │    │    (sidecar mode)             │  │
│  │                      │    │                               │  │
│  │  ┌────────────────┐  │    │  ┌─────────────────────────┐  │  │
│  │  │   ext_authz    │──┼────┼──│  /authz endpoint       │  │  │
│  │  │   filter       │  │    │  │  - OPA policies        │  │  │
│  │  └────────────────┘  │    │  │  - Rate limiting       │  │  │
│  │                      │    │  │  - Token validation    │  │  │
│  │  Port: 9072          │    │  └─────────────────────────┘  │  │
│  │  (API traffic)       │    │                               │  │
│  └──────────────────────┘    │  Port: 8081                   │  │
│                              │  (internal only)              │  │
│                              │                               │  │
│                              │  ┌─────────────────────────┐  │  │
│                              │  │  Auto-registration      │  │  │
│                              │  │  → Control Plane        │  │  │
│                              │  └─────────────────────────┘  │  │
│                              └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Prérequis

1. STOA Control Plane déployé et accessible
2. Realm Keycloak `stoa` configuré
3. Clés API Gateway configurées dans le Control Plane (voir le [Guide d'Auto-enregistrement des Gateways](../gateway-auto-registration.md))

## Déploiement

### 1. Créer les Secrets

```bash
kubectl create secret generic stoa-sidecar-secrets \
  --namespace stoa-system \
  --from-literal=control-plane-api-key="gw_your_api_key_here" \
  --from-literal=keycloak-client-secret="your_keycloak_secret"
```

### 2. Configurer les Valeurs Helm

Créez un fichier `values-webmethods.yaml` :

```yaml
stoaSidecar:
  enabled: true
  targetGateway: webmethods

  # STOA Sidecar configuration
  image:
    repository: 848853684735.dkr.ecr.eu-west-1.amazonaws.com/apim/stoa-gateway
    tag: latest

  environment: prod
  controlPlaneUrl: "https://api.<YOUR_DOMAIN>"
  keycloakUrl: "https://auth.<YOUR_DOMAIN>"
  keycloakRealm: stoa
  keycloakClientId: stoa-sidecar
  secretName: stoa-sidecar-secrets

  # webMethods Gateway configuration
  mainGateway:
    enabled: true
    image:
      repository: softwareag/webmethods-api-gateway
      tag: "10.15"
    port: 9072
    env:
      - name: JAVA_OPTS
        value: "-Xms1g -Xmx2g"
      - name: SAG_IS_LICENSE_KEY
        valueFrom:
          secretKeyRef:
            name: webmethods-license
            key: license-key
      # Enable ext_authz to point to STOA sidecar
      - name: apigw_ext_authz_enabled
        value: "true"
      - name: apigw_ext_authz_url
        value: "http://127.0.0.1:8081/authz"
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 4000m
        memory: 8Gi
```

### 3. Déployer

```bash
helm upgrade --install stoa-webmethods ./charts/stoa-platform \
  --namespace stoa-system \
  --values values-webmethods.yaml
```

## Fonctionnement

### 1. Auto-enregistrement

Au démarrage du pod, le sidecar STOA s'enregistre automatiquement auprès du Control Plane :

```json
POST /v1/internal/gateways/register
{
  "hostname": "webmethods-with-stoa-sidecar-xyz",
  "mode": "sidecar",
  "version": "0.1.0",
  "environment": "prod",
  "capabilities": ["ext_authz", "rate_limiting", "metering", "oidc"],
  "admin_url": "http://10.0.1.50:8081"
}
```

### 2. Flux de Requête

1. **Client** → webMethods Gateway (port 9072)
2. webMethods → **ext_authz** → sidecar STOA (port 8081)
3. Le sidecar STOA évalue :
   - Les politiques OPA (chargées depuis le Control Plane)
   - Les limites de débit (par tenant/API/utilisateur)
   - La validation du token JWT (via Keycloak)
4. **Décision** retournée à webMethods (autoriser/refuser)
5. Si autorisé, webMethods → **API Backend**
6. Sidecar STOA → **Kafka** (métriques d'utilisation)

### 3. Heartbeat

Le sidecar envoie des heartbeats toutes les 30 secondes :

```json
POST /v1/internal/gateways/{gateway_id}/heartbeat
{
  "uptime_seconds": 3600,
  "routes_count": 0,
  "policies_count": 5,
  "requests_total": 10000,
  "error_rate": 0.01
}
```

## Monitoring

### Vue dans la Console

Le sidecar webMethods + STOA apparaît dans la Console STOA à `/gateways` :

| Nom | Type | Statut | Environnement |
|-----|------|--------|---------------|
| webmethods-prod-abc123 | stoa_sidecar | ONLINE | prod |

### Métriques Prometheus

Le sidecar expose les métriques Prometheus à `http://localhost:8081/metrics` :

```prometheus
stoa_sidecar_requests_total{tenant="acme",api="billing",status="allowed"} 9500
stoa_sidecar_requests_total{tenant="acme",api="billing",status="denied"} 500
stoa_sidecar_policy_evaluation_duration_seconds_bucket{le="0.01"} 9800
stoa_sidecar_rate_limit_hits_total{tenant="acme"} 150
```

## Politiques

### Créer une Politique de Limitation de Débit

```bash
curl -X POST ${STOA_API_URL}/v1/admin/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rate-limit-100rpm",
    "policy_type": "rate_limit",
    "scope": "api",
    "config": {
      "requests_per_minute": 100,
      "burst_size": 10
    },
    "priority": 100
  }'
```

### Associer une Politique à un Gateway

```bash
curl -X POST ${STOA_API_URL}/v1/admin/policies/bindings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "UUID_FROM_ABOVE",
    "gateway_instance_id": "UUID_OF_WEBMETHODS_SIDECAR"
  }'
```

## Dépannage

### Le Sidecar Ne S'enregistre Pas

Vérifiez les logs :
```bash
kubectl logs -n stoa-system deployment/webmethods-with-stoa-sidecar -c stoa-sidecar
```

Vérifiez que l'URL du Control Plane est accessible :
```bash
kubectl exec -n stoa-system deployment/webmethods-with-stoa-sidecar -c stoa-sidecar -- \
  curl -s http://control-plane-api.stoa-system.svc.cluster.local:8000/health
```

### Erreurs ext_authz

Vérifiez les logs webMethods pour les problèmes de connexion ext_authz :
```bash
kubectl logs -n stoa-system deployment/webmethods-with-stoa-sidecar -c webmethods
```

Testez directement l'endpoint ext_authz :
```bash
kubectl exec -n stoa-system deployment/webmethods-with-stoa-sidecar -c webmethods -- \
  curl -s http://127.0.0.1:8081/authz -X POST -H "Content-Type: application/json" -d '{}'
```

### Le Gateway Affiche OFFLINE

Si le gateway affiche OFFLINE dans la Console alors qu'il tourne :

1. Vérifiez que le heartbeat est bien envoyé :
   ```bash
   kubectl logs -n stoa-system deployment/webmethods-with-stoa-sidecar -c stoa-sidecar | grep heartbeat
   ```

2. Vérifiez la clé API du Control Plane :
   ```bash
   kubectl get secret stoa-sidecar-secrets -n stoa-system -o jsonpath='{.data.control-plane-api-key}' | base64 -d
   ```

3. Assurez-vous que la clé API figure dans la liste `GATEWAY_API_KEYS` de la configuration du Control Plane.

## Documentation Associée

- [Guide d'Auto-enregistrement des Gateways](../gateway-auto-registration.md) — Configuration complète de l'enregistrement
- [ADR-036 : Auto-enregistrement des Gateways](../../architecture/adr/adr-036-gateway-auto-registration.md) — Décision d'architecture
- [ADR-024 : Architecture Gateway Unifiée](../../architecture/adr/adr-024-gateway-unified-modes.md) — Modes gateway
- [Migration WebMethods vers STOA](./ibm-webmethods.md) — Guide de migration complet
