---
slug: gitops-in-10-minutes
title: "GitOps en 10 minutes : l'infrastructure comme dépôt Git"
authors: [christophe]
tags: [education, tutorial, architecture]
description: "Ne vous connectez plus jamais en SSH à un serveur. GitOps expliqué pour les développeurs qui n'ont jamais touché à l'infrastructure. Ce que c'est, pourquoi c'est important, comment démarrer."
keywords: [gitops tutorial, gitops beginner, infrastructure as code, argocd, kubernetes gitops, config as code, git infrastructure, devops for developers, gitops explained]
---

# GitOps en 10 minutes : pourquoi votre infrastructure devrait être un dépôt Git

**GitOps signifie que votre infrastructure est définie dans Git et automatiquement déployée depuis celui-ci.** Ce guide explique ce qu'est GitOps, pourquoi c'est important pour les développeurs solo et les petites équipes, et comment démarrer — du versionnement des fichiers de configuration à l'automatisation complète avec ArgoCD.

Vous savez faire un `git push` sur votre code. Mais qu'en est-il de votre infrastructure ?

Votre configuration Nginx, vos règles de pare-feu, vos credentials de base de données, vos manifestes Kubernetes — où vivent-ils ? Si la réponse implique SSH, une page Wiki partagée, ou "demandez à Jean-Michel, c'est lui qui l'a configuré" — vous avez un problème.

**GitOps** signifie traiter l'infrastructure de la même façon que le code : versionné, révisé, auditable, et automatiquement déployé depuis un dépôt Git. Plus de SSH. Plus de "ça marche sur ma machine". Plus de configurations mystérieuses.

