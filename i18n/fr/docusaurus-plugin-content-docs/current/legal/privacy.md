---
title: Confidentialité des docs
description: Traitements et préférence de thème du site documentaire.
sidebar_position: 3
---

Ce document concerne le site documentaire. Les services STOA et les échanges commerciaux demandent une information adaptée à leurs propres traitements.

## Responsable et droits

L’éditeur est CAB Ingénierie, EURL au capital de 100 €, SIREN 539 901 710, RCS Paris 539 901 710, siège : 37 rue des Mathurins, 75008 Paris. [À COMPLÉTER : contact pour les droits sur les données]. Vous pouvez demander l’accès, la rectification, l’effacement et, selon le traitement, la limitation ou l’opposition, et saisir la CNIL.

## Hébergement et journaux

Les pages sont stockées et diffusées à Paris par Scaleway Object Storage et Edge Services.

| Traitement | Données et finalité | Conservation |
|---|---|---|
| Journaux Edge Services | Adresse IP, date, heure, méthode, chemin demandé, informations HTTP/TLS, navigateur, pays et statut ; sécurité et exploitation | 7 jours à Paris |
| Métriques techniques Edge Services | Agrégats de requêtes, cache et pays ; exploitation | 31 jours |
| Journaux d’accès Object Storage | Non activés | Sans objet |

La sécurité et l’exploitation reposent sur l’intérêt légitime. Ces journaux ne servent pas à mesurer l’audience. Aucun outil Google Analytics ou Vercel Analytics n’est intégré au site.

## Sous-traitants et recherche

- Scaleway : hébergement et diffusion des pages.
- Cloudflare : DNS et redirection du domaine nu du site principal. Les requêtes vers ce domaine peuvent transiter sur son réseau mondial. [À COMPLÉTER : conservation et garanties de transfert applicables].

La recherche s’exécute localement dans le navigateur. Le site sert un index de la
documentation, du blog et des pages en anglais et en français ; aucune requête de
recherche n’est envoyée à un tiers. Les polices et les actifs du thème sont auto-hébergés.

Nous ne déduisons pas l’absence de transfert hors de l’Union européenne du seul hébergement à Paris.

## Préférence de thème

Le cookie fonctionnel `stoa-theme` contient uniquement `light` ou `dark`, sans identifiant. Il mémorise le choix clair/sombre demandé par le visiteur, avec une durée de 12 mois proposée, à confirmer par Juridique. Il utilise `Path=/; SameSite=Lax; Secure` et le domaine `.gostoa.dev` lorsque l’hôte est ce domaine ou un de ses sous-domaines ; ailleurs, il reste limité à l’hôte.

Docusaurus conserve également cette préférence dans le stockage local du navigateur. Vous pouvez supprimer ces préférences dans les paramètres du navigateur. L’exemption de consentement pour cette seule préférence reste à confirmer par Juridique. Aucun autre cookie ni traceur d’audience n’est ajouté par le site.

## Points à compléter

[À COMPLÉTER : validation juridique du tableau, des sous-traitants et de l’information relative aux droits avant publication].
