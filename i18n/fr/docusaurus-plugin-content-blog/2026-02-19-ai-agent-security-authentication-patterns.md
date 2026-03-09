---
slug: ai-agent-security-authentication-patterns
title: "Auth pour agents IA : OAuth, mTLS, JWT — 5 patterns production"
description: "Les API keys ne suffiront pas pour sécuriser les agents IA. 5 patterns d'auth (OAuth 2.1, mTLS, échange de token) avec exemples de code et scénarios d'attaque réels."
authors: [stoa-team]
tags: [tutorial, security, ai, mcp]
keywords:
  - ai agent api authentication security
  - ai agent oauth2 authentication
  - mcp gateway security patterns
  - ai agent mtls certificate binding
  - enterprise ai agent access control
---
<!-- last verified: 2026-02 -->

Les agents IA ont besoin d'un accès programmatique aux APIs, mais les patterns d'authentification traditionnels conçus pour les utilisateurs humains — cookies de navigateur, tokens de session, flows d'autorisation OAuth2 — ne fonctionnent pas. **Les agents IA sont des services autonomes, pas des utilisateurs**. Ils opèrent sans navigateur, sans interactions humaines dans la boucle, et à la vitesse des machines. Cet article présente cinq patterns d'authentification qui fonctionnent pour les agents IA, du plus simple (API keys) au plus sécurisé (liaison de certificat mTLS), avec des exemples d'implémentation pratiques pour chacun.

Il fait partie de la série [Qu'est-ce qu'un MCP Gateway](/blog/what-is-mcp-gateway). Pour le contexte plus large sur pourquoi les agents IA ont besoin d'une infrastructure spécialisée, consultez [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis).

<!-- truncate -->

## Pourquoi les agents IA ont besoin d'une authentification différente

Les flows d'authentification traditionnels supposent qu'un utilisateur humain interagit avec un navigateur :

1. L'utilisateur clique sur "Se connecter"
2. Redirigé vers le fournisseur d'identité
3. Saisit ses credentials, approuve le consentement
4. Redirigé avec un code d'autorisation
5. L'application échange le code contre un access token

**Cela ne fonctionne pas pour les agents IA.** Ils n'ont pas de navigateur, pas d'écran de consentement interactif, pas d'URI de redirection. Ils ont besoin de patterns d'authentification machine-à-machine : credentials en entrée, access token en sortie, sans interaction humaine.

Mais les agents IA ont des défis de sécurité uniques qui vont au-delà des comptes de service traditionnels :

### Risque d'injection de prompt

Le comportement d'un agent IA peut être manipulé via les entrées utilisateur, le contenu de documents ou des prompts malveillants. Si un agent est trompé pour appeler une API qu'il ne devrait pas, la couche d'authentification doit intercepter cela avant que l'appel s'exécute.

### Contraintes de budget de tokens

Chaque header d'authentification, chaque claim JWT, chaque chaîne de certificats consomme des tokens de la fenêtre de contexte de l'agent. Les mécanismes d'authentification doivent être économes en tokens sans compromettre la sécurité.

### Isolation multi-tenant

Une seule infrastructure d'agents IA peut servir des dizaines ou centaines de tenants. L'authentification doit appliquer des frontières strictes entre tenants afin que l'Agent A (tenant X) ne puisse pas accéder aux APIs enregistrées pour l'Agent B (tenant Y).

### Exigences d'audit

Quand un agent IA appelle une API, les frameworks de conformité (RGPD, DORA, NIS2) requièrent de savoir non seulement quel agent, mais aussi quel humain a initié la session agent, quelles données ont été accédées, et si l'appel était autorisé. Les API keys traditionnelles ("quel service a appelé ça ?") sont insuffisantes.

## Pattern 1 : API Keys — le plus simple, mais à utiliser avec précaution

Les API keys sont la méthode d'authentification la plus directe : un secret statique passé dans un header HTTP.

### Comment ça fonctionne

```bash
# L'agent IA appelle une API avec une API key
curl -X POST https://api.example.com/v1/action \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{"input": "data"}'
```

