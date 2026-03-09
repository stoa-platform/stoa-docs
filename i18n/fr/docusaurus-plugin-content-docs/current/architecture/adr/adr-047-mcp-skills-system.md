---
title: "ADR-047 : Système MCP Skills — Injection de Contexte"
description: "Décide que STOA utilise un système Skills hiérarchique avec des CRDs Kubernetes pour l'injection de contexte déclarative dans l'exécution des outils MCP, résolu au niveau de la couche middleware de la gateway."
keywords: [MCP, skills, injection de contexte, CRD, Kubernetes, middleware gateway, résolution hiérarchique, agent IA]
---

# ADR-047 : Système MCP Skills — Injection de Contexte

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Brouillon |
| **Date** | 2026-02-17 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1314 |
| **Council** | 8.00/10 Go |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le mode edge-mcp héberge la résolution des skills
- **ADR-041** : Plugin Architecture — les skills comme feature gate enterprise (flag `k8s`)
- **ADR-045** : Spécification Déclarative stoa.yaml — section skills dans la config déclarative
- **ADR-046** : Architecture de Fédération MCP — les skills se résolvent après la couche de fédération

## Contexte

Les agents IA connectés via MCP reçoivent des définitions d'outils (nom, description, schéma d'entrée) de la gateway. Cependant, les déploiements entreprise ont besoin d'injecter un **contexte supplémentaire** dans l'exécution des outils sans modifier les définitions individuelles — règles de conformité spécifiques à l'entreprise, conventions d'API internes, glossaires de domaine ou instructions par équipe.

### Le Problème

Aujourd'hui, la personnalisation du contexte nécessite l'un de ces contournements :

1. **Modifier chaque description d'outil** : Ajouter des notes de conformité dans le champ `description` de chaque outil. Ne passe pas à l'échelle — 50 outils × 3 règles de conformité = 150 modifications manuelles, à répéter à chaque changement de politique.

2. **System prompts côté client** : Chaque agent IA fait précéder les règles de l'entreprise dans son system prompt. Non applicable — la gateway ne peut pas vérifier que les agents incluent réellement le contexte.

3. **Middleware codé en dur** : Un middleware personnalisé dans la gateway qui injecte du texte statique. Non configurable par tenant, non compatible GitOps, nécessite un redéploiement de la gateway pour chaque modification.

### Ce dont Nous Avons Besoin

Un système **déclaratif et hiérarchique** où les administrateurs de plateforme définissent un contexte automatiquement injecté dans l'exécution des outils au niveau de la couche gateway — sans modifier les schémas d'outils et sans nécessiter la coopération des agents.

## Décision

### 1. CRD Skill (5ème Type de CRD)

Introduire un Custom Resource Definition Kubernetes `Skill` aux côtés des CRDs existants (Subscription, Tenant, Tool, ToolSet) :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: compliance-gdpr
  namespace: tenant-acme
  labels:
    stoa.dev/scope: tenant        # global | tenant | tool | user
    stoa.dev/priority: "100"      # Plus élevé = appliqué en dernier (surcharge les niveaux inférieurs)
spec:
  displayName: GDPR Compliance Context
  description: Injecte des instructions de conformité RGPD dans l'exécution des outils
  scope:
    type: tenant                   # Portée de résolution
    tenantId: acme                 # Quel tenant (omis pour global)
    toolPattern: "api-*"           # Optionnel : pattern glob pour correspondre aux outils
  context:
    instructions: |
      When processing data through this tool:
      - Never include personally identifiable information (PII) in logs
      - Mask email addresses and phone numbers in responses
      - Apply data minimization: only request fields needed for the operation
    metadata:
      regulation: GDPR
      lastReviewed: "2026-01-15"
  priority: 100                    # Ordre de résolution (plus élevé gagne en cas de conflit)
```

**Choix de conception du CRD** :
- **Scoped au namespace** : les skills tenant vivent dans le namespace du tenant (pattern existant)
- **Skills globaux** : vivent dans le namespace `stoa-system` avec `scope.type: global`
- **Filtrage par labels** : le watcher K8s de la gateway filtre par label `stoa.dev/scope`
- **Pas de données PII ni de secrets dans les définitions de Skill** (ajustement Council #4) : les Skills sont stockés dans etcd comme CRDs et sont visibles pour tous les opérateurs du cluster. Les instructions de contexte doivent être des politiques/configurations, jamais des identifiants ou des données personnelles.

### 2. Résolution Hiérarchique (Modèle Cascade CSS)

Les Skills se résolvent selon une hiérarchie à 4 niveaux. Lorsque plusieurs skills correspondent à l'exécution d'un outil, ils sont fusionnés dans l'ordre de priorité :

```
Niveau 1 : Skills Globaux        (namespace stoa-system, scope.type=global)
    ↓ fusionné avec
