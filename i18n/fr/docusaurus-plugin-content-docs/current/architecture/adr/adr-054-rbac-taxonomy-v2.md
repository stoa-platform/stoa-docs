---
title: "ADR-054 : Taxonomie RBAC v2 — Rôles Persona & Noms d'Affichage"
description: "Introduit une taxonomie de rôles à trois couches (persona, core, additif) avec résolution d'alias, noms d'affichage et un endpoint de métadonnées. Choisit la résolution d'alias additive (Option A) plutôt que la migration de rôles (Option B) et le mapping de realm Keycloak (Option C)."
keywords: [rbac, rôles, persona, noms-affichage, alias, normalisation, permissions, scopes, libre-service]
---

# ADR-054 : Taxonomie RBAC v2 — Rôles Persona & Noms d'Affichage

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-02 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1634 |

### Décisions Liées

- **ADR-013** : Modèle RBAC — modèle original à 4 rôles (`cpi-admin`, `tenant-admin`, `devops`, `viewer`)
- **ADR-024** : Gateway Unified Modes — la gateway respecte les scopes du JWT
- **ADR-046** : Fédération MCP — les outils fédérés utilisent les scopes pour le contrôle d'accès

## Contexte

Le modèle RBAC original (ADR-013) définit 4 rôles core en utilisant du jargon interne (`cpi-admin`, `tenant-admin`, `devops`, `viewer`). Ces noms n'ont aucun sens pour les utilisateurs OSS et les clients enterprise. CAB-604 avait précédemment défini 7 rôles persona (`stoa.admin`, `stoa.product_owner`, `stoa.developer`, `stoa.consumer`, `stoa.security`, `stoa.agent`) dans `ROLE_TO_SCOPES`, mais ils n'avaient jamais été câblés dans `ROLE_PERMISSIONS` — le moteur RBAC les ignorait complètement.

### Problèmes

1. **Friction UX** — Console et Portal affichent `cpi-admin` au lieu de "Platform Admin"
2. **Code mort** — les rôles persona existent dans le mapping de scopes mais pas dans la vérification des permissions
3. **Pas d'endpoint de métadonnées** — les frontends codent en dur les labels de rôles au lieu de les interroger depuis le backend
4. **Libre-service manquant** — Portal dispose de "My MCP Servers" mais pas de "My APIs" pour l'auto-service tenant

### Contraintes

- Zéro changement cassant — les JWT existants avec des rôles core doivent continuer à fonctionner de manière identique
- Pas de reconfiguration du realm Keycloak requise (tâche ops séparée, hors périmètre)
- Les noms d'affichage doivent être pilotés par le backend (source de vérité unique, pas de mappings locaux à l'UI)
- Les rôles persona sont additifs (se résolvent vers core + persona, ne remplacent jamais core)

## Options

### Option A : Résolution d'Alias Additive (Choisie)

Les rôles persona sont résolus au moment de l'extraction du JWT. `normalize_roles()` développe les alias : `["stoa.admin"]` devient `["cpi-admin", "stoa.admin"]`. Le rôle core pilote les vérifications de permissions, le rôle persona active les lookups de noms d'affichage.

```
JWT arrive avec les rôles : ["stoa.admin"]
  → normalize_roles() → ["cpi-admin", "stoa.admin"]
  → La vérification de permissions utilise "cpi-admin" (ROLE_PERMISSIONS existant)
  → Le lookup du nom d'affichage utilise "stoa.admin" → "STOA Admin"
  → Les deux rôles disponibles dans la réponse /v1/me
```

**Avantages :**
- Zéro migration — les anciens tokens fonctionnent sans changement, les nouveaux tokens obtiennent des métadonnées plus riches
- Idempotent — `normalize_roles(["cpi-admin", "stoa.admin"])` retourne le même ensemble (sans doublons)
- Piloté par le backend — un unique dict `ROLE_METADATA` sert l'endpoint roles et `/v1/me`

