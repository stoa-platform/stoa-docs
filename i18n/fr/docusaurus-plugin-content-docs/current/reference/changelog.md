---
sidebar_position: 14
title: "Notes de Version"
description: "Notes de version de STOA Platform — historique des versions, nouvelles fonctionnalités, changements incompatibles et guides de migration pour chaque release."
keywords:
  - notes de version
  - changelog
  - releases
  - historique des versions
  - changements incompatibles
  - migration
---

# Notes de Version

Historique complet des versions de STOA Platform. Chaque version inclut les points saillants, les changements incompatibles et les instructions de mise à niveau.

:::tip Dernières versions
Releases par composant via Release Please. Dernière version publiée par composant, avec la date de la release la plus récente :

<!-- AUTOGEN:LATEST:START -->
`control-plane-api@1.14.1`, `control-plane-ui@1.12.0`, `portal@1.3.4`, `stoa-gateway@0.9.25`, `stoa-go@0.3.10` (2026-05-13)
<!-- AUTOGEN:LATEST:END -->
:::

:::info Changement de versionnement
Depuis avril 2026, STOA Platform utilise un **versionnement indépendant par composant** (Release Please) au lieu de releases monolithiques `vX.Y.Z`. Chaque composant (`control-plane-api`, `control-plane-ui`, `portal`, `stoa-gateway`, `stoa-go`) publie ses propres tags semver. La dernière release monolithique est la `v2.3.0`.
:::

---

<!-- AUTOGEN:RELEASES:START -->

## Releases par composant (2026-05)

| Composant | Version | Date | Release |
|-----------|---------|------|---------|
| control-plane-ui | v1.12.0 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.12.0) |
| control-plane-api | v1.14.1 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.14.1) |
| control-plane-ui | v1.11.0 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.11.0) |
| control-plane-ui | v1.10.0 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.10.0) |
| control-plane-api | v1.14.0 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.14.0) |
| stoa-gateway | v0.9.25 | 2026-05-13 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.25) |
| control-plane-ui | v1.9.0 | 2026-05-12 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.9.0) |
| control-plane-ui | v1.8.0 | 2026-05-11 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.8.0) |
| stoa-gateway | v0.9.24 | 2026-05-11 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.24) |
| control-plane-ui | v1.7.3 | 2026-05-07 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.7.3) |
| control-plane-ui | v1.7.2 | 2026-05-07 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.7.2) |
| control-plane-ui | v1.7.1 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.7.1) |
| stoa-go | v0.3.10 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-go-v0.3.10) |
| stoa-gateway | v0.9.23 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.23) |
| stoa-gateway | v0.9.22 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.22) |
| control-plane-api | v1.13.1 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.13.1) |
| control-plane-api | v1.13.0 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.13.0) |
| control-plane-ui | v1.7.0 | 2026-05-06 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.7.0) |
| control-plane-ui | v1.6.3 | 2026-05-05 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.6.3) |
| control-plane-api | v1.12.3 | 2026-05-05 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.12.3) |
| stoa-gateway | v0.9.21 | 2026-05-04 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.21) |
| control-plane-ui | v1.6.2 | 2026-05-04 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.6.2) |
| stoa-gateway | v0.9.20 | 2026-05-03 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.20) |
| control-plane-ui | v1.6.1 | 2026-05-03 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.6.1) |
| control-plane-api | v1.12.2 | 2026-05-03 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.12.2) |
| control-plane-api | v1.12.1 | 2026-05-02 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.12.1) |
| stoa-go | v0.3.9 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-go-v0.3.9) |
| control-plane-api | v1.12.0 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.12.0) |
| stoa-gateway | v0.9.19 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.19) |
| portal | v1.3.4 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/portal-v1.3.4) |
| control-plane-ui | v1.6.0 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.6.0) |
| portal | v1.3.3 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/portal-v1.3.3) |
| stoa-gateway | v0.9.18 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.18) |
| control-plane-ui | v1.5.8 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.5.8) |
| control-plane-api | v1.11.3 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.11.3) |
| control-plane-api | v1.11.2 | 2026-05-01 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.11.2) |

## Releases par composant (2026-04)

