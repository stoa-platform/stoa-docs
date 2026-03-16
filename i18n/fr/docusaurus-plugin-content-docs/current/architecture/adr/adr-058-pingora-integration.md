---
title: "ADR-058 : Intégration Pingora — Pool de Connexions Embarqué"
description: "Décide d'embarquer le connecteur Pingora (pool de connexions partagé de Cloudflare) directement dans stoa-gateway derrière un feature flag, sans migration complète vers le serveur Pingora ni ajout d'un sidecar."
keywords: [pingora, rust, connexions, pool, axum, reqwest, tokio, cloudflare, proxy, performance]
---

# ADR-058 : Intégration Pingora — Pool de Connexions Embarqué

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-16 |
| **Décideurs** | Christophe Aboulicam |
| **Liens** | ADR-024 (Modes Gateway), CAB-1847, CAB-1849 |

## Contexte

[Pingora](https://github.com/cloudflare/pingora) de Cloudflare (Rust, Apache 2.0) a remplacé nginx et traite plus de 1 000 milliards de requêtes par jour. STOA Gateway est construit sur axum + reqwest + tokio. La question : comment STOA doit-elle tirer parti de Pingora ?

## Pourquoi Pingora

### L'Argument Commercial (facteur décisif)

| Signal | axum seul | Avec Pingora |
|--------|-----------|--------------|
| Argumentaire enterprise | « Gateway Rust custom » | **« Construit sur Pingora — le framework proxy de Cloudflare »** |
| Positionnement concurrentiel | Même niveau que les proxies custom | **Même niveau que Cloudflare Workers, Fastly Compute** |
| Case CISO | Stack inconnue | **Battle-tested à 1T+ req/jour** |
| Crédibilité open source | Framework générique | **Pedigree infrastructure-grade** |
| Unicité marché | Aucune | **Seule API gateway construite sur Pingora** |

Aucun éditeur d'API gateway — Kong, Gravitee, Envoy, agentgateway — n'utilise Pingora. Il s'agit d'un avantage de premier entrant en termes de positionnement.

### L'Argument Technique

| Fonctionnalité | reqwest (actuel) | Pingora Connector |
|----------------|------------------|-------------------|
| Pool de connexions | Par instance client | **Partagé entre tous les workers** (avantage clé de Cloudflare) |
| Multiplexage H2 | Par connexion | **Multiplexage de flux global** |
| Réutilisation du pool à l'échelle | Se dégrade au-delà de 10K RPS | **Conçu pour 1T+ req/jour** |
| Proxy zero-copy | Non (copie userspace) | Kernel splice/sendfile (futur) |

En dessous de 1K RPS, la différence est de 0,5 ms p95. Au-delà de 50K RPS, le pooling partagé évite l'épuisement des connexions que les pools par client atteignent.

## Options Évaluées

| Option | Description | Effort | Verdict |
|--------|-------------|--------|---------|
| A : Migration complète | Remplacer axum par le serveur Pingora | 55+ pts | Rejeté — réécrit 400+ routes |
| B : Sidecar | Pingora front-proxy → stoa-gateway | 21 pts | Rejeté — saut supplémentaire, valeur faible |
| **C : Embarqué** | **Connecteur Pingora intégré dans stoa-gateway** | **13 pts** | **Accepté** |
| D : Patterns uniquement | Copier les patterns Pingora sans utiliser le crate | 0 pts | Supplanté par C |

### Pourquoi l'Option Embarquée (Option C) a Été Retenue

- **Un seul binaire** — pas de sidecar, pas de saut supplémentaire, pas de complexité de déploiement
- **Même argument marketing** — « Construit sur Pingora » est tout aussi vrai pour un connecteur embarqué
- **Valeur réelle** — le pool partagé de Pingora est l'avantage Cloudflare concret, pas le serveur
- **Feature-gated** — `--features pingora` l'active ; le build par défaut conserve reqwest (sans dépendance cmake)
- **Incrémental** — le chemin proxy migre vers PingoraPool progressivement ; MCP/admin/auth restent sur axum sans modification

## Décision

**Embarquer `pingora-core::connectors::http::Connector` dans stoa-gateway derrière un feature flag `pingora`.**

### Architecture

```
Client → stoa-gateway (:8080)
              │
              ├─ MCP / admin / auth / OAuth → axum handlers (unchanged)
              │
              └─ Proxy routes → PingoraPool.send_request()
                                    │
                                    └─ pingora-core shared connection pool
                                         → Backend (H1/H2, TLS, keepalive)
```

Un seul binaire. Un seul port. Un seul déploiement. Pingora gère les connexions upstream ; axum gère le routage HTTP.

### Implémentation

| PR | Contenu |
|----|---------|
| [#1799](https://github.com/stoa-platform/stoa/pull/1799) | Binaire standalone `stoa-pingora/` (POC sidecar — supplanté) |
| [#1801](https://github.com/stoa-platform/stoa/pull/1801) | `PingoraPool` embarqué dans stoa-gateway (chemin de production) |
| [#1803](https://github.com/stoa-platform/stoa/pull/1803) | CI/CD : `FEATURES=kafka,pingora` dans le build Docker |

### Compatibilité des Phases

Notre trait `ProxyPhase` est mappé 1:1 avec `ProxyHttp` de Pingora :

| STOA ProxyPhase | Pingora ProxyHttp | Statut |
|-----------------|-------------------|--------|
| `request_filter` | `request_filter` | Correspondance |
| `upstream_select` | `upstream_peer` | Correspondance |
| `upstream_request_filter` | `upstream_request_filter` | Correspondance |
| `response_filter` | `upstream_response_filter` | Correspondance |
| `logging` | `logging` | Correspondance |
| `error_handler` | `error_while_proxy` | Correspondance |

Si une migration complète vers Pingora s'avère nécessaire à la v2.0, les implémentations de phases sont portables directement.

## Ce que STOA Possède que Pingora n'a Pas

| Capacité | STOA | Pingora |
|----------|------|---------|
| Analyse HTTP eBPF au niveau kernel | Programmes XDP + TC | Non intégré |
| Enforcement des politiques UAC au niveau kernel | BPF maps synchronisées depuis la gateway | Non intégré |
| Runtime de plugins WASM | Intégration wasmtime | Non intégré |
| Protocole MCP (gateway pour agents IA) | SSE/WS/JSON-RPC complet | Non applicable |
| Fédération multi-gateway | 7 types d'adaptateurs | Non applicable |

STOA utilise Pingora pour ce qu'il fait de mieux (pooling de connexions) et y ajoute des couches que Pingora n'offre pas.

## Conséquences

- L'image de production est construite avec `FEATURES=kafka,pingora` (cmake requis dans Docker)
- `PingoraPool` est disponible pour le chemin proxy ; reqwest demeure en solution de repli
- Le build par défaut (sans features) fonctionne toujours sans dépendance cmake
- Marketing : **« STOA Gateway — propulsé par le moteur de connexions Pingora »**
- Le fichier NOTICE inclut l'attribution Apache 2.0 de Pingora
- Réévaluer une migration complète à la v2.0 ou au-delà de 50K RPS
