---
slug: api-keys-in-git-history
title: "Clés API dans l'historique Git : comment trouver et corriger les secrets exposés"
authors: [christophe]
tags: [security, education, tutorial]
description: "90% des fuites de secrets proviennent de commits git. Détectez les clés API exposées, supprimez-les de l'historique, et prévenez les fuites futures avec des hooks pre-commit."
keywords: [api key security, git secrets, gitleaks, secret scanning, api key leak, git history secrets, developer security, credential rotation, secret management]
---
<!-- last verified: 2026-02 -->

# Vos clés API sont dans votre historique Git (et comment y remédier)

**Les clés API supprimées restent dans l'historique git pour toujours.** Cet article vous montre comment détecter les secrets exposés avec gitleaks, les supprimer de l'historique, et prévenir les fuites futures avec des hooks pre-commit et une gestion correcte des secrets.

Vous avez supprimé la clé API codée en dur de votre code. Vous avez commité la correction. Vous avez poussé. Vous êtes en sécurité maintenant, n'est-ce pas ?

**Non.** La clé est toujours dans votre historique git. N'importe qui avec `git log -p` peut la trouver en quelques secondes.

Ce n'est pas un risque théorique. GitHub scanne plus de 100 millions de commits par jour et trouve **des milliers de secrets valides** — clés API, mots de passe de bases de données, credentials cloud. La plupart d'entre eux ont été "supprimés" par des développeurs qui pensaient que supprimer la ligne était suffisant.

C'est l'une des failles de sécurité les plus critiques dans le développement API moderne — et l'une des raisons pour lesquelles nous avons construit [STOA en tant qu'API gateway open source](/blog/open-source-api-gateway-2026) avec la gestion des secrets comme fonctionnalité par défaut, pas comme add-on.

<!-- truncate -->

## L'ampleur du problème

Soyons concrets sur ce qui se passe quand un secret est exposé :

- **Les clés AWS exposées** sont exploitées en **4 minutes** en moyenne (source : GitGuardian State of Secrets Sprawl 2025)
- **Les clés de wallets cryptomonnaies** trouvées dans des repos git sont vidées en **quelques secondes** par des bots automatisés
- **Les credentials de bases de données** conduisent à des violations de données qui coûtent en moyenne **4,45 M$** par incident (IBM Cost of a Data Breach 2024)

Et la source la plus courante ? Pas des attaques sophistiquées. Juste des **développeurs qui ont commité un secret et pensaient l'avoir supprimé**.

## Comment les secrets se retrouvent dans Git

Voici les cinq façons les plus courantes dont cela arrive :

### 1. Le fichier `.env` qui a été commité

```bash
# Oups — commité avant que .gitignore n'existe
DATABASE_URL=postgresql://admin:s3cur3p@ss@db.example.com:5432/production
STRIPE_SECRET_KEY=sk_live_4eC39HqLyjWDarjtT1zdp7dc
```

Même si vous ajoutez `.env` à `.gitignore` plus tard, la version commitée **reste dans l'historique git pour toujours**.

### 2. Le codage en dur du "test rapide"

```python
# "Je l'enlèverai avant de commiter" — narrateur : il ne l'a pas fait
client = boto3.client('s3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)
```

### 3. Le fichier de configuration template

```yaml
# config.yaml — "c'est juste un template"
database:
  host: prod-db.internal.company.com
  password: r3alPr0dP@ssword!
```

### 4. Le commit de débogage

```javascript
// TODO: supprimer avant la fusion
console.log('Token:', process.env.ADMIN_TOKEN);
// Valeur de token réelle dans .env qui a été commité en même temps
```

### 5. L'override Docker Compose

```yaml
# docker-compose.override.yml — "c'est seulement local"
services:
  api:
    environment:
      - JWT_SECRET=my-super-secret-jwt-key-that-should-never-be-here
```

## Comment détecter les secrets exposés

### Étape 1 : Scanner votre historique Git