GitOps est un principe fondamental de la [gestion d'API open source](/blog/open-source-api-gateway-2026) — et l'une des raisons pour lesquelles STOA a été [conçu GitOps-first](https://docs.gostoa.dev/docs/concepts/gitops) dès le premier jour.

<!-- truncate -->

## Le problème : la dérive de configuration

Voici un scénario que tout développeur a vécu :

1. Vous déployez votre application en production. Elle fonctionne.
2. Trois mois plus tard, quelqu'un se connecte en SSH pour "corriger un truc".
3. Une autre personne modifie directement une configuration Nginx.
4. Une troisième change une variable d'environnement via la console cloud.
5. Six mois plus tard, **personne ne sait quelle est la configuration réelle de la production**.

C'est la **dérive de configuration** — l'écart entre ce que vous *pensez* être déployé et ce qui *tourne réellement*. C'est le tueur silencieux de la fiabilité.

```
Ce que vous croyez déployé :      Ce qui tourne réellement :
┌─────────────────────┐           ┌─────────────────────┐
│ nginx.conf (v3)     │           │ nginx.conf (v3.1?)  │  ← édition SSH manuelle
│ API_KEY=abc123      │           │ API_KEY=xyz789       │  ← changement console cloud
│ replicas: 2         │           │ replicas: 3          │  ← kubectl scale
│ TLS: Let's Encrypt  │           │ TLS: expiré !        │  ← cert non renouvelé
└─────────────────────┘           └─────────────────────┘
       Votre dépôt git                  Le serveur réel
```

## Ce qu'est réellement GitOps

GitOps est une idée simple : **Git est la source de vérité unique pour votre infrastructure**.

```
Développeur → git push → Dépôt Git → (synchronisation auto) → Infrastructure
                              ↑                                    ↓
                        "Ce qui devrait               "Ce qui tourne
                          tourner"                     réellement"
                                         ↕
                               Continuellement réconcilié
```

**Trois principes fondamentaux :**

1. **Déclaratif** — vous décrivez l'*état désiré* ("je veux 2 réplicas, TLS activé, rate limit 100/min"), pas les étapes pour y parvenir.
2. **Versionné** — chaque changement passe par Git : commit, révision, merge. Piste d'audit complète.
3. **Automatisé** — un outil (ArgoCD, Flux, etc.) compare continuellement Git avec la réalité et corrige toute dérive.

## L'ancienne façon vs. GitOps

| | L'ancienne façon | GitOps |
|---|---|---|
| **Déploiement** | SSH + commandes manuelles | `git push` → déploiement auto |
| **Rollback** | "Est-ce que quelqu'un se souvient de ce qu'on a changé ?" | `git revert` → rollback auto |
| **Audit** | Consulter les logs du serveur (s'ils existent) | `git log` — qui, quand, quoi, pourquoi |
| **Reproduction** | Impossible — la config est sur le serveur | Cloner le dépôt, appliquer — environnement identique |
| **Révision** | "Au fait, je modifie les règles de pare-feu" (message Slack) | Pull request avec diff, révision, approbation |
| **Reprise après sinistre** | Reconstruire de mémoire + documentation (si à jour) | `git clone` + `apply` — opérationnel en minutes |

## Un exemple concret

Imaginons une API simple déployée sur Kubernetes. Voici à quoi ressemble un dépôt GitOps :

```
infra/
├── base/
│   ├── deployment.yaml      # Votre API : image, réplicas, health checks
│   ├── service.yaml         # Comment le trafic atteint votre API
│   ├── ingress.yaml         # Nom de domaine + TLS
│   └── configmap.yaml       # Configuration non sensible
├── overlays/
│   ├── staging/
│   │   └── kustomization.yaml  # Surcharges staging (1 réplica, logs debug)
│   └── production/
│       └── kustomization.yaml  # Surcharges prod (3 réplicas, logs minimaux)
└── secrets/
    └── sealed-secret.yaml   # Secrets chiffrés (sûrs à committer)
```

### Déployer un changement

Vous voulez passer la production à 5 réplicas ? Pas de SSH. Pas de `kubectl`. Juste une pull request :

```yaml
# overlays/production/kustomization.yaml
# Changer replicas: 3 → replicas: 5
patches:
  - target:
      kind: Deployment
      name: my-api
    patch: |
      - op: replace
        path: /spec/replicas
        value: 5
```

```bash
git add overlays/production/kustomization.yaml
git commit -m "scale(prod): increase API replicas to 5 for launch traffic"
git push origin main
```

ArgoCD détecte le changement, l'applique au cluster. Terminé. Piste d'audit complète dans git.

### Rollback d'un déploiement défaillant

Quelque chose a cassé ? Pas de panique :

```bash
git revert HEAD
git push origin main
# ArgoCD revient automatiquement à l'état précédent
```

Comparez avec l'ancienne façon : "Vite, connectez-vous en SSH sur la prod et rechangez le truc. Quelle était l'ancienne valeur ? Laissez-moi vérifier sur Slack..."

## Pourquoi les freelances et petites équipes ont besoin de GitOps

Vous pensez peut-être que GitOps est réservé aux grandes entreprises avec des équipes DevOps dédiées. **Faux.** C'est en réalité *encore plus* précieux pour les petites équipes et les développeurs solo, car :

### 1. Vous ne pouvez pas compter sur votre mémoire

Quand vous gérez 3 à 5 projets clients, vous ne vous souviendrez pas de ce que vous avez configuré il y a 6 mois. Git, lui, se souvient.

### 2. Les transferts de projet deviennent triviaux

"Voici le dépôt. Tout ce qui tourne en production est dans ce dossier. `git log` montre chaque changement." Plus de réunions de transfert de connaissances. Plus de runbooks déjà obsolètes.

### 3. La reprise après sinistre est gratuite

Le serveur meurt ? Disque dur corrompu ? Panne du fournisseur cloud ? Avec GitOps : clonez le dépôt, pointez vers un nouveau cluster, appliquez. Tout est opérationnel en minutes.

### 4. Vous pouvez prouver ce que vous avez fait

Le client demande "quand avez-vous changé la configuration SSL ?" Vous ne devinez pas — vous lui montrez le commit :

```
commit 8a3f2c1 (2026-01-15)
Author: You <you@example.com>
Date:   Wed Jan 15 14:30:00 2026

    fix(tls): renew SSL cert and switch to Let's Encrypt auto-renewal

    - Ancien : cert manuel de GoDaddy, expiré le 30 déc.
    - Nouveau : Let's Encrypt avec renouvellement auto via cert-manager
    - Testé en staging d'abord (commit 7b2e1d0)
```

## Pour commencer : Kubernetes n'est pas requis

Vous n'avez pas besoin de Kubernetes pour utiliser GitOps. Vous pouvez commencer avec n'importe quelle infrastructure :

### Niveau 1 : versionner vos fichiers de configuration

Mettez vos configurations Nginx, fichiers Docker Compose et templates de variables d'environnement (pas les valeurs !) dans Git :

```bash
mkdir infra && cd infra
git init

# Ajouter vos configurations
cp /etc/nginx/nginx.conf ./nginx/
cp ~/docker-compose.yml ./
cp .env.example ./  # Template uniquement — jamais le vrai .env !

git add . && git commit -m "chore: initial infrastructure config"
```

Désormais, chaque changement de configuration passe d'abord par Git : éditer, committer, puis appliquer.

### Niveau 2 : automatiser l'application

Utilisez un pipeline CI/CD simple pour appliquer les changements à chaque push :

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
    paths: ['infra/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Copy configs to server
        run: |
          scp -r infra/nginx/ server:/etc/nginx/
          ssh server "nginx -t && systemctl reload nginx"
```

Pas sophistiqué. Mais vous avez maintenant des configurations versionnées + déploiement automatisé + piste d'audit. C'est GitOps.

### Niveau 3 : GitOps complet avec ArgoCD

Quand vous êtes prêt pour Kubernetes (ou déjà dessus) :

```bash
# Installer ArgoCD (une seule fois)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Pointer ArgoCD vers votre dépôt Git
argocd app create my-api \
  --repo https://github.com/you/infra.git \
  --path overlays/production \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default \
  --sync-policy automated
```

ArgoCD surveille maintenant votre dépôt et applique automatiquement tout changement que vous poussez. Pousser un commit → le cluster se met à jour. Annuler un commit → le cluster effectue un rollback.

## Comment STOA adopte GitOps

STOA Platform a été conçu GitOps-first dès le premier jour (voir [ADR-007](https://docs.gostoa.dev/docs/architecture/adr/adr-007-argocd-gitops-deployment)) :

- **Toute configuration est déclarative** — les contrats d'API, les politiques, les règles de routage sont en YAML/JSON dans Git
- **Natif ArgoCD** — STOA est livré avec des manifestes ArgoCD et des charts Helm, synchronisation automatique activée
- **Pas de kubectl manuel** — les changements passent de `git push` via CI vers le cluster automatiquement
- **Détection de dérive** — si quelqu'un modifie manuellement quelque chose sur le cluster, ArgoCD le détecte et revient à l'état Git
- **Sealed secrets** — les credentials sont chiffrés dans Git avec sealed-secrets, déchiffrés uniquement dans le cluster

Résultat : toute votre configuration de gateway — routes, politiques, certificats TLS, rate limits, contrôle d'accès — vit dans Git. Auditable. Révisable. Reproductible.

Même le niveau gratuit fonctionne ainsi. Pas de "GitOps est une fonctionnalité premium".

## Le changement de mentalité

GitOps ne parle pas vraiment d'outils. C'est une question de mentalité :

> **Si ce n'est pas dans Git, ça n'existe pas.**

- Configuration serveur modifiée via SSH ? Elle sera écrasée lors de la prochaine synchronisation.
- Variable d'environnement changée dans la console ? Elle dérivera vers l'état Git.
- Migration de base de données exécutée manuellement ? Elle aurait dû être un script versionné.

Cela paraît restrictif au début. Ensuite, ça devient libérateur. Parce que quand tout est dans Git :
- Vous ne perdez jamais la configuration
- Vous savez toujours ce qui est déployé
- Vous pouvez reproduire n'importe quel environnement
- Vous pouvez prouver chaque changement

**Arrêtez de vous connecter en SSH sur les serveurs. Commencez à faire `git push` sur votre infrastructure.**

---

## Foire aux questions

### Ai-je besoin de Kubernetes pour GitOps ?

Non. GitOps est un pattern, pas une fonctionnalité Kubernetes. Vous pouvez versionner des configurations Nginx, des fichiers Docker Compose, ou même des scripts shell dans Git et les appliquer automatiquement avec CI/CD. Kubernetes + ArgoCD est la stack GitOps la plus populaire, mais les niveaux 1 et 2 de ce guide fonctionnent sans Kubernetes.

### Quelle est la différence entre GitOps et l'Infrastructure as Code (IaC) ?

L'IaC (Terraform, Pulumi) décrit l'infrastructure de façon déclarative. GitOps ajoute la **boucle de réconciliation** : un outil s'assure continuellement que l'état réel correspond à l'état Git. L'IaC c'est "définir et appliquer". GitOps c'est "définir, appliquer, et maintenir en synchronisation indéfiniment".

### Comment STOA utilise-t-il GitOps ?

STOA stocke les contrats d'API, les politiques de routage et les règles d'accès sous forme de YAML déclaratif. ArgoCD surveille le dépôt Git et applique les changements automatiquement — voir [ADR-007](https://docs.gostoa.dev/docs/architecture/adr/adr-007-gitops-argocd) pour l'architecture complète. Même la [gestion des secrets](/blog/api-keys-in-git-history) suit les patterns GitOps via sealed-secrets.

### GitOps est-il sécurisé ? Qu'en est-il des secrets dans Git ?

Ne stockez jamais de secrets en clair dans Git. Utilisez des secrets chiffrés (sealed-secrets, SOPS) ou des gestionnaires de secrets externes (Vault, Infisical). La clé de chiffrement vit en dehors de Git ; le blob chiffré est sûr à committer. Consultez notre [checklist de sécurité API](/blog/api-security-checklist-solo-dev) pour en savoir plus.

---

**À lire aussi** : [Guide des API gateways open source](/blog/open-source-api-gateway-2026) | [Checklist de sécurité API](/blog/api-security-checklist-solo-dev) | [Démarrage rapide](/docs/guides/quickstart)

*Vous souhaitez gérer vos APIs avec GitOps ? Le [démarrage rapide STOA](/docs/guides/quickstart) vous permet d'être opérationnel en 5 minutes. Rejoignez la communauté sur [Discord](https://discord.gostoa.dev).*
