---
slug: ai-agent-security-authentication-patterns
title: "Sécurité des agents IA : 5 patterns OAuth, mTLS et JWT"
description: "Les clés API ne suffisent pas pour sécuriser les agents IA. 5 patterns d'authentification (OAuth 2.1, mTLS, token exchange) avec exemples de code et scénarios d'attaque."
authors: [stoa-team]
tags: [tutorial, security, ai, mcp]
keywords:
  - sécurité agent IA authentification API
  - agent IA oauth2 authentification
  - mcp gateway sécurité patterns
  - agent IA mTLS certificat
  - contrôle accès agent IA enterprise
  - DORA agent IA conformité
  - NIS2 sécurité API gateway
  - authentification machine-to-machine
---
<!-- last verified: 2026-03 -->

Les agents IA ont besoin d'un accès programmatique aux API, mais les patterns d'authentification traditionnels conçus pour les utilisateurs humains — cookies de session, tokens de session, flux OAuth2 authorization code — ne fonctionnent pas. **Les agents IA sont des services autonomes, pas des utilisateurs**. Ils opèrent sans navigateur, sans interaction humaine, et à la vitesse machine. Cet article présente cinq patterns d'authentification adaptés aux agents IA, du plus simple (clés API) au plus sécurisé (mTLS avec liaison de certificat), avec des exemples d'implémentation pour chacun.

Cet article fait partie de la série [Qu'est-ce qu'un MCP Gateway](/blog/what-is-mcp-gateway). Pour le contexte général sur les besoins d'infrastructure des agents IA, voir [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis).

<!-- truncate -->

## Pourquoi les agents IA nécessitent une authentification différente

Les flux d'authentification traditionnels supposent un utilisateur humain interagissant avec un navigateur :

1. L'utilisateur clique sur "Se connecter"
2. Redirection vers le fournisseur d'identité
3. Saisie des identifiants, approbation du consentement
4. Redirection avec un code d'autorisation
5. L'application échange le code contre un access token

**Cela ne fonctionne pas pour les agents IA.** Ils n'ont pas de navigateur, pas d'écran de consentement interactif, pas d'URI de redirection. Ils ont besoin de patterns d'authentification machine-to-machine : credentials en entrée, access token en sortie, aucune interaction humaine.

Mais les agents IA posent des défis de sécurité uniques, au-delà des comptes de service traditionnels :

### Risque d'injection de prompt

Le comportement d'un agent IA peut être manipulé via les entrées utilisateur, le contenu de documents, ou des prompts malveillants. Si un agent est trompé pour appeler une API qu'il ne devrait pas, la couche d'authentification doit intercepter l'appel avant son exécution.

### Contraintes de budget tokens

Chaque en-tête d'authentification, chaque claim JWT, chaque chaîne de certificats consomme des tokens de la fenêtre de contexte de l'agent. Les mécanismes d'authentification doivent être économes en tokens sans sacrifier la sécurité.

### Isolation multi-tenant

Une infrastructure d'agents IA unique peut servir des dizaines ou centaines de tenants. L'authentification doit imposer des frontières strictes entre tenants pour que l'Agent A (tenant X) ne puisse pas accéder aux API enregistrées pour l'Agent B (tenant Y).

### Exigences d'audit

Quand un agent IA appelle une API, les cadres de conformité (RGPD, DORA, NIS2) exigent de savoir non seulement quel agent, mais quel humain a initié la session de l'agent, quelles données ont été accédées, et si l'appel était autorisé. Les clés API traditionnelles ("quel service a fait cet appel ?") sont insuffisantes.

:::info Contexte réglementaire européen

Le règlement **DORA** (Digital Operational Resilience Act), applicable depuis janvier 2025, impose aux établissements financiers de l'UE une traçabilité complète des interactions avec les prestataires tiers de services TIC (article 28). Les agents IA qui accèdent à des APIs internes ou externes tombent dans ce périmètre. La directive **NIS2** étend des exigences similaires aux opérateurs d'infrastructures essentielles et importantes.