Le serveur API valide la clé contre une base de données de clés connues, récupère les permissions associées et traite la requête.

### Quand utiliser les API Keys

- **Preuve de concept** ou **environnements sandbox** avec des exigences de conformité minimales.
- Déploiements **mono-tenant** où un agent accède à une API.
- Cas d'usage **faible sécurité** (lecture de données publiques, opérations non sensibles).

### Les risques

Les API keys sont des **secrets à longue durée de vie**. Si le prompt d'un agent IA peut être manipulé pour exfiltrer sa clé API (via une réponse d'outil malicieuse, par exemple), un attaquant peut rejouer cette clé indéfiniment jusqu'à ce qu'elle soit révoquée manuellement.

Consultez [Vos API keys sont dans votre historique Git](/blog/api-keys-in-git-history) pour le vecteur de fuite le plus courant : les développeurs qui codent des clés en dur et les committent.

### Bonnes pratiques pour les API Keys avec les agents IA

```python
# Mauvais : API key codée en dur dans le prompt de l'agent
agent_prompt = """
You are a support agent with access to the CRM.
Your API key is: sk_live_abc123xyz
"""

# Bon : API key injectée à l'exécution depuis l'environnement
import os

api_key = os.environ["AGENT_API_KEY"]
# Ne jamais passer la clé dans la fenêtre de contexte de l'agent
```

**Défense en profondeur** : même avec l'injection à l'exécution, implémentez :

1. **Listes d'IPs autorisées** — n'acceptez les appels API que depuis des IPs de gateway connues.
2. **Rate limiting** — plafonnez les appels par clé par minute pour détecter les abus.
3. **Rotation des clés** — faites tourner les clés tous les 30 à 90 jours.
4. **Restrictions de scope** — liez chaque clé à des endpoints API spécifiques, pas à tous les endpoints.

Pour les cas d'usage production impliquant des données sensibles ou de la multi-tenancy, passez à OAuth2 ou mTLS.

## Pattern 2 : OAuth2 Client Credentials — machine-à-machine

Le flow OAuth2 Client Credentials est le standard industriel pour l'authentification service-à-service. Il remplace les API keys statiques par des **access tokens à courte durée de vie** qui expirent automatiquement.

### Comment ça fonctionne

1. L'agent IA envoie `client_id` et `client_secret` au serveur d'autorisation.
2. Le serveur d'autorisation valide les credentials et retourne un JWT access token (valable typiquement 1 heure).
3. L'agent IA inclut l'access token dans les appels API.
4. Le token expire ; l'agent en demande un nouveau avant le prochain appel API.

```bash
# Étape 1 : l'agent s'authentifie auprès du serveur OAuth2
curl -X POST https://auth.example.com/oauth/token \
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
curl -X GET https://api.example.com/v1/customers \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Quand utiliser OAuth2 Client Credentials

- **Environnements multi-tenant** où chaque tenant a des comptes de service séparés.
- **Industries réglementées** nécessitant des pistes d'audit liées à des identités spécifiques.
- **Accès médié par gateway** où un MCP gateway gère les tokens au nom des agents.

### Avantages de sécurité par rapport aux API Keys

| Fonctionnalité | API Keys | OAuth2 Client Credentials |
|----------------|----------|---------------------------|
| Durée de vie du token | Indéfinie (jusqu'à révocation) | Courte durée (1 à 24 heures) |
| Rotation | Manuelle | Automatique à l'expiration |
| Piste d'audit | "Cette clé a été utilisée" | "Ce compte de service a agi à ce moment avec ces scopes" |
| Limitation de scope | Aucune (accès API complet) | Granulaire (ex : `crm:read` pas `crm:write`) |
| Révocation | Nécessite la suppression manuelle de la clé | Les tokens expirent automatiquement ; révoquez côté émetteur |

### Implémentation avec Keycloak

STOA utilise [Keycloak](https://www.keycloak.org/) pour OAuth2/OIDC. Voici comment créer un compte de service pour un agent IA :

```bash
# Créer un client Keycloak pour l'agent IA
# (via la Console Admin ou l'API)
curl -X POST https://auth.gostoa.dev/admin/realms/stoa/clients \
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

