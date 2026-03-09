---
title: "ADR-046 : Architecture de Fédération MCP"
description: "Décide que STOA supporte la fédération MCP multi-fournisseur via des comptes maîtres avec délégation de token RFC 8693, facturation par sous-compte et partage d'outils inter-comptes."
keywords: [MCP, fédération, multi-tenant, délégation de token, RFC 8693, compte maître, composition d'outils, orchestration d'agents]
---

# ADR-046 : Architecture de Fédération MCP

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Brouillon |
| **Date** | 2026-02-17 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1313 |
| **Council** | 8.25/10 Go |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le mode edge-mcp héberge le routage de fédération
- **ADR-041** : Plugin Architecture — la fédération comme feature gate enterprise
- **ADR-043** : Kafka MCP Event Bridge — événements de métering par sous-compte
- **ADR-044** : Proxy OAuth 2.1 MCP Gateway — fondation OAuth pour la délégation de token
- **ADR-045** : Spécification Déclarative stoa.yaml — section federation dans la config déclarative

## Contexte

Les clients entreprise ont besoin d'un **point d'entrée MCP unique** qui agrège les outils de plusieurs équipes internes, unités métier ou partenaires externes. Aujourd'hui, chaque développeur ou agent IA se connecte indépendamment à la STOA Gateway — il n'existe pas de concept de compte parent gérant des sous-comptes, déléguant des tokens ou appliquant des politiques transversales.

### Le Problème

Deux patterns entreprise ne peuvent pas être servis avec le modèle actuel par connexion :

1. **Compte Maître (IT Entreprise)** : Une équipe plateforme provisionne un endpoint MCP unique. Les développeurs et agents IA s'y connectent. L'équipe plateforme contrôle quels outils sont visibles, applique des rate limits par équipe et obtient des métriques d'utilisation consolidées.

2. **Orchestration Multi-Agents** : Un utilisateur unique lance N agents (équipe Claude Code, workflows n8n, bots personnalisés). Chaque agent a besoin de son propre quota, audit trail et visibilité d'outils — mais toute la facturation est regroupée sur le compte de l'utilisateur.

