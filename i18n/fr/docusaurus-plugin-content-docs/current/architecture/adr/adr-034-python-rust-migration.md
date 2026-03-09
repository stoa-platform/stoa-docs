---
sidebar_position: 34
title: "ADR-034 : Stratégie de Migration Python vers Rust"
description: "Décide de la stratégie de migration par phases du MCP Gateway Python vers le STOA Gateway basé sur Rust pour des améliorations de performance et de sécurité."
keywords: [Python, Rust, migration, gateway, performance, sécurité, Tokio]
---

import MigrationArchitecture from '@site/src/components/MigrationArchitecture';

# ADR-034 : Stratégie de Migration Python vers Rust

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | N/A (Stratégique) |
| **Associé** | ADR-024 (Modes Unifiés du Gateway) |

## Contexte

Le MCP Gateway est actuellement implémenté en Python (FastAPI). Bien que Python excelle dans le développement rapide, Rust offre :

- **Performance** — Latence plus faible, débit plus élevé
- **Sécurité mémoire** — Pas de pauses GC, performances prévisibles
- **OPA natif** — Bibliothèque regorus pour l'évaluation de politique embarquée
- **Binaire unique** — Déploiement simplifié

### Le Problème

> « Comment migrer de Python vers Rust sans perturber la production ? »

## Décision

Implémenter une **migration par phases** avec validation shadow, ciblant le T4 2026 pour un déploiement Rust complet.

### Phases de Migration

<MigrationArchitecture />

### Détails des Phases

| Phase | Calendrier | Périmètre | Validation |
|-------|-----------|-----------|------------|
| **1** | T1 2026 | Python en production | Métriques de référence |
| **2** | T2 2026 | Mode Rust edge-mcp | Mirror shadow |
| **3** | T3 2026 | Rust proxy + sidecar | Déploiement canary |
| **4** | T4 2026 | Mode Rust shadow | Migration complète |

## Validation Shadow Mirror

Durant la Phase 2, les deux implémentations s'exécutent en parallèle :

*Voir l'onglet interactif **Shadow Validation** ci-dessus pour le flux de requêtes complet et les métriques de comparaison.*

## Checklist de Parité Fonctionnelle

| Fonctionnalité | Python | Rust | Statut |
|---------------|--------|------|--------|
| Transport MCP SSE | ✅ | 🔄 | En cours |
| Registre d'outils | ✅ | 📋 | Planifié |
| Évaluation de politique OPA | ✅ (sidecar) | ✅ (regorus) | Terminé |
| Cache sémantique | ✅ | 📋 | Planifié |
| Snapshots d'erreurs | ✅ | 📋 | Planifié |
| Watcher CRD K8s | ✅ | 📋 | Planifié |
| OpenTelemetry | ✅ | 🔄 | API en cours de stabilisation |
| JWT Keycloak | ✅ | 📋 | Planifié |

## Structure d'Implémentation Rust

```
stoa-gateway/
├── src/
│   ├── main.rs                 # Entry point, --mode flag
│   ├── modes/
│   │   ├── mod.rs              # Mode trait
│   │   ├── edge_mcp.rs         # MCP protocol
│   │   ├── sidecar.rs          # Behind existing gateway
│   │   ├── proxy.rs            # Inline enforcement
│   │   └── shadow.rs           # Traffic observation
│   ├── auth/
│   │   └── oidc.rs             # Keycloak JWT validation
│   ├── policy/
│   │   └── opa.rs              # regorus integration
│   └── observability/
│       └── metrics.rs          # Prometheus
├── Cargo.toml
└── Dockerfile
```

## Plan de Rollback

En cas de problème avec l'implémentation Rust :

1. **Immédiat** — Router 100% vers Python via le load balancer
2. **Investigation** — Comparer les logs shadow
3. **Correction** — Patcher Rust, redéployer en shadow
4. **Validation** — 48h de validation shadow
5. **Reprise** — Transfert progressif du trafic

## Objectifs de Performance

| Métrique | Python | Objectif Rust | Amélioration |
|----------|--------|---------------|--------------|
| Latence P50 | 15ms | 5ms | 3x |
| Latence P99 | 80ms | 20ms | 4x |
| RPS par pod | 1000 | 5000 | 5x |
| Mémoire | 512 Mo | 64 Mo | 8x |
| Démarrage à froid | 3s | 100ms | 30x |

## Conséquences

### Positives

- **Performance** — Réduction significative de la latence
- **Coût** — Moins de pods nécessaires pour le même débit
- **Fiabilité** — Sécurité mémoire, pas de pauses GC
- **OPA natif** — regorus élimine le sidecar

### Négatives

- **Vélocité de développement** — Rust plus lent à écrire
- **Double maintenance** — Deux codebases pendant la migration
- **Compétences équipe** — Courbe d'apprentissage Rust

### Atténuations

| Défi | Atténuation |
|------|-------------|
| Vélocité | Python pour les expériences, Rust pour les fonctionnalités stables |
| Double maintenance | Gel des fonctionnalités Python après la Phase 2 |
| Compétences | Formation Rust interne, code reviews |

## Références

- [stoa-gateway/](https://github.com/stoa-platform/stoa/tree/main/stoa-gateway/)
- [ADR-024 — Architecture Gateway Unifiée](./adr-024-gateway-unified-modes.md)
- [regorus — Moteur OPA en Rust](https://github.com/microsoft/regorus)
