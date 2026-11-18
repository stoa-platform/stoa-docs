---
sidebar_position: 2
title: "Configuration de l'authentification"
description: "Configurez l'authentification OIDC/OAuth2 avec Keycloak pour la plateforme STOA — realm partagé unique stoa, groupes par tenant, claims JWT tenant_id vérifiés et RBAC."
keywords: [authentification, Keycloak, OIDC, OAuth2, JWT, RBAC, ADR-074]
---

# Configuration de l'authentification

Configurez l'authentification et l'autorisation pour la plateforme STOA avec Keycloak OIDC ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)).

## Vue d'ensemble

STOA utilise **Keycloak 26** pour l'authentification centralisée et l'autorisation filtrée par tenant :

- **Realm partagé unique (`stoa`)** — Un seul émetteur OIDC (`/realms/stoa`) pour toute la plateforme ; pas de realm distinct par tenant ([ADR-074](/docs/architecture/adr/adr-074-tenant-model))
- **Un groupe Keycloak par tenant** — Provisionné automatiquement (`setup_tenant_group`) lors de la création d'un tenant
- **Claim JWT `tenant_id` vérifié** — Contrôlé après vérification de la signature JWKS RS256 dans l'API Control Plane et dans `stoa-gateway`
- **OAuth 2.1 + PKCE & DCR** — Découverte d'authentification native pour les agents MCP (`/.well-known/oauth-protected-resource`)

## Architecture Keycloak

```
┌──────────────────────────────────────────────────────────┐
│                  Keycloak (Realm 'stoa')                 │
├──────────────────────────────────────────────────────────┤
│  Clients OIDC :                                          │
│  ├── control-plane-ui  (Public, PKCE)                    │
│  ├── stoa-portal       (Public, PKCE)                    │
│  ├── stoactl           (Public, PKCE / Device)           │
│  └── stoa-mcp / clients API (Confidentiels ou DCR)       │
├──────────────────────────────────────────────────────────┤
│  Groupes Tenants racine (+ attribut utilisateur tenant_id):│
│  ├── /acme                                               │
│  ├── /globex                                             │
│  └── /initech                                            │
└──────────────────────────────────────────────────────────┘
```

:::info Fédération d'IdP externes
Le courtage multi-IdP (OIDC, SAML, LDAP) est démontré uniquement dans des realms de démonstration dédiés (profil `federation` de `deploy/docker-compose/`) et n'est pas attesté dans l'import du realm produit `stoa` ([ADR-074](/docs/architecture/adr/adr-074-tenant-model)).
:::

## Configurer OIDC pour une API {#setup-oidc-for-an-api}

### Étape 1 : Provisionner un tenant et son groupe

La création d'un tenant via `stoactl` ou l'API Control Plane déclenche `TenantProvisioningService`, qui crée le groupe Keycloak racine correspondant (`/<tenant_id>`) dans le realm `stoa` (`keycloak_service.py:setup_tenant_group`), tandis que `add_user_to_tenant` renseigne l'attribut utilisateur `tenant_id` projeté dans le claim JWT :

```bash
# Authentifier stoactl auprès du realm stoa
stoactl auth login

# Créer un tenant (--name et --owner-email sont obligatoires ; crée le groupe Keycloak /acme)
stoactl tenant create --name acme --display-name "Acme Corp" --owner-email admin@example.com
stoactl tenant status acme
```

### Étape 2 : Configurer OIDC et l'audience sur STOA Gateway

Configurez `stoa-gateway` pour valider les jetons émis par le realm `stoa` et exiger une audience explicite :

```bash
STOA_KEYCLOAK_URL=https://auth.example.com
STOA_KEYCLOAK_REALM=stoa
STOA_MCP_AUDIENCE=stoa-mcp
# Optionnel : pour activer le serveur gRPC ext_authz destiné à Envoy (ADR-073 ; audience + scopes non vides requis en prod)
STOA_EXT_AUTHZ_GRPC_ADDR=127.0.0.1:9001
STOA_EXT_AUTHZ_AUDIENCE=stoa-api
STOA_EXT_AUTHZ_REQUIRED_SCOPES=stoa:read
```

