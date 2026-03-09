---
sidebar_position: 5
title: FAQ
description: "Questions fréquemment posées sur la Plateforme STOA — architecture, MCP gateway, sécurité, abonnements, environnements, déploiement et support."
keywords: [FAQ, questions, STOA, MCP, API gateway, open source, subscriptions, RBAC]
---

# Questions Fréquemment Posées

## Général

### Qu'est-ce que STOA ?

STOA est une plateforme enterprise de gestion des APIs qui unifie les APIs REST et les outils MCP sous une couche de gouvernance unique. Conçue spécifiquement pour les environnements cloud-native, GitOps-first et prête pour l'IA.

### Pourquoi le nom "STOA" ?

STOA (Stoa) fait référence au portique couvert de la Grèce antique où les philosophes stoïciens enseignaient. Notre plateforme incarne les principes stoïciens :

- **Logos** — Raison & Ordre : Spécification UAC, GitOps
- **Apatheia** — Maîtrise : Stabilité, Observabilité
- **Oikeiosis** — Cohérence : Multi-tenancy, Alignement par domaine
- **Ataraxia** — Sérénité : Copilote IA, Rythme soutenable

### STOA est-il open source ?

Oui ! STOA est publié sous licence **Apache 2.0**. La plateforme core est entièrement open source. Nous proposons un support commercial optionnel et des fonctionnalités enterprise via STOA Cloud.

### Qu'est-ce qui distingue STOA des autres gateways API ?

La fonctionnalité clé de STOA est **UAC (Universal API Contract)** — "Définir une fois, Exposer partout". Vous définissez votre contrat API une seule fois, et STOA l'expose simultanément en REST, MCP et sur plusieurs gateways. Aucune autre plateforme ne connecte nativement les APIs legacy aux agents IA.

---

## MCP Gateway

### Pourquoi ne pas utiliser Claude/OpenAI directement ?

Vous devriez ! Les fournisseurs IA gèrent la consommation de tokens pour le raisonnement et la génération — c'est leur valeur core.

Le MCP Gateway STOA se place **entre** l'IA et vos services backend (outils). Il gouverne :
- **Quels outils** l'IA peut appeler
- **Qui** peut les utiliser
- **Le suivi de l'utilisation** pour la facturation et la conformité

Consultez [Positionnement du MCP Gateway](/docs/concepts/mcp-gateway-positioning) pour les détails.

### STOA re-facture-t-il les tokens des fournisseurs IA ?

**Non.** STOA mesure les **invocations d'outils**, pas les tokens. Ce sont des choses différentes :

| Fournisseur | Ce Qu'il Facture |
|-------------|-----------------|
| Anthropic/OpenAI | Tokens consommés |
| STOA | Invocations d'outils (optionnel) |

Votre facture fournisseur IA est indépendante de tout suivi d'utilisation STOA.

### Est-ce que je paye deux fois ?

Non. Vous payez :
1. **Fournisseur IA** : Pour les tokens (raisonnement, génération)
2. **STOA** (optionnel) : Pour la gouvernance des outils, le portail, les analytiques

Ce sont des propositions de valeur distinctes. De nombreuses organisations utilisent STOA même avec des LLMs gratuits/auto-hébergés car la valeur de gouvernance est indépendante du fournisseur IA.

### Quelle version du protocole MCP STOA supporte-t-il ?

STOA supporte MCP `2025-03-26` (la plus récente) et `2024-11-05` (rétrocompatible). Le gateway négocie la version la plus haute mutuellement supportée lors du handshake d'initialisation. Consultez [Démarrage avec MCP](/docs/guides/mcp-getting-started) pour un tutoriel.

### Quel transport le MCP gateway utilise-t-il ?

**Server-Sent Events (SSE)** sur HTTP, conformément à la spécification MCP. STOA fournit également des endpoints REST pour les intégrations plus simples ne nécessitant pas de streaming. Consultez [API MCP Gateway](/docs/api/mcp-gateway) pour la référence complète.

---

## Architecture

### Quelle est la différence entre le Control Plane et le Data Plane ?

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Control Plane** | Python + FastAPI | Configuration, gestion des APIs, Console |
| **STOA Gateway** | Rust + Tokio + axum | Protocole MCP, routage des requêtes, rate limiting |
| **Gateways Externes** | Kong, Gravitee, webMethods | Proxying d'APIs legacy (pattern Adapter) |

Le Control Plane gère les tâches administratives. Le Data Plane (gateways) traite le trafic réel.

### Quels gateways STOA supporte-t-il ?

STOA utilise le **pattern Adapter** pour orchestrer plusieurs gateways API :

| Gateway | Mode | Statut |
|---------|------|--------|
| **STOA Gateway** (Rust) | Primaire, edge-mcp | Production |
| **Kong** (DB-less) | Adapter | Production |
| **Gravitee** (APIM v4) | Adapter | Production |
| **webMethods** (Software AG) | Adapter | Production |

Tous les adapters implémentent la même interface à 16 méthodes. Vous pouvez faire tourner plusieurs gateways simultanément.

### Puis-je utiliser STOA sans Kubernetes ?

Oui. Bien que STOA soit natif Kubernetes, vous pouvez l'exécuter :
- **Docker Compose** : Pour le développement/test ([Quick Start](/docs/guides/quickstart))
- **Containers standalone** : Pour les déploiements edge
- **Kubernetes** : Recommandé pour la production

---

## Abonnements & Clés API

### Comment fonctionnent les abonnements API ?

Les abonnements connectent un consommateur à une API via un plan. Le cycle de vie est : **En attente** → **Actif** → (Suspendu/Révoqué/Expiré). Consultez [Cycle de Vie des Abonnements](/docs/guides/subscriptions-lifecycle) pour le guide complet.