Concrètement, cela signifie que pour toute banque, assureur ou opérateur d'infrastructure critique européen, l'authentification des agents IA doit fournir : une **identité vérifiable** (pas juste une clé API anonyme), une **piste d'audit complète** (qui a initié l'action, quel agent a agi, quelles données ont été accédées), et une **isolation des défaillances** (la compromission d'un agent ne doit pas impacter les autres tenants).

:::

## Pattern 1 : clés API — le plus simple, mais avec précaution

Les clés API sont la méthode d'authentification la plus directe : un secret statique transmis dans un en-tête HTTP.

### Fonctionnement

```bash
# L'agent IA appelle une API avec une clé API
curl -X POST ${STOA_API_URL}/v1/action \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{"input": "data"}'
```

Le serveur API valide la clé contre une base de clés connues, récupère les permissions associées, et traite la requête.

### Quand utiliser les clés API

- **Preuve de concept** ou **environnements bac à sable** où les exigences de conformité sont minimales.
- **Single-tenant** où un agent accède à une API.
- **Faible sécurité** (lecture de données publiques, opérations non-sensibles).

### Les risques

Les clés API sont des **secrets à durée de vie illimitée**. Si le prompt d'un agent IA peut être manipulé pour exfiltrer sa clé API (via une réponse d'outil craftée, par exemple), un attaquant peut rejouer cette clé indéfiniment jusqu'à sa révocation manuelle.

Voir [Vos clés API sont dans votre historique Git](/blog/api-keys-in-git-history) pour le vecteur de fuite le plus courant : des développeurs codant les clés en dur et les committant.

### Bonnes pratiques pour les clés API avec agents IA

```python
# Mauvais : clé API en dur dans le prompt de l'agent
agent_prompt = """
Tu es un agent de support client avec accès au CRM.
Ta clé API est : sk_live_abc123xyz
"""

# Bon : clé API injectée au runtime depuis l'environnement
import os

api_key = os.environ["AGENT_API_KEY"]
# Ne jamais passer la clé dans la fenêtre de contexte de l'agent
```

**Défense en profondeur** : même avec l'injection au runtime, implémentez :

1. **Listes d'IP autorisées** — N'acceptez les appels API que depuis les IP connues du gateway.
2. **Rate limiting** — Plafonnez les appels par clé par minute pour détecter les abus.
3. **Rotation des clés** — Rotation tous les 30-90 jours.
4. **Restriction de scope** — Associez chaque clé à des endpoints API spécifiques, pas à tous les endpoints.

Pour les cas d'usage en production impliquant des données sensibles ou du multi-tenancy, passez à OAuth2 ou mTLS.

## Pattern 2 : OAuth2 Client Credentials — machine-to-machine

Le flux OAuth2 Client Credentials est le standard industriel pour l'authentification service-à-service. Il remplace les clés API statiques par des **access tokens à durée de vie courte** qui expirent automatiquement.

### Fonctionnement

1. L'agent IA envoie `client_id` et `client_secret` au serveur d'autorisation.
2. Le serveur d'autorisation valide les credentials et retourne un JWT access token (typiquement valide 1 heure).
3. L'agent IA inclut l'access token dans ses appels API.
4. Le token expire ; l'agent en demande un nouveau avant le prochain appel API.

