---
sidebar_position: 1
title: "Documentation STOA Platform"
description: "Démarrez avec STOA — la passerelle API open source AI-native pour MCP, l'isolation multi-tenant et la modernisation des API d'entreprise."
keywords: [STOA, passerelle API, MCP, documentation, démarrage, open source, passerelle IA, Model Context Protocol]
---

# Premiers pas avec STOA

:::info Offre hébergée sur demande
Évaluez STOA en le lançant localement avec le [guide de démarrage rapide](/docs/guides/quickstart). L'offre hébergée est disponible sur demande auprès de [notre équipe](mailto:sales@gostoa.dev). Vous pouvez aussi explorer la [Vue d'ensemble de l'architecture](/docs/concepts/architecture) et les [Cas d'usage entreprise](/docs/use-cases) pour en savoir plus.
:::

Bienvenue sur **STOA Platform** — une plateforme de gestion d'API open source et AI-native, conçue pour l'ère MCP.

STOA fait le pont entre les API traditionnelles et les agents IA grâce au [Model Context Protocol (MCP)](/docs/concepts/mcp-gateway), permettant à Claude, GPT et d'autres agents IA de découvrir et d'appeler vos API automatiquement — avec une gouvernance complète, une isolation par tenant et des pistes d'audit.

## Qu'est-ce que STOA ?

STOA est une passerelle API et une plateforme de gestion cloud-native construite sur Kubernetes. Elle combine les fonctionnalités d'une passerelle API traditionnelle avec le support natif des protocoles pour agents IA :

- **MCP Gateway** — Les agents IA découvrent et invoquent vos API via le Model Context Protocol, avec génération automatique de schémas et enregistrement d'outils
- **Isolation multi-tenant** — Chaque tenant dispose de son propre namespace Kubernetes, realm Keycloak et schéma de base de données pour une séparation complète des données
- **Configuration GitOps-first** — Toutes les définitions d'API, politiques et configurations de tenants sont gérées de manière déclarative via Git et ArgoCD
- **Authentification OIDC/OAuth2** — Keycloak intégré pour la fédération d'identités basée sur les standards, supportant LDAP, SAML et les fournisseurs sociaux
- **Portail développeur** — Découverte d'API en libre-service, consultation de la documentation et gestion des abonnements pour les développeurs et consommateurs d'API
- **Observabilité entreprise** — Métriques Prometheus, tableaux de bord Grafana et OpenSearch pour les logs et snapshots d'erreurs — le tout intégré

## Architecture en un coup d'oeil

```
┌──────────────────────────────────────────────────────────────┐
│                    PLAN DE CONTRÔLE (Cloud)                   │
│                                                              │
│   Console    Portail     API       Auth       Observabilité  │
│   (React)   (React)  (FastAPI) (Keycloak)  (Grafana+Prom)  │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │  orchestre
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    PLAN DE DONNÉES (On-Premise ou Cloud)      │
│                                                              │
│   STOA Gateway (Rust)          Adaptateurs legacy            │
│   • Protocole MCP              • webMethods                  │
│   • Proxy REST                 • Kong                        │
│   • Rate Limiting              • Gravitee                    │
│   • mTLS                       • Apigee                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Le **Plan de contrôle** gère le catalogue d'API, l'authentification et l'observabilité. Le **Plan de données** exécute votre passerelle (STOA Gateway en Rust ou un sidecar à côté des passerelles existantes) au plus près de vos API.

## Démarrage rapide

Il n'y a qu'un seul parcours de démarrage : lancer STOA localement avec la stack Docker Compose du dépôt principal. Le [Guide de démarrage rapide](/docs/guides/quickstart) liste chaque variable obligatoire par son nom (donnez vos propres valeurs dans `.env` ; aucune n'est fournie), valide la configuration statiquement avec `docker compose config --quiet`, puis démarre un ensemble explicite de services. L'offre hébergée est disponible sur demande.

## Différenciateurs clés

| Fonctionnalité | Passerelle traditionnelle | STOA |
|----------------|--------------------------|------|
| Support agents IA | Non prévu | MCP Gateway natif |
| Découverte d'API | Documentation manuelle | Auto-découverte via MCP |
| Premier appel API | Jours à semaines | Secondes (avec MCP) |
| Isolation par tenant | Infrastructure partagée | Isolation au niveau namespace |
| Configuration | GUI ou API impérative | GitOps-first (ArgoCD) |
| Hébergement | Géré par le fournisseur | Auto-hébergé, prêt pour l'UE |
| Licence | Propriétaire | Apache 2.0 |

## À qui s'adresse STOA ?

- **Équipes plateforme** modernisant des passerelles API legacy (webMethods, DataPower, Oracle OAM)
- **Architectes d'entreprise** construisant des plateformes API multi-tenant avec une isolation forte
- **Équipes IA/ML** connectant des agents IA aux API d'entreprise via MCP
- **Industries régulées** (finance, santé, secteur public) nécessitant la souveraineté des données européenne et des fonctionnalités de support NIS2/DORA

## Étapes suivantes

- [Tutoriels](/docs/tutorials) — Guides pratiques : exposer une API REST comme outil MCP, souscription en libre-service, pont Oracle OAM
- [Vue d'ensemble de l'architecture](/docs/concepts/architecture) — Comprendre l'architecture des composants de STOA
- [Guide de démarrage rapide](/docs/guides/quickstart) — Lancer STOA localement, créer le premier administrateur et enregistrer une API
- [Configuration de l'authentification](/docs/guides/authentication) — Configurer Keycloak OIDC
- [Concepts MCP Gateway](/docs/concepts/mcp-gateway) — Comprendre comment les agents IA interagissent avec STOA
- [Guides de migration](/docs/guides/migration) — Migrer depuis webMethods, Kong, Apigee ou Oracle OAM
- [Référence API](/docs/api/control-plane) — Explorer l'API du Plan de contrôle
