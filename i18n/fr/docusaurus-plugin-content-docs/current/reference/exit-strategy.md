---
sidebar_position: 13
title: "Stratégie de Sortie"
description: "Stratégie de sortie de STOA Platform — export de données, procédures de migration, indépendance vis-à-vis des fournisseurs et garanties de réversibilité."
keywords:
  - exit strategy
  - data export
  - vendor lock-in
  - migration
  - portability
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Stratégie de Sortie

STOA Platform est conçue pour zéro vendor lock-in. Toutes les données sont exportables, toutes les configurations sont portables, et la plateforme utilise des standards ouverts de bout en bout.

## Principes

| Principe | Implémentation |
|-----------|---------------|
| **Standards ouverts** | OpenAPI 3.x, OAuth2/OIDC, protocole MCP, métriques Prometheus |
| **Open source** | Licence Apache 2.0 — fork libre |
| **Stockage standard** | PostgreSQL (sans extensions propriétaires) |
| **Identité standard** | Keycloak (fournisseur OIDC standard) |
| **Configs portables** | Charts Helm, manifestes Kubernetes, CRDs |
| **Aucun format propriétaire** | Specs API en OpenAPI, politiques en JSON standard |

## Procédures d'Export de Données

### Spécifications API

Toutes les spécifications API sont stockées sous forme de documents OpenAPI standard :

<EnvSetup />

```bash
# Exporter toutes les APIs comme specs OpenAPI
for api_id in $(curl -s "${STOA_API_URL}/v1/apis" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[].id'); do
  curl -s "${STOA_API_URL}/v1/apis/$api_id" \
    -H "Authorization: Bearer $TOKEN" \
    | jq '.spec' > "api-${api_id}.json"
done
```

### Abonnements et Consumers

```bash
# Exporter les abonnements
curl -s "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.' > subscriptions-export.json

# Exporter les consumers
curl -s "${STOA_API_URL}/v1/consumers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.' > consumers-export.json
```

### Export Complet de la Base de Données

```bash
# Dump PostgreSQL (toutes les données STOA)
kubectl exec -n stoa-system deploy/postgres -- \
  pg_dump -U stoa -d stoa --format=custom --compress=9 \
  > stoa-full-export.dump

# Vérifier l'export
pg_restore --list stoa-full-export.dump | head -20
```

### Realm Keycloak

```bash
# Exporter le realm avec les utilisateurs
kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh export \
  --dir /tmp/export \
  --realm stoa \
  --users realm_file

kubectl cp stoa-system/keycloak-0:/tmp/export/ ./keycloak-export/
```

### Custom Resource Definitions

```bash
# Exporter toutes les CRDs STOA
for crd in tools toolsets gatewayinstances gatewaybindings; do
  kubectl get ${crd}.gostoa.dev -A -o yaml > ${crd}-export.yaml
done
```

### Tableaux de Bord Grafana

```bash
# Exporter les tableaux de bord via l'API
for uid in $(curl -s "${GRAFANA_URL}/api/search?type=dash-db" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" | jq -r '.[].uid'); do
  curl -s "${GRAFANA_URL}/api/dashboards/uid/$uid" \
    -H "Authorization: Bearer $GRAFANA_TOKEN" \
    | jq '.dashboard' > "dashboard-${uid}.json"
done
```

## Migration vers une Autre Plateforme

### Vers Kong

1. Exporter les specs API depuis STOA (format OpenAPI)
2. Importer dans Kong en utilisant `deck sync` avec les specs exportées
3. Recréer les consumers et clés API via l'Admin API Kong
4. Mettre à jour le DNS pour pointer vers le gateway Kong

### Vers Gravitee

1. Exporter les specs API depuis STOA
2. Importer via l'API de Gestion Gravitee (`POST /apis/import/swagger`)
3. Recréer les plans et abonnements
4. Mettre à jour le DNS

### Vers AWS API Gateway

1. Exporter les specs OpenAPI
2. Importer via la Console AWS ou la CLI (`aws apigateway import-rest-api`)
3. Recréer les plans d'utilisation et clés API
4. Mettre à jour le DNS vers l'endpoint API Gateway

### Checklist de Migration Générale

- [ ] Exporter toutes les spécifications API (OpenAPI)
- [ ] Exporter les abonnements et données des consumers
- [ ] Exporter le realm Keycloak (utilisateurs + clients)
- [ ] Exporter les instances CRD
- [ ] Exporter les tableaux de bord Grafana
- [ ] Dump PostgreSQL complet comme sauvegarde
- [ ] Importer dans la plateforme cible
- [ ] Vérifier que le routage API fonctionne
- [ ] Mettre à jour les enregistrements DNS
- [ ] Décommissionner les composants STOA

## Ce Qui Reste Standard

| Composant | Standard | Portable Vers |
|-----------|----------|-------------|
| Specs API | OpenAPI 3.x | N'importe quel API gateway |
| Auth | OAuth2 / OIDC | N'importe quel fournisseur OIDC |
| Utilisateurs | Export Keycloak | N'importe quelle instance Keycloak, ou LDAP |
| Métriques | Prometheus | N'importe quel système compatible Prometheus |
| Logs | JSON structuré | N'importe quel agrégateur de logs |
| Ressources K8s | Manifestes standard | N'importe quel cluster Kubernetes |
| Base de données | PostgreSQL | N'importe quelle instance PostgreSQL |

## Ce Qui Est Spécifique à STOA

| Composant | Portabilité |
|-----------|------------|
| CRDs STOA (Tool, ToolSet) | Exporter en YAML, recréer manuellement |
| Configuration adaptateur gateway | Stockée dans PostgreSQL, exportable en JSON |
| Configurations webhook | Exportables via API, recréer dans la cible |
| Piste d'audit (OpenSearch) | Index OpenSearch standard, exportables |
| Définitions de tools MCP | Exporter en JSON, adapter au format cible |

## Voir Aussi

- [Sauvegarde et Récupération](/docs/admin/backup-recovery) -- Procédures de sauvegarde
- [Guide d'Installation](/docs/admin/installation) -- Référence de déploiement
- [Référence de Configuration](/docs/reference/configuration) -- Variables d'environnement