```bash
# Étape 1 : l'agent s'authentifie auprès du serveur OAuth2
curl -X POST ${STOA_AUTH_URL}/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=agent-crm-reader" \
  -d "client_secret=secret_abc123" \
  -d "scope=crm:read"

# Réponse :
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "crm:read"
}

# Étape 2 : l'agent appelle l'API avec l'access token
curl -X GET ${STOA_API_URL}/v1/customers \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Quand utiliser OAuth2 Client Credentials

- **Environnements multi-tenant** où chaque tenant a des comptes de service séparés.
- **Industries régulées** exigeant des pistes d'audit liées à des identités spécifiques.
- **Accès médié par gateway** où un MCP gateway gère les tokens pour le compte des agents.

### Avantages de sécurité par rapport aux clés API

| Caractéristique | Clés API | OAuth2 Client Credentials |
|---------|----------|---------------------------|
| Durée de vie du token | Indéfinie (jusqu'à révocation) | Courte durée (1-24 heures) |
| Rotation | Manuelle | Automatique à l'expiration |
| Piste d'audit | "Cette clé a été utilisée" | "Ce compte de service a agi à cette heure avec ces scopes" |
| Limitation de scope | Aucune (accès API complet) | Fine (ex. `crm:read` et non `crm:write`) |
| Révocation | Suppression manuelle de la clé | Les tokens expirent automatiquement ; révoquer côté émetteur |

### Implémentation avec Keycloak

STOA utilise [Keycloak](https://www.keycloak.org/) pour OAuth2/OIDC. Voici comment créer un compte de service pour un agent IA :

```bash
# Créer un client Keycloak pour l'agent IA
# (via Console d'Admin ou API)
curl -X POST ${STOA_AUTH_URL}/admin/realms/stoa/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "ai-agent-crm",
    "enabled": true,
    "serviceAccountsEnabled": true,
    "standardFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "clientAuthenticatorType": "client-secret",
    "secret": "generated-secret-here"
  }'

# Assigner des scopes/rôles au compte de service
# (via les mappings de rôles dans Keycloak)
```

L'agent s'authentifie ensuite avec les client credentials et reçoit un JWT. Le MCP gateway valide le JWT à chaque invocation d'outil.

Pour les détails d'implémentation, voir le [Guide des comptes de service](/docs/guides/service-accounts).

## Pattern 3 : OAuth2 Token Exchange (RFC 8693) — identité déléguée

L'OAuth2 Token Exchange (RFC 8693) résout un problème critique : **comment un agent IA peut-il agir au nom d'un utilisateur humain sans avoir son mot de passe ?**

### Le cas d'usage

Un utilisateur s'inscrit comme consommateur sur le portail STOA et reçoit des credentials initiaux. Un agent IA (par ex. Claude avec des outils MCP) a besoin d'appeler des API au nom de cet utilisateur, mais l'agent ne doit pas stocker les credentials longue durée de l'utilisateur. Le token exchange permet à l'agent d'échanger un token utilisateur contre un token scopé agent à courte durée de vie.

### Fonctionnement

```bash
# Étape 1 : l'utilisateur s'authentifie et reçoit un token consommateur
# (via login Portail)
USER_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.user_claims..."

# Étape 2 : l'agent échange le token utilisateur contre un token scopé agent
curl -X POST ${STOA_AUTH_URL}/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$USER_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "requested_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "audience=${STOA_GATEWAY_URL}" \
  -d "scope=mcp:invoke"

# Réponse :
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.agent_claims...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 3600
}

# Étape 3 : l'agent utilise le nouveau token pour appeler le MCP Gateway
curl -X POST ${STOA_GATEWAY_URL}/tools/search-contacts/invoke \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.agent_claims..." \
  -d '{"query": "Jane Doe"}'