> **Note de périmètre (ajustement Council #1)** : La fédération partenaire (confiance cross-IdP entre des realms Keycloak séparés ou des fournisseurs OIDC externes) est explicitement hors périmètre pour cet ADR. Elle sera traitée dans un futur ADR une fois le modèle interne maître/sous-compte prouvé.

### Architecture Actuelle

La gateway dispose déjà de primitives de fédération dans `stoa-gateway/src/federation/` :

```
federation/
├── mod.rs           # Exports du module
├── upstream.rs      # UpstreamMcpClient — connexion à des serveurs MCP distants
└── composition.rs   # ComposedTool, CompositionStep — chaînage d'outils
```

`UpstreamMcpClient` peut découvrir et invoquer des outils sur un serveur MCP distant. `ComposedTool` chaîne plusieurs appels d'outils en pipeline. Ce qui manque, c'est la **hiérarchie de comptes**, la **délégation de token** et l'**application de politique par sous-compte**.

## Décision

### 1. Modèle de Compte Maître

Introduire une entité `MasterAccount` dans le Control Plane API qui possède des sous-comptes :

```
MasterAccount (niveau tenant)
├── SubAccount: team-alpha      (équipe développement)
│   ├── quota: 10 000 appels/jour
│   ├── tools: [api-search, api-create]
│   └── agents: [claude-alpha-1, n8n-deploy]
├── SubAccount: team-beta       (équipe QA)
│   ├── quota: 5 000 appels/jour
│   ├── tools: [api-search]        (sous-ensemble lecture seule)
│   └── agents: [qa-bot-1]
└── SubAccount: ci-pipeline     (automatisation)
    ├── quota: 50 000 appels/jour
    ├── tools: [api-create, api-deploy, api-rollback]
    └── agents: [github-actions]
```

**Propriétés clés** :
- Un `MasterAccount` appartient exactement à un tenant
- Les sous-comptes héritent du catalogue d'outils du tenant mais peuvent être restreints via une **liste d'autorisation**
- Chaque sous-compte dispose de quotas, rate limits et logs d'audit indépendants
- Le propriétaire du compte maître voit les métriques agrégées sur tous les sous-comptes

### 2. Délégation de Token via RFC 8693

Les sous-comptes s'authentifient via **OAuth 2.0 Token Exchange** (RFC 8693). Le compte maître détient un token de service longue durée ; les sous-comptes l'échangent contre des tokens à portée limitée et de courte durée :

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Sous-Compte │     │ STOA Gateway │     │   Keycloak   │
│   (Agent)    │     │  (Proxy)     │     │   (IdP)      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │ 1. POST /oauth/token                     │
       │    grant_type=urn:ietf:params:oauth:      │
       │      grant-type:token-exchange            │
       │    subject_token=<master_token>           │
       │    requested_token_type=access_token      │
       │    scope=stoa:read stoa:write             │
       │    audience=sub-account:team-alpha        │
       ├────────────────────►│                     │
       │                     │ 2. Transmission au  │
       │                     │    Token Exchange   │
       │                     │    SPI KC           │
       │                     ├────────────────────►│
       │                     │                     │
       │                     │ 3. Token à portée   │
       │                     │    sub=team-alpha   │
       │                     │    scope=stoa:read  │
       │                     │◄────────────────────┤
       │                     │                     │
       │ 4. Token à portée   │                     │
       │◄────────────────────┤                     │
```

**Pourquoi RFC 8693 plutôt que la création de token personnalisée** :
- Protocole standard — supporté par Keycloak (Token Exchange SPI), Auth0, Okta
- Les tokens des sous-comptes portent le contexte tenant du parent (claim `azp` = client maître)
- La gateway peut valider la portée des sous-comptes sans lookups supplémentaires
- La révocation en cascade : révoquer le token maître invalide tous les tokens des sous-comptes

**Configuration Keycloak** :
- Activer Token Exchange sur le client maître
- Créer une permission `token-exchange` reliant le maître aux clients sous-comptes
- Les clients sous-comptes sont `confidential` avec grant `client_credentials` (pas d'interaction utilisateur)

**Repli pour KC sans Token Exchange SPI (ajustement Council #2)** : Lorsque le Token Exchange SPI est indisponible (versions KC plus anciennes, IdPs gérés), les sous-comptes peuvent s'authentifier via des **API keys dédiées** avec des métadonnées de sous-compte intégrées. La gateway mappe l'API key vers un contexte de sous-compte, fournissant la même application de politique — sans les bénéfices des tokens de courte durée et de la révocation en cascade. Il s'agit d'un mode dégradé, non du chemin recommandé.

### 3. Propriété CRUD (ajustement Council #3)

La gestion des entités de fédération suit le pattern Control Plane existant :

| Couche | Responsabilité | Technologie |
|-------|---------------|------------|
| **Control Plane API** (Python) | CRUD d'entités : comptes maîtres, sous-comptes, listes d'autorisation d'outils, quotas | SQLAlchemy + Alembic, endpoints REST |
| **STOA Gateway** (Rust) | Application runtime : cache liste d'autorisation, quota sous-compte, métering | Cache moka, middleware Axum |
| **Gateway Admin API** | Projections lecture seule : `/admin/federation/status`, `/admin/federation/cache/stats` | Pattern admin existant |

La gateway ne possède PAS le CRUD des entités de fédération. Elle reçoit la configuration du Control Plane API (même pattern de sync que le registre d'outils et les définitions d'API).

### 4. Routage de Fédération Gateway

La gateway route les appels d'outils en fonction de l'identité du sous-compte extraite du JWT :

```
Requête MCP tools/call
       │
       ▼
┌─────────────────────┐
│  Extraction JWT      │  Extraire sub_account_id des claims du token
│  (middleware auth)   │  (claim personnalisé ou combinaison azp + sub)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Politique           │  Vérifier : cet outil est-il dans la liste
│  Sous-Compte         │  d'autorisation du sous-compte ?
│  (couche fédération) │  Vérifier : le sous-compte a-t-il dépassé son quota ?
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Résolution d'Outil  │  Résoudre l'outil depuis :
│  (pipeline existant) │  1. Outils locaux du tenant (registre tenant)
│                      │  2. Outils upstream fédérés (UpstreamMcpClient)
│                      │  3. Outils composés (pipeline ComposedTool)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Métering            │  Émettre un événement Kafka avec dimension sub_account_id
│  (par sous-compte)   │  (étend le métering existant — ADR-043)
└──────────────────────┘
```

**Implémentation dans la gateway** (Rust) :
- Nouvelle couche middleware `federation` entre auth et résolution d'outils
- Extension `SubAccountContext` sur la requête Axum (similaire à `TenantContext` existant)
- Cache de liste d'autorisation d'outils sous-compte dans moka (stale-while-revalidate, même pattern que le registre d'outils)
- Application de quota réutilisant le `quota_middleware` existant avec granularité sous-compte

### 5. Partage d'Outils Inter-Comptes

Un compte maître peut partager des outils entre sous-comptes via la **publication d'outils** :

| Modèle de Partage | Mécanisme | Cas d'Usage |
|---------------|-----------|----------|
| **Partage interne** | La liste d'autorisation du sous-compte inclut des outils d'autres sous-comptes | L'équipe A utilise l'outil API interne de l'équipe B |
| **Partage composé** | `ComposedTool` chaîne des outils locaux + fédérés | Orchestration : valider, transformer, appeler API |

Règles de visibilité des outils :
1. Un sous-compte ne peut voir que les outils explicitement listés dans sa liste d'autorisation
2. La liste d'autorisation est un sous-ensemble des outils visibles du compte maître (qui est un sous-ensemble du catalogue complet du tenant)
3. Les outils fédérés (provenant de serveurs MCP upstream) sont traités de manière identique aux outils locaux pour les besoins de politique
4. La publication d'outils crée un proxy lecture seule — l'éditeur contrôle la définition de l'outil, les consommateurs obtiennent un snapshot

### 6. Isolation des Données RGPD (ajustement Council #4)

Les logs d'audit et événements de métering des sous-comptes sont **scoped au tenant** :
- L'audit trail de chaque sous-compte est isolé dans la limite de données du tenant parent
- Les métriques agrégées (tableau de bord du compte maître) ne doivent pas exposer les données PII des sous-comptes individuels
- Les événements de métering Kafka incluent `sub_account_id` mais les champs identifiant les utilisateurs suivent le pipeline de masquage PII existant (ADR-043, CAB-1177)
- La suppression d'un sous-compte déclenche la suppression en cascade des logs d'audit et événements de métering associés

## Alternatives Considérées

### A. Multi-Tenant Plat (modèle actuel, sans hiérarchie)

Continuer avec l'isolation par tenant, sans sous-comptes. Chaque équipe obtient son propre tenant.

**Rejeté car** : pas de facturation consolidée, pas de partage d'outils inter-équipes, pas d'application de politique centralisée. L'IT entreprise ne peut pas gérer 50+ tenants.

### B. Scoping par API Key (sans échange de token)

Utiliser des API keys avec des métadonnées de sous-compte intégrées au lieu de RFC 8693.

**Rejeté comme chemin principal** (mais conservé comme repli — voir Section 2) : les API keys sont des secrets longue durée (charge de rotation), ne peuvent pas porter de portées dynamiques et ne s'intègrent pas au flux OAuth 2.1 existant (ADR-044). L'échange de token est l'approche standard pour la délégation.

### C. Création de Token Côté Gateway

La gateway crée des tokens sous-compte localement (sans implication de Keycloak).

**Rejeté car** : sépare l'émetteur de token (Keycloak pour les utilisateurs, gateway pour les sous-comptes). Complique la validation de token, la révocation et l'audit. Le Token Exchange SPI de Keycloak gère cela correctement.

## Conséquences

### Positives

- **Prêt pour l'entreprise** : le modèle de compte maître correspond à l'achat entreprise (un contrat, N équipes)
- **Basé sur les standards** : échange de token RFC 8693, pas de protocole auth personnalisé
- **Incrémental** : construit sur le module de fédération existant (client upstream, composition d'outils)
- **Observable** : métering par sous-compte via le pipeline Kafka existant (ADR-043)
- **Sécurisé** : les tokens de sous-compte sont à portée limitée et de courte durée, la révocation part du maître

### Négatives

- **Dépendance Keycloak** : le Token Exchange SPI doit être activé et configuré par realm (atténué par le repli API key)
- **Complexité** : la hiérarchie maître vers sous-compte ajoute une nouvelle dimension à l'évaluation des politiques
- **Migration** : les tenants existants à connexion unique ne nécessitent pas de migration, mais les nouvelles fonctionnalités de fédération nécessitent des changements de schéma dans le Control Plane API (migration Alembic)

### Risques

| Risque | Atténuation |
|------|------------|
| Token Exchange SPI non activé dans le Keycloak du client | Repli API key (mode dégradé) ; documenter les exigences KC ; auto-setup Helm |
| Contournement du quota sous-compte via accès direct à la gateway | Tout accès gateway nécessite un JWT valide — les tokens sous-compte sont la seule façon d'obtenir un JWT à portée limitée |
| Dérive de la liste d'autorisation d'outils (CP vs cache gateway) | Pattern stale-while-revalidate (existant) avec TTL configurable par compte de fédération |

## Phases d'Implémentation

### Phase 1 : Modèle de Fédération + API (~13 pts)

- Modèles `MasterAccount` et `SubAccount` dans le Control Plane API
- Migration Alembic pour les tables `master_accounts`, `sub_accounts`, `sub_account_tools`
- Endpoints CRUD dans CP API (`/api/v1/federation/`)
- Assistant de configuration Token Exchange Keycloak (appels API admin KC)
- Repli API key pour l'auth sous-compte (mode dégradé)
- Tests unitaires : 20+ tests sur modèle, repository, service, router

### Phase 2 : Routage de Fédération Gateway (~13 pts)

- Extraction `SubAccountContext` depuis les claims JWT
- Middleware de fédération (entre auth et résolution d'outils)
- Cache de liste d'autorisation d'outils sous-compte (moka, stale-while-revalidate)
- Application de quota par sous-compte (étend le `quota_middleware` existant)
- Événements de métering Kafka avec dimension `sub_account_id`
- Endpoints lecture seule admin gateway (`/admin/federation/status`, `/admin/federation/cache/stats`)
- Partage d'outils inter-comptes via proxy `FederatedTool`

### Phase 3 : Tableau de Bord + Interface Admin (~8 pts)

- Interface Console : page de gestion de la fédération (comptes maîtres, sous-comptes, assignations d'outils)
- Tableau de bord d'utilisation avec détail par sous-compte (agrégé, conforme RGPD)
- Tests E2E : 5+ scénarios couvrant le cycle de vie de la fédération

## Références

- [RFC 8693 : OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [Keycloak Token Exchange](https://www.keycloak.org/docs/latest/securing_apps/#_token-exchange)
- [Spécification MCP 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024 : Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-043 : Pont Kafka MCP](/docs/architecture/adr/adr-043-kafka-mcp-event-bridge)
- [ADR-044 : Proxy OAuth 2.1 MCP Gateway](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)
