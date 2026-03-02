---
sidebar_position: 2
title: "Configuration de l'authentification"
description: "Configurez l'authentification OIDC/OAuth2 avec Keycloak pour la plateforme STOA — multi-realm, jetons JWT et contrôle d'accès basé sur les rôles."
keywords: [authentification, Keycloak, OIDC, OAuth2, JWT, RBAC]
---

# Configuration de l'authentification

Configurez l'authentification et l'autorisation avec Keycloak OIDC.

## Vue d'ensemble

STOA utilise Keycloak pour l'authentification et l'autorisation centralisées :

- **OIDC/OAuth2** - Protocoles standard de l'industrie
- **Multi-Realm** - Realm isolé par tenant
- **Jetons JWT** - Validation de jetons stateless
- **Support SSO** - Authentification unique entre les API

## Architecture Keycloak

```
┌──────────────────────────────────────────────┐
│           Keycloak Master Realm              │
├──────────────────────────────────────────────┤
│  Realms par tenant :                         │
│  ├── realm-acme                              │
│  ├── realm-globex                            │
│  └── realm-initech                           │
└──────────────────────────────────────────────┘
```

Chaque realm de tenant contient :
- Utilisateurs et groupes
- Applications clientes
- Rôles et permissions
- Fournisseurs d'identité (SAML, login social)

## Configurer OIDC pour une API {#setup-oidc-for-an-api}

### Étape 1 : Créer un client API dans Keycloak

STOA crée automatiquement un client lorsque vous enregistrez une API :

```bash
stoa api register \
  --tenant acme \
  --name my-api \
  --upstream https://api.example.com \
  --path /my-api \
  --auth-enabled true
```

Cela crée :
- Client ID : `api-my-api`
- Type d'accès : `confidential`
- URI de redirection valides configurées
- Compte de service activé

### Étape 2 : Configurer OIDC sur la passerelle STOA

La passerelle STOA configure automatiquement OIDC, mais vous pouvez personnaliser :

```bash
stoa api auth configure \
  --tenant acme \
  --api my-api \
  --issuer ${STOA_AUTH_URL}/realms/acme \
  --client-id api-my-api \
  --client-secret <secret> \
  --scope openid,profile,email
```

### Étape 3 : Tester l'authentification

```bash
# Obtenir un jeton d'accès
TOKEN=$(curl -X POST \
  ${STOA_AUTH_URL}/realms/acme/protocol/openid-connect/token \
  -d "client_id=api-my-api" \
  -d "client_secret=${STOA_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Appeler l'API avec le jeton
curl ${STOA_GATEWAY_URL}/acme/my-api/users \
  -H "Authorization: Bearer $TOKEN"
```

## Flux d'authentification {#authentication-flows}

### 1. Flux Client Credentials

Pour l'authentification machine-à-machine :

```bash
# Demander un jeton
POST /realms/{tenant}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=api-my-api&
client_secret=${STOA_CLIENT_SECRET}&
grant_type=client_credentials&
scope=api:read api:write
```

### 2. Flux Authorization Code

Pour l'authentification utilisateur (applications web) :

```bash
# Étape 1 : Rediriger l'utilisateur vers la connexion
GET /realms/{tenant}/protocol/openid-connect/auth
  ?client_id=my-web-app
  &redirect_uri=https://myapp.com/callback
  &response_type=code
  &scope=openid

# Étape 2 : Échanger le code contre un jeton
POST /realms/{tenant}/protocol/openid-connect/token
  client_id=my-web-app&
  code=AUTH_CODE&
  grant_type=authorization_code&
  redirect_uri=https://myapp.com/callback
```

### 3. Flux Resource Owner Password

Pour les applications de confiance uniquement :

```bash
POST /realms/{tenant}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=trusted-app&
client_secret=${STOA_CLIENT_SECRET}&
grant_type=password&
username=user@example.com&
password=userpass
```

## Validation des jetons {#token-validation}

La passerelle STOA valide automatiquement les jetons JWT :

1. **Validation de la signature** - Vérifie la signature du jeton à l'aide des clés publiques Keycloak
2. **Vérification de l'expiration** - S'assure que le jeton n'a pas expiré
3. **Validation de l'audience** - Vérifie que le jeton est destiné à la bonne API
4. **Vérification des scopes** - Valide que les scopes requis sont présents

## Contrôle d'accès basé sur les rôles (RBAC) {#role-based-access-control-rbac}

### Définir des rôles dans Keycloak

```bash
# Créer un rôle de realm
stoa auth role create \
  --tenant acme \
  --name api-admin \
  --description "Administrateur API"

# Assigner un rôle à un utilisateur
stoa auth role assign \
  --tenant acme \
  --user user@example.com \
  --role api-admin
```

### Appliquer les rôles dans la passerelle STOA

```bash
# Exiger un rôle spécifique pour une route
stoa api auth require-role \
  --tenant acme \
  --api my-api \
  --path /admin/* \
  --role api-admin
```

## Configuration avancée {#advanced-configuration}

### Claims personnalisées dans les jetons

Ajoutez des claims personnalisées aux jetons JWT :

```bash
stoa auth claim add \
  --tenant acme \
  --name tenant_id \
  --value acme \
  --token-type access
```

### Durée de vie des jetons

Configurez l'expiration des jetons :

```bash
stoa auth token-lifetime set \
  --tenant acme \
  --access-token 3600 \
  --refresh-token 86400
```

### Fédération de fournisseurs d'identité

Connectez des IdP externes (SAML, Google, GitHub) :

```bash
stoa auth idp add \
  --tenant acme \
  --provider google \
  --client-id GOOGLE_CLIENT_ID \
  --client-secret GOOGLE_SECRET
```

## Dépannage

### Échec de validation du jeton

```bash
# Vérifier les détails du jeton
stoa auth token inspect YOUR_TOKEN

# Vérifier la connectivité Keycloak
stoa auth test-connection --tenant acme
```

### Problèmes courants

- **Signature invalide** : Vérifiez que les clés publiques Keycloak sont synchronisées
- **Jeton expiré** : Rafraîchissez le jeton ou demandez-en un nouveau
- **Scope insuffisant** : Assurez-vous que les scopes requis sont dans le jeton
- **Mauvaise audience** : Vérifiez que le client_id correspond à la configuration de l'API

---

## Étapes suivantes

Maintenant que l'authentification est configurée :

- [Abonnements API](/docs/guides/subscriptions) — Gérer l'accès à vos API
- [Référence API](/docs/api/control-plane) — Explorer l'API Control Plane
- [Passerelle MCP](/docs/api/mcp-gateway) — Connecter des agents IA à vos outils
- [FAQ](/docs/faq) — Questions fréquentes

---

**Besoin d'aide ?** [GitHub Issues](https://github.com/stoa-platform/stoa/issues) · [Discord](https://discord.gostoa.dev)
