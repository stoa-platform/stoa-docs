---
sidebar_position: 3
slug: /tutorials/self-service-subscription
title: "Souscription API en libre-service en 2 clics"
description: "Permettez aux développeurs de découvrir, tester et souscrire à vos API sans attendre d'approbation — depuis le portail développeur."
keywords:
  - souscription API
  - portail libre-service
  - tutoriel portail développeur
  - provisionnement clé API
  - portail STOA
---

# Souscription API en libre-service

Permettez aux développeurs de découvrir, tester et souscrire à vos API sans passer par des échanges d'emails et des réunions.

## Ce que vous allez accomplir

À la fin de ce tutoriel :
- Un développeur trouve votre API dans le portail
- Il souscrit en 2 clics
- Il obtient une clé API instantanément
- Il fait son premier appel — le tout en libre-service

## Prérequis

- Une instance STOA avec au moins une API publiée
- Le portail développeur accessible à l'URL de votre `portal`

## Étape 1 : Découvrir l'API

Ouvrez le [Portail Développeur](https://portal.gostoa.dev) et parcourez le catalogue d'API.

Chaque API affiche :
- **Description** et version
- **Plans disponibles** (Gratuit, Standard, Premium) avec limites de débit
- **Documentation OpenAPI** avec essai en ligne
- **Outils MCP** (si l'exposition MCP est activée)

## Étape 2 : Souscrire

Cliquez sur **Souscrire** sur l'API souhaitée. Choisissez un plan :

| Plan | Limite de débit | Approbation |
|------|----------------|-------------|
| Gratuit | 100 req/min | Automatique |
| Standard | 1 000 req/min | Automatique |
| Premium | 10 000 req/min | Approbation manuelle |

Pour les plans Gratuit et Standard, votre souscription est **instantanément active**. Aucune attente.

## Étape 3 : Obtenir votre clé API

Après la souscription, le portail affiche votre clé API :

```
Votre clé API : sk-stoa-xxxxxxxxxxxxxxxxxxxx

Utilisez cette clé dans l'en-tête Authorization :
Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx
```

Vous pouvez également la retrouver depuis la page **Mes Souscriptions** à tout moment.

## Étape 4 : Faire votre premier appel

```bash
# Appel REST
curl ${STOA_GATEWAY_URL}/weather/paris \
  -H "Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx"

# Ou via MCP (si activé)
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer sk-stoa-xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "get-weather", "arguments": {"city": "Paris"}}'
```

## Ce que l'administrateur voit

Dans la Console, le propriétaire de l'API voit :
- Nouvelle souscription avec les détails du développeur
- Métriques d'utilisation par souscripteur
- La possibilité de révoquer ou mettre à niveau les plans

Aucun email n'a été envoyé. Aucune réunion n'a été planifiée. Le développeur est passé de la découverte au premier appel en moins de 2 minutes.

## Étapes suivantes

- [Exposer votre API REST comme outil MCP](/docs/tutorials/expose-rest-as-mcp)
- [Guide de rotation des clés API](/docs/guides/api-key-rotation)
- [Gestion du cycle de vie des souscriptions](/docs/guides/subscriptions-lifecycle)
- [Guide d'onboarding des consommateurs](/docs/guides/consumer-onboarding)
