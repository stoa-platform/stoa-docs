---
sidebar_position: 1
title: Déploiement souverain
description: Topologie de référence d'un déploiement STOA entièrement sur site — zones réseau, contrôle des accès depuis un réseau externe, isolation des tenants et des composants. Noms génériques uniquement, chaque affirmation sourcée.
keywords: [deployment, sovereign, on-premises, air-gapped, network, access control, isolation, multi-tenant, Envoy, xDS]
---

# Déploiement souverain

En mode souverain, le plan de contrôle et le plan de données s'exécutent tous deux à l'intérieur du périmètre de l'opérateur ([ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first.md)). Le service hébergé a été arrêté le 23/05/2026 ; STOA se déploie sur site. Cette page est un schéma de référence générique : les noms sont des exemples, aucune infrastructure réelle n'est décrite, et chaque affirmation renvoie à un ADR publié ou à un fichier du dépôt `stoa`. Dimensionnement, ports et DNS sont dans les [Prérequis de déploiement](./prerequisites.md).

:::info Statut du plan de données
L'[ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane.md) (22/10/2026) décide que le plan de données utilise Envoy upstream, configuré uniquement par xDS servi sur site par STOA Link, la logique STOA s'exécutant dans des services externes appelés par Envoy. Sur `main` (`639e8b9a`), le serveur ADS mTLS loopback de Link (`STOA_GATEWAY_TYPE=envoy`) et le service gRPC Rust `ExtAuthzService` (`STOA_EXT_AUTHZ_GRPC_ADDR` + `STOA_EXT_AUTHZ_AUDIENCE` + `STOA_EXT_AUTHZ_REQUIRED_SCOPES` non vide en `prod`) sont implémentés sous option, et Link + Envoy xDS sont exercés par un harnais d'acceptation manuel hors ligne avec un témoin gRPC `Check` indépendant ; la parité complète des politiques (`jwt_authn` par xDS, `ext_proc`) et la bascule de topologie par défaut restent en cours ([Plan de données](../architecture/data-plane.md)). La passerelle déployée par défaut, STOA Gateway (Rust), est en maintenance (ADR-073 §9).
:::

## 1. Topologie réseau

```mermaid
flowchart TB
    subgraph EXT["Réseau externe (non fiable)"]
        C["Consommateurs d'API"]
        A["Agents IA (clients MCP)"]
        O["Opérateurs (navigateur, CLI)"]
    end
    subgraph SITE["Site de l'opérateur (périmètre souverain)"]
        subgraph EDGE["Zone edge"]
            RP["Reverse proxy / terminaison TLS<br/>(propriété de l'opérateur)"]
        end
        subgraph DP["Zone plan de données"]
            ENV["Envoy (upstream, non modifié)<br/>listeners, TLS, jwt_authn, rbac, local_ratelimit"]
            AZ["Service d'autorisation<br/>(ext_authz)"]
            PS["Service de traitement<br/>(ext_proc)"]
            MCP["Module MCP"]
            LINK["STOA Link<br/>(serveur xDS, client SSE)"]
        end
        subgraph CPZ["Zone plan de contrôle"]
            UI["Console / Portail"]
            API["API du plan de contrôle"]
            KC["Keycloak<br/>(realm unique 'stoa', groupes par tenant — ADR-074)"]
            PG["PostgreSQL"]
            SEC["Coffre de secrets (OpenBao — ADR-075)"]
            GIT["Dépôt Git<br/>(archive de l'état désiré)"]
        end
        subgraph OPS["Zone systèmes de l'opérateur"]
            B1["Systèmes backend"]
            TG["Passerelle tierce<br/>(optionnelle)"]
            IDP["IdP d'entreprise"]
        end
        REG["Registre d'images sur site<br/>(images miroir, signées)"]
    end
    C & A & O -->|"HTTPS"| RP
    RP --> ENV
    RP --> UI & API & KC
    ENV -->|"gRPC"| AZ & PS
    ENV --> MCP & B1
    MCP --> B1
    ENV -.->|"flux xDS ouvert par Envoy"| LINK
    LINK -->|"SSE, sortant depuis Link"| API
    LINK -->|"API d'administration"| TG
    AZ -->|"politique signée, quotas"| API & PG
    API --> KC & PG & SEC & GIT
    KC -.->|"fédération OIDC / SAML / LDAP"| IDP
```

