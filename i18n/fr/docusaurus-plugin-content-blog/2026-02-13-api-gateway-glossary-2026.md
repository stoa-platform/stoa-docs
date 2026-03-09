---
slug: api-gateway-glossary-2026
title: "Glossaire API Gateway : 30 termes que tout développeur devrait connaître"
description: "De la clé API au zero trust, 30 termes essentiels de gateway définis. Authentification, MCP, mTLS, rate limiting et concepts modernes expliqués clairement."
authors: [christophe]
tags: [education, architecture]
keywords: [API gateway glossary, API gateway terms, MCP glossary, API management terms, authentication glossary, authorization terms, circuit breaker, rate limiting, mTLS, API gateway vocabulary, gateway concepts, API security terms]
---

# Glossaire API Gateway 2026 : 30 termes que tout développeur devrait connaître

Le paysage des API gateways a évolué rapidement avec l'essor des agents IA, des architectures zero-trust et des déploiements hybrides. Ce glossaire définit 30 termes essentiels que tout développeur devrait connaître lorsqu'il travaille avec des API gateways modernes en 2026.

<!-- truncate -->

<!-- last verified: 2026-02 -->

Que vous migriez depuis un gateway legacy, évaluiez de nouvelles solutions ou construisiez des intégrations IA-natives, comprendre ces concepts est essentiel. Nous avons inclus le contexte pratique sur comment des plateformes modernes comme STOA gèrent chaque capacité.

Pour une introduction complète à la terminologie et l'architecture spécifiques à MCP, voir notre guide : [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway)

---

### API Gateway

Un API gateway est un serveur qui se place entre les clients et les services backend, agissant comme un reverse proxy pour router les requêtes, appliquer des politiques et fournir des capacités transversales comme l'authentification, le rate limiting et l'observabilité. Les gateways modernes supportent également des protocoles spécifiques à l'IA comme MCP aux côtés de REST et gRPC traditionnels. STOA Platform étend le modèle gateway traditionnel avec un [Universal API Contract (UAC)](/docs/concepts/uac) qui permet de "définir une fois, exposer partout" sur plusieurs backends gateway.

### Clé API (API Key)

Une clé API est un mécanisme d'authentification simple basé sur des tokens où les clients incluent un secret pré-partagé dans les headers de requête (typiquement `X-API-Key` ou `Authorization: Bearer <key>`). Bien que facile à implémenter, les clés API manquent d'expiration, de révocation et de contexte utilisateur, les rendant adaptées uniquement aux scénarios serveur-à-serveur avec des contrôles d'accès stricts. STOA supporte l'authentification par clé API pour l'enregistrement au gateway et les appels internes service-à-service.

### Authentification

L'authentification est le processus de vérification de l'identité d'un utilisateur ou service effectuant une requête API. Les méthodes courantes incluent les clés API, OAuth 2.0, les tokens JWT et mTLS. Les gateways modernes délèguent souvent l'authentification à des fournisseurs d'identité comme Keycloak ou Auth0 via OpenID Connect. Le [modèle d'authentification STOA](/docs/guides/authentication) supporte la fédération d'identité multi-tenant avec contrôle d'accès basé sur les rôles.

### Autorisation

L'autorisation détermine quelles actions un utilisateur ou service authentifié est autorisé à effectuer. Cela est typiquement appliqué via le contrôle d'accès basé sur les rôles (RBAC), le contrôle d'accès basé sur les attributs (ABAC) ou des moteurs de politiques comme OPA. L'autorisation se produit après l'authentification et est critique pour implémenter des architectures zero-trust. STOA utilise le RBAC basé sur Keycloak avec quatre rôles persona : `cpi-admin`, `tenant-admin`, `devops` et `viewer`.

### Circuit Breaker

Un circuit breaker est un pattern de résilience qui prévient les défaillances en cascade en bloquant temporairement les requêtes vers des services upstream défaillants. Quand les taux d'erreur dépassent un seuil, le circuit "s'ouvre" et les requêtes échouent rapidement au lieu d'expirer. Après une période de refroidissement, le circuit entre dans un état "semi-ouvert" pour tester la récupération. STOA Gateway implémente des [circuit breakers par upstream](/docs/architecture/adr/adr-032-response-transformation) avec des seuils configurables et un reaping automatique des zombies.

### CORS

