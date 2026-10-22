---
title: "État d’implémentation"
description: "Périmètre constaté par lecture et validation restant à réaliser."
sidebar_position: 10
---

# État d’implémentation

:::info État actuel et direction cible
La passerelle de R1 est actuellement en **Rust**. **Envoy est la cible décidée**, avec une migration à venir. Cette page ne constitue pas une attestation de disponibilité ou de performance. Voir [l’ADR Envoy](/docs/architecture/adr/adr-098-envoy-data-plane/).
:::

## Composants principaux

| Élément | Constat | Limite |
|---|---|---|
| Quickstart R1 | Compose et script présents | Exécution réelle non attestée |
| Passerelle | Rust dans le parcours R1 | Aucune disponibilité Envoy déduite |
| Plan de contrôle | Service et contrôle de santé | Publication d’API non démontrée par ce parcours |
| Keycloak et PostgreSQL | Présents dans le Compose | Images et comportement à valider à l’exécution |
| Console et Portal | Absents du parcours R1 | Ne pas annoncer d’interface locale dans ce parcours |

## Capacités de la passerelle

Le script prévoit une déclaration de contrat, des refus sans jeton ou avec jeton invalide et un succès avec un jeton Keycloak. Ce sont des résultats attendus, sans attestation d’exécution. Voir [le guide canonique](/docs/guides/quickstart/).

## Adaptateurs et cible

La migration nécessite un rendu Envoy des contrats, un suivi de configuration et des tests de parité des politiques. Les adaptateurs historiques ne prouvent pas cette parité.

## Déploiement et tests

Cette page ne constitue pas un inventaire d’exploitation, une matrice de support ou un rapport de couverture. Les ressources et versions supportées doivent être sourcées contre la release effectivement testée.

## Feuille de route

La cible Envoy est acceptée ; les critères de passage figurent dans l’ADR. Aucune date de migration ou promesse chiffrée n’est publiée.
