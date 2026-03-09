---
title: "ADR-055 : Gouvernance Portal/Console — Séparation Claire des Responsabilités"
description: "Établit une séparation stricte Producteur/Consommateur : Portal est exclusivement pour les consommateurs d'API (découvrir, s'abonner, utiliser). Console est exclusivement pour les fournisseurs d'API et les administrateurs de plateforme (créer, gérer, approuver, déployer). Supprime 8 fonctionnalités fournisseur du Portal pour éliminer la confusion UX."
keywords: [portal, console, gouvernance, ux, rbac, producteur, consommateur, séparation-des-responsabilités, gestion-api]
---

# ADR-055 : Gouvernance Portal/Console — Séparation Claire des Responsabilités

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-04 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1646 |

### Décisions Liées

- **ADR-013** : Modèle RBAC — modèle original à 4 rôles (`cpi-admin`, `tenant-admin`, `devops`, `viewer`)
- **ADR-054** : Taxonomie RBAC v2 — rôles persona (`stoa.product_owner`, `stoa.consumer`, etc.)

## Contexte

STOA Platform dispose de deux applications frontend :

- **Console** (`console.gostoa.dev`) — destinée aux fournisseurs d'API, administrateurs tenant et administrateurs de plateforme
- **Portal** (`portal.gostoa.dev`) — destiné aux consommateurs d'API et aux développeurs

Au fil du temps, des fonctionnalités fournisseur ont été ajoutées au Portal, créant une **interface hybride** où les tenant-admins doivent jongler entre les deux UIs sans frontière claire. Un audit des deux interfaces (mars 2026) a révélé une duplication significative de fonctionnalités et une confusion UX.

### Problèmes

1. **Duplication de fonctionnalités** — La création d'API (`/my-apis`), la gestion de serveurs MCP (`/my-servers`), l'approbation d'abonnements (`/workspace?tab=approvals`) et la gestion d'applications existent sur les **deux** interfaces, frappant les mêmes endpoints API
2. **Workflow fragmenté** — Un tenant-admin crée des APIs sur Portal mais doit basculer vers Console pour les déploiements, le monitoring et la gestion de la gateway. Aucune interface ne fournit le workflow fournisseur complet
3. **Confusion consommateur** — Un développeur (rôle consumer) voit "My APIs", "My MCP Servers" et "Approval Queue" dans la navigation Portal, même si ces fonctionnalités nécessitent le rôle `tenant-admin` et ne sont pas pertinentes pour les consommateurs
4. **Fonctionnalités inversées** — Webhooks, Credential Mappings et Contracts/UAC n'existent que sur Portal, pas sur Console, malgré qu'il s'agisse de fonctionnalités fournisseur/admin
5. **Pas de gouvernance documentée** — Il n'existe aucun ADR définissant quelles fonctionnalités appartiennent où

### Matrice de Duplication (pré-décision)

| Fonctionnalité | Console | Portal | Problème |
|----------------|---------|--------|----------|
| Créer/Gérer des APIs | `/apis` (CRUD) | `/my-apis` (CRUD) | Doublon complet |
| Créer/Gérer des serveurs MCP | `/mcp-servers` (CRUD) | `/my-servers` (CRUD) | Doublon complet |
| Approuver les abonnements | `/subscriptions` | `/workspace?tab=approvals` | Doublon complet |
| Gérer les applications | `/applications` (CRUD) | `/workspace?tab=apps` (CRUD) | Doublon complet |
| Enregistrer les consommateurs | `/consumers` (CRUD) | `/consumers/register` | Doublon partiel |
| Webhooks | ❌ manquant | `/webhooks` (CRUD) | Inversé — fonctionnalité admin sur Portal |
| Credential Mappings | ❌ manquant | `/credentials` (CRUD) | Inversé — fonctionnalité admin sur Portal |
| Contracts/UAC | ❌ manquant | `/contracts` (CRUD) | Inversé — fonctionnalité admin sur Portal |
| Monitoring Gateway | `/gateways` (5 routes) | `/gateways` (lecture seule) | Fuite — fonctionnalité ops sur Portal |

## Décision

**Adopter le "Modèle Stripe" — séparation stricte Producteur/Consommateur.**

### Portal = Consommateur UNIQUEMENT

Le Portal est un **Developer Portal** pour les consommateurs d'API. Il répond à la question : *"Quelles APIs/outils sont disponibles, et comment les utiliser ?"*

Fonctionnalités autorisées :
- **Découvrir** : Marketplace, Catalogue d'API, navigation des serveurs MCP, Favoris, Comparer
- **S'abonner** : S'abonner aux APIs et outils MCP, gérer les clés API (rotation, révélation, TOTP)
- **Utiliser** : Bac à sable de test API, Historique d'exécution, Utilisation/Quotas, Rate Limits
- **Auto-service** : Inscription, Assistant d'onboarding, Profil, Notifications
- **Ressources propres** : MES Applications (clients OAuth créés par le consommateur), MES Abonnements

### Console = Fournisseur + Admin

La Console est une **Admin Console** pour les fournisseurs d'API, les administrateurs tenant et les administrateurs de plateforme. Elle répond à la question : *"Comment publier, gérer et gouverner mes APIs ?"*

