---
title: "ADR-064 — Cadre des contrôleurs, maintien des workers Python ad hoc et report de kopf et de Go"
sidebar_position: 64
---

# ADR-064 — Cadre des contrôleurs, maintien des workers Python ad hoc et report de kopf et de Go

- **Statut** : Accepté — amendé par l’ADR-073 (2026-10-23)
- **Date** : 2026-04-16
- **Décideurs** : Christophe, Claude Code
- **Lié à** : ADR-057 (gamme produit — stoactl, stoa-link, stoa-connect), ADR-059 (déploiement simplifié via SSE), ADR-063 (SDD L1 + MCP stoa-impact), ADR-073 (plan de données Envoy — amende cette décision)
- **Ticket parent** : CAB-2053 Phase 7 (gel des fonctionnalités et stabilisation axée sur la CLI)

> **Clarification — 2026-04-24 :** Cette décision sur les contrôleurs respecte le retrait des chemins de déploiement décidé dans l’ADR-059. Le chemin de déploiement actif reste le flux SSE unique défini par l'ADR-059. L’envoi direct depuis le plan de contrôle, la synchronisation intégrée à la requête (`_try_inline_sync`), les boucles permanentes de déploiement par interrogation périodique et le déploiement via `SyncEngine` restent écartés. Leur réintroduction exigerait un nouvel ADR qui revient explicitement sur l’ADR-059. Le choix des workers Python ad hoc fixe la *manière* d’écrire les workers de réconciliation. L’ADR-059 fixe les chemins de déploiement autorisés.

> **Amendement — 2026-11-05 (ADR-073 §7, décision du 2026-10-23) :** L'[ADR-073](./adr-073-adopt-envoy-data-plane.md) définit Envoy amont comme cible pour le plan de données de STOA. Les points suivants précisent la portée de cet amendement.
>
> - **Nommage.** « STOA Link » est l'agent installé sur le site client, binaire `stoa-connect` (Go). Là où cette décision mentionne `stoa-connect`, lire STOA Link. Le runtime sidecar Rust de l’ADR-057 d’origine cesse d’être un produit. Le sidecar désigne une topologie de déploiement d’Envoy.
> - **Déclencheur de réévaluation de Go.** Le serveur xDS local qui configure Envoy s’exécute dans STOA Link, hors du processus de l’API du plan de contrôle. Cet ADR attribuait déjà ce rôle à `stoa-connect` (Décision §4, « Ajustements appliqués », point 3). Cette responsabilité s’ajoute à celles de l’agent Go. Les workers de l’API du plan de contrôle restent en Python. L'ADR-073 §2 confie la traduction UAC → xDS à un composant dédié du plan de contrôle dans l'architecture cible.
> - **Périmètre.** Les neuf workers de l’API du plan de contrôle sont conservés. Chaque cible utilise le chemin unique de l’ADR-059, de la Console à l’API du plan de contrôle, puis par SSE vers STOA Link et jusqu’à la passerelle tierce ou à Envoy par xDS. Un rappel retourne à l’API du plan de contrôle. Les points d’accès `/api/v1/links/…` restent ceux de l’ADR-059.
> - *État d'implémentation.* L'agent Go implémente un serveur ADS mTLS sur la boucle locale lorsque le mode Envoy est activé sur option. Link construit actuellement les instantanés à partir de l'inventaire qu'il reçoit. Voir l'[ADR-073 §7](./adr-073-adopt-envoy-data-plane.md) pour l'état d'implémentation et de déploiement.

## Contexte

Le ticket CAB-2053 Phase 7 laisse une question ouverte : quel cadre doit héberger les futures boucles de réconciliation dans l'API du plan de contrôle ? La spécification MEGA recense trois options sans en présélectionner aucune — `kopf`, des workers Python ad hoc, ou Go via `stoa-connect` (ADR-057).

La question se pose parce que neuf workers Python asynchrones s’exécutent déjà dans `control-plane-api/src/workers/` :

| Worker | Rôle | Déclencheur |
| -- | -- | -- |
| `gateway_health_worker` | vérifier l’état de santé des passerelles enregistrées | interrogation périodique (30 s) |
| `gateway_reconciler` | réconcilier la table `gateway_instances` à partir des applications ArgoCD | interrogation périodique (60 s) |
| `sync_engine` | transmettre l’état des locataires, API et consommateurs aux passerelles | événements et interrogation périodique |
| `git_sync_worker` | synchroniser les manifestes d’application ArgoCD depuis Git | interrogation périodique |
| `billing_metering_consumer` | consommer les messages du topic Kafka `stoa.metering` | consommateur Kafka |
| `chat_metering_consumer` | consommer les événements d’utilisation du chat | consommateur Kafka |
| `error_snapshot_consumer` | enregistrer les événements `stoa.errors` sous forme d’instantanés OpenSearch | consommateur Kafka |
| `security_alert_consumer` | diffuser les événements `stoa.security.*` | consommateur Kafka |
| `telemetry_worker` | export périodique de métriques | interrogation périodique |

