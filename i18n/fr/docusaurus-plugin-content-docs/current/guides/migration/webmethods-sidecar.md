---
sidebar_label: webMethods et le compagnon
title: "webMethods et le compagnon STOA"
description: "Ce que fait un compagnon STOA dans le même pod qu'une passerelle hôte, et pourquoi ce dépôt ne démontre pas d'intégration webMethods en conditions réelles."
keywords: [webMethods, sidecar, compagnon, migration, passerelle API]
---

# webMethods et le compagnon STOA

Un compagnon STOA dans le même pod peut répondre à `POST /authz` pour un hôte qui l'appelle. Ce dépôt ne démontre pas cet appel avec Software AG webMethods API Gateway. Il n'y a pas d'exécution webMethods réelle enregistrée, pas de plugin webMethods dans l'arbre, et pas de `GatewayInstance` GitOps en mode de déploiement `sidecar`.

Utilisez cette page pour écarter l'ancienne recette publiée à cette URL. Cette recette décrivait l'évaluation de politiques OPA, la validation JWT, un pipeline d'usage Kafka, une ligne de console pour un sidecar en service, et des séries Prometheus nommées `stoa_sidecar_*`. Rien de cela n'est ce que fait `POST /authz` sur le `main` actuel. Les étapes du moteur de décision sont l'identité, le tenant, une limite de débit optionnelle en mémoire, et les scopes. Le routeur `/authz` ne pose pas de scopes requis, n'évalue pas OPA et n'émet pas d'événement de métrologie Kafka. Les noms `stoa_sidecar_*` n'apparaissent pas dans les sources de la passerelle.

Le comportement, les trois motifs d'usage et la liste complète des limites sont dans [Usage du compagnon](../companion-usage.md). L'instantané est le commit public `stoa` `a97147e97edfa7c843b3c81dc14c6c039ee45908` (2026-11-05).

## Quoi utiliser pour webMethods aujourd'hui

[`stoa-connect`](../stoa-connect-quickstart.md) est le chemin GitOps. L'agent Go parle à l'API d'administration webMethods et au plan de contrôle. Il n'est pas sur le chemin de requête client. La passerelle tierce applique l'état souhaité poussé par l'agent. Les adaptateurs webMethods, Kong, Gravitee et Envoy vivent sous `stoa-go/internal/connect/adapters/`.

Un processus STOA avec `STOA_GATEWAY_MODE=sidecar` qui vise une passerelle webMethods distante est classé `connect` / `remote-agent`, pas un compagnon de même pod.

## Ce que le chart rend

`charts/stoa-platform/templates/stoa-sidecar-deployment.yaml` rend un pod à deux conteneurs quand `stoaSidecar.enabled=true` et `stoaSidecar.mainGateway.enabled=true`. `stoaSidecar.enabled` vaut `false` par défaut. Le template pose :

- `STOA_GATEWAY_MODE=sidecar` et `STOA_PORT=8081` sur `stoa-sidecar`
- `EXT_AUTHZ_URL=http://localhost:8081/authz` sur le conteneur cible
- `STOA_HOST=127.0.0.1`

Le binaire se lie à `0.0.0.0` et au port. `STOA_HOST` n'est pas l'adresse d'écoute, donc le commentaire du chart qui présente le port comme limité à localhost ne correspond pas au processus. Le Service principal de la passerelle ne publie pas le port `8081`. Avec le défaut du chart `stoaSidecar.serviceMonitor.enabled=true`, un Service ClusterIP distinct publie `8081`, et ce listener sert aussi `/authz`.

`stoaSidecar.image` est l'image publiée `ghcr.io/stoa-platform/stoa-gateway`, épinglée par digest. Le job CI qui construit un profil plus léger (`FEATURES=` et `NO_DEFAULT_FEATURES=true`) ne pousse pas cette image, et le chart ne la référence pas.

Le template lit la clé d'API dans la clé de secret `STOA_CONTROL_PLANE_API_KEY`, avec `optional: true`. Un secret qui ne contient que `control-plane-api-key` ne renseigne pas la variable, et le pod démarre quand même. Le chart injecte aussi les réglages Keycloak et `STOA_POLICY_ENABLED`. Ces valeurs ne font pas valider de jeton à `/authz`.

Fournissez votre propre dépôt et digest d'image webMethods si vous rendez un conteneur cible. Ce site ne publie pas de nom d'image webMethods, de tag, ni de secret d'extraction. Le dépôt ne montre pas que webMethods honore `EXT_AUTHZ_URL` ou `apigw_ext_authz_*`. L'hôte doit envoyer le corps JSON documenté dans [Usage du compagnon](../companion-usage.md). Transmettre la requête d'origine telle quelle ne correspond pas à `POST /authz`.

## Voir aussi

- [Usage du compagnon](../companion-usage.md)
- [Connecter une passerelle tierce avec stoa-connect](../stoa-connect-quickstart.md)
- [Auto-enregistrement de passerelle](../gateway-auto-registration.md)
- [Guide de migration webMethods](./ibm-webmethods.md)
