---
sidebar_position: 20
title: "Fonctionnalités Avancées de la Console"
description: "Fonctionnalités avancées de la Console — tableau de bord tenant, surveillance des opérations, gestion des gateways, instantanés d'erreurs et découverte d'API."
keywords:
  - console
  - dashboard
  - operations
  - gateway management
  - monitoring
---

# Fonctionnalités Avancées de la Console

Au-delà de la gestion de base des APIs et des tenants, la Console fournit des tableaux de bord et des outils opérationnels pour les administrateurs de plateforme.

## Tableau de Bord Tenant

Chaque tenant dispose d'un tableau de bord dédié affichant des métriques en temps réel provenant de Prometheus.

### Métriques Affichées

| Métrique | Source | Description |
|----------|--------|-------------|
| Taux de requêtes | `stoa_http_requests_total` | Requêtes par seconde |
| Taux d'erreur | `stoa_http_requests_total{status=~"5.."}` | Erreurs 5xx par seconde |
| Latence P95 | `stoa_http_request_duration_seconds` | Temps de réponse au 95e percentile |
| Abonnements actifs | API du Plan de Contrôle | Nombre d'abonnements approuvés |
| APIs publiées | API du Plan de Contrôle | Nombre d'APIs dans le catalogue |

### Plage Temporelle

Sélectionnez parmi les plages 1h, 6h ou 24h. Les données se rafraîchissent automatiquement toutes les 15 secondes.

### Accès

Accédez à **Tenants** dans la barre latérale, sélectionnez un tenant, puis cliquez sur **Tableau de Bord**.

## Tableau de Bord Opérations

Vue opérationnelle à l'échelle de la plateforme disponible pour les utilisateurs `cpi-admin`.

### Cartes de Vue d'Ensemble

| Carte | Seuils |
|-------|--------|
| Taux d'erreur | Bon : 0-1%, Avertissement : 1-5%, Critique : supérieur à 5% |
| Latence P95 | Bon : 0-500ms, Avertissement : 500ms-2s, Critique : supérieur à 2s |
| Requêtes/min | Informatif (sans seuil) |
| Alertes actives | Nombre provenant d'Alertmanager |
| Disponibilité | Pourcentage sur la fenêtre sélectionnée |

### Déploiements Récents

Affiche les derniers déploiements sur tous les composants avec :

- Nom et version du composant
- Horodatage du déploiement
- État de synchronisation (pour les composants gérés par ArgoCD)
- État de santé

### Accès

Accédez à **Opérations** dans la barre latérale (visible uniquement pour `cpi-admin`).

## Gestion des Gateways

### Liste des Gateways

Consultez toutes les instances de gateway enregistrées avec leur statut :

| Colonne | Description |
|---------|-------------|
| Nom | Nom d'affichage du gateway |
| Type | `stoa`, `kong`, `gravitee`, `webmethods` |
| Statut | `online`, `offline`, `degraded` |
| APIs synchronisées | Nombre d'APIs déployées sur ce gateway |
| Dernier contrôle de santé | Horodatage du dernier contrôle réussi |

### Enregistrement de Gateway

Enregistrez une nouvelle instance de gateway :

1. Accédez à **Gateways** dans la barre latérale
2. Cliquez sur **Enregistrer un Gateway**
3. Sélectionnez le type de gateway
4. Saisissez l'URL de base et les credentials administrateur
5. Cliquez sur **Tester la Connexion** pour vérifier
6. Cliquez sur **Enregistrer**

Le gateway apparaît dans la liste après un contrôle de santé réussi.

### Modes de Gateway

Pour les instances STOA Gateway, consultez et gérez le mode actif :

- **Edge MCP** — Mode production avec prise en charge complète du protocole MCP
- **Sidecar** — Application des politiques aux côtés des gateways existants
- **Proxy** — Transformation et routage d'API
- **Shadow** — Observation du trafic pour la découverte d'API

Voir [Modes de Gateway](/docs/guides/gateway-modes) pour les détails de configuration.

## Instantanés d'Erreurs

Capturez et analysez les erreurs d'API pour le débogage.

### Ce qui est Capturé

Lorsqu'une API renvoie une erreur (4xx ou 5xx), la Console peut capturer :

- Méthode, chemin et en-têtes de la requête
- Code de statut et corps de la réponse
- Temps de réponse en amont
- Contexte du tenant et de l'API

### Consulter les Instantanés

1. Accédez à **Instantanés d'Erreurs** dans la barre latérale
2. Filtrez par API, code de statut ou plage temporelle
3. Cliquez sur un instantané pour voir les détails complets requête/réponse

### Rétention

Les instantanés d'erreurs sont conservés 7 jours par défaut. Ajustez la rétention dans la configuration de la plateforme.

## Découverte d'API (Mode Shadow)

Lorsqu'un STOA Gateway fonctionne en mode Shadow, il observe passivement le trafic API et découvre les endpoints non documentés.

### Audit de Découverte

La page **Découverte Shadow** affiche :

- Les endpoints découverts qui ne sont pas encore dans le catalogue d'API
- Les patterns de trafic (méthode, chemin, fréquence)
- Les fragments OpenAPI suggérés basés sur les payloads observés
- Les recommandations pour ajouter des endpoints au catalogue

Cela est utile pour les environnements brownfield où les APIs existantes manquent de documentation.

## Explorateur de Requêtes

Inspectez les requêtes API individuelles pour le débogage :

1. Accédez à **Explorateur de Requêtes** dans la barre latérale
2. Sélectionnez une API et une plage temporelle
3. Parcourez les paires requête/réponse
4. Filtrez par code de statut, latence ou consommateur

Disponible pour les rôles `cpi-admin` et `tenant-admin`.

## Tableau de Bord Observabilité