[Gitleaks](https://github.com/gitleaks/gitleaks) est l'outil standard. Il scanne tout votre historique git, pas seulement les fichiers actuels :

```bash
# Installation
brew install gitleaks  # macOS
# ou
docker pull ghcr.io/gitleaks/gitleaks:latest

# Scanner tout l'historique de votre repo
gitleaks detect --source . --verbose

# Scanner uniquement les modifications en staging (pre-commit)
gitleaks protect --staged
```

**Ce qu'il trouve :**

```
Finding:     STRIPE_SECRET_KEY=sk_live_4eC39HqLyjWDarjtT1zdp7dc
Secret:      sk_live_4eC39HqLyjWDarjtT1zdp7dc
RuleID:      stripe-api-key
Entropy:     4.56
File:        config/.env
Commit:      a1b2c3d4e5f6
Author:      dev@example.com
Date:        2026-01-15T10:30:00Z
```

### Étape 2 : Vérifier le Secret Scanning de GitHub

Si votre repo est sur GitHub, vous avez déjà un scanning de secrets basique. Allez dans **Settings > Code security and analysis > Secret scanning**. GitHub détecte des patterns de plus de 200 fournisseurs de services et peut révoquer automatiquement certains tokens.

### Étape 3 : Scanner vos images Docker

Les secrets intégrés dans les images Docker sont tout aussi dangereux :

```bash
# Scanner une image Docker pour les secrets
trivy image --scanners secret your-image:latest
```

## Comment supprimer les secrets de l'historique Git

**Important :** Supprimer un secret de l'historique ne l'annule pas. Si le repo a jamais été public, ou si quelqu'un l'a cloné, **faites pivoter le secret immédiatement**. Traitez-le comme compromis.

### Option 1 : `git filter-repo` (recommandé)

```bash
# Installation
pip install git-filter-repo

# Supprimer un fichier spécifique de tout l'historique
git filter-repo --invert-paths --path config/.env

# Supprimer une chaîne spécifique de tous les fichiers dans l'historique
git filter-repo --replace-text <(echo 'sk_live_4eC39HqLyjWDarjtT1zdp7dc==>REDACTED')
```

### Option 2 : BFG Repo Cleaner

```bash
# Supprimer tous les fichiers nommés .env de l'historique
java -jar bfg.jar --delete-files .env

# Remplacer des chaînes spécifiques
java -jar bfg.jar --replace-text passwords.txt
```

Après l'une ou l'autre option :

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

## Comment l'empêcher de se reproduire

Voici une checklist pratique — pas d'outils enterprise nécessaires, tout gratuit :

### 1. Hook pre-commit avec Gitleaks

Ajouter à `.pre-commit-config.yaml` :

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
```

Chaque `git commit` scanne maintenant les fichiers en staging pour les secrets **avant** qu'ils n'entrent dans l'historique.

### 2. Un `.gitignore` correct dès le premier jour

```gitignore
# Secrets — ne jamais commiter
.env
.env.*
*.pem
*.key
*credentials*
*.tfvars
*.tfstate

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store
Thumbs.db
```

### 3. Variables d'environnement, pas des fichiers

```bash
# Mauvais : codé en dur dans le code
API_KEY = "sk_live_abc123"

# Bien : variable d'environnement
API_KEY = os.environ["API_KEY"]

# Mieux : référence à un secret manager
API_KEY = vault.read("secret/api/stripe")
```

### 4. Git Config : ignore global

```bash
# Créer un gitignore global pour TOUS vos repos
echo ".env" >> ~/.gitignore_global
echo "*.pem" >> ~/.gitignore_global
echo "*.key" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

### 5. Secret scanning en CI/CD

Ajouter à votre workflow GitHub Actions :

```yaml
- name: Scan for secrets
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Ce que STOA fait différemment

Chaque technique ci-dessus nécessite que **vous** la configuriez, la mainteniez, et espériez que votre équipe suive les règles. C'est le problème fondamental : la sécurité qui dépend de la discipline humaine ne scale pas.

STOA Platform gère la gestion des secrets comme une **fonctionnalité intégrée, zéro configuration** — même dans le tier gratuit open source :

- **Pas de clés API dans le code** — STOA utilise des tokens à courte durée de vie avec rotation automatique. Pas de clés statiques à exposer.
- **mTLS par défaut** — Les services s'authentifient avec des certificats, pas des mots de passe. Pas de secrets partagés.
- **Audit trail** — Chaque appel API est journalisé avec l'identité de l'appelant, pas juste une clé anonyme. Quand quelque chose va mal, vous savez *qui*, pas juste *quoi*.
- **Policy-as-code** — Le contrôle d'accès est défini dans des politiques versionnées (OPA), pas dispersé à travers des variables d'environnement.
- **Injection de secrets au runtime** — Les credentials passent de votre secret manager aux pods au démarrage, sans jamais toucher git.

La différence : avec les approches traditionnelles, la sécurité est quelque chose que vous **ajoutez**. Avec STOA, la sécurité est quelque chose que vous **ne pouvez pas accidentellement supprimer**.

## Démarrage rapide : sécurisez votre projet existant aujourd'hui

Même sans STOA, faites ces trois choses maintenant :

```bash
# 1. Installer gitleaks
brew install gitleaks

# 2. Scanner votre repo
cd your-project && gitleaks detect --source . --verbose

# 3. Configurer le hook pre-commit
gitleaks protect --install
```

Si gitleaks trouve quelque chose : **faites pivoter le secret immédiatement**, puis nettoyez l'historique.

Si vous voulez aller plus loin — rotation automatique, mTLS, audit trails, policy-as-code — [essayez STOA](/docs/guides/quickstart). C'est gratuit, open source, et prend 5 minutes à configurer.

## FAQ

### Puis-je utiliser gitleaks sur des repositories privés ?

Oui. Gitleaks s'exécute localement — il scanne votre historique git local sans envoyer quoi que ce soit à des serveurs externes. Il fonctionne sur n'importe quel repository, privé ou public.

### Que faire si j'ai déjà poussé un secret dans un repo public ?

**Faites pivoter le secret immédiatement.** Assumez qu'il est compromis. Ensuite nettoyez l'historique avec `git filter-repo` et faites un force push. Le secret scanning de GitHub peut l'avoir déjà signalé — vérifiez l'onglet Security de votre repository.

### Est-ce que STOA élimine entièrement le besoin de clés API ?

Pour la communication service-à-service, oui — STOA utilise des [certificats mTLS](https://docs.gostoa.dev/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) au lieu de clés statiques. Pour les consommateurs externes, STOA émet des tokens OAuth à courte durée de vie qui expirent automatiquement. L'objectif est zéro secret statique dans votre codebase.

### Comment cela se relie-t-il à l'OWASP API Security Top 10 ?

Les secrets exposés correspondent à OWASP API8:2023 — Security Misconfiguration. Notre [Checklist de sécurité API](/blog/api-security-checklist-solo-dev) couvre les 10 risques OWASP API avec des corrections pratiques.

---

**Connexes** : [Guide API Gateway Open Source](/blog/open-source-api-gateway-2026) | [Checklist de sécurité API](/blog/api-security-checklist-solo-dev) | [Démarrage rapide](/docs/guides/quickstart)

*Vous avez trouvé cet article utile ? Donnez-nous une étoile sur [GitHub](https://github.com/stoa-platform/stoa) et rejoignez la conversation sur [Discord](https://discord.gostoa.dev).*
