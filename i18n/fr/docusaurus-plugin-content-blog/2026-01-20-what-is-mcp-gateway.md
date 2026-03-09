---
slug: what-is-mcp-gateway
title: "Qu'est-ce qu'un MCP Gateway ? La couche de sécurité dont les agents IA ont besoin"
authors: [christophe]
tags: [mcp, ai, architecture]
description: "Des agents IA qui appellent vos APIs sans garde-fous ? Un MCP gateway ajoute authentification, rate limiting et audit trails entre les agents et vos APIs."
keywords: [MCP gateway, Model Context Protocol, AI API gateway, MCP server, AI agent security, API gateway for AI, AI governance, enterprise AI]
---

<!-- last verified: 2026-02 -->

# Qu'est-ce qu'un MCP Gateway ? La pièce manquante pour la sécurité des agents IA

À mesure que les agents IA passent des démonstrations à la production, les entreprises se posent une question cruciale : comment donner à un LLM un accès sécurisé et gouverné à vos outils et données internes ? La réponse est un **MCP gateway** — une nouvelle catégorie d'infrastructure qui s'intercale entre les agents IA et les services qu'ils consomment, en appliquant sécurité, observabilité et politique à chaque interaction.

<!-- truncate -->

## Le Model Context Protocol, expliqué