La Console intègre des tableaux de bord Grafana pour une surveillance approfondie :

- Cliquez sur **Observabilité** dans la barre latérale
- Accédez aux tableaux de bord STOA pré-construits (taux de requêtes, histogrammes de latence, répartitions d'erreurs)
- Nécessite l'intégration OIDC Grafana avec Keycloak (voir [Surveillance](/docs/admin/monitoring))

## Gestion des Webhooks

Gérez les endpoints webhook pour les intégrations pilotées par les événements entre STOA et les systèmes externes.

### Créer un Webhook

1. Accédez à **Webhooks** dans la barre latérale de la Console
2. Cliquez sur **Créer un Webhook**
3. Saisissez l'URL cible (HTTPS requis en production)
4. Sélectionnez les types d'événements auxquels vous abonner
5. Saisissez un secret de signature (minimum 32 caractères)
6. Cliquez sur **Enregistrer**

### Historique de Livraison

Consultez le statut de livraison de chaque événement webhook :

| Statut | Badge | Signification |
|--------|-------|---------------|
| `success` | Vert | L'endpoint a retourné 2xx |
| `pending` | Jaune | Livraison en cours ou nouvelle tentative planifiée |
| `failed` | Rouge | Toutes les tentatives épuisées |

Cliquez sur une livraison pour voir les détails complets requête/réponse, y compris les en-têtes et le corps.

### Tests et Nouvelles Tentatives

- Cliquez sur **Tester** sur n'importe quel webhook pour envoyer un événement synthétique (le payload inclut `"test": true`)
- Cliquez sur **Réessayer** sur une livraison échouée pour la renvoyer immédiatement

Voir [Webhooks](/docs/guides/webhooks) pour la référence API webhook et les exemples de vérification de signature.

## Correspondances de Credentials

Associez les credentials des consommateurs aux schémas d'authentification backend. Cela permet au gateway de traduire les clés API des consommateurs en authentification spécifique au backend sans exposer les credentials internes.

### Types d'Auth Pris en Charge

| Type | Cas d'Usage |
|------|-------------|
| `api_key` | Le backend attend une clé API dans l'en-tête ou le paramètre de requête |
| `bearer` | Le backend attend un token Bearer |
| `basic` | Le backend attend une auth Basic (nom d'utilisateur:mot de passe) |

### Créer une Correspondance

1. Accédez à **Credentials** dans la barre latérale de la Console
2. Cliquez sur **Créer une Correspondance**
3. Sélectionnez le type d'auth
4. Configurez la source (credential du consommateur) et la cible (credential backend)
5. Cliquez sur **Enregistrer**

### Gérer les Correspondances

- **Modifier** : Mettre à jour les credentials cibles lorsque le backend fait tourner ses clés
- **Supprimer** : Supprimer la correspondance (les consommateurs perdent l'accès au backend)
- **Tester** : Vérifier que la correspondance fonctionne avec une requête à blanc

## Gestion des Contrats / UAC

Les Contrats API Universels (UAC) définissent des liaisons API multi-protocoles — la base de l'approche "Définir une fois, exposer partout" de STOA.

### Liste des Contrats

Consultez tous les contrats avec leurs liaisons de protocoles et leur statut :

| Colonne | Description |
|---------|-------------|
| Nom | Nom d'affichage du contrat |
| Protocoles | Liaisons actives (REST, MCP, GraphQL, gRPC, Kafka) |
| Statut | Brouillon, Publié, Déprécié |
| APIs liées | Nombre d'APIs utilisant ce contrat |

### Créer un Contrat

1. Accédez à **Contrats** dans la barre latérale de la Console
2. Cliquez sur **Créer un Contrat**
3. Saisissez le nom, la description et la version
4. Ajoutez des liaisons de protocoles :
   - **REST** : URL ou téléchargement de spec OpenAPI
   - **MCP** : Définitions d'outils et capacités
   - **GraphQL** : Définition de schéma
   - **gRPC** : Téléchargement de fichier Proto
   - **Kafka** : Configuration du topic et du registre de schémas
5. Cliquez sur **Enregistrer comme Brouillon** ou **Publier**

### Détail du Contrat

Consultez et gérez un contrat individuel :

- **Liaisons** : Ajouter, modifier ou supprimer des liaisons de protocoles
- **Historique** : Historique des versions avec visualisateur de diff
- **Consommateurs** : APIs et abonnements utilisant ce contrat

Voir [Concepts UAC](/docs/concepts/uac) pour la justification architecturale.

## Visibilité RBAC

| Fonctionnalité | cpi-admin | tenant-admin | devops | viewer |
|----------------|-----------|-------------|--------|--------|
| Tableau de Bord Tenant | Tous les tenants | Tenant propre | Tenant propre | Tenant propre |
| Tableau de Bord Opérations | Oui | Non | Non | Non |
| Gestion des Gateways | Oui | Non | Non | Non |
| Webhooks | Tous les tenants | Tenant propre | Non | Non |
| Correspondances de Credentials | Tous les tenants | Tenant propre | Non | Non |
| Contrats / UAC | Tous les tenants | Tenant propre | Tenant propre (lecture) | Tenant propre (lecture) |
| Instantanés d'Erreurs | Tous les tenants | Tenant propre | Tenant propre | Tenant propre (lecture) |
| Explorateur de Requêtes | Tous les tenants | Tenant propre | Tenant propre | Non |

## Liens Utiles

- [Guide de la Console](/docs/guides/console) -- Utilisation basique de la Console
- [Modes de Gateway](/docs/guides/gateway-modes) -- Configuration des modes
- [Surveillance](/docs/admin/monitoring) -- Configuration Prometheus et Grafana
- [Configuration Multi-Gateway](/docs/guides/multi-gateway-setup) -- Orchestration des adaptateurs
