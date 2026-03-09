---
sidebar_position: 2
title: "STOA Console : Tableau de Bord Administrateur Multi-Tenant"
description: "Gérez les tenants, les APIs, les utilisateurs et les gateways depuis l'interface d'administration STOA Console — RBAC multi-tenant, observabilité et gestion du cycle de vie"
keywords: [STOA, console, admin, API management, tenant management, guide, tutorial]
---

# Console

La Console est l'interface **fournisseur d'API et administrateur**. Les administrateurs de plateforme et les gestionnaires de tenants l'utilisent pour contrôler l'intégralité du cycle de vie des APIs.

:::info Gouvernance (ADR-055)
La Console suit le **modèle Stripe** : Console = Fournisseur + Admin (Créer & Gérer). Les fonctionnalités consommateur (découverte d'API, abonnements, tests) se trouvent sur le [Portail](/docs/guides/portal).
:::

**URL** : [console.gostoa.dev](https://console.gostoa.dev)

## Démarrage Rapide

1. Accédez à l'URL de la Console
2. Connectez-vous via Keycloak (client OIDC : `control-plane-ui`)
3. Le tableau de bord affiche un aperçu de vos tenants et APIs

## Tableau de Bord

Le tableau de bord de la Console fournit :

- **Résumé des tenants** : Nombre de tenants, APIs actives, abonnements
- **Activité récente** : Dernières publications d'API, demandes d'abonnement
- **État de santé** : Vérifications de santé des composants de la plateforme

## Gestion des Tenants

### Créer un Tenant

1. Accédez à **Tenants → Créer un Tenant**
2. Saisissez :
   - **Nom** : Identifiant unique (minuscules, tirets autorisés)
   - **Nom d'Affichage** : Libellé lisible
   - **Email de Contact** : Email de l'administrateur du tenant
3. Cliquez sur **Créer**

Cela provisionne :
- Un namespace Kubernetes `tenant-{nom}`
- Un dépôt GitLab pour la configuration du tenant
- Un groupe Keycloak pour le RBAC du tenant

### Paramètres du Tenant

- **Membres** : Ajouter/supprimer des utilisateurs, attribuer des rôles
- **Quotas** : Définir les limites d'API et d'abonnement
- **Politiques** : Politiques par défaut appliquées à toutes les APIs du tenant

### Sélecteur de Tenant

Si vous avez accès à plusieurs tenants, utilisez le **sélecteur de tenant** dans la navigation supérieure pour changer de contexte. Seules les ressources appartenant au tenant sélectionné sont affichées.

## Gestion des APIs

### Publier une API

1. Accédez à **APIs → Créer une API**
2. Remplissez :
   - **Nom** et **Version**
   - **Description**
   - **Spécification OpenAPI** (téléchargement ou URL)
3. Configurez les politiques
4. Cliquez sur **Publier**

L'API apparaîtra dans le Portail Développeur et sera synchronisée avec le gateway.

### Actions du Cycle de Vie des APIs

| Action | Effet |
|--------|-------|
| **Publier** | Rendre l'API active et découvrable |
| **Déprécier** | Marquer comme dépréciée (toujours fonctionnelle) |
| **Retirer** | Désactiver l'API, arrêter le trafic |
| **Supprimer** | Supprimer l'API et tous les abonnements |

### Surveiller les APIs

Consultez les métriques par API :

- Nombre de requêtes et taux d'erreur
- Percentiles de latence (p50, p95, p99)
- Abonnements actifs et consommateurs
- État de synchronisation du gateway

## Gestion des Abonnements

### Examiner les Demandes

1. Accédez à **Abonnements → En Attente**
2. Examinez les détails de l'application du consommateur
3. Cliquez sur **Approuver** ou **Rejeter**

### Gérer les Abonnements Actifs

- **Suspendre** : Désactiver temporairement l'accès
- **Révoquer** : Mettre fin définitivement à l'abonnement
- **Consulter l'utilisation** : Nombre de requêtes et utilisation de la limite de débit

## Gestion des Utilisateurs

Gérée via l'intégration Keycloak :

| Rôle | Ce qu'il peut faire |
|------|---------------------|
| `cpi-admin` | Tout — tous les tenants, toutes les opérations |
| `tenant-admin` | Accès complet au sein de son tenant |
| `devops` | Déployer et promouvoir des APIs |
| `viewer` | Accès en lecture seule |

### Ajouter un Utilisateur

1. Accédez à **Utilisateurs → Inviter**
2. Saisissez l'adresse email
3. Sélectionnez le tenant et le rôle
4. L'utilisateur reçoit une invitation via Keycloak

## Webhooks

Gérez les endpoints webhook pour les intégrations pilotées par les événements.

1. Accédez à **Webhooks** dans la barre latérale
2. Cliquez sur **Créer un Webhook**
3. Saisissez l'URL cible, sélectionnez les types d'événements et définissez un secret de signature
4. Utilisez **Tester** pour envoyer un événement synthétique et vérifier la livraison

Consultez l'historique de livraison, réessayez les livraisons échouées et inspectez les détails requête/réponse.

Voir [Fonctionnalités Avancées de la Console](/docs/guides/console-advanced#gestion-des-webhooks) pour la configuration détaillée des webhooks.

## Correspondances de Credentials

Associez les credentials des consommateurs aux schémas d'authentification backend.

1. Accédez à **Credentials** dans la barre latérale
2. Cliquez sur **Créer une Correspondance**
3. Sélectionnez le type d'auth (`api_key`, `bearer`, ou `basic`)
4. Configurez la source (credential du consommateur) et la cible (credential backend)

Les correspondances de credentials permettent au gateway de traduire les clés API des consommateurs en authentification spécifique au backend.

## Contrats / UAC

Gérez les Contrats API Universels qui définissent des liaisons API multi-protocoles.

1. Accédez à **Contrats** dans la barre latérale
2. Cliquez sur **Créer un Contrat** pour définir un nouveau contrat API
3. Ajoutez des liaisons de protocoles (REST, MCP, GraphQL, gRPC, Kafka)
4. Publiez le contrat pour le rendre disponible aux consommateurs

Les contrats sont la base de l'approche "Définir une fois, exposer partout" de STOA. Voir [Concepts UAC](/docs/concepts/uac) pour plus de détails.

## Adaptateurs de Gateway

La Console affiche l'état de synchronisation entre STOA et les gateways API cibles :

| Statut | Signification |
|--------|---------------|
| **Synchronisé** | L'API est active sur le gateway |
| **En attente** | Synchronisation en cours |
| **Erreur** | Échec de la synchronisation — vérifiez les logs |
| **Dérive** | L'état du gateway diffère de l'état souhaité |

La réconciliation de l'Adaptateur de Gateway peut être déclenchée manuellement depuis la Console ou automatiquement via ArgoCD.