L'agent s'authentifie ensuite avec les client credentials et reçoit un JWT. Le MCP gateway valide le JWT à chaque invocation de tool.

Pour les détails d'implémentation, consultez le [Guide des comptes de service](/docs/guides/service-accounts).

## Pattern 3 : OAuth2 Token Exchange (RFC 8693) — identité déléguée

L'échange de token OAuth2 (RFC 8693) résout un problème critique : **comment un agent IA peut-il agir au nom d'un utilisateur humain sans avoir son mot de passe ?**

### Le cas d'usage

Un utilisateur s'enregistre comme consommateur dans le STOA Portal et reçoit des credentials initiaux. Un agent IA (ex : Claude avec des tools MCP) doit appeler des APIs au nom de cet utilisateur, mais l'agent ne devrait pas stocker les credentials de longue durée de l'utilisateur. L'échange de token permet à l'agent d'échanger un token émis pour l'utilisateur contre un token à courte durée de vie scopé pour l'agent.

### Comment ça fonctionne

```bash
# Étape 1 : l'utilisateur s'authentifie et reçoit un token consommateur
# (via la connexion au Portal)
USER_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.user_claims..."

# Étape 2 : l'agent échange le token utilisateur contre un token scopé agent
curl -X POST https://auth.gostoa.dev/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$USER_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "requested_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "audience=https://mcp.gostoa.dev" \
  -d "scope=mcp:invoke"

# Réponse :
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.agent_claims...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 3600
}

# Étape 3 : l'agent utilise le nouveau token pour appeler le MCP Gateway
curl -X POST https://mcp.gostoa.dev/tools/search-contacts/invoke \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.agent_claims..." \
  -d '{"query": "Jane Doe"}'
```

### Le modèle de sécurité

L'échange de token maintient une **chaîne de confiance** :

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
    "sub": "agent-crm-assistant"  // Agent acteur
  },
  "aud": "https://mcp.gostoa.dev",
  "scope": "mcp:invoke crm:read",
  "exp": 1234567890
}
```

Les logs d'audit peuvent maintenant enregistrer : "L'agent `agent-crm-assistant` a invoqué `search-contacts` au nom de l'utilisateur `user-123` à 14h30 UTC."

Pour les détails d'implémentation, consultez la [Fiche OAuth2 Token Exchange](/docs/guides/fiches/oauth2-token-exchange).

## Pattern 4 : liaison de certificat mTLS (RFC 8705) — sécurité maximale

Le TLS mutuel (mTLS) avec tokens liés aux certificats est le gold standard pour l'authentification des agents IA. Il combine la preuve cryptographique d'identité avec une défense contre le vol de tokens.

### Comment mTLS fonctionne

Dans TLS traditionnel, seul le serveur prouve son identité (via un certificat). Dans le **TLS mutuel**, le client présente également un certificat :

1. L'agent se connecte à l'API gateway avec TLS.
2. Le gateway demande le certificat du client.
3. L'agent présente un certificat signé par une CA de confiance.
4. Le gateway valide le certificat et extrait l'identité de l'agent depuis le Subject DN.
5. Le gateway émet un token **lié à l'empreinte du certificat**.

Si un attaquant vole le token, il ne peut pas l'utiliser sans avoir aussi la clé privée de l'agent.

### Tokens liés aux certificats (RFC 8705)

Quand le gateway émet un access token, il inclut un claim `cnf` (confirmation) qui lie le token au certificat :

```json
{
  "sub": "agent-production-01",
  "aud": "https://mcp.gostoa.dev",
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
  -subj "/CN=ai-agent-prod/O=AcmeCorp" \
  -keyout agent.key -out agent.crt

# Étape 2 : l'agent s'authentifie avec mTLS et reçoit un token lié au cert
curl -X POST https://auth.gostoa.dev/oauth/token \
  --cert agent.crt --key agent.key \
  -d "grant_type=client_credentials" \
  -d "client_id=agent-prod"

# Réponse : access token avec claim cnf

# Étape 3 : l'agent appelle l'API avec token et certificat
curl -X POST https://mcp.gostoa.dev/tools/delete-user/invoke \
  --cert agent.crt --key agent.key \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"user_id": "12345"}'