| Flux | Direction et protocole | Source |
|------|------------------------|--------|
| Consommateurs, agents et opérateurs → edge | HTTPS, à l'initiative du client ; seule entrée entrante du site | [Prérequis §2](./prerequisites.md#2-matrice-des-flux-réseau) |
| Edge → Envoy, Console, Portail, API, Keycloak | TLS terminé à l'edge ; données du certificat client transmises en en-têtes depuis un proxy de confiance uniquement | [ADR-027](../architecture/adr/adr-027-x509-header-authentication.md), [ADR-039](../architecture/adr/adr-039-mtls-cert-bound-tokens.md) |
| Envoy → services d'autorisation et de traitement | gRPC `ext_authz` et `ext_proc` ; services co-localisés avec Envoy | ADR-073 §4, Mitigations |
| Envoy ↔ STOA Link | Envoy ouvre le flux xDS vers le Link local ; Link sert des snapshots versionnés générés depuis les contrats UAC | ADR-073 §2 |
| STOA Link → API du plan de contrôle | SSE sortant depuis Link plus callback HTTPS ; le plan de contrôle n'ouvre jamais de connexion vers le plan de données | [ADR-059](../architecture/adr/adr-059-simplified-deployment-sse.md), ADR-073 §2 |
| Point d'application → API du plan de contrôle | Récupération périodique de l'artefact de politique signé, à l'initiative du point d'application | [ADR-070 A7](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) |
| Site → Internet | Aucun flux requis : le mode souverain n'exige jamais de connectivité sortante ; les images sont mises en miroir dans un registre sur site | ADR-037, [Prérequis §5](./prerequisites.md#air-gappé--registre-privé), ADR-073 Mitigations |

Chaque instance Envoy garde son interface d'administration sur loopback et n'est jamais configurée à la main ni par une API d'administration (ADR-073 §2 et Mitigations). Kafka, s'il est déployé, reste interne au site et ne transporte que des événements d'effets de bord (ADR-059).

## 2. Contrôle des accès depuis un réseau externe

```mermaid
sequenceDiagram
    participant X as Client ou agent IA (réseau externe)
    participant E as Edge (terminaison TLS)
    participant V as Envoy
    participant Z as Service d'autorisation (ext_authz)
    participant M as Module MCP ou backend
    X->>E: TLS (mTLS optionnel) + jeton bearer
    E->>V: transfert + en-têtes du certificat client
    V->>V: jwt_authn (JWKS via xDS), rbac, local_ratelimit
    V->>Z: contrôle ext_authz (tenant, souscription, quota, OPA)
    Z-->>V: autorisation, ou refus (fail-closed : 503, corps neutre)
    alt Autorisé
        V->>M: transfert de l'appel API ou de l'appel d'outil
        M-->>X: réponse
    else Refus ou service d'autorisation indisponible
        V-->>X: refus (aucun appel au backend)
    end
```

