---
sidebar_position: 1
title: "Gouvernance STOA : Standards de Qualité & Processus"
description: Gouvernance de la Plateforme STOA, standards de qualité et processus de prise de décision — boucle de revue d'implémentation, ADRs, revue du Council et contributions transparentes
keywords: [governance, standards, quality, decisions, community]
---

# Gouvernance STOA

Cette section documente le modèle de gouvernance, les standards de qualité et les processus de prise de décision de la Plateforme STOA.

## Pourquoi la Gouvernance Importe

STOA vise à être la **Passerelle Agent Européenne** — une plateforme de gestion des APIs souveraine et de qualité enterprise. Cela nécessite :

- **Qualité constante** dans toutes les contributions
- **Sécurité d'abord** dans chaque décision
- **Processus transparents** pour la communauté
- **Responsabilité claire** pour les mainteneurs

## Standards Fondamentaux

### Boucle de Revue d'Implémentation

La [Boucle de Revue d'Implémentation](/docs/governance/review-loop) (Standard Marchemalo) garantit que chaque modification de code significative passe une validation rigoureuse avant d'atteindre la production.

**Principes clés :**
- Revue multi-persona (Architecture, Sécurité, Métier)
- Amélioration itérative jusqu'à un score de 9/10 ou plus
- Itérations limitées dans le temps avec des chemins d'escalade clairs
- Capitalisation des patterns et des décisions

### Architecture Decision Records (ADRs)

Toutes les décisions architecturales significatives sont documentées dans des [ADRs](/docs/architecture/adr/adr-001-api-exposure-strategy). Ceux-ci fournissent :

- Contexte et énoncé du problème
- Options considérées
- Décision et justification
- Conséquences et compromis

Plus de 40 ADRs ont été publiés, couvrant des sujets allant de la stratégie d'exposition des APIs (ADR-001) aux opérateurs de réconciliation GitOps (ADR-042).

### Bibliothèque de Patterns

Les patterns d'implémentation validés sont collectés et documentés dans toute la codebase :

- **Pattern Adapter Gateway** — interface abstraite pour l'orchestration multi-gateway ([Configuration Multi-Gateway](/docs/guides/multi-gateway-setup))
- **UAC (Universal API Contract)** — définir une fois, exposer partout ([Concept UAC](/docs/concepts/uac))
- **Ship/Show/Ask** — catégorisation des PRs pour les fusions autonomes ou avec revue
- **Stratégie Micro-PR** — petites PRs d'inspiration Stripe (moins de 300 LOC) pour la reviewabilité

## Le Council

La qualité de STOA est maintenue par un "Council" de personas de revue :

| Persona | Focus | Quand Activé |
|---------|-------|--------------|
| **Archi 50x50** | Architecture, patterns, maintenabilité | Toujours |
| **Team Coca** | Sécurité (crypto, injection, secrets, accès) | Modifications liées à la sécurité |
| **OSS Killer** | Valeur métier, périmètre, over-engineering | Nouvelles fonctionnalités, périmètre flou |
| **Better Call Saul** | Légal, IP, conformité | Questions IP/licensing/données |

## Workflow de Contribution

```
1. Ouvrir une Issue/Ticket
       ↓
2. Plan d'Implémentation (si significatif)
       ↓
3. Revue du Council (itérative)
       ↓
4. Implémentation
       ↓
5. Revue de PR
       ↓
6. Merge + Déploiement
       ↓
7. Capitalisation (ADR/Pattern si nouveau)
```

## Guide de Contribution

### Démarrage

1. Forker le dépôt sur GitHub
2. Créer une branche de fonctionnalité : `git checkout -b feat/votre-fonctionnalite`
3. Suivre les [conventions de commit](/docs/reference/changelog) : `type(scope): description`
4. Exécuter le quality gate du composant avant de pousser (voir ci-dessous)
5. Ouvrir une Pull Request contre `main`

### Quality Gates par Composant

| Composant | Commande Pré-Push |
|-----------|------------------|
| Python (API) | `ruff check . && black --check . && pytest tests/ -q` |
| TypeScript (UI, Portal) | `npm run lint && npm run format:check && npm test -- --run` |
| Rust (Gateway) | `cargo fmt --check && cargo clippy -- -D warnings && cargo test` |

### Exigences de PR

- Commits signés (vérification DCO appliquée)
- CI verte (3 vérifications requises : Licence, SBOM, Commits Signés)
- CI spécifique au composant qui passe
- Moins de 300 LOC modifiées (décomposer les changements plus importants en PRs empilées)

## Code de Conduite

La Plateforme STOA suit le [Contributor Covenant](https://www.contributor-covenant.org/) Code de Conduite (v2.1).

**Notre engagement** : Nous nous engageons à fournir une communauté accueillante et inspirante pour tous, quelle que soit leur origine ou identité.

**Périmètre** : Ce Code de Conduite s'applique dans tous les espaces communautaires — issues GitHub, pull requests, discussions et tout autre canal de communication lié à STOA.

**Application** : Les cas de comportement abusif, harcelant ou autrement inacceptable peuvent être signalés aux mainteneurs du projet à `conduct@gostoa.dev`. Toutes les plaintes seront examinées et traitées rapidement et équitablement.

## Modèle de Gouvernance Actuel

STOA est actuellement en phase **BDFL (Benevolent Dictator For Life)** pendant le développement initial.

**BDFL :** Christophe ABOULICAM ([@caboulicam](https://github.com/caboulicam))

À mesure que la communauté grandit, la gouvernance évoluera vers un modèle distribué avec :
- Comité Directeur Technique
- Groupes de Travail
- Vote communautaire sur les décisions majeures

## Documents Associés

- [Boucle de Revue d'Implémentation](/docs/governance/review-loop) — Processus de validation qualité
- [ADRs](/docs/architecture/adr/adr-001-api-exposure-strategy) — Architecture Decision Records
- [Communauté](/docs/community) — Ressources communautaires
- [FAQ](/docs/community/faq) — Questions fréquemment posées
