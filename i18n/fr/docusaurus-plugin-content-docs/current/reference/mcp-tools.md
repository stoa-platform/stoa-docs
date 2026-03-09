---
sidebar_position: 4
title: Référence des Tools MCP
description: "Référence complète des tools MCP de STOA Platform — découverte, catalogue, abonnements, observabilité et endpoints de tools de sécurité."
keywords: [MCP tools, API reference, tool discovery, AI agents, Model Context Protocol]
---

# Référence des Tools MCP

STOA expose les capacités de la plateforme sous forme de tools MCP que les agents AI peuvent découvrir et invoquer. Cette référence documente tous les tools intégrés.

## Catégories de Tools

| Catégorie | Tools | Description |
|----------|-------|-------------|
| Plateforme & Découverte | `stoa_platform_info`, `stoa_platform_health`, `stoa_tools` | Statut de la plateforme et découverte des tools |
| Catalogue API | `stoa_catalog`, `stoa_api_spec` | Parcourir et rechercher des APIs |
| Abonnements | `stoa_subscription` | Gérer l'accès aux APIs et les identifiants |
| Observabilité | `stoa_metrics`, `stoa_logs`, `stoa_alerts` | Surveiller l'utilisation et la santé des APIs |
| Contrats UAC | `stoa_uac` | Gestion du Contrat API Universel |
| Sécurité | `stoa_security` | Logs d'audit et permissions |

---

## Plateforme & Découverte

### stoa_platform_info

Obtenir la version, le statut et les fonctionnalités disponibles de la plateforme STOA.

```json
// Requête
{"name": "stoa_platform_info", "arguments": {}}

// Réponse
{
  "version": "0.9.0",
  "status": "healthy",
  "features": ["mcp-gateway", "uac", "multi-tenant"],
  "mcp_protocol_version": "2024-11-05"
}
```

### stoa_platform_health

Vérifier la santé de tous les composants de la plateforme.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `components` | string[] | Non | Composants spécifiques à vérifier (tous si vide) |

```json
// Requête
{"name": "stoa_platform_health", "arguments": {"components": ["gateway", "database"]}}

// Réponse
{
  "gateway": {"status": "healthy", "latency_ms": 12},
  "database": {"status": "healthy", "latency_ms": 8},
  "overall": "healthy"
}
```

### stoa_tools

Découverte des tools et récupération du schéma.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `list`, `schema`, ou `search` |
| `tool_name` | string | Pour `schema` | Nom du tool pour obtenir son schéma |
| `query` | string | Pour `search` | Requête de recherche |
| `category` | string | Non | Filtrer par catégorie |

```json
// Lister tous les tools
{"name": "stoa_tools", "arguments": {"action": "list", "category": "API Catalog"}}

// Obtenir le schéma d'un tool
{"name": "stoa_tools", "arguments": {"action": "schema", "tool_name": "stoa_catalog"}}

// Rechercher des tools
{"name": "stoa_tools", "arguments": {"action": "search", "query": "subscription"}}
```

---

## Catalogue API

### stoa_catalog

Parcourir, rechercher et gérer les APIs du catalogue.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `list`, `get`, `search`, `versions`, `categories` |
| `api_id` | string | Pour `get`, `versions` | Identifiant de l'API |
| `query` | string | Pour `search` | Requête de recherche |
| `status` | string | Non | Filtre : `active`, `deprecated`, `draft` |
| `tags` | string[] | Non | Filtrer par tags |
| `page` | integer | Non | Numéro de page (défaut : 1) |
| `page_size` | integer | Non | Résultats par page (défaut : 20) |

```json
// Lister les APIs actives
{"name": "stoa_catalog", "arguments": {"action": "list", "status": "active"}}

// Obtenir les détails d'une API
{"name": "stoa_catalog", "arguments": {"action": "get", "api_id": "billing-api-v2"}}

// Rechercher des APIs
{"name": "stoa_catalog", "arguments": {"action": "search", "query": "payment", "tags": ["finance"]}}

// Lister les versions d'une API
{"name": "stoa_catalog", "arguments": {"action": "versions", "api_id": "billing-api"}}

// Lister les catégories
{"name": "stoa_catalog", "arguments": {"action": "categories"}}
```

### stoa_api_spec