**Inconvénients :**
- Deux noms pour le même ensemble de permissions (alias + core) peuvent dérouter les consommateurs d'API
- La liste de rôles passe de 4 à 10 entrées

### Option B : Migration de Rôles (Rejetée)

Renommer les rôles core dans Keycloak et dans tout le code : `cpi-admin` → `stoa.admin`, `tenant-admin` → `stoa.product_owner`, etc.

**Rejeté car :**
- Changement cassant — tous les JWT existants, configurations Keycloak et règles gateway nécessiteraient une migration
- Déploiement coordonné — API, gateway et Keycloak doivent être mis à jour de manière atomique
- Risque de verrouillage — un mapping de rôle mal configuré supprime silencieusement toutes les permissions

### Option C : Mapping de Realm Keycloak (Rejeté)

Configurer les mappers de client Keycloak pour traduire les rôles persona en rôles core au moment de l'émission du token.

**Rejeté car :**
- Spécifique à Keycloak — lie la solution à un seul IdP (STOA supporte OIDC de manière générique)
- Transformation invisible — déboguer le contenu du JWT nécessite un accès admin Keycloak
- Pas de support des noms d'affichage — nécessite toujours un endpoint de métadonnées pour les noms lisibles par l'humain

## Décision

**Option A — Résolution d'Alias Additive.** La taxonomie de rôles à trois couches fournit des rôles persona compatibles avec l'existant avec des noms d'affichage, pilotés entièrement depuis le backend.

## Architecture

### Taxonomie de Rôles à Trois Couches

```
Couche 1 : Rôles Persona (orientés utilisateur, sémantiques)
  stoa.admin → "STOA Admin"
  stoa.product_owner → "Product Owner"
  stoa.developer → "Developer"
  stoa.consumer → "Consumer"

Couche 2 : Rôles Core (internes, fonctionnels)
  cpi-admin → 18 permissions (plateforme complète)
  tenant-admin → 13 permissions (périmètre tenant)
  devops → 11 permissions (déploiement/gestion)
  viewer → 5 permissions (lecture seule)

Couche 3 : Rôles Additifs (autonomes, pas des alias)
  stoa.security → 5 permissions (audit lecture seule)
  stoa.agent → 2 permissions (M2M lecture minimale)
```

Les rôles persona (Couche 1) se résolvent vers les rôles core (Couche 2) via `ROLE_ALIASES`. Les rôles additifs (Couche 3) ont leurs propres ensembles de permissions et n'ont pas d'alias vers un rôle core.

### Résolution d'Alias

```python
ROLE_ALIASES = {
    "stoa.admin": "cpi-admin",
    "stoa.product_owner": "tenant-admin",
    "stoa.developer": "devops",
    "stoa.consumer": "viewer",
}

def normalize_roles(raw_roles: list[str]) -> list[str]:
    result = set(raw_roles)
    for role in raw_roles:
        aliased = ROLE_ALIASES.get(role)
        if aliased:
            result.add(aliased)
    return sorted(result)
```

Appelé une fois au moment de l'extraction du JWT (`auth/dependencies.py`). Utilise un import paresseux pour éviter les dépendances circulaires avec le module RBAC.

### Scopes vs Permissions

| Concept | Granularité | Utilisé Par | Exemple |
|---------|-------------|-------------|---------|
| **Permissions** | Fine-grained | Autorisation API (`has_permission()`) | `tenants:create`, `apis:write` |
| **Scopes** | Coarse-grained | Token OAuth2, enforcement gateway | `stoa:admin`, `stoa:read` |

`ROLE_TO_SCOPES` mappe chaque rôle vers des scopes OAuth2 pour l'enforcement au niveau de la gateway. `ROLE_PERMISSIONS` mappe chaque rôle vers des permissions fine-grained pour les vérifications au niveau de l'API. Les deux sont intentionnellement séparés — un scope accorde l'accès à une catégorie d'endpoints, une permission accorde l'accès à une opération spécifique.

