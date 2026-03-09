---
sidebar_position: 2
title: Boucle de Revue d'Implémentation
description: Standard Marchemalo — validation qualité du code multi-persona avec portes de sécurité, revue d'architecture et amélioration itérative jusqu'à un score de 9+/10
keywords: [governance, review, quality, security, architecture]
---

# 🏛️ Standard Marchemalo — Boucle de Revue d'Implémentation

> **"Aucun code en production sans validation du Council à 9+/10"**

## Vue d'Ensemble

Chaque ticket d'implémentation **significatif** suit une boucle de validation itérative jusqu'à obtenir un score ≥9/10 de la part du Council.

### Qu'est-ce qui est "Significatif" ?

Un ticket est significatif s'il remplit **les deux** critères :
- ≥3 story points
- **ET** au moins un des éléments suivants :
  - 🔒 Lié à la sécurité
  - 💥 Changement cassant
  - 🆕 Nouveau pattern (pas encore dans la codebase)
  - 🏗️ Infrastructure critique

## La Boucle de Revue

```
                    ┌──────────────────────────────────────────────┐
                    │              MAX 3 ITÉRATIONS                │
                    │         (puis escalade/découpage)            │
                    ▼                                              │
┌─────────────────────────────────────┐                           │
│         ÉTAPE 1 : Analyse du Code   │                           │
│                                     │                           │
│  • Analyser la structure existante  │                           │
│  • Identifier les patterns à suivre │                           │
│  • Produire un PLAN d'implémentation│                           │
│  • Inclure le code proposé          │                           │
│                                     │                           │
│  ⏱️ Limite de temps : 2h max        │                           │
└──────────────────┬──────────────────┘                           │
                   │                                              │
                   ▼                                              │
┌─────────────────────────────────────┐                           │
│      ÉTAPE 2 : Revue du Council     │                           │
│                                     │                           │
│  JUGES (selon le contexte) :        │                           │
│  • Archi 50x50 (toujours)           │                           │
│  • Team Coca (si sécurité)          │                           │
│  • OSS Killer (si périmètre/métier) │                           │
│  • Better Call Saul (si IP/légal)   │                           │
│                                     │                           │
│  ⏱️ Limite de temps : 1h max        │                           │
└──────────────────┬──────────────────┘                           │
                   │                                              │
                   ▼                                              │
┌─────────────────────────────────────┐                           │
│      ÉTAPE 3 : Verdict              │                           │
│                                     │                           │
│  Score = MINIMUM de tous les juges  │                           │
│  (pas la moyenne — le plus strict)  │                           │
│                                     │                           │
│  Score < 9/10 + itération < 3 ?     │                           │
│      → Corrections → Retour ÉTAPE 1 │───────────────────────────┘
│                                     │         BOUCLE
│  Score < 9/10 + itération = 3 ?     │
│      → ESCALADE (voir ci-dessous)   │
│                                     │
│  Score ≥ 9/10 ?                     │
│      → ÉTAPE 4                      │
└──────────────────┬──────────────────┘
                   │
                   ▼ (Score ≥ 9/10 uniquement)
┌─────────────────────────────────────┐
│      ÉTAPE 4 : Implémentation       │
│                                     │
│  Score 10/10 :                      │
│    → Directement en prod, flag OFF  │
│                                     │
│  Score 9/10 :                       │
│    → Prod avec feature flag ON      │
│    → Monitoring renforcé 48h        │
│    → Revue post-déploiement         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│      ÉTAPE 5 : Capitalisation       │
│                                     │
│  Si nouveau pattern validé :        │
│    → Créer un ADR                   │
│    → Ajouter à la Bibliothèque      │
│                                     │
│  Toujours :                         │
│    → Journaliser dans l'historique  │
│    → Mettre à jour les métriques    │
└─────────────────────────────────────┘
```

## Fast-Track (Correctif de Sécurité)

Pour les **correctifs de sécurité critiques** uniquement :

| Critère | Valeur |
|---------|--------|
| Conditions | CVE active ou violation en cours, impact prod immédiat |
| Processus | Revue Team Coca UNIQUEMENT |
| Seuil | ≥8/10 suffisant |
| Limite de temps | 4h max total |
| Suivi | Revue complète dans les 48h post-déploiement |

