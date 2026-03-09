---
title: "ADR-045 : Spécification Déclarative stoa.yaml"
description: "Définit le format de configuration déclarative stoa.yaml, permettant le déploiement d'API natif GitOps via CLI, interface Console et MCP Copilot."
keywords: [ADR, stoa.yaml, déclaratif, GitOps, déploiement d'API, style Kubernetes, Vercel, CLI, stoactl]
---

# ADR-045 : Spécification Déclarative stoa.yaml

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-16 |
| **Auteur** | Christophe ABOULICAM |
| **Décideurs** | Équipe Core STOA |
| **Catégorie** | Architecture / Expérience Développeur / GitOps |
| **Linear** | CAB-1352 |

### Décisions Liées

- **ADR-007** : GitOps avec ArgoCD
- **ADR-024** : Gateway Unified Modes (edge-mcp, sidecar, proxy, shadow)
- **ADR-037** : Modes de Déploiement — Stratégie Souveraineté d'Abord
- **CAB-374** : Deployment Lifecycle MEGA (ticket parent)
- **CAB-1353** : Deployment Lifecycle API (PR #570)

## Contexte

La STOA Platform permet aux organisations de déployer des APIs sur plusieurs gateways (STOA, Kong, Gravitee, webMethods, Apigee) avec un plan de contrôle unifié. Aujourd'hui, le déploiement d'API nécessite plusieurs étapes sur différentes interfaces :

1. Téléverser la spec OpenAPI via l'interface Console
2. Configurer les rate limits manuellement dans la Console
3. Configurer CORS via un écran de politique séparé
4. Déployer sur le gateway via le bouton « Deploy »
5. Répéter pour chaque environnement (dev, staging, production)

### Énoncé du Problème

**Pas de source de vérité unique** : la configuration d'API est dispersée entre les formulaires de l'interface Console, les déploiements manuels et des paramètres non documentés.

**Pas de workflow GitOps** : les développeurs ne peuvent pas versionner leur configuration d'API aux côtés du code backend.

**Pas d'intégration CI/CD** : les pipelines automatisés ne peuvent pas déployer des APIs par programme sans scripts client API complexes.

**Pas de support MCP Copilot** : les agents IA ne peuvent pas proposer ou exécuter des déploiements d'API sans format déclaratif.

### Inspiration

| Plateforme | Format | Philosophie |
|----------|--------|------------|
| **Vercel** | `vercel.json` | Config-as-code, valeurs par défaut zéro-config |
| **Kubernetes** | Manifestes YAML | État désiré déclaratif |
| **Terraform** | Fichiers `.tf` | Infrastructure-as-code |
| **Kong** | `kong.yaml` (DB-less) | Config gateway déclarative |

## Décision

### Introduction de `stoa.yaml` — Spécification d'API Déclarative Inspirée de Kubernetes

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: customer-api
  tenant: acme
spec:
  source:
    type: openapi
    url: https://api.example.com/v1/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
  policies:
    rateLimit:
      requests: 1000
      window: 1m
    cors:
      origins: ["https://app.acme.com"]
      methods: ["GET", "POST"]
  deployment:
    strategy: rolling
    rollback: automatic
```

### Principes de Conception

1. **Source de vérité unique** — `stoa.yaml` vit dans le même dépôt git que le code backend de l'API
2. **Style Kubernetes** — Structure familière `apiVersion`, `kind`, `metadata`, `spec`
3. **Valeurs par défaut inspirées de Vercel** — Défauts sensibles zéro-config (rate limit = 1000/min, CORS = `["*"]`)
4. **Multi-point d'entrée** — Même spec consommée par CLI, interface Console, MCP Copilot
5. **Piloté par diff** — Les outils peuvent calculer ce qui a changé (comme `kubectl diff` ou `terraform plan`)
6. **Conscient de l'environnement** — Spec unique, surcharges spécifiques à l'environnement

### Structure du Schéma

#### Champs de Niveau Supérieur

```yaml
apiVersion: stoa/v1alpha1        # Contrat API versionné
kind: APIDeployment              # Type de ressource
metadata:                        # Identité + propriété
  name: string                   # Identifiant unique de l'API
  tenant: string                 # Namespace multi-tenant
  labels:                        # Tags clé-valeur optionnels
    team: payments
spec:                            # État désiré
  ...
```

#### `spec.source` — Définition de l'API

```yaml
spec:
  source:
    type: openapi | asyncapi | grpc | graphql
    url: https://...           # URL distante (préféré)
    file: ./openapi.yaml       # Fichier local (relatif à stoa.yaml)
    inline: |                  # YAML inline (pour les petites APIs)
      openapi: 3.0.0
      ...
```

Exactement un parmi `url`, `file` ou `inline` doit être fourni.

#### `spec.gateways` — Cibles de Déploiement

```yaml
spec:
  gateways:
    - name: stoa-edge           # Nom de l'instance gateway
      mode: edge-mcp            # Mode de déploiement (ADR-024)
      environment: production
    - name: kong-staging
      mode: proxy
      environment: staging
```

Défaut zéro-config : si omis, déploie sur le gateway `default` en mode `stoa-edge`.

#### `spec.policies` — Politiques de Trafic

```yaml
spec:
  policies:
    rateLimit:
      requests: 1000
      window: 1m
      scope: tenant | api | consumer
    cors:
      origins: ["https://app.acme.com"]
      methods: ["GET", "POST", "PUT", "DELETE"]
      credentials: true
    authentication:
      type: oauth2 | api-key | mtls
      issuer: https://auth.acme.com/realms/prod
      scopes: ["read:customers", "write:customers"]
```

Défauts zéro-config : pas de `rateLimit` = 1000 req/min, pas de `cors` = `origins: ["*"]`, pas d'`authentication` = `type: api-key`.

#### `spec.deployment` — Stratégie de Déploiement

```yaml
spec:
  deployment:
    strategy: rolling | blue-green | canary
    rollback: automatic | manual
    healthCheck:
      path: /health
      interval: 10s
    notifications:
      webhook: https://slack.com/webhook/...
      onFailure: true
```

#### Surcharges d'Environnement

```yaml
spec:
  policies:
    rateLimit:
      requests: 1000
      window: 1m
  environments:
    dev:
      policies:
        rateLimit:
          requests: 10000
    production:
      gateways:
        - name: stoa-prod-1
        - name: stoa-prod-2
      policies:
        rateLimit:
          requests: 100
```

Logique de fusion : `spec` de base + surcharges spécifiques à l'environnement (fusion profonde).

### Points d'Entrée — 3 Façons de Déployer

#### 1. CLI (`stoactl deploy`)

```bash
stoactl deploy                        # Déploiement dans l'environnement par défaut
stoactl deploy --env production       # Déploiement en production
stoactl deploy --dry-run              # Prévisualisation des changements
stoactl deploy --watch                # Streaming des logs de déploiement
```

#### 2. Interface Console (Générateur Formulaire vers YAML)

1. Remplir le formulaire de l'interface Console
2. La Console génère `stoa.yaml` à partir des inputs du formulaire
3. L'utilisateur télécharge `stoa.yaml` ou le commit directement dans git
4. Synchronisation bidirectionnelle : les modifications du formulaire mettent à jour le YAML, les modifications du YAML mettent à jour le formulaire

#### 3. MCP Copilot (Agent IA)

Les agents IA peuvent générer, valider, calculer le diff et déployer via des outils MCP :
- `generate_stoa_yaml` — paramètres vers YAML
- `validate_stoa_yaml` — résultat de validation
- `diff_deployment` — diff de l'état actuel
- `deploy_api` — exécution du déploiement

## Exemples

### Proxy REST API Minimal

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: weather-api
  tenant: acme
spec:
  source:
    url: https://api.weather.com/v3/openapi.json
```

Déploie sur le gateway par défaut avec rate limit par défaut (1000/min), CORS (`*`) et auth API key.

### Enregistrement d'Outil MCP

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: customer-lookup
  tenant: acme
  labels:
    mcp-enabled: "true"
spec:
  source:
    type: openapi
    url: https://crm.acme.com/api/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
  policies:
    rateLimit:
      requests: 500
      window: 1m
      scope: consumer
    authentication:
      type: oauth2
      issuer: https://auth.acme.com/realms/prod
      scopes: ["read:customers"]
  mcp:
    tools:
      - name: lookup_customer_by_email
        description: "Find customer record by email address"
        endpoint: /customers/search
        method: POST
        parameters:
          email:
            type: string
            required: true
```

### Déploiement Multi-Gateway

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: payment-api
  tenant: acme
spec:
  source:
    url: https://api.acme.com/payments/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
    - name: kong-legacy
      mode: proxy
    - name: webmethods-mainframe
      mode: sidecar
  policies:
    rateLimit:
      requests: 100
      window: 1m
    authentication:
      type: mtls
  deployment:
    strategy: blue-green
    rollback: automatic
    notifications:
      webhook: https://hooks.slack.com/services/XXX
      onFailure: true
```

## Phases d'Implémentation

### Phase 1 : Définition du Schéma + Validation (CAB-1352, 3 pts)

- JSON Schema pour `stoa.yaml`
- Modèle Pydantic Python (`APIDeploymentSpec`)
- Commande CLI : `stoactl validate stoa.yaml`

### Phase 2 : Point d'Entrée CLI (CAB-1358, 5 pts)

- Commande `stoactl deploy` avec les flags `--dry-run`, `--env`, `--watch`
- Expansion de variables d'environnement dans `stoa.yaml`

### Phase 3 : Aller-Retour Interface Console (CAB-1359, 8 pts)

- Boutons « Importer stoa.yaml » / « Exporter stoa.yaml » dans la Console
- Synchronisation bidirectionnelle : les modifications du formulaire mettent à jour le YAML, les modifications du YAML mettent à jour le formulaire

### Phase 4 : Outils MCP Copilot (CAB-1360, 5 pts)

- 4 outils MCP : generate, validate, diff, deploy

**Total : 21 points**

## Conséquences

### Positives

- **Natif GitOps** : la config d'API vit dans git aux côtés du code backend
- **Expérience développeur** : une commande unique (`stoactl deploy`) remplace l'interface multi-étapes
- **Sécurité multi-environnement** : les surcharges d'environnement préviennent la dérive de configuration
- **Déploiement assisté par IA** : le MCP Copilot peut proposer, valider et déployer
- **Workflows hybrides** : les développeurs utilisent CLI, les DevOps utilisent l'interface Console, les deux restent synchronisés

### Négatives

- **Courbe d'apprentissage** : les nouveaux utilisateurs doivent apprendre la syntaxe YAML (atténué par l'interface Console et le MCP Copilot)
- **Évolution du schéma** : les changements non rétrocompatibles nécessitent des scripts de migration (utiliser le versionnage `v1alpha1`)
- **Synchronisation aller-retour** : la synchronisation bidirectionnelle UI/YAML nécessite la préservation des commentaires et du formatage

### Risques

| Risque | Probabilité | Impact | Atténuation |
|------|------------|--------|------------|
| Les développeurs restent sur l'UI | Moyen | Moyen | Faire du CLI la valeur par défaut dans la doc |
| Le schéma devient une accumulation | Élevé | Élevé | Revue stricte pour les nouveaux champs |
| Les surcharges d'environnement trop complexes | Moyen | Moyen | Limiter à 2 niveaux de profondeur |

## Alternatives Considérées

### Format JSON
Rejeté : YAML est plus lisible pour la configuration, supporte les commentaires et s'aligne avec l'écosystème Kubernetes.

### HCL (HashiCorp Configuration Language)
Rejeté : Moins familier que YAML, disponibilité limitée de parseurs en Python/TypeScript.

### Fichiers Multiples (Style Pulumi)
Rejeté : Pas de source de vérité unique, plus de fichiers = plus de confusion pour les débutants.

### Pas de Format Déclaratif (REST API Uniquement)
Rejeté : Pas de workflow GitOps, pas de contrôle de version, pas de support AI Copilot.

## Références

- [Conventions API Kubernetes](https://kubernetes.io/docs/reference/using-api/api-concepts/)
- [Configuration Vercel](https://vercel.com/docs/projects/project-configuration)
- [Configuration Déclarative Kong](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
- STOA Interne : CAB-374, CAB-1353 (PR #570), ADR-007, ADR-024