Récupérer les spécifications et la documentation d'une API.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `openapi`, `docs`, `endpoints` |
| `api_id` | string | Oui | Identifiant de l'API |
| `format` | string | Non | `json` ou `yaml` (défaut : json) |
| `version` | string | Non | Version de l'API (dernière si omis) |
| `section` | string | Non | Section de doc pour l'action `docs` |
| `method` | string | Non | Filtrer les endpoints par méthode HTTP |

```json
// Obtenir la spec OpenAPI
{"name": "stoa_api_spec", "arguments": {"action": "openapi", "api_id": "billing-api", "format": "yaml"}}

// Obtenir la documentation
{"name": "stoa_api_spec", "arguments": {"action": "docs", "api_id": "billing-api", "section": "authentication"}}

// Lister les endpoints
{"name": "stoa_api_spec", "arguments": {"action": "endpoints", "api_id": "billing-api", "method": "POST"}}
```

---

## Abonnements et Accès

### stoa_subscription

Gérer les abonnements aux APIs, les identifiants et leur cycle de vie.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `list`, `get`, `create`, `cancel`, `credentials`, `rotate_key` |
| `subscription_id` | string | Pour `get`, `cancel`, `credentials`, `rotate_key` | ID d'abonnement |
| `api_id` | string | Pour `create` | API à laquelle s'abonner |
| `plan` | string | Non | Plan d'abonnement |
| `reason` | string | Non | Raison de l'annulation |
| `grace_period_hours` | integer | Non | Heures de validité de l'ancienne clé (défaut : 24) |

```json
// Lister les abonnements
{"name": "stoa_subscription", "arguments": {"action": "list", "status": "active"}}

// S'abonner à une API
{"name": "stoa_subscription", "arguments": {"action": "create", "api_id": "billing-api", "plan": "standard"}}

// Obtenir les identifiants
{"name": "stoa_subscription", "arguments": {"action": "credentials", "subscription_id": "sub-123"}}

// Rotation de la clé API
{"name": "stoa_subscription", "arguments": {"action": "rotate_key", "subscription_id": "sub-123", "grace_period_hours": 48}}

// Annuler un abonnement
{"name": "stoa_subscription", "arguments": {"action": "cancel", "subscription_id": "sub-123", "reason": "Migration vers v2"}}
```

---

## Observabilité et Métriques

### stoa_metrics

Récupérer les métriques d'utilisation, de latence, d'erreurs et de quota des APIs.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `usage`, `latency`, `errors`, `quota` |
| `api_id` | string | Pour `usage`, `latency`, `errors` | Identifiant de l'API |
| `subscription_id` | string | Pour `quota` | ID d'abonnement |
| `time_range` | string | Non | `1h`, `24h`, `7d`, `30d`, `custom` |
| `endpoint` | string | Non | Endpoint spécifique pour la latence |

```json
// Obtenir les métriques d'utilisation
{"name": "stoa_metrics", "arguments": {"action": "usage", "api_id": "billing-api", "time_range": "24h"}}

// Obtenir les statistiques de latence (p50, p95, p99)
{"name": "stoa_metrics", "arguments": {"action": "latency", "api_id": "billing-api", "endpoint": "/invoices"}}

// Obtenir la répartition des erreurs
{"name": "stoa_metrics", "arguments": {"action": "errors", "api_id": "billing-api", "error_code": 500}}

// Vérifier l'utilisation du quota
{"name": "stoa_metrics", "arguments": {"action": "quota", "subscription_id": "sub-123"}}
```

### stoa_logs

Rechercher et récupérer les logs d'appels API.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `search`, `recent` |
| `api_id` | string | Non | Identifiant de l'API |
| `query` | string | Pour `search` | Syntaxe de requête Lucene |
| `level` | string | Non | `debug`, `info`, `warn`, `error` |
| `time_range` | string | Non | `1h`, `24h`, `7d` |
| `limit` | integer | Non | Résultats max (défaut : 100) |

```json
// Rechercher des logs d'erreur
{"name": "stoa_logs", "arguments": {"action": "search", "api_id": "billing-api", "query": "timeout", "level": "error"}}

// Obtenir les logs récents
{"name": "stoa_logs", "arguments": {"action": "recent", "api_id": "billing-api", "limit": 50}}
```

### stoa_alerts