| Composant | Version | Date | Release |
|-----------|---------|------|---------|
| control-plane-api | v1.11.1 | 2026-04-29 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.11.1) |
| control-plane-api | v1.11.0 | 2026-04-27 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.11.0) |
| control-plane-api | v1.10.2 | 2026-04-27 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.10.2) |
| control-plane-api | v1.10.1 | 2026-04-26 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.10.1) |
| control-plane-ui | v1.5.7 | 2026-04-26 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.5.7) |
| control-plane-api | v1.10.0 | 2026-04-26 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.10.0) |
| control-plane-ui | v1.5.6 | 2026-04-26 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.5.6) |
| control-plane-api | v1.9.0 | 2026-04-26 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.9.0) |
| stoa-gateway | v0.9.17 | 2026-04-25 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.17) |
| control-plane-ui | v1.5.5 | 2026-04-25 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-ui-v1.5.5) |
| control-plane-api | v1.8.7 | 2026-04-25 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.7) |
| control-plane-api | v1.8.6 | 2026-04-25 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.6) |
| control-plane-api | v1.8.5 | 2026-04-24 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.5) |
| control-plane-api | v1.8.4 | 2026-04-24 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.4) |
| control-plane-api | v1.8.3 | 2026-04-24 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.3) |
| control-plane-api | v1.8.2 | 2026-04-24 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/control-plane-api-v1.8.2) |
| stoa-gateway | v0.9.16 | 2026-04-24 | [GitHub](https://github.com/stoa-platform/stoa/releases/tag/stoa-gateway-v0.9.16) |

<!-- AUTOGEN:RELEASES:END -->

---

## v2.3.0 (Mars 2026) {#v230}

**Moteur Pingora, Paramètres de Chat, Bootstrap Zéro-Config**

[Article complet de la release](/blog/release-v2.3.0)

### Points saillants

- **Moteur de connexion Pingora** — le framework proxy éprouvé de Cloudflare (1T+ req/jour) embarqué dans STOA Gateway derrière un feature flag `pingora`. Le pool de connexions partagé remplace les pools reqwest par client à grande échelle ([ADR-058](/docs/architecture/adr/adr-058-pingora-integration))
- **Paramètres de chat par tenant** — activation/désactivation indépendante du chat Console/Portal, budget quotidien de tokens, suivi par source via l'en-tête `X-Chat-Source`
- **Bootstrap Helm zéro-config** — un seul `helm install` provisionne le realm Keycloak, 4 rôles RBAC, 3 scopes client, 4 clients OIDC, l'utilisateur admin et le tenant par défaut
- **Gestion des secrets partagés** — clés internes auto-générées (gateway, chat, JWT) stables entre les mises à jour via `lookup` Helm
- **APIs de démo avec données réelles** — 5 APIs publiques (Exchange Rate, CoinGecko, OpenWeatherMap, NewsAPI, Alpha Vantage) + fallback echo pré-configurées dans le portal
- **Correction OAuth hairpin NAT** — le gateway utilise l'URL Keycloak interne pour le proxy DCR/token, corrigeant les erreurs 502 sur les clusters K8s avec problèmes de hairpin NAT

### Nouveaux endpoints

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/v1/chat/settings` | Lire la configuration chat du tenant |
| `PUT` | `/v1/chat/settings` | Mettre à jour les toggles et le budget chat |

### Nouvelles valeurs Helm

| Clé | Défaut | Description |
|-----|--------|-------------|
| `stoa.domain` | — | Domaine de base pour tous les services |
| `stoa.adminEmail` | — | Email de l'utilisateur admin (bootstrap) |
| `stoa.anthropicApiKey` | — | Clé API Anthropic (optionnelle, active le chat) |
| `stoa.bootstrap.enabled` | `false` | Activer le provisionnement initial de la plateforme |

### Changements incompatibles

Aucun. Tous les changements sont rétrocompatibles.

### PRs

#1806, #1807, #1808, #1809, #1810, #1811, #1812, #1813, #1814, #1816, #1817 (11 PRs)

---

## v2.2.0 (Mars 2026) {#v220}

**Proxy LLM, Inscription Self-Service, Système de Skills**

[Article complet de la release](/blog/release-v2.2.0)

### Points saillants

- **Proxy LLM** — routage multi-fournisseur (OpenAI, Azure OpenAI, Mistral) avec suivi de budget par tenant et circuit breakers
- **Inscription self-service** — flux de provisionnement de tenant de bout en bout avec limites d'essai
- **Protocole MCP 2025-11-25** — ressources, prompts, endpoints de complétion, découverte lazy
- **Renforcement OAuth 2.1** — binding DPoP proof-of-possession, gestion DCR RFC 7592
- **Système de skills** — CRUD natif gateway avec suivi de santé par circuit breaker
- **UAC (Universal API Contract)** — validateur JSON Schema v1.0, transformation inverse OpenAPI
- **Adaptateurs gateway** — AWS API Gateway + Azure APIM ajoutés ; Kong, Gravitee, Apigee améliorés
- **Masquage PII** — middleware + endpoints d'administration
- **Scanner de posture de sécurité** — évaluation de sécurité automatisée
- **12 nouveaux endpoints API** — facturation, contrats, gouvernance des données, provisionnement, PII, inscription
- **Gateway Arena** — benchmark d'aptitude AI entreprise à 20 dimensions
- **Assistant chat IA intégré** — widget flottant dans Console et Portal

### Changements incompatibles

Aucun. Tous rétrocompatibles.

---

## v2.0.0 (Février 2026) {#v200}

**Gateway Rust, Adaptateurs Multi-Gateway, GitOps**

### Points saillants

- **STOA Gateway (Rust)** — remplace le MCP Gateway Python comme gateway principal (Tokio + axum)
- **Pattern d'adaptateurs multi-gateway** — support Kong, Gravitee, webMethods
- **Gestion des environnements** — cycle de vie dev/staging/production
- **Gateway Arena** — laboratoire de benchmarking continu
- **Piste d'audit** — double écriture PostgreSQL + OpenSearch
- **GitOps ArgoCD** — déploiement déclaratif sur OVH + Hetzner
- **4 CRDs** — Tool, ToolSet, GatewayInstance, GatewayBinding
- **Support mTLS** — tokens liés aux certificats (RFC 8705)

### Changements incompatibles

- MCP Gateway Python déplacé vers `archive/mcp-gateway/`
- Endpoints API Gateway changés de `/mcp/*` vers `/v1/*`
- Groupe d'API CRD changé de `stoa.io` vers `gostoa.dev`
- Le mapper d'audience Keycloak doit inclure le nouveau gateway

### Migration

```bash
# Mettre à jour les CRDs
kubectl apply -f charts/stoa-platform/crds/

# Mettre à jour le mapper d'audience Keycloak pour inclure stoa-gateway
# Redéployer tous les composants avec le nouveau chart Helm
helm upgrade stoa-platform ./charts/stoa-platform -n stoa-system
```

---

## v0.1.0 (Février 2026) {#v010}

**Release Publique Initiale — MVP**

[Article complet de la release](/blog/release-v0.1.0)

Première release open-source publique de STOA Platform sous licence Apache 2.0.

### Points saillants

- **Control Plane API** — Python/FastAPI, architecture multi-tenant
- **MCP Gateway Python** — support MCP, politiques OPA, authentification par clé API
- **Console UI** — gestion des tenants, administration des utilisateurs, configuration des politiques
- **Developer Portal** — catalogue self-service, abonnements, tableaux de bord d'utilisation
- **SSO Keycloak** — intégration OIDC, fédération LDAP, multi-realm
- **Chart Helm** — déploiement Kubernetes complet
- **Suite de tests E2E** — Playwright + BDD (Gherkin)

### Changements incompatibles

N/A — release initiale.

---

## Politique de Versionnement

STOA Platform suit le [Versionnement Sémantique](https://semver.org/) :

| Segment | Incrémenté Quand | Exemple |
|---------|-----------------|---------|
| **Majeur** (X.0.0) | Changements d'API incompatibles | Endpoint supprimé, schéma modifié |
| **Mineur** (0.X.0) | Nouvelles fonctionnalités, rétrocompatibles | Nouvel endpoint, nouveau champ CRD |
| **Correctif** (0.0.X) | Corrections de bugs, patchs de sécurité | Correction de régression, mise à jour de dépendance |

## Politique de Dépréciation

| Étape | Calendrier | Action |
|-------|----------|--------|
| **Déprécié** | Annoncé dans les notes de version | La fonctionnalité fonctionne mais génère des avertissements |
| **Suppression planifiée** | Prochaine version majeure | Documentation mise à jour, guide de migration fourni |
| **Supprimé** | Release de version majeure | Fonctionnalité supprimée, changement incompatible documenté |

Les fonctionnalités dépréciées sont supportées pendant au moins un cycle de version majeure.

## Rester Informé

- **GitHub Releases** : [github.com/stoa-platform/stoa/releases](https://github.com/stoa-platform/stoa/releases)
- **Blog** : [docs.gostoa.dev/blog](https://docs.gostoa.dev/blog)
- **RSS** : Abonnez-vous au flux RSS du blog pour les annonces de releases
- **Roadmap** : [Roadmap actuelle](/docs/roadmap) pour les fonctionnalités planifiées

## Voir Aussi

- [Guide de Mise à Niveau](/docs/admin/upgrade) — Procédures de mise à niveau
- [Roadmap](/docs/roadmap) — Fonctionnalités planifiées
- Changelog de sécurité (`SECURITY-CHANGELOG.md` à la racine du dépôt) — Changements liés à la sécurité
- [ADRs](/docs/architecture/adr) — Décisions architecturales
