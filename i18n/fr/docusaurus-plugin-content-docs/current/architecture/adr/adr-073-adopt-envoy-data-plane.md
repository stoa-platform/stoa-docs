---
sidebar_position: 73
title: "ADR-073 : Adopter Envoy comme plan de données de STOA"
sidebar_label: "ADR-073 : plan de données Envoy"
description: "STOA s'appuie sur Envoy amont pour son plan de données au lieu de la passerelle maison en Rust. Envoy est configuré uniquement par xDS, servi par STOA Link ; la logique STOA s'exécute dans des services externes appelés par Envoy, et le module MCP est placé derrière Envoy."
keywords: [ADR, Envoy, plan de données, xDS, STOA Link, STOA Gateway, MCP, ext_authz, ext_proc, souverain, décision d'architecture]
---

# ADR-073 : Adopter Envoy comme plan de données de STOA

:::info Acceptée — points ouverts
La décision a été prise le 2026-10-22, ses choix structurants ont été tranchés le 2026-10-23 et l'enregistrement a été accepté le 2026-10-25. Les points marqués **[À confirmer]** sont des détails de mise en œuvre encore ouverts ; ils ne changent pas la décision.
:::

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Acceptée |
| **Date** | 2026-10-22 |
| **Mise à jour** | 2026-10-23 — décisions structurantes intégrées (lieu d'exécution de la logique STOA, acheminement de la configuration, éditions, sens de « Link », sort des ADR-024 et ADR-034) ; 2026-10-25 — acceptée |
| **Décideurs** | Christophe Aboulicam |
| **Remplace** | [ADR-034](./adr-034-python-rust-migration.md), [ADR-058](./adr-058-pingora-integration.md) |
| **Amende** | [ADR-024](./adr-024-gateway-unified-modes.md) (reste ✅ Acceptée, « Amended by ADR-073 (2026-10-23) ») |
| **Amende** | [ADR-003](./adr-003-monorepo-architecture.md), [ADR-036](./adr-036-gateway-auto-registration.md), [ADR-039](./adr-039-mtls-cert-bound-tokens.md), [ADR-041](./adr-041-plugin-architecture-community-enterprise.md), [ADR-044](./adr-044-mcp-oauth-gateway-proxy.md), [ADR-057](./adr-057-product-lineup-gateway-link-connect.md), [ADR-059](./adr-059-simplified-deployment-sse.md), ADR-064 |
| **Liées** | [ADR-001](./adr-001-api-exposure-strategy.md), [ADR-035](./adr-035-gateway-adapter-pattern.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-038](./adr-038-sidecar-deployment-strategies-vm.md), [ADR-049](./adr-049-enterprise-ai-native-benchmark.md), ADR-061 |

## Contexte

### Situation actuelle

- Le plan de données de STOA est la **STOA Gateway**, une passerelle maison écrite en Rust (Tokio, axum), en production depuis février 2026 en mode `edge-mcp` ([ADR-024](./adr-024-gateway-unified-modes.md)). Un pool de connexions Pingora embarqué est disponible derrière une option de compilation ([ADR-058](./adr-058-pingora-integration.md)).
- Les modes `proxy`, `sidecar` et `shadow` de l'ADR-024 sont documentés comme prévus, non livrés.
- Outre le proxy HTTP, la passerelle porte l'authentification JWT et par clé d'API, le RBAC, l'évaluation OPA embarquée, le mTLS avec jetons liés à un certificat ([ADR-039](./adr-039-mtls-cert-bound-tokens.md)), le protocole MCP et son proxy de découverte OAuth 2.1 ([ADR-044](./adr-044-mcp-oauth-gateway-proxy.md)), la limitation de débit, le coupe-circuit, le comptage d'usage vers Kafka et des fonctions propres à l'IA (garde-fous, compression de jetons, routage LLM).
- Les déploiements suivent un chemin unique : plan de contrôle → SSE → STOA Link → passerelle → rappel ([ADR-059](./adr-059-simplified-deployment-sse.md)). Le plan de contrôle n'ouvre jamais de connexion vers le site qui héberge la passerelle.
- L'[ADR-057](./adr-057-product-lineup-gateway-link-connect.md) et l'ADR-059 donnent deux sens différents à « STOA Link » : un runtime sidecar en Rust (ADR-057) et l'agent de déploiement installé sur site, binaire `stoa-connect` (ADR-059). Le présent enregistrement tranche ce terme.
- Le dépôt va déjà dans ce sens : l'ADR-001 se réfère à la séparation plan de contrôle / plan de données du modèle Istio / Envoy, et le mode sidecar de l'ADR-024 sait déjà répondre au format `EnvoyExtAuthz`.

### Forces en présence

Les forces ci-dessous sont la lecture de la décision consignée par l'équipe documentation **[À confirmer : justification officielle]**.

1. **Où se situe la valeur de STOA.** STOA se positionne comme plateforme souveraine d'API / iPaaS, avec un module agents IA (MCP) **[À confirmer : périmètre d'« iPaaS »]**. Sa différenciation tient au contrat (UAC), au plan de contrôle, aux politiques, au multi-tenant, au portail et au module MCP — pas à un proxy HTTP généraliste.
2. **Coût et risque d'un proxy maison.** TLS, HTTP/2, streaming, gestion des connexions, répartition de charge et résilience sont critiques pour la sécurité et demandent une maintenance continue. Des proxys open source matures fournissent déjà chacun de ces éléments.
3. **Attentes des acheteurs régulés.** L'audience cible (organisations européennes régulées) privilégie des composants à gouvernance ouverte, dotés d'un processus de sécurité public et déjà connus de leurs équipes d'exploitation.
4. **Pression de la feuille de route.** Plusieurs capacités prévues pour la passerelle (routage du mode `proxy`, mise en miroir du trafic pour le mode `shadow`, autorisation externe) existent nativement dans Envoy.
5. **Contraintes à préserver.** Licence Apache 2.0 pour l'ensemble de STOA ([ADR-041](./adr-041-plugin-architecture-community-enterprise.md)) ; déploiement souverain sans connexion sortante obligatoire et installation entièrement hors ligne ([ADR-037](./adr-037-deployment-modes-sovereign-first.md)) ; chemin de déploiement unique de l'ADR-059.
6. **Retour d'expérience sur le chemin Pingora embarqué.** La gestion des erreurs sur le chemin de réponse amont du pool de connexions embarqué ([ADR-058](./adr-058-pingora-integration.md)) a demandé un travail spécifique pour qu'un échec de lecture d'un corps amont ne soit jamais relayé au client comme une réponse normale. La gestion amont d'Envoy couvre ces cas et est maintenue en amont ; la passerelle R1 continue de recevoir ses propres correctifs pendant sa maintenance (§9).
7. **Dépendance à Envoy et à sa gouvernance.** Envoy est un projet Graduated de la Cloud Native Computing Foundation depuis le 28 novembre 2018, sous licence Apache 2.0, avec une gouvernance neutre vis-à-vis des éditeurs, de nombreux mainteneurs indépendants et un processus public de divulgation des vulnérabilités. STOA utilise l'image amont non modifiée (§1) et n'a donc aucun fork à maintenir ; les risques résiduels sont le rythme des versions amont et la nécessité de mettre en miroir et de vérifier les images pour l'installation hors ligne (voir Atténuations).

## Options étudiées

| Option | Description | Pour | Contre | Issue |
|--------|-------------|------|--------|-------|
| **A. Conserver la passerelle Rust** | Poursuivre la feuille de route ADR-024 / ADR-058. | Continuité ; maîtrise complète ; tests et savoir-faire existants. | STOA continue de porter un proxy généraliste ; modes prévus encore à construire. | Rejetée |
| **B. Envoy amont + xDS servi par STOA Link + services externes STOA** | Envoy non modifié ; configuration générée depuis l'UAC et livrée par xDS ; logique STOA dans des services appelés par Envoy (`ext_authz`, `ext_proc`, journaux d'accès) et dans le module MCP placé derrière Envoy. | Les sujets proxy sont délégués à Envoy ; STOA garde son modèle et son plan de contrôle ; ni fork ni extension chargée ; même Envoy pour toutes les éditions. | Composants supplémentaires à côté d'Envoy ; couche de traduction UAC → xDS à construire et tester ; un saut réseau vers chaque service externe. | **Retenue** |
| **C. Envoy via Envoy Gateway** | STOA génère des ressources Kubernetes Gateway API ; Envoy Gateway produit le xDS. | API Kubernetes standard ; moins de code xDS dans STOA. | La configuration viendrait d'un contrôleur Kubernetes et non de STOA Link (contraire à la Décision §2) ; lie le plan de données à Kubernetes, alors que l'ADR-038 et STOA Link visent des sites sans Kubernetes. | Rejetée |
| **D. Envoy AI Gateway pour le trafic IA / MCP** | Réutiliser un projet communautaire de passerelle IA au-dessus d'Envoy pour le trafic LLM et MCP. | Projet communautaire sur le même plan de données. | Le traitement MCP reste dans le module MCP de STOA derrière Envoy (Décision §4) ; recouvrement avec les outils dérivés de l'UAC ; la configuration ne doit venir que de STOA Link (Décision §2). | Non retenue |
| **E. Un autre proxy** | Proxy entièrement basé sur Pingora (option A de l'ADR-058) ou autre proxy open source. | — | Non retenue le 2026-10-22. | Rejetée |
| **F. Envoy avec logique STOA chargée dans le processus** | Filtres Wasm, modules dynamiques ou filtres C++ spécifiques portant la logique STOA dans Envoy. | Pas de saut réseau vers des services externes. | Lie les versions de STOA à l'interface d'extension et au build d'Envoy ; impose des builds spécifiques ou un chargement à l'exécution ; isolation plus faible. | Rejetée (Décision §1) |

Les notes d'évaluation des options C, D et E sont à joindre **[À confirmer]**.

Aucun chiffre de performance n'est utilisé pour comparer les options. Toute affirmation de performance sur le plan de données Envoy proviendra d'un benchmark mené selon la méthodologie de l'[ADR-049](./adr-049-enterprise-ai-native-benchmark.md) **[À confirmer : date du benchmark]**.

## Décision

**STOA s'appuie sur Envoy pour son plan de données.** La passerelle maison en Rust n'est plus le plan de données stratégique. STOA fournit le plan de contrôle, la configuration que reçoit Envoy, les services externes qu'Envoy appelle, les politiques, le portail et le module MCP.

### 1. Envoy amont, non modifié, sans extension chargée

- STOA livre une version amont d'Envoy épinglée **[À confirmer : version et politique de mise à jour]**.
- STOA ne forke pas Envoy et ne charge **aucune extension dans Envoy** : ni filtre Wasm, ni module dynamique, ni filtre C++ spécifique, ni script Lua. Lua et Wasm sont exclus ; toute exception passe par une ADR.
- Envoy n'utilise que les filtres livrés avec la version épinglée (par exemple authentification JWT, autorisation externe, traitement externe, RBAC, limitation de débit locale, routage, mise en miroir), tous configurés par xDS.

### 2. Configuration exclusivement par xDS, depuis le plan de contrôle, via STOA Link

- Envoy reçoit sa configuration **uniquement par xDS**, servie sur le site client par **STOA Link**. Envoy n'est jamais configuré à la main, ni par des fichiers statiques d'écouteurs, de routes ou de clusters, ni par une API d'administration.
- L'amorçage statique (bootstrap) de chaque instance Envoy se limite à son identité de nœud et à l'adresse du serveur xDS du Link local **[À confirmer : contenu de l'amorçage et sécurité du canal Link ↔ Envoy]**.
- Le chemin de déploiement reste le chemin unique de l'ADR-059, **pour toutes les cibles** :

  ```text
  Console → API du plan de contrôle → SSE → STOA Link → xDS → Envoy
                                               ↓
                            rappel SYNCED / FAILED → API du plan de contrôle
  ```

  Pour une passerelle tierce, Link continue d'appliquer l'état voulu par l'interface de cette passerelle, comme le décrit l'ADR-059. Pour Envoy, Link publie les ressources xDS correspondantes. Aucun second chemin de déploiement n'est introduit, et le plan de contrôle n'ouvre toujours aucune connexion vers le site client.
- Link remonte `SYNCED` quand Envoy a accepté la configuration (ACK xDS) et `FAILED` quand Envoy la refuse (NACK xDS) **[À confirmer : règle quand plusieurs instances Envoy partagent un Link, et gestion des délais]**. La détection de dérive (`state.report` de l'ADR-059) s'appuie sur la version de configuration acquittée par chaque instance Envoy.
- La traduction UAC → xDS se fait dans le plan de contrôle, par un composant dédié séparé de l'API. Link ne fait que servir des instantanés versionnés de la configuration produite et garde le dernier instantané complet.

### 3. L'UAC reste la source de vérité

La configuration d'Envoy est générée à partir des contrats UAC, consommateurs, abonnements et politiques. Elle n'est jamais modifiée à la main.

### 4. La logique STOA s'exécute dans des services externes appelés par Envoy ; le module MCP est derrière Envoy

| Service | Interface Envoy | Responsabilités | Points ouverts |
|---------|-----------------|-----------------|----------------|
| **Service d'autorisation** | Autorisation externe (`ext_authz`) | Clés d'API, abonnements, isolation des tenants, politiques OPA au niveau HTTP, quotas consommateur (mise à jour atomique dans PostgreSQL pour les quotas facturés et les budgets MCP, compteurs écrits par lots pour les autres ; §10), et contrôles de liaison du §5 si Envoy ne les fait pas | Échec fermé (§10) : réglage explicite (`failure_mode_allow: false`, `status_on_error: 503`), réponse neutre identique au 403, aucune relance automatique des méthodes non idempotentes ni des appels MCP `tools/call`. Délai : à fixer après mesure. Nom, langage, mode audit pour la migration **[À confirmer]** ; document d'entrée et moteur OPA **[À confirmer]** |
| **Service de traitement** | Traitement externe (`ext_proc`) | Fonctions qui ont besoin du corps des requêtes ou des réponses : garde-fous, budgets de jetons, compression de jetons, transformation de corps | Affectation fonction par fonction tranchée dans l'amendement de chaque ADR concernée (voir « ADR remplacées, refondues et modifiées ») |
| **Module MCP** | Service amont derrière Envoy | Protocole MCP, registre d'outils, autorisation par outil, fédération, découverte paresseuse, skills | Langage, nom produit **[À confirmer]** |
| **Proxy de découverte OAuth 2.1 et DCR (ADR-044)** | Service amont derrière Envoy | Métadonnées curées, proxy d'enregistrement de clients, proxy de jeton | Servi par le module MCP ou par un service dédié **[À confirmer]** |
| **Collecteur de comptage d'usage** | Service de journaux d'accès | Événements d'usage vers Kafka | Transport et compatibilité du schéma d'événements **[À confirmer]** |

Il n'y a pas de service de limitation de débit séparé : les quotas consommateur sont contrôlés par le service d'autorisation, et le filtre `local_ratelimit` d'Envoy ne sert qu'à la protection grossière.

Envoy assure nativement l'écoute, la terminaison TLS et mTLS, le routage, la répartition de charge, les pools de connexions vers les backends, les délais, les reprises, le coupe-circuit, la détection d'hôtes défaillants (outlier detection), les contrôles de santé, les statistiques, le traçage et les journaux d'accès.

### 5. Liaison jeton–certificat et DPoP — à vérifier, non tranché

- Le filtre d'authentification JWT d'Envoy valide la signature des JWT et les revendications standard à partir du JWKS de Keycloak.
- La prise en charge, par le filtre d'authentification JWT de la version d'Envoy épinglée, des **jetons liés à un certificat (`cnf.x5t#S256`, RFC 8705)** et de la **validation des preuves DPoP (RFC 9449)** est à vérifier **[À confirmer]**.
- **Si l'une manque, le contrôle correspondant s'exécute dans le service d'autorisation (`ext_authz`).** Dans tous les cas, le contrat d'erreurs de l'ADR-039 (codes `MTLS_*` et statuts HTTP), les règles de normalisation de l'ADR-028 et la comparaison à temps constant sont conservés.
- Le composant qui termine le TLS client (Envoy ou un terminateur en bordure) et la façon dont les données du certificat parviennent au contrôle (en-tête de transmission du certificat client, nettoyage des en-têtes de certificat entrants) relèvent de la même vérification.

### 6. Community et Enterprise : même Envoy, configuration et services différents

- Community et Enterprise utilisent **la même version amont d'Envoy**. Il n'y a **pas de build d'Envoy propre à une édition**.
- Les éditions ne diffèrent que par la configuration générée par STOA (filtres et routes activés) et par les services externes STOA déployés et activés.
- Les feature flags Cargo de l'ADR-041 ne s'appliquent plus au plan de données. Les principes de l'ADR-041 (la sécurité n'est pas une option payante, le Community Core est un produit complet, Apache 2.0 pour tout) sont inchangés. Le module MCP et le mTLS font partie de Community. L'ADR-041 est à amender pour l'inscrire, avec l'édition des autres fonctions.

### 7. Sens de « STOA Link »

- **STOA Link est l'agent installé sur le site client** (binaire `stoa-connect`). Il maintient la connexion SSE sortante vers le plan de contrôle, sert le xDS local à Envoy, applique l'état voulu aux passerelles tierces, remonte `SYNCED` / `FAILED` et l'état observé, et enregistre les instances du plan de données qu'il gère ([ADR-036](./adr-036-gateway-auto-registration.md)) **[À confirmer : détails de l'enregistrement des instances Envoy]**.
  - *État d'implémentation :* le serveur xDS de Link est décidé mais **pas encore implémenté**. L'agent `stoa-connect` actuel synchronise les passerelles tierces en REST / SSE ; servir le xDS à Envoy est la cible.
- **Un sidecar n'est qu'une façon de déployer Envoy**, pas un produit. « STOA Gateway » désigne le plan de données basé sur Envoy avec ses services STOA, quelle que soit sa topologie (autonome ou sidecar).
- Les points d'accès `/api/v1/links/…` et la métrique `stoa_link_connections_active` de l'ADR-059 **ne changent pas**.
- L'ADR-057 est modifiée en conséquence : ses entrées « STOA Link » (sidecar Rust) et « STOA Connect » (agent Go) fusionnent en STOA Link, l'agent. Les ADR-003 et ADR-064 sont modifiées à la suite.
- La valeur du champ d'enregistrement `gateway_mode` utilisée par les instances Envoy est fixée par la refonte de l'ADR-024 et l'amendement de l'ADR-057 ; l'ADR-057 exige une ADR pour toute nouvelle valeur **[À confirmer]**.

### 8. Modes de passerelle : Amende l'ADR-024

L'ADR-024 garde son numéro et est réécrite pour Envoy. Les quatre positions fonctionnelles restent ; le binaire Rust unique et l'option `--mode` disparaissent. Un mode devient un profil de configuration généré par STOA, associé à l'ensemble des services externes déployés. Correspondance cible, à reporter dans l'ADR-024 :

| Mode ADR-024 | Avec Envoy |
|--------------|------------|
| `edge-mcp` | Envoy en frontal des agents IA, module MCP derrière Envoy, services d'autorisation et de traitement |
| `proxy` | Routes Envoy générées depuis les contrats UAC, avec les services externes STOA |
| `sidecar` | Envoy déployé en sidecar à côté d'une passerelle tierce ou d'une charge de travail, configuré par Link via xDS |
| `shadow` | Mise en miroir des requêtes par Envoy et journaux d'accès alimentant la génération d'UAC ; les prérequis de sécurité de l'ADR-024 restent applicables |

Pour l'instant, une passerelle tierce n'appelle pas directement le service d'autorisation STOA (`ext_authz`) ; le format de réponse `EnvoyExtAuthz` existant n'est pas utilisé à cette fin.

### 9. La STOA Gateway (Rust) passe en maintenance

Correctifs de sécurité uniquement, jusqu'à une date de fin de support à annoncer **[À confirmer]**. Un guide de migration et de retour arrière sera publié avec la première version qui livre le plan de données Envoy.

### 10. Placement des politiques

*État du périmètre :* le placement et les niveaux de politiques ci-dessous sont un **périmètre décidé, et non des fonctions livrées**. Comme pour le serveur xDS de Link (§7), aucune de ces politiques n'est encore disponible. La documentation ne présentera comme disponibles que les politiques du niveau v1, et seulement une fois livrées.

#### Où s'exécute chaque contrôle

| Composant | Contrôles |
|-----------|-----------|
| **Envoy — filtres natifs, configurés par xDS** | Validation des jetons (`jwt_authn`, JWKS local diffusé par xDS) ; RBAC grossier (`rbac`) ; filtrage IP et CORS ; limitation de débit locale (`local_ratelimit`, protection grossière uniquement) ; journaux d'accès |
| **Service d'autorisation (`ext_authz`)** | Un adaptateur gRPC `envoy.service.auth.v3`, placé devant la logique de politiques Rust existante (un adaptateur, pas une réécriture). Il contrôle : la liaison du jeton (`cnf`, `x5t#S256` ou DPoP) lorsque le filtre JWT ne le fait pas (§5) **[À confirmer]** ; le tenant ; l'abonnement actif ; les profils FAPI ; le jeton d'approbation défini par la décision sur l'approbation par l'opérateur (numéro d'ADR à attribuer) ; les quotas consommateur |
| **Module MCP, derrière Envoy** | Liste d'outils par tenant et garde-fous sur les arguments des outils (PII). Pas d'`ext_proc` pour le MCP en v1 |
| **Exclus** | eBPF et Wasm (Lua est déjà exclu par le §1) |

Les quotas consommateur sont donc contrôlés par le service d'autorisation (§4). Le filtre `local_ratelimit` d'Envoy ne sert qu'à la protection grossière ; il n'y a pas de service de limitation de débit séparé.

#### Niveaux de politiques

| Niveau | Politiques |
|--------|------------|
| **v1** | Authentification et autorisation ; registre de politiques ; une partie de trafic et quotas (dont les quotas consommateur, ci-dessous) ; gouvernance MCP |
| **Plus tard** | D'autres politiques de trafic et quotas ; d'autres politiques de gouvernance MCP ; proxy dynamique REST ; extensions ; modes ; cache ; transformation de corps |
| **Exclues** | Une politique du registre de politiques (eBPF) et une extension (Wasm) |
| **À confirmer** | Le relais SOAP **[À confirmer]** |

#### Quotas consommateur (v1)

- **Quotas non facturés :** compteurs en mémoire dans le service d'autorisation, écrits par lots dans PostgreSQL. Chaque lot porte un identifiant, pour que l'écriture puisse être rejouée sans effet. Perte maximale tolérée : à fixer après mesure. La limite locale de chaque réplica est égale au quota divisé par le nombre de réplicas.
- **Quotas facturés et budgets MCP :** un `UPDATE` atomique dans PostgreSQL à chaque requête, en échec fermé. Ils ne passent jamais par des compteurs écrits par lots.
- **En cas de panne :** mode dégradé borné pour les quotas non facturés ; échec fermé pour les quotas facturés et les budgets MCP.
- Latence p99 et comportement pendant une bascule PostgreSQL : à fixer après mesure. Aucune valeur n'est fixée avant cette mesure.

#### Panne du service d'autorisation

- Envoy refuse la requête. Le réglage est explicite : `failure_mode_allow: false`, `status_on_error: 503` (Envoy renvoie 403 par défaut) et un délai d'expiration court, dont la valeur est à fixer après mesure.
- Le corps de la réponse est neutre et identique à celui du 403, par exemple `{"error":"service_unavailable","request_id":"…"}`. Il ne contient ni nom de service, ni raison, ni en-tête `x-envoy-*`. Le détail n'est écrit que dans les journaux côté serveur, rattaché au `request_id`.
- La réponse porte un `Retry-After` borné. Envoy ne relance pas automatiquement les méthodes non idempotentes ni les requêtes MCP `tools/call`, pour éviter les tempêtes de relances et les doubles exécutions.
- Chaque requête MCP passe aussi par `ext_authz`, en plus de la politique OPA du module MCP, avec un test de contrat.

#### Tests

- Tests de contrat pour chaque politique du niveau v1.
- Test en CI de la rotation du JWKS hors réseau, le JWKS étant diffusé par xDS.

## Conséquences

### Positives

- STOA ne maintient plus de proxy HTTP généraliste ; l'effort d'ingénierie se reporte sur le contrat, les politiques, le plan de contrôle et le module MCP.
- Les capacités de proxy prévues (routage du mode `proxy`, mise en miroir du mode `shadow`, autorisation externe) deviennent de la configuration plutôt que du code nouveau.
- Un seul chemin de déploiement pour toutes les cibles, inchangé depuis l'ADR-059 ; le statut de déploiement reflète ce qu'Envoy a réellement accepté, ce qui renforce la détection de dérive.
- Ni build propre à une édition ni extension dans Envoy : les mises à jour d'Envoy suivent le processus de publication amont, et les services STOA évoluent indépendamment d'Envoy.
- La séparation plan de contrôle / plan de données de l'ADR-001 devient explicite et standard (xDS).
- Les opérateurs peuvent s'appuyer sur la documentation, l'outillage et le processus de sécurité d'Envoy pour la couche proxy.

### Négatives

- Davantage de composants dans le plan de données (Envoy, serveur xDS de STOA Link, services d'autorisation et de traitement, module MCP, collecteur de comptage d'usage) : plus à déployer, versionner et superviser.
- Chaque appel à un service externe ajoute un saut réseau ; son effet sur la latence doit être mesuré, pas supposé. Les contraintes de latence énoncées dans les ADR-050 et ADR-053 sont à revalider.
- Une couche de traduction UAC → xDS doit être construite et testée pour chaque fonction de l'UAC.
- Des différences de comportement pour les clients et les backends (casse des en-têtes, corps d'erreur, fenêtres de limitation, noms de métriques) doivent être documentées et traitées.
- La documentation, les tableaux de bord, les charts Helm et les automatisations construits autour de la passerelle Rust doivent être mis à jour ; le positionnement fondé sur Pingora ou sur le runtime Rust est retiré.
- Les équipes ont besoin de compétences d'exploitation et de débogage d'Envoy et de xDS.

### Atténuations

| Risque | Atténuation |
|--------|-------------|
| Service externe indisponible | Co-localisé avec Envoy ; comportement en panne explicite par service et par route. L'autorisation échoue en fermé (§10) : réglage explicite (`failure_mode_allow: false`, `status_on_error: 503`), réponse neutre identique au 403, aucune relance automatique des méthodes non idempotentes ni des appels MCP `tools/call` |
| Erreurs de traduction UAC → xDS | Le NACK d'Envoy remonte en `FAILED` ; tests de contrat par fonction UAC ; mode audit pendant la migration |
| Régressions de politiques | Même document d'entrée OPA lorsque c'est possible ; comparaison des décisions pendant la migration **[À confirmer]** |
| Latence ajoutée par les services externes | `ext_authz` pour les décisions sans corps ; `ext_proc` limité aux routes qui en ont besoin ; mesure avant toute publication |
| Sécurité de la surface d'administration | Interface d'administration d'Envoy liée au loopback et jamais utilisée pour la configuration |
| Chaîne d'approvisionnement en mode souverain | Image Envoy amont répliquée pour l'installation hors ligne exigée par l'ADR-037 ; processus de réplication et de signature **[À confirmer]** |

### Impact sur les autres composants

| Domaine | Impact |
|---------|--------|
| Chemin de déploiement ([ADR-059](./adr-059-simplified-deployment-sse.md)) | Inchangé dans son principe ; pour une cible Envoy, « appliquer l'état voulu » signifie « publier les ressources xDS », et `SYNCED` / `FAILED` proviennent de l'ACK / NACK |
| Gamme produit ([ADR-057](./adr-057-product-lineup-gateway-link-connect.md)) | STOA Gateway = Envoy + services STOA ; STOA Link = l'agent sur site ; le runtime sidecar Rust disparaît ; protocole d'enregistrement inchangé |
| Cadre des contrôleurs (ADR-064) | La traduction UAC → xDS se fait dans un composant dédié du plan de contrôle, séparé du processus de l'API ; le serveur xDS vit dans STOA Link, l'agent Go hors du processus de l'API du plan de contrôle, emplacement que l'ADR-064 attribue déjà à `stoa-connect` ; les workers de l'API du plan de contrôle restent tels quels, et les chemins retirés par l'ADR-059 ne sont pas réactivés |
| API d'administration de la passerelle | Non utilisée pour configurer le plan de données Envoy ; les éventuels diagnostics en lecture seule qui subsistent sont à lister **[À confirmer]** |
| Patron Gateway Adapter ([ADR-035](./adr-035-gateway-adapter-pattern.md)) | Adaptateurs de passerelles tierces inchangés ; la cible « STOA native » est atteinte par Link et xDS, jamais par une poussée du plan de contrôle |
| Sites sans Kubernetes ([ADR-038](./adr-038-sidecar-deployment-strategies-vm.md)) | Envoy, services STOA et Link tournent sur des VM ; empaquetage à préciser **[À confirmer]** |
| Documentation | Les pages qui présentent la passerelle Rust comme plan de données actuel, et les chiffres de benchmark publiés mesurés sur elle, doivent être mis à jour ou annotés |

## ADR remplacées, refondues et modifiées

| ADR | Titre | Changement | Motif |
|-----|-------|------------|-------|
| [ADR-034](./adr-034-python-rust-migration.md) | Stratégie de migration Python → Rust | 🔄 Remplacée par l'ADR-073 | La cible Rust du plan de données est remplacée ; sa méthode de migration (miroir, canari, retour arrière) peut servir à la bascule vers Envoy |
| [ADR-058](./adr-058-pingora-integration.md) | Intégration Pingora — pool de connexions embarqué | 🔄 Remplacée par l'ADR-073 | La gestion des connexions vers les backends passe à Envoy ; plus aucun chemin proxy maison |
| [ADR-024](./adr-024-gateway-unified-modes.md) | Architecture de passerelle unifiée — 4 modes | Amendée (même numéro) ; reste ✅ Acceptée, « Amended by ADR-073 (2026-10-23) » | Modes conservés comme positions fonctionnelles et réécrits pour Envoy (Décision §8) |
| [ADR-057](./adr-057-product-lineup-gateway-link-connect.md) | Gamme produit — Gateway, Link, Connect | Modifiée | Gateway = Envoy + services STOA ; Link = l'agent sur site (`stoa-connect`) ; entrées Link et Connect fusionnées ; le sidecar est une topologie (Décision §7) |
| [ADR-059](./adr-059-simplified-deployment-sse.md) | Déploiement simplifié par SSE | Modifiée (clarification) | Le chemin unique vaut pour toutes les cibles ; Link sert le xDS à Envoy ; l'ACK / NACK donne `SYNCED` / `FAILED` (Décision §2) |
| [ADR-003](./adr-003-monorepo-architecture.md) | Architecture monorepo | Modifiée | Note de statut : plan de données selon l'ADR-073 ; `stoa-link` et `stoa-connect` désignent le même agent |
| ADR-064 | Cadre des contrôleurs | Modifiée | Serveur xDS dans Link (Go, hors de l'API du plan de contrôle) consigné au regard du déclencheur de réévaluation Go ; sens de Link selon la Décision §7 |
| [ADR-036](./adr-036-gateway-auto-registration.md) | Auto-enregistrement des passerelles | Modifiée | Link enregistre les instances Envoy qu'il sert ; protocole inchangé |
| [ADR-039](./adr-039-mtls-cert-bound-tokens.md) | mTLS et jetons liés à un certificat (passerelle Rust) | Modifiée | Contrôles de liaison dans le filtre JWT d'Envoy ou dans `ext_authz` (Décision §5) ; contrat d'erreurs conservé |
| [ADR-041](./adr-041-plugin-architecture-community-enterprise.md) | Cœur communautaire vs extensions entreprise | Modifiée | Éditions par configuration et services externes, sans features Cargo ni build Envoy spécifique (Décision §6) |
| [ADR-044](./adr-044-mcp-oauth-gateway-proxy.md) | Proxy OAuth 2.1 MCP | Modifiée | Même comportement, servi par un service STOA derrière Envoy ; la liste codée en dur des chemins exemptés de mTLS devient une configuration de routes générée par STOA |

Les ADR suivantes gardent leur décision fonctionnelle ; leurs sections d'implémentation décrivent la passerelle Rust et seront réalignées dans un lot d'amendements qui suivra le présent enregistrement : [ADR-004](./adr-004-gateway-adapter-pattern.md), [ADR-021](./adr-021-uac-driven-observability.md), [ADR-023](./adr-023-zero-blind-spot-observability.md), [ADR-025](./adr-025-gateway-resilience-zombie.md), [ADR-027](./adr-027-x509-header-authentication.md), [ADR-028](./adr-028-rfc8705-certificate-binding.md), [ADR-031](./adr-031-ci-cd-reusable-workflow-architecture.md), [ADR-035](./adr-035-gateway-adapter-pattern.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-038](./adr-038-sidecar-deployment-strategies-vm.md), [ADR-043](./adr-043-kafka-mcp-event-bridge.md), [ADR-045](./adr-045-stoa-yaml-declarative-spec.md), [ADR-046](./adr-046-mcp-federation-architecture.md), [ADR-047](./adr-047-mcp-skills-system.md), [ADR-048](./adr-048-integrated-chat-agent.md), [ADR-049](./adr-049-enterprise-ai-native-benchmark.md), [ADR-050](./adr-050-guardrails-token-budget-state.md), [ADR-051](./adr-051-lazy-mcp-discovery.md), [ADR-053](./adr-053-llm-cost-aware-routing.md), [ADR-056](./adr-056-fapi-2-architecture.md), ADR-066. Pour chacune, le nouvel emplacement de la logique suit la Décision §4 : un service externe appelé par Envoy ou le module MCP, jamais une extension chargée dans Envoy.

L'[ADR-001](./adr-001-api-exposure-strategy.md) est inchangée et confortée par cette décision.

Dans l'index des ADR, la légende reçoit `🔄 Remplacée`, et la ligne *Gateway v2* du tableau « Aperçu des Choix Technologiques » (*Rust + eBPF* dans l'index FR, *Rust (Pingora)* dans l'index EN) devient *Plan de données — Envoy (amont) + services externes STOA*.

## Validation

Relecture en Council selon l'ADR-061, puis approbation par le décideur. Pas encore menée.

## Références

- [Documentation Envoy](https://www.envoyproxy.io/docs/envoy/latest/)
- [Protocole xDS](https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol)
- [Filtre d'autorisation externe](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter)
- [Filtre de traitement externe](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_proc_filter)
- [Filtre d'authentification JWT](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/jwt_authn_filter)
- [Limitation de débit locale](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter)
- [CNCF — projet Envoy](https://www.cncf.io/projects/envoy/)
- [RFC 8705 — authentification client OAuth 2.0 par TLS mutuel et jetons d'accès liés à un certificat](https://www.rfc-editor.org/rfc/rfc8705)
- [RFC 9449 — preuve de possession OAuth 2.0 (DPoP)](https://www.rfc-editor.org/rfc/rfc9449)

## Historique de la décision

| Date | Décision | Auteur |
|------|----------|--------|
| 2026-10-22 | Décision prise : le plan de données de STOA passe sur Envoy | Christophe Aboulicam |
| 2026-10-22 | Squelette d'ADR rédigé | Équipe documentation |
| 2026-10-23 | Décisions structurantes : logique STOA dans des services externes, module MCP derrière Envoy, aucune extension dans Envoy ; configuration uniquement par xDS via Link, chemin unique pour toutes les cibles ; éditions sans build Envoy spécifique ; ADR-024 amendée, ADR-034 remplacée ; « Link » = l'agent sur site | Christophe Aboulicam |
| 2026-10-23 | Enregistrement réécrit en ADR-072 | Équipe documentation |
| 2026-10-23 | Réponses aux questions ouvertes : traduction UAC → xDS dans un composant dédié du plan de contrôle, Link sert des instantanés versionnés ; ADR-024 reste acceptée, amendée par l'ADR-073 ; Lua et Wasm exclus ; module MCP et mTLS en Community ; pas d'appel direct à `ext_authz` par une passerelle tierce pour l'instant | Architecte |
| 2026-10-23 | Placement des politiques : adaptateur `ext_authz` devant la logique existante, politiques en trois niveaux, quotas consommateur en v1 ; comportement explicite en cas de panne d'`ext_authz` (Décision §10) | Christophe Aboulicam |
| 2026-10-25 | Renumérotée ADR-073 (le numéro 072 était déjà utilisé) ; enregistrement accepté | Christophe Aboulicam |

Les numéros d'ADR 069 à 072 sont réservés.

---

*Envoy est une marque de The Linux Foundation. Toutes les marques citées appartiennent à leurs propriétaires respectifs.*
