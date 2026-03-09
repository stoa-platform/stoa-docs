---
sidebar_position: 10
title: Statut d'Implémentation
description: "Suivez l'état d'implémentation actuel de la plateforme STOA sur tous les composants — Control Plane, Gateway, Portal, Console et infrastructure associée."
keywords: [STOA, implementation, status, roadmap, architecture, components, Rust gateway, MCP]
---

# Statut d'Implémentation

Suivez l'état actuel de chaque composant de la plateforme STOA. Cette page est mise à jour à chaque version.

:::info Dernière Mise à Jour
Février 2026 — Cycle 7 terminé, Rust gateway en production.
:::

## Composants Principaux

| Composant | Technologie | Statut | Description |
|-----------|------------|--------|-------------|
| Control Plane API | Python 3.11, FastAPI, SQLAlchemy | **Production** | Catalogue d'APIs, gestion des tenants, abonnements, orchestration du gateway |
| STOA Gateway | Rust, Tokio, axum | **Production** | Gateway haute performance avec MCP, proxy REST, rate limiting, mTLS |
| Console UI | React 18, TypeScript, Keycloak-js | **Production** | Tableau de bord admin pour la gestion des APIs, l'observabilité et les opérations multi-tenant |
| Developer Portal | React, Vite, TypeScript | **Production** | Découverte d'APIs en self-service, documentation et gestion des abonnements |
| Couche d'Auth | Keycloak 25 | **Production** | OIDC/OAuth2, fédération LDAP, isolation multi-realm par tenant |
| CLI | Python, Typer, Rich | **Bêta** | Interface en ligne de commande pour la gestion des APIs et des tenants |

## Capacités du Gateway

Le STOA Gateway (Rust) est le composant principal du plan de données, remplaçant l'ancien MCP Gateway Python (archivé en février 2026).

| Capacité | Statut | Détails |
|----------|--------|---------|
| Protocole MCP (mode edge-mcp) | **Production** | Découverte d'outils, invocation, streaming SSE |
| Proxy REST | **Production** | Routage dynamique vers l'amont avec vérifications de santé |
| Rate Limiting | **Production** | Quotas par consommateur avec fenêtre glissante |
| Circuit Breaker | **Production** | Par upstream avec seuils configurables |
| mTLS | **Production** | Tokens liés au certificat (RFC 8705) |
| Authentification OIDC | **Production** | Validation JWT Keycloak |
| En-têtes de Sécurité | **Production** | En-têtes recommandés OWASP, liste de blocage SSRF |
| Mode Sidecar | **Planifié (Q2 2026)** | Fonctionner aux côtés de gateways existants (Kong, Envoy, etc.) |
| Mode Proxy | **Planifié (Q3 2026)** | Proxy transparent pour les backends legacy |
| Mode Shadow | **Planifié** | Miroir de trafic pour la validation |

## Adaptateurs de Gateway

STOA prend en charge l'orchestration de plusieurs vendors de gateway via le [Patron Adaptateur de Gateway](/docs/architecture/adr/adr-035-gateway-adapter-pattern) :

| Adaptateur | Statut | Notes |
|------------|--------|-------|
| STOA (natif) | **Production** | Intégration complète |
| webMethods | **Production** | Réconciliation via REST Admin API |
| Kong (DB-less) | **Production** | Sync de config déclarative |
| Gravitee (APIM v4) | **Production** | Gestion API + plans |
| AWS API Gateway | **Planifié** | — |
| Azure APIM | **Planifié** | — |

## Infrastructure

| Composant | Technologie | Statut |
|-----------|------------|--------|
| Base de données | PostgreSQL (managé) | **Production** |
| Observabilité | Prometheus + Grafana | **Production** |
| Gestion des logs | OpenSearch 2.11 | **Production** |
| Secrets | HashiCorp Vault | **Partiel** (K8s Secrets utilisés sur Hetzner/OVH) |
| GitOps | ArgoCD | **Production** (staging Hetzner) |
| CI/CD | GitHub Actions | **Production** |
| Registre de conteneurs | GHCR | **Production** |
| DNS/TLS | Cloudflare + Let's Encrypt | **Production** |

## Environnements de Déploiement

| Environnement | Infrastructure | Statut |
|---------------|---------------|--------|
| Production | OVH MKS (GRA9, 3x B2-15) | **Actif** — 9 pods, 22/22 tests smoke |
| Staging | Hetzner K3s (5x cx33, nbg1) | **Actif** — 9 services HTTPS |
| Dev local | Docker Compose | **Actif** — Stack complète avec fédération |

## Couverture de Tests

| Composant | Tests Unitaires | Intégration | E2E | Total |
|-----------|----------------|-------------|-----|-------|
| STOA Gateway (Rust) | 559 tests cargo | 30 intégration | 15 E2E | **604** |
| Console UI | 415 vitest | — | — | **415** |
| Developer Portal | 427 vitest | — | — | **427** |
| Control Plane API | ~200 pytest | — | — | **~200** |

## Feuille de Route

Consultez la [Feuille de Route](/docs/roadmap) complète pour les fonctionnalités à venir et les priorités.

### Court Terme (Q1-Q2 2026)

- Mode sidecar du gateway pour la coexistence avec les gateways existants
- Born GitOps — workflows d'approbation appartenant aux tenants (ADR-040)
- Disponibilité générale de l'outil CLI
- Provider Terraform

### Moyen Terme (Q3-Q4 2026)

- Modes proxy et shadow du gateway
- Système de plugins WebAssembly
- Support du déploiement edge
- SDK (Python, TypeScript)

---

*Pour les décisions architecturales détaillées, consultez l'[index des ADRs](/docs/architecture/adr/).*