## Arbitrage

### Désaccord entre Juges

**Règle : le score MINIMUM prévaut.**

```
Exemple :
  Archi 50x50 :  9/10
  Team Coca :    7/10
  OSS Killer :   9/10

  → Score final = 7/10 (Team Coca)
  → Corrections requises sur les points de Coca
```

### Blocage (>24h sans consensus)

1. Chaque juge présente ses arguments (5 min chacun)
2. Le BDFL prend la décision finale
3. Décision documentée dans un ADR
4. Sans appel possible

### Après 3 Itérations Sans ≥9/10

| Option | Description |
|--------|-------------|
| **DÉCOUPAGE** | Décomposer le ticket en parties plus petites |
| **REPORT** | Reporter au prochain cycle avec un nouveau périmètre |
| **BDFL** | Escalader pour une décision forcée (rare) |

## Échelle de Notation

| Score | Signification | Action | Déploiement |
|-------|--------------|--------|-------------|
| 10/10 | Parfait | ✅ Implémenter | Directement en prod |
| 9/10 | Excellent — risques mineurs identifiés | ✅ Implémenter | Prod + feature flag |
| 8/10 | Bon — problèmes à surveiller | ❌ Corrections | (Staging si fast-track) |
| 7/10 | Acceptable — problèmes significatifs | ❌ Corrections | — |
| \<7/10 | Insuffisant | ❌ Refonte majeure | — |

## Le Council

### Juges et Activation

| Juge | Activé si... | Focus |
|------|-------------|-------|
| **Archi 50x50** | TOUJOURS | Patterns, cohérence, maintenabilité |
| **Team Coca** | Tag `security` OU auth/crypto/saisie | Revue sécurité complète |
| **OSS Killer** | Nouvelle fonctionnalité OU périmètre flou | Valeur métier, over-engineering |
| **Better Call Saul** | Tag `legal` OU IP/licensing/données | Conformité, risques légaux |

### Composition Minimale

| Type de Ticket | Juges Requis |
|---------------|-------------|
| Fonctionnalité standard | Archi |
| Fonctionnalité + sécurité | Archi + Team Coca |
| Fonctionnalité + nouveau périmètre | Archi + OSS Killer |
| Correctif sécurité | Team Coca (fast-track possible) |
| Tout avec IP/données | Archi + Better Call Saul |

## Critères des Juges

### Archi 50x50 (40 ans d'XP)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| Patterns | 100% suit l'existant | 1 déviation justifiée | Incohérent |
| Cycle de vie | status + soft delete + audit | 1 mineur manquant | Lacunes majeures |
| Config | Pydantic Settings | Mix acceptable | os.getenv partout |
| Tests | Unitaires + Intégration + Cas limites | Unitaires + Intégration | Insuffisant |
| Docs | Docstrings + README | Docstrings | Rien |

### Team Coca (Red Team Sécurité)

Score = minimum de tous les 4 sous-juges.

#### Chucky (Crypto)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| Clé privée | Jamais stockée/journalisée | — | Toute violation |
| Entropie | Crypto sécurisée | — | random() |
| Extensions X.509 | Toutes présentes | — | Manquantes |

#### N3m0 (Injection)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| Validation des entrées | Regex + sanitisation | Sanitisation uniquement | Aucune |
| Tests d'injection | Paramétrés complets | Basiques | Aucun |

#### Gh0st (Secrets)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| Logs | Aucun secret | Avertissement si debug | Secret dans les logs |
| Erreurs | Messages génériques | — | Stack traces |

#### Pr1nc3ss (Contrôle d'Accès)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| RBAC | Complet + testé | Complet | Manquant |
| Isolation | 404 (pas 403) + testé | 404 | Divulgation d'info |
| Rate limit | Implémenté | TODO documenté | Absent |

### OSS Killer (VC Sceptique)

| Critère | 10/10 | 9/10 | \<9/10 |
|---------|-------|------|--------|
| Périmètre | Exactement le ticket | +1 nice-to-have | Dérive de périmètre |
| YAGNI | Aucun code "au cas où" | 1 abstraction future | Over-engineering |
| Valeur métier | Claire et mesurable | Claire | Vague |
| Tests E2E | Automatisés | Semi-auto | curl manuel |