| Étape | Contrôle | Source |
|-------|----------|--------|
| Identité | L'[ADR-074](../architecture/adr/adr-074-tenant-model.md) retire l'ancienne ébauche d'un realm par tenant ([ADR-026](../architecture/adr/adr-026-multi-iam-federation.md)) et retient un unique realm Keycloak partagé `stoa` avec un groupe racine par tenant (`/<tenant_id>`), le claim JWT `tenant_id` vérifié et un schéma PostgreSQL partagé filtré par `tenant_id`. Le courtage vers un IdP d'entreprise (OIDC, SAML, LDAP) est démontré uniquement dans des realms de fédération dédiés et n'est pas attesté dans l'import du realm produit `stoa`. | [ADR-074](../architecture/adr/adr-074-tenant-model.md) |
| Agents IA | Les clients MCP utilisent OAuth 2.1 avec PKCE ; la passerelle sert les métadonnées de découverte et relaie l'enregistrement dynamique des clients vers Keycloak. | [ADR-044](../architecture/adr/adr-044-mcp-oauth-gateway-proxy.md) |
| Transport | TLS à l'edge ; mTLS optionnel avec jetons liés au certificat (`cnf.x5t#S256`), vérifiés par le filtre JWT d'Envoy ou par le service d'autorisation. Les jetons « sender-constrained » (liés à une clé détenue par le client, via DPoP ou mTLS) sont conçus pour prendre en charge le profil FAPI 2.0 pour les clients qui l'exigent ; aucune certification de conformité n'est revendiquée. | ADR-039, ADR-073 §5, [ADR-056](../architecture/adr/adr-056-fapi-2-architecture.md) |
| Validation du jeton | Cible : le filtre `jwt_authn` d'Envoy valide signature et claims contre un JWKS livré par xDS (ADR-073 §10). Sur `main` : `ExtAuthzService` valide directement JWKS RS256, audience, `tenant_id` et scopes avant le routage. | ADR-073 §10, [Plan de données](../architecture/data-plane.md) |
| Autorisation | Le service d'autorisation vérifie tenant, souscription active, clé d'API, politique OPA et quotas consommateur. En cas de défaillance, Envoy refuse avec un 503 (403 dans l'instantané de référence actuel), un corps neutre, et sans rejeu automatique des requêtes non idempotentes. | ADR-073 §4, §10 |
| Permissions d'outils | Refus par défaut. Un outil n'est autorisé que si un artefact signé par le plan de contrôle (JWS Ed25519, limité à un tenant, borné dans le temps) le liste ; la révocation prime sur le cache ; les outils marqués `requires_human_approval` exigent un jeton d'approbation. | ADR-070 §1, Annexe |
| Opérateurs | Console, Portail et CLI passent par Keycloak OIDC. Les rôles `cpi-admin`, `tenant-admin`, `devops` et `viewer` correspondent aux scopes `stoa:admin`, `stoa:write`, `stoa:read`. Les changements de configuration en production passent par une pull request Git, pas par une écriture dans l'interface. | [ADR-054](../architecture/adr/adr-054-rbac-taxonomy-v2.md), [ADR-040](../architecture/adr/adr-040-born-gitops-multi-environment.md) |

Dans les profils `prod` et `staging`, la passerelle Rust refuse de démarrer si son moteur de politiques ne peut pas se charger ([`state.rs`: `resolve_policy_engine`](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/stoa-gateway/src/state.rs#L795-L843)), et la readiness échoue quand aucun artefact de politique vérifié n'est disponible (ADR-070 §4).

## 3. Isolation des tenants et des composants

```mermaid
flowchart LR
    subgraph TNA["Tenant A"]
        direction TB
        RA["Groupe Keycloak A (realm stoa)"] --- UA["Fichier UAC A"] --- PA["Artefact de politique signé A"] --- NA["Namespace A + NetworkPolicy"]
    end
    subgraph TNB["Tenant B"]
        direction TB
        RB["Groupe Keycloak B (realm stoa)"] --- UB["Fichier UAC B"] --- PB["Artefact de politique signé B"] --- NB["Namespace B + NetworkPolicy"]
    end
    subgraph SH["Composants partagés, conscients du tenant"]
        direction TB
        APIX["API du plan de contrôle<br/>require_tenant_access"]
        AZX["Service d'autorisation<br/>enforce_tenant_isolation"]
    end
    TNA --> SH
    TNB --> SH
```

| Couche | Mécanisme | Source |
|--------|-----------|--------|
| Identité | Realm Keycloak unique partagé `stoa` avec un groupe Keycloak par tenant (`setup_tenant_group`) et claims JWT `tenant_id` vérifiés ; clés de signature et clients OIDC appartiennent au realm partagé plutôt qu'à des realms séparés par tenant. | [ADR-074](../architecture/adr/adr-074-tenant-model.md); [tenant creation](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/routers/tenants.py#L373-L379); [provisioning](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/services/tenant_provisioning_service.py#L100-L126); [configured realm](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/services/keycloak_service.py#L57-L66); [setup_tenant_group](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/services/keycloak_service.py#L945-L972) |
| Autorisation | L'API du plan de contrôle refuse l'accès à un autre tenant sauf si l'appelant est `cpi-admin` (`require_tenant_access`) ; la passerelle applique la même règle avec `enforce_tenant_isolation`, activé par défaut. | [Control Plane RBAC](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/auth/rbac.py#L25-L41); [require_tenant_access](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/control-plane-api/src/auth/rbac.py#L258-L263); [gateway default](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/stoa-gateway/src/auth/rbac.rs#L134-L142); [gateway tenant check](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/stoa-gateway/src/auth/rbac.rs#L210-L257) |
| Contrat | Un fichier UAC complet et autonome par tenant, sans héritage ; les overlays par environnement vivent dans Git. | [ADR-022](../architecture/adr/adr-022-uac-tenant-architecture.md), ADR-040 |
| Politique | Chaque artefact de politique signé porte un seul `tenant_id` ; un artefact manquant pour un tenant ne refuse que ce tenant, jamais les autres. | ADR-070 §4, Annexe A2 |
| Réseau | Pour ce schéma de référence, l'opérateur doit isoler les charges de travail des tenants avec des namespaces et des objets NetworkPolicy. Le chart inclut des politiques egress conditionnelles pour bootstrap et first-admin, mais elles ne fournissent pas une isolation générale des charges de travail des tenants. Exemples : [Durcissement sécurité](../admin/security-hardening.md#politiques-réseau). | [Helm templates](https://github.com/stoa-platform/stoa/tree/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/charts/stoa-platform/templates); [bootstrap policy](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/charts/stoa-platform/templates/bootstrap-networkpolicy.yaml#L1-L57); [first-admin policy](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/charts/stoa-platform/templates/first-admin-networkpolicy.yaml#L1-L48) |
| Composants | Plan de contrôle et plan de données sont des processus distincts avec un chemin de déploiement unique ; Envoy ne charge aucune extension et la logique STOA s'exécutent dans des services séparés ; la clé de signature des politiques est montée en lecture seule et lisible uniquement par l'API du plan de contrôle ; les conteneurs de passerelle tournent sans root, avec système de fichiers en lecture seule et toutes les capacités retirées. | ADR-073 §1, §4 ; ADR-070 A5 ; [gateway security context](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/charts/stoa-platform/templates/stoa-gateway-deployment.yaml#L183-L195) |
| Chaîne d'approvisionnement | Les images sont signées avec Cosign, avec provenance SLSA et SBOM SPDX attachés à la publication ; vérifiez-les avant la mise en miroir dans le registre sur site. | [image publication workflow](https://github.com/stoa-platform/stoa/blob/639e8b9a2217695cfc2f590e246ed9d4ce4d4913/.github/workflows/docker-publish.yml#L157-L188) |

## Voir aussi

- [Prérequis de déploiement](./prerequisites.md) — ports, DNS, dimensionnement, registre privé
- [Déploiement hybride](./hybrid.md) — modèles hybride et multi-cloud
- [Isolation multi-tenant](../concepts/multi-tenant.md) — cycle de vie des tenants et périmètre RBAC
- [Durcissement sécurité](../admin/security-hardening.md) — exemples de NetworkPolicy et de durcissement des conteneurs
- [ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane.md), [ADR-074](../architecture/adr/adr-074-tenant-model.md), [ADR-075](../architecture/adr/adr-075-secrets-backend-openbao.md), [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture), [ADR-037](../architecture/adr/adr-037-deployment-modes-sovereign-first.md) — décisions derrière cette page
