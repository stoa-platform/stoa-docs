---
slug: owasp-api-security-top-10-stoa
title: "OWASP API Security Top 10 : Contrôles Gateway qui Aident"
description: "Mappez chaque risque OWASP API aux contrôles au niveau gateway. Quels risques un gateway atténue, lesquels nécessitent des corrections au niveau app, et où se trouvent les lacunes."
authors: [stoa-team]
tags: [security, comparison, tutorial, api-gateway]
keywords:
  - OWASP API security top 10 2023
  - OWASP API1 broken object level authorization
  - API security gateway OWASP
  - OWASP API security checklist
  - API gateway security compliance
  - API security best practices 2026
  - broken function level authorization API
  - unrestricted resource consumption API
  - OWASP API4 unrestricted resource consumption
  - OWASP compliance API gateway
---
<!-- last verified: 2026-02 -->

L'OWASP API Security Top 10 (2023) liste les risques de sécurité API les plus critiques. Un API gateway comme STOA aide à adresser plusieurs d'entre eux au niveau infrastructure — mais pas tous. Cet article mappe chaque risque OWASP aux contrôles de STOA, avec une évaluation honnête de ce qui nécessite une implémentation au niveau applicatif.

<!-- truncate -->

:::info
Cet article traite de l'OWASP API Security Top 10 (édition 2023). Les comparaisons de fonctionnalités reflètent les capacités de STOA Platform au 2026-02. Pour les détails d'architecture, consultez [Architecture de Sécurité STOA](/blog/stoa-api-security-architecture). Pour les patterns spécifiques aux agents IA, consultez [Sécurité des Agents IA : 5 Patterns d'Authentification](/blog/ai-agent-security-authentication-patterns).
:::

> Les comparaisons de fonctionnalités sont basées sur la documentation OWASP publiquement disponible et la documentation STOA Platform au 2026-02. La sécurité API est une responsabilité partagée — les contrôles au niveau gateway adressent la couche infrastructure. La sécurité au niveau applicatif nécessite une implémentation dans les services backend. STOA supporte les efforts de conformité mais ne constitue pas une garantie de conformité OWASP.

## Tableau Récapitulatif

<!-- last verified: 2026-02 -->

| Risque OWASP | Catégorie | Couverture STOA | Notes |
|--------------|-----------|----------------|-------|
| API1 : Autorisation au niveau objet défaillante | Contrôle d'accès | Partielle | STOA applique les scopes + politiques OPA ; l'authz au niveau objet nécessite une implémentation backend |
| API2 : Authentification défaillante | Authentification | Forte | OAuth 2.1 + PKCE + liaison de certificat mTLS |
| API3 : Autorisation au niveau propriété d'objet défaillante | Contrôle d'accès | Partielle | Filtrage des réponses configurable ; l'application au niveau champ nécessite le backend |
| API4 : Consommation de ressources non restreinte | Rate Limiting | Forte | Rate limiting par consommateur, application des quotas, protection contre les pics |
| API5 : Autorisation au niveau fonction défaillante | Contrôle d'accès | Modérée | Politiques OPA sur les chemins + méthodes HTTP ; nécessite une configuration de politique |
| API6 : Accès non restreint aux flux métier sensibles | Logique métier | Partielle | Politiques OPA de flux ; l'application de la logique métier nécessite une implémentation applicative |
| API7 : Server Side Request Forgery | SSRF | Modérée | Liste de blocage SSRF sur les requêtes sortantes ; nécessite une validation backend |
| API8 : Mauvaise configuration de sécurité | Configuration | Modérée | Paramètres sécurisés par défaut ; nécessite une revue par l'opérateur |
| API9 : Gestion inadéquate des inventaires | Gouvernance | Modérée | Registre API avec les versions déployées ; la détection des APIs fantômes nécessite des outils supplémentaires |
| API10 : Consommation non sécurisée des APIs | Supply Chain | Partielle | Validation des entrées + application du schéma ; les risques liés aux APIs tierces nécessitent des contrôles séparés |

## Couverture Détaillée par Risque

### API1 : Autorisation au Niveau Objet Défaillante (BOLA)

**Risque** : Les endpoints API qui acceptent des IDs d'objets des clients sans vérifier que l'utilisateur appelant est autorisé à accéder à cet objet spécifique. Par exemple : `GET /orders/1234` où `1234` appartient à un autre tenant.

**Contribution de STOA** : STOA applique l'authentification et l'autorisation à grain grossier (scopes JWT, politiques OPA sur les chemins). L'isolation multi-tenant est appliquée au niveau tenant — les requêtes sont attribuées à un consommateur et un tenant, et l'accès inter-tenant est bloqué au niveau de la couche de routage.

**Ce qui nécessite une implémentation backend** : L'autorisation au niveau objet (ce consommateur spécifique possède-t-il la commande `1234` ?) nécessite que le service backend valide l'identité appelante par rapport au propriétaire de la ressource. Un API gateway n'a pas de visibilité sur les modèles de données applicatifs.

**Fonctionnalités STOA pertinentes** : Propagation de l'identité consommateur (header X-Consumer-ID), routage multi-tenant, politiques OPA sur les chemins.

---

### API2 : Authentification Défaillante

**Risque** : Des mécanismes d'authentification faibles ou absents permettant aux attaquants d'usurper l'identité d'utilisateurs légitimes ou de contourner l'authentification entièrement.

**Contribution de STOA** : C'est un domaine où STOA offre une couverture forte :

- **OAuth 2.1 avec PKCE** : autorisation conforme aux standards de l'industrie, résistante à l'interception de code d'autorisation
- **Liaison de certificat mTLS (RFC 8705)** : les access tokens sont liés cryptographiquement aux certificats client ; les tokens volés ne peuvent pas être rejoués depuis un client différent
- **Validation de token à chaque requête** : signature JWT, expiration, émetteur, audience vérifiés à chaque appel
- **Tokens à courte durée** : les access tokens de 15 minutes minimisent la fenêtre d'utilisation abusive des tokens volés
- **Identité backed par Keycloak** : Keycloak gère l'identité avec MFA, protection contre la force brute et politiques de credentials

Pour les agents IA (clients publics), la combinaison OAuth 2.1 PKCE + liaison de certificat mTLS adresse OWASP API2 au niveau de la couche gateway. Consultez [OAuth 2.1 + PKCE pour les Gateways MCP](/blog/oauth-pkce-mcp-gateway) pour le flux complet, et [Sécurité des Agents IA : 5 Patterns d'Authentification](/blog/ai-agent-security-authentication-patterns) pour des patterns plus larges.

**Ce qui nécessite une configuration supplémentaire** : Les mécanismes d'authentification ne fonctionnent que s'ils sont correctement configurés. Des politiques de credentials faibles, l'absence de MFA pour les comptes admin, ou des durées de vie de tokens mal configurées compromettent l'authentification.

---

### API3 : Autorisation au Niveau Propriété d'Objet Défaillante (BOPLA)

**Risque** : Exposer trop de propriétés d'objets aux appelants, y compris des champs sensibles qu'ils ne devraient pas voir, ou permettre une affectation de masse où les utilisateurs peuvent modifier des champs qu'ils ne devraient pas.

**Contribution de STOA** : STOA supporte le **filtrage des réponses** — des politiques OPA peuvent être configurées pour supprimer des champs des réponses selon le tier du consommateur. Par exemple, un consommateur analytics pourrait recevoir des données agrégées sans champs PII.

**Ce qui nécessite une implémentation backend** : L'autorisation au niveau champ dans les modèles de données complexes nécessite que le backend comprenne le schéma de données. La protection contre l'affectation de masse nécessite une validation des entrées côté serveur. STOA aide au niveau de ce qui sort du gateway, mais les services backend doivent implémenter leur propre filtrage de champs.

---

### API4 : Consommation de Ressources Non Restreinte

**Risque** : APIs sans limites sur le volume de requêtes, la taille des payloads, ou la complexité des requêtes, permettant des attaques par déni de service et épuisement des ressources.

**Contribution de STOA** : Couverture forte au niveau de la couche gateway :

- **Rate limiting** : par consommateur, par endpoint, fenêtres configurables (par seconde, par minute, par heure)
- **Application des quotas** : limites strictes sur les volumes d'appels journaliers/mensuels par tier d'abonnement
- **Protection contre les pics** : l'algorithme token bucket gère les pics de trafic sans rejeter les requêtes légitimes
- **Limites de taille des requêtes** : taille maximale de payload configurable par endpoint
- **Limites de taille des réponses** : les guardrails peuvent tronquer les réponses trop volumineuses
- **Limites de connexions simultanées** : configurables par consommateur

Le rate limiting de STOA est soutenu par un store en mémoire avec des politiques configurables. Les consommateurs dépassant les limites reçoivent `429 Too Many Requests` avec un header `Retry-After`.

---

### API5 : Autorisation au Niveau Fonction Défaillante

**Risque** : Contrôle d'accès appliqué sur les objets de données mais pas sur les fonctions API (méthodes HTTP et chemins d'endpoints). Les utilisateurs peuvent appeler des fonctions administratives en devinant les URLs d'endpoints.

**Contribution de STOA** : Les politiques OPA dans STOA peuvent être écrites pour appliquer l'autorisation par méthode HTTP et chemin :

```rego
# Bloquer POST/PUT/DELETE pour les consommateurs en lecture seule
deny {
    input.consumer.scope == "stoa:read"
    input.method != "GET"
    input.method != "HEAD"
    input.method != "OPTIONS"
}

# Bloquer /admin/* pour les consommateurs non-admin
deny {
    not contains(input.consumer.scope, "stoa:admin")
    startswith(input.path, "/admin/")
}
```

**Niveau de couverture** : Cela fournit une autorisation au niveau fonction au niveau du gateway, mais uniquement pour les endpoints qui passent par STOA en proxy. Si les services backend exposent des endpoints directement (en contournant le gateway), les politiques au niveau gateway ne s'appliquent pas.

---

### API6 : Accès Non Restreint aux Flux Métier Sensibles

**Risque** : APIs exposées à des abus automatisés de la logique métier (par ex. : création de comptes en masse, credential stuffing, rachat massif de coupons).

**Contribution de STOA** : Les politiques OPA peuvent implémenter des contrôles au niveau flux :
- Limiter des séquences spécifiques d'opérations (par ex. : max 3 réinitialisations de mot de passe par heure)
- Détecter des patterns d'utilisation anormaux via le rate limiting sur des chemins spécifiques
- Bloquer des patterns d'automatisation connus via des politiques user-agent

**Limitations** : La protection réelle des flux métier nécessite une compréhension de la logique applicative. STOA peut rate-limiter des chemins spécifiques, mais les abus de flux multi-étapes complexes (manipulation de panier, empilement séquentiel de remises) nécessitent une détection au niveau applicatif.

---

### API7 : Server Side Request Forgery (SSRF)

**Risque** : Une entrée contrôlée par un attaquant amène le serveur API à effectuer des requêtes HTTP vers des ressources internes (APIs de métadonnées cloud, services internes).

**Contribution de STOA** : STOA maintient une liste de blocage SSRF pour les requêtes sortantes :
- Bloque les requêtes vers `169.254.169.254` (métadonnées AWS/GCP)
- Bloque les requêtes vers `localhost`, `127.0.0.1`, `::1`
- Bloque les requêtes vers les plages IP privées (`10.x`, `172.16.x`, `192.168.x`) sauf si explicitement autorisé

Cela s'applique aux requêtes où STOA agit comme proxy ou où les URLs backend sont configurables.

**Limitations** : Le SSRF dans le code applicatif backend n'est pas adressable au niveau de la couche gateway. Les applications qui construisent des URLs depuis des entrées utilisateur doivent valider ces URLs indépendamment du gateway.

---

### API8 : Mauvaise Configuration de Sécurité

**Risque** : Paramètres par défaut non sécurisés, configurations incomplètes, permissions incorrectes, chiffrement manquant, ou verbosité excessive des messages d'erreur.

**Contribution de STOA** : Paramètres sécurisés par défaut tout au long :
- TLS 1.2+ appliqué, TLS 1.0/1.1 désactivé
- Les messages d'erreur détaillés retournés aux clients ne contiennent pas de traces de pile internes ni de détails système
- Headers de sécurité définis automatiquement (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`)
- OPA refuse par défaut (politique manquante = rejet)
- Toutes les opérations de gestion API nécessitent une authentification

**Ce qui nécessite une revue par l'opérateur** : Les configurations du gateway sont aussi sécurisées que la façon dont elles sont déployées. Les opérateurs doivent : activer mTLS en production, définir des TTL de tokens appropriés, réviser les politiques OPA pour détecter les permissivités non intentionnelles, et restreindre l'accès à l'API admin STOA.

---

### API9 : Gestion Inadéquate des Inventaires

**Risque** : Versions d'API obsolètes ou fantômes exposées en production qui manquent des contrôles de sécurité des versions actuelles.

**Contribution de STOA** : Le control plane STOA maintient un registre de toutes les APIs déployées avec leur version, statut et configuration d'endpoint. Les opérateurs peuvent consulter et déprécier les anciennes versions d'API via la Console ou l'API.

**Limitations** : STOA gère les APIs qui sont enregistrées sur la plateforme. Les APIs fantômes (déployées directement sur les services backend, en contournant STOA) ne sont pas visibles sans des outils de découverte au niveau couche réseau séparés.

---

### API10 : Consommation Non Sécurisée des APIs

**Risque** : Applications faisant confiance aux données d'APIs tierces sans validation, permettant l'injection via des APIs en amont.

**Contribution de STOA** : La validation des schémas de requête et de réponse assure que les données sont conformes aux spécifications OpenAPI attendues. Les guardrails analysent les payloads de réponse à la recherche de patterns d'injection avant de les transmettre aux clients. Cela adresse partiellement les problèmes de confiance aux APIs tierces quand STOA se situe entre les clients et les APIs en amont.

**Limitations** : La validation de la confiance sémantique (ces données sont-elles légitimes ?) nécessite une logique applicative. La validation de schéma détecte les violations de structure, pas la manipulation sémantique.

## Recommandations d'Implémentation

Pour maximiser la couverture OWASP avec STOA :

1. **Activer mTLS pour toutes les connexions agent** — adresse API2 au niveau de la couche transport
2. **Définir des politiques OPA pour chaque tier de consommateur** — adresse API1, API5, API6 au niveau de la couche gateway
3. **Configurer des limites de débit par endpoint** — adresse API4
4. **Activer les guardrails + filtrage des réponses** — adresse API3, API7, API10 partiellement
5. **Utiliser le registre API de STOA pour la gestion des versions** — adresse API9
6. **Réviser le checklist de renforcement de la sécurité** — voir [Renforcement de Sécurité des API Gateways](/blog/api-gateway-security-hardening-guide)

**Ce que STOA ne remplace pas** : L'autorisation au niveau applicatif, la validation de la logique métier et les décisions de confiance aux APIs tierces nécessitent une implémentation dans les services backend et sont hors du périmètre d'un API gateway.

## Foire aux Questions

### L'utilisation de STOA rend-elle mes APIs conformes OWASP ?

STOA aide à adresser plusieurs risques de l'OWASP API Security Top 10 au niveau de la couche infrastructure. La conformité OWASP n'est pas un état binaire — c'est une évaluation de si des contrôles spécifiques sont implémentés pour des risques spécifiques. L'utilisation de STOA adresse les contrôles de la couche gateway. Les risques au niveau applicatif (propriété des objets, logique métier, confiance aux tierces parties) nécessitent une implémentation backend. Les organisations cherchant une évaluation formelle de conformité devraient faire appel à un évaluateur de sécurité qualifié.

### Quels risques OWASP STOA adresse-t-il le plus fortement ?

STOA offre la couverture la plus forte pour API2 (authentification), API4 (consommation de ressources) et API8 (configuration). Ce sont des préoccupations au niveau infrastructure qu'un API gateway est spécifiquement conçu pour adresser. API1, API3, API5, API6 nécessitent une combinaison de politiques gateway et d'implémentation backend.

### L'OWASP API Security Top 10 est-il le même que l'OWASP Top 10 ?

Non. L'OWASP Top 10 couvre les vulnérabilités des applications web (injection, XSS, CSRF, etc.). L'OWASP API Security Top 10 est une liste séparée axée sur les risques spécifiques aux APIs. Certains chevauchements existent (authentification, mauvaise configuration de sécurité), mais la liste API adresse des patterns spécifiques à la conception API — autorisation d'objets, exposition de propriétés, abus de flux métier — qui ne sont pas prédominants dans les contextes d'applications web.

---

*STOA Platform est open source (Apache 2.0). Explorez la [documentation de sécurité](https://docs.gostoa.dev/docs/reference/security) ou [déployez le gateway](https://docs.gostoa.dev/docs/guides/quickstart).*
