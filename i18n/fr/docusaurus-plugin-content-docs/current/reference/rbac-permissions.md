---
sidebar_position: 8
title: "Matrice des Permissions RBAC"
description: "Référence complète du RBAC STOA — 4 rôles, scopes OAuth, matrice des permissions, isolation des tenants et structure des claims JWT."
keywords:
  - RBAC
  - permissions
  - roles
  - access control
  - OAuth scopes
  - tenant isolation
---

# Matrice des Permissions RBAC

Référence complète du contrôle d'accès basé sur les rôles de STOA — rôles, scopes, permissions et isolation des tenants.

## Rôles

STOA définit 4 rôles, gérés dans Keycloak comme rôles de realm :

| Rôle | Portée | Description |
|------|-------|-------------|
| `cpi-admin` | **Plateforme** | Accès complet à tous les tenants, toutes les opérations |
| `tenant-admin` | **Tenant** | Accès complet à son propre tenant uniquement |
| `devops` | **Tenant** | Déployer, promouvoir et gérer au sein de son propre tenant |
| `viewer` | **Tenant** | Accès en lecture seule à son propre tenant |

### Hiérarchie des Rôles

```
cpi-admin (plateforme entière)
  └── tenant-admin (tenant-scoped)
       └── devops (deploy-scoped)
            └── viewer (lecture seule)
```

Les rôles supérieurs héritent de toutes les permissions des rôles inférieurs. Un `cpi-admin` peut tout faire qu'un `viewer` peut faire, et plus encore.

## Scopes OAuth

Le gateway fait correspondre les rôles aux scopes OAuth pour l'autorisation basée sur les tokens :

| Scope | Description | Rôles |
|-------|-------------|-------|
| `stoa:read` | Accès en lecture seule | `viewer`, `devops`, `tenant-admin`, `cpi-admin` |
| `stoa:write` | Créer, mettre à jour, supprimer | `devops`, `tenant-admin`, `cpi-admin` |
| `stoa:admin` | Administration de la plateforme | `cpi-admin` |

## Matrice des Permissions

