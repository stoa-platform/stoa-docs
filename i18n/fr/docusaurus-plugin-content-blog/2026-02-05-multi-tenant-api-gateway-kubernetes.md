---
slug: multi-tenant-api-gateway-kubernetes
title: "API Gateway multi-tenant sur Kubernetes : leçons apprises"
authors: [stoa-team]
tags: [architecture, feature]
description: "Nous avons testé les modèles namespace-par-tenant et partagé. Voici les compromis, plus comment Keycloak, OPA et les CRDs appliquent l'isolation tenant."
keywords:
  - multi-tenant API gateway
  - Kubernetes API gateway
  - API gateway multi-tenancy
  - Kubernetes multi-tenancy
  - tenant isolation
  - API gateway Kubernetes
  - multi-tenant architecture
---
<!-- last verified: 2026-02 -->

Construire un **API gateway multi-tenant** est l'un des défis d'infrastructure les plus difficiles en plateforme engineering. Vous avez besoin d'une isolation forte entre les tenants, d'une infrastructure partagée pour l'efficacité, et de la capacité à scaler sans multiplier la complexité opérationnelle. Après des années à construire des plateformes API multi-tenants — et en appliquant ces leçons à STOA sur Kubernetes — voici ce que nous avons appris.

Cet article fait partie de la série [API Gateway Open Source 2026](/blog/open-source-api-gateway-2026), couvrant les patterns architecturaux pour l'infrastructure API moderne.

<!-- truncate -->

La multi-tenancy dans l'API management ne se résume pas au routage de requêtes vers différents backends. Elle englobe l'authentification, l'autorisation, le rate limiting, la journalisation, la facturation, et — de façon critique — la garantie que le trafic, les données et la configuration d'un tenant ne peuvent pas affecter ceux d'un autre. Réussir cela sur Kubernetes nécessite des choix architecturaux délibérés à chaque couche.

## Le défi de la multi-tenancy pour les API Gateways

Les API gateways traditionnels ont été construits pour des déploiements single-tenant. Vous déployez un gateway, configurez vos routes et gérez un seul ensemble de politiques. Quand vous devez servir plusieurs organisations indépendantes depuis la même plateforme, plusieurs problèmes émergent :

- **Contamination de la configuration** — La configuration de routes d'un tenant ne doit jamais interférer avec celle d'un autre.
- **Isolation des données** — Les clés API, les logs d'utilisation et les données d'abonnement doivent être strictement séparés.
- **Isolation des performances** — Un pic de trafic d'un tenant ne devrait pas dégrader le service pour les autres.
- **Frontières de sécurité** — Les tokens d'authentification et les décisions de politique doivent être scoped à un seul tenant.
- **Surcharge opérationnelle** — Déployer N instances de gateway séparées pour N tenants ne scale pas.

## Deux modèles : namespace-par-tenant vs. gateway partagé

Sur Kubernetes, les deux modèles principaux de multi-tenancy ont chacun des compromis distincts.

### Modèle 1 : Namespace-par-tenant

Dans ce modèle, chaque tenant obtient un namespace Kubernetes dédié avec sa propre instance de gateway, son propre schéma de base de données et sa propre configuration.

**Avantages :**
- Isolation forte par défaut (RBAC Kubernetes, NetworkPolicies)
- Scaling indépendant par tenant
- Rayon d'explosion simple — une mauvaise configuration n'affecte qu'un seul tenant
- Mapping naturel vers les quotas de ressources Kubernetes

**Inconvénients :**
- La surcharge opérationnelle croît linéairement avec le nombre de tenants
- Inefficacité des ressources (chaque instance de gateway consomme de la mémoire/CPU de base)
- Les fonctionnalités cross-tenant (analytics globaux, outillage partagé) sont plus difficiles à implémenter
- La gestion des certificats et le routage d'ingress deviennent complexes

### Modèle 2 : Gateway partagé avec isolation logique

