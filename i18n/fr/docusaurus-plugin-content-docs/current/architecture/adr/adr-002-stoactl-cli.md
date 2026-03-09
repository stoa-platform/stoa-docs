---
sidebar_position: 2
title: "ADR-002 : Conception du CLI stoactl"
description: "Architecture Decision Record pour l'outil CLI STOA natif GitOps, construit avec Go et Cobra, offrant une expérience de gestion API de type kubectl."
keywords: [stoactl, CLI, Go, Cobra, GitOps, kubectl, gestion API]
---

# ADR-001 : Conception du CLI stoactl

**Statut** : Proposé
**Date** : 2026-01-24
**Auteur** : Christophe ABOULICAM
**Référence** : CAB-899

## Contexte

STOA nécessite un CLI qui permet les workflows GitOps et l'intégration CI/CD. Les équipes DevOps s'attendent à une expérience déclarative de type kubectl pour les patterns infrastructure-as-code.

### Exigences

1. **Natif GitOps** : `stoactl apply -f` comme workflow principal
2. **UX familière** : automatismes kubectl/helm/terraform
3. **Compatible CI/CD** : Non-interactif, scriptable, codes de sortie
4. **Multi-contexte** : Basculer facilement entre environnements
5. **Idempotent** : Sûr à exécuter plusieurs fois

## Décision

Créer `stoactl` comme un CLI séparé et déclaratif suivant le **pattern kubectl**.

### Convention de nommage
```
stoactl <verbe> <ressource> [nom] [flags]
```

| Verbe | Description | Exemple |
|-------|-------------|---------|
| `get` | Lister/décrire les ressources | `stoactl get apis` |
| `apply` | Créer ou mettre à jour depuis un fichier | `stoactl apply -f api.yaml` |
| `delete` | Supprimer une ressource | `stoactl delete api billing-api` |
| `describe` | Vue détaillée | `stoactl describe api billing-api` |
| `logs` | Diffuser les logs | `stoactl logs api billing-api -f` |
| `config` | Gérer les contextes | `stoactl config use-context prod` |

### Ressources

| Ressource | Alias | Description |
|-----------|-------|-------------|
| `api` | `apis` | Définitions d'API |
| `subscription` | `sub`, `subs` | Souscriptions aux API |
| `apikey` | `key`, `keys` | Identifiants API |
| `tenant` | `tenants` | Configurations tenant |
| `contract` | `uac`, `contracts` | Contrats UAC |
| `policy` | `policies` | Rate limits, CORS, etc. |

### Définitions de ressources (YAML)

#### Définition d'API
```yaml
apiVersion: stoa.io/v1
kind: API
metadata:
  name: billing-api
  namespace: acme  # tenant
  labels:
    team: finance
spec:
  version: v2
  description: "Gestion des factures et paiements"
  upstream:
    url: https://billing.internal.acme.com
    timeout: 30s
    retries: 3
  routing:
    path: /billing
    stripPath: true
    methods: [GET, POST, PUT, DELETE]
  authentication:
    required: true
    providers:
      - type: apikey
        header: X-API-Key
      - type: jwt
        issuer: https://auth.<YOUR_DOMAIN>/realms/acme
  policies:
    rateLimit:
      requestsPerHour: 10000
    cors:
      origins: ["https://*.acme.com"]
    cache:
      enabled: true
      ttlSeconds: 300
  catalog:
    visibility: public
    categories: [Finance, Billing]
```

#### Définition de souscription
```yaml
apiVersion: stoa.io/v1
kind: Subscription
metadata:
  name: mobile-app-billing
  namespace: acme
spec:
  apiRef:
    name: billing-api
  plan: premium
  application:
    name: ACME Mobile App
    owner: mobile-team@acme.com
  quotas:
    requestsPerMonth: 1000000
```

### Fichier de configuration

Emplacement : `~/.stoa/config`
```yaml
apiVersion: stoa.io/v1
kind: Config
current-context: production

contexts:
  - name: production
    context:
      server: https://api.<YOUR_DOMAIN>
      tenant: acme

  - name: staging
    context:
      server: https://api.staging.gostoa.dev
      tenant: acme-staging

  - name: local
    context:
      server: http://localhost:8080
      tenant: dev
```

### Exemples de commandes
```bash
# Gestion du contexte
stoactl config set-context prod --server=https://api.<YOUR_DOMAIN> --tenant=acme
stoactl config use-context prod
stoactl auth login

# Opérations CRUD
stoactl get apis
stoactl get api billing-api -o yaml
stoactl apply -f api.yaml
stoactl apply -f api.yaml --dry-run
stoactl diff -f api.yaml
stoactl delete api billing-api

# Formats de sortie
stoactl get apis -o wide
stoactl get apis -o yaml
stoactl get apis -o json
```

### Codes de sortie

| Code | Signification |
|------|---------------|
| 0 | Succès |
| 1 | Erreur générale |
| 2 | Mauvaise utilisation (flags incorrects) |
| 3 | Authentification échouée |
| 4 | Ressource introuvable |
| 5 | Conflit |
| 6 | Erreur de validation |

## Implémentation

### Technologie : Go

- Distribution en binaire unique
- Bibliothèques CLI Cobra/Viper
- Compilation multiplateforme
- Familiarité avec l'écosystème kubectl/helm

### Distribution

| Canal | Commande | Statut |
|-------|----------|--------|
| Homebrew | `brew install stoa-platform/tap/stoactl` | Prévu T3 2026 |
| Binaire | GitHub Releases | Prévu T3 2026 |
| Docker | `docker run ghcr.io/stoa-platform/stoactl` | Prévu T3 2026 |

> Les canaux de distribution seront disponibles lorsque le CLI quittera la bêta privée. [Demandez l'accès](mailto:christophe@hlfh.io) pour participer.

## Conséquences

### Positives
- Les équipes DevOps disposent d'un workflow GitOps familier
- L'intégration CI/CD est triviale
- Les définitions de ressources sont auto-documentées
- Gestion multi-environnements intégrée

### Négatives
- Deux CLI à maintenir (`stoa` interactif + `stoactl` GitOps)
- Fatigue YAML pour les opérations simples

## Références

- [Conventions kubectl](https://kubernetes.io/docs/reference/kubectl/conventions/)
- [Framework CLI Cobra](https://cobra.dev/)
