---
title: "STOA — iPaaS Souverain"
description: "Intégration européenne avec sa passerelle et son plan de contrôle, API et MCP."
sidebar_position: 1
---

# STOA — iPaaS Souverain

STOA est un **iPaaS Souverain** au positionnement européen. Découvrez STOA **avec sa passerelle et son plan de contrôle** : contrats d’intégration, gestion des API et accès des agents via MCP.

## Qu’est-ce que STOA ?

Le plan de contrôle gère les contrats UAC et les politiques. La passerelle applique les règles aux appels ; MCP permet aux agents de découvrir et d’utiliser les capacités exposées. Ces fonctions s’inscrivent dans une plateforme d’intégration.

## Architecture en bref

La passerelle actuelle de R1 est en **Rust**. **Envoy est le moteur cible décidé** ; la migration reste à réaliser. Ce choix ne prouve ni livraison, ni parité fonctionnelle, ni performance. Voir [la décision Envoy](/docs/architecture/adr/adr-073-adopt-envoy-data-plane/).

## Démarrage rapide

Commencez par le [quickstart R1 local](/docs/guides/quickstart/) dans le répertoire `quickstart/` du dépôt public [stoa](https://github.com/stoa-platform/stoa). Il utilise Docker Compose ; sa validation réelle reste en cours. Il déclare un contrat directement sur la passerelle et ne démontre pas la publication par le plan de contrôle.

Le dépôt public [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) reste un parcours distinct. Les composants qui ne sont pas publiés ne sont pas présentés comme des dépôts publics.

## Capacités et périmètre

- Contrats UAC pour décrire l’intégration et ses politiques.
- Gestion des API et projections MCP pour les agents.
- Séparation du plan de contrôle et de l’exécution des appels.

Les interfaces de gestion et capacités de déploiement dépendent du parcours choisi ; le quickstart local n’inclut ni Console ni Portal.

## Licence

Le code publié de STOA est open source, sous licence Apache 2.0

Cette phrase ne couvre ni les services, ni les composants non publiés, ni la marque. Le contenu documentaire reste sous CC BY 4.0.

## Pour aller plus loin

- [Architecture](/docs/concepts/architecture/)
- [Passerelle actuelle et cible](/docs/concepts/gateway/)
- [État d’implémentation](/docs/concepts/implementation-status/)
- [Offre Enterprise sur devis](https://www.gostoa.dev/fr/contact/)
