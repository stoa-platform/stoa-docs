---
unlisted: true
slug: saas-playbook-1-multi-tenancy-101
title: "Multi-Tenancy 101 : L'Isolation des Tenants SaaS à Grande Échelle"
description: "Namespace par tenant ou cluster partagé ? Comparez les modèles d'isolation, le RBAC Keycloak et les politiques OPA pour les APIs SaaS multi-tenant."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - multi-tenancy SaaS API gateway
  - tenant isolation API gateway
  - multi-tenant architecture SaaS
  - API gateway multi-tenancy tutorial
  - SaaS multi-tenant setup
  - per-tenant API configuration
  - STOA multi-tenancy
---
<!-- last verified: 2026-02 -->

La multi-tenancy est la colonne vertébrale architecturale de tout produit SaaS. Bien réalisée, elle vous permet de servir des milliers d'organisations depuis un seul déploiement avec une isolation forte, des coûts prévisibles et zéro contamination croisée. Mal réalisée, elle est à l'origine de vos pires incidents de production — du genre où les données du tenant A apparaissent dans la réponse du tenant B.

Il s'agit de la Partie 1 de la série **SaaS Playbook**. Nous couvrons les concepts fondamentaux et la manière dont STOA gère la multi-tenancy au niveau de la couche API gateway. Les parties suivantes approfondissent les [stratégies de rate limiting](/blog/saas-playbook-2-rate-limiting-saas), l'audit et la conformité, la mise à l'échelle et les checklists de production.

<!-- truncate -->

## Qu'est-ce que la Multi-Tenancy et Pourquoi Est-ce Important ?

Un **tenant** est tout client indépendant, toute organisation ou espace de travail qui partage votre infrastructure mais doit être logiquement séparé de tous les autres. Dans un produit SaaS multi-tenant :

- Le tenant A ne peut pas lire les réponses API du tenant B
- Les limites de rate du tenant A n'affectent pas le quota du tenant B
- L'administrateur du tenant A ne peut pas voir la configuration du tenant B
- Une mauvaise configuration dans le namespace du tenant A ne peut pas router du trafic vers le backend du tenant B

Cela semble évident. L'implémentation, elle, ne l'est pas.

Les applications monolithiques traditionnelles stockaient la séparation des tenants dans la couche applicative — une colonne `tenant_id` dans chaque table, des politiques de sécurité au niveau des lignes, un filtrage soigneux des requêtes. La couche API gateway était généralement laissée en dehors du tableau : un gateway, un ensemble de routes, pas de concept de tenant.

Cela fonctionnait quand les tenants étaient des développeurs frappant votre API REST. Cela s'effondre quand les tenants sont :