### Surface API

#### `GET /v1/roles`

Retourne les 10 rôles avec leurs métadonnées, permissions et mappings d'alias :

```json
{
  "roles": [
    {
      "name": "cpi-admin",
      "display_name": "Platform Admin",
      "description": "Full platform access across all tenants",
      "scope": "platform",
      "category": "core",
      "permissions": ["tenants:create", "tenants:read", "..."],
      "inherits_from": null
    },
    {
      "name": "stoa.admin",
      "display_name": "STOA Admin",
      "description": "Platform administrator (maps to Platform Admin)",
      "scope": "platform",
      "category": "persona",
      "permissions": ["tenants:create", "tenants:read", "..."],
      "inherits_from": "cpi-admin"
    }
  ],
  "aliases": {
    "stoa.admin": "cpi-admin",
    "stoa.product_owner": "tenant-admin",
    "stoa.developer": "devops",
    "stoa.consumer": "viewer"
  }
}
```

Les rôles persona héritent des permissions de leur rôle core. Le champ `inherits_from` rend cela explicite.

#### `GET /v1/me` (enrichi)

Ajoute `role_display_names` à la réponse existante :

```json
{
  "roles": ["cpi-admin", "stoa.admin"],
  "role_display_names": {
    "cpi-admin": "Platform Admin",
    "stoa.admin": "STOA Admin"
  },
  "permissions": ["tenants:create", "..."],
  "effective_scopes": ["stoa:admin", "stoa:write", "stoa:read"]
}
```

Les frontends utilisent `role_display_names` pour le rendu UI. Repli : si un rôle n'a pas de nom d'affichage, afficher le slug du rôle.

### Intégration UI

**Sidebar Console** — affiche `role_display_names` depuis `/v1/me` :
```typescript
user.roles.map((r) => user.role_display_names?.[r] || r).join(', ')
```

**Profil Portal** — même pattern, affiche les noms persona quand disponibles.

**Page "My APIs" du Portal** — nouvelle page d'auto-service pour la gestion des APIs périmètre tenant, accessible aux rôles `tenant-admin` et `cpi-admin`. Reproduit le pattern "My MCP Servers" existant.

## Conséquences

### Positives

- **Meilleure UX** — les utilisateurs voient "Platform Admin" au lieu de `cpi-admin` dans Console et Portal
- **Zéro migration** — tokens existants, configuration Keycloak et règles gateway inchangés
- **Extensible** — de nouveaux rôles persona ou additifs peuvent être ajoutés sans changement de schéma
- **Piloté par le backend** — les frontends interrogent `/v1/roles` ou `/v1/me`, ne codent jamais en dur les labels de rôles
- **Parité d'auto-service** — Portal dispose maintenant de "My APIs" en plus de "My MCP Servers"

### Négatives

- **Liste de rôles plus grande** — 10 entrées au lieu de 4 (gérable, documenté dans `/v1/roles`)
- **Double nommage** — les consommateurs d'API peuvent être désorientés par `cpi-admin` vs `stoa.admin` (atténué par le champ `inherits_from` et la documentation)

### Risques

- **Synchronisation Keycloak** — si les rôles du realm Keycloak sont reconfigurés pour émettre des rôles persona, `normalize_roles()` doit être testé avec une entrée mixte (alias et rôle core présents). L'implémentation actuelle est idempotente pour ce cas.

## Implémentation

| Phase | Périmètre | PR | LOC |
|-------|-----------|-----|-----|
| 1 | Endpoint de métadonnées de rôles + noms d'affichage dans `/v1/me` | #1353 | ~250 |
| 2 | Câblage des rôles persona + `normalize_roles()` + rôles additifs | #1353 | ~200 |
| 3 | Page "My APIs" d'auto-service Portal | #1353 | ~400 |
| 4 | Intégration des noms d'affichage Console + Portal | #1355 | ~100 |
| 5 | Documentation ADR-054 | Ce PR | ~200 |
