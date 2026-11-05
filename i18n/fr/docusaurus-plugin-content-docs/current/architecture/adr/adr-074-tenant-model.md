---
sidebar_position: 74
title: "ADR-074 : Modèle de tenant — un realm, des groupes de tenant et un claim tenant_id"
sidebar_label: "ADR-074 : modèle de tenant"
description: "Consigne le modèle de tenant livré par STOA : un realm Keycloak nommé stoa, un groupe Keycloak par tenant et un claim tenant_id vérifié par l'API du plan de contrôle et la passerelle. Remplace l'ADR-026."
keywords: [ADR, modèle de tenant, multi-tenant, Keycloak, realm, groupes, tenant_id, claim, isolation des tenants, décision d'architecture]
---

# ADR-074 : Modèle de tenant — un realm, des groupes de tenant et un claim tenant_id

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Acceptée |
| **Date** | 2026-11-05 |
| **Remplace** | [ADR-026](./adr-026-multi-iam-federation.md) |
| **Liées** | [ADR-046](./adr-046-mcp-federation-architecture.md), [ADR-073](./adr-073-adopt-envoy-data-plane.md) |

## Contexte

L'[ADR-026](./adr-026-multi-iam-federation.md) (2026-01-28) a retenu un hub de fédération :

- un realm Keycloak par organisation ;
- le fournisseur d'identité de chaque organisation (OIDC, SAML ou LDAP) relié en courtage à son propre realm ;
- un échange de jetons RFC 8693 qui émet des jetons d'API à portée restreinte ;
- un claim `stoa_realm` que la passerelle compare au tenant demandé.

La plateforme livre un modèle différent :

- L'API du plan de contrôle, la Console, le Portail développeur et la passerelle s'appuient sur **un seul** realm applicatif, nommé `stoa` par défaut.
- Un tenant est un **groupe Keycloak** de ce realm. L'API du plan de contrôle crée le groupe lors du provisionnement du tenant.
- Les services connaissent le tenant de l'appelant grâce à un **claim `tenant_id`** dans le jeton d'accès.
- L'organisation « un realm par organisation » et le claim `stoa_realm` n'existent que dans la démo de fédération multi-IAM. L'API du plan de contrôle et la passerelle ne lisent pas `stoa_realm`.

L'ADR-026 affichait encore « Accepté » et décrivait une architecture que la plateforme n'exploite pas. Cet enregistrement décrit le modèle livré et remplace l'ADR-026 comme référence.

## Décision

### 1. Un seul realm applicatif

STOA utilise un seul realm Keycloak pour l'identité applicative. Son nom par défaut est `stoa`.

- Les utilisateurs, les rôles de plateforme (`cpi-admin`, `tenant-admin`, `devops`, `viewer`) et les clients STOA sont dans ce realm.
- L'API du plan de contrôle et la passerelle acceptent chacune les jetons d'un seul émetteur : `<URL Keycloak>/realms/<realm>`.
- Le nom du realm est un paramètre : `KEYCLOAK_REALM` pour l'API du plan de contrôle, `STOA_KEYCLOAK_REALM` pour la passerelle, `keycloakRealm` dans les valeurs du chart Helm. La valeur par défaut est `stoa` partout.

### 2. Un tenant est un groupe

Lors du provisionnement d'un tenant, l'API du plan de contrôle :

1. Crée un groupe Keycloak de premier niveau portant l'identifiant du tenant (chemin `/<tenant_id>`), avec les attributs `display_name` et `stoa_tenant_id`.
2. Arrête le provisionnement si le groupe ne peut pas être créé. La création est retentée, puis le tenant est marqué en échec.
3. Enregistre l'identifiant du groupe Keycloak sur la fiche du tenant.

Un groupe existant de même nom n'est réutilisé que si son attribut `stoa_tenant_id` est absent ou égal à l'identifiant du tenant. Sinon, l'API du plan de contrôle refuse de le réutiliser.

Ajouter un utilisateur à un tenant fait deux choses :

- l'utilisateur rejoint le groupe du tenant ;
- l'attribut utilisateur `tenant_id` prend la valeur de l'identifiant du tenant.

Le déprovisionnement d'un tenant supprime son groupe (au mieux).

### 3. `tenant_id` est le claim du tenant

Un mapper de protocole Keycloak copie l'attribut utilisateur `tenant_id` dans un claim `tenant_id` de type chaîne, à valeur unique (jeton d'accès, jeton d'identité et userinfo).

- Dans le realm local Docker Compose, le mapper appartient au client scope `stoa-identity`. Ce scope est un scope par défaut des clients de l'API du plan de contrôle, de la Console, du Portail développeur, de la passerelle MCP et de la gouvernance des identités.
- Le job de bootstrap Helm ajoute le même mapper aux clients de la Console, du Portail développeur et de l'API du plan de contrôle.
- Les clients OAuth créés pour les consommateurs d'API portent un claim `tenant_id` fixe, égal à l'identifiant du tenant.

Le claim provient de l'attribut utilisateur, pas de l'appartenance aux groupes. Un jeton identifie au plus un tenant.

Les services lisent `tenant_id` ainsi :

| Règle | API du plan de contrôle | Passerelle |
|-------|:-----------------------:|:----------:|
| Accepte une chaîne non vide, ou un tableau contenant exactement une chaîne | ✅ | ✅ |
| Rejette les valeurs vides, entourées d'espaces, et les tableaux à plusieurs valeurs | ✅ | ✅ |
| Rejette un jeton dont l'ancien claim `tenant` diffère de `tenant_id` | ✅ | ✅ |
| Autorise un administrateur de plateforme (`cpi-admin`) à agir sur tout tenant | ✅ | ✅ |
| Refuse l'accès à un autre tenant que celui du claim | ✅ (403) | ✅ |
| Rejette un jeton sans tenant, sauf s'il porte le rôle `cpi-admin` | Non (voir ci-dessous) | ✅ |

Dans l'API du plan de contrôle, un jeton sans `tenant_id` reste authentifié, mais toute requête limitée à un tenant renvoie alors 403.

Dans la passerelle, le service d'autorisation externe Envoy (`ext_authz`) renvoie aussi 403 quand le claim est absent ou diffère du `tenant_id` de la route.

Les rôles n'identifient jamais un tenant.

### 4. Le courtage d'identité est hors périmètre

Cet enregistrement ne décrit pas le courtage d'identité. Le raccordement du fournisseur d'identité propre à une organisation au realm `stoa`, et la façon dont les utilisateurs ainsi reliés recevraient un attribut `tenant_id`, ne sont **pas vérifiés dans le code**.

### 5. La démo de fédération est conservée comme preuve

La démo de fédération multi-IAM construite pour l'ADR-026 reste dans le dépôt `stoa`. Elle montre le modèle exploré :

- cinq realms de démo : deux sources d'identité et trois realms d'organisation fédérés en OIDC, SAML 2.0 et LDAP ;
- une passerelle factice et une politique OPA qui isolent les organisations par émetteur du jeton (un realm par organisation) ; les jetons de démo portent aussi un claim `stoa_realm` ;
- des scripts de connexion, d'échange de jetons et de tests d'isolation entre realms.

La démo ne fait pas partie du modèle de tenant du produit. Elle utilise sa propre passerelle factice, pas la passerelle STOA ni l'API du plan de contrôle.

- [Parcours de la démo de fédération](https://github.com/stoa-platform/stoa/tree/main/scripts/demo-federation)
- [Pile de la démo de fédération](https://github.com/stoa-platform/stoa/tree/main/deploy/demo-federation)
- La pile locale importe les realms de démo à chaque démarrage ; son profil `federation` ajoute OpenLDAP et la passerelle factice. Voir le [Démarrage rapide](../../guides/quick-start.md) pour les variables associées.

## Conséquences

### Positives

- La documentation correspond au code : un realm, un groupe par tenant, un claim `tenant_id`.
- Chaque service valide un seul émetteur et un seul jeu de clés de signature du realm.
- L'API du plan de contrôle et la passerelle appliquent les mêmes règles de forme au claim du tenant.
- L'API du plan de contrôle pilote le cycle de vie du tenant : elle crée le groupe au provisionnement et le supprime au déprovisionnement.

### Négatives

- Tous les tenants partagent un realm. Les réglages du realm (politique de mots de passe, durées de session, protection contre la force brute, clés de signature) s'appliquent à tous les tenants.
- L'isolation repose sur l'attribut `tenant_id` et sur les contrôles de chaque service, pas sur les frontières de realm. Une valeur d'attribut erronée donne à un utilisateur l'accès à un autre tenant.
- Les utilisateurs sont stockés dans le realm `stoa`. L'objectif « zéro stockage utilisateur » de l'ADR-026 n'est pas livré.
- Un jeton porte un seul tenant. L'appartenance à plusieurs groupes de tenant n'apparaît pas dans le claim.

### Atténuations

- Dans le profil utilisateur du realm, seuls les administrateurs peuvent voir ou modifier l'attribut `tenant_id` (realm local Compose et job de bootstrap Helm).
- L'attribut de groupe `stoa_tenant_id` empêche de réutiliser un groupe pour un autre tenant.
- Les deux consommateurs rejettent les claims de tenant mal formés, à plusieurs valeurs ou contradictoires.

### Non vérifié dans le code

- Les définitions de realm maintenues hors du dépôt `stoa` n'ont pas été examinées.
- Il n'a pas été vérifié que chaque route Envoy d'un déploiement porte une valeur `tenant_id` pour le contrôle d'autorisation externe.

## Relation avec l'ADR-026

| Élément de l'ADR-026 | État livré |
|----------------------|------------|
| Un realm par organisation | Non livré. Un realm, `stoa` ; les tenants sont des groupes. |
| Claim `stoa_realm` vérifié par la passerelle | Non livré. Les services lisent `tenant_id`. `stoa_realm` n'apparaît que dans la démo de fédération. |
| Courtage du fournisseur d'identité de chaque organisation (OIDC, SAML, LDAP) | Montré uniquement dans la démo de fédération. |
| Échange de jetons RFC 8693 pour des jetons d'API à portée restreinte | Livré sous une autre forme. L'API du plan de contrôle échange un jeton via le client d'un consommateur d'API dans le realm `stoa` (`POST /v1/consumers/{tenant_id}/{consumer_id}/token-exchange`) ; le jeton obtenu porte le `tenant_id` du consommateur. Les sous-comptes de fédération MCP peuvent aussi disposer d'un client d'échange de jetons ([ADR-046](./adr-046-mcp-federation-architecture.md)). L'échange par organisation, entre realms, n'est montré que dans la démo de fédération. |
| Zéro stockage utilisateur | Non livré. Les utilisateurs sont stockés dans le realm `stoa`. |

La route de création de realm (provisionnement de tenant) a été supprimée dans la [PR stoa #3045](https://github.com/stoa-platform/stoa/pull/3045) dans le cadre de ce modèle.
L'ADR-026 reste publiée, marquée comme remplacée, pour l'historique.

## Preuves

Chemins dans le [dépôt `stoa`](https://github.com/stoa-platform/stoa), branche `main`, examinés le 2026-11-05.

| Affirmation | Preuve |
|-------------|--------|
| Realm `stoa` dans la pile locale | `deploy/docker-compose/init/keycloak-realm.json` (`"realm": "stoa"`) |
| Realm par défaut, API du plan de contrôle | `control-plane-api/src/config.py` (`KEYCLOAK_REALM`) |
| Realm par défaut, chart Helm | `charts/stoa-platform/values.yaml` (`keycloakRealm`), `charts/stoa-platform/templates/bootstrap-job.yaml` (création du realm) |
| Émetteur unique, API du plan de contrôle | `control-plane-api/src/auth/dependencies.py` (`_kc_issuer_url`) |
| Émetteur unique, passerelle | `stoa-gateway/src/state.rs` (configuration du validateur JWT) |
| Tenant = groupe Keycloak | `control-plane-api/src/services/keycloak_service.py` (`setup_tenant_group`, `_adopt_tenant_group`, `delete_tenant_group`) |
| Groupe créé au provisionnement | `control-plane-api/src/services/tenant_provisioning_service.py` (`provision_tenant`, `deprovision_tenant`), `control-plane-api/src/routers/tenants.py`, `control-plane-api/src/models/tenant.py` (`kc_group_id`) |
| L'utilisateur rejoint le groupe et reçoit l'attribut `tenant_id` | `control-plane-api/src/services/keycloak_service.py` (`add_user_to_tenant`, `create_user`) |
| Mapper `tenant_id` | `deploy/docker-compose/init/keycloak-realm.json` (client scope `stoa-identity`, mapper `tenant-id`), `deploy/keycloak/tenant-id-mapper.json`, `charts/stoa-platform/templates/bootstrap-job.yaml` |
| Claim fixe sur les clients consommateurs | `control-plane-api/src/services/keycloak_service.py` (`create_consumer_client`) |
| Échange de jetons pour les consommateurs d'API | `control-plane-api/src/routers/consumers.py` (`exchange_consumer_token`), `control-plane-api/src/models/federation.py` (`SubAccount`) |
| Claim lu par l'API du plan de contrôle | `control-plane-api/src/auth/dependencies.py` (`_normalize_tenant_claim`, `get_current_user`), `control-plane-api/src/auth/rbac.py` (`decide_tenant_access`) |
| Claim lu par la passerelle | `stoa-gateway/src/auth/claims.rs` (`deserialize_tenant`, `tenant_id`, `validate_tenant`), `stoa-gateway/src/auth/middleware.rs`, `stoa-gateway/src/auth/rbac.rs`, `stoa-gateway/src/authz/ext_authz_grpc.rs` |
| `stoa_realm` uniquement dans la démo de fédération | `deploy/demo-federation/`, `scripts/demo-federation/` |

## Références

- [ADR-026 : Modèle de fédération multi-IAM](./adr-026-multi-iam-federation.md) (remplacée)
- [ADR-046 : Architecture de fédération MCP](./adr-046-mcp-federation-architecture.md)
- [ADR-073 : Adopter Envoy comme plan de données de STOA](./adr-073-adopt-envoy-data-plane.md)
- [Guide d'administration du serveur Keycloak](https://www.keycloak.org/docs/latest/server_admin/) (groupes, client scopes et mappers de protocole)