Un seul déploiement de gateway gère tous les tenants, avec l'isolation appliquée au niveau de la couche applicative via la propagation du contexte tenant, les politiques scoped et le stockage partitionné.

**Avantages :**
- Utilisation efficace des ressources
- Opérations plus simples (un seul déploiement à monitorer et mettre à niveau)
- Plus facile à implémenter des fonctionnalités cross-tenant
- Coût d'infrastructure plus faible

**Inconvénients :**
- Les bugs d'isolation peuvent avoir un large rayon d'explosion
- Nécessite une ingénierie soigneuse du contexte tenant à chaque couche
- L'isolation des performances nécessite des mécanismes supplémentaires (rate limiting par tenant, files de priorité)
- Plus complexe à raisonner sur la sécurité

### L'approche hybride : ce que STOA utilise

STOA utilise un **modèle hybride** qui combine les forces des deux approches. Le gateway lui-même est un déploiement partagé, mais l'isolation tenant est appliquée via trois mécanismes indépendants travaillant de concert.

## Comment STOA implémente l'isolation multi-tenant

### Couche 1 : Isolation par namespace Kubernetes

Les ressources personnalisées de chaque tenant (outils MCP, ToolSets, abonnements) vivent dans un namespace dédié :

```
tenant-acme/        # Namespace pour Acme Corp
  Tool/weather-api
  Tool/billing-api
  ToolSet/public-tools
  Subscription/acme-sub-001

tenant-globex/      # Namespace pour Globex
  Tool/inventory-api
  ToolSet/internal-tools
  Subscription/globex-sub-001
```

Le RBAC Kubernetes garantit que les comptes de service ne peuvent surveiller que les ressources dans leurs namespaces assignés. Les NetworkPolicies restreignent la communication pod-à-pod entre les frontières tenant.

