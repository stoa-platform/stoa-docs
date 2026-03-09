---
sidebar_position: 3
title: Oracle OAM / API Platform
description: "Migrez depuis Oracle Access Manager, OIM et Oracle API Platform vers STOA avec la fédération Keycloak."
keywords: [migration, Oracle OAM, Oracle API Platform, STOA, Keycloak, identity, Oracle migration]
---

# Migration depuis Oracle OAM / API Platform

Ce guide couvre la migration depuis Oracle Access Manager (OAM), Oracle Identity Manager (OIM) et Oracle API Platform vers STOA Platform.

## Ce que Vous Avez

Stack Oracle typique :

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL                                  │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle Access Manager (OAM)              │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ WebGate  │  │  OAM     │  │ Access   │           │     │
│   │  │ Agents   │  │  Server  │  │ Policies │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle Identity Manager (OIM)            │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ User     │  │ Workflow │  │ Entitle- │           │     │
│   │  │ Store    │  │ Engine   │  │ ments    │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Oracle API Platform (optionnel)          │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ Developer│  │ Analytics│           │     │
│   │  │ Gateway  │  │ Portal   │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Points de douleur :                                            │
│  • Structure des claims rigide — difficile à personnaliser    │
│  • Support auth moderne limité (pas de fédération OIDC native) │
│  • Les organisations cherchent souvent des alternatives pour l'optimisation des coûts │
│  • Administration complexe nécessitant une expertise spécialisée │
└─────────────────────────────────────────────────────────────────┘
```

## Ce que STOA Apporte

```
┌─────────────────────────────────────────────────────────────────┐
│                    AVEC STOA                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STOA Control Plane (Cloud)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Portal   │  │ Config   │  │ Keycloak │              │   │
│  │  │ Catalog  │  │ API      │  │ (OIDC)   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                 se fédère avec (ne remplace pas)                │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Oracle OAM/OIM (On-Prem)                    │   │
│  │                  Reste le maître IdP                     │   │
│  │           Keycloak se fédère pour la flexibilité token   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Avantages :                                                    │
│  • Conserver Oracle comme magasin d'identité maître           │
│  • Ajouter la flexibilité OIDC/OAuth2 via Keycloak            │
│  • Token Exchange (RFC 8693) pour le service-to-service       │
│  • Abonnements API en libre-service                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Chemin de Migration

### Phase 1 : Fédération Keycloak avec OAM

**Objectif :** Établir Keycloak comme couche OIDC au-dessus d'OAM

#### Architecture

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│ Consommateur│────▶│  Keycloak  │────▶│  Oracle    │
│            │     │ (Fédéré)   │     │  OAM/OIM   │
└────────────┘     └────────────┘     └────────────┘
       │                  │
       │           Token Exchange
       │           (RFC 8693)
       ▼                  │