Fonctionnalités autorisées :
- **Cycle de vie API** : Créer, mettre à jour, déployer, déprécier, supprimer des APIs
- **Gestion MCP** : Créer, synchroniser, activer/désactiver les serveurs et outils MCP
- **Gouvernance** : Approuver/rejeter les abonnements, gérer les consommateurs, attribuer les rôles
- **Contracts** : Créer et gérer des Universal API Contracts (UAC), bindings de protocole
- **Intégration** : Webhooks, Credential Mappings (auth consumer→backend)
- **Opérations** : Gestion du parc de gateways, déploiements, monitoring, observabilité
- **Admin Plateforme** : Gestion des utilisateurs, fédération, posture de sécurité, journaux d'audit

### Règle de Frontière

> **Si une fonctionnalité CRÉE ou GÈRE une ressource que d'autres utilisateurs consomment, elle appartient à Console.**
> **Si une fonctionnalité DÉCOUVRE ou UTILISE une ressource créée par quelqu'un d'autre, elle appartient à Portal.**

Exceptions :
- Les utilisateurs Portal peuvent CRÉER leurs propres Applications (clients OAuth) — ce sont des ressources périmètre consommateur
- Les utilisateurs Portal peuvent CRÉER des abonnements (demandes) — mais l'approbation se fait sur Console

## Plan de Migration

### Phase 1 — Déplacer les fonctionnalités inversées vers Console (sans suppression Portal encore)

Ajouter à Console les 3 fonctionnalités qui n'existent actuellement que sur Portal :
1. Gestion des Webhooks (`/webhooks`) → Console `/webhooks`
2. Credential Mappings (`/credentials`) → Console `/credentials`
3. Contracts/UAC (`/contracts`) → Console `/contracts`

### Phase 2 — Supprimer les fonctionnalités fournisseur du Portal

Supprimer 8 routes/pages du Portal :
1. `/my-apis` → utiliser Console `/apis`
2. `/my-servers` → utiliser Console `/mcp-servers`
3. `/workspace?tab=approvals` → utiliser Console `/subscriptions`
4. `/consumers/register` → utiliser Console `/consumers`
5. `/webhooks` → désormais sur Console
6. `/credentials` → désormais sur Console
7. `/contracts/*` → désormais sur Console
8. `/gateways` → déjà sur Console

### Phase 3 — Nettoyage de la navigation Portal

- Supprimer les éléments de navigation réservés aux fournisseurs pour les rôles `viewer` et `devops`
- Simplifier la sidebar Portal en : Marketplace, My Apps, My Subscriptions, Usage, Notifications
- Mettre à jour l'assistant d'onboarding Portal pour supprimer les étapes fournisseur

## Alternatives Considérées

### Option B — Modèle Backstage (Portal = Hub d'Auto-Service pour tous)

Portal devient le hub unifié avec des vues basées sur les rôles. Console devient Opérations Plateforme uniquement (cpi-admin).

**Rejeté car :**
- Contredit la documentation existante ("Portal = développeurs consommant des APIs")
- Nécessite de reconstruire les fonctionnalités Console dans Portal (monitoring, gestion gateway, etc.)
- Plus de travail pour moins de clarté — les vues basées sur les rôles continuent à créer de la confusion dans la navigation
- Pas de précédent industriel en gestion API (Kong, Apigee, Azure APIM utilisent tous la séparation stricte)

### Option C — Fusion en une Seule Application

Remplacer Console et Portal par une seule application unifiée avec routage basé sur les rôles.

**Rejeté car :**
- Réécriture massive (2 apps React → 1)
- Perd la frontière de déploiement propre (Portal peut être public, Console interne)
- Augmente la surface d'attaque (application unique avec fonctionnalités admin exposées au trafic consommateur)
- Ne correspond pas aux conventions SaaS multi-tenant

## Conséquences

### Positives

- **Modèle mental clair** — les consommateurs vont sur Portal, les fournisseurs vont sur Console. Pas d'ambiguïté
- **Complexité Portal réduite** — Portal passe de ~30 routes à ~15 routes
- **Meilleure posture de sécurité** — Portal n'expose plus les endpoints admin
- **Cohérent avec le marché** — Kong, Apigee, AWS API Gateway, Azure APIM suivent tous ce modèle
- **RBAC simplifié sur Portal** — Portal n'a besoin que de `stoa:catalog:read`, `apps:read`, `stoa:tools:execute`

### Négatives

- **Le fournisseur a besoin de 2 signets** — les fournisseurs d'API utilisent Console (pas Portal) pour toutes les tâches de gestion
- **3 fonctionnalités à construire sur Console** — Webhooks, Credential Mappings, Contracts nécessitent des pages Console
- **Redirections nécessaires** — Les anciennes URLs Portal pour les fonctionnalités supprimées doivent rediriger vers les équivalents Console

### Neutres

- Portal et Console continuent à partager le même Control Plane API — pas de changements backend nécessaires
- Les clients OIDC Keycloak restent séparés (`stoa-portal`, `control-plane-ui`)

## Conformité

- Pas d'impact sur le modèle RBAC (ADR-013, ADR-054) — rôles et permissions inchangés
- Pas d'impact sur les contrats API — mêmes endpoints backend, routage frontend différent
- Aligné avec les règles de conformité du contenu — Portal est la surface public-facing

## Références

- Kong Developer Portal vs Kong Manager — [Kong Docs](https://docs.konghq.com)
- Apigee Portal vs Apigee Console — applications séparées, séparation stricte
- Azure API Management — Publisher Portal (admin) vs Developer Portal (consommateur)
- Stripe Dashboard — application unique mais feature gating strict basé sur les rôles