Gérer les alertes et incidents API.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `list`, `acknowledge` |
| `alert_id` | string | Pour `acknowledge` | ID de l'alerte |
| `api_id` | string | Non | Filtrer par API |
| `severity` | string | Non | `info`, `warning`, `critical` |
| `status` | string | Non | `active`, `acknowledged`, `resolved` |
| `comment` | string | Non | Commentaire d'acquittement |

```json
// Lister les alertes critiques
{"name": "stoa_alerts", "arguments": {"action": "list", "severity": "critical", "status": "active"}}

// Acquitter une alerte
{"name": "stoa_alerts", "arguments": {"action": "acknowledge", "alert_id": "alert-123", "comment": "Analyse de la cause racine en cours"}}
```

---

## Contrats UAC

### stoa_uac

Gestion du Contrat API Universel.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `list`, `get`, `validate`, `sla` |
| `contract_id` | string | Pour `get`, `validate`, `sla` | ID du contrat |
| `api_id` | string | Non | Filtrer par API |
| `subscription_id` | string | Pour `validate` | Abonnement à valider |
| `status` | string | Non | `active`, `expired`, `pending` |
| `time_range` | string | Non | Pour les métriques SLA : `7d`, `30d`, `90d` |

```json
// Lister les contrats actifs
{"name": "stoa_uac", "arguments": {"action": "list", "api_id": "billing-api", "status": "active"}}

// Obtenir les détails d'un contrat
{"name": "stoa_uac", "arguments": {"action": "get", "contract_id": "uac-123"}}

// Valider la conformité
{"name": "stoa_uac", "arguments": {"action": "validate", "contract_id": "uac-123", "subscription_id": "sub-456"}}

// Obtenir les métriques SLA
{"name": "stoa_uac", "arguments": {"action": "sla", "contract_id": "uac-123", "time_range": "30d"}}
```

---

## Sécurité et Conformité

### stoa_security

Audit de sécurité et gestion des permissions.

| Paramètre | Type | Obligatoire | Description |
|-----------|------|----------|-------------|
| `action` | string | Oui | `audit_log`, `check_permissions`, `list_policies` |
| `api_id` | string | Non | Identifiant de l'API |
| `action_type` | string | Pour `check_permissions` | `read`, `write`, `admin` |
| `policy_type` | string | Non | `rate_limit`, `ip_whitelist`, `oauth`, `jwt` |
| `time_range` | string | Non | `24h`, `7d`, `30d`, `90d` |
| `limit` | integer | Non | Entrées d'audit max (défaut : 100) |

```json
// Obtenir le log d'audit
{"name": "stoa_security", "arguments": {"action": "audit_log", "api_id": "billing-api", "time_range": "7d"}}

// Vérifier les permissions
{"name": "stoa_security", "arguments": {"action": "check_permissions", "api_id": "billing-api", "action_type": "write"}}

// Lister les politiques de sécurité
{"name": "stoa_security", "arguments": {"action": "list_policies", "policy_type": "rate_limit"}}
```

---

## Gestion des Erreurs

Tous les tools retournent les erreurs dans un format cohérent :

```json
{
  "error": {
    "code": "SUBSCRIPTION_NOT_FOUND",
    "message": "Aucun abonnement actif trouvé pour api_id: billing-api",
    "details": {
      "api_id": "billing-api",
      "tenant": "acme"
    }
  }
}
```

### Codes d'Erreur Courants

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentification invalide ou manquante |
| `FORBIDDEN` | Permissions insuffisantes |
| `NOT_FOUND` | Ressource introuvable |
| `SUBSCRIPTION_NOT_FOUND` | Aucun abonnement actif |
| `QUOTA_EXCEEDED` | Limite de débit ou quota dépassé |
| `VALIDATION_ERROR` | Paramètres de requête invalides |
| `INTERNAL_ERROR` | Erreur côté serveur |

---

## Tools Spécifiques aux Tenants

Au-delà des tools de la plateforme, chaque tenant peut enregistrer des tools MCP personnalisés pour ses APIs. Ceux-ci apparaissent avec un préfixe :

```
{tenant}__{api-name}__{tool-name}
```

Exemple pour le tenant gaming OASIS :
- `oasis__Avatar-API__search-players`
- `oasis__Economy-API__transfer-coins`
- `oasis__Quests-API__create-quest`

Utilisez `stoa_tools` avec `action: list` pour découvrir les tools disponibles du tenant.
