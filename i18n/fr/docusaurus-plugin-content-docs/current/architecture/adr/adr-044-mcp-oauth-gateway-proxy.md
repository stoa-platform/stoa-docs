---
title: "ADR-044 : Architecture Proxy OAuth 2.1 de la MCP Gateway"
description: "Décide que la STOA Gateway joue le rôle de proxy OAuth 2.1 entre les clients MCP et Keycloak, en servant des métadonnées curées et en normalisant les payloads DCR."
keywords: [MCP, OAuth 2.1, RFC 9728, RFC 8414, DCR, PKCE, proxy gateway, Keycloak]
---

# ADR-044 : Architecture Proxy OAuth 2.1 de la MCP Gateway

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-15 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1281 |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — mode edge-mcp (actuel)
- **ADR-039** : mTLS Cert-Bound Tokens — bypass mTLS pour les chemins OAuth
- **ADR-041** : Plugin Architecture — feature gates community vs enterprise
- **CAB-1094** : Implémentation MCP OAuth 2.1 (PRs #528, #532, #541)

## Contexte

La MCP Gateway de STOA permet aux agents IA (Claude.ai, ChatGPT, clients personnalisés) d'interagir avec les APIs d'entreprise via le Model Context Protocol. MCP 2025-03-26 impose OAuth 2.1 pour l'authentification, en utilisant RFC 9728 (Protected Resource Metadata) pour la découverte.

### Le Problème

Lorsque Claude.ai se connecte à `${STOA_GATEWAY_URL}/mcp/sse`, il suit cette chaîne de découverte OAuth :

```
1. GET /.well-known/oauth-protected-resource  → lit authorization_servers[0]
2. GET /.well-known/oauth-authorization-server → lit registration_endpoint, token_endpoint
3. POST /oauth/register                       → Dynamic Client Registration (DCR)
4. GET  /authorize (navigateur)               → Consentement utilisateur + PKCE
5. POST /oauth/token                          → Échange du code contre un access token
```

L'intégration directe avec Keycloak échoue en plusieurs points :

1. **Les métadonnées Keycloak n'annoncent pas la méthode auth `"none"`** — les clients MCP sont publics (basés navigateur, sans client_secret). Le `/.well-known/openid-configuration` de Keycloak ne liste que `client_secret_basic` et `client_secret_post`, causant l'échec des clients à l'étape 3.

2. **Le DCR Keycloak remplace les scopes par défaut du realm** — lorsqu'un client envoie `scope: "openid profile stoa:read"` dans le payload DCR, Keycloak le traite comme une liste exhaustive, supprimant tous les scopes par défaut du realm (`profile`, `email`, `roles`, `web-origins`). Le client échoue alors l'autorisation avec `invalid_scope`.

3. **Le DCR Keycloak crée des clients confidentiels** — le DCR crée par défaut `publicClient: false`, exigeant un `client_secret` que les clients MCP basés navigateur ne peuvent pas stocker de manière sécurisée.

4. **mTLS bloque la découverte OAuth** — lorsque mTLS est activé (ADR-039), le middleware d'extraction retourne `MTLS_CERT_REQUIRED` (401) avant que le client ne puisse découvrir les endpoints OAuth, empêchant le challenge `WWW-Authenticate: Bearer` qui déclenche le flux OAuth.

### Incidents de Production

Ces problèmes ont été découverts lors de l'intégration Claude.ai (fév. 2026) :

| PR | Problème | Cause Racine | Correction |
|----|-------|------------|-----|
| #528 | Endpoints OAuth inaccessibles | Le middleware mTLS bloque avant le challenge OAuth | Liste de bypass codée en dur pour les chemins OAuth/MCP |
| #532 | `token_endpoint_auth_methods` sans `"none"` | Les métadonnées Keycloak n'annoncent pas le support client public | La gateway sert des métadonnées curées |
| #541 | `invalid_scope` lors de l'autorisation | Le champ `scope` DCR remplace les scopes par défaut du realm Keycloak | La gateway supprime `scope` du payload DCR |

## Décision

### Gateway comme Curateur de Métadonnées OAuth + Proxy

La STOA Gateway joue le rôle d'intermédiaire entre les clients MCP et Keycloak, avec trois responsabilités :

#### 1. Découverte OAuth Curée (RFC 9728 + RFC 8414)

La gateway sert ses propres endpoints `/.well-known/oauth-protected-resource` (RFC 9728) et `/.well-known/oauth-authorization-server` (RFC 8414) avec des métadonnées curées :

```
RFC 9728 (Protected Resource):
  resource: ${STOA_GATEWAY_URL}
  authorization_servers: [${STOA_GATEWAY_URL}]    ← gateway, PAS Keycloak
  scopes_supported: [openid, profile, email, stoa:read, stoa:write, stoa:admin]

RFC 8414 (Authorization Server):
  issuer: ${STOA_AUTH_URL}/realms/stoa             ← Keycloak (validation JWT)
  authorization_endpoint: ${STOA_AUTH_URL}/...      ← Keycloak (orienté navigateur)
  token_endpoint: ${STOA_GATEWAY_URL}/oauth/token   ← proxy gateway
  registration_endpoint: ${STOA_GATEWAY_URL}/oauth/register  ← proxy gateway
  token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"]
  code_challenge_methods_supported: ["S256"]
```

**Invariant clé** : `authorization_servers` dans RFC 9728 DOIT pointer vers l'URL de la gateway. Cela garantit que les clients découvrent les métadonnées curées de la gateway (avec la méthode auth `"none"`) plutôt que les métadonnées natives de Keycloak.

#### 2. Proxy DCR avec Normalisation du Payload

`POST /oauth/register` proxyfie vers l'endpoint DCR de Keycloak avec deux modifications :

1. **Suppression du scope** — supprime le champ `scope` du payload DCR avant de le transmettre. Cela préserve les scopes par défaut du realm Keycloak au lieu de les remplacer.

2. **Patching du client public** — après un DCR réussi, la gateway utilise l'API Admin Keycloak pour :
   - Définir `publicClient: true` (supprime l'exigence du client_secret)
   - Définir `pkce.code.challenge.method: S256` (active PKCE)

Cette approche en deux étapes (DCR + patch admin) est nécessaire car l'API DCR de Keycloak ne supporte pas directement les attributs `publicClient` ou PKCE.

#### 3. Proxy Token

`POST /oauth/token` est un proxy transparent vers l'endpoint token de Keycloak. Aucune modification — transmet la requête et la réponse telles quelles. Cela garantit que l'échange de token fonctionne via l'URL de la gateway annoncée dans les métadonnées.

### Bypass mTLS (Codé en Dur)

Les chemins OAuth et de découverte MCP contournent le middleware d'extraction mTLS de manière inconditionnelle :

```
Préfixes bypass : /.well-known/, /oauth/, /mcp/sse, /mcp/tools/, /mcp/v1/
Bypass exact :    /mcp, /mcp/capabilities, /mcp/health, /health, /ready, /metrics
```

Cette liste est **codée en dur, non configurable** — choix délibéré de conception. Une liste de bypass mal configurée casserait silencieusement MCP OAuth pour tous les clients, sans message d'erreur évident (mTLS retourne 401 avant le challenge OAuth).

### Négociation de Protocole MCP

Claude.ai demande la version de protocole MCP `2025-11-25`. La gateway négocie jusqu'à `2025-03-26` (la dernière version implémentée par la gateway). Cette négociation est transparente — le client s'adapte à la version négociée.

## Diagramme d'Architecture

```
Claude.ai (Client MCP)
    │
    │  1. GET /.well-known/oauth-protected-resource
    ▼
┌─────────────────────────────────────────────────────┐
│  STOA Gateway (${STOA_GATEWAY_URL})                 │
│                                                     │
│  ┌─ discovery.rs ─────────────────────────────────┐ │
│  │  RFC 9728: authorization_servers → [gateway]   │ │
│  │  RFC 8414: token_endpoint → gateway/oauth/token│ │
│  │           registration   → gateway/oauth/register│
│  │           authorization  → Keycloak/auth       │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ proxy.rs ─────────────────────────────────────┐ │
│  │  POST /oauth/register                          │ │
│  │    1. Suppression du champ `scope`             │ │
│  │    2. Transmission au DCR Keycloak             │ │
│  │    3. Patch client → public + PKCE S256        │ │
│  │                                                │ │
│  │  POST /oauth/token                             │ │
│  │    → Proxy transparent vers Keycloak           │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ mtls.rs ──────────────────────────────────────┐ │
│  │  is_mtls_bypass_path() → liste de bypass codée │ │
│  │  Les chemins OAuth/MCP contournent mTLS        │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────┘
                          │
                          │  DCR + token + API admin
                          ▼
              ┌───────────────────────┐
              │  Keycloak (IdP)       │
              │  ${STOA_AUTH_URL}     │
              │                       │
              │  - Realm: stoa        │
              │  - DCR: activé        │
              │  - PKCE: supporté     │
              │  - Scopes: openid,    │
              │    stoa:read/write/   │
              │    admin              │
              └───────────────────────┘
```

## Alternatives Rejetées

### Alternative 1 : Métadonnées Keycloak Directes (Sans Proxy)

Pointer `authorization_servers` directement vers Keycloak (`${STOA_AUTH_URL}/realms/stoa`). Laisser les clients MCP interagir nativement avec Keycloak.

**Rejeté car** :
- Les métadonnées Keycloak n'annoncent pas `token_endpoint_auth_methods: ["none"]` — les clients MCP publics ne peuvent pas s'enregistrer
- Pas d'opportunité de normaliser les payloads DCR (suppression du scope)
- Pas d'opportunité de patcher les clients en public + PKCE
- Le bypass mTLS nécessiterait une configuration côté Keycloak (hors de notre contrôle pour les déploiements Keycloak gérés)

### Alternative 2 : Extension SPI Keycloak

Écrire un plugin SPI Keycloak pour personnaliser le comportement DCR (auto-public client, normalisation du scope, override des métadonnées).

**Rejeté car** :
- Le développement SPI Keycloak est complexe et couplé aux versions (l'API change entre KC 23/24/25)
- Friction de déploiement : JAR personnalisé dans chaque instance Keycloak
- Non portable vers d'autres IdPs (Auth0, Okta, Azure AD)
- Le proxy gateway est plus simple, testable et agnostique à l'IdP

### Alternative 3 : Liste de Bypass Configurable

Rendre les chemins de bypass mTLS configurables via variable d'environnement ou fichier de config.

**Rejeté car** :
- Une liste de bypass mal configurée casse silencieusement MCP OAuth pour tous les clients
- Le mode d'erreur est opaque : mTLS retourne 401 avant le challenge OAuth, sans indice sur la cause racine
- Les chemins de bypass sont définis par le protocole (RFC 9728, spec MCP) et ne devraient pas changer
- La liste codée en dur est plus simple, plus sûre et auto-documentée

## Compatibilité des Versions Keycloak

| Fonctionnalité | KC 23 | KC 24 | KC 25 | Notes |
|---------|-------|-------|-------|-------|
| Endpoint DCR | ✅ | ✅ | ✅ | Stable entre les versions |
| `scope` dans DCR remplace les défauts | ✅ | ✅ | ✅ | Comportement cohérent (par conception) |
| Patch client via API Admin | ✅ | ✅ | ✅ | PUT `/admin/realms/{r}/clients/{id}` |
| Attribut `publicClient` | ✅ | ✅ | ✅ | Supporté dans toutes les versions |
| Attributs PKCE | ✅ | ✅ | ✅ | Via `attributes.pkce.code.challenge.method` |
| Politique Allowed Client Scopes | ✅ | ✅ | ✅ | Politique basée sur composant dans DCR |

**Risque connu** : les futures versions de Keycloak pourraient modifier le comportement de gestion des scopes dans DCR. La logique de suppression de scope dans la gateway est une précaution sûre — si KC arrête de remplacer les défauts, supprimer le scope est une no-op (sans effet négatif).

## Contexte Concurrentiel

En février 2026, STOA est le seul gateway API open source à implémenter le flux complet MCP OAuth 2.1 :

- Découverte **RFC 9728** Protected Resource Metadata
- **RFC 8414** Authorization Server Metadata avec support client public curé
- **Dynamic Client Registration** avec normalisation du scope et patch PKCE
- **Coexistence mTLS** — OAuth et mTLS sur le même gateway sans conflit

Kong, Gravitee et Tyk supportent OAuth 2.0 pour les consommateurs d'API mais aucun n'implémente la découverte OAuth spécifique à MCP ni les patterns de proxy DCR.

<!-- Les comparaisons de fonctionnalités sont basées sur la documentation publique disponible en 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque éditeur. Toutes les marques appartiennent à leurs propriétaires respectifs. -->

## Conséquences

### Positives

- **Les clients MCP fonctionnent immédiatement** — aucune configuration Keycloak requise au-delà de l'activation DCR et de la création des scopes
- **Agnostique à l'IdP** — le pattern proxy peut fonctionner avec tout fournisseur OAuth 2.0/OIDC, pas seulement Keycloak
- **Coexistence mTLS sécurisée** — le bypass codé en dur prévient les erreurs de configuration
- **Testable** — chaque fonction proxy dispose de tests unitaires avec wiremock (15 tests dans `proxy.rs`, 7 dans `discovery.rs`)

### Négatives

- **Dépendance à l'API Admin Keycloak** — le patch PKCE nécessite la variable d'env `KEYCLOAK_ADMIN_PASSWORD`. Sans elle, les clients sont créés comme confidentiels (loggé comme avertissement, non fatal)
- **DCR en deux étapes** — l'enregistrement client + le patch admin n'est pas atomique. Un crash entre les étapes laisse un client confidentiel dans Keycloak (inoffensif mais peu soigné)
- **Risque de dérive des métadonnées** — si Keycloak ajoute de nouveaux grant types ou scopes, les métadonnées curées de la gateway doivent être mises à jour manuellement

### Protection contre les Régressions

| Couche | Tests | Ce qui est Couvert |
|-------|-------|----------------|
| Unit (`proxy.rs`) | 15 | Proxy token, proxy DCR, suppression de scope, cas d'erreur |
| Unit (`discovery.rs`) | 7 | Champs de métadonnées, construction d'URL, valeurs par défaut |
| Unit (`mtls.rs`) | 4 | Chemins de bypass (OAuth, MCP, infra, non-bypass) |
| Contract (`oauth.rs`) | 3 | Snapshot : `authorization_servers`, forme des métadonnées |
| Integration (`mcp.rs`) | 12 | Endpoints de découverte OAuth, validation des métadonnées |
| E2E (bash) | 9 étapes | Flux complet : découverte → DCR → token (manuel) |
