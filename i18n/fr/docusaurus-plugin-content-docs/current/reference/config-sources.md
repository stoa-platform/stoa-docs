---
sidebar_position: 2
title: Sources de configuration
description: D'où vient un paramètre STOA, quelle source l'emporte, et comment le changer sans écrire de secret dans Git.
keywords: [configuration, Helm, précédence, ExternalSecret, variables d'environnement, provenance]
---

# Sources de configuration

Cette page indique **d'où vient un paramètre** et **quelle source l'emporte**. Elle a été vérifiée sur le commit public [`stoa`](https://github.com/stoa-platform/stoa) `a97147e` (2026-11-05). Le dépôt `stoa-infra` n'était pas lisible pour cette passe. Relire le chart avant de traiter une valeur par défaut comme actuelle.

La [Référence de configuration](/docs/reference/configuration) montre des exemples. Ces exemples ne sont pas un rendu des charts. Utiliser cette page avant de modifier un site.

Espaces réservés uniquement : `<base-domain>`, `stoa-system`, `${TOKEN}`. Ne pas coller d'hôtes de production ni de secrets dans Git, un ticket ou ce site.

L'anglais de cette page est la source de vérité. Les questions ouvertes gardent la même numérotation.

## Couches

Quatre couches apparaissent dans l'arbre public. Elles ne sont pas interchangeables.

| Couche | Ce qu'elle est sur cette révision | Ce qu'elle n'est pas |
| --- | --- | --- |
| Environnement du processus | Le control plane lit des variables au nom des champs via `Settings` (`control-plane-api/src/config.py`). Le gateway lit `STOA_*` (et une courte liste historique) via Figment (`stoa-gateway/src/config/loader.rs`). | Une valeur Helm que le processus ne reçoit jamais. |
| Valeurs Helm | Clés typées dans `charts/stoa-platform/values.yaml`, surchargeables par des fichiers `-f` ultérieurs et `--set`. Le Deployment du gateway copie certaines clés dans `env`. `stoaGateway.extraEnv` et `stoaSidecar.extraEnv` sont des listes ajoutées à la fin. `stoaSidecar.mainGateway.env` est la liste du conteneur compagnon. | Une map `env:` générique pour chaque charge. `main` ne rend pas cette forme. Voir [question ouverte 1](#questions-ouvertes). |
| Matière secrète | Secrets Kubernetes. External Secrets optionnel (`stoaGateway.externalSecret`, désactivé par défaut). Init container Infisical historique (`infisical.enabled`, désactivé par défaut) qui écrit des fichiers sous `/secrets`. Infisical est retiré comme socle de secrets de STOA ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)). Secret `stoa-internal-keys` généré par Helm (premier install seulement ; conservé à l'upgrade). | Un endroit sûr pour committer un mot de passe. Garder la matière dans le magasin de secrets. Voir [Rotation des secrets et des clés](/docs/admin/secret-rotation). |
| État désiré au runtime | Intention d'API et de routes dans [`stoa.yaml`](/docs/reference/stoa-yaml). `GatewayBinding.spec.desiredState` sur la CRD `gatewaybindings.gostoa.dev`. ConfigMaps du chart `stoa-chat-config` et `stoa-signup-settings`. | La configuration de démarrage du processus. Un binding ne règle pas `STOA_LOG_LEVEL`. |

Les Deployments Control Plane API, Console, Portal et Keycloak ne sont **pas** installés par `charts/stoa-platform`. Les commentaires du chart indiquent que Keycloak et Vault sont déployés ailleurs, et `networkPolicy` attribue le control plane, l'UI, le portal et l'identité à d'autres charts. Ces charts ne sont pas dans l'arbre public `stoa` relu ici.

## Précédence par famille

Modifier la source de vérité de la ligne. Éditer une copie en aval ne tient pas quand le propriétaire reconcilie.

| Famille | Source de vérité sur cette révision | Ordre de surcharge (le premier perd) | Notes |
| --- | --- | --- | --- |
| URL publiques du control plane | `BASE_DOMAIN`, sauf si la variable d'URL précise est déjà présente | Défaut du champ → `.env` → environnement → chaîne vide explicite conservée → la dérivation ne remplit que les clés **absentes** | La dérivation utilise `setdefault`. `KEYCLOAK_URL=` (vide) est conservé. Un `KEYCLOAK_URL` absent devient `https://auth.<base-domain>`. Le domaine de repli quand `BASE_DOMAIN` manque dans le validateur est `gostoa.dev` (le même défaut que `stoa.domain` dans `values.yaml`). Un `BASE_DOMAIN` vide refuse le démarrage. | |
| `stoa.domain` | Helm `stoa.domain` (défaut du chart `gostoa.dev`) | `values.yaml` → `-f` ultérieur → `--set` | Consommé par le Job de bootstrap quand le bootstrap est activé : URI de redirection Keycloak `https://console.<domain>` et `https://portal.<domain>`. Ne règle **pas** `BASE_DOMAIN` du control plane ni `stoaGateway.keycloakUrl`. |
| Boutons du gateway (mode, niveau de log, Kafka, politique, réplicas, nom d'environnement) | Clés typées `stoaGateway.*` / `stoaSidecar.*` rendues dans `env` | Valeurs du chart → fichier d'environnement → `--set` → `env` du conteneur tel que rendu | `environment=prod` sans `STOA_MCP_AUDIENCE` refuse de démarrer. Le template Helm ne pose pas `STOA_MCP_AUDIENCE`. |
| Secrets du gateway (`STOA_CONTROL_PLANE_API_KEY`, `STOA_KEYCLOAK_CLIENT_SECRET`) | Secret nommé par `stoaGateway.secretName` (défaut `stoa-gateway-secrets`) | Créer le Secret vous-même, **ou** activer `stoaGateway.externalSecret` pour qu'External Secrets possède ce Secret | Les deux clés sont `optional: true`. Clé absente : le gateway saute l'auto-enregistrement et reste autonome. Voir [Auto-enregistrement du gateway](/docs/guides/gateway-auto-registration). |
| Réglages imbriqués du gateway (mTLS, autres structs imbriquées) | `STOA_<SECTION>__<FIELD>` | Défauts → un fichier YAML → `STOA_*` → env legacy à plat | `STOA_MTLS_ENABLED` (un seul tiret bas) ne règle pas `mtls.enabled`. Utiliser `STOA_MTLS__ENABLED`. |
| Réglages du processus control plane | Variables d'environnement dont le nom correspond aux champs `Settings`, injectées par le Deployment | Fichier `.env` s'il est présent dans le répertoire de travail de l'image, puis l'environnement du processus. Un `env` explicite sur le Pod l'emporte sur `envFrom`. Parmi les sources `envFrom`, la dernière l'emporte pour le même nom. | Ordre `envFrom` de `control-plane-api/k8s/deployment.yaml` : ConfigMap `stoa-control-plane-api-config`, Secret `stoa-control-plane-api-secrets`, Secret optionnel `stoa-opensearch-secret`, Secret optionnel `anthropic-api-key`, ConfigMap optionnel `stoa-chat-config`. Les deux premiers objets ne sont **pas** définis dans ce chart. |
| Coupe-circuit du chat | Helm `stoa.anthropicApiKey` → clé `CHAT_KILL_SWITCH` de la ConfigMap `stoa-chat-config` | Clé vide → `"true"`. Clé non vide → `"false"`. | Le Deployment du control plane charge cette ConfigMap en dernier parmi `envFrom`, et ne pose pas `CHAT_KILL_SWITCH` dans son `env` explicite : la valeur atteint le processus **si** ce Deployment est celui du cluster. Écrire la clé d'API dans un fichier de valeurs commité la stocke dans Git et la copie dans le Secret `stoa-internal-keys`. Laisser le champ Helm vide et injecter la clé depuis le magasin de secrets. |
| Mode d'inscription | Helm `controlPlaneApi.signupMode` (`invite` ou `open` ; toute autre valeur fait échouer `helm template`) → ConfigMap `stoa-signup-settings` | Valeur du chart seulement, pour ce que ce dépôt montre | Le Deployment public du control plane ne référence pas `stoa-signup-settings`. Voir [question ouverte 4](#questions-ouvertes). |
| Intention de déploiement d'API | [`stoa.yaml`](/docs/reference/stoa-yaml) via `stoactl`, import Console, ou le control plane | Pas une valeur Helm | Indépendant de l'environnement de boot du gateway. |
| Points de terminaison du pipeline de télémétrie | `alloyConfig.*` et `global.platform` / `global.environment` de `charts/stoa-observability` | `values.yaml` de ce chart → `values-dev.yaml` ou `values-prod.yaml` | Le gateway ne connaît l'adresse du collecteur que par `stoaGateway.otelEndpoint` (ou l'équivalent sidecar). |
| Identifiants de stockage objet pour les error snapshots | Env du control plane `STOA_API_SNAPSHOT_*` | Le préfixe historique `STOA_SNAPSHOTS_*` remplit encore un champ quand le nouveau nom est absent ; les deux préfixes avec des valeurs différentes refusent le boot | `charts/minio` ne déploie pas le control plane. C'est un fichier de valeurs MinIO amont plus des manifestes locaux Secret et Job. |

### URL que le control plane remplit quand la variable est absente

| Variable | Valeur écrite |
| --- | --- |
| `KEYCLOAK_URL` | `https://auth.<base-domain>` |
| `GATEWAY_URL` | `https://vps-wm.<base-domain>` |
| `GATEWAY_ADMIN_PROXY_URL` | `https://apis.<base-domain>/gateway/Gateway-Admin-API/1.0` |
| `ARGOCD_URL`, `ARGOCD_EXTERNAL_URL` | `https://argocd.<base-domain>` |
| `GRAFANA_URL` | `https://grafana.<base-domain>` |
| `PROMETHEUS_URL` | `https://prometheus.<base-domain>` |
| `LOGS_URL` | `https://grafana.<base-domain>/explore` |
| `VAULT_ADDR` | `https://hcvault.<base-domain>` |
| `CORS_ORIGINS` | `https://console.<base-domain>`, `https://portal.<base-domain>`, les noms console et portal `staging-` et `dev-`, plus des origines de dev locales figées dans le validateur |

Un site qui n'utilise pas les préfixes `vps-wm` ou `hcvault` doit poser ces variables explicitement. La dérivation ne devine pas un autre nom d'hôte.

`KEYCLOAK_INTERNAL_URL` n'est pas dérivée. Quand elle est posée, les appels backend l'utilisent et la vérification `iss` du jeton continue d'utiliser `KEYCLOAK_URL`. Le gateway reflète cela avec `STOA_KEYCLOAK_INTERNAL_URL` face à `STOA_KEYCLOAK_URL`.

### Ordre de chargement du gateway

`Config::load` fusionne dans cet ordre. Le dernier gagne.

1. Défauts compilés.
2. Le premier fichier qui existe parmi `config.yaml`, `config.yml` et `/etc/stoa/config.yaml`. Le chart Helm n'en monte aucun.
3. Variables `STOA_*`. `__` sépare les champs imbriqués.
4. Noms historiques, qui battent donc `STOA_*` quand les deux sont posés : `PORT`, `HOST`, `JWT_SECRET`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_PROJECT_ID`, `GITHUB_TOKEN`, `GITHUB_ORG`, `GITHUB_CATALOG_REPO`, `GITHUB_GITOPS_REPO`, `GITHUB_WEBHOOK_SECRET`, `GIT_PROVIDER`.

Les contrôles de démarrage qui refusent le boot incluent : port `0` ; `mtls.enabled` avec une liste de proxys de confiance vide ; fédération activée sans upstream ; contrainte d'expéditeur activée sans mTLS ni DPoP ; `environment=prod` sans audience MCP.

## Charts de l'arbre public

`charts/` sur cette révision contient trois répertoires : `stoa-platform`, `stoa-observability` et `minio`.

### `stoa-platform` — ce que le chart possède

| Possédé par le chart | Lu par le processus |
| --- | --- |
| Deployment, Service, Ingress du gateway (Ingress désactivé sauf activation), ServiceAccount quand le watcher CRD est actif, ConfigMap de politique, ServiceMonitor, HPA, PDB | Le gateway lit la liste `env` rendue par le Deployment, puis Figment. Fichiers de politique de la ConfigMap quand `stoaGateway.policies.enabled` est vrai (chemin par défaut `/etc/stoa/policies/default.rego`). |
| `stoaGateway.extraEnv` ajouté après les entrées typées | Même conteneur. Un nom répété n'est pas un no-op documenté. Confirmer avec `printenv` ([question ouverte 6](#questions-ouvertes)). |
| ExternalSecret `stoa-gateway-secrets` quand `stoaGateway.externalSecret.enabled` est vrai | Ne synchronise que `STOA_CONTROL_PLANE_API_KEY` et `STOA_KEYCLOAK_CLIENT_SECRET` depuis `vaultPath` (défaut des valeurs `stoa/data/gateway`) via le ClusterSecretStore `vault-backend`. Nécessite External Secrets Operator. |
| Secret `stoa-internal-keys` (`gateway-consumer-key`, `chat-internal-key`, `jwt-signing-key`) | Env gateway `GATEWAY_API_KEYS` depuis `gateway-consumer-key` (`optional: true`). Le manifeste control plane lit `chat-internal-key` dans `CHAT_GATEWAY_API_KEY`. Les clés sont générées une fois et Helm ne les fait pas tourner. |
| Deployment sidecar quand `stoaSidecar.enabled` est vrai | Env du conteneur sidecar depuis les champs typés, puis `stoaSidecar.extraEnv`. Env du conteneur compagnon depuis `stoaSidecar.mainGateway.env`, puis un `EXT_AUTHZ_URL=http://localhost:8081/authz` ajouté par le chart. |
| CronJob de sync OpenAPI quand `gatewaySync.enabled` est vrai (activé dans `values.yaml`) | Env du Job : URL du control plane, URL d'admin du gateway, et clés `username` / `password` du Secret `gatewaySync.credentialsSecret`. Ce n'est pas la config de boot du gateway Rust. |
| ConfigMap `stoa-chat-config` | `CHAT_KILL_SWITCH`, et `CHAT_GATEWAY_URL` vers le Service du gateway. Le Deployment public du control plane pose aussi `CHAT_GATEWAY_URL` dans `env` explicite, ce qui écrase la ConfigMap pour cette clé. |
| ConfigMap `stoa-signup-settings` | Non montée par `control-plane-api/k8s/deployment.yaml`. |
| Objets HPA et PDB pour le control plane, l'UI, le portal et le nom du gateway MCP Python | Ils sélectionnent des Deployments que ce chart ne crée pas. |
| ServiceMonitor Vault, PrometheusRule, et un CronJob de contrôle d'identifiants | Désactivés par défaut. Ils observent une installation Vault que ce chart ne déploie pas. |
| Job de bootstrap quand `stoa.bootstrap.enabled` est vrai et `keycloak.operator.enabled` est faux | Mise en place unique du realm et des clients Keycloak. Un `stoa.bootstrap.keycloak.adminPassword` en clair fait échouer le rendu ; le Job lit `existingSecret`. |
| Init container Infisical historique quand `infisical.enabled` est vrai | Écrit `/secrets/<secretKey>` sur un volume en mémoire et le monte sur le gateway. `Config::load` ne lit pas ce répertoire ([question ouverte 5](#questions-ouvertes)). |

Env typé que le template pose (hors secret) : `STOA_PORT` `8080`, `STOA_HOST` `0.0.0.0`, `STOA_CONTROL_PLANE_URL`, `STOA_KEYCLOAK_URL`, `STOA_KEYCLOAK_REALM`, `STOA_KEYCLOAK_CLIENT_ID`, `STOA_LOG_LEVEL`, `STOA_LOG_FORMAT`, `STOA_GATEWAY_MODE`, `STOA_AUTO_REGISTER`, `STOA_ENVIRONMENT`, plus politique, watcher Kubernetes, Kafka et `STOA_OTEL_ENDPOINT` quand ces blocs sont activés.

Cette liste est le Deployment de la passerelle principale. Le template sidecar pose `STOA_PORT` à `8081` et `STOA_HOST` à `127.0.0.1`. Le processus se lie à `0.0.0.0` et à `config.port` ; `STOA_HOST` n'est pas l'adresse d'écoute. Voir [Usage du compagnon](../guides/companion-usage.md).

Le commentaire de `secretName` dans les valeurs cite aussi `JWT_SECRET` et `ADMIN_API_TOKEN`. Le Deployment et l'ExternalSecret ne projettent pas ces clés. Les poser via `extraEnv` depuis un Secret si vous en avez besoin, ou accepter les défauts du gateway (l'API admin reste fermée sans `STOA_ADMIN_API_TOKEN`).

Défauts de `values.yaml` que l'on manque en faisant confiance au README du chart plutôt qu'au fichier :

| Clé | `values.yaml` | Tableau du `README.md` du chart |
| --- | --- | --- |
| `stoaGateway.controlPlaneUrl` | `http://stoa-control-plane-api.stoa-system.svc.cluster.local:80` | `http://control-plane-api:8000` |
| `stoaGateway.keycloakUrl` | vide | `http://keycloak:8080` |
| `stoaGateway.ingress.enabled` | `false` | `true` |
| `stoaGateway.resources.limits.memory` | `512Mi` | `256Mi` |
| `gatewaySync.enabled` | `true` | `false` |
| `gatewaySync.schedule` | `0 */6 * * *` | `*/30 * * * *` |

Rendre avec `helm template` et lire la sortie. Le tableau du README n'est pas le moteur de rendu.

`values-prod.yaml` pose de vrais boutons sous `stoaGateway` (réplicas, `environment: prod`, hôte d'ingress, Kafka, watcher CRD). Le même fichier pose aussi `global`, `replicaCount`, `postgresql`, `observability`, `ingress` et `keycloak.replicas`. Aucun template sous `charts/stoa-platform/templates` ne lit ces chemins. `keycloak.replicas` est commenté comme référence seule pour un chart absent de ce dépôt. Ils ne changent pas `helm template` de `stoa-platform`.

### Second manifeste gateway

`stoa-gateway/k8s/deployment.yaml` est un Deployment distinct, lui aussi nommé `stoa-gateway` dans `stoa-system`. Il fige l'env directement. Sur cette révision, `STOA_CONTROL_PLANE_URL` vise le port **8000**. Le défaut du chart vise le port de Service **80** (le Service transfère vers le port de conteneur 8000). Il pose aussi `STOA_MCP_AUDIENCE`, que le template Helm ne pose jamais.

Si les deux objets sont appliqués, le dernier écrivain possède le spec du Pod. Voir [question ouverte 3](#questions-ouvertes). Le manifeste brut contient aussi des URL d'upstream propres à un site. Ne pas le copier dans un fichier de valeurs. Les clés d'API-proxy imbriquées de ce manifeste utilisent un seul tiret bas ; le commentaire du loader indique que ces noms ne sont pas liés. La forme liée est `STOA_API_PROXY__...` avec un double tiret bas.

`values-prod.yaml` pose `stoaGateway.environment: prod` et ne pose toujours pas d'audience MCP. Un gateway qui reçoit vraiment cet env sans audience sort sur le contrôle prod. Fournir `STOA_MCP_AUDIENCE` via `extraEnv` tant que le chart n'a pas de champ typé ([question ouverte 11](#questions-ouvertes)).

### `stoa-observability` — ce que le chart possède

Chart Helm avec sous-charts Alloy, Tempo et (optionnel) blackbox exporter. Il possède le pipeline du collecteur, pas les boutons applicatifs.

| Valeur du chart | Effet |
| --- | --- |
| `alloyConfig.prometheusRemoteWriteUrl`, `lokiUrl`, `tempoEndpoint`, `logNamespaces`, `scrapeInterval` | Rendus dans la ConfigMap `stoa-alloy-config`. |
| `global.platform`, `global.environment` | Étiquettes de ce pipeline. |
| `tempo.tempo.retention`, `tempo.persistence` | Passés au sous-chart Tempo. Le défaut `retention` dans les valeurs de ce chart est `7d`. C'est un défaut de chart, pas un objectif de service publié. |
| `grafana.tempoDataSource.*` | Manifeste de datasource Grafana quand Tempo et le drapeau de datasource sont actifs. |
| `tenantTiers`, `alloyConfig.logLabels` | Présents dans `values.yaml`. Aucun template de ce chart ne les référence ([question ouverte 10](#questions-ouvertes)). |

L'adresse d'export du gateway est `stoaGateway.otelEndpoint` sur le chart plateforme (défaut `http://stoa-alloy-otlp.stoa-monitoring:4317`). Ce chart d'observabilité crée le Service Alloy ; il ne modifie pas le gateway.

### `minio` — surcouche de valeurs, pas un chart empaqueté

Il n'y a pas de `Chart.yaml`. `charts/minio/README.md` installe le `minio/minio` amont avec `values.yaml`, puis applique `secret.yaml` et `setup-job.yaml`.

| Possédé ici | Lu par le control plane |
| --- | --- |
| Valeurs amont : mode, persistance, `existingSecret` (nom par défaut `minio-credentials`, clés `rootUser` et `rootPassword`), nom de bucket `error-snapshots` | Rien, tant que vous ne posez pas `STOA_API_SNAPSHOT_*` sur le control plane. Le préfixe canonique est `STOA_API_SNAPSHOT_` (`control-plane-api/src/features/error_snapshots/config.py`). |
| Job de cycle de vie | Bucket et job d'expiration. Le README MinIO montre encore les noms historiques `STOA_SNAPSHOTS_*` ([question ouverte 12](#questions-ouvertes)). |

Les identifiants root appartiennent à `existingSecret`, pas à `rootUser` / `rootPassword` dans Git. Le fichier de valeurs laisse déjà ces chaînes vides.

## Changement sûr

1. Nommer la famille dans le tableau ci-dessus. Une famille par changement.
2. Lire la release en place avant d'éditer : `helm get values stoa-platform -n stoa-system`. Si le site n'est pas installé depuis ce chart, s'arrêter et trouver le manifeste qui a écrit le Deployment en dernier (`kubectl -n stoa-system get deploy stoa-gateway -o jsonpath='{.metadata.labels}'`).
3. Éditer Git. Pour un bouton, éditer le fichier de valeurs que la release utilise déjà. Pour un secret, éditer le magasin de secrets et synchroniser le Secret Kubernetes. Ne pas mettre le secret dans `values.yaml`, une ConfigMap ou `--set`. Étapes de rotation : [Rotation des secrets et des clés](/docs/admin/secret-rotation).
4. Pour une URL, poser la variable explicite quand le nom d'hôte n'est pas le préfixe dérivé. Poser seulement `stoa.domain` ne déplace ni le gateway ni le control plane.
5. Rendre et ne lire que les **noms** d'env :

```bash
helm template stoa-platform charts/stoa-platform -n stoa-system -f <your-values>.yaml
```

6. Mettre à niveau depuis le même fichier. Contexte d'installation et de retour arrière : [Installation](/docs/admin/installation), [Mise à niveau](/docs/admin/upgrade).

```bash
helm upgrade stoa-platform stoa/stoa-platform -n stoa-system -f <your-values>.yaml
kubectl -n stoa-system rollout status deploy/stoa-gateway
```

7. Revenir à la release Helm si les nouveaux Pods ne passent pas Ready : `helm rollback stoa-platform <REVISION> -n stoa-system`. Un changement de secret se défait en restaurant le Secret précédent depuis le magasin puis en redémarrant, pas en inventant une troisième valeur.

`kubectl edit` sur un Deployment vivant est écrasé à la prochaine application Helm ou du manifeste brut. Ne l'utiliser que comme pont d'incident, et reconcilier Git dans la même fenêtre.

## Vérification

Confirmer que le Pod que vous croyez avoir changé est celui qui a roulé.

- Bouton non secret : lister les noms d'env et la valeur changée.

```bash
kubectl -n stoa-system get deploy stoa-gateway \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"="}{.value}{"\n"}{end}'
```

  Les lignes `valueFrom` s'impriment vides. C'est attendu. Ne pas ajouter un Secret en `-o yaml` dans un ticket.

- Présence d'une clé de Secret, pas le secret :

```bash
kubectl -n stoa-system get secret stoa-gateway-secrets -o jsonpath='{.data}'
```

  Vous voulez les noms de clés. Ne pas les décoder en base64 dans les journaux.

- Les sondes du gateway sont `/health` et `/ready` sur le port 8080. Les sondes du control plane sont `/health/live`, `/health/ready` et `/health/startup` sur le port de conteneur 8000. Un Pod qui passe Ready après le rollout a passé les sondes définies sur ce Deployment.
- Gateway de prod : si le processus sort avant Ready, lire la ligne de journal. `environment=prod requires mcp_audience` signifie que `STOA_MCP_AUDIENCE` n'a jamais atteint le processus.
- Changement d'URL : appeler une route qui utilise cette URL (découverte OIDC ou santé du control plane via la base configurée du gateway). Un Pod Ready ne prouve pas qu'un nom d'hôte amont est le bon.
- Coupe-circuit du chat : la valeur du processus est l'entrée `env` explicite s'il y en a une, sinon la dernière source `envFrom`. Sur le manifeste public du control plane, `CHAT_KILL_SWITCH` vient de `stoa-chat-config` et `CHAT_GATEWAY_URL` vient de l'entrée `env` explicite.
- Mode d'inscription : après avoir changé `controlPlaneApi.signupMode`, confirmer que l'environnement du processus control plane contient vraiment `SIGNUP_MODE`. Mettre à jour la ConfigMap seule ne suffit pas tant que la [question ouverte 4](#questions-ouvertes) n'est pas tranchée.

## Questions ouvertes

Non tranchées sur le commit `a97147e`. Ne pas les documenter comme faites.

1. **Le refactor Helm du bloc `env` (INFRA-1b, CAB-2200) n'est pas sur `main`.** Les charges reçoivent encore des valeurs typées copiées vers des entrées d'env individuelles, plus les listes `extraEnv` / `mainGateway.env`. Il n'y a pas de source de vérité `env:` à l'échelle du chart.
2. **`stoa-infra` n'était pas lisible.** La ConfigMap `stoa-control-plane-api-config`, le Secret `stoa-control-plane-api-secrets`, le chart Keycloak et le chart Vault sont référencés et non définis dans le `stoa` public. Leur source de vérité n'est pas confirmée.
3. **Deux Deployments gateway.** Template Helm contre `stoa-gateway/k8s/deployment.yaml` (port de Service 80 contre port d'URL 8000 ; audience MCP posée seulement sur le manifeste brut). Le chemin d'apply réellement en service n'est pas confirmé.
4. **Câblage de `SIGNUP_MODE`.** Le chart écrit la ConfigMap `stoa-signup-settings`. Le Deployment public du control plane ne la monte pas. Qu'un autre chart projette cette clé n'est pas confirmé.
5. **Fichiers Infisical (historique).** L'init container écrit `/secrets/<key>` et le gateway monte le volume. Le chargement du gateway ne lit pas ces fichiers. Qu'un wrapper les exporte n'est pas confirmé. Infisical est retiré comme socle de secrets de STOA ([ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)). Laisser `infisical.enabled` à faux et utiliser le Secret nommé par `stoaGateway.secretName`, éventuellement synchronisé par External Secrets depuis le socle de secrets accessible par l'API Vault (OpenBao par défaut ; HashiCorp Vault pris en charge).
6. **Noms dupliqués dans une seule liste `env`** (`extraEnv` qui répète une variable du chart). Confirmer sur le cluster avec `printenv` dans le nouveau Pod. Cette page n'affirme pas de règle liée à une version de Kubernetes.
7. **README du chart et `charts/stoa-platform/CLAUDE.md`.** Le tableau du README contredit `values.yaml` (voir ci-dessus). `CLAUDE.md` décrit encore `stoaGateway.enabled: false` et un gateway Python comme courant ; `values.yaml` pose `stoaGateway.enabled: true` et commente le gateway Rust comme primaire. Traiter `values.yaml` plus `helm template` comme le chart.
8. **Clés mortes dans `values-prod.yaml`.** `global`, `replicaCount`, `postgresql`, `observability`, `ingress` et `keycloak.replicas` n'affectent pas les templates de ce chart. Qu'un chart hors dépôt partage le fichier n'est pas confirmé.
9. **`GatewayBinding.spec.desiredState`.** La CRD autorise l'objet (`x-kubernetes-preserve-unknown-fields: true`). Aucun lecteur dans les arbres publics gateway ou control plane ne référence `desiredState`. Un contrôleur ailleurs n'est pas confirmé.
10. **`tenantTiers` et `alloyConfig.logLabels`.** Valeurs seulement. Aucun template `stoa-observability` ne les lit.
11. **Audience MCP sur le chemin Helm de prod.** `values-prod.yaml` pose `environment: prod`. Le template ne pose jamais `STOA_MCP_AUDIENCE`. Le champ d'injection prévu n'est pas confirmé ; en attendant, utiliser `extraEnv` et prouver que le processus a démarré.
12. **Préfixe d'env des snapshots.** Le code utilise `STOA_API_SNAPSHOT_*` et accepte encore `STOA_SNAPSHOTS_*`. `charts/minio/README.md` documente les noms historiques. L'échéance de l'alias n'est pas confirmée.
13. **Aucun objectif de service n'est énoncé ici.** Les durées de rétention dans les valeurs d'observabilité sont seulement des défauts de chart.

## Voir aussi

- [Référence de configuration](/docs/reference/configuration) — exemples d'env et de blocs Helm
- [Référence stoa.yaml](/docs/reference/stoa-yaml) — spec déclarative de déploiement d'API
- [Installation](/docs/admin/installation) — installation du chart et contrôles après installation
- [Mise à niveau](/docs/admin/upgrade) — ordre de mise à niveau et retour arrière Helm
- [Rotation des secrets et des clés](/docs/admin/secret-rotation) — changements dans le magasin de secrets et retour arrière
- [Configuration de sécurité](/docs/reference/security-configuration) — JWT, CORS, limites SSE
- [Configuration mTLS](/docs/guides/mtls-configuration) — jetons liés à un certificat
- [Auto-enregistrement du gateway](/docs/guides/gateway-auto-registration) — `STOA_CONTROL_PLANE_API_KEY`