### Gestion des APIs

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Lister les APIs | Lecture | Lecture | Lecture | Lecture (tous tenants) |
| Voir les détails d'une API | Lecture | Lecture | Lecture | Lecture (tous tenants) |
| Créer une API | — | Créer | Créer | Créer (n'importe quel tenant) |
| Mettre à jour une API | — | Mettre à jour | Mettre à jour | Mettre à jour (n'importe quel tenant) |
| Supprimer une API | — | — | Supprimer | Supprimer (n'importe quel tenant) |
| Déployer une API | — | Déployer | Déployer | Déployer (n'importe quel tenant) |
| Promouvoir une API | — | Promouvoir | Promouvoir | Promouvoir (n'importe quel tenant) |

### Gestion des Abonnements

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Lister les abonnements | Lecture | Lecture | Lecture | Lecture (tous tenants) |
| Créer un abonnement | — | Créer | Créer | Créer |
| Approuver un abonnement | — | — | Approuver | Approuver |
| Suspendre un abonnement | — | — | Suspendre | Suspendre |
| Révoquer un abonnement | — | — | Révoquer | Révoquer |
| Rotation de clé API | — | Rotation | Rotation | Rotation |

### Gestion des Consumers

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Lister les consumers | Lecture | Lecture | Lecture | Lecture (tous tenants) |
| Créer un consumer | — | — | Créer | Créer |
| Mettre à jour un consumer | — | — | Mettre à jour | Mettre à jour |
| Supprimer un consumer | — | — | Supprimer | Supprimer |
| Onboarding en masse | — | — | Masse | Masse |

### Gestion des Tenants

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Lister les tenants | Son tenant uniquement | Son tenant uniquement | Son tenant uniquement | Tous les tenants |
| Voir les détails du tenant | Son tenant uniquement | Son tenant uniquement | Son tenant uniquement | Tous les tenants |
| Créer un tenant | — | — | — | Créer |
| Mettre à jour un tenant | — | — | — | Mettre à jour |
| Supprimer un tenant | — | — | — | Supprimer |

### Tools MCP

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Lister les tools | Lecture | Lecture | Lecture | Lecture |
| Invoquer un tool | — | Invoquer | Invoquer | Invoquer |
| Enregistrer un tool (CRD) | — | — | Enregistrer | Enregistrer |

### Administration de la Plateforme

| Permission | `viewer` | `devops` | `tenant-admin` | `cpi-admin` |
|-----------|----------|----------|----------------|-------------|
| Voir les logs d'audit | Lecture | Lecture | Lecture | Lecture (tous tenants) |
| Gérer les utilisateurs | — | — | Propre tenant | Tous les tenants |
| Admin gateway | — | — | — | Accès complet |
| Remplacer l'env lecture seule | — | — | — | Remplacer |

## Isolation des Tenants

Les rôles tenant-scoped (`tenant-admin`, `devops`, `viewer`) sont limités à leur propre tenant :

- Un `tenant-admin` du tenant `acme` **ne peut pas** voir les ressources du tenant `globex`
- Les requêtes API filtrent automatiquement par le claim `tenant_id` de l'utilisateur
- Les tentatives d'accès inter-tenant retournent `403 Forbidden`

Seul `cpi-admin` peut accéder aux ressources de tous les tenants.

### Comment le Tenant est Déterminé

Le tenant de l'utilisateur est extrait du token JWT :

1. **Claim `tenant`** (claim personnalisé dans Keycloak) — source principale
2. **Rôle `tenant-{id}`** (pattern de rôle de realm) — fallback
3. **Aucun tenant** — valide uniquement pour `cpi-admin` (accès plateforme entière)

## Structure des Claims JWT

STOA valide ces claims JWT depuis Keycloak :

```json
{
  "sub": "user-uuid-123",
  "preferred_username": "john.doe",
  "email": "john.doe@acme.example.com",
  "tenant": "acme",
  "realm_access": {
    "roles": ["tenant-admin", "offline_access"]
  },
  "scope": "openid stoa:read stoa:write",
  "aud": ["stoa-mcp", "account"],
  "iss": "https://auth.<YOUR_DOMAIN>/realms/stoa",
  "exp": 1708000000,
  "iat": 1707999000
}
```

| Claim | Obligatoire | Objectif |
|-------|----------|---------|
| `sub` | Oui | Identifiant de l'utilisateur |
| `exp` | Oui | Expiration du token |
| `iat` | Oui | Token émis à |
| `iss` | Oui | Émetteur du token (URL Keycloak) |
| `aud` | Oui | Audience (doit inclure l'ID client) |
| `tenant` | Non | ID du tenant (requis pour les rôles tenant-scoped) |
| `realm_access.roles` | Oui | Rôles de realm Keycloak |
| `scope` | Non | Scopes OAuth (séparés par des espaces) |

## Exemples de Personas

### Alex — Admin Plateforme (`cpi-admin`)

Alex gère l'ensemble de la plateforme STOA. Elle peut :
- Créer et configurer des tenants
- Voir tous les abonnements de tous les tenants
- Accéder à l'API admin du gateway
- Remplacer les restrictions de production en lecture seule
- Voir les logs d'audit à l'échelle de la plateforme

### Bob — Admin Tenant (`tenant-admin`)

Bob gère les APIs pour le tenant `acme`. Il peut :
- Créer, modifier et supprimer des APIs dans `acme`
- Approuver les demandes d'abonnement aux APIs d'`acme`
- Gérer les consumers et leurs certificats
- Voir les logs d'audit pour `acme` uniquement
- **Ne peut pas** voir les ressources d'autres tenants

### Carol — Ingénieure DevOps (`devops`)

Carol déploie et promeut des APIs pour `acme`. Elle peut :
- Créer et mettre à jour des APIs dans `acme`
- Déployer des APIs en staging et en production
- Effectuer des rotations de clés API pour les abonnements
- **Ne peut pas** supprimer des APIs ou approuver des abonnements
- **Ne peut pas** gérer les consumers

### Dave — Observateur (`viewer`)

Dave surveille la santé des APIs pour `acme`. Il peut :
- Parcourir le catalogue d'APIs et la documentation
- Voir les détails des abonnements et les métriques d'utilisation
- Lire les logs d'audit pour `acme`
- **Ne peut pas** créer, modifier ou supprimer quoi que ce soit

## Voir Aussi

- [Guide d'Authentification](/docs/guides/authentication) — Configuration Keycloak et OIDC
- [Gestion des Environnements](/docs/guides/environment-management) — Modes d'environnement et production en lecture seule
- [Découverte OAuth](/docs/reference/oauth-discovery) — Endpoints OAuth 2.1
- [Isolation Multi-Tenant](/docs/concepts/multi-tenant) — Architecture tenant
