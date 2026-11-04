---
sidebar_position: 1
slug: /guides/quickstart
title: "Démarrage rapide : lancer STOA localement"
description: "Préparez la stack STOA locale avec Docker Compose et configurez les identifiants requis."
---

# Démarrage rapide : lancer STOA localement

**iPaaS souverain, plateforme d'API et d'intégration**

Ce parcours d'évaluation locale utilise le [dépôt principal stoa](https://github.com/stoa-platform/stoa/tree/main/deploy/docker-compose). Il comprend la Console, le portail développeur, l'API, la passerelle, le service d'identité et les dépendances d'observabilité. L'offre hébergée est **disponible sur demande** auprès de [notre équipe](mailto:sales@gostoa.dev).

:::info Périmètre de validation
La configuration Compose a été validée statiquement avec `docker compose config --quiet`. Aucun conteneur n'a été démarré. Le démarrage, la connexion, l'initialisation des données et un premier appel API restent à vérifier en exécution ; aucun délai de démarrage n'est annoncé.
:::

## Prérequis

- Git, Docker et Docker Compose v2.
- Un environnement Docker local dédié, avec des ressources suffisantes pour la stack complète.
- Des ports disponibles et aucun conteneur existant portant les noms déclarés dans Compose. Un nom de projet ne suffit pas à isoler les noms fixes des conteneurs. Résolvez les conflits avant le démarrage, sans arrêter ni recréer une autre installation.

## 1. Préparer la configuration

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env
```

Modifiez `.env` localement avant de continuer. Remplacez les identifiants fournis par les vôtres ; ne publiez pas ce fichier et ne le commitez pas. Compose exige les variables suivantes, y compris pour les services d'initialisation OpenSearch :

| Variable | Rôle |
| --- | --- |
| `POSTGRES_PASSWORD` | Authentification PostgreSQL. |
| `KEYCLOAK_ADMIN_PASSWORD` | Administration Keycloak. |
| `OPENSEARCH_ADMIN_PASSWORD` | Administration et initialisation de la sécurité OpenSearch. |
| `OPENSEARCH_DASHBOARDS_PASSWORD` | Compte de service OpenSearch Dashboards. |
| `OPENSEARCH_LOGWRITER_PASSWORD` | Compte d'ingestion OpenSearch. |
| `OPENSEARCH_OIDC_CLIENT_SECRET` | Client d'identité OpenSearch Dashboards. |

Configurez aussi `GRAFANA_PASSWORD` et `GRAFANA_OIDC_CLIENT_SECRET` pour l'accès à Grafana. Configurez `OPENSEARCH_PASSWORD` de manière cohérente avec `OPENSEARCH_ADMIN_PASSWORD` pour l'accès de l'API à OpenSearch. Configurez `GATEWAY_ADMIN_TOKEN` et `GATEWAY_API_KEY` de manière cohérente pour l'administration de la passerelle. Les profils d'identité optionnels nécessitent leurs propres identifiants et sortent du périmètre de ce guide.

Validez sans démarrer les services :

```bash
docker compose -p stoa-local-check -f docker-compose.yml config --quiet
```

Si une erreur nomme une variable, configurez-la avant de poursuivre. Ce contrôle valide seulement la configuration, pas la disponibilité des images, des ports ni l'état des applications.

## 2. Démarrer la stack locale

Après résolution des conflits locaux, démarrez cet ensemble explicite de services et ses dépendances :

```bash
docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo
```

Cette sélection comprend la stack applicative et ses dépendances d'observabilité, sans démarrer Promtail ni les services optionnels de fédération. Ne la remplacez pas par une commande de démarrage global sans liste de services. Le dépôt séparé `stoa-quickstart` n'est pas un autre parcours dans ce guide.

## 3. Vérifier les accès locaux

Ouvrez le proxy local dans votre navigateur : la Console utilise `/`, le portail développeur `/portal`, la documentation API `/api/docs`, l'administration d'identité `/auth`, Grafana `/grafana` et la santé de la passerelle `/gateway/health`. Utilisez le port hôte configuré par `PORT_PROXY`.

L'initialisation des données de démonstration n'a pas encore été vérifiée pour ce parcours local et reste à venir.

## Enregistrer votre propre API {#register-your-own-api}

Une fois la connexion fonctionnelle, utilisez **Backend APIs** dans la Console pour enregistrer votre backend. Consultez [MCP pour développeurs](/docs/guides/mcp-developer-guide) pour l'accès des agents et le [cycle de vie des abonnements](/docs/guides/subscriptions-lifecycle) pour les abonnements.

## Dépannage

| Problème | Action |
| --- | --- |
| Échec de validation de la configuration | Vérifiez la variable nommée par Compose dans votre `.env` local. |
| Conflit de port ou de nom de conteneur | Utilisez un environnement dédié ; préservez les installations existantes. |
| Service indisponible après validation | Vérifiez son état localement ; la validation statique ne prouve pas son bon fonctionnement. |

## Voir aussi

- [Déploiement hybride](/docs/deployment/hybrid)
- [MCP pour développeurs](/docs/guides/mcp-developer-guide)