```

### Le modèle de sécurité

Le token exchange maintient une **chaîne de confiance** :

1. L'utilisateur s'authentifie (prouve son identité).
2. Le serveur d'autorisation émet un token utilisateur.
3. L'agent présente le token utilisateur et demande un token scopé agent.
4. Le serveur d'autorisation valide le token utilisateur, vérifie les politiques de délégation, et émet un nouveau token avec un scope réduit.
5. Le nouveau token inclut des claims identifiant à la fois l'utilisateur (sujet original) et l'agent (acteur).

Cela permet un **accès délégué avec attribution** : le MCP gateway sait que l'agent a appelé l'API, mais sait aussi quel utilisateur a autorisé l'agent à agir en son nom.

### Claims JWT dans les tokens échangés

```json
{
  "sub": "user-123",  // Utilisateur original
  "act": {
    "sub": "agent-crm-assistant"  // Agent agissant
  },
  "aud": "https://mcp.example.com",
  "scope": "mcp:invoke crm:read",
  "exp": 1234567890
}
```

Les journaux d'audit peuvent désormais enregistrer : "L'agent `agent-crm-assistant` a invoqué `search-contacts` au nom de l'utilisateur `user-123` à 14h30 UTC."

Pour les détails d'implémentation, voir la [Fiche technique OAuth2 Token Exchange](/docs/guides/fiches/oauth2-token-exchange).

## Pattern 4 : mTLS avec liaison de certificat (RFC 8705) — sécurité maximale

Le Mutual TLS (mTLS) avec tokens liés au certificat est le standard de référence pour l'authentification des agents IA. Il combine une preuve d'identité cryptographique avec une défense contre le vol de tokens.

### Fonctionnement du mTLS

En TLS traditionnel, seul le serveur prouve son identité (via un certificat). En **mutual TLS**, le client présente également un certificat :

1. L'agent se connecte à l'API gateway avec TLS.
2. Le gateway demande le certificat du client.
3. L'agent présente un certificat signé par une CA de confiance.
4. Le gateway valide le certificat et extrait l'identité de l'agent du subject DN.
5. Le gateway émet un token **lié à l'empreinte du certificat**.

Si un attaquant vole le token, il ne peut pas l'utiliser sans la clé privée de l'agent.

### Tokens liés au certificat (RFC 8705)

Quand le gateway émet un access token, il inclut un claim `cnf` (confirmation) qui lie le token au certificat :

```json
{
  "sub": "agent-production-01",
  "aud": "https://mcp.example.com",
  "exp": 1234567890,
  "cnf": {
    "x5t#S256": "bwcK0esc3ACC3DB2Y5_lESsXE8o9ltc05O89jdN-dg2"
  }
}
```

La valeur `x5t#S256` est le hash SHA-256 du certificat client. Quand l'agent utilise ce token, le gateway vérifie que le hash du certificat correspond au claim `cnf`. Un token volé (sans la clé privée correspondante) est inutilisable.

### Exemple d'implémentation

```bash
# Étape 1 : générer un certificat client pour l'agent IA
openssl req -new -x509 -days 365 -nodes \
  -subj "/CN=ai-agent-prod/O=MonEntreprise" \
  -keyout agent.key -out agent.crt

# Étape 2 : l'agent s'authentifie avec mTLS et reçoit un token lié au certificat
curl -X POST ${STOA_AUTH_URL}/oauth/token \
  --cert agent.crt --key agent.key \
  -d "grant_type=client_credentials" \
  -d "client_id=agent-prod"

# Réponse : access token avec claim cnf

# Étape 3 : l'agent appelle l'API avec le token ET le certificat
curl -X POST ${STOA_GATEWAY_URL}/tools/delete-user/invoke \
  --cert agent.crt --key agent.key \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"user_id": "12345"}'
```

Le gateway valide :

1. **Le certificat est valide** (non expiré, signé par une CA de confiance).
2. **Le certificat correspond au claim `cnf` du token** (prévient le vol de token).
3. **L'agent est autorisé** à invoquer cet outil (vérification de politique OPA).

### Quand utiliser mTLS

- **Environnements haute sécurité** (services financiers, santé, défense).
- **Architectures zero-trust** où chaque service doit prouver son identité.
- **Exigences de conformité** imposant une authentification cryptographique (PCI-DSS, DORA, NIS2).

:::tip mTLS et conformité DORA

Le règlement DORA exige des entités financières qu'elles mettent en place des mesures de sécurité "proportionnées" pour les accès aux systèmes critiques. Pour les agents IA accédant à des données financières sensibles (comptes clients, transactions, données KYC), le mTLS avec liaison de certificat constitue la réponse technique la plus robuste :