### À quoi ressemble une clé API ?

Les clés API utilisent un format préfixé pour une identification facile :

```
stoa_sk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
└──────┘ └──────────────────────────────────┘
 préfixe   32 caractères hexadécimaux (128 bits d'entropie)
```

Les abonnements aux outils MCP utilisent le préfixe `stoa_mcp_` au lieu de `stoa_sk_`.

### Puis-je faire une rotation des clés API sans interruption ?

Oui. STOA supporte la **rotation de clés sans interruption** avec une période de grâce configurable (1-168 heures). Pendant la période de grâce, les deux clés (ancienne et nouvelle) sont valides. Consultez [Rotation des Clés API](/docs/guides/api-key-rotation).

### Que se passe-t-il quand je dépasse mon quota ?

Le gateway retourne `429 Too Many Requests` avec un header `Retry-After` et des headers `X-RateLimit-*` indiquant votre quota restant. Consultez [Application des Quotas](/docs/reference/quotas).

### Quelle est la différence entre un consommateur et un abonné ?

Un **consommateur** est un partenaire/application externe enregistré dans STOA avec des identifiants OAuth2. Un **abonné** est un utilisateur qui crée des abonnements. Un consommateur peut avoir plusieurs abonnements. Consultez [Onboarding des Consommateurs](/docs/guides/consumer-onboarding).

---

## Environnements

### Quels environnements STOA supporte-t-il ?

Trois environnements par défaut : **Développement** (accès complet), **Staging** (accès complet) et **Production** (lecture seule). Consultez [Gestion des Environnements](/docs/guides/environment-management).

### Pourquoi la production est-elle en lecture seule ?

La production utilise le mode lecture seule pour éviter les modifications accidentelles. Toutes les modifications doivent passer par le pipeline de promotion (dev → staging → prod). Les administrateurs de plateforme (`cpi-admin`) peuvent désactiver cette restriction pour les correctifs d'urgence.

### Comment changer d'environnement ?

Dans la Console UI, utilisez le sélecteur d'environnement dans l'en-tête. Via l'API, ajoutez `?environment=staging` à vos requêtes. L'environnement sélectionné délimite toutes les données et applique les modes d'accès.

---

## Sécurité

### Comment les clés API sont-elles protégées ?

Les clés API sont :
1. Stockées sous forme de **hachages SHA-256** — la clé originale ne peut pas être récupérée
2. La clé complète est affichée une seule **fois** à la création
3. Supportent la **rotation avec période de grâce** pour les mises à jour sans interruption
4. Jamais enregistrées en clair dans les logs
5. Mises en cache au niveau du gateway pendant 5 minutes (invalidées lors de la rotation)

### STOA supporte-t-il le SSO ?

Oui. STOA s'intègre avec **Keycloak** pour l'authentification OIDC/SAML. Vous pouvez connecter votre fournisseur d'identité existant (Okta, Azure AD, Google Workspace, etc.).

### Quels rôles RBAC sont disponibles ?

Quatre rôles : `cpi-admin` (toute la plateforme), `tenant-admin` (périmètre tenant), `devops` (déploiement/promotion), `viewer` (lecture seule). Consultez [Permissions RBAC](/docs/reference/rbac-permissions) pour la matrice complète des permissions.

### STOA supporte-t-il le mTLS ?

Oui. Les consommateurs peuvent s'authentifier via des certificats mutual TLS (mTLS) avec support pour la rotation des certificats et les périodes de grâce. Consultez [Onboarding des Consommateurs](/docs/guides/consumer-onboarding).

### Qu'en est-il de la journalisation d'audit ?

Chaque action est enregistrée :
- Invocations d'outils (qui, quoi, quand, paramètres)
- Modifications de configuration
- Événements d'authentification
- Décisions de politique

Les logs sont stockés dans OpenSearch et peuvent être exportés vers votre SIEM.

---

## Déploiement

### Quelles sont les exigences d'infrastructure ?

**Minimum (développement) :**
- 2 cœurs CPU, 4 Go RAM, 20 Go de stockage

**Recommandé (production) :**
- 4+ cœurs CPU, 8 Go+ RAM, 50 Go+ SSD, Kubernetes 1.28+

Consultez [Exigences Matérielles](/docs/reference/hardware-requirements) pour un dimensionnement détaillé.

### Quels fournisseurs cloud sont supportés ?

STOA fonctionne sur n'importe quel cloud ou sur site :
- **OVH** (déploiement de production de référence)
- **Hetzner** (déploiement de staging de référence)
- **AWS**, **GCP**, **Azure**
- **Sur site** (VMware, bare metal)

### STOA utilise-t-il GitOps ?

Oui. STOA utilise ArgoCD pour une gestion de configuration déclarative et auditable avec auto-sync et auto-correction. Consultez [GitOps avec ArgoCD](/docs/concepts/gitops).

### Comment démarrer ?

Consultez notre [Guide de Démarrage Rapide](/docs/guides/quickstart) pour une configuration en 5 minutes.

---

## Support

### Où obtenir de l'aide ?

- **Documentation** : Vous y êtes !
- **GitHub Issues** : [stoa-platform/stoa](https://github.com/stoa-platform/stoa)
- **Discord** : [Rejoindre la communauté](https://discord.gostoa.dev)
- **Support Enterprise** : contact@gostoa.dev

### Comment signaler une vulnérabilité de sécurité ?

Envoyez un email à **security@gostoa.dev** avec les détails. N'ouvrez pas d'issues publiques pour les vulnérabilités de sécurité.

### Puis-je contribuer ?

Absolument ! Consultez notre [Guide de Contribution](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md).
