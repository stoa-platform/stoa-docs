---
sidebar_position: 19
title: "ADR-019 : Modèle économique"
description: "Décide le modèle économique open-source et la stratégie de différenciation concurrentielle de la plateforme STOA, incluant la licence et l'approche de monétisation."
keywords: [modèle économique, open source, stratégie, monétisation, avantage concurrentiel]
---

# ADR-019 : Modèle économique

| | |
|---|---|
| **Statut** | Proposé |
| **Date** | 2026-01-27 |
| **Auteurs** | Christophe ABOULICAM |
| **Tags** | `stratégie`, `business`, `open-source` |

## Contexte

La plateforme STOA est publiée sous licence Apache 2.0. Cela soulève une question stratégique importante : comment construire un modèle économique viable tout en maintenant de véritables principes open-source.

## Décision

Nous adoptons un modèle inspiré des projets open-source à succès :

1. **Cœur open source** — Sous licence Apache 2.0, auto-hébergeable, piloté par la communauté
2. **Services enterprise** — Support commercial, SLAs et offres managées
3. **Protection de la marque** — Pratique standard pour les projets open-source (similaire à Linux, Kubernetes, Docker)

### Protection de la marque

| Actif | Statut |
|-------|--------|
| « STOA Platform » | Déposé (INPI, janvier 2026) |
| « STOA » | Déposé (INPI, janvier 2026) |
| Logo & Identité visuelle | Protégés |

Tout le monde peut forker le code sous Apache 2.0. L'utilisation de la marque nécessite une autorisation, comme c'est la pratique standard pour les projets open-source.

### Communauté & Écosystème

| Actif | Statut |
|-------|--------|
| Discord officiel | Actif |
| Site de documentation | Actif |
| Programme de contribution | Planifié |

## Conséquences

### Positives
- Proposition de valeur claire au-delà du « code gratuit »
- Modèle économique viable
- La communauté peut croître sans menacer la viabilité commerciale

### Négatives
- Nécessité de maintenir qualité et vélocité de manière constante
- Certaines entreprises peuvent quand même forker (acceptable sous Apache 2.0)

## Conformité

- Licence Apache 2.0 : entièrement conforme
- Protection de la marque : pratique standard (similaire à Linux, Kubernetes, etc.)
- Pas de « bait-and-switch open-core » : les fonctionnalités core restent ouvertes

## Références

- [Directives de marque Kubernetes](https://www.linuxfoundation.org/trademark-usage)