┌────────────┐           │
│   STOA     │◀──────────┘
│  Gateway   │
└────────────┘
```

#### Configuration

1. **Créer un Fournisseur d'Identité Keycloak pour OAM**

   ```json
   {
     "alias": "oracle-oam",
     "providerId": "oidc",
     "enabled": true,
     "config": {
       "issuer": "https://oam.corp.local/oauth2",
       "authorizationUrl": "https://oam.corp.local/oauth2/authorize",
       "tokenUrl": "https://oam.corp.local/oauth2/token",
       "userInfoUrl": "https://oam.corp.local/oauth2/userinfo",
       "clientId": "keycloak-federation",
       "clientSecret": "${OAM_CLIENT_SECRET}",
       "defaultScope": "openid profile email",
       "syncMode": "IMPORT"
     }
   }
   ```

2. **Configurer le Mapping des Attributs Utilisateur**

   Mapper les attributs OAM vers les claims Keycloak :

   ```json
   {
     "mappers": [
       {
         "name": "employee-id",
         "protocol": "openid-connect",
         "protocolMapper": "oidc-usermodel-attribute-mapper",
         "config": {
           "user.attribute": "employeeId",
           "claim.name": "employee_id",
           "jsonType.label": "String"
         }
       },
       {
         "name": "department",
         "protocol": "openid-connect",
         "protocolMapper": "oidc-usermodel-attribute-mapper",
         "config": {
           "user.attribute": "department",
           "claim.name": "department",
           "jsonType.label": "String"
         }
       }
     ]
   }
   ```

3. **Activer l'Échange de Tokens**

   ```bash
   # Activer l'échange de tokens dans Keycloak
   /opt/keycloak/bin/kcadm.sh update realms/stoa \
     -s 'attributes.token-exchange-enabled=true'
   ```

### Phase 2 : Enregistrement des APIs

**Objectif :** Importer les définitions Oracle API Platform dans STOA

1. **Exporter depuis Oracle API Platform**

   ```bash
   # Exporter les définitions d'APIs
   curl -X GET "https://oracle-apip/apiplatform/management/v1/apis" \
     -H "Authorization: Bearer $TOKEN" \
     -o oracle-apis.json
   ```

2. **Transformer en OpenAPI**

   ```bash
   # Utiliser le CLI STOA pour la conversion
   stoa api convert --input oracle-apis.json \
     --format oracle --output openapi-apis.json
   ```

3. **Importer dans STOA**

   ```bash
   stoa api import --file openapi-apis.json
   ```

### Phase 3 : Migration des Politiques

**Objectif :** Traduire les politiques Oracle vers le format STOA

#### Correspondance des Politiques

| Politique Oracle OAM | Équivalent STOA |
|----------------------|-----------------|
| Authentication Policy | Politique Client Keycloak |
| Authorization Policy | Politique d'Autorisation STOA |
| Session Policy | Paramètres Session Keycloak |
| Token Policy | Paramètres Token Keycloak |
| Resource Protection | Politique de Route STOA |

#### Exemple : Politique d'Autorisation

Oracle OAM :
```xml
<AuthorizationPolicy name="api-access">
  <Resource>/api/v1/*</Resource>
  <Rule>
    <Condition>group=api-consumers</Condition>
    <Effect>ALLOW</Effect>
  </Rule>
</AuthorizationPolicy>
```

Équivalent STOA :
```yaml
apiVersion: policy.stoa.io/v1
kind: AuthorizationPolicy
metadata:
  name: api-access
spec:
  rules:
  - to:
    - operation:
        paths: ["/api/v1/*"]
    from:
    - source:
        principals: ["group:api-consumers"]
```

### Phase 4 : Migration du Trafic

**Objectif :** Router le trafic via STOA avec l'authentification OAM

1. **Configurer STOA pour valider les tokens OAM (via Keycloak)**

   ```yaml
   apiVersion: security.stoa.io/v1
   kind: JWTValidator
   metadata:
     name: oam-jwt
   spec:
     issuer: https://keycloak.stoa.cloud/realms/stoa
     jwksUri: https://keycloak.stoa.cloud/realms/stoa/protocol/openid-connect/certs
     audiences:
     - stoa-gateway
     claimMappings:
       sub: user_id
       employee_id: employee_id
       department: department
   ```

2. **Tests de Trafic Shadow**

   ```yaml
   apiVersion: networking.stoa.io/v1
   kind: TrafficShadow
   metadata:
     name: oam-shadow
   spec:
     source:
       idp: oracle-oam
     target:
       idp: keycloak-federated
     percentage: 100
     mode: readonly
   ```

3. **Bascule Progressive**

   ```yaml
   apiVersion: networking.stoa.io/v1
   kind: TrafficSplit
   metadata:
     name: oam-migration
   spec:
     routes:
     - authentication: oracle-oam-direct
       weight: 50
     - authentication: keycloak-federated
       weight: 50
   ```

---

## Considérations Spécifiques Oracle

### Ce qui Reste avec Oracle

| Composant | Recommandation |
|-----------|----------------|
| OIM User Store | Conserver comme maître |
| OIM Workflows | Conserver pour le provisionnement |
| OAM WebGate | Supprimer une fois entièrement migré |
| OAM Policies | Migrer vers Keycloak/STOA |

### Ce qui Migre vers STOA/Keycloak

| Composant | Destination |
|-----------|-------------|
| OAuth/OIDC | Keycloak |
| API Gateway | STOA Gateway |
| Developer Portal | STOA Portal |
| Analytics | STOA + Grafana |

### Changements de Format de Token

| Attribut | Oracle OAM | Keycloak/STOA |
|----------|------------|---------------|
| Format du Token | Propriétaire OAM | JWT (RFC 7519) |
| Claims | Limités, rigides | Flexibles, personnalisables |
| Durée de Vie | Session OAM | Configurable par client |
| Refresh | Complexe | refresh_token standard |

### Flexibilité des Claims

L'un des principaux points de douleur d'OAM est la structure rigide des claims. Avec Keycloak :

```javascript
// Mapper de claims personnalisé (JavaScript)
token.setOtherClaims("custom_permissions",
  user.getAttributes().get("permissions").toString());

token.setOtherClaims("api_tier",
  user.getGroups().stream()
    .filter(g => g.getName().startsWith("api-tier-"))
    .findFirst()
    .map(g => g.getName().replace("api-tier-", ""))
    .orElse("basic"));
```

---

## Gestion des Sessions OAM

### Synchronisation des Sessions

Pour maintenir la cohérence des sessions pendant la migration :

```yaml
apiVersion: session.stoa.io/v1
kind: SessionSync
metadata:
  name: oam-keycloak-sync
spec:
  source:
    type: oracle-oam
    sessionCookie: OAM_JSESSIONID
  target:
    type: keycloak
    sessionCookie: KC_SESSION
  synchronization:
    enabled: true
    direction: bidirectional
```

### Single Logout

Configurez le logout back-channel OIDC :

```yaml
apiVersion: security.stoa.io/v1
kind: LogoutConfig
metadata:
  name: federated-logout
spec:
  backChannelLogout:
    enabled: true
    url: https://oam.corp.local/oam/logout
  frontChannelLogout:
    enabled: true
    redirectUri: https://portal.corp.local/logged-out
```

---

## Procédure de Rollback

Oracle OAM reste entièrement opérationnel tout au long de la migration :

```bash
# Rollback immédiat
kubectl apply -f oam-direct-routing.yaml

# Vérifier que OAM gère l'auth
curl -I https://api.corp.local/health \
  -H "Authorization: Bearer $OAM_TOKEN"
```

---

## Critères de Succès

| Métrique | Cible |
|----------|-------|
| Fédération | Keycloak ↔ OAM fonctionnel |
| Token Exchange | RFC 8693 opérationnel |
| SSO | Single sign-on préservé |
| Migration des APIs | 100% enregistrées dans STOA |
| Expérience Utilisateur | Aucune interruption pour les utilisateurs finaux |

---

## Prochaines Étapes

- [Migration IBM webMethods](./ibm-webmethods) — Si vous avez également webMethods
- [Déploiement Hybride](/docs/deployment/hybrid) — Options d'architecture
- [Sécurité & Conformité](/docs/enterprise/security-compliance) — Considérations DORA/NIS2

---

*Besoin d'aide pour la migration ? [Contactez-nous](mailto:contact@gostoa.dev) pour des services professionnels.*
