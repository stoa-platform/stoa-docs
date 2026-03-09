---
sidebar_position: 21
title: "Fonctionnalités Avancées du Portail"
description: "Fonctionnalités avancées du Portail — sandbox de test d'API, gestion des webhooks, comptes de service, analytiques d'utilisation et paramètres de l'espace de travail."
keywords:
  - developer portal
  - API testing
  - sandbox
  - usage analytics
  - workspace
---

# Fonctionnalités Avancées du Portail

Au-delà de la découverte d'API et des abonnements, le Portail Développeur fournit des outils pour les tests, l'automatisation et le suivi de l'utilisation.

## Sandbox de Test d'API

Testez les endpoints d'API directement depuis le Portail sans outils externes.

### Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| Sélecteur de méthode | GET, POST, PUT, PATCH, DELETE |
| Constructeur de chemin | Auto-complétion depuis la spec API |
| Éditeur d'en-têtes | Ajouter des en-têtes personnalisés |
| Éditeur de corps | Éditeur JSON avec coloration syntaxique |
| Injection d'auth | Token Bearer ou clé API automatique |
| Visualiseur de réponse | Statut, latence, JSON/texte formaté |
| Historique des requêtes | Requêtes récentes pour une réexécution rapide |

### Utiliser le Sandbox

1. Accédez à une page de détail d'API
2. Cliquez sur **Essayer** ou **Sandbox**
3. Sélectionnez la méthode HTTP et le chemin
4. Ajoutez des en-têtes ou un corps si nécessaire
5. Choisissez l'environnement (dev, staging, production)
6. Cliquez sur **Envoyer**

### Sélection de l'Environnement

Le sandbox prend en charge plusieurs environnements :

| Environnement | URL de Base | Cas d'Usage |
|---------------|-------------|-------------|
| Développement | Configurée par API | Tests locaux |
| Staging | URL du gateway de staging | Validation pré-production |
| Production | URL du gateway de production | Vérification en direct |

Changez d'environnement via la liste déroulante en haut du sandbox.

### Authentification

Le sandbox injecte automatiquement les credentials basés sur votre abonnement :

- **Token Bearer** : Utilise votre token de session actuel
- **Clé API** : Utilise la clé de votre abonnement actif

:::tip Gestion des Webhooks
La gestion des webhooks a été déplacée vers la **Console**. Voir [Fonctionnalités Avancées de la Console](/docs/guides/console-advanced#gestion-des-webhooks).
:::

## Gestion des Comptes de Service

Créez et gérez des comptes de service pour l'accès API machine à machine (M2M).

### Créer un Compte de Service

1. Accédez à **Comptes de Service** dans la barre latérale du Portail
2. Cliquez sur **Créer un Compte de Service**
3. Saisissez un nom et une description optionnelle
4. Cliquez sur **Créer**
5. **Copiez les credentials immédiatement** — le secret n'est affiché qu'une seule fois

### Actions Disponibles

| Action | Description |
|--------|-------------|
| Créer | Générer un nouveau client_id + client_secret |
| Supprimer | Supprimer le compte et invalider tous les tokens |
| Régénérer le secret | Nouveau secret, l'ancien est invalidé immédiatement |

Les comptes de service héritent du rôle RBAC de l'utilisateur qui les a créés.

Voir [Comptes de Service](/docs/guides/service-accounts) pour les patterns d'utilisation et l'intégration CI/CD.

## Analytiques d'Utilisation

Surveillez votre consommation d'API depuis la page **Utilisation**.

### Métriques Disponibles

| Métrique | Description |
|----------|-------------|
| Total des requêtes | Requêtes cumulées sur tous les abonnements |
| Requêtes par API | Répartition par API |
| Taux d'erreur | Pourcentage de réponses 4xx/5xx |
| Distribution de latence | Percentiles de temps de réponse |
| Utilisation du quota | Utilisation actuelle vs limite de débit |

### Plages Temporelles

Sélectionnez parmi les vues 24h, 7j ou 30j pour suivre les tendances de consommation.

## Paramètres de l'Espace de Travail

Gérez votre espace de travail depuis la page **Espace de Travail** :

- **Profil** : Mettre à jour le nom d'affichage et l'email de contact
- **Notifications** : Configurer les préférences de notification par email
- **Clés API** : Consulter et gérer les clés API actives sur tous les abonnements
- **Membres de l'équipe** : Inviter des collaborateurs dans votre espace de travail (tenant-admin uniquement)

## Découverte de Serveurs MCP

Parcourez les serveurs MCP et les outils AI disponibles :

1. Accédez à **Serveurs** dans la barre latérale du Portail
2. Parcourez les serveurs MCP disponibles par catégorie
3. Consultez les détails du serveur : outils offerts, exigences d'authentification, niveau tarifaire
4. Cliquez sur **S'Abonner** pour demander l'accès aux outils d'un serveur

## Liens Utiles

- [Guide du Portail Développeur](/docs/guides/portal) -- Utilisation basique du Portail
- [Webhooks](/docs/guides/webhooks) -- Référence API webhook
- [Comptes de Service](/docs/guides/service-accounts) -- Authentification M2M
- [Abonnements](/docs/guides/subscriptions) -- Flux de gestion des abonnements