Le Cross-Origin Resource Sharing (CORS) est un mécanisme de sécurité des navigateurs qui contrôle quelles origines web peuvent accéder à une API. Les gateways gèrent les requêtes preflight CORS (`OPTIONS`) et injectent les headers appropriés (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`). Un CORS mal configuré est une source courante de problèmes en production. L'UI du Plan de Contrôle STOA inclut des headers CORS configurés pour l'accès basé navigateur depuis le Portal et la Console.

### DORA

Le Digital Operational Resilience Act (DORA) est un règlement européen (en vigueur depuis janvier 2025) exigeant que les entités financières mettent en place une gestion des risques ICT, une notification d'incidents et des contrôles de risque tiers. Les API gateways jouent un rôle dans la conformité DORA via l'observabilité, la journalisation d'audit et les fonctionnalités de résilience opérationnelle comme les circuit breakers. STOA fournit des [capacités techniques qui soutiennent l'alignement DORA](/blog/dora-nis2-api-gateway-compliance), incluant la journalisation de snapshots d'erreurs et des options de déploiement multi-région.

### gRPC

gRPC est un framework RPC haute performance utilisant Protocol Buffers pour la sérialisation et HTTP/2 pour le transport. Les gateways modernes supportent la transcoding gRPC-vers-REST, permettant aux clients HTTP/JSON d'appeler des backends gRPC. gRPC est populaire pour la communication entre microservices mais nécessite une coordination de schémas. L'architecture gateway de STOA supporte les endpoints gRPC aux côtés de REST et MCP.

### JSON-RPC

JSON-RPC est un protocole d'appel de procédure à distance léger encodé en JSON, couramment utilisé par les frameworks d'agents IA et les APIs blockchain. Contrairement à REST, JSON-RPC utilise un seul endpoint avec un champ `method` pour identifier les opérations. Le Model Context Protocol (MCP) utilise JSON-RPC 2.0 sur les transports stdio, HTTP et SSE. Le MCP Gateway de STOA traduit les APIs RESTful en JSON-RPC pour la consommation par les agents.

### JWT

Les JSON Web Tokens (JWT) sont des tokens signés et auto-contenus qui portent l'identité de l'utilisateur et des claims. Les gateways valident les signatures JWT et extraient les claims pour les décisions d'autorisation. Les JWTs sont sans état, permettant le scaling horizontal, mais nécessitent une gestion soigneuse des clés et de l'expiration. STOA utilise des JWTs émis par Keycloak pour l'accès au Control Plane API et au Portal, avec une validation scoped au realm.

### Keycloak

Keycloak est une solution de gestion des identités et accès (IAM) open source supportant OIDC, SAML et la fédération LDAP. Il est largement utilisé comme couche d'authentification pour les API gateways. STOA Platform utilise [Keycloak pour l'authentification multi-tenant](/docs/guides/authentication) avec des realms scoped par tenant et une fédération vers des fournisseurs d'identité externes.

### MCP (Model Context Protocol)

Le Model Context Protocol (MCP) est un standard ouvert créé par Anthropic pour connecter les agents IA à des outils et sources de données externes. MCP utilise JSON-RPC 2.0 et définit trois primitives : outils (actions), ressources (données) et prompts (templates). Le [MCP Gateway](/docs/concepts/mcp-gateway) de STOA expose des APIs RESTful comme outils MCP, permettant aux agents IA d'appeler des systèmes legacy sans code d'intégration personnalisé.

### mTLS

Le Mutual TLS (mTLS) est un pattern de sécurité où le client et le serveur s'authentifient mutuellement en utilisant des certificats X.509. Contrairement au TLS traditionnel (authentification serveur uniquement), mTLS fournit une identité client forte, le rendant idéal pour les architectures zero-trust et la communication service mesh. STOA supporte [mTLS pour les connexions gateway-vers-backend](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) avec la gestion du cycle de vie des certificats.

### Multi-Tenancy

La multi-tenancy est la capacité à servir plusieurs clients indépendants (tenants) depuis une seule instance de plateforme tout en maintenant l'isolation des données. Les gateways appliquent les frontières tenant via des namespaces, RBAC et des contrôles de quota. L'[architecture multi-tenant STOA](/docs/concepts/multi-tenant) utilise des namespaces Kubernetes et des realms Keycloak pour isoler les ressources tenant.

### NIS2

La Directive sur la sécurité des réseaux et de l'information 2 (NIS2) est une loi européenne de cybersécurité (en vigueur depuis octobre 2024) exigeant que les entités essentielles et importantes mettent en place une gestion des risques, une notification d'incidents et une sécurité de la chaîne d'approvisionnement. Les API gateways contribuent à la conformité NIS2 via la journalisation de sécurité, les contrôles d'accès et la génération de SBOM. STOA génère des SBOMs CycloneDX et SPDX pour tous les composants.

### OPA (Open Policy Agent)

Open Policy Agent (OPA) est un moteur de politiques qui permet une autorisation déclarative et fine-grained en utilisant le langage Rego. Les gateways utilisent OPA pour appliquer des politiques complexes basées sur les attributs de la requête, les rôles utilisateur et des données externes. Le MCP Gateway de STOA inclut l'intégration OPA pour le contrôle d'accès aux outils piloté par les politiques.

### OpenAPI

OpenAPI (anciennement Swagger) est un standard pour décrire les APIs RESTful en YAML ou JSON. Les gateways utilisent les specs OpenAPI pour la validation, la génération de documentation et l'onboarding automatisé. Le [Universal API Contract (UAC)](/docs/concepts/uac) de STOA étend OpenAPI avec des métadonnées spécifiques au gateway pour les règles de quota, cache et transformation.

### Rate Limiting

Le rate limiting contrôle le nombre de requêtes qu'un client peut effectuer dans une fenêtre de temps, protégeant les backends de la surcharge et appliquant une utilisation équitable. Les stratégies courantes incluent token bucket, leaky bucket et fenêtre glissante. STOA implémente un [enforcement de quota par consommateur](/docs/guides/subscriptions) avec des limites stockées dans la base de données du Plan de Contrôle et appliquées au gateway.

### RBAC

Le contrôle d'accès basé sur les rôles (RBAC) assigne des permissions à des rôles (ex. `admin`, `developer`, `viewer`) plutôt qu'à des utilisateurs individuels. Les gateways appliquent le RBAC en validant les claims JWT ou en interrogeant les fournisseurs d'identité. STOA utilise un [modèle RBAC à quatre rôles](/docs/guides/authentication) aligné avec les personas enterprise typiques.

### REST

Le Representational State Transfer (REST) est un style architectural pour les APIs utilisant des méthodes HTTP (GET, POST, PUT, DELETE) et des URLs basées sur les ressources. Les APIs REST sont sans état, cachables et utilisent des codes de statut HTTP standard. Malgré l'essor de GraphQL et gRPC, REST reste le paradigme API dominant. Le gateway de STOA supporte des backends RESTful avec un onboarding piloté par OpenAPI.

### Reverse Proxy

Un reverse proxy se place devant les services backend, transférant les requêtes des clients et retournant les réponses. Contrairement à un proxy direct (qui sert les clients), un reverse proxy sert les serveurs. Les API gateways sont des reverse proxies spécialisés avec des capacités supplémentaires comme l'authentification, le rate limiting et la translation de protocoles. STOA Gateway utilise axum et Tokio pour le reverse proxying haute performance.

### SBOM

Un Software Bill of Materials (SBOM) est une liste formelle des composants, bibliothèques et dépendances dans un artefact logiciel. Les SBOMs sont critiques pour la sécurité de la chaîne d'approvisionnement et la gestion des vulnérabilités. STOA génère des SBOMs CycloneDX et SPDX pour toutes les images container et les publie dans les artefacts de release GitHub.

### Service Mesh

Un service mesh est une couche d'infrastructure qui gère la communication service-à-service, l'observabilité et la sécurité dans les architectures microservices. Les meshes populaires comme Istio et Linkerd utilisent des proxies sidecar. Les service meshes se chevauchent avec les API gateways mais se concentrent sur le trafic est-ouest (interne) plutôt que nord-sud (externe). STOA supporte le [mode de déploiement sidecar](/docs/architecture/adr/adr-024-gateway-unified-modes) pour l'intégration service mesh.

### SSE (Server-Sent Events)

Les Server-Sent Events (SSE) sont un protocole basé HTTP pour le streaming serveur-vers-client sur une connexion unique longue durée. Contrairement aux WebSockets (bidirectionnels), SSE est unidirectionnel et utilise le type de contenu text/event-stream. Le protocole MCP supporte SSE comme option de transport pour les mises à jour d'outils en temps réel. Le MCP Gateway de STOA implémente SSE pour les réponses d'outils en streaming.

### TLS

Transport Layer Security (TLS) est le protocole cryptographique qui sécurise le trafic HTTP (HTTPS). Les gateways terminent les connexions TLS, déchargeant le chiffrement des services backend. Les déploiements modernes utilisent TLS 1.3 avec une gestion automatisée des certificats via Let's Encrypt ou cert-manager. STOA utilise cert-manager avec des ClusterIssuers pour la gestion automatisée du cycle de vie des certificats TLS.

### Metering de tokens (Token Metering)

Le metering de tokens suit l'usage des APIs pour les modèles IA, qui facturent par token (entrée + sortie) plutôt que par requête. Les gateways interceptent les réponses, extraient les comptages de tokens et émettent des événements de metering vers les systèmes de facturation. Le pipeline de metering de STOA (feuille de route future) supportera la tarification basée sur les tokens pour les appels d'outils MCP.

### Découverte d'outils (Tool Discovery)

La découverte d'outils est le mécanisme MCP permettant aux clients d'énumérer les outils disponibles au runtime. Les gateways exposent un endpoint `tools/list` qui retourne des définitions d'outils JSON-RPC, permettant aux agents IA de s'adapter aux capacités backend changeantes sans modifications de code. Le [MCP Gateway](/docs/concepts/mcp-gateway) de STOA génère dynamiquement des listes d'outils depuis les APIs définies par UAC.

### UAC (Universal API Contract)

Le Universal API Contract (UAC) est le concept core de STOA : une définition YAML unique qui décrit une API et ses politiques gateway. L'UAC étend OpenAPI avec des règles de quota, cache, transformation et observabilité. Un seul UAC peut se déployer vers Kong, Gravitee, Envoy ou STOA Gateway, éliminant le vendor lock-in. Voir la [documentation UAC](/docs/concepts/uac) pour les détails.

### WebSocket

WebSocket est un protocole bidirectionnel full-duplex sur TCP, couramment utilisé pour les applications temps réel comme le chat et les dashboards en direct. Contrairement à HTTP (requête-réponse), WebSocket maintient une connexion ouverte. Les gateways gèrent les upgrades WebSocket et proxifient les messages entre les clients et les backends. MCP supporte WebSocket comme option de transport (spec future). L'architecture de STOA Gateway supporte le proxying WebSocket via la gestion d'upgrade d'axum.

### Zero Trust

Zero Trust est un modèle de sécurité qui suppose qu'aucune frontière réseau n'est digne de confiance. Chaque requête doit être authentifiée, autorisée et chiffrée, quel que soit son origine. Les API gateways sont centraux dans les architectures zero-trust, appliquant mTLS, la validation JWT et le contrôle d'accès basé sur les politiques. Le [module mTLS](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) de STOA et l'intégration OPA supportent les déploiements zero-trust.

---

## Foire aux questions

### Quel est le périmètre de ce glossaire ?

Ce glossaire se concentre sur les concepts modernes d'API gateway essentiels pour les déploiements 2026, incluant les patterns traditionnels (REST, authentification, rate limiting) et les technologies émergentes (MCP, agents IA, architectures zero-trust). Il exclut intentionnellement les patterns dépréciés (SOAP, WS-Security) et la terminologie spécifique aux fournisseurs. Pour la migration depuis des plateformes legacy, voir le [Guide de migration API Gateway](/blog/api-gateway-migration-guide-2026).

### Où puis-je en apprendre davantage sur la terminologie spécifique à MCP ?

Pour une couverture plus approfondie des concepts du Model Context Protocol comme la découverte d'outils, le transport JSON-RPC et l'authentification des agents IA, voir notre guide complet : [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway). Cet article couvre l'architecture MCP, les cas d'usage et comment STOA implémente MCP nativement.

### Quelles autres ressources complètent ce glossaire ?

Après avoir compris la terminologie, explorez les patterns d'implémentation pratiques dans notre [Comparaison API Gateway Open Source 2026](/blog/open-source-api-gateway-2026), qui compare Kong, Tyk, Gravitee, APISIX et STOA selon les fonctionnalités, les performances et les modèles de déploiement. Pour l'apprentissage pratique, suivez le [Quickstart MCP Gateway](/blog/mcp-gateway-quickstart-docker) pour déployer un gateway fonctionnel en 10 minutes.

---

## Lectures complémentaires

- [Guide de migration API Gateway 2026](/blog/api-gateway-migration-guide-2026) — hub de migration complet
- [Patterns API Gateway](https://docs.gostoa.dev/docs/guides/fiches/api-gateway-patterns) — patterns d'implémentation techniques
- [Concepts MCP Gateway](/blog/what-is-mcp-gateway) — comment STOA fait le pont entre les APIs legacy et les agents IA
- [Comparaison API Gateway Open Source 2026](/blog/open-source-api-gateway-2026) — Kong, Tyk, Gravitee, APISIX et STOA

---

*Christophe Aboulicam est le Fondateur & CTO de HLFH, construisant STOA Platform pour apporter l'API management IA-native aux entreprises européennes.*
