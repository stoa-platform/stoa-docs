---
sidebar_position: 3
title: Récompenses pour Contributeurs
description: Comment STOA valorise et rémunère les contributions open source — partage de 45% des revenus, notation d'impact sur quatre dimensions et distributions trimestrielles
keywords: [contributor rewards, revenue sharing, compensation, open source, community]
---

# Programme de Récompenses pour Contributeurs

:::info Où Nous en Sommes Aujourd'hui
STOA est un projet open source en phase pré-revenus. Il n'y a pas encore d'argent à distribuer — et nous ne prétendrons pas le contraire.

Ce qui existe aujourd'hui : un **cadre** définissant comment les revenus seront partagés lorsqu'ils arriveront. Nous le publions maintenant afin que les contributeurs connaissent l'intention dès le premier jour, et non après coup.

**Pourquoi contribuer aujourd'hui ?** Parce que vous croyez en la gestion d'APIs open source, que vous voulez apprendre et que vous voulez façonner un projet tôt. Les récompenses financières viendront plus tard — la communauté, les compétences et l'impact commencent maintenant.
:::

L'engagement de STOA : lorsque des revenus enterprise existent, **45% reviennent à la communauté**. Cette page explique le cadre que nous avons conçu pour ce moment.

---

## Modèle de Distribution des Revenus

```
┌─────────────────────────────────────────────────────────────┐
│              Répartition des Revenus Enterprise STOA         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  Fondation   │  │  Mainteneurs │  │ Contributeurs│     │
│   │     10%      │  │     20%      │  │     15%      │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│   ┌─────────────────────────────────────────────────┐      │
│   │              Opérations                          │      │
│   │                    55%                           │      │
│   │  (Développement, Support, Infrastructure)        │      │
│   └─────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Répartition

| Fonds | % | Usage |
|-------|---|-------|
| **Fondation** | 10% | Infrastructure, événements, juridique, subventions |
| **Mainteneurs** | 20% | Rémunération des mainteneurs principaux |
| **Contributeurs** | 15% | Distribution trimestrielle basée sur les points |
| **Opérations** | 55% | Développement, support, infrastructure |

---

## Le Cadre de Valeur à Quatre Dimensions

Nous ne comptons pas simplement les lignes de code. Nous mesurons l'**impact** sur quatre dimensions :

| Dimension | Poids | Ce Qu'elle Mesure |
|-----------|-------|-------------------|
| **Technique** | 30% | Qualité, performance, sécurité |
| **Communauté** | 30% | Adoption, satisfaction, engagement |
| **Durabilité** | 25% | Maintenabilité, dette technique évitée |
| **Écosystème** | 15% | Intégrations, plugins, standards |

### Formule

```
Points = (Technique × 0,30) + (Communauté × 0,30) +
         (Durabilité × 0,25) + (Écosystème × 0,15)
```

---

## Système de Points

### Contributions Code

| Contribution | Points | Notes |
|--------------|--------|-------|
| PR fusionnée (fonctionnalité majeure) | 50 | Nouvelle capacité |
| PR fusionnée (fonctionnalité mineure) | 20 | Amélioration existante |
| PR fusionnée (correction de bug) | 10 | Correction |
| PR fusionnée (refactorisation) | 15 | Qualité du code |

### Documentation

| Contribution | Points | Notes |
|--------------|--------|-------|
| PR fusionnée (docs) | 10 | Guide, tutoriel |
| Traduction | 15 | i18n |

### Communauté

| Contribution | Points | Notes |
|--------------|--------|-------|
| Triage d'issue + reproduction | 5 | Validation de bug |
| RFC acceptée | 100 | Conception majeure |
| Aide communautaire (Discord/Forum) | 2 | Par réponse utile |
| Conférence/Meetup | 30 | Présentation externe |
| Article de blog | 30 | Contenu technique |

### Sécurité

| Contribution | Points | Notes |
|--------------|--------|-------|
| Correction de sécurité (critique) | 200 | CVE critique |
| Correction de sécurité (haute) | 100 | CVE haute |
| Correction de sécurité (moyenne) | 50 | CVE moyenne |
| Divulgation responsable | 50 | Rapport privé |

---

## Niveaux de Contribution (Anti-Contournement IA)

Toutes les contributions ne se valent pas à l'ère de l'IA :

| Niveau | Type | Points | Exemples |
|--------|------|--------|----------|
| **1** | Résistant à l'IA | ÉLEVÉ | RFC, mentorat, ADR, construction communautaire |
| **2** | Assisté par IA | MOYEN | Fonctionnalités complexes, bugs critiques |
| **3** | Facile avec IA | FAIBLE | Refactorisation, tests basiques, fautes de frappe |

---

## Formule de Distribution

```
Fonds_T = 15% × Revenus_Enterprise_T

Récompense(contributeur) = (Points_contributeur / Total_points_tous) × Fonds_T
```

### Exemple

```
Revenus Trimestriels = R
Fonds Contributeurs = 15% × R
Total points T = 2 000

Contributeur A : 500 points (25%)
→ Récompense = 25% × Fonds

Contributeur B : 200 points (10%)
→ Récompense = 10% × Fonds

Contributeur C : 100 points (5%)
→ Récompense = 5% × Fonds
```

---

## Cycle de Vie des Points

```
T+0          T+1-3j        T+7j          T+30j
│            │             │             │
▼            ▼             ▼             ▼
PR Créée → Revue Fusion → Staging →   Impact Prod
│            │             │             │
Points      Points        Points        Points
ESTIMÉS     AJUSTÉS       VALIDÉS       FINAUX
(auto)      (revue)       (métriques)   (vérifiés)
```

---

## Transparence

Tout est public :

- **Tableau de bord** : Suivi des points en temps réel par contributeur
- **Rapports Trimestriels** : Taille du fonds, distributions, bénéficiaires
- **Processus d'Appel** : Fenêtre de 7 jours pour contester toute décision

---

## Statut du Programme

| Phase | Statut | Description |
|-------|--------|-------------|
| **1. Conception du Cadre** | **Terminé** | Système de points, dimensions de valeur, modèle de distribution — documentés ici |
| **2. Construction Communautaire** | **En cours** | Développement de la base de contributeurs, établissement de la culture, suivi informel des contributions |
| **3. Génération de Revenus** | À venir | Clients enterprise, service géré, contrats de support |
| **4. Premières Distributions** | Futur | Versements trimestriels, rapports de transparence, tableau de bord public |

Nous sommes en **Phase 2**. Les contributions sont valorisées et suivies, mais il n'y a pas encore de distribution financière. Quand la Phase 3 génère des revenus, la Phase 4 s'active automatiquement — les contributeurs qui ont rejoint tôt bénéficieront de leurs contributions accumulées.

---

## Commencer Aujourd'hui

1. **Rejoindre Discord** — [discord.gostoa.dev](https://discord.gostoa.dev)
2. **Choisir une issue** — Cherchez les labels `good-first-issue`
3. **Soumettre une PR** — Suivez les directives de contribution
4. **Construire votre historique** — Chaque contribution est visible dans l'historique git

Les récompenses financières viendront. Mais l'apprentissage, la communauté et la valeur portfolio de contribuer à un projet open source ? Cela commence maintenant.

---

*Des questions ? Posez-les dans `#contributors` sur Discord ou par email à [contributors@gostoa.dev](mailto:contributors@gostoa.dev)*