```

Le gateway valide :

1. **Le certificat est valide** (non expiré, signé par une CA de confiance).
2. **Le certificat correspond au claim `cnf` du token** (prévient le vol de token).
3. **L'agent est autorisé** à invoquer ce tool (vérification de politique OPA).

### Quand utiliser mTLS

- **Environnements haute sécurité** (services financiers, santé, défense).
- **Architectures zero-trust** où chaque service doit prouver son identité.
- **Exigences de conformité** imposant une authentification cryptographique (PCI-DSS, FedRAMP).

Pour les détails de configuration, consultez le [Guide de configuration mTLS](/docs/guides/mtls-configuration).

## Pattern 5 : patterns composites — défense en profondeur

En production, les déploiements les plus sécurisés combinent plusieurs patterns :

### Exemple : OAuth2 + mTLS

1. L'agent s'authentifie avec **mTLS** (prouve son identité cryptographiquement).
2. Le serveur d'autorisation émet un **token OAuth2 lié au certificat**.
3. L'agent utilise le token pour les appels API (validé via mTLS + JWT).

Cela fournit une **sécurité en couches** :

- **Le vol de token** est atténué (inutilisable sans la clé privée).
- **La compromission du certificat** est atténuée (révoquez le cert, les tokens expirent automatiquement).
- **La piste d'audit** inclut à la fois l'identité cryptographique (DN du certificat) et l'identité logique (claims OAuth2).

### Exemple : échange de token + rate limiting

1. Token utilisateur échangé contre un token scopé agent (Pattern 3).
2. Le MCP gateway applique des **quotas par utilisateur** basés sur l'identité de l'utilisateur original.

Si le compte d'un utilisateur est compromis et qu'un attaquant essaie d'abuser de l'agent IA, le rate limiter du gateway détecte des patterns d'appels anormaux (100 appels/seconde d'un utilisateur qui fait normalement 5 appels/jour) et bloque les requêtes suivantes.

### Exemple : API Keys pour le développement, OAuth2 pour la production

- **Environnement de développement** : les agents utilisent des API keys (itération rapide, pas de gestion de certificats).
- **Environnement de staging** : les agents utilisent OAuth2 client credentials (tester l'expiration et la rotation des tokens).
- **Environnement de production** : les agents utilisent mTLS + tokens liés aux certificats (sécurité maximale).

Cette progression réduit les frictions pendant le développement tout en garantissant que les déploiements production respectent les standards de sécurité.

## Comparaison : quel pattern choisir ?

| Pattern | Niveau de sécurité | Complexité | Idéal pour | Risque de vol de token | Compatible agent IA |
|---------|-------------------|-----------|-----------|----------------------|---------------------|
| **API Keys** | Faible | Très faible | POCs, sandbox, faible sécurité | Élevé (secret statique) | ✅ Oui |
| **OAuth2 Client Credentials** | Moyen | Faible | Multi-tenant, comptes de service | Moyen (tokens à courte durée) | ✅ Oui |
| **OAuth2 Token Exchange** | Moyen-Élevé | Moyen | Accès délégué, attribution utilisateur | Moyen (chaîne de délégation) | ✅ Oui |
| **Liaison de cert mTLS** | Très élevé | Élevé | Zero-trust, haute sécurité, conformité | Très faible (clé privée requise) | ✅ Oui |
| **Composite (OAuth2 + mTLS)** | Maximum | Élevé | Services financiers, défense, santé | Minimal (défenses en couches) | ✅ Oui |

**Heuristique de décision** :

- **Mono-tenant, faible conformité** → API Keys (Pattern 1)
- **Multi-tenant, conformité standard** → OAuth2 Client Credentials (Pattern 2)
- **Délégation utilisateur-agent, pistes d'audit** → Token Exchange (Pattern 3)
- **Zero-trust, infrastructure critique** → mTLS (Pattern 4)
- **Sécurité maximale, industrie réglementée** → Composite (Pattern 5)

## Comment STOA implémente l'authentification des agents IA

Le MCP Gateway de STOA supporte les cinq patterns via une **chaîne de middleware** qui applique authentification, autorisation et enforcement de politiques avant que toute invocation de tool n'atteigne les systèmes backend.

### Middleware d'authentification

Le gateway détecte la méthode d'authentification depuis les headers de la requête et valide en conséquence :

```rust
// Pseudo-code simplifié (STOA est implémenté en Rust)
match request.headers.get("Authorization") {
    Some("Bearer <token>") => {
        // Validation du token OAuth2
        validate_jwt(token)?;
        extract_claims(token)
    },
    Some("ApiKey <key>") => {
        // Recherche de l'API key
        lookup_api_key(key)?
    },
    None => {
        // Vérifier le certificat mTLS
        extract_client_cert_dn(tls_connection)?
    }
}
```

### Autorisation avec OPA

Une fois l'identité de l'agent établie, le gateway interroge l'Open Policy Agent :

```rego
package stoa.mcp.authz