- **Des organisations avec des exigences de conformité différentes** (résidence GDPR pour les tenants EU, HIPAA pour la santé US)
- **Des clients avec des SLA différents** (les tenants enterprise ont besoin de 99,99 %, le niveau gratuit est best-effort)
- **Des équipes avec des déploiements backend différents** (certains tenants ont une infrastructure dédiée, d'autres la partagent)
- **Des agents IA avec des permissions d'outils différentes** (les agents du tenant A peuvent accéder aux APIs de facturation, ceux du tenant B ne le peuvent pas)

Le API gateway doit devenir un **plan de contrôle tenant-aware** — pas seulement un proxy.

## Les Trois Modèles d'Isolation

Avant de construire quoi que ce soit, vous devez choisir votre modèle d'isolation. Il existe trois approches fondamentales, chacune avec des compromis distincts.

### 1. Modèle Silo (Infrastructure Dédiée par Tenant)

Chaque tenant dispose de son propre déploiement : namespace séparé, base de données séparée, instance de gateway séparée.

```
Tenant A: namespace=acme    → gateway-acme → backend-acme → db-acme
Tenant B: namespace=globex  → gateway-globex → backend-globex → db-globex
```

**Avantages** : Isolation maximale, une brèche chez un tenant ne peut pas affecter les autres, conformité facilitée (la résidence des données est triviale).

**Inconvénients** : Le coût de l'infrastructure évolue linéairement avec le nombre de tenants. La complexité opérationnelle augmente rapidement. Réalisable pour des contrats enterprise avec 50+ tenants, impraticable pour les SaaS PME avec 500+ tenants.

**Quand l'utiliser** : Industries réglementées (santé, finance), clients ayant des exigences strictes de résidence des données, comptes enterprise valant >50k € ARR.

### 2. Modèle Pool (Infrastructure Partagée, Séparation Logique)

Tous les tenants partagent l'infrastructure. La séparation est appliquée au niveau de l'application et de la couche gateway via des identifiants de tenant, le RBAC et la sécurité au niveau des lignes.

```
All tenants → shared-gateway → shared-backend → shared-db (with tenant_id filter)
```

**Avantages** : Faible coût d'infrastructure, facilité de mise à l'échelle, simplicité opérationnelle.

**Inconvénients** : Risque de voisin bruyant (le burst de trafic d'un tenant affecte les autres), code applicatif complexe, histoire de conformité plus difficile.

**Quand l'utiliser** : SaaS en phase initiale, produits B2C, segments gratuits / PME.

### 3. Modèle Bridge (Plan Partagé avec Ressources Scopées par Tenant)

Un plan de contrôle partagé avec des ressources de plan de données scopées par tenant. Le gateway est partagé, mais les CRDs et politiques scopées par tenant appliquent l'isolation. C'est pour cela que STOA est conçu.

```
Shared: control-plane, gateway, auth  →  Tenant A: tools, policies, rate limits, audit log
                                      →  Tenant B: tools, policies, rate limits, audit log
```

**Avantages** : Infrastructure efficace, isolation forte au niveau de la politique/routage, compatible conformité (les données des tenants ne se croisent jamais), s'adapte à des milliers de tenants.

**Inconvénients** : Configuration initiale plus complexe, nécessite un gateway avec support natif multi-tenant.

**Quand l'utiliser** : Plateformes de gestion d'API, portails développeur, produits SaaS avec architecture API-first.

## Comment STOA Implémente la Multi-Tenancy

STOA est conçu pour le modèle Bridge. La multi-tenancy n'est pas une fonctionnalité ajoutée par-dessus — c'est le mode de fonctionnement par défaut.

### Namespaces de Tenant

Chaque ressource dans STOA est scopée dans un namespace. Les namespaces correspondent aux namespaces Kubernetes lors de l'exécution sur K8s, ou à des partitions de configuration isolées en mode standalone.

Lorsque vous créez un tenant dans STOA :

```bash
stoactl tenants create --name acme --plan professional
```

STOA crée :
- Un namespace dédié (`tenant-acme`)
- Un realm Keycloak pour l'authentification
- Une politique de rate-limit par défaut (selon le niveau du plan)
- Un registre de Tools vide (outils MCP scopés à ce tenant)

Aucune lecture cross-namespace. Aucune écriture cross-namespace. Le plan de contrôle applique cela à chaque frontière d'API.

### Universal API Contract (UAC) par Tenant

Le **Universal API Contract** (UAC) de STOA est la définition scopée par tenant des APIs exposées, à qui, et avec quelles politiques. Chaque tenant possède son propre UAC — un manifeste YAML qui définit leur surface API complète.

```yaml
# tenant-acme-uac.yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: acme-contract
  namespace: tenant-acme
spec:
  version: "1.0"
  apis:
    - name: billing-api
      upstream: https://billing.acme.internal/v1
      policies:
        - rateLimit: tier-professional
        - auth: jwt-keycloak
        - audit: full
    - name: orders-api
      upstream: https://orders.acme.internal/v2
      policies:
        - rateLimit: tier-professional
        - auth: jwt-keycloak
```

L'insight clé : le contrat du tenant B référence des upstreams différents, des politiques différentes et une configuration d'authentification différente. Le gateway évalue chaque requête dans le contexte de son namespace de tenant — aucune fuite de configuration n'est possible.

### Realm Keycloak par Tenant

L'authentification est isolée au niveau du fournisseur d'identité. Chaque tenant dispose d'un realm Keycloak avec :

- Ses propres utilisateurs et comptes de service
- Ses propres clients OAuth2 (un par application)
- Ses propres rôles et groupes
- Ses propres clés de signature de token

Un token émis pour le realm du tenant A ne peut pas s'authentifier contre les APIs du tenant B. Le gateway valide le claim `iss` (issuer) et rejette les tokens des realms non correspondants.

### Application des Politiques Basée sur les CRDs

STOA utilise les Custom Resource Definitions (CRDs) Kubernetes pour définir les politiques scopées par tenant. Cela signifie que votre configuration de tenant vit dans Git, est revue comme du code, et est auditable.

```yaml
# guardrail-policy.yaml (scoped to tenant-acme namespace)
apiVersion: gostoa.dev/v1alpha1
kind: GuardrailPolicy
metadata:
  name: acme-guardrails
  namespace: tenant-acme
spec:
  rateLimit:
    requestsPerMinute: 1000
    burstMultiplier: 2.0
  contentFilter:
    piiDetection: redact
    blockedTopics: ["competitor-names", "internal-pricing"]
  toolAllowlist:
    - billing-api
    - orders-api
```

Cette politique est évaluée par requête, par tenant. Le tenant B possède sa propre `GuardrailPolicy` dans son propre namespace. Le gateway résout les politiques par namespace — il n'y a aucune contamination croisée.

Pour une plongée en profondeur dans les CRDs GuardrailPolicy, consultez la [Vue d'ensemble de l'Architecture STOA](/docs/concepts/architecture) dans notre documentation.

## Configuration Pratique : Votre Première API Multi-Tenant

Voici la configuration minimale pour faire fonctionner la multi-tenancy avec STOA.

### Prérequis

```bash
# Install stoactl
curl -sSL https://install.gostoa.dev | sh

# Configure endpoint
stoactl config set endpoint ${STOA_API_URL}
stoactl login
```

### Créer Vos Deux Premiers Tenants

```bash
# Create tenant A
stoactl tenants create \
  --name acme \
  --plan professional \
  --admin-email admin@acme.example.com

# Create tenant B
stoactl tenants create \
  --name globex \
  --plan starter \
  --admin-email admin@globex.example.com
```

### Enregistrer une API pour Chaque Tenant

```bash
# Register billing API for Tenant A
stoactl apis create \
  --tenant acme \
  --name billing-api \
  --upstream https://billing.acme.internal/v1 \
  --openapi billing-openapi.yaml

# Register inventory API for Tenant B
stoactl apis create \
  --tenant globex \
  --name inventory-api \
  --upstream https://inventory.globex.internal/v1 \
  --openapi inventory-openapi.yaml
```

### Vérifier l'Isolation

```bash
# Get a token for Tenant A
TOKEN_A=$(stoactl auth token --tenant acme)

# Try to access Tenant B's API with Tenant A's token
curl -H "Authorization: Bearer $TOKEN_A" \
  ${STOA_GATEWAY_URL}/globex/inventory-api/products

# Expected: 401 Unauthorized (wrong realm)
# Actual: 401 Unauthorized — isolation working
```

## Erreurs Courantes en Multi-Tenancy

Voici les pièges que nous observons le plus souvent lorsque les équipes implémentent la multi-tenancy au niveau de la couche gateway pour la première fois.

### Erreur 1 : L'ID de Tenant Uniquement dans le Chemin

Routage par préfixe de chemin (`/tenant-acme/api/resource`) n'est pas de l'isolation — c'est du routage. Une route mal configurée peut exposer le trafic d'un tenant à un autre. Appliquez toujours l'isolation dans la couche d'authentification ET la couche de routage.

### Erreur 2 : Rate Limits Partagées

Une seule limite de rate partagée entre tous les tenants crée un problème de voisin bruyant. Le tenant A lance une tâche d'export de données à 10 000 req/min et throttle tous les autres tenants. Les limites de rate doivent être par tenant, par niveau. Nous couvrons cela en détail dans la [Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas).

### Erreur 3 : Logs d'Audit Partagés

Si les événements des tenants arrivent dans le même flux de logs, vous avez un problème de conformité. Les tenants EU sous GDPR ont besoin de garanties de résidence des données — mélanger leurs logs d'audit avec des logs de tenants US viole cela. STOA écrit les événements d'audit dans des flux de logs par namespace par défaut.

### Erreur 4 : Métadonnées de Tenant Manquantes dans les Tokens

Les tokens doivent porter le contexte du tenant. Incluez `tenant_id` (ou équivalent) comme claim dans votre JWT. Le gateway peut alors appliquer des politiques scopées par tenant sans recherche supplémentaire.

```json
{
  "sub": "user-123",
  "tenant_id": "acme",
  "iss": "https://auth.gostoa.dev/realms/tenant-acme",
  "roles": ["tenant-admin"],
  "iat": 1740000000
}
```

### Erreur 5 : Oublier le Déchargement des Tenants

Quand un tenant se désabonne, sa configuration, ses tokens et ses logs d'audit doivent être purgés (ou archivés, selon vos exigences de conformité). STOA fournit `stoactl tenants delete --purge` pour la suppression de tenant conforme au GDPR.

## Considérations de Déploiement

Pour les équipes déployant sur Kubernetes, la multi-tenancy se mappe naturellement à l'isolation de namespace. Consultez notre guide détaillé sur le [Multi-Tenant API Gateway sur Kubernetes](/blog/multi-tenant-api-gateway-kubernetes) pour les patterns spécifiques à K8s incluant les NetworkPolicies, les ResourceQuotas et les décisions de namespace par tenant vs namespace par niveau.

Pour les équipes non présentes sur Kubernetes, le mode standalone de STOA supporte l'isolation des tenants via des partitions de configuration — les mêmes concepts UAC + GuardrailPolicy s'appliquent, sans la machinerie CRD K8s.

## Ce Qui Vient Ensuite

La multi-tenancy est le fondement. Construire un produit SaaS de production par-dessus nécessite :

- **Rate limiting par tenant et par niveau** — La Partie 2 de cette série couvre les quotas par tenant, les niveaux de clé API et la gestion des bursts
- **Journalisation d'audit et conformité GDPR** — La Partie 3 couvre la construction de pistes d'audit satisfaisant les régulateurs
- **Mise à l'échelle vers des milliers de tenants** — La Partie 4 couvre la mise à l'échelle horizontale, le connection pooling et les stratégies de cache
- **Prêt pour la production** — La Partie 5 est une checklist de mise en production en 20 points

**SaaS Playbook Complet :**
1. **Partie 1 : Multi-Tenancy 101** — Cet article
2. [Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas) — Quotas par tenant et gestion des bursts
3. [Partie 3 : Audit et Conformité](/blog/saas-playbook-3-audit-compliance) — Logs immuables et préparation GDPR
4. [Partie 4 : Mise à l'Échelle des APIs Multi-Tenant](/blog/saas-playbook-4-scaling-multi-tenant) — De 50 à 5000 tenants
5. [Partie 5 : Checklist de Production](/blog/saas-playbook-5-production-checklist) — Porte de mise en production en 20 points
6. [Build vs Buy : Analyse des Coûts d'API Gateway](/blog/saas-playbook-build-vs-buy-api-gateway) — Analyse TCO pour votre décision

## FAQ

### Qu'est-ce que la multi-tenancy dans une API SaaS ?

La multi-tenancy signifie que plusieurs clients (tenants) partagent la même infrastructure API, mais sont logiquement isolés les uns des autres. Chaque tenant dispose d'une authentification, de limites de rate, de configurations API et de logs d'audit séparés. Les données, le trafic ou la mauvaise configuration d'un tenant ne peuvent pas affecter un autre tenant.

### Quel modèle de multi-tenancy est le meilleur pour un SaaS en phase initiale ?

Le **modèle Pool** est généralement le meilleur pour les SaaS en phase initiale — il a le coût d'infrastructure le plus bas et les opérations les plus simples. À mesure que vous grandissez et acquérez des clients enterprise avec des exigences de conformité, vous pouvez migrer vers le **modèle Bridge** (plan de contrôle partagé, plan de données isolé par tenant). STOA supporte les deux.

### Puis-je mélanger les niveaux d'isolation pour différents niveaux de tenant ?

Oui. Un pattern courant est : les tenants gratuits et PME partagent le modèle pool, les tenants enterprise obtiennent le modèle silo (namespace dédié + backend dédié). STOA supporte cela via la configuration basée sur les plans — les plans enterprise provisionnent automatiquement des namespaces dédiés.

### Comment STOA empêche-t-il les requêtes d'un tenant d'être routées vers le backend d'un autre tenant ?

STOA valide le contexte de tenant à trois couches : (1) le claim JWT `iss` doit correspondre au realm Keycloak du tenant, (2) la résolution des routes est scopée par namespace (seules les routes enregistrées dans le namespace `tenant-acme` sont visibles pour les requêtes du tenant-acme), (3) l'évaluation de la GuardrailPolicy est isolée par namespace. Les trois couches doivent passer pour qu'une requête atteigne un backend.

### La multi-tenancy fonctionne-t-elle avec le trafic MCP (agent IA) ?

Oui. Le support MCP de STOA est tenant-aware. Le registre d'outils MCP de chaque tenant est isolé — un agent IA authentifié pour le tenant A ne voit que les outils du tenant A. La validation des tokens, le rate limiting et la journalisation d'audit s'appliquent au trafic MCP de la même manière qu'au trafic REST.
