---
sidebar_position: 4
title: "Référence OpenAPI"
description: "API Control Plane STOA — référence OpenAPI 3.1 auto-générée, catégories d'endpoints, authentification et documentation interactive."
keywords:
  - OpenAPI
  - API reference
  - REST API
  - Swagger
  - endpoints
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Référence OpenAPI

L'API Control Plane est documentée en OpenAPI 3.1.0. La spécification est auto-générée à partir des définitions de routes FastAPI et maintenue à jour via CI.

## Documentation Interactive

L'API sert une documentation interactive à :

| Format | URL | Description |
|--------|-----|-------------|
| Swagger UI | `https://api.<YOUR_DOMAIN>/docs` | Explorateur d'API interactif |
| ReDoc | `https://api.<YOUR_DOMAIN>/redoc` | Documentation optimisée pour la lecture |
| OpenAPI JSON | `https://api.<YOUR_DOMAIN>/openapi.json` | Spécification brute |

## Catégories d'Endpoints

L'API organise les endpoints dans les groupes suivants :

| Catégorie | Préfixe | Endpoints | Description |
|-----------|---------|-----------|-------------|
| APIs | `/v1/apis` | CRUD + sync | Gestion du cycle de vie des APIs |
| Tenants | `/v1/tenants` | CRUD + membres | Gestion des tenants |
| Abonnements | `/v1/subscriptions` | CRUD + approuver/révoquer | Cycle de vie des abonnements |
| Consumers | `/v1/consumers` | CRUD + clés | Gestion des consumers |
| Gateways | `/v1/gateways` | CRUD + santé | Gestion des instances gateway |
| Déploiements | `/v1/deployments` | Lister + promouvoir | Suivi des déploiements |
| Environnements | `/v1/environments` | Lister | Gestion des environnements |
| Outils | `/v1/tools` | CRUD | Catalogue d'outils MCP |
| Webhooks | `/v1/tenants/{id}/webhooks` | CRUD + test | Notifications d'événements |
| Comptes de Service | `/v1/service-accounts` | CRUD + rotation | Authentification M2M |
| Santé | `/health` | GET | Vérification de santé de la plateforme |
| Métriques | `/metrics` | GET | Métriques Prometheus |

## Authentification

Tous les endpoints (sauf `/health` et `/openapi.json`) nécessitent un Bearer token :

<EnvSetup />

```bash
# Obtenir un token
TOKEN=$(curl -s -X POST "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=control-plane-api" \
  -d "username=admin" \
  -d "password=demo" \
  | jq -r '.access_token')

# Utiliser le token
curl -s "${STOA_API_URL}/v1/apis" \
  -H "Authorization: Bearer $TOKEN"
```

## Codes de Réponse Courants

| Code | Signification | Quand |
|------|--------------|-------|
| 200 | Succès | GET, PUT, PATCH |
| 201 | Créé | POST (nouvelle ressource) |
| 204 | Pas de Contenu | DELETE |
| 400 | Requête Incorrecte | Payload invalide |
| 401 | Non Autorisé | Token manquant ou invalide |
| 403 | Interdit | Permissions insuffisantes |
| 404 | Introuvable | La ressource n'existe pas |
| 409 | Conflit | Ressource en double |
| 422 | Non Traitable | Erreur de validation (avec détails) |
| 429 | Trop de Requêtes | Limite de débit dépassée |

## Format d'Erreur

Toutes les erreurs suivent un format cohérent :

```json
{
  "detail": "API not found",
  "status_code": 404,
  "error_code": "API_NOT_FOUND"
}
```

Les erreurs de validation (422) incluent des détails au niveau des champs :

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Pagination

Les endpoints de liste supportent la pagination :

```bash
curl "${STOA_API_URL}/v1/apis?skip=0&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

| Paramètre | Défaut | Max | Description |
|-----------|--------|-----|-------------|
| `skip` | 0 | -- | Nombre d'éléments à ignorer |
| `limit` | 20 | 100 | Nombre d'éléments à retourner |

## Télécharger la Spécification

```bash
# Télécharger la spécification OpenAPI complète
curl -s "${STOA_API_URL}/openapi.json" | jq '.' > openapi.json

# Compter les endpoints
cat openapi.json | jq '.paths | length'
```

La spécification peut être importée dans des outils tels que Postman, Insomnia ou tout client compatible OpenAPI.

## Tests Contrat

La spécification OpenAPI est validée en CI via des tests de snapshot :

```bash
# Générer et comparer (dans control-plane-api/)
pytest tests/test_openapi_contract.py -v
```

Tout changement d'endpoint qui modifie la spécification nécessite la mise à jour du snapshot.

## Voir Aussi

- [API Control Plane](/docs/api/control-plane) — Vue d'ensemble de l'API
- [API MCP Gateway](/docs/api/mcp-gateway) — Endpoints du gateway
- [API Admin Gateway](/docs/api/gateway-admin-api) — Endpoints admin
- [Authentification](/docs/guides/authentication) — Obtention de tokens
