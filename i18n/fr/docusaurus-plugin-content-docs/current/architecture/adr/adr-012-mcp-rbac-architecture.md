---
sidebar_position: 12
title: "ADR-012 : Architecture RBAC MCP"
description: "Décide l'architecture RBAC et de gouvernance multi-tenant pour les outils MCP, incluant le contrôle d'accès basé sur les rôles, les policies OPA et l'isolation des tenants."
keywords: [RBAC, MCP, multi-tenant, gouvernance, OPA, contrôle d'accès, sécurité]
---

# ADR-012 : Architecture des outils MCP — RBAC et gouvernance multi-tenant

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 16 janvier 2026 |
| **Auteur** | Christophe + Claude |
| **Linear** | [CAB-602](https://linear.app/hlfh-workspace/issue/CAB-602) (Epic) |

## Contexte

STOA expose des MCP Tools aux agents IA et développeurs. L'architecture actuelle (20 tools, 7 scopes) est insuffisante pour :

1. **Granularité RBAC** — Pas de distinction claire entre personas (Admin vs Developer vs Consumer vs Agent)
2. **Multi-tenancy** — Namespace tools hardcodé, pas de génération dynamique
3. **Agent Governance** — Manque de framework pour contrôler les agents IA (attestations, policy gates)
4. **Scalabilité** — Tools statiques vs génération dynamique depuis les contrats UAC

## Décision

Refactoriser l'architecture MCP Tools selon le pattern **Core + Proxied** avec RBAC granulaire par persona.

## Architecture

### Pattern : Core vs Proxied Tools

```
┌─────────────────────────────────────────────────────────────────┐
│                    Registre MCP STOA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OUTILS CORE (35 statiques)    │  OUTILS PROXIFIÉS (dynamiques) │
│  ─────────────────────────     │  ──────────────────────────    │
│  stoa_{domaine}_{action}       │  {tenant}:{api}:{operation}    │
│  Intégrés, versionnés          │  Générés depuis contrats UAC   │
│  Gestion de la plateforme      │  Exposition d'API métier       │
│                                │                                 │
│  Exemples :                    │  Exemples :                     │
│  - stoa_list_apis              │  - acme:crm:search_customers   │
│  - stoa_get_metrics            │  - acme:billing:create_invoice │
│  - stoa_create_subscription    │  - beta:inventory:check_stock  │
│                                │                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Catégories d'outils (35 outils Core)

| Catégorie | Nombre | Outils |
|-----------|--------|--------|
| **Plateforme & Découverte** | 6 | `stoa_platform_info`, `stoa_health_check`, `stoa_list_tools`, `stoa_get_tool_schema`, `stoa_search_tools`, `stoa_get_config` |
| **Catalogue API** | 8 | `stoa_list_apis`, `stoa_get_api`, `stoa_search_apis`, `stoa_get_api_versions`, `stoa_create_api`, `stoa_deploy_api`, `stoa_undeploy_api`, `stoa_deprecate_api` |
| **Souscriptions & Accès** | 6 | `stoa_list_subscriptions`, `stoa_get_subscription`, `stoa_create_subscription`, `stoa_update_subscription`, `stoa_revoke_subscription`, `stoa_rotate_api_key` |
| **Observabilité & Métriques** | 8 | `stoa_get_metrics`, `stoa_get_metrics_timeseries`, `stoa_get_slow_requests`, `stoa_list_alerts`, `stoa_list_errors`, `stoa_get_error_details`, `stoa_get_error_snapshot`, `stoa_analyze_errors` |
| **Contrats UAC** | 4 | `stoa_validate_contract`, `stoa_import_openapi`, `stoa_export_openapi`, `stoa_export_mcp` |
| **Sécurité & Conformité** | 3 | `stoa_get_security_score`, `stoa_list_audit_events`, `stoa_scan_vulnerabilities` |

## Scopes OAuth2 (12 scopes)

| Scope | Description | Niveau |
|-------|-------------|--------|
| `stoa:platform:read` | Lire la config plateforme & santé | Community |
| `stoa:platform:write` | Modifier la config plateforme | Enterprise |
| `stoa:catalog:read` | Parcourir le catalogue API | Community |
| `stoa:catalog:write` | CRUD APIs | Enterprise |
| `stoa:subscriptions:read` | Voir ses propres souscriptions | Community |
| `stoa:subscriptions:write` | Gérer les souscriptions | Community |
| `stoa:metrics:read` | Accéder aux métriques & analytics | Community |
| `stoa:logs:technical` | Logs applicatifs (debug, traces) | Enterprise |
| `stoa:logs:functional` | Logs métier (appels API) | Community |
| `stoa:logs:full` | Tous les logs dont PII (masqués) | Enterprise |
| `stoa:security:read` | Voir les pistes d'audit, conformité | Enterprise |
| `stoa:security:write` | Opérations de sécurité, scans | Enterprise |

## Matrice RBAC — 6 Personas

### 1. Administrateur plateforme (`stoa.admin`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Contrôle total de la plateforme |
| **Scopes** | TOUS |
| **Accès outils** | TOUS les 35 core + tous les proxifiés |
| **Niveau** | Enterprise / Partner |

### 2. Product Owner API (`stoa.product_owner`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Gère le cycle de vie des API pour son équipe |
| **Scopes** | `catalog:*`, `subscriptions:*`, `metrics:read`, `logs:technical`, `logs:functional` |
| **Accès outils** | CRUD Catalogue, Souscriptions, Métriques, Erreurs |
| **Contraintes** | API de sa propre équipe uniquement |

### 3. Développeur API (`stoa.developer`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Construit et déploie des API |
| **Scopes** | `catalog:read`, `catalog:write` (dev/staging uniquement), `metrics:read`, `logs:technical` |
| **Accès outils** | Déployer dev/staging, Lire métriques/erreurs |
| **Contraintes** | API de sa propre équipe, environnements non-prod |

### 4. Consommateur API (`stoa.consumer`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Utilise les API via des souscriptions |
| **Scopes** | `catalog:read`, `subscriptions:read`, `subscriptions:write` (propres), `metrics:read` (propre usage) |
| **Accès outils** | Parcourir le catalogue, Gérer ses propres souscriptions, Voir son propre usage |

### 5. Responsable sécurité (`stoa.security`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Conformité, audit, supervision sécurité |
| **Scopes** | `security:*`, `logs:full`, `metrics:read`, `catalog:read` |
| **Accès outils** | Pistes d'audit, Scans de sécurité, Rapports de conformité |
| **Contraintes** | Lecture seule par défaut, portes d'approbation pour les actions |

### 6. Agent IA (`stoa.agent`)

| Attribut | Valeur |
|----------|--------|
| **Description** | Agent IA autonome (Claude, GPT, personnalisé) |
| **Scopes** | Liste blanche uniquement (définie lors de l'enregistrement de l'agent) |
| **Accès outils** | Outils explicitement autorisés uniquement |
| **Contraintes** | TTL de token 10 min, attestations obligatoires, portes de policy (OPA), audit complet |

## Framework de gouvernance des agents

### Couches de sécurité

```
┌─────────────────────────────────────────────────────────────────┐
│                  Flux de requête agent                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Authentification (OAuth2 + DPoP/mTLS)                       │
│     └─→ Vérifier l'identité de l'agent, contrôler la validité  │
│          du token                                                │
│                                                                  │
│  2. Vérification liste blanche                                  │
│     └─→ Cet outil est-il dans la liste autorisée de l'agent ?  │
│                                                                  │
│  3. Porte de policy (OPA)                                       │
│     └─→ Évaluer les règles métier (heure, sensibilité des       │
│          données, etc.)                                          │
│                                                                  │
│  4. Attestation requise ?                                        │
│     └─→ Pour les actions sensibles, requérir une attestation    │
│          signée                                                  │
│                                                                  │
│  5. Exécuter & Auditer                                          │
│     └─→ Exécuter l'outil, tout journaliser, retourner le        │
│          résultat                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sécurité des tokens

| Mécanisme | Standard | Objectif |
|-----------|----------|----------|
| **DCR** | RFC 7591/7592 | Enregistrement dynamique de client |
| **DPoP** | RFC 9449 | Preuve de possession (clients publics) |
| **mTLS** | RFC 8705 | Tokens liés au certificat (clients confidentiels) |
| **TTL court** | — | 10 min max pour les agents |

## Ressources MCP (15)

| URI de ressource | Description |
|-----------------|-------------|
| `stoa://platform/info` | Métadonnées de la plateforme |
| `stoa://platform/health` | État de santé |
| `stoa://apis` | Liste du catalogue API |
| `stoa://apis/{id}` | Détails d'une API |
| `stoa://apis/{id}/versions` | Historique des versions API |
| `stoa://subscriptions` | Souscriptions de l'utilisateur |
| `stoa://subscriptions/{id}` | Détails d'une souscription |
| `stoa://metrics/{api_id}/summary` | Résumé des métriques API |
| `stoa://metrics/{api_id}/timeseries` | Données de séries temporelles |
| `stoa://errors/{api_id}/recent` | Erreurs récentes |
| `stoa://errors/{snapshot_id}` | Détail d'un snapshot d'erreur |
| `stoa://alerts/active` | Alertes actives |
| `stoa://audit/events` | Piste d'audit |
| `stoa://security/score` | Posture de sécurité |
| `stoa://tools` | Outils disponibles pour l'utilisateur courant |

## Comparaison : Avant vs Après

| Aspect | Avant | Après |
|--------|-------|-------|
| **Outils Core** | 20 (plats) | 35 (structurés par domaine) |
| **Scopes OAuth2** | 7 | 12 (granulaires) |
| **Personas** | Implicites | 6 explicites avec matrice RBAC |
| **Multi-tenant** | Namespace codé en dur | Dynamique `{tenant}:{api}:{op}` |
| **Gouvernance agents** | Aucune | Framework complet (liste blanche, attestations, portes de policy) |
| **Génération d'outils** | Manuelle | Automatique depuis les contrats UAC |

## Conséquences

### Positives

- ✅ Contrôle d'accès de niveau enterprise (RBAC par persona)
- ✅ Architecture multi-tenant évolutive
- ✅ Intégration sécurisée d'agents IA avec portes de policy
- ✅ Exposition automatique des outils depuis les contrats UAC
- ✅ Prêt pour la conformité (pistes d'audit NIS2/DORA)

### Négatives

- ⚠️ Effort de migration pour les intégrations existantes
- ⚠️ Complexité accrue dans la couche d'autorisation
- ⚠️ Surcharge de maintenance des policies OPA

### Atténuations

- Couche de compatibilité ascendante pour les outils v1 pendant la migration
- Templates de policies pour les cas d'usage courants
- Déploiement progressif par tenant

## Références

- RFC 7591/7592 — Enregistrement dynamique de client
- RFC 9449 — DPoP (Preuve de possession)
- RFC 8705 — Tokens liés au certificat mTLS
- [Spécification MCP](https://modelcontextprotocol.io)
- [OPA](https://www.openpolicyagent.org)
- [ADR-001 : Stratégie d'exposition des API](./adr-001-api-exposure-strategy.md)
