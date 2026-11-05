---
sidebar_position: 17
title: "Usage du compagnon"
description: "Comment le compagnon STOA répond allow ou deny pour une passerelle hôte, une application ou un mesh encore au stade de conception, et les limites de cette intégration sur main."
keywords:
  - compagnon
  - sidecar
  - ext_authz
  - stoa-connect
  - passerelle tierce
---

# Usage du compagnon

STOA peut s'exécuter à côté d'une passerelle existante comme compagnon. Le même binaire Rust, démarré avec `STOA_GATEWAY_MODE=sidecar`, expose `POST /authz` et ne monte pas les routes MCP. Les décisions viennent du moteur partagé : identité, tenant, une limite de débit optionnelle par consommateur, et les scopes lorsqu'ils sont configurés sur le moteur. L'hôte conserve l'authentification, le routage et l'application du verdict. Un template Helm peut placer l'hôte et le compagnon STOA dans le même pod.

Cette page est un instantané du dépôt public [`stoa` `a97147e97edfa7c843b3c81dc14c6c039ee45908`](https://github.com/stoa-platform/stoa/commit/a97147e97edfa7c843b3c81dc14c6c039ee45908) (2026-11-05). Elle décrit ce que cette révision implémente pour les opérateurs. Elle n'est ni une déclaration de compatibilité, ni une certification, ni la preuve d'un déploiement tiers en conditions réelles.

La même révision détaille le runtime :

- [Motifs d'usage sidecar](https://github.com/stoa-platform/stoa/blob/a97147e97edfa7c843b3c81dc14c6c039ee45908/docs/integrations/sidecar-usage-patterns.md)
- [Modes de déploiement de la passerelle](https://github.com/stoa-platform/stoa/blob/a97147e97edfa7c843b3c81dc14c6c039ee45908/docs/architecture/gateway-deployment-modes.md)

## Mode d'exécution et mode de déploiement

`STOA_GATEWAY_MODE=sidecar` sélectionne le profil de routes du binaire Rust. Le mode de déploiement décrit où ce processus se place.

| | Passerelle autonome | Compagnon dans le même pod | Agent externe |
| --- | --- | --- | --- |
| Mode de déploiement | `edge` | `sidecar` | `connect` |
| Topologie | `native-edge` | `same-pod` | `remote-agent` |
| Processus | `stoa-gateway` avec `STOA_GATEWAY_MODE=edge-mcp` | `stoa-gateway` avec `STOA_GATEWAY_MODE=sidecar` | `stoa-connect` (Go), ou un lien autonome |
| Qui sert le client | STOA | La passerelle ou l'application hôte | La passerelle tierce |
| STOA sur le chemin de la requête | Passerelle complète | `POST /authz` avant que l'hôte ne transmette | Absent. L'agent synchronise l'API d'administration |

Un processus démarré en mode sidecar est un compagnon de même pod seulement si le pod contient la passerelle cible et `stoa-sidecar`, et si la cible appelle STOA sur `localhost` ou `127.0.0.1`. L'état GitOps souhaité de cette révision déclare `edge` et `connect`. Certaines instances posent un `mode: sidecar` d'exécution et restent classées `connect` (capacité `not-a-k8s-sidecar`). Aucune ne déclare le mode de déploiement `sidecar`.

## Ce que décide `POST /authz`

L'hôte envoie du JSON. `method` et `path` sont les champs exigés par l'analyseur. `user` devient le principal. Sans `user`, la décision est `401`. Sans `tenant_id`, la décision est `403`.

```json
{
  "method": "GET",
  "path": "/api/v1/orders",
  "headers": {"x-request-source": "edge"},
  "source_ip": "192.0.2.10",
  "tenant_id": "tenant-a",
  "user": {
    "id": "user-123",
    "roles": ["viewer"],
    "scopes": ["orders:read"]
  },
  "context": {}
}
```

Le moteur s'arrête au premier refus :

| Étape | Quand elle s'exécute | Refus |
| --- | --- | --- |
| Identité | Toujours | `401` si `user` est absent |
| Tenant | Toujours | `403` si `tenant_id` est absent |
| Limite de débit consommateur | `quota_enforcement_enabled=true` | `429`, clé `<tenant_id>:<user.id>` |
| Scopes | Des scopes requis sont posés sur le moteur | `403` si l'utilisateur n'en détient aucun |

En cas d'autorisation, le moteur calcule `X-User-ID`, `X-Tenant-ID`, `X-Request-ID`, et `X-User-Scopes` ou `X-User-Roles` lorsque ces listes ne sont pas vides. Le format de réponse par défaut abandonne ces en-têtes. Voir [Limites](#limites-actuelles).

`SidecarService` convertit le JSON et formate la réponse. Il n'ajoute pas un second moteur de politiques.

## Motif 1 — même pod, à côté d'une passerelle tierce

C'est la forme de compagnon que le chart peut rendre. La passerelle hôte et `stoa-sidecar` partagent un pod Kubernetes. L'hôte authentifie le client, appelle `POST /authz`, et ne transmet au backend que si la réponse est `200`.

```text
Client → passerelle hôte → POST /authz → stoa-sidecar
                │                            127.0.0.1:8081
                ← allow ou deny ─────────────┘
                └── sur 200 → backend
```

Le template `charts/stoa-platform/templates/stoa-sidecar-deployment.yaml` rend ce pod quand `stoaSidecar.enabled=true`. La valeur est `false` par défaut. Le rendu échoue si `stoaSidecar.mainGateway.enabled` n'est pas `true`. Le template pose `STOA_GATEWAY_MODE=sidecar`, `STOA_PORT=8081`, et `EXT_AUTHZ_URL=http://localhost:8081/authz` sur le conteneur cible. Le Service de la passerelle publie le port de l'hôte. Il ne publie pas `8081`.

L'hôte doit encore construire le corps JSON et appeler `/authz`. Le dépôt ne livre aucun plugin Kong, Envoy ou webMethods qui le fasse. Un exemple OpenResty optionnel (`stoaSidecar.nginxExample`, défaut `false`, `targetGateway: nginx`) montre un appel JSON après une authentification HTTP Basic. Cet exemple reste inactif tant qu'on ne l'active pas, et activer les valeurs n'est pas une exécution réelle enregistrée.

Pour webMethods, voir [webMethods et le compagnon](./migration/webmethods-sidecar.md). La synchronisation au quotidien d'une passerelle tierce est [stoa-connect](./stoa-connect-quickstart.md), décrit plus bas.

## Motif 2 — application ou appel local

Une application, ou un petit proxy devant elle, peut envoyer `POST /authz` avant de traiter la requête. L'application porte alors l'authentification, la résolution du tenant, l'application du verdict, et le choix du comportement lorsque STOA est injoignable.

```text
Client → application → POST /authz → STOA
              ← allow ou deny ────────┘
              └── sur 200 → traiter la requête
```

Ce motif est un appel vers le même endpoint. Il ne relève pas du contrat de compagnon dans le même pod : le chart refuse le rendu sans `mainGateway.enabled=true`, et les topologies sont `native-edge`, `remote-agent` et `same-pod` (une cible passerelle plus le sidecar). Laissez le type de déploiement vide plutôt que d'étiqueter ce pod `sidecar`.

`/authz` ne vérifie pas l'identité de son appelant. Quiconque atteint le port peut soumettre n'importe quel `user`.

## Motif 3 — mesh ou micro-passerelle

Les adaptateurs mesh et micro-passerelle sont des notes de conception. Le commentaire du module du moteur de décision indique qu'un futur proxy micro-passerelle ou une intégration mesh devrait traduire sa requête en `DecisionInput` et appeler le même moteur. Aucun injecteur mesh, contrôleur mesh ou adaptateur micro-passerelle n'est implémenté. Le commentaire d'en-tête du module sidecar cite Envoy, Kong, NGINX, Apigee et AWS comme cibles de conception.

Deux éléments liés à Envoy existent et ne constituent pas un produit mesh :

- Des formateurs HTTP pour une réponse de style Envoy et une réponse de style Kong sont implémentés et couverts par des tests unitaires. `SidecarSettings::from_env()` sélectionne toujours le format code de statut, donc ces formateurs ne sont pas atteignables par la configuration.
- Un listener d'autorisation gRPC Envoy (`envoy.service.auth.v3.Authorization`) ne démarre que si son adresse est configurée, dans n'importe quel mode d'exécution. Il valide lui-même le JWT bearer, puis appelle le même moteur de décision. Aucun manifeste d'exemple du dépôt ne l'active. Il n'est pas branché comme intégration service mesh.

## stoa-connect est le chemin GitOps

`stoa-connect` est l'agent qui s'enregistre auprès du plan de contrôle et synchronise routes, politiques et identifiants vers l'API d'administration d'une passerelle tierce. Les adaptateurs dans `stoa-go/internal/connect/adapters/` couvrent webMethods, Kong, Gravitee et Envoy. L'agent est hors du chemin de requête client : la passerelle tierce applique ce que l'agent a poussé.

Utilisez `stoa-connect` lorsque la passerelle doit rester devant le trafic et recevoir l'état souhaité depuis STOA. Utilisez le compagnon lorsqu'un hôte dans le même pod doit interroger `POST /authz` avant de transmettre. Les deux sont indépendants. Un processus en runtime sidecar qui vise une passerelle distante est classé `connect`, pas `sidecar`.

Installez et exploitez l'agent avec le [guide stoa-connect](./stoa-connect-quickstart.md). L'enregistrement d'un processus STOA est le guide [d'auto-enregistrement](./gateway-auto-registration.md). La traduction des API de gestion est le [patron d'adaptateur](../architecture/gateway-adapter-pattern.md).

## Limites actuelles

Vérifiées sur le commit `stoa` `a97147e97edfa7c843b3c81dc14c6c039ee45908`.

1. **Aucune preuve tierce en conditions réelles dans le dépôt.** La couverture des routes est un test dans le processus (`sidecar_mode_exposes_authz_without_mcp_routes`). Le chart de même pod a été relu comme template. Aucun workflow de cette révision ne rend le chart avec `stoaSidecar.enabled=true` ni n'enregistre un appel réel de webMethods, Kong, Gravitee ou Envoy vers `/authz`. Des fichiers Docker Compose qui appellent `/authz` utilisent un principal de démo fixe sur un réseau Docker. Ils ne sont ni un sidecar Kubernetes ni une démonstration produit.
2. **Le chart n'exécute pas une image légère publiée.** Le job CI `companion-image` construit avec `FEATURES=` et `NO_DEFAULT_FEATURES=true` et pose `push: false`. Le job de publication construit `ghcr.io/stoa-platform/stoa-gateway` avec `FEATURES=kafka,pingora,k8s`. `stoaSidecar.image` pointe vers ce dépôt publié et un digest épinglé. Aucun chiffre de taille d'image ou de RSS n'est publié pour le profil non publié.
3. **`POST /authz` ne renvoie qu'un code de statut.** `SidecarSettings::from_env()` pose `DecisionFormat::default()`, c'est-à-dire `StatusCode`. `STOA_DECISION_FORMAT` n'est pas lu. L'hôte reçoit `200`, `401`, `403` ou `429` et un corps vide. Les en-têtes d'enrichissement, les en-têtes `X-RateLimit-*` et le motif de refus sont abandonnés. Les formateurs JSON, Envoy et Kong existent dans le code et ne sont pas sélectionnables.
4. **L'identité est l'objet JSON `user`.** `STOA_USER_INFO_HEADER`, `STOA_TENANT_ID_HEADER` et `STOA_UPSTREAM_TYPE` sont stockés dans les réglages et ne sont pas utilisés par `/authz`. L'endpoint ne valide pas de jeton. Le chart injecte tout de même les variables Keycloak et `STOA_POLICY_ENABLED`. Ces variables ne font pas valider de jeton ni évaluer un moteur de politiques à `/authz`.
5. **Le listener n'est pas limité à la boucle locale.** `main.rs` se lie à `0.0.0.0` et à `config.port`. `Config.host` (`STOA_HOST`, défaut `0.0.0.0`) n'est pas l'adresse d'écoute. Le template sidecar pose `STOA_HOST=127.0.0.1` avec un commentaire indiquant que le port n'est accessible qu'en localhost. Ce commentaire ne correspond pas à l'écoute. Avec le `STOA_PORT=8081` du chart, `/authz` écoute sur l'IP du pod. Quand `stoaSidecar.serviceMonitor.enabled` est vrai (le défaut du chart), un Service ClusterIP distinct publie le port `8081` sur le même listener : `/metrics` et `/authz` sont alors joignables via ce Service. Le chart ne livre pas de NetworkPolicy pour le sidecar. Isolez le port sur le réseau si le modèle de confiance compte : tout appelant qui l'atteint peut affirmer n'importe quel utilisateur.
6. **Le moteur de décision n'évalue pas OPA et ne mesure pas via Kafka.** Les étapes sont l'identité, le tenant, une limite de débit optionnelle en mémoire, et les scopes. Le routeur `/authz` ne pose jamais de scopes requis, donc l'étape scope ne s'exécute pas sur cette route. Le limiteur en mémoire compte par processus. Le commentaire du chart qui cite un pipeline de métrologie Kafka et la validation de jeton OIDC ne décrit ni `DecisionEngine` ni `/authz`. Il n'y a pas d'événement d'usage par décision ni de métrique `stoa_sidecar_*` dans les sources de la passerelle. Les métriques HTTP génériques peuvent enregistrer la requête `/authz` elle-même.
7. **La preuve de topologie est une déclaration.** Le template écrit un JSON statique dans `STOA_TOPOLOGY_PROOF` (`declared_in_kubernetes`, noms de conteneurs, `authz_url` sur localhost). Cette déclaration ne montre pas que l'hôte a appelé `/authz`.
8. **Il n'y a pas de packaging mesh.** Les motifs 2 et 3 n'ont pas d'adaptateur mesh. Le listener gRPC ci-dessus est optionnel, n'a pas de manifeste d'exemple, et n'est pas un contrôleur mesh.

## Voir aussi

- [Modes de passerelle](./gateway-modes.md)
- [Connecter une passerelle tierce avec stoa-connect](./stoa-connect-quickstart.md)
- [Auto-enregistrement de passerelle](./gateway-auto-registration.md)
- [webMethods et le compagnon](./migration/webmethods-sidecar.md)
- [Patron d'adaptateur de passerelle](../architecture/gateway-adapter-pattern.md)
- [Sources de configuration](../reference/config-sources.md)