Cela nous donne le **confinement du rayon d'explosion** du namespace-par-tenant sans la surcharge de déploiement d'instances de gateway séparées. En savoir plus dans la [documentation des concepts multi-tenancy](https://docs.gostoa.dev/docs/concepts/multi-tenant).

### Couche 2 : Séparation des realms Keycloak

Chaque tenant se mappe à un realm Keycloak dédié. Cela fournit :

- **Gestion d'identité indépendante** — Chaque tenant gère ses propres utilisateurs et groupes.
- **Configurations OIDC séparées** — Durées de vie des tokens, exigences MFA et fournisseurs d'identité différents par tenant.
- **Credentials client isolés** — Les clés API et les clients OAuth sont scoped à un seul realm.
- **Identité fédérée** — Les tenants peuvent apporter leur propre IdP (SAML, LDAP, connexion sociale) sans affecter les autres.

Quand une requête atteint le gateway, la claim `iss` (émetteur) du token JWT identifie le realm Keycloak, qui se mappe à un tenant. Ce mapping est validé avant toute évaluation de routage ou de politique.

### Couche 3 : Base de données schéma-par-tenant

Le Control Plane API utilise PostgreSQL avec un modèle schéma-par-tenant :

```
stoa_db/
  public/           # Métadonnées partagées (registre tenant, config globale)
  tenant_acme/      # APIs d'Acme, abonnements, données d'utilisation
  tenant_globex/    # APIs de Globex, abonnements, données d'utilisation
```

Chaque requête de base de données inclut le schéma tenant dans le search path, appliqué au niveau de la connexion par l'ORM (SQLAlchemy). Cela signifie :

- Un bug dans une requête ne peut pas accidentellement retourner les données d'un autre tenant.
- Les sauvegardes et restaurations de bases de données peuvent être effectuées par tenant.
- Les migrations de schéma sont appliquées par tenant, permettant des déploiements progressifs.
- Le monitoring des performances peut suivre les patterns de requêtes par tenant.

## Leçons apprises

Après avoir exploité cette architecture en production, voici les leçons les plus importantes.

### Leçon 1 : Le contexte tenant doit être immuable après l'authentification

La décision de conception la plus importante : une fois qu'une requête est authentifiée et que le contexte tenant est établi, ce contexte doit être **immuable et infalsifiable** pour tout le cycle de vie de la requête. Nous propageons le contexte tenant comme une claim validée dans le JWT, pas comme un header qui peut être usurpé.

Au début du développement, nous avons expérimenté l'identification tenant via des headers HTTP (`X-Tenant-ID`). Cela a conduit à des bugs subtils où les appels service-à-service internes pouvaient accidentellement transmettre le mauvais header tenant. La liaison tenant basée sur JWT a éliminé entièrement cette classe de bugs.

### Leçon 2 : Les politiques OPA doivent être tenant-aware dès le premier jour

Nous utilisons Open Policy Agent (OPA) pour l'autorisation fine-grained. Une leçon critique : chaque règle de politique doit inclure la dimension tenant dès le début. Intégrer le scoping tenant dans des politiques existantes est source d'erreurs et crée une fenêtre pour l'escalade de privilèges.

Dans STOA, les politiques OPA reçoivent le contexte tenant complet en entrée et vérifient que les ressources demandées par l'appelant appartiennent au bon tenant :

```rego
allow {
    input.resource.namespace == input.caller.tenant_namespace
    input.caller.roles[_] == "tenant-admin"
}
```

Cela garantit que même une route mal configurée ne peut pas exposer les ressources d'un tenant à un autre. Voir l'[aperçu de l'architecture](https://docs.gostoa.dev/docs/concepts/architecture) pour les détails sur le flux des politiques dans le système.

### Leçon 3 : Le rate limiting doit être par tenant, pas global

Un gateway partagé avec un seul rate limit global est un vecteur de déni de service. Un tenant peut épuiser le rate limit, bloquant effectivement tous les autres tenants.

STOA implémente un **rate limiting hiérarchique** :

1. **Limite globale** — Protège l'infrastructure de la surcharge totale.
2. **Limite par tenant** — Chaque tenant obtient une allocation garantie.
3. **Limite par abonnement** — Les clés API individuelles ont leurs propres limites dans l'allocation tenant.

Cela garantit une distribution équitable des ressources et évite les problèmes de voisin bruyant.

### Leçon 4 : L'observabilité a besoin de dimensions tenant

Chaque métrique, log et trace doit porter l'identifiant tenant. Sans cela, le débogage d'un problème de performance devient un jeu de devinettes entre tous les tenants.

STOA tague toutes les données d'observabilité avec `tenant_id`, permettant :

- Des tableaux de bord par tenant dans Grafana
- Des requêtes de logs scoped au tenant dans OpenSearch
- Le monitoring SLA par tenant
- La facturation basée sur l'utilisation à partir des données de comptage

### Leçon 5 : Les CRDs sont la bonne abstraction pour les ressources tenant

Les Custom Resource Definitions (CRDs) Kubernetes se sont avérées être un excellent moyen de modéliser les configurations API spécifiques aux tenants. Les CRDs nous donnent :

- **Configuration déclarative** — Les tenants décrivent ce qu'ils veulent, pas comment y parvenir.
- **RBAC natif Kubernetes** — Le RBAC scoped au namespace s'applique directement.
- **Sync basée sur watch** — Le gateway surveille les changements CRD et met à jour le routage en temps réel.
- **Compatibilité GitOps** — Les configurations tenant peuvent être gérées via ArgoCD.

### Leçon 6 : Testez la multi-tenancy avec des scénarios adversariaux

Les tests d'intégration standard ne sont pas suffisants. Vous avez besoin de tests qui essayent spécifiquement de violer les frontières tenant :

- S'authentifier en tant que tenant A, essayer d'accéder aux ressources du tenant B.
- Envoyer des requêtes avec des headers tenant manipulés.
- Créer des ressources dans un namespace et vérifier qu'elles sont invisibles depuis un autre.
- Épuiser le rate limit d'un tenant et vérifier que les autres ne sont pas affectés.

Nous exécutons ces tests adversariaux dans le cadre de notre suite E2E sur chaque PR.

## Quand choisir quel modèle

| Scénario | Modèle recommandé |
|---|---|
| < 10 tenants, exigences de conformité strictes | Namespace-par-tenant (instances dédiées) |
| 10-100 tenants, plateforme SaaS | Hybride (gateway partagé, isolation par namespace) |
| 100+ tenants, intégration self-service | Gateway partagé avec isolation au niveau applicatif |
| Services financiers (DORA) | Hybride avec plan de données dédié par tenant |

## Démarrer avec l'API management multi-tenant

L'architecture multi-tenant de STOA est disponible dès l'installation. Que vous construisiez une plateforme pour des équipes internes ou un produit SaaS avec des tenants externes, le modèle d'isolation évolue avec vous.

- Lisez la documentation [Concepts de multi-tenancy](https://docs.gostoa.dev/docs/concepts/multi-tenant)
- Explorez l'[Aperçu de l'architecture](https://docs.gostoa.dev/docs/concepts/architecture)
- Essayez STOA avec le [Guide de démarrage rapide](https://docs.gostoa.dev/docs/guides/quickstart)
- Déployez sur votre propre cluster Kubernetes avec le [Guide de déploiement hybride](https://docs.gostoa.dev/docs/deployment/hybrid)

---

## Foire aux questions

### Quelle est la différence entre les modèles namespace-par-tenant et gateway partagé ?

Namespace-par-tenant déploie une instance de gateway séparée pour chaque tenant dans son propre namespace Kubernetes, fournissant une isolation forte mais une surcharge opérationnelle élevée. Le gateway partagé utilise un seul déploiement avec l'isolation tenant au niveau applicatif (contexte tenant dans le JWT, politiques scoped, stockage partitionné). STOA utilise un hybride : déploiement de gateway partagé avec namespaces par tenant pour les ressources personnalisées, combinant efficacité et confinement du rayon d'explosion. Voir le tableau de comparaison dans cet article et les [concepts multi-tenancy](https://docs.gostoa.dev/docs/concepts/multi-tenant).

### Comment empêchez-vous un tenant d'accéder aux données d'un autre tenant ?

STOA applique l'isolation à trois couches : (1) le RBAC Kubernetes garantit que les comptes de service ne surveillent que les ressources dans leurs namespaces assignés, (2) la séparation des realms Keycloak fournit une gestion d'identité indépendante par tenant, (3) le schéma-par-tenant PostgreSQL partitionne toutes les données au niveau de la base de données. Le contexte tenant est immuable après l'authentification et propagé comme une claim JWT. Voir la section architecture de sécurité dans ce guide.

### Quelles ressources Kubernetes avez-vous besoin pour l'isolation multi-tenant ?

Au minimum : les NetworkPolicies (restreindre la communication pod-à-pod entre namespaces tenant), les rôles RBAC (empêcher l'accès aux ressources cross-namespace), les ResourceQuotas (limiter la consommation de ressources par tenant) et les PodSecurityPolicies ou contrôleurs d'admission comme Kyverno (appliquer les baselines de sécurité). STOA utilise tout cela plus des ressources personnalisées (CRDs) pour les configurations API spécifiques aux tenants. Voir les [concepts Kubernetes multi-tenancy](https://docs.gostoa.dev/docs/concepts/multi-tenant).

### Comment fonctionne le rate limiting multi-tenant ?

STOA implémente un rate limiting hiérarchique : (1) la limite globale protège l'infrastructure de la surcharge, (2) la limite par tenant garantit que chaque tenant obtient une allocation garantie, (3) la limite par abonnement contrôle les clés API individuelles dans un tenant. Cela évite les problèmes de voisin bruyant où le pic de trafic d'un tenant affecte les autres. Le contexte tenant du JWT guide la sélection de la clé de rate limit. Voir la Leçon 3 dans cet article.

---

*L'équipe STOA construit un API management open source pour l'ère IA. Suivez-nous sur [GitHub](https://github.com/stoa-platform).*
