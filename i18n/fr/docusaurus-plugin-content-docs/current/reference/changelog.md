---
sidebar_position: 14
title: "Changelog"
description: "Historique des versions de STOA Platform — changelog, changements incompatibles, notes de migration et processus de release."
keywords:
  - changelog
  - releases
  - version history
  - breaking changes
  - migration
---

# Changelog

## Politique de Versionnement

STOA Platform suit le [Versionnement Sémantique](https://semver.org/) :

| Segment | Incrémenté Quand | Exemple |
|---------|-----------------|---------|
| **Majeur** (X.0.0) | Changements d'API incompatibles | Endpoint supprimé, schéma modifié |
| **Mineur** (0.X.0) | Nouvelles fonctionnalités, rétrocompatibles | Nouvel endpoint, nouveau champ CRD |
| **Correctif** (0.0.X) | Corrections de bugs, patchs de sécurité | Correction de régression, mise à jour de dépendance |

## Versions des Composants

Chaque composant est versionné indépendamment. Le chart Helm regroupe des versions compatibles :

| Composant | Version Actuelle | Compatibilité |
|-----------|---------|---------------|
| Control Plane API | 2.0.0 | Schéma de base de données v2 |
| STOA Gateway | 1.0.0 | CP API v2.x |
| Console UI | 1.0.0 | CP API v2.x |
| Developer Portal | 1.0.0 | CP API v2.x |
| Chart Helm | 1.0.0 | Tous les composants ci-dessus |

## Processus de Release

1. **Gel des fonctionnalités** — aucune nouvelle fonctionnalité après la date de gel
2. **Release candidate** — taguée `vX.Y.Z-rc.1`, déployée en staging
3. **Tests** — tests E2E, tests de smoke, vérification manuelle
4. **Release** — taguée `vX.Y.Z`, images Docker poussées, chart Helm mis à jour
5. **Annonce** — changelog publié, article de blog si significatif

## Dernières Releases

### v2.0.0 (Février 2026)

**Points saillants :**
- STOA Gateway (Rust) remplace le MCP Gateway Python en tant que gateway principal
- Pattern d'adapateurs multi-gateway (support Kong, Gravitee, webMethods)
- Gestion des environnements (dev/staging/production)
- Benchmarking Gateway Arena
- Piste d'audit avec OpenSearch
- Intégration GitOps ArgoCD
- 4 CRDs : Tool, ToolSet, GatewayInstance, GatewayBinding
- Support mTLS (RFC 8705)
- Documentation v1.0

**Changements Incompatibles :**
- MCP Gateway Python déplacé vers `archive/mcp-gateway/`
- Endpoints API Gateway changés de `/mcp/*` vers `/v1/*`
- Groupe d'API CRD changé de `stoa.io` vers `gostoa.dev`
- Le mapper d'audience Keycloak `stoa-mcp-gateway` doit inclure le nouveau gateway

**Migration :**
- Mettre à jour les CRDs : `kubectl apply -f charts/stoa-platform/crds/`
- Mettre à jour le mapper d'audience Keycloak pour inclure `stoa-gateway`
- Redéployer tous les composants avec le nouveau chart Helm

### v1.0.0 (Octobre 2025)

**Points saillants :**
- Release publique initiale
- Control Plane API avec FastAPI
- MCP Gateway Python avec politiques OPA
- Console UI (React)
- Developer Portal (React)
- Intégration OIDC Keycloak
- RBAC multi-tenant (4 rôles)
- Chart Helm pour le déploiement Kubernetes
- Suite de tests E2E (Playwright + BDD)

## Politique de Dépréciation

| Étape | Calendrier | Action |
|-------|----------|--------|
| **Déprécié** | Annoncé dans le changelog | La fonctionnalité fonctionne mais génère des avertissements |
| **Suppression planifiée** | Prochaine version majeure | Documentation mise à jour, guide de migration fourni |
| **Supprimé** | Release de version majeure | Fonctionnalité supprimée, changement incompatible documenté |

Les fonctionnalités dépréciées sont supportées pendant au moins un cycle de version majeure.

## Comment Rester Informé

- **GitHub Releases** : [github.com/stoa-platform/stoa/releases](https://github.com/stoa-platform/stoa/releases)
- **Blog** : [docs.gostoa.dev/blog](https://docs.gostoa.dev/blog)
- **RSS** : Abonnez-vous au flux RSS du blog pour les annonces de releases

## Voir Aussi

- [Guide de Mise à Niveau](/docs/admin/upgrade) -- Procédures de mise à niveau de version
- [Roadmap](/docs/roadmap) -- Fonctionnalités planifiées
- [ADRs](/docs/architecture/adr) -- Décisions architecturales