Niveau 2 : Skills Tenant         (namespace tenant, scope.type=tenant)
    ↓ fusionné avec
Niveau 3 : Skills Spécifiques à l'Outil (scope.toolPattern correspond au nom de l'outil)
    ↓ fusionné avec
Niveau 4 : Skills Utilisateur    (scope.userId correspond à l'utilisateur authentifié)
    ↓
Contexte final résolu (injecté dans l'exécution de l'outil)
```

**Règles de résolution** :
- Les niveaux plus élevés sont plus spécifiques et surchargent les niveaux inférieurs en cas de conflit
- Dans le même niveau, le champ `priority` départage les égalités (nombre plus élevé gagne)
- Plusieurs skills non conflictuels au même niveau sont concaténés
- Les niveaux vides sont ignorés (aucun contexte injecté à ce niveau)

**Exemple de résolution** :

```
Global : "Always include a request ID in API calls"          (priority: 10)
Tenant : "Use ISO 8601 dates, amounts in EUR"                (priority: 50)
Outil  : "api-create requires approval for amounts > 10000"  (priority: 100)
User   : (aucun)

Résolu : "Always include a request ID in API calls.
          Use ISO 8601 dates, amounts in EUR.
          api-create requires approval for amounts > 10000"
```

### 3. Point d'Injection Middleware Gateway

L'injection de contexte se produit dans le pipeline de requêtes de la gateway, entre la fédération (ADR-046) et la résolution des outils :

```
Requête MCP tools/call
       │
       ▼
┌─────────────────────┐
│  Auth (JWT/API key)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Fédération          │  (ADR-046 : politique sous-compte)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Résolution de Skill (NOUVEAU)      │
│                                     │
│  1. Extraire : tenant_id, tool_name,│
│     user_id depuis le contexte req  │
│  2. Interroger le cache skill (moka)│
│  3. Résoudre la hiérarchie (4 niv.) │
│  4. Attacher l'extension SkillContext│
│     à la requête Axum               │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Résolution d'Outil  │  Le handler d'outil lit SkillContext
│  + Exécution         │  et le préfixe dans le payload d'exécution
└──────────────────────┘
```

**Choix de conception critique (ajustement Council #3)** : L'injection de contexte de Skill est **interne à la gateway uniquement**. Elle enrichit le payload d'exécution d'outil envoyé au backend, mais ne modifie PAS le schéma d'outil MCP (réponse `tools/list`) retourné aux clients. Les clients voient des définitions d'outils inchangées — le contexte est invisible pour la couche protocole MCP.

**Implémentation** (Rust, flag de feature `k8s`) :
- Struct `SkillResolver` avec définitions de skills en cache moka (stale-while-revalidate)
- Watcher K8s sur les CRDs `Skill` (même pattern que les watchers Tool/ToolSet existants)
- Extension de requête Axum `SkillContext` (similaire à `TenantContext`, `SubAccountContext`)
- Repli : quand le feature `k8s` est désactivé, la résolution de skill est une no-op (retourne un contexte vide)

### 4. Auteur Principal et Workflow (ajustement Council #1)

| Auteur | Workflow | Cas d'Usage |
|--------|----------|----------|
| **Admin Plateforme** (principal) | Interface Console : page Skills avec éditeur YAML + aperçu | Définir règles de conformité, conventions API |
| **Ingénieur DevOps** | `kubectl apply -f skill.yaml` / GitOps via ArgoCD | Infrastructure-as-code, versionné |
| **stoactl** | `stoactl skill create/list/get/delete` | Gestion piloté par CLI |

L'interface Console fournit un panneau d'aperçu montrant le contexte résolu pour une combinaison tenant/outil/utilisateur donnée — cela sert de trace de débogage (ajustement Council #2).

### 5. Endpoint de Trace de Résolution (ajustement Council #2)

Un endpoint de debug pour que les opérateurs comprennent quel contexte un agent recevrait :

```
GET /admin/skills/resolve?tenant=acme&tool=api-create&user=john
```

Réponse :
```json
{
  "resolved_context": "Always include a request ID...\nUse ISO 8601...\napi-create requires approval...",
  "trace": [
    {"level": "global", "skill": "request-id-policy", "priority": 10, "matched": true},
    {"level": "tenant", "skill": "compliance-gdpr", "priority": 50, "matched": true},
    {"level": "tool", "skill": "api-create-approval", "priority": 100, "matched": true},
    {"level": "user", "skill": null, "matched": false}
  ]
}
```

Cet endpoint fait partie de l'API admin de la gateway (auth bearer token, portée `stoa:admin`).

## Alternatives Considérées

### A. Enrichissement de Description d'Outil

Modifier le champ `description` de chaque outil pour inclure le contexte.

**Rejeté car** : ne passe pas à l'échelle, pollue la couche protocole MCP, nécessite de ré-enregistrer les outils à chaque changement de contexte, ne peut pas différencier par tenant ou par utilisateur.

### B. Extension du Protocole MCP (champ `context` personnalisé)

Ajouter un champ `context` non standard aux réponses MCP `tools/call`.

**Rejeté car** : rompt la conformité à la spec MCP. Les clients qui ne comprennent pas le champ l'ignoreraient. Le protocole MCP n'a pas de concept d'injection de contexte côté serveur — c'est une préoccupation de gateway, pas de protocole.

### C. Configuration Basée sur ConfigMap

Utiliser des ConfigMaps Kubernetes au lieu d'un CRD dédié.

**Rejeté car** : les ConfigMaps manquent de validation de schéma, ne supportent pas les champs `scope`/`priority` nativement, et ne peuvent pas exploiter le pattern de watcher K8s avec désérialisation typée. Les CRDs fournissent validation, versionnage et découvrabilité `kubectl get skills`.

### D. Base de Données Uniquement (pas de CRD)

Stocker les skills uniquement dans la base de données du Control Plane API.

**Rejeté car** : rompt le pattern GitOps (ADR-040). Les CRDs permettent `kubectl apply` et des définitions de skills gérées par ArgoCD. La base de données CP API stocke le cache résolu ; le CRD est la source de vérité.

## Conséquences

### Positives

- **Déclaratif** : les Skills sont natifs Kubernetes, compatibles GitOps (ArgoCD, kubectl)
- **Hiérarchique** : la cascade de type CSS donne un contrôle fin (règles globales + surcharges tenant)
- **Non invasif** : schémas d'outils inchangés, conformité au protocole MCP préservée
- **Observable** : endpoint de trace de résolution pour le débogage
- **Feature-gated** : flag Cargo `k8s` — l'image community a une no-op, l'enterprise a la résolution complète

### Négatives

- **5ème CRD** : ajoute une surface opérationnelle pour les opérateurs K8s
- **Cohérence du cache** : les changements de Skill prennent jusqu'à TTL secondes pour se propager (atténué par stale-while-revalidate)
- **Pas de visibilité client** : les agents ne savent pas que le contexte a été injecté — utile pour l'application, mais opaque pour le débogage côté client

### Risques

| Risque | Atténuation |
|------|------------|
| Contexte de Skill trop grand (budget de tokens) | Appliquer une taille de contexte maximale par skill (ex. 2000 chars) ; avertissement dans l'interface Console |
| Skills conflictuels à la même priorité | Départage déterministe : alphabétique par nom de skill dans la même priorité |
| Skills contenant des données PII/secrets | Le webhook de validation rejette les skills avec des patterns de secrets connus ; la documentation avertit les opérateurs |
| Miss du watcher K8s (CRD créé mais non vu) | Stale-while-revalidate + resync complet périodique (toutes les 5 min) |

## Phases d'Implémentation

### Phase 1 : Modèle Skill + CRD (~8 pts)

- Définition du CRD `Skill` (`charts/stoa-platform/crds/skill.yaml`)
- Repository Skill dans le Control Plane API (CRUD + sync)
- Watcher K8s dans la gateway (flag de feature `k8s`, même pattern que le CRD Tool)
- `SkillResolver` avec cache moka
- Tests unitaires : 15+ tests

### Phase 2 : Injection de Contexte Gateway (~8 pts)

- Middleware de résolution de Skill (couche Axum entre fédération et résolution d'outils)
- Logique de résolution hiérarchique (cascade à 4 niveaux)
- Extension de requête `SkillContext`
- Intégration du handler d'outil (préfixe du contexte dans le payload d'exécution)
- Endpoint admin de trace de résolution
- Tests unitaires : 15+ tests

### Phase 3 : Intégration Agent + Tests (~5 pts)

- Interface Console : page de gestion des Skills (liste, créer, éditer, aperçu)
- Commandes `stoactl skill` (create, list, get, delete)
- Tests E2E : 5+ scénarios (skill global, surcharge tenant, spécifique à l'outil, trace de résolution)
- Documentation : Guide Skills dans stoa-docs

## Références

- [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Spécification MCP 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024 : Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-040 : Born GitOps Multi-Environnement](/docs/architecture/adr/adr-040-born-gitops-multi-environment)
- [ADR-041 : Plugin Architecture](/docs/architecture/adr/adr-041-plugin-architecture-community-enterprise)
- [ADR-046 : Architecture de Fédération MCP](/docs/architecture/adr/adr-046-mcp-federation-architecture)
