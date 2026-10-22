---
title: "Passerelle STOA"
description: "Passerelle actuelle en Rust et moteur cible Envoy."
sidebar_position: 5
---

# Passerelle STOA

:::info État actuel et direction cible
La passerelle de R1 est actuellement en **Rust**. **Envoy est la cible décidée**, avec une migration à venir. Cette page ne constitue pas une attestation de disponibilité ou de performance. Voir [l’ADR Envoy](/docs/architecture/adr/adr-098-envoy-data-plane/).
:::

## Vue d’ensemble

La passerelle est une capacité de l’iPaaS Souverain STOA. Elle exécute les appels API selon les contrats et politiques ; les services MCP projettent ces capacités vers les agents.

## Architecture cible

Envoy doit assurer transport, routage, connexions amont et résilience. Les décisions métier et les traitements spécifiques restent dans des services STOA. MCP et OAuth demeurent des services applicatifs. Les interfaces `ext_authz`, `ext_proc` et xDS décrivent une direction à implémenter et qualifier.

## Modes de déploiement

Les modes décrits dans [l’ADR historique](/docs/architecture/adr/adr-024-gateway-unified-modes/) ne prouvent pas une équivalence dans la cible Envoy. Aucune date de disponibilité des modes n’est annoncée ici.

## Configuration

Pour le [quickstart R1](/docs/guides/quickstart/), utilisez le Compose livré dans le dépôt public et son script de vérification. Pour votre environnement, fournissez `STOA_GATEWAY_URL`, `STOA_AUTH_URL` et les paramètres d’identité via votre configuration locale ; ne recopiez pas de coordonnées d’exploitation.

## Implémentation

| Périmètre | État |
|---|---|
| Passerelle de R1 | Rust, parcours local transitoire |
| Moteur cible | Envoy, migration à venir |
| Contrats et politiques | Modèle STOA à préserver lors de la migration |
| Parité et performances Envoy | À valider ; aucune mesure publiée ici |

## Documentation associée

- [Architecture](/docs/concepts/architecture/)
- [État d’implémentation](/docs/concepts/implementation-status/)
- [Contrats UAC](/docs/concepts/uac/)