- **Preuve cryptographique d'identité** : satisfait l'article 9 (protection et prévention)
- **Tokens liés au certificat** : atténue le risque de vol de credentials (article 10, détection)
- **Piste d'audit avec identité vérifiable** : satisfait l'article 12 (sauvegarde et continuité)

Les régulateurs européens (ACPR, BaFin, CSSF) attendront ces niveaux de contrôle lors des audits DORA à partir de 2025.

:::

Pour les détails de configuration, voir le [Guide de configuration mTLS](/docs/guides/mtls-configuration).

## Pattern 5 : patterns composites — défense en profondeur

En production, les déploiements les plus sécurisés combinent plusieurs patterns :

### Exemple : OAuth2 + mTLS

1. L'agent s'authentifie avec **mTLS** (preuve d'identité cryptographique).
2. Le serveur d'autorisation émet un **token OAuth2 lié au certificat**.
3. L'agent utilise le token pour les appels API (validé via mTLS + JWT).

Cela fournit une **sécurité en couches** :

- **Le vol de token** est atténué (inutilisable sans la clé privée).
- **La compromission du certificat** est atténuée (révoquez le cert, les tokens expirent automatiquement).
- **La piste d'audit** inclut à la fois l'identité cryptographique (DN du certificat) et l'identité logique (claims OAuth2).

### Exemple : Token Exchange + Rate Limiting

1. Token utilisateur échangé contre un token scopé agent (Pattern 3).
2. Le MCP gateway applique des **quotas par utilisateur** basés sur l'identité de l'utilisateur original.

Si le compte d'un utilisateur est compromis et qu'un attaquant tente d'abuser de l'agent IA, le rate limiter du gateway détecte les patterns d'appels anormaux (100 appels/seconde pour un utilisateur qui en fait normalement 5/jour) et bloque les requêtes suivantes.

### Exemple : clés API en dev, OAuth2 en production

- **Environnement de développement** : les agents utilisent des clés API (itération rapide, pas de gestion de certificats).
- **Environnement de staging** : les agents utilisent OAuth2 client credentials (test de l'expiration et de la rotation des tokens).
- **Environnement de production** : les agents utilisent mTLS + tokens liés au certificat (sécurité maximale).

Cette progression réduit les frictions en développement tout en garantissant que les déploiements de production respectent les standards de sécurité.

## Comparatif : quel pattern choisir ?

| Pattern | Niveau de sécurité | Complexité | Idéal pour | Risque vol de token | Compatible agent IA |
|---------|-------------------|------------|----------|---------------------|---------------------|
| **Clés API** | Faible | Très faible | PoC, bac à sable | Élevé (secret statique) | Oui |
| **OAuth2 Client Credentials** | Moyen | Faible | Multi-tenant, comptes de service | Moyen (tokens courte durée) | Oui |
| **OAuth2 Token Exchange** | Moyen-Élevé | Moyen | Accès délégué, attribution utilisateur | Moyen (chaîne de délégation) | Oui |
| **mTLS liaison de certificat** | Très élevé | Élevé | Zero-trust, haute sécurité, conformité | Très faible (nécessite la clé privée) | Oui |
| **Composite (OAuth2 + mTLS)** | Maximum | Élevé | Services financiers, défense, santé | Minimal (défenses en couches) | Oui |

**Heuristique de décision** :

- **Single-tenant, faible conformité** → Clés API (Pattern 1)
- **Multi-tenant, conformité standard** → OAuth2 Client Credentials (Pattern 2)
- **Délégation utilisateur-agent, pistes d'audit** → Token Exchange (Pattern 3)
- **Zero-trust, infrastructure critique** → mTLS (Pattern 4)
- **Sécurité maximale, industrie régulée (banque, assurance)** → Composite (Pattern 5)

## Comment STOA implémente l'authentification des agents IA

Le MCP Gateway de STOA supporte les cinq patterns via une **chaîne de middlewares** qui applique authentification, autorisation et politiques avant que toute invocation d'outil n'atteigne les systèmes backend.

### Middleware d'authentification

Le gateway détecte la méthode d'authentification depuis les en-têtes de la requête et valide en conséquence :

```rust
// Pseudo-code simplifié (STOA est implémenté en Rust)
match request.headers.get("Authorization") {
    Some("Bearer <token>") => {
        // Validation du token OAuth2
        validate_jwt(token)?;
        extract_claims(token)
    },
    Some("ApiKey <key>") => {
        // Recherche de la clé API
        lookup_api_key(key)?
    },
    None => {
        // Vérification du certificat mTLS
        extract_client_cert_dn(tls_connection)?
    }
}
```

### Autorisation avec OPA

Une fois l'identité de l'agent établie, le gateway interroge l'Open Policy Agent :

```rego
package stoa.mcp.authz

import future.keywords.if

# Autoriser l'invocation d'outil si l'agent a le scope requis
allow if {
    input.agent.scopes[_] == "mcp:invoke"
    input.tool.namespace == input.agent.tenant
}

# Exiger mTLS pour les opérations destructives
deny if {
    input.tool.name == "delete-user"
    not input.request.cert_verified
}
```

Cela découple l'authentification (qui êtes-vous ?) de l'autorisation (que pouvez-vous faire ?), permettant des politiques fines sans coder les règles en dur dans le gateway.

### Validation des tokens liés au certificat

Pour les requêtes mTLS, le gateway valide la liaison du certificat :

```rust
// Extraire l'empreinte du certificat depuis la connexion TLS
let cert_hash = sha256(client_cert.as_der());

// Extraire le claim cnf du JWT
let token_cnf = jwt_claims.get("cnf")?.get("x5t#S256")?;

// Valider la liaison
if cert_hash != token_cnf {
    return Err("Incohérence de liaison certificat");
}
```

Cela empêche les attaques par rejeu de token même si le token est intercepté.

### Journalisation d'audit

Chaque requête authentifiée génère un événement d'audit :

```json
{
  "timestamp": "2026-02-19T10:30:00Z",
  "agent_id": "agent-prod-01",
  "auth_method": "mtls",
  "cert_subject": "CN=agent-prod-01,O=MonEntreprise",
  "user_id": "user-123",
  "tenant": "acme",
  "tool": "delete-user",
  "input": {"user_id": "12345"},
  "result": "success",
  "policy_decision": "allow"
}
```

Ces événements alimentent OpenSearch pour le reporting de conformité et la détection d'anomalies.

Pour l'architecture complète, voir la documentation [Concepts MCP Gateway](/docs/concepts/mcp-gateway).

## Bonnes pratiques pour l'authentification des agents IA

Issues de déploiements en production, voici les pratiques essentielles :

### 1. Ne jamais mettre les credentials dans le contexte de l'agent

```python
# Mauvais : clé API dans le prompt système
system_prompt = """
Tu es un agent de service client.
Clé API : sk_live_abc123
"""

# Bon : credentials injectés par le runtime
# L'agent ne voit jamais la clé, le gateway gère l'authentification
```

### 2. Utiliser des tokens à courte durée de vie

Les tokens OAuth2 doivent expirer en 1 à 24 heures. Cela limite la fenêtre d'opportunité en cas de compromission d'un token.

### 3. Rotation automatique des secrets

Pour les clés API et les client secrets, implémentez une rotation automatique tous les 30-90 jours. STOA s'intègre avec Vault pour cela. Voir le [Guide de configuration sécurité](/docs/reference/security-configuration).

### 4. Surveiller les anomalies d'authentification

Suivez les tentatives d'authentification échouées par agent. Si un agent qui s'authentifie normalement une fois par heure tente soudain 100 authentifications par minute, investiguez immédiatement.

### 5. Implémenter une sécurité progressive

Commencez avec des clés API en développement, passez à OAuth2 en staging, imposez mTLS en production. Cela réduit les frictions en développement tout en garantissant que les déploiements de production respectent les standards de sécurité.

## FAQ

### Quelle est la différence entre clés API et tokens OAuth2 pour les agents IA ?

Les clés API sont des secrets statiques à durée de vie indéfinie, comme des mots de passe. Les tokens OAuth2 sont à courte durée de vie (typiquement 1 heure), expirent automatiquement, et incluent des métadonnées (scopes, émetteur, sujet) qui permettent une autorisation fine. Pour les agents IA en production, OAuth2 offre une meilleure sécurité grâce à la rotation automatique, la limitation de scope et les pistes d'audit. Les clés API sont acceptables pour le développement ou les cas d'usage à faible sécurité.

### Comment mTLS prévient-il le vol de token ?

mTLS lie l'access token au certificat du client via le claim `cnf` (confirmation) dans le JWT. Même si un attaquant intercepte le token, il ne peut pas l'utiliser sans la clé privée du client. Le gateway vérifie que le certificat présenté lors de l'appel API correspond au hash du certificat dans le claim `cnf` du token. Cela est spécifié dans la RFC 8705 (OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens).

### Peut-on utiliser le token exchange OAuth2 avec Claude ou GPT ?

Oui, mais vous avez besoin d'un MCP gateway pour médier l'échange. Claude et GPT ne supportent pas nativement le token exchange OAuth2. Le flux est : (1) l'utilisateur s'authentifie et reçoit un token, (2) le MCP gateway échange le token utilisateur contre un token scopé agent pour le compte de Claude/GPT, (3) l'agent utilise le nouveau token pour invoquer les outils MCP. Le gateway de STOA implémente ce pattern. Voir le [Guide d'onboarding consommateur](/docs/guides/consumer-onboarding) pour les détails d'implémentation.

### Quel pattern d'authentification utiliser pour les agents IA dans une industrie régulée ?

Pour les industries régulées (services financiers, santé, défense) nécessitant la conformité à des standards comme PCI-DSS, DORA ou NIS2, utilisez le **mTLS avec tokens liés au certificat** (Pattern 4) ou un **pattern composite** combinant OAuth2 + mTLS (Pattern 5). Ces patterns fournissent une preuve d'identité cryptographique, une défense contre le vol de token, et des pistes d'audit conformes aux exigences réglementaires. Voir [Conformité DORA et NIS2](/blog/dora-nis2-api-gateway-compliance) pour les exigences spécifiques à l'UE.

---

## Lectures complémentaires

- [Qu'est-ce qu'un MCP Gateway](/blog/what-is-mcp-gateway) — Pourquoi les agents IA ont besoin d'une infrastructure spécialisée
- [OAuth 2.1 + PKCE pour MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Flux OAuth complet pour les clients publics MCP
- [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis) — Patterns d'intégration sécurisée
- [Vos clés API sont dans votre historique Git](/blog/api-keys-in-git-history) — Détecter et prévenir les fuites de credentials
- [Checklist sécurité API pour développeurs solo](/blog/api-security-checklist-solo-dev) — Mesures de sécurité pratiques pour petites équipes
- [Conformité DORA et NIS2](/blog/dora-nis2-api-gateway-compliance) — Exigences réglementaires EU pour la sécurité API
- [Fiche technique OAuth2 Token Exchange](/docs/guides/fiches/oauth2-token-exchange) — Deep-dive technique sur la RFC 8693
- [Guide de configuration mTLS](/docs/guides/mtls-configuration) — Configuration mTLS pas-à-pas
- [Guide d'authentification](/docs/guides/authentication) — Référence complète d'authentification
- [Configuration sécurité](/docs/reference/security-configuration) — Bonnes pratiques et options de configuration sécurité

---

*Prêt à sécuriser vos agents IA ? [Essayez le MCP Gateway STOA](/docs/guides/quickstart) ou explorez la [documentation sécurité](https://docs.gostoa.dev/docs/enterprise/security-compliance).*
