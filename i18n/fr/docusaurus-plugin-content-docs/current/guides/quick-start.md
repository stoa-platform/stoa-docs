---
title: "Démarrage local R1"
description: "Découvrez STOA localement avec sa passerelle et son plan de contrôle."
sidebar_position: 1
slug: /guides/quickstart
---

# Démarrage local R1

:::info En cours de validation
Ce parcours a été vérifié par lecture des sources. Son exécution réelle sur un clone vierge n’a pas été attestée ; disponibilité des images et résultat restent à confirmer.
:::

Découvrez STOA avec sa passerelle et son plan de contrôle. La passerelle de ce parcours est en Rust. [Envoy est la cible décidée](/docs/architecture/adr/adr-073-adopt-envoy-data-plane/), avec une migration à venir.

## Prérequis

- Git, Docker Engine et Docker Compose ; minimum Compose déclaré : **2.1.1**, à confirmer par exécution.
- Bash, `curl`, `openssl` et GNU `timeout` pour les commandes ci-dessous.
- Pour macOS, consulter les alternatives de supervision du README de `quickstart/` avant de démarrer.
- Accès aux dépendances publiques pour télécharger les images, paquets et dépendances de compilation.
- Image du plan de contrôle limitée à `linux/amd64` ; une autre architecture peut nécessiter une émulation.

Minimum Docker Engine et ressources CPU, mémoire et disque : **[À COMPLÉTER : prérequis mesurés sur un clone vierge]**. Aucune durée de démarrage n’est garantie. Ne lancez pas simultanément un autre parcours avec les mêmes ports.

## Cloner et démarrer

```bash
git clone https://github.com/stoa-platform/stoa.git
cd stoa/quickstart
timeout 300 docker compose up --wait
./verify.sh
```

La valeur `300` est la borne de démarrage déclarée, pas une promesse de délai. Aucun fichier d’environnement à copier, profil Compose ou commande Make n’est requis par ce parcours. Les paramètres factices de démonstration sont définis dans le Compose ; ne les réutilisez pas pour un déploiement réel.

## Ce que le scénario vérifie

Le Compose contient PostgreSQL, Keycloak, le plan de contrôle, la passerelle Rust construite localement et un backend fictif. Il ne fournit ni Console, ni Portal, ni broker.

Le script initialise Keycloak et déclare un contrat directement via `POST /admin/contracts`. Résultats attendus, **non observés ici** : déclaration acceptée (`200` ou `201`), refus sans jeton (`401`), refus avec jeton invalide (`401`), succès avec jeton Keycloak (`200`), puis marqueur `VERIFY_OK`. Aucun contenu métier précis n’est garanti.

La santé du plan de contrôle ne démontre ni publication d’API par celui-ci, ni base migrée et exploitable. Le script ne valide pas un parcours MCP ou une interface navigateur.

## Points d’accès locaux

| Rôle | Accès depuis votre machine |
|---|---|
| Santé du plan de contrôle | `http://localhost:8000/health` |
| Santé de la passerelle | `http://localhost:8081/health` |
| Base Keycloak | `http://localhost:8080` |

L’URL canonique Keycloak du Compose est interne ; le port publié ne prouve pas un parcours d’administration dans le navigateur. Le script lit les paramètres d’administration dans les conteneurs et génère son secret d’appel ; aucune valeur sensible n’est à recopier.

## Arrêter et nettoyer

Depuis `stoa/quickstart` :

```bash
docker compose down
```

Pour supprimer également les volumes et conteneurs orphelins :

```bash
docker compose down --volumes --remove-orphans
```

Cette seconde commande supprime les données des volumes concernés. Le Compose ne déclare pas de volumes, mais les images tierces peuvent en créer. Le script écrit aussi des fichiers temporaires : inspectez ceux qu’il a créés et supprimez-les après diagnostic. **[À COMPLÉTER : liste des fichiers temporaires et procédure de retrait validée]**.

## Enregistrer votre propre API {#register-your-own-api}

Le scénario se limite à son contrat de vérification. Pour un autre contrat, étudiez le [modèle UAC](/docs/concepts/uac/) et validez séparément son authentification et sa publication.

## Parcours complémentaires

Le [guide stoactl](/docs/guides/stoactl-quickstart/) génère un autre projet et ne valide pas ce parcours. Le dépôt public [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart) reste distinct.

Pour un environnement hébergé existant, utilisez les adresses et paramètres fournis par votre administrateur (`STOA_CONSOLE_URL`, `STOA_MCP_URL`, `STOA_AUTH_URL`). Le [guide MCP](/docs/guides/mcp-developer-guide/) est complémentaire ; n’enchaînez pas ses commandes sur ce Compose en supposant une compatibilité démontrée.

## Dépannage

Vérifiez les prérequis, les ports déjà occupés et l’accès aux dépendances publiques. Une référence d’image dans le dépôt ne garantit pas sa disponibilité anonyme. Si le démarrage ou `verify.sh` échoue, conservez les diagnostics en local sans publier les paramètres sensibles.
