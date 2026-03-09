---
sidebar_position: 4
slug: /tutorials/bridge-oracle-oam
title: "Pont Oracle OAM via Keycloak (RFC 8693)"
description: "Fédérez l'identité Oracle OAM dans STOA grâce à l'échange de tokens IETF (RFC 8693) — sans migration, sans perturbation des utilisateurs."
keywords:
  - migration Oracle OAM
  - échange de tokens RFC 8693
  - fédération d'identité
  - pont Keycloak OAM
  - pont identité legacy
---

# Pont Oracle OAM via Keycloak

Connectez votre fournisseur d'identité Oracle OAM à STOA sans migrer les utilisateurs ni perturber les applications existantes.

## Ce que vous allez accomplir

À la fin de ce tutoriel :
- Les tokens Oracle OAM sont échangés contre des tokens OIDC compatibles STOA via RFC 8693
- Les utilisateurs s'authentifient avec OAM comme avant — aucun changement pour eux
- Les API et outils MCP de STOA acceptent les tokens échangés
- Piste d'audit complète entre les deux systèmes d'identité

## Le problème

Votre organisation utilise Oracle OAM pour l'identité. Vous voulez utiliser STOA pour la gestion d'API et la gouvernance MCP. Mais :
- Migrer 10 000 utilisateurs d'OAM vers Keycloak est un projet de 6 mois
- Les applications dépendent des tokens OAM — vous ne pouvez pas les casser
- Vous avez besoin que les deux systèmes coexistent pendant la transition

## La solution : Échange de tokens (RFC 8693)

```
Utilisateur → Oracle OAM → Token OAM
                                ↓
                   Échange de tokens Keycloak (RFC 8693)
                                ↓
                           Token OIDC (compatible STOA)
                                ↓
                   Passerelle STOA → API / Outils MCP
```

L'utilisateur s'authentifie avec OAM comme toujours. En coulisses, Keycloak échange le token OAM contre un token OIDC que STOA comprend.

## Étape 1 : Configurer le fournisseur d'identité Keycloak

Dans Keycloak, créez un nouveau fournisseur d'identité pour Oracle OAM :

1. Allez dans **Fournisseurs d'identité > Ajouter un fournisseur > OpenID Connect v1.0**
2. Configurez les endpoints OAM :

```
URL d'autorisation : https://oam.yourcompany.com/oauth2/authorize
URL de token : https://oam.yourcompany.com/oauth2/token
Client ID : stoa-bridge
Client Secret : (depuis l'admin OAM)
```

3. Activez **Faire confiance à l'email** (OAM a déjà vérifié l'email)
4. Définissez le **Flux de première connexion** sur `first broker login`

## Étape 2 : Activer l'échange de tokens

Dans Keycloak, activez la fonctionnalité d'échange de tokens pour le realm STOA :

1. Allez dans **Clients > stoa-gateway > Permissions**
2. Ajoutez une permission **token-exchange**
3. Autorisez le client `stoa-bridge` à échanger des tokens

Configurez la politique d'échange de tokens :

```json
{
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "audience": "stoa-gateway"
}
```

## Étape 3 : Échanger le token

Lorsqu'un utilisateur arrive avec un token OAM, échangez-le contre un token STOA :

```bash
# Échanger token OAM → token STOA
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$OAM_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "requested_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "client_id=stoa-bridge" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "audience=stoa-gateway"
```

Réponse :
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

## Étape 4 : Utiliser le token échangé

Le token échangé fonctionne avec toutes les API et outils MCP de STOA :

```bash
# Appeler une API REST
curl ${STOA_GATEWAY_URL}/api/v1/data \
  -H "Authorization: Bearer $EXCHANGED_TOKEN"

# Appeler un outil MCP
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer $EXCHANGED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "get-report", "arguments": {"id": "Q4-2025"}}'
```

L'identité OAM de l'utilisateur (nom, email, groupes) est préservée dans les claims du token échangé. Les politiques RBAC de STOA s'appliquent sur ces claims.

## Ce qui se passe pendant la transition

| Semaine | Action | Impact utilisateur |
|---------|--------|-------------------|
| 1 | Configurer IDP Keycloak + échange de tokens | Aucun |
| 2 | Router le nouveau trafic API via STOA | Aucun |
| 3-12 | Migrer progressivement les applications vers les tokens STOA | Aucun |
| 13+ | Décommissionner OAM (quand vous êtes prêts) | Réinitialisation mot de passe |

Les utilisateurs ne remarquent jamais le pont. Les applications adoptent progressivement les tokens STOA à leur propre rythme.

## Étapes suivantes

- [Guide complet de migration Oracle OAM](/docs/guides/migration/oracle-oam)
- [Échange de tokens OAuth2 en détail](/docs/guides/fiches/oauth2-token-exchange)
- [Configuration mTLS](/docs/guides/mtls-configuration)
- [Comptes de service](/docs/guides/service-accounts)