Pour exposer une route REST protégée par JWT sur `stoa-gateway`, déclarez un contrat UAC avec `"inboundAuth": "jwt"` via `POST /admin/contracts` (conforme à `quickstart/verify.sh` ; `RestBinder` monte chaque endpoint sous `/apis/{tenant_id}/{contract.name}{endpoint.path}` et contrôle `inboundAuthAudience` lorsqu'il est renseigné sur le contrat, ou le validateur OIDC par défaut de la passerelle sinon — distinct de `STOA_MCP_AUDIENCE`) :

```bash
curl -sS -X POST "${STOA_GATEWAY_URL}/admin/contracts" \
  -H "Authorization: Bearer ${STOA_ADMIN_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "orders-api",
    "version": "1.0.0",
    "tenant_id": "acme",
    "status": "published",
    "classification": "H",
    "inboundAuth": "jwt",
    "endpoints": [
      {
        "path": "/orders",
        "methods": ["GET"],
        "backend_url": "http://orders-backend:8080"
      }
    ]
  }'
```

### Étape 3 : Tester l'authentification

Obtenez un jeton auprès du realm `stoa` (le client de service devant émettre `tenant_id: "acme"` ainsi que l'audience REST attendue — `inboundAuthAudience` si configurée sur le contrat, sinon le validateur OIDC par défaut de la passerelle, distincte du réglage `STOA_MCP_AUDIENCE`) et appelez le chemin monté `/apis/acme/orders-api/orders` :

```bash
# Demander un jeton d'accès auprès du realm partagé 'stoa'
TOKEN=$(curl -sS -X POST \
  "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Appeler la route passerelle protégée par JWT montée sous /apis/{tenant_id}/{contract.name}{endpoint.path}
curl -i "${STOA_GATEWAY_URL}/apis/acme/orders-api/orders" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Flux d'authentification {#authentication-flows}

Tous les endpoints OIDC sont servis sous `/realms/stoa/protocol/openid-connect/` :

### 1. Flux Client Credentials (Machine-à-Machine)

```http
POST /realms/stoa/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=acme-service-client&
client_secret=<CLIENT_SECRET>&
grant_type=client_credentials&
scope=openid stoa:read
```

### 2. Flux Authorization Code + PKCE (Interfaces Web, CLI & Agents MCP)

```http
# Étape 1 : Rediriger l'utilisateur avec PKCE code_challenge
GET /realms/stoa/protocol/openid-connect/auth
  ?client_id=stoa-portal
  &redirect_uri=https://portal.example.com/callback
  &response_type=code
  &scope=openid profile email
  &code_challenge=<BASE64URL_SHA256>
  &code_challenge_method=S256

# Étape 2 : Échanger le code d'autorisation + code_verifier
POST /realms/stoa/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=stoa-portal&
code=<AUTH_CODE>&
code_verifier=<CODE_VERIFIER>&
grant_type=authorization_code&
redirect_uri=https://portal.example.com/callback
```

### 3. Enregistrement dynamique de clients OAuth 2.1 (Clients MCP)

Les agents IA qui se connectent à `stoa-gateway` découvrent les métadonnées OAuth sur `GET /.well-known/oauth-protected-resource` et `GET /.well-known/oauth-authorization-server`, puis enregistrent un client public PKCE via `POST /oauth/register` ([ADR-044](/docs/architecture/adr/adr-044-mcp-oauth-gateway-proxy)).

## Validation des jetons {#token-validation}

`stoa-gateway` et l'API Control Plane vérifient la signature RS256, l'émetteur et l'expiration sur chaque JWT Bearer, avec des règles d'audience et d'isolation tenant propres à chaque parcours :

1. **Signature RS256 & Émetteur (`iss`)** — Vérifiés auprès du JWKS du realm `stoa` (`/realms/stoa/protocol/openid-connect/certs`)
2. **Expiration (`exp`)** — Rejette les jetons expirés (`401 Unauthorized`)
3. **Audience (`aud`) — Selon le parcours** — `control-plane-api` désactive `verify_aud` lors du décodage JWT (`auth/dependencies.py`). Sur `stoa-gateway`, les endpoints MCP exigent `STOA_MCP_AUDIENCE` (fail-closed si absent), `ext_authz` gRPC Envoy exige `STOA_EXT_AUTHZ_AUDIENCE` (fail-closed si absent), et les routes REST UAC publiées valident `inboundAuthAudience` lorsqu'elle est définie sur le contrat (sinon le validateur OIDC par défaut de la passerelle)
4. **Isolation tenant (`tenant_id`)** — Le RBAC du Control Plane (`require_tenant_access`, ainsi que `RbacEnforcer` côté Rust lorsque son champ de configuration `enforce_tenant_isolation` est activé) rejette tout accès inter-tenant avec `403 Forbidden` sauf rôle plateforme `cpi-admin` ; MCP `tools/list` et `ext_authz` gRPC Envoy exigent un `tenant_id` vérifié correspondant au tenant/route cible sans bypass inter-tenant `cpi-admin`, tandis que les routes REST UAC publiées (`jwt_validation` dans `proxy/dynamic.rs`) vérifient le JWT et l'audience en mode fail-closed sans comparer le claim `tenant_id` du jeton à `route.tenant_id`

## Contrôle d'accès basé sur les rôles (RBAC) {#role-based-access-control-rbac}

STOA associe les rôles Keycloak du realm `stoa` à quatre rôles canoniques ([ADR-054](/docs/architecture/adr/adr-054-rbac-taxonomy-v2)) :

| Rôle | Portée | Scopes dérivés (`stoa-gateway`) | Permissions |
|------|--------|---------------------------------|-------------|
| `cpi-admin` | Plateforme (RBAC Control Plane) | `stoa:read`, `stoa:write`, `stoa:execute`, `stoa:deploy`, `stoa:audit` (`stoa:admin` doit être émis explicitement) | Administration inter-tenant sur le Control Plane |
| `tenant-admin` | Tenant (`tenant_id`) | `stoa:read`, `stoa:write`, `stoa:execute` | Gestion des API, outils, utilisateurs et abonnements de son tenant |
| `devops` | Tenant (`tenant_id`) | `stoa:read`, `stoa:write`, `stoa:deploy` | Déploiement des contrats et liaisons de son tenant |
| `viewer` | Tenant (`tenant_id`) | `stoa:read` | Lecture seule sur le catalogue et les métriques de son tenant |

## Configuration avancée {#advanced-configuration}

### Protocol Mappers (Claim `tenant_id`)

Les scopes clients Keycloak incluent un mapper de protocole qui injecte le claim `tenant_id` vérifié dans les jetons d'accès afin que les politiques aval ne se fient jamais à un en-tête `X-Tenant-ID` fourni par le client.

### Jetons liés à l'émetteur (mTLS & DPoP)

Pour les environnements régulés, `stoa-gateway` prend en charge les jetons liés au certificat client RFC 8705 (`cnf.x5t#S256`, [ADR-039](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens)) et la validation de preuve DPoP RFC 9449 ([ADR-056](/docs/architecture/adr/adr-056-fapi-2-architecture)).

## Dépannage

### Vérifier la session CLI et la découverte OIDC

```bash
# Inspecter le statut d'authentification et le contexte courant de stoactl
stoactl auth status

# Vérifier la découverte OIDC Keycloak sur le realm 'stoa'
curl -sS "${STOA_AUTH_URL}/realms/stoa/.well-known/openid-configuration" | jq '{issuer, jwks_uri}'
```

### Problèmes courants

- **`401 Unauthorized` (signature ou émetteur invalide)** : Vérifiez que `STOA_KEYCLOAK_URL` correspond au claim `iss` externe du jeton (utilisez `STOA_KEYCLOAK_INTERNAL_URL` si l'URL interne au cluster pour le JWKS diffère).
- **`401` / `503` (audience absente ou non concordante)** : Vérifiez que `STOA_MCP_AUDIENCE` (ou `STOA_EXT_AUTHZ_AUDIENCE`) correspond au claim `aud` émis par Keycloak.
- **`403 Forbidden` (tenant non concordant)** : Confirmez que l'utilisateur appartient au groupe Keycloak du tenant cible et que le jeton porte le claim `tenant_id` correspondant.

---

## Étapes suivantes

- [Isolation multi-tenant](/docs/concepts/multi-tenant) — Groupes du realm `stoa`, `tenant_id` et politiques signées
- [Abonnements API](/docs/guides/subscriptions) — Gérer l'accès consommateur à vos API
- [Référence API Control Plane](/docs/api/control-plane) — Explorer les endpoints du Plan de contrôle
- [API Passerelle MCP](/docs/api/mcp-gateway) — Connecter des agents IA à vos outils

---

**Besoin d'aide ?** [GitHub Issues](https://github.com/stoa-platform/stoa/issues) · [Discord](https://discord.gostoa.dev)