Les neuf workers sont pilotés par la base de données ou par Kafka. **Aucun n’est piloté par une CRD.** La réconciliation de STOA repose sur des lignes SQLAlchemy et des topics Kafka, pas sur des ressources personnalisées Kubernetes. Le répertoire `charts/stoa-platform/crds/` existe pour un usage futur mais aucun contrôleur ne surveille actuellement de CRD.

## Décision

### 1. Conserver des workers Python asynchrones ad hoc comme modèle de réconciliation par défaut

Aucune migration des neuf workers existants. Ils sont livrés avec le processus CP API, s’exécutent dans la même boucle d’événements et partagent la fabrique de sessions SQLAlchemy. C’est le choix le plus prévisible pour une équipe orientée Python sur le plan de contrôle et qui exploite déjà ce modèle en production.

### 2. Extraire le middleware partagé dans `src/workers/_base.py` (ticket séparé)

Chaque worker réimplémente les mêmes mécanismes, dont la boucle périodique, l’arrêt propre sur `asyncio.CancelledError`, la journalisation structurée, le délai de reprise après erreur et la gestion d’une instance unique par pod. Il s’agit de consolider tout cela dans une petite bibliothèque interne, sans nouvelle dépendance d’exécution.

`_base.py` regroupera notamment les éléments suivants.

- `PeriodicWorker(name, interval, run_fn)` — boucle périodique et arrêt propre en cas d’annulation.
- `KafkaConsumerWorker(name, topic, handler)` — surcouche légère autour d’`aiokafka`.
- `backoff_on_error(max_retries, base_delay)` — décorateur de relance à délai exponentiel.
- `leader_lock(redis_or_pg)` — élection facultative d’un leader unique pour les déploiements à plusieurs réplicas.

La cible est de 200 à 300 lignes au total. L’extraction sera intégrée worker par worker. Chacun garde son comportement avant sa migration.

### 3. Reporter `kopf` jusqu’à ce qu’un contrôleur de réconciliation fondé sur les CRD soit nécessaire

`kopf` est le bon outil lorsque l’état à réconcilier est exposé par Kubernetes via `kubectl get`. Les données actuelles sont dans Postgres. Les ressources `GatewayInstance`, `Subscription` et `Tenant` de STOA sont des lignes en base, pas des CRD. Adopter `kopf` aujourd’hui implique :

- Une nouvelle dépendance d’exécution sur `kubernetes_asyncio` + `kopf`.
- Un accès à l’API K8s requis dès le développement (ce qui empêcherait le fonctionnement de `docker-compose` et de `stoa-quickstart`).
- Une surface de réconciliation parallèle — lignes en base et CRD — avec un risque de dérive.

Nous réévaluerons `kopf` lorsqu’une ressource de premier plan, par exemple `GatewayInstance`, deviendra une CRD gérée par l’opérateur. Il s’agit d’une décision distincte soumise au Council. Aucune date cible n’est fixée.

### 4. Reporter les contrôleurs en Go tant que stoa-connect ne justifie pas une réécriture en Go des workers CP API

L’ADR-057 décrit `stoa-connect` comme l’agent Go qui relie, depuis un VPS, les passerelles tierces (Kong, Gravitee, webMethods) et le plan de contrôle. Go est pertinent dans ce cas : binaire statique, déploiement en périphérie et faible empreinte mémoire.

Réécrire les neuf workers CP API en Go n’apporte aucune amélioration visible pour l’utilisateur et consomme des semaines de portage Python → Go pour une équipe qui écrit du Python au quotidien. Le service CP API reste en Python. `stoa-connect` reste en Go. Les deux ne convergent pas.

## Conséquences

### Positives

- **Coût de migration nul** pour les neuf workers actuels. Ils continuent d’être livrés avec chaque version de CP API.
- **L’extraction de `_base.py`** supprime environ 150 lignes de code dupliquées et facilite l’écriture du dixième worker.
- **Aucune nouvelle dépendance d’exécution** — ni `kopf`, ni `kubernetes_asyncio`, ni étape de compilation Go dans CP API.
- **Développement local inchangé** : `docker-compose up` et `stoa-quickstart` continuent de fonctionner sans API K8s.
- **La porte reste ouverte** à kopf lorsque le premier vrai contrôleur de CRD arrivera, ainsi qu’à Go lorsqu’un mécanisme de réconciliation en périphérie sur VPS sera nécessaire.

### Négatives