import future.keywords.if

# Autoriser l'invocation du tool si l'agent a le scope requis
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

Cela découple l'authentification (qui êtes-vous ?) de l'autorisation (que pouvez-vous faire ?), permettant des politiques granulaires sans coder des règles en dur dans le code du gateway.

### Validation du token lié au certificat

Pour les requêtes mTLS, le gateway valide la liaison du certificat :

```rust
// Extraire l'empreinte du cert depuis la connexion TLS
let cert_hash = sha256(client_cert.as_der());

// Extraire le claim cnf depuis le JWT
let token_cnf = jwt_claims.get("cnf")?.get("x5t#S256")?;

// Valider la liaison
if cert_hash != token_cnf {
    return Err("Certificate binding mismatch");
}
```

Cela prévient les attaques par replay de token même si le token est intercepté.

### Journalisation d'audit

Chaque requête authentifiée génère un événement d'audit :

```json
{
  "timestamp": "2026-02-19T10:30:00Z",
  "agent_id": "agent-prod-01",
  "auth_method": "mtls",
  "cert_subject": "CN=agent-prod-01,O=AcmeCorp",
  "user_id": "user-123",  // Depuis l'échange de token
  "tenant": "acme",
  "tool": "delete-user",
  "input": {"user_id": "12345"},
  "result": "success",
  "policy_decision": "allow"
}
```

Ces événements circulent vers OpenSearch pour le reporting de conformité et la détection d'anomalies.

Pour l'architecture complète, consultez la documentation [Concepts MCP Gateway](/docs/concepts/mcp-gateway).

## Bonnes pratiques pour l'authentification des agents IA

Sur la base de déploiements en production, voici les pratiques qui comptent :

### 1. Ne jamais mettre de credentials dans le contexte de l'agent

```python
# Mauvais : API key dans le prompt système
system_prompt = """
You are a customer service agent.
API Key: sk_live_abc123
"""

# Bon : credentials injectés par le runtime
# L'agent ne voit jamais la clé, le gateway gère l'authentification
```

### 2. Utiliser des tokens à courte durée de vie

Les tokens OAuth2 devraient expirer dans un délai de 1 à 24 heures. Cela limite la fenêtre d'opportunité si un token est compromis.

### 3. Faire tourner les secrets automatiquement

Pour les API keys et client secrets, implémentez une rotation automatique tous les 30 à 90 jours. STOA s'intègre avec Vault pour cela. Consultez le [Guide de gestion des secrets](/docs/reference/security-configuration).

### 4. Surveiller les anomalies d'authentification

Suivez les tentatives d'authentification échouées par agent. Si un agent qui s'authentifie normalement une fois par heure tente soudainement de s'authentifier 100 fois en une minute, enquêtez immédiatement.

### 5. Implémenter une sécurité progressive

