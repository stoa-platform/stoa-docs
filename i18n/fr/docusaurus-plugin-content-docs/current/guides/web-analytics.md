---
sidebar_position: 4
title: "Mesure d’audience"
description: "Comment STOA Docs mesure les visites et les replays masqués après votre accord."
keywords: [analytics, Google Analytics, consentement, confidentialité]
custom_edit_url: null
---

<head>
  <meta name="robots" content="noindex, nofollow" />
</head>

# Mesure d’audience

STOA Docs utilise Google Analytics pour comprendre quelles pages de documentation sont utiles et si les visiteurs accèdent au démarrage rapide ou aux dépôts GitHub de STOA. Microsoft Clarity peut aussi fournir des replays masqués des interactions. Les deux services ne se chargent qu’après votre choix **Autoriser** dans le panneau de mesure d’audience.

## Votre choix

Vous pouvez **Refuser** et utiliser toute la documentation. Le bouton permanent **Paramètres d’audience** permet de modifier votre choix à tout moment. L’accord comme le refus sont conservés pendant six mois calendaires, puis le site pose à nouveau la question. Si votre navigateur bloque le stockage local, votre choix s’applique uniquement à la session de la page en cours.

Avant l’accord, après un refus ou à l’expiration de votre choix, le site ne charge ni Google Analytics ni Clarity et n’envoie pas leurs événements de mesure. Le retrait de l’accord désactive aussi une balise déjà chargée et supprime les cookies de mesure `_ga`, `_clck` et `_clsk` accessibles sur Docs et son domaine parent. Si Clarity était chargé, la page se recharge pour terminer ce contexte d’enregistrement. Il n’efface pas les rapports historiques agrégés. Votre choix concerne ce site ; un autre site STOA autorisé peut créer à nouveau des cookies de mesure.

## Informations mesurées

- Une visite de page après l’accord, puis un événement par nouveau chemin de documentation.
- Un clic sur un lien de démarrage rapide.
- Un clic vers l’organisation ou un dépôt GitHub STOA.

Les événements contiennent une adresse de page nettoyée, un libellé de site fixe et la langue de l’interface. Les paramètres d’URL, fragments, recherches, contenus de formulaires, textes des liens, adresses e-mail et identifiants d’utilisateurs sont exclus. Les adresses de provenance externes sont réduites à leur origine. Le stockage publicitaire, la personnalisation publicitaire et les signaux Google sont désactivés.

La documentation et le site de présentation STOA utilisent le flux de mesure STOA existant. Le nom d’hôte et le champ `site_section` distinguent leurs visites. Le flux de rapports historique est ainsi conservé.

## Replays masqués des interactions

Clarity utilise le masquage strict du contenu, renforcé par un attribut `data-clarity-mask` couvrant la page et les champs de formulaire. Aucun identifiant utilisateur de l’application ne lui est transmis. L’enregistrement s’arrête au focus d’un champ de saisie et reste exclu des pages dédiées à la recherche, aux retours et aux démonstrations. Il ne démarre pas si l’adresse initiale de la page ou sa provenance contient des paramètres ou un fragment.

Les replays masqués contiennent toujours des données d’interaction et de navigation ; ils ne sont pas présentés comme anonymes. Les règles de nettoyage d’URL ci-dessus concernent les événements Google explicites et ne remplacent pas les métadonnées propres à Clarity.

## Ancienne intégration Vercel Analytics

Le composant Vercel Analytics a été retiré du site. Google Analytics et l’enregistreur Clarity facultatif dépendent de votre choix commun. Les rapports historiques Vercel restent distincts et ne sont pas additionnés aux chiffres Google Analytics.

## Notes de déploiement

L’identifiant public de mesure est configuré dans `src/analytics/config.ts` ; une valeur vide désactive la mesure. Le module Google Analytics automatique de Docusaurus n’est pas utilisé. Il ne faut pas ajouter une seconde balise.

Les visites sont mesurées avec le cycle de navigation Docusaurus. Les pages vues automatiques lors des changements d’historique et la mesure automatique des clics sortants doivent rester désactivées dans le flux pour éviter les doublons. Les événements explicites du site sont `page_view`, `quickstart_click` et `github_click`.

Le [guide d’exploitation du dépôt](https://github.com/stoa-platform/stoa-docs/blob/main/maintenance/analytics-consent.md) décrit les vérifications et le retour arrière. Le chargement d’un script ne prouve pas à lui seul la réception des événements ; celle-ci doit être confirmée dans Google Analytics.