## Template de Revue

```markdown
## Revue du Council — [TICKET-ID] [Titre]

**Itération :** X/3
**Date :** YYYY-MM-DD
**Juges Activés :** [Archi] [Coca] [OSS] [Saul]

### Scores

| Juge | Score | Bloquants | Commentaire |
|------|-------|-----------|-------------|
| Archi 50x50 | X/10 | 0 | ... |
| Team Coca | X/10 | X | ... |
| OSS Killer | X/10 | 0 | ... |

**Score Final : X/10** (minimum)

### Corrections P0 (Bloquantes pour 9+)

1. [ ] ...
2. [ ] ...

### Corrections P1 (Recommandées)

1. [ ] ...

### Verdict

- [ ] ✅ **APPROUVÉ 10/10** — Directement en prod
- [ ] ✅ **APPROUVÉ 9/10** — Prod + feature flag + monitoring 48h
- [ ] ❌ **REJETÉ** — Corrections requises (itération X/3)
- [ ] 🚨 **ESCALADE** — 3 itérations atteintes, décision BDFL requise

### Capitalisation

- [ ] Nouveau pattern → Créer un ADR
- [ ] Pattern existant validé → Réf : ADR-XXX
```

## Métriques à Suivre

| Métrique | Cible | Alerte si... |
|----------|-------|-------------|
| Durée moyenne de revue | \<1h | \>2h |
| Nombre moyen d'itérations | \<2 | \>2.5 |
| Taux d'approbation 1ère itération | \>30% | \<20% |
| Taux d'escalade BDFL | \<5% | \>10% |
| Overhead revue/code | \<30% | \>50% |

## Anti-Patterns

| ❌ Interdit | ✅ Alternative |
|------------|---------------|
| "Suffisant pour le MVP" | Simplifier le périmètre pour atteindre 9+ |
| "On corrigera en v2" | Corriger maintenant ou découper le ticket |
| "Pression de délai" | Fast-track si vraiment critique |
| "C'est juste interne" | Même standard partout |
| "Tests plus tard" | Tests dans le plan initial |
| "La revue = overhead" | La revue = investissement qualité |

## Matrice d'Applicabilité

| Type | Boucle de Revue ? | Juges |
|------|------------------|-------|
| Fonctionnalité ≥3pts + critère | ✅ OUI | Selon les tags |
| Fonctionnalité ≥3pts simple | ⚠️ Archi léger | Archi uniquement |
| Fonctionnalité \<3pts | ❌ Revue PR standard | — |
| Correctif sécurité | ✅ Fast-track | Team Coca |
| Correctif critique | ✅ Fast-track | Team Coca |
| Refactorisation majeure | ✅ OUI | Archi + OSS |
| Changement de config | ⚠️ Selon l'impact | Archi |
| Documentation/typo | ❌ NON | — |

## Emplacements de Stockage

| Quoi | Où |
|------|-----|
| Ce standard | `docs.gostoa.dev/governance/` |
| Template de revue | Linear (template de ticket) |
| Historique des revues | Notion (confidentiel, CIR) |
| Métriques | Tableau de bord Grafana |
| ADRs | `docs.gostoa.dev/adr/` |
| Bibliothèque de Patterns | `docs.gostoa.dev/patterns/` |

---

## Historique des Modifications

### v1.1 (2026-01-28)

- Seuil changé de 10/10 à 9/10 (pragmatique)
- Ajout de limites de temps : max 3 itérations
- Ajout de l'arbitrage : score minimum + escalade BDFL
- Ajout du fast-track pour les correctifs de sécurité
- Périmètre affiné : ≥3pts ET (sécurité OU cassant OU nouveau pattern)
- Ajout de la capitalisation : ADR + Bibliothèque de Patterns
- Ajout des métriques de suivi

### v1.0 (2026-01-28)

- Version initiale
- Revue par OSS Killer (7/10) et Archi 50x50 (8/10)
- N'a pas passé son propre test → v1.1 créée
