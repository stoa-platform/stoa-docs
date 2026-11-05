---
sidebar_position: 1
slug: /guides/quickstart
title: "Démarrage rapide : lancer STOA localement"
description: "Préparez la stack STOA locale avec Docker Compose, renseignez chaque variable obligatoire par son nom, validez la configuration statiquement et démarrez les services sélectionnés."
---

# Démarrage rapide : lancer STOA localement

**iPaaS souverain, plateforme d'API et d'intégration**

Ce parcours est le seul parcours de démarrage de STOA. Il utilise la stack Docker Compose du [dépôt principal stoa](https://github.com/stoa-platform/stoa/tree/main/deploy/docker-compose) et comprend la Console, le portail développeur, l'API du plan de contrôle, la passerelle, Keycloak et les services d'observabilité (Prometheus, Grafana, Loki, Tempo, OpenSearch). L'offre hébergée est **disponible sur demande** auprès de [notre équipe](mailto:sales@gostoa.dev).

:::info Périmètre de validation
La configuration Compose de la branche `main` actuelle a été validée statiquement avec `docker compose config --quiet`, toutes les variables listées ci-dessous étant renseignées. Aucun conteneur n'a été démarré. Le démarrage, la connexion, l'initialisation des données de démonstration et un premier appel API restent à vérifier en exécution ; aucun délai de démarrage n'est annoncé.
:::

## Prérequis

- Git, Docker et Docker Compose v2.
- Un environnement Docker local dédié, avec au moins 8 Go de RAM alloués à Docker, comme le recommande le dépôt.
- Des ports hôte libres pour chaque variable `PORT_*` de `.env`, et aucun conteneur existant portant les noms fixes `stoa-*` déclarés dans le fichier Compose. Un nom de projet ne suffit pas à isoler les noms fixes des conteneurs. Résolvez les conflits avant le démarrage, sans arrêter ni recréer une autre installation.
- Du temps et de l'espace disque pour le premier démarrage : les images de l'API du plan de contrôle, de la Console et de la passerelle sont construites depuis les sources (la passerelle est une compilation Rust).

## 1. Préparer la configuration

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env
```

Modifiez `.env` localement avant de continuer. Chaque variable ci-dessous est obligatoire pour Compose : elle est déclarée sans valeur dans `.env.example`, et Compose refuse d'interpoler la configuration tant que l'une d'elles est vide. Donnez votre propre valeur à chacune ; ne copiez aucune valeur d'exemple, et ne publiez pas ce fichier, ne le commitez pas. `OPENSEARCH_PASSWORD` est **absente** de `.env.example` : ajoutez la ligne vous-même.

| Variable | Utilisée par | Rôle |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL, migrations, API, Keycloak | Authentification de la base de données. |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak, API | Administrateur Keycloak, dont le nom est défini par `KEYCLOAK_ADMIN`. |
| `GATEWAY_API_KEY` | API, passerelle | Clé partagée entre le plan de contrôle et la passerelle. |
| `GRAFANA_PASSWORD` | Grafana | Administrateur Grafana, dont le nom est défini par `GRAFANA_USER`. |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak, API | Client du plan de contrôle dans le realm applicatif. |
| `MCP_KEYCLOAK_CLIENT_SECRET` | Keycloak | Client de la passerelle MCP. |
| `IDENTITY_GOVERNANCE_CLIENT_SECRET` | Keycloak | Client de gouvernance des identités. |
| `E2E_DPOP_CLIENT_SECRET` | Keycloak, générateur de trafic | Client de test DPoP. |
| `OAUTH2_PROXY_CLIENT_SECRET` | Keycloak | Client OIDC d'observabilité, utilisé par le profil optionnel `monitoring-oidc`. |
| `OPENSEARCH_OIDC_CLIENT_SECRET` | Keycloak, OpenSearch Dashboards | Client d'identité d'OpenSearch Dashboards. |
| `OPENSEARCH_ADMIN_PASSWORD` | OpenSearch, initialisation de la sécurité, API, Grafana | Administration et initialisation de la sécurité OpenSearch. |
| `OPENSEARCH_DASHBOARDS_PASSWORD` | OpenSearch Dashboards, initialisation de la sécurité | Compte de service des Dashboards. |
| `OPENSEARCH_LOGWRITER_PASSWORD` | Initialisation de la sécurité | Compte d'ingestion des journaux. |
| `OPENSEARCH_PASSWORD` | Data Prepper | Ingestion des traces dans OpenSearch. Avec la valeur par défaut d'`OPENSEARCH_USER`, utilisez la même valeur qu'`OPENSEARCH_ADMIN_PASSWORD`. |
| `LDAP_ADMIN_PASSWORD` | Keycloak, OpenLDAP (profil `federation`) | Administrateur LDAP référencé par l'import des realms de fédération. |
| `FEDERATION_ALPHA_BROKER_SECRET` | Keycloak | Courtier d'identité entre les realms de démonstration de la fédération. |
| `FEDERATION_DEMO_CLIENT_SECRET` | Keycloak | Client de démonstration de la fédération. |
| `DEMO_DEMO_ORG_ALPHA_DEMO_ALPHA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |
| `DEMO_DEMO_ORG_BETA_DEMO_BETA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |
| `DEMO_IDP_SOURCE_ALPHA_ALICE_ALPHA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |
| `DEMO_IDP_SOURCE_ALPHA_BOB_ALPHA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |
| `DEMO_IDP_SOURCE_BETA_CAROL_BETA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |
| `DEMO_IDP_SOURCE_BETA_DAVE_BETA_PASSWORD` | Keycloak | Utilisateur de démonstration d'un realm de fédération. |

Keycloak importe les realms de démonstration de la fédération à chaque démarrage : c'est pourquoi leurs variables sont obligatoires même sans activer le profil `federation`.

Recommandées également, bien que la validation passe sans elles : `GRAFANA_OIDC_CLIENT_SECRET` pour la connexion à Grafana via Keycloak, et `OAUTH2_PROXY_COOKIE_SECRET` pour le profil optionnel `monitoring-oidc`. `GATEWAY_ADMIN_TOKEN` peut être défini dans `.env` pour l'administration de la passerelle ; le fichier Compose fournit une valeur par défaut.

Validez sans démarrer les services :

```bash
docker compose -p stoa-local-check -f docker-compose.yml config --quiet
```

Une sortie silencieuse avec le code 0 signifie que la configuration s'interpole. Une erreur nommant une variable signifie que cette variable est encore absente ou vide dans `.env`. Ce contrôle valide seulement la configuration, pas la disponibilité des images, des ports ni l'état des applications.

## 2. Démarrer les services sélectionnés

Après résolution des conflits locaux, démarrez cet ensemble explicite de services :

```bash
docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo
```

Par leurs dépendances déclarées, ces cinq entrées démarrent 19 services : la stack applicative (PostgreSQL, Redpanda, Keycloak, la tâche de migration de la base, l'API du plan de contrôle, la Console, le portail, la passerelle et le proxy inverse nginx), OpenSearch avec ses tâches d'initialisation de la sécurité et des index, Prometheus, Grafana, Loki, Tempo et Data Prepper. La sélection laisse de côté Promtail, qui monte la socket Docker et lit les journaux de tous les conteneurs de la machine, ainsi que les passerelles de démonstration, le générateur de trafic et Alertmanager. Ne la remplacez pas par un `docker compose up -d` sans liste de services. Le dépôt séparé `stoa-quickstart` n'est pas un autre parcours dans ce guide.

Suivez le démarrage avec `docker compose ps -a` jusqu'à ce que les services permanents indiquent `healthy` et que les tâches ponctuelles (`db-migrate`, `redpanda-init`, `opensearch-security-init`, `opensearch-init`) se soient terminées avec le code 0. Le script du dépôt `scripts/demo/check-health.sh --wait` attend Promtail et Alertmanager et ne se termine donc jamais avec cette sélection.

## 3. Créer le premier administrateur et se connecter

Ouvrez le proxy inverse sur le port hôte défini par `PORT_PROXY` : la Console est sur `/`, le portail développeur sur `/portal`, la documentation de l'API sur `/api/docs`, Keycloak sur `/auth`, Grafana sur `/grafana`, OpenSearch Dashboards sur `/logs` et la santé de la passerelle sur `/gateway/health`.

Le realm applicatif importé ne contient aucun utilisateur humain, et l'inscription se fait uniquement sur invitation. Connectez-vous à la console d'administration Keycloak sur `/auth` avec le compte défini par `KEYCLOAK_ADMIN` et `KEYCLOAK_ADMIN_PASSWORD`, passez sur le realm applicatif (son nom est défini par `KEYCLOAK_REALM` dans le fichier Compose), créez un utilisateur, attribuez-lui le rôle de realm `cpi-admin` et définissez un mot de passe non temporaire. Le dépôt fournit aussi un parcours scripté, `deploy/docker-compose/scripts/first-admin.sh`, décrit dans son runbook `docs/runbooks/first-admin-bootstrap.md`. Connectez-vous ensuite à la Console avec cet utilisateur.

### Optionnel : charger les données de démonstration

Le chargement des données de démonstration utilise l'administrateur applicatif que vous venez de créer. Exportez son nom dans `ANORAK_USER` et son mot de passe dans `ANORAK_PASSWORD` dans votre shell sans les afficher, chargez `.env` dans le même shell, puis lancez le script depuis le répertoire Compose :

```bash
set -a
. ./.env
set +a
../../scripts/demo/seed-all.sh --skip-traffic
```

Le script a besoin de Python avec le paquet `httpx` sur la machine hôte. Cette étape n'a pas été vérifiée en exécution pour ce parcours.

## Enregistrer votre propre API {#register-your-own-api}

Une fois la connexion fonctionnelle, utilisez **Backend APIs** dans la Console pour enregistrer votre backend. Consultez [MCP pour développeurs](/docs/guides/mcp-developer-guide) pour l'accès des agents et le [cycle de vie des abonnements](/docs/guides/subscriptions-lifecycle) pour les abonnements.

## Dépannage

| Problème | Action |
| --- | --- |
| Échec de validation de la configuration | Renseignez la variable nommée par Compose dans votre `.env` local ; rappelez-vous qu'`OPENSEARCH_PASSWORD` doit être ajoutée à la main. |
| Conflit de port ou de nom de conteneur | Utilisez un environnement dédié ; préservez les installations existantes. |
| Le script de santé ne se termine jamais | `check-health.sh --wait` attend Promtail et Alertmanager, que cette sélection ne démarre pas ; utilisez plutôt `docker compose ps -a`. |
| Échec de connexion après le démarrage | Vérifiez l'utilisateur, son rôle `cpi-admin` et son mot de passe non temporaire dans le realm applicatif. |
| Service indisponible après validation | Vérifiez son état localement ; la validation statique ne prouve pas son bon fonctionnement. |

## Voir aussi

- [Déploiement hybride](/docs/deployment/hybrid)
- [MCP pour développeurs](/docs/guides/mcp-developer-guide)
