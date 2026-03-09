---
sidebar_position: 1
title: "Portail Développeur : Découverte et Test d'APIs"
description: "Découvrez, abonnez-vous et testez des APIs avec le Portail Développeur STOA — catalogue d'API, expérience développeur, gestion des abonnements et sandbox de test"
keywords: [STOA, developer portal, API catalog, API discovery, subscriptions, guide, tutorial]
---

# Portail Développeur

Le Portail Développeur est l'interface du **consommateur d'API**. Les développeurs l'utilisent pour découvrir des APIs, gérer leurs abonnements et tester les endpoints.

:::info Gouvernance (ADR-055)
Le Portail suit le **modèle Stripe** : Portail = Consommateur UNIQUEMENT (Découvrir & Utiliser). Les fonctionnalités fournisseur et administrateur (publication d'API, webhooks, correspondances de credentials, contrats) sont gérées dans la [Console](/docs/guides/console).
:::

**URL** : [portal.gostoa.dev](https://portal.gostoa.dev)

## Démarrage Rapide

1. Accédez à l'URL du Portail
2. Cliquez sur **Se Connecter** — s'authentifie via Keycloak (client OIDC : `stoa-portal`)
3. Vous verrez le catalogue d'API sur la page d'accueil

## Catalogue d'API

Le catalogue affiche toutes les APIs publiées sur le Portail par les administrateurs de tenants.

### Navigation

- **Recherche** : Recherche en texte intégral sur les noms, descriptions et tags des APIs
- **Filtre** : Filtrer par catégorie, version ou tenant
- **Tri** : Trier par nom, date de publication ou popularité

### Page de Détail d'une API

Cliquez sur une API pour consulter :

- **Description** : Vue d'ensemble et objectif
- **Documentation** : Visualiseur OpenAPI/Swagger interactif
- **Versions** : Versions disponibles avec journal des modifications
- **Bouton S'abonner** : Demander l'accès à l'API

## Abonnements

### Créer un Abonnement

1. Accédez à l'API que vous souhaitez utiliser
2. Cliquez sur **S'Abonner**
3. Sélectionnez une application existante ou créez-en une nouvelle
4. Choisissez un plan (si plusieurs plans sont disponibles)
5. Soumettez la demande

### Statut des Abonnements

Suivez vos abonnements dans **Mes Abonnements** :

| Statut | Signification |
|--------|---------------|
| En attente | En attente d'approbation par l'administrateur du tenant |
| Actif | Accès accordé — credentials disponibles |
| Suspendu | Temporairement mis en pause par l'administrateur |
| Rejeté | Demande refusée |

### Consulter les Credentials

Une fois un abonnement approuvé :

1. Accédez à **Mes Abonnements**
2. Cliquez sur l'abonnement actif
3. Consultez la clé API ou les credentials OAuth
4. Copiez les credentials pour les utiliser dans votre application

## Applications

Les applications représentent votre logiciel client qui consomme des APIs.

### Créer une Application

1. Accédez à **Mes Applications**
2. Cliquez sur **Créer une Application**
3. Saisissez un nom et une description
4. L'application est créée et prête pour les abonnements

### Tableau de Bord de l'Application

Consultez tous les abonnements, credentials et métriques d'utilisation pour chaque application.

## Tester les APIs

Le Portail inclut un testeur d'API interactif :

1. Ouvrez une API avec un abonnement actif
2. Accédez à la section **Essayer**
3. Sélectionnez un endpoint
4. Remplissez les paramètres
5. Cliquez sur **Envoyer** pour exécuter la requête
6. Consultez la réponse avec les en-têtes et le corps

## Authentification

Le Portail utilise Keycloak pour l'authentification :

- **Client OIDC** : `stoa-portal`
- **Connexion** : Page de connexion Keycloak avec nom d'utilisateur/mot de passe ou SSO
- **Session** : Tokens JWT stockés dans `sessionStorage`
- **Rafraîchissement du token** : Géré automatiquement par `react-oidc-context`

Voir [Authentification](./authentication) pour la configuration Keycloak.