Commencez par les API keys en développement, passez à OAuth2 en staging, appliquez mTLS en production. Cela réduit les frictions pendant le développement tout en garantissant que les déploiements production respectent les standards de sécurité.

## Foire aux questions

### Quelle est la différence entre les API keys et les tokens OAuth2 pour les agents IA ?

Les API keys sont des secrets statiques à durée de vie indéfinie, comme des mots de passe. Les tokens OAuth2 ont une courte durée de vie (typiquement 1 heure), expirent automatiquement, et incluent des métadonnées (scopes, émetteur, sujet) qui permettent une autorisation granulaire. Pour les agents IA en production, OAuth2 fournit une meilleure sécurité via la rotation automatique, les limitations de scope et les pistes d'audit. Les API keys sont acceptables pour le développement ou les cas d'usage à faible sécurité.

### Comment mTLS prévient-il le vol de token ?

mTLS lie l'access token au certificat du client via le claim `cnf` (confirmation) dans le JWT. Même si un attaquant intercepte le token, il ne peut pas l'utiliser sans la clé privée du client. Le gateway valide que le certificat présenté lors de l'appel API correspond au hash du certificat dans le claim `cnf` du token. Cela est spécifié dans la RFC 8705 (OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens).

### Puis-je utiliser l'échange de token OAuth2 avec Claude ou GPT ?

Oui, mais vous avez besoin d'un MCP gateway pour médier l'échange. Claude et GPT ne supportent pas nativement l'échange de token OAuth2. Le flow est : (1) l'utilisateur s'authentifie et reçoit un token, (2) le MCP gateway échange le token utilisateur contre un token scopé agent au nom de Claude/GPT, (3) l'agent utilise le nouveau token pour invoquer des tools MCP. Le gateway de STOA implémente ce pattern. Consultez le [Guide d'onboarding des consommateurs](/docs/guides/consumer-onboarding) pour les détails d'implémentation.

### Quel pattern d'authentification utiliser pour les agents IA dans une industrie réglementée ?

Pour les industries réglementées (services financiers, santé, défense) nécessitant la conformité avec des standards comme PCI-DSS, HIPAA ou FedRAMP, utilisez **mTLS avec tokens liés aux certificats** (Pattern 4) ou un **pattern composite** combinant OAuth2 + mTLS (Pattern 5). Ceux-ci fournissent une preuve cryptographique d'identité, une défense contre le vol de token et des pistes d'audit répondant aux exigences réglementaires. Consultez [Conformité DORA et NIS2](/blog/dora-nis2-api-gateway-compliance) pour les exigences spécifiques à l'UE.

---

## Lectures complémentaires

- [Qu'est-ce qu'un MCP Gateway](/blog/what-is-mcp-gateway) — Pourquoi les agents IA ont besoin d'une infrastructure spécialisée
- [OAuth 2.1 + PKCE pour les MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Flow OAuth complet pour les clients MCP publics
- [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis) — Patterns pratiques pour une intégration sécurisée
- [Vos API keys sont dans votre historique Git](/blog/api-keys-in-git-history) — Comment détecter et prévenir les fuites de credentials
- [Checklist de sécurité API pour développeurs solo](/blog/api-security-checklist-solo-dev) — Mesures de sécurité pratiques pour les petites équipes
- [Conformité DORA et NIS2](/blog/dora-nis2-api-gateway-compliance) — Exigences réglementaires EU pour la sécurité API
- [Fiche OAuth2 Token Exchange](/docs/guides/fiches/oauth2-token-exchange) — Analyse technique approfondie de la RFC 8693
- [Guide de configuration mTLS](/docs/guides/mtls-configuration) — Configuration mTLS étape par étape
- [Guide d'authentification](/docs/guides/authentication) — Référence complète d'authentification
- [Configuration de sécurité](/docs/reference/security-configuration) — Bonnes pratiques de sécurité et options de configuration

---

*Prêt à sécuriser vos agents IA ? [Essayez le MCP Gateway de STOA](/docs/guides/quickstart) ou explorez la [documentation de sécurité](https://docs.gostoa.dev/docs/enterprise/security-compliance).*