- **Pas de réconciliation native CRD.** Si un futur administrateur de tenant exécute `kubectl apply -f tenant.yaml`, rien ne se passe aujourd’hui. Ce type d’expérience utilisateur est hors périmètre de la feuille de route actuelle, mais nécessiterait kopf (ou un opérateur Go) pour être débloqué.
- **L’élection de leader est optionnelle et non fournie nativement par un framework.** Les équipes écrivant un nouveau worker doivent penser à appeler `leader_lock()` si elles passent au-delà d’un réplica. L’extraction dans `_base.py` devra rendre ce point explicite via la signature du constructeur du worker.

### Neutres

- Les workers existants continuent d’utiliser `_get_session_factory()` et `settings` directement. L’extraction de `_base.py` est **additive**, il ne s’agit pas d’une refonte forcée.

## Options évaluées et rejetées

### Option A — Adopter `kopf` dès maintenant

`kopf` est un framework Python mature pour les opérateurs Kubernetes (basé sur des gestionnaires, observateurs de CRD, élection de leader intégrée). Option rejetée car rien dans STOA aujourd’hui n’est piloté par les CRD : l’état de réconciliation réside dans Postgres et Kafka, et non dans l’API K8s. Introduire `kopf` ajoute un second modèle d’état avec un risque de dérive et casse le développement local (hors K8s).

### Option B — Réécrire les workers en Go via `stoa-connect`

`stoa-connect` est un agent Go selon l’ADR-057. Go est le bon langage pour les composants de réconciliation sur VPS en périphérie faisant le pont avec des passerelles tierces, pas pour des workers en processus qui partagent une session SQLAlchemy avec l’API du plan de contrôle. Une réécriture en Go double la surface d’exécution du plan de contrôle sans gain fonctionnel. Option rejetée comme prématurée.

### Option C — Python ad hoc + extraction de `_base.py` *(retenue)*

Approche légère, incrémentale et réversible. Elle permet à l’équipe de continuer à livrer et reporte les futures décisions de framework au moment où un besoin natif CRD apparaîtra réellement.

## Validation du Council — 8,25/10 (avis favorable)

| Profil | Note | Avis |
| -- | -- | -- |
| Chucky (Devil's Advocate) | 8/10 | Avis favorable |
| OSS Killer (VC Skeptique) | 8/10 | Avis favorable |
| Archi 50x50 (Architecte Veteran) | 9/10 | Avis favorable |
| Better Call Saul (Legal/IP) | 8/10 | Avis favorable |

### Motifs par profil

- **Chucky** : « Pas de framework » n’est un choix valide que si l’extraction de `_base.py` a bien lieu. Sans elle, les 9 workers continuent d’évoluer séparément. Il faut s’engager sur un ticket séparé qui livre `_base.py` en C17 ou C18. Point d’attention noté dans la section Conséquences.
- **OSS Killer** : Aucune nouvelle dépendance d’exécution équivaut à aucune nouvelle exposition de licence et aucune nouvelle surface d’attaque. La pile Postgres + Kafka fait déjà partie de l’architecture STOA. C’est la bonne décision d’y rester.
- **Archi 50x50** : Lorsque l’état se trouve dans Postgres, le choix du cadre dépend d’abord de l’objet à réconcilier. La bonne question est « vers quoi converge la réconciliation ? » et la réponse honnête est « une ligne en base, pas une ressource ». Cette réponse désigne l’outil.
- **Saul** : kopf (Apache 2.0) et kubernetes_asyncio (Apache 2.0) seraient compatibles, mais reporter leur adoption représente un ensemble de dépendances transitives de moins à auditer. Aucun enjeu de propriété intellectuelle avec le statu quo.

### Ajustements appliqués

1. L’extraction de `_base.py` est **suivie** comme action complémentaire — voir le commentaire de clôture de CAB-2053 Phase 7 pour le lien vers le ticket. Elle n’est pas implicite.
2. Déclencheur de réévaluation pour `kopf` : le premier contrôleur devant observer un CRD K8s (et non une ligne de base de données). L’ADR devra être réexaminé, et non ignoré silencieusement.
3. Déclencheur de réévaluation pour Go : tout composant de réconciliation devant s’exécuter hors du processus de l’API du plan de contrôle (VPS en périphérie, conteneur d’opérateur K8s, démon autonome). `stoa-connect` occupe déjà ce créneau.

## Liens

- ADR-057 — Gamme de produits (stoactl, stoa-link, stoa-connect).
- ADR-059 — Déploiement simplifié via SSE.
- ADR-073 — Adopter Envoy comme plan de données STOA (amende cette décision, 2026-10-23).
- `control-plane-api/src/workers/` — les neuf workers actuels.
- [Projet kopf](https://kopf.readthedocs.io/) — pour référence, non adopté.
