---
sidebar_position: 4
slug: /guides/hybrid-gateway-adapter
title: "Adaptateur Gateway Hybride — Apportez Votre Propre Gateway"
description: "Implémentez un adaptateur gateway personnalisé pour orchestrer n'importe quel API gateway via l'interface unifiée de STOA — intégration Kong, Apigee, webMethods, AWS API Gateway"
keywords: [STOA, gateway adapter, hybrid, bring your own gateway, API gateway, integration, guide]
---

# Adaptateur Gateway Hybride — Apportez Votre Propre Gateway

## Vue d'Ensemble

Le Gateway Adapter Pattern de STOA vous permet d'orchestrer **n'importe quel API gateway** via une interface unifiée et indépendante du gateway. Vos APIs, politiques, configuration OIDC et applications sont déclarées dans Git ; l'adaptateur les traduit en appels REST spécifiques au gateway lors du cycle de réconciliation GitOps.

```
Git (état souhaité) → ArgoCD → Control Plane API → Gateway Adapter → Votre Gateway
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  STOA Control Plane                  │
│              GitOps Reconciliation Engine             │
├──────────┬──────────┬──────────┬────────────────────┤
│ webMethods│  Kong    │  Apigee  │  AWS API Gateway   │
│ Adapter  │ Adapter  │ Adapter  │     Adapter        │
│    ✅    │   🔜    │   🔜    │       🔜           │
├──────────┴──────────┴──────────┴────────────────────┤
│          GatewayAdapterInterface (ABC)               │
│  health_check · sync_api · upsert_policy · ...       │
└─────────────────────────────────────────────────────┘
```

### Contrat d'Interface

Chaque adaptateur implémente `GatewayAdapterInterface`. Propriétés clés :

- **Idempotent** : Appeler la même opération deux fois produit le même résultat
- **Déclaratif** : Vous spécifiez l'état souhaité, l'adaptateur calcule le diff
- **Indépendant de l'auth** : Supporte le proxy OIDC (transfert JWT) et l'authentification Basic

### Cycle de Vie de la Réconciliation

```
PHASE 0:   health_check()         → Vérifier que le gateway est accessible
PHASE 1:   (chargement depuis Git)→ Lire les définitions tenant/API
PHASE 1.5: upsert_policy()        → Synchroniser les politiques (CORS, rate-limit, etc.)
PHASE 1.7: upsert_auth_server()   → Synchroniser OIDC (Keycloak, Okta, etc.)
PHASE 2:   list_apis()            → Récupérer l'état actuel du gateway
PHASE 3:   (calcul du diff)       → Comparer Git vs gateway
PHASE 4:   sync_api()             → Créer/mettre à jour/supprimer des APIs
PHASE 4.5: provision_application() → Synchroniser les applications OAuth
PHASE 5:   (visibilité portail)   → Publier/dépublier depuis le portail
PHASE 6:   apply_config()         → Configuration globale du gateway
PHASE 7:   export_archive()       → Sauvegarde de l'état du gateway
```

## Implémenter un Nouvel Adaptateur

### 1. Créer le module adaptateur

```
control-plane-api/src/adapters/
├── gateway_adapter_interface.py   # Ne pas modifier
├── __init__.py
├── webmethods/                    # Implémentation de référence
│   ├── adapter.py
│   └── mappers.py
└── kong/                          # Votre nouvel adaptateur
    ├── __init__.py
    ├── adapter.py
    └── mappers.py
```

### 2. Implémenter l'interface

```python
from ..gateway_adapter_interface import GatewayAdapterInterface, AdapterResult

class KongGatewayAdapter(GatewayAdapterInterface):
    async def health_check(self) -> AdapterResult:
        # GET /status sur Kong Admin API
        ...

    async def sync_api(self, api_spec: dict, tenant_id: str,
                       auth_token=None) -> AdapterResult:
        # POST /services + POST /routes sur Kong Admin API
        ...

    # ... implémenter toutes les méthodes abstraites
```

### 3. Enregistrer l'adaptateur

Dans `adapters/registry.py`, enregistrez la nouvelle classe d'adaptateur :

```python
from ..adapters.kong import KongGatewayAdapter

ADAPTER_REGISTRY = {
    "kong": KongGatewayAdapter,
    # ... autres adaptateurs
}
```

Le Control Plane API crée les adaptateurs via `AdapterRegistry.create(gateway_type)` — aucune orchestration externe n'est nécessaire.

## Gateways Supportés

| Gateway | Statut | Adaptateur | Notes |
|---------|--------|------------|-------|
| STOA Gateway (Rust) | ✅ Production | `adapters/stoa/` | Natif, en mémoire, MCP-first |
| Kong (DB-less) | ✅ Production | `adapters/kong/` | Rechargement déclaratif via `POST /config` |
| Gravitee (APIM v4) | ✅ Production | `adapters/gravitee/` | CRUD complet + gestion du cycle de vie |
| webMethods 10.x/11.x | ✅ Production | `adapters/webmethods/` | OIDC complet, aliases, sauvegarde |
| Apigee | 🔜 Prévu | — | — |
| AWS API Gateway | 🔜 Prévu | — | — |

## Configuration

### Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `WM_GATEWAY_URL` | `http://apim-gateway:5555` | URL admin webMethods |
| `WM_ADMIN_USER` | `Administrator` | Nom d'utilisateur admin (Basic Auth) |
| `WM_ADMIN_PASSWORD` | — | Mot de passe admin (Basic Auth) |
| `GATEWAY_USE_OIDC_PROXY` | `false` | Utiliser le mode proxy OIDC |
| `GATEWAY_ADMIN_PROXY_URL` | — | URL du proxy OIDC |

### Structure Git

```
webmethods/
├── aliases/
│   ├── dev.yaml
│   ├── staging.yaml
│   └── prod.yaml
├── policies/
│   ├── cors-platform.yaml
│   ├── rate-limit-default.yaml
│   └── logging-standard.yaml
├── oidc/
│   └── keycloak-auth-server.yaml
├── config/
│   └── gateway-config.yaml
└── applications/
    └── .gitkeep
```

## Développement Local

```bash
# Démarrer la plateforme STOA en local
docker compose up -d

# Vérifier la santé de l'adaptateur
curl ${STOA_API_URL}/v1/gateways

# Déclencher une synchronisation via le Control Plane API
curl -X POST ${STOA_API_URL}/v1/deployments/{id}/sync \
  -H "Authorization: Bearer $TOKEN"
```
