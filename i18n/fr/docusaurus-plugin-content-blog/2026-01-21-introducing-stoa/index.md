---
slug: introducing-stoa
title: "Pourquoi Nous Avons Construit un API Gateway Open-Source AI-Native"
authors: [christophe, stoa-team]
tags: [announcement, mcp]
description: "Support MCP, isolation multi-tenant et portail développeur pour l'ère IA enterprise. Pourquoi nous avons construit STOA Platform et ce qui le rend différent."
keywords:
  - STOA platform
  - open source API gateway
  - AI-native API gateway
  - MCP gateway
  - API management platform
  - multi-tenant API gateway
  - Model Context Protocol
---

# Présentation de STOA Platform

STOA Platform est un API gateway open-source AI-native conçu pour l'ère du Model Context Protocol (MCP). Il fait le pont entre les APIs legacy et les agents IA avec une gouvernance unifiée, une souveraineté européenne et zéro vendor lock-in — le tout sous Apache 2.0.

Nous sommes ravis d'annoncer **STOA** — un API Gateway conçu pour l'ère de l'IA.

<!-- truncate -->

## Pourquoi STOA ?

L'essor des agents IA et du Model Context Protocol (MCP) a créé de nouveaux défis pour la gestion d'API enterprise :

- **Les agents IA ont besoin d'un accès sécurisé** aux outils et données enterprise
- **Les API gateways traditionnels** n'ont pas été conçus à l'origine pour le trafic MCP
- **Les entreprises ont besoin de gouvernance** sur la façon dont l'IA interagit avec leurs systèmes

STOA comble ce fossé en fournissant une plateforme unifiée pour les APIs traditionnelles et les agents IA compatibles MCP.

## Qu'est-ce que STOA ?

STOA est une plateforme gateway cloud-native multi-tenant qui combine :

- **MCP Gateway** — Accès sécurisé des agents IA aux outils enterprise
- **API Gateway** — Gestion d'API REST/GraphQL traditionnelle
- **Portail Développeur** — Découverte et abonnement self-service aux APIs/outils
- **Console d'Administration** — Gouvernance et monitoring centralisés

### Architecture

STOA suit une séparation **Plan de Contrôle / Plan de Données** :

```
Control Plane: Core API, Portal, Console
     ↓ config sync
Data Plane: MCP Gateway, webMethods Gateway
```

Cette architecture permet la mise à l'échelle et le déploiement indépendants des composants de gestion et de trafic.

## Fonctionnalités Clés

### Pour les Développeurs

- Parcourir et s'abonner aux APIs et outils MCP
- Générer des clés API avec des scopes à grain fin
- Consulter les dashboards d'utilisation et la documentation

### Pour les Équipes Plateforme

- Isolation multi-tenant
- RBAC avec 6 personas et 12 scopes
- 35 outils MCP pour les opérations plateforme
- GitOps-native avec support ArgoCD

### Pour les Équipes Sécurité

- Modes de sécurité mTLS / OAuth2 / hybride
- Intégration du moteur de politiques OPA
- Journalisation d'audit et conformité

## Et Ensuite ?

Notre cible est une **version MVP (v0.1.0) le 26 février 2026**.

Consultez notre [Roadmap](/docs/roadmap) pour le calendrier complet, incluant :

- T2 2026 : Rate limiting, metering d'usage, journalisation d'audit
- T3 2026 : Outil CLI, provider Terraform, SDKs
- T4 2026 : Gateway Rust haute performance (prévu)

## Démarrer

- [Documentation](https://docs.gostoa.dev)
- [GitHub](https://github.com/stoa-platform)
- [Discord](https://discord.gostoa.dev)

Nous construisons en public et accueillons les contributions. Rejoignez-nous !

---

## Questions Fréquentes

### STOA est-il gratuit ?

Oui, STOA est entièrement open source sous Apache 2.0. Il n'y a pas de fonctionnalités réservées à l'enterprise ni de paywalls. La multi-tenancy, le portail développeur, la console d'administration et toutes les capacités de gouvernance sont inclus dans la distribution open-source. Pour en savoir plus sur notre philosophie de licence, consultez [Pourquoi Apache 2.0, Pas BSL](/blog/why-apache-2-not-bsl).

### Qu'est-ce qui distingue STOA de Kong ou Envoy ?

STOA est le premier gateway open-source avec un support natif MCP — le protocole que les agents IA utilisent pour découvrir et invoquer des outils. Tandis que Kong et Envoy sont d'excellents proxies HTTP, STOA est conçu de zéro pour la multi-tenancy, la souveraineté des données européenne et les modèles de déploiement hybride. Consultez notre comparaison détaillée dans le [Guide des API Gateways Open-Source 2026](/blog/open-source-api-gateway-2026).

### Comment démarrer ?

Le moyen le plus rapide d'essayer STOA est avec notre quickstart Docker Compose. Vous pouvez avoir une instance fonctionnelle avec le gateway, le portail et la console en moins de 15 minutes. Consultez le [Guide de Démarrage Rapide](/docs/guides/quickstart) pour des instructions étape par étape.

---

*L'équipe STOA*