Le [Model Context Protocol (MCP)](https://modelcontextprotocol.io) est un standard ouvert introduit par Anthropic fin 2024. Il définit comment les agents IA découvrent, s'authentifient auprès et invoquent des outils externes. Considérez-le comme « OpenAPI pour les agents IA » — une façon structurée pour un LLM d'appeler une fonction, lire une ressource ou recevoir un template de prompt depuis un serveur externe.

Un **serveur MCP** expose des outils (fonctions qu'un agent peut appeler), des ressources (données qu'un agent peut lire) et des prompts (templates réutilisables). Un **client MCP** — typiquement un agent IA ou un framework d'orchestration — se connecte à un ou plusieurs serveurs MCP pour étendre ses capacités.

Le protocole lui-même est élégant. Mais déployer des serveurs MCP bruts directement en production, c'est comme exposer un port de base de données sur internet : techniquement possible, naïvement dangereux.

## Pourquoi les agents IA ont besoin d'un gateway

Les API gateways traditionnels gèrent le trafic REST et GraphQL avec des patterns éprouvés : rate limiting, authentification, routage, observabilité. Mais le trafic MCP est fondamentalement différent :

- **La découverte d'outils est dynamique.** Les agents énumèrent les outils disponibles à l'exécution, pas au moment du déploiement.
- **Les invocations dépendent du contexte.** Le même appel d'outil peut avoir des implications de sécurité très différentes selon le contexte de l'agent.
- **La multi-tenancy est critique.** Différentes équipes, différents agents, différents accès aux outils — sur la même infrastructure.
- **La conformité est non négociable.** Les entreprises ont besoin d'audit trails pour chaque invocation d'outil, qui l'a demandé et quelles données ont été accédées.

Un serveur MCP brut ne possède aucune de ces capacités. Un MCP gateway les fournit toutes.

### Ce que fait un MCP Gateway

Un MCP gateway est un reverse proxy et un point d'application des politiques conçu spécifiquement pour le trafic du Model Context Protocol. Il intercepte chaque interaction entre un agent IA et les serveurs MCP derrière lui, en appliquant :

| Capacité | Ce qu'elle résout |
|---|---|
| **Authentification** | Validation JWT, clé API ou mTLS avant toute invocation d'outil |
| **Autorisation** | Politiques basées sur OPA contrôlant quels tenants peuvent invoquer quels outils |
| **Rate limiting** | Empêcher les agents incontrôlés de surcharger les services backend |
| **Audit logging** | Trace complète de chaque appel d'outil, lecture de ressource et expansion de prompt |
| **Filtrage d'outils** | N'exposer que les outils approuvés par tenant, en masquant les opérations internes |
| **Observabilité** | Métriques, distributed tracing et comptage d'utilisation par agent et par outil |

## L'architecture : gateway entre agents et outils

Voici comment un MCP gateway s'intègre dans un déploiement enterprise typique :

```
Agents IA (Claude, GPT, Custom)
         |
         | Protocole MCP (JSON-RPC over SSE/HTTP)
         v
  +-----------------+
  |   MCP Gateway   |  <-- Auth, Policy, Metering, Routage
  +-----------------+
     |       |       |
     v       v       v
  [Outil A] [Outil B] [Outil C]   <-- Serveurs MCP (services internes)
```

Le gateway est le point d'entrée unique. Les agents ne parlent jamais directement aux serveurs MCP. C'est le même pattern qui a rendu les API gateways essentiels pour les microservices — appliqué à la couche des agents IA.

## Comment STOA implémente le MCP Gateway

Le [MCP Gateway](/docs/concepts/mcp-gateway) de STOA est conçu de zéro pour le trafic MCP en production. Alors que d'autres gateways comme Kong ont ajouté le support MCP via des plugins (AI MCP Proxy, MCP OAuth2 depuis Gateway 3.12), STOA traite MCP comme un protocole de première classe dans le cœur du gateway. Les décisions de conception clés incluent :

### Intégration du moteur de politique OPA

Chaque invocation d'outil passe par une évaluation [Open Policy Agent (OPA)](https://www.openpolicyagent.org/). Les politiques sont écrites en Rego et peuvent imposer des règles telles que :

- Le tenant A ne peut invoquer que les outils dans l'espace de noms `analytics`.
- L'outil `delete-user` nécessite une portée d'approbation supplémentaire.
- Les agents tournant dans l'environnement `staging` ne peuvent pas accéder aux outils de données de production.

Il ne s'agit pas d'un simple RBAC — c'est du contrôle d'accès basé sur les attributs (ABAC) qui peut évaluer n'importe quelle combinaison de tenant, d'outil, de portée, d'environnement et de contexte de requête.

### Isolation multi-tenant des outils

Le gateway de STOA applique une isolation stricte des tenants à l'aide de CRDs Kubernetes. Chaque tenant ne voit que les outils auxquels il a été autorisé à accéder. Les définitions d'outils sont des [Custom Resources Kubernetes](/docs/reference/crds/) qui peuvent être gérées via GitOps, CLI ou la console d'administration.

### Comptage basé sur Kafka

Chaque invocation d'outil génère un événement de comptage publié sur Kafka. Cela alimente les tableaux de bord d'utilisation, la facturation et la détection d'anomalies. Si un agent commence soudainement à faire 10 fois plus d'appels d'outils que d'habitude, vous le saurez immédiatement.

### Quatre modes de fonctionnement

Le gateway de STOA supporte [quatre modes de déploiement](/docs/concepts/architecture) :

1. **Edge-MCP** — Le gateway est la porte d'entrée pour tout le trafic MCP (mode par défaut actuel).
2. **Sidecar** — Déployé aux côtés des API gateways existants pour une adoption progressive.
3. **Proxy** — Pass-through transparent avec application des politiques.
4. **Shadow** — Mirroring du trafic pour les tests sans impact sur la production.

Cette flexibilité permet aux entreprises d'adopter la gouvernance MCP de façon incrémentale, sans migration « rip-and-replace ».

## MCP Gateway vs exposition de serveurs MCP bruts

Pour rendre la distinction concrète :

| Préoccupation | Serveur MCP brut | MCP Gateway |
|---|---|---|
| Authentification | Aucune (ou DIY) | JWT, clés API, mTLS |
| Autorisation | Aucune | Politiques OPA par tenant, outil et portée |
| Multi-tenancy | Single-tenant uniquement | Isolation complète des tenants avec CRDs |
| Audit trail | Logs applicatifs (peut-être) | Événements d'audit structurés par invocation |
| Rate limiting | Aucun | Quotas par tenant et par outil |
| Découverte d'outils | Tous les outils visibles par tous les clients | Filtré par tenant et portée |
| Observabilité | Scrape Prometheus (peut-être) | Métriques, tracing, comptage intégrés |
| Déploiement | Chaque serveur exposé individuellement | Endpoint gateway unique, nombreux backends |

La différence est la même qu'exposer un port PostgreSQL publiquement versus mettre une API devant. Le gateway est la couche API pour votre infrastructure d'agents IA.

## Quand avez-vous besoin d'un MCP Gateway ?

Vous avez besoin d'un MCP gateway dès que :

- **Plus d'une équipe** nécessite un accès d'agents IA aux outils internes.
- **Les exigences de conformité** imposent des audit trails pour les interactions IA (NIS2, DORA, SOC 2).
- **Plusieurs fournisseurs d'IA** (Claude, GPT, modèles open source) doivent partager la même infrastructure d'outils.
- **Vous passez du POC à la production** et avez besoin d'une gouvernance qui s'adapte à l'échelle.

Si vous êtes encore en phase d'expérimentation avec un seul développeur faisant tourner un seul serveur MCP, vous pouvez commencer sans gateway. Mais dès que vous avez besoin de multi-tenancy, de sécurité ou de conformité, le gateway devient incontournable.

## Démarrer avec le MCP Gateway de STOA

STOA est open source (Apache 2.0) et conçu pour un déploiement auto-hébergé ou cloud. Vous pouvez passer de zéro à un MCP gateway fonctionnel en moins de 15 minutes :

1. **[Guide de démarrage rapide](/docs/guides/quickstart)** — Configuration Docker Compose avec un MCP gateway fonctionnel, un portail et une console.
2. **[Concepts du MCP Gateway](/docs/concepts/mcp-gateway)** — Plongée en profondeur dans l'architecture, le moteur de politique et la gestion des outils.
3. **[Console](https://console.gostoa.dev)** — Essayez la version hébergée pour explorer l'interface d'administration.

Le MCP gateway est la couche d'infrastructure qui rend les agents IA prêts pour l'enterprise. À mesure que davantage d'organisations passent des expérimentations IA aux déploiements en production, c'est la pièce qui fera la différence entre des opérations IA gouvernées et sécurisées et la prochaine génération de shadow IT.

## Foire aux questions

### Quelle est la différence entre un MCP gateway et un API gateway ?

Un MCP gateway est conçu spécifiquement pour le trafic des agents IA et le Model Context Protocol, tandis que les API gateways traditionnels se concentrent sur REST/GraphQL. Les MCP gateways gèrent la découverte dynamique d'outils, les invocations dépendantes du contexte et les patterns spécifiques à l'IA comme le streaming et l'optimisation des tokens. Les gateways traditionnels comme Kong ont ajouté le support MCP via des plugins, mais STOA traite MCP comme un protocole de première classe dans le cœur du gateway. Voir notre [comparaison des API Gateways 2026](/blog/open-source-api-gateway-2026) pour les différences techniques détaillées.

### Ai-je besoin d'un MCP gateway pour Claude ou GPT ?

Si vous utilisez Claude ou GPT en isolation avec des APIs publiques, non. Mais si vous souhaitez donner aux agents IA un accès sécurisé à vos outils internes, appliquer des politiques, suivre l'utilisation ou supporter plusieurs tenants, alors oui. Le MCP gateway s'intercale entre l'agent IA et vos systèmes backend, fournissant authentification, autorisation, audit logging et rate limiting. En savoir plus dans [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis).

### Le MCP gateway de STOA est-il open source ?

Oui. STOA Platform est sous licence Apache 2.0, y compris le composant MCP gateway. Vous pouvez le déployer sur votre propre infrastructure, le modifier et l'utiliser commercialement sans restrictions. Nous avons choisi Apache 2.0 plutôt que les licences business source pour éviter le lock-in et permettre les contributions communautaires. Lisez notre raisonnement dans [Pourquoi Apache 2.0, pas BSL](/blog/why-apache-2-not-bsl).

## Articles connexes

Explorez davantage sur les MCP gateways et l'infrastructure des agents IA :

- [L'ESB est mort, vive le MCP](/blog/esb-is-dead-long-live-mcp) — Comment le Model Context Protocol remplace le middleware d'intégration traditionnel
- [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis) — Patterns pour l'intégration sécurisée des agents IA
- [Démarrage rapide MCP Gateway avec Docker](/blog/mcp-gateway-quickstart-docker) — Déployez un MCP gateway fonctionnel en 10 minutes
- [Plongée en profondeur dans le protocole MCP](/blog/mcp-protocol-architecture-deep-dive) — Architecture, flux de messages et couches de transport
- [Sécurité des agents IA : 5 patterns d'authentification](/blog/ai-agent-security-authentication-patterns) — OAuth2, mTLS, clés API, échange de token et certificate binding
- [Convertir les APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools) — Guide étape par étape pour exposer vos APIs aux agents IA
- [MCP vs OpenAI Function Calling vs LangChain Tools](/blog/mcp-vs-openai-function-calling-vs-langchain) — Quelle approche devriez-vous utiliser ?

---

*Prêt à sécuriser votre infrastructure d'agents IA ? [Commencez avec le guide de démarrage rapide](/docs/guides/quickstart) ou [explorez la documentation du MCP gateway](https://docs.gostoa.dev/docs/concepts/mcp-gateway).*
