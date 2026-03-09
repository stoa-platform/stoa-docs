---
slug: webmethods-migration-guide
title: "Migration webMethods API Gateway vers l'open source (2026)"
authors: [stoa-team]
tags: [migration, comparison, api-gateway]
description: "Les coûts de licence Software AG augmentent ? Migrez vos politiques webMethods, services IS et alias vers un gateway open source avec cette feuille de route par phases."
keywords:
  - webmethods migration
  - software ag webmethods alternative
  - webmethods api gateway replacement
  - webmethods to open source
  - software ag migration 2026
  - webmethods integration server migration
  - webmethods ibm licensing
  - api gateway migration webmethods
  - webmethods open source alternative
  - enterprise api gateway modernization
---

<!-- last verified: 2026-02 -->

# Migration Software AG webMethods API Gateway : passer à l'open source en 2026

La migration de Software AG webMethods API Gateway™ vers une alternative open source est réalisable en 4 à 6 mois grâce à une approche par phases sans interruption de service. Ce guide couvre les spécificités des migrations webMethods — la dépendance à l'Integration Server (IS), le modèle de politiques basé sur Designer, l'imbrication avec les licences IBM — et fournit une feuille de route concrète pour les équipes plateforme prêtes à agir.

<!-- truncate -->

:::info Partie de la série Migration d'API Gateway
Cet article fait partie de notre [guide complet de migration d'API gateway](/blog/api-gateway-migration-guide-2026). Que vous migriez depuis webMethods, Layer7, Axway ou Apigee, les principes fondamentaux de migration sont les mêmes — mais les défis spécifiques à chaque plateforme diffèrent considérablement.
:::

## Pourquoi les équipes évaluent des alternatives à webMethods en 2026

Software AG webMethods API Gateway est une référence dans la gestion des APIs des services financiers, des télécommunications et du secteur public depuis plus d'une décennie. Son intégration étroite avec le webMethods Integration Server, son registre de services robuste et sa gestion approfondie XML/EDI en ont fait le choix par défaut pour les entreprises construisant sur une infrastructure SOA dans les années 2000 et 2010. Plusieurs forces poussent aujourd'hui à évaluer sérieusement des alternatives.

### Le point d'inflexion des licences IBM

La question qui préoccupe la plupart des clients webMethods est celle des licences IBM. Les installations webMethods dans les grandes entreprises coexistent fréquemment avec — ou dépendent de — le middleware IBM (MQ, DataPower, WebSphere), et les coûts de licence de ces stacks constituent un point de douleur persistant. Alors que les entreprises renégocient leurs accords logiciels en 2025-2026, le coût combiné des licences runtime webMethods plus l'intégration middleware IBM devient de plus en plus difficile à justifier face à des alternatives open source offrant des fonctionnalités comparables au seul coût de l'infrastructure.

Ce n'est pas une préoccupation abstraite. Les équipes plateforme des services financiers qui opèrent webMethods depuis 10 ans ou plus sont désormais invitées par leurs DAFs à quantifier le coût de la continuation versus le coût de la migration. Dans bien des cas, la migration s'autofinance en 18 à 24 mois grâce aux seules économies de licences.

### L'Integration Server comme passif

Le webMethods Integration Server est à la fois le plus grand atout de webMethods et son principal obstacle à la migration. IS gère la lourde tâche de l'intégration enterprise — transformation de messages complexes, traitement EDI, gestion des partenaires commerciaux, protocoles B2B — et est profondément imbriqué avec la couche API Gateway. Les APIs gérées par webMethods API Gateway dépendent souvent des services de flux IS pour l'authentification, la transformation ou la logique de routage qui ne peut pas être proprement séparée.

Pour les équipes dont le déploiement webMethods est principalement un API Gateway (APIs REST, authentification OAuth2/clé API, portail développeur), cette dépendance est gérable. Pour les équipes dont le déploiement webMethods est une implémentation ESB complète avec IS en son cœur, la migration du gateway doit être séquencée avec soin pour éviter de perturber les services dépendants d'IS avant qu'une couche d'intégration de remplacement soit en place.

L'insight clé : **la migration de l'API Gateway webMethods et la migration du webMethods Integration Server sont des projets différents avec des calendriers et des profils de risque différents.** Ce guide couvre spécifiquement la migration de l'API Gateway.

### Friction avec Kubernetes et GitOps

webMethods a été conçu pour des déploiements sur VM et serveurs d'applications JEE. Le déploiement conteneurisé (via Docker) est supporté, mais le modèle opérationnel — configuration de politiques basée sur Designer, packages de déploiement propriétaires, interface Administrator UI centralisée — ne se mappe pas naturellement aux workflows GitOps, au déploiement basé sur Helm ou à l'autoscaling natif Kubernetes. Les équipes ayant investi dans l'infrastructure Kubernetes constatent que l'exploitation de webMethods dessus nécessite un travail d'adaptation continu plutôt qu'une intégration native.

### APIs zombies et invisibilité du catalogue

Un pattern rencontré systématiquement dans les déploiements webMethods matures est ce que les praticiens appellent les « APIs zombies » : des services enregistrés dans le webMethods Service Registry qui ne sont plus activement maintenus, dont les propriétaires ont changé, dont la base de consommateurs est inconnue et dont la documentation est obsolète ou absente. Le Service Registry a été conçu pour résoudre les problèmes de catalogue, mais sans gouvernance active il devient une archive historique plutôt qu'un catalogue vivant.

Les solutions de portail API modernes — abonnement en self-service, intégration automatisée, analytics des consommateurs — font de l'identification et de la remédiation des APIs zombies un sous-produit des opérations normales plutôt qu'un projet de gouvernance dédié.

### Exigences d'intégration des agents IA

webMethods n'a pas été conçu pour les agents IA en tant que consommateurs d'API. Le support MCP (Model Context Protocol), la découverte d'outils pour les workloads agentiques, la gestion des réponses en streaming et le comptage par agent nécessitent des capacités qui ne sont pas disponibles dans l'architecture webMethods API Gateway et ne peuvent pas être ajoutées en tant qu'extensions sans développement personnalisé significatif.

## Comparaison des fonctionnalités

Le tableau suivant mappe les capacités de webMethods API Gateway à leurs équivalents open source. La disponibilité des fonctionnalités est basée sur la documentation publiquement disponible.

| Capacité | Software AG webMethods API Gateway™ | Alternative open source (STOA) |
|---|---|---|
| **Routage API** | Routage basé sur flux via services IS | Correspondance de routes, normalisation de chemins, réécriture d'URLs |
| **Authentification** | OAuth2, clé API, Basic, SAML, LDAP, JWT | OAuth2/OIDC (Keycloak), clé API, mTLS, JWT |
| **Autorisation** | Basée sur les rôles, groupes LDAP, custom IS | Moteur de politiques OPA (ABAC), portées par tenant |
| **Rate Limiting** | Politiques de quota par application, par API | Quotas par tenant, par outil, par API |
| **Portail API** | webMethods Developer Portal | Developer Portal (React, découverte API + abonnements) |
| **Catalogue API** | webMethods Service Registry | Control Plane API + Console UI |
| **Monitoring du trafic** | webMethods Mediator + API Analytics | Métriques Prometheus, tableaux de bord Grafana, OpenTelemetry |
| **Moteur de politiques** | Services de flux basés sur Designer (IS) | Politiques OPA/Rego (code-as-policy, GitOps) |
| **Support de protocoles** | REST, SOAP, XML, EDI, JMS, JDBC | REST, MCP, SSE, WebSocket |
| **Déploiement** | VM, JEE, Docker (Kubernetes limité) | Natif Kubernetes (Helm), Docker Compose |
| **Multi-Tenancy** | Environnements multi-stages, isolation tenant IS | Isolation tenant au niveau namespace (CRDs) |
| **Support agents IA** | Non supporté nativement | MCP gateway natif, découverte d'outils, comptage d'agents |
| **Configuration** | Designer GUI + packages de déploiement | YAML/CRDs déclaratif, GitOps, CLI |
| **SSO/Fédération** | Fédération SAML, intégration LDAP IS | Keycloak (pont IdP SAML, OIDC natif) |
| **Gestion des certificats** | Keystore webMethods, truststore IS | cert-manager + module mTLS |
| **Haute disponibilité** | Clustering IS, HA API Gateway | Réplicas Kubernetes + HPA |
| **B2B/EDI** | Trading Networks, traitement EDI via IS | Hors périmètre — garder IS pour les workloads B2B |
| **Licences** | Commerciales (abonnement Software AG) | Apache 2.0 (entièrement open source) |

### Où webMethods a des atouts

La plateforme webMethods reflète plus de 20 ans d'expertise en intégration enterprise :

- **Profondeur de l'Integration Server** : IS gère la transformation de messages complexes, la médiation de protocoles et le traitement B2B à un niveau de maturité que les alternatives open source n'ont pas encore totalement reproduit. Pour les workloads B2B, le traitement EDI et la gestion des partenaires commerciaux, IS reste l'outil approprié.
- **Outillage Designer** : Le webMethods Designer fournit un environnement de développement visuel basé sur les flux que de nombreuses équipes enterprise trouvent productif pour la logique d'intégration complexe. Les équipes qui se sont standardisées sur les workflows Designer ont des connaissances institutionnelles significatives investies.
- **Gouvernance du Service Registry** : Le webMethods Service Registry, lorsqu'il est activement gouverné, fournit une source unique de vérité pour le catalogue enterprise d'APIs et de services qui s'intègre avec le pipeline de déploiement IS.
- **Observabilité Mediator** : webMethods Mediator fournit des analyses détaillées du trafic API incluant la journalisation des payloads (avec masquage), le suivi des consommateurs et le monitoring des SLAs — des capacités sur lesquelles les équipes de conformité enterprise s'appuient.

### Où l'open source a des avantages

- **Support des agents IA** : Protocole MCP natif, découverte d'outils et comptage d'agents — conçu pour le paysage actuel des consommateurs d'API.
- **Opérations GitOps-first** : Toute la configuration est du YAML déclaratif dans Git. Pas de dépendance à Designer, pas de pipeline de déploiement de packages, pas de format propriétaire.
- **Natif Kubernetes** : Déploiement Helm, scaling natif Kubernetes, intégration service mesh.
- **Transparence des coûts** : Licence Apache 2.0 sans frais par cœur, par API ou par transaction.
- **Self-service développeur** : UX de portail moderne qui réduit l'intégration des APIs de jours à minutes.

## Comprendre l'architecture webMethods avant de migrer

Une migration réussie nécessite de comprendre quels composants de votre déploiement webMethods sont dans le périmètre et lesquels ne le sont pas. webMethods n'est pas un produit unique — c'est une suite, et le périmètre de migration dépend des composants que vous utilisez réellement.

**Dans le périmètre pour la migration de l'API Gateway :**

- webMethods API Gateway (le runtime gateway gérant le trafic API entrant)
- webMethods Developer Portal (le catalogue API côté consommateur et la gestion des abonnements)
- webMethods API Analytics (monitoring du trafic et reporting)
- Configuration des politiques au niveau du gateway (OAuth2, rate limiting, routage, transformation à la frontière du gateway)

**Hors périmètre — maintenir IS pour ces éléments :**

- Flux webMethods Integration Server qui implémentent la logique métier
- Trading Networks (traitement B2B/EDI)
- webMethods Broker / Universal Messaging (streaming d'événements)
- Framework d'adaptateurs basé sur IS (SAP, Salesforce, adaptateurs de bases de données)

La frontière entre « gateway » et « IS » n'est pas toujours nette dans les déploiements webMethods matures. Des APIs qui semblent proxy directement vers un backend peuvent en réalité router via des services de flux IS pour l'authentification, l'enrichissement ou la journalisation — et ce service IS peut dépendre d'autres services IS, d'adaptateurs IS ou de files IBM MQ. Le mapping des dépendances IS en Phase 1 de la migration est critique précisément à cause de ce flou.

## Feuille de route de migration

### Phase 1 : Évaluation et mapping des dépendances IS (Semaines 1-5)

Le risque spécifique à webMethods en Phase 1 est la découverte des dépendances IS. Avant de pouvoir classer une API comme candidate à la migration, vous devez savoir si elle route via IS et, si oui, ce que fait le service de flux IS.

**Mapping des dépendances IS :**

Pour chaque API enregistrée dans l'API Gateway, documenter :
- Proxy-t-elle directement vers un backend, ou route-t-elle via un service de flux IS ?
- Si via IS : que fait le service de flux ? (Transformation uniquement ? Orchestration de plusieurs backends ? Application de règles métier ?)
- Cette logique IS peut-elle être remplacée par une politique OPA sur le nouveau gateway, déplacée vers le service backend, ou IS doit-il rester dans le chemin ?

Le résultat de ce mapping détermine quelles APIs peuvent migrer indépendamment et lesquelles nécessitent un projet de migration IS parallèle.

**Export du Service Registry :**

Exportez un snapshot complet du webMethods Service Registry. C'est votre inventaire de départ. Pour chaque service enregistré, documenter : version, équipe propriétaire, liste des consommateurs (depuis API Analytics), date du dernier déploiement, niveau de SLA et méthode d'authentification.

Marquer les services sans activité consommateur durant les 90 jours précédents comme candidats aux APIs zombies — ceux-ci peuvent être dépréciés plutôt que migrés, ce qui réduit le périmètre de migration.

**Évaluation de l'infrastructure :**

| Composant | Ce qu'il faut documenter |
|-----------|--------------------------|
| Instances IS | Nombre, version, mode de clustering, liste des packages |
| Instances API Gateway | Nombre, version, environnements de staging |
| Developer Portal | Version, personnalisations, intégration SSO |
| Intégration identity | Structure LDAP, fournisseur OAuth2, points de fédération SAML |
| Intégration IBM MQ | Liaisons de files dont dépendent les flux API |
| Certificats | Keystore API Gateway, contenu du truststore IS |
| Patterns de trafic | TPS par API, charge de pointe, seuils SLA |

### Phase 2 : Déploiement sidecar (Semaines 6-9)

Déployez le nouveau gateway aux côtés de webMethods sans toucher au trafic de production. Le nouveau gateway gère uniquement les nouvelles APIs et le trafic des agents IA à ce stade.

```
Flux existant (inchangé) :
  Tous les consommateurs → webMethods API Gateway → IS → APIs Backend

Nouveau flux (ajouté en parallèle) :
  Agents IA   → STOA MCP Gateway  → APIs Backend
  Nouvelles APIs → STOA API Gateway  → APIs Backend
```

**Règle établie en Phase 2** : Toutes les nouvelles APIs passent par STOA à partir de ce point. webMethods ne reçoit aucun nouveau service après cette date. C'est le moment où la migration devient réelle pour l'organisation — appliquez-le explicitement.

Configurez Keycloak pour fédérer avec votre fournisseur d'identité existant. Si votre déploiement webMethods utilise LDAP pour l'authentification des consommateurs d'API, configurez le fournisseur LDAP de Keycloak. S'il utilise un point de fédération SAML, configurez Keycloak comme SP SAML. L'objectif est la continuité de l'identité — les consommateurs d'API ne devraient pas avoir besoin de se réauthentifier ou de recevoir de nouvelles credentials pendant la migration.

### Phase 3 : Activation du cockpit et de l'observabilité (Semaines 8-11, chevauche la Phase 2)

L'une des captures de valeur immédiates de la migration est de remplacer les analytics en silos de webMethods par une observabilité unifiée sur l'ancien et le nouveau gateway. Déployez la pile d'observabilité (Prometheus, Grafana, Loki) et configurez-la pour collecter des métriques à la fois du nouveau gateway STOA et — dans la mesure du possible — de webMethods Mediator via JMX ou Prometheus JMX exporter.

Le résultat est un tableau de bord Grafana unique montrant le trafic sur les deux gateways pendant la période de migration. Cela donne aux équipes plateforme une visibilité immédiate sur la progression de la migration et offre aux équipes de conformité un audit trail continu.

Activez le Control Plane STOA pour les APIs déjà en cours sur le nouveau gateway. Le Control Plane fournit une gestion des abonnements en self-service qui remplace le workflow manuel d'email-et-réunion typiquement utilisé pour les demandes d'accès aux APIs webMethods. C'est un gain de productivité immédiat qui renforce la confiance des parties prenantes dans la migration.

### Phase 4 : Traduction des politiques (Semaines 10-17)

La traduction des politiques webMethods a deux voies : les politiques au niveau gateway (qui se traduisent proprement) et les politiques dépendantes d'IS (qui nécessitent une décision séparée).

**Traduction des politiques au niveau gateway :**

| Politique webMethods | Équivalent open source | Notes |
|---|---|---|
| Validation token OAuth2 | Validation JWT (intégrée) | Flux OIDC standard |
| Authentification par clé API | Politique de clé API | Équivalent direct |
| Autorisation par groupes LDAP | LDAP Keycloak + politique OPA | Groupes exposés comme claims OIDC |
| Rate limiting par application | Politique de quota par tenant | Configurable par API, par consommateur |
| Transformation requête/réponse (niveau gateway) | Politique de transformation gateway | Transformations simples uniquement |
| Whitelist/blacklist IP | NetworkPolicy Kubernetes + gateway | Réseau Kubernetes natif |
| Terminaison SSL/TLS | cert-manager + ingress Kubernetes | Pattern Kubernetes standard |
| Audit logging | OpenTelemetry + logs structurés | Audit trail basé sur les standards |
| Politique CORS | Politique CORS gateway | Équivalent direct |

**Décisions pour les politiques dépendantes d'IS :**

Pour chaque API avec des dépendances aux services de flux IS, vous avez trois options :

*Option A : Absorber dans le gateway.* Si le service de flux IS effectue uniquement une transformation simple (mapping de champs, conversion de format) sans orchestration ni logique métier, implémentez l'équivalent comme une politique de transformation gateway. Supprimez la dépendance IS.

*Option B : Déplacer vers la couche service.* Si le service de flux IS effectue une orchestration ou de la logique métier, déplacez cette logique vers un microservice dans le tier backend. Le gateway devient un proxy pur ; la logique métier se déplace là où elle appartient.

*Option C : Maintenir IS dans le chemin.* Si le service de flux IS est complexe, business-critique et ne vaut pas l'effort de traduction, gardez IS en cours d'exécution et proxy-ez vers lui depuis le nouveau gateway. Le nouveau gateway gère les politiques côté consommateur (auth, rate limiting, routage) tandis qu'IS continue de gérer la logique d'intégration. C'est une architecture valide à long terme pour de nombreuses organisations.

L'Option C est particulièrement pertinente pour les organisations avec de grands patrimoines IS : vous pouvez migrer la couche API Gateway et différer indéfiniment la décision de modernisation IS.

### Phase 5 : Migration du trafic (Semaines 15-22)

La migration du trafic en canary suit la séquence standard. Pour webMethods, accordez une attention particulière à :

**Continuité des credentials des consommateurs.** Si votre déploiement webMethods a émis des clés API ou des credentials client OAuth2 aux consommateurs, ces credentials doivent rester valides pendant la transition. Configurez le nouveau gateway pour honorer les credentials existants (en les important ou en maintenant un pont via Keycloak) ou coordonnez une rotation de credentials avec les consommateurs avant la migration de leur trafic.

**Continuité des analytics Mediator.** Si les équipes de conformité ou d'audit dépendent des analytics webMethods Mediator pour les rapports réglementaires, assurez-vous que des données équivalentes sont disponibles dans la nouvelle pile d'observabilité avant de migrer le trafic. Ne créez pas de lacune dans l'audit trail.

**APIs avec IS dans le chemin.** Pour les APIs Option C (IS dans le chemin), la migration du trafic est plus simple : le nouveau gateway devient le point d'entrée côté consommateur, IS reste comme backend. Validez que la connexion gateway-to-IS (typiquement REST ou SOAP) est correctement configurée et testée avant de migrer le trafic de production.

Séquence canary standard :

| Étape | Trafic nouveau gateway | Observation |
|-------|------------------------|-------------|
| Canary | 5% | 48 heures, surveiller latence + erreurs |
| Précoce | 25% | 1 semaine |
| Split | 50% | 1 semaine |
| Tardif | 90% | 2 semaines |
| Complet | 100% | webMethods en standby |

### Phase 6 : Migration du portail développeur (Semaines 18-24, voie parallèle)

La migration du webMethods Developer Portal peut se dérouler en parallèle avec la migration du trafic. Le nouveau portail (STOA) devrait être opérationnel et peuplé de documentation d'API avant que les consommateurs soient invités à l'utiliser.

Étapes clés :

- Importer les spécifications API depuis le Service Registry (format OpenAPI/Swagger)
- Configurer les workflows d'abonnement en self-service pour remplacer les processus manuels de demande d'accès
- Migrer les enregistrements d'applications consommateurs existants vers le nouveau portail
- Rediriger le DNS du portail développeur vers le nouveau portail
- Communiquer la transition à tous les consommateurs enregistrés avec un préavis adéquat

La capacité d'abonnement en self-service du nouveau portail — demander l'accès, approbation automatique ou par le propriétaire, réception immédiate des credentials — est typiquement l'amélioration la plus visible pour les consommateurs d'API et génère le retour positif le plus clair pendant la migration.

### Phase 7 : Décommissionnement (Semaines 22-30)

Le décommissionnement de webMethods nécessite une attention particulière aux dépendances IS. Même si le trafic API Gateway a été entièrement migré, IS peut encore fonctionner et servir les APIs Option C (IS dans le chemin depuis le nouveau gateway). Le plan de décommissionnement doit distinguer :

- **Décommissionnement de l'API Gateway** : Supprimer les instances webMethods API Gateway, mettre à jour les règles d'ingress, archiver les packages de configuration gateway.
- **Décommissionnement du Developer Portal** : Archiver le contenu du portail, décommissionner les serveurs du portail, supprimer les entrées DNS.
- **Opération continue d'IS** : Les instances IS qui servent les APIs Option C continuent de fonctionner. Celles-ci sont maintenues sous un modèle d'opérations IS séparé, non décommissionné.
- **Archivage du Service Registry** : Exporter le contenu du Service Registry pour archivage avant le décommissionnement. C'est l'enregistrement historique de chaque API qui a jamais été gérée par webMethods.

## Défis courants et solutions

### Défi 1 : Enchevêtrement des dépendances IS

La source la plus courante de retards de migration est la découverte de dépendances IS qui n'étaient pas visibles dans l'inventaire initial. Une API REST qui semble proxy directement vers un backend peut en réalité router via un service de flux IS pour l'authentification, l'enrichissement ou la journalisation — et ce service IS peut dépendre d'autres services IS, d'adaptateurs IS ou de files IBM MQ.

**Solution :** Instrumentez IS avant de démarrer la migration. Ajoutez de la journalisation aux services de flux IS qui enregistre quels services API Gateway les invoquent. Exécutez cette instrumentation pendant 30 jours pour construire une image complète du graphe d'invocations IS. Le résultat est une carte de dépendances qui rend les décisions Option A/B/C simples.

### Défi 2 : Remédiation des APIs zombies

Les déploiements webMethods matures contiennent typiquement un pourcentage significatif de services enregistrés avec un trafic nul ou quasi nul. Migrer ces services consomme du temps et des ressources sans créer de valeur.

**Solution :** Avant le début de la migration, publiez une liste d'APIs zombies aux propriétaires de services et demandez une confirmation dans les 30 jours. Les services sans propriétaire confirmé et sans trafic sont candidats à la dépréciation. Réduire le périmètre de migration de seulement 20% par dépréciation a un impact significatif sur le calendrier et le coût globaux.

### Défi 3 : Intégration IBM MQ

Les APIs qui dépendent d'IBM MQ pour la livraison de messages (via adaptateur IS ou liaison MQ directe) nécessitent une gestion particulière. Le nouveau gateway n'a pas d'intégration IBM MQ native.

**Solution :** C'est un scénario Option C. Gardez IS dans le chemin pour les APIs dépendantes de MQ. Le nouveau gateway gère l'authentification côté consommateur et le rate limiting ; IS continue de gérer l'interaction MQ. C'est une architecture valide à long terme — l'intégration IBM MQ n'est pas une dépendance qui doit être éliminée dans le calendrier de migration du gateway.

### Défi 4 : Remplacement du workflow Designer

Les équipes plateforme qui se sont standardisées sur webMethods Designer pour le développement et le déploiement d'API ont un défi de changement de workflow aussi significatif que la migration technique. Designer fournit un environnement de développement visuel que les équipes trouvent productif ; le remplacer par un GitOps basé sur YAML nécessite formation et outillage.

**Solution :** Investissez dans l'outillage et la formation GitOps en parallèle avec la migration technique. L'investissement se rembourse dans le temps en auditabilité, reproductibilité et intégration CI/CD — mais il nécessite une gestion du changement explicite, pas seulement un remplacement d'outil.

### Défi 5 : Remplacement des analytics webMethods

Les équipes de conformité qui dépendent des analytics webMethods Mediator pour les rapports réglementaires ont besoin d'assurance que des données équivalentes sont disponibles dans la nouvelle pile d'observabilité avant que la migration ne soit terminée.

**Solution :** Faites fonctionner la nouvelle pile d'observabilité (Prometheus, Grafana, Loki) en parallèle avec webMethods Mediator pendant la phase de migration du trafic. Démontrez l'équivalence aux équipes de conformité avant de migrer les APIs hautement critiques. Exportez les données historiques Mediator pour archivage avant le décommissionnement.

### Défi 6 : Complexité du cloud hybride

De nombreuses entreprises exploitent webMethods dans une configuration hybride — certaines instances gateway sur site, d'autres dans le cloud. Cela complique le séquençage de la migration et la planification de la connectivité réseau.

**Solution :** L'architecture hybride de STOA — plan de contrôle cloud, runtime gateway sur site — est conçue exactement pour ce pattern. Le plan de contrôle (portail, catalogue API, observabilité) fonctionne dans le cloud ; le runtime gateway qui gère le trafic fonctionne sur site. Cela préserve la résidence des données pour les APIs sur site tout en fournissant la simplicité opérationnelle gérée par le cloud. Voir le [guide de déploiement hybride](/docs/deployment/hybrid).

## Résumé du calendrier

Pour un déploiement webMethods de taille moyenne (50-150 APIs, 2-3 instances IS, complexité d'intégration IS modeste) :

| Phase | Durée | Équipe | Risque |
|-------|-------|--------|--------|
| Évaluation + mapping IS | 5 semaines | 2 architectes | Aucun |
| Déploiement sidecar | 4 semaines | 1-2 ingénieurs plateforme | Faible |
| Activation de l'observabilité | 3 semaines (parallèle) | 1 ingénieur | Faible |
| Traduction des politiques | 7 semaines | 2-4 ingénieurs | Faible-Moyen |
| Migration du trafic | 7 semaines | 2-3 ingénieurs | Moyen (canary) |
| Migration du portail | 6 semaines (parallèle) | 1-2 ingénieurs | Faible |
| Décommissionnement | 4-6 semaines | 1-2 ingénieurs | Faible |
| **Total** | **5-7 mois** | **Pic : 4-6 personnes** | |

La complexité de l'intégration IS est la variable principale. Ajoutez 2-4 semaines pour chaque voie de dépendance IS significative qui nécessite l'Option B (déplacer vers la couche service) plutôt que l'Option C (garder IS dans le chemin).

## Foire aux questions

### Dois-je migrer webMethods Integration Server en même temps ?

Non. La migration IS et la migration de l'API Gateway sont des projets indépendants. La plupart des organisations migrent d'abord l'API Gateway (3-6 mois) et prennent une décision séparée sur la modernisation IS sur un calendrier plus long. L'Option C (garder IS dans le chemin depuis le nouveau gateway) est une architecture supportée à long terme.

### Que deviennent mes politiques webMethods API Gateway pendant la migration ?

Les politiques au niveau gateway (OAuth2, rate limiting, routage, CORS) se traduisent en politiques équivalentes sur le nouveau gateway. Les politiques dépendantes d'IS nécessitent une décision séparée (absorber, déplacer vers la couche service, ou maintenir IS). Les bundles de politiques peuvent être exportés depuis l'Administrator UI pour archivage.

### Le nouveau gateway peut-il coexister avec webMethods pendant la migration ?

Oui. Le pattern de déploiement sidecar maintient webMethods en cours d'exécution en parallèle tout au long de la migration. Le trafic peut être redirigé vers webMethods avec un changement DNS ou d'ingress en moins d'une minute à n'importe quelle étape.

### Qu'en est-il de webMethods Trading Networks et des workloads B2B ?

Hors périmètre pour la migration de l'API Gateway. Trading Networks est une capacité IS-tier pour le traitement EDI et B2B — elle n'a pas d'équivalent dans les API gateways modernes et devrait être maintenue sur IS. Un projet séparé de modernisation de la plateforme B2B (si nécessaire) traiterait Trading Networks indépendamment.

### Comment cela affecte-t-il mon accord de licence Software AG ?

Consultez votre accord de licence Software AG concernant les conditions de réduction de la capacité sous licence ou de décommissionnement d'instances. Dans la plupart des accords enterprise, les licences webMethods sont liées aux cœurs de processeur ou aux comptes d'utilisateurs nommés sur des instances serveur spécifiques. Le décommissionnement d'instances gateway réduit l'empreinte sous licence — coordonnez avec Software AG lors de la Phase 6 (décommissionnement), pas avant.

### STOA est-il disponible en déploiement sur site pour les environnements réglementés ?

Oui. STOA est conçu pour le déploiement sur site dans les environnements réglementés. Le plan de contrôle (portail, catalogue, observabilité) peut fonctionner sur site ou dans un cloud privé ; le runtime gateway fonctionne sur site par défaut. Cette architecture répond aux exigences européennes de résidence des données dans le cadre de NIS2 et DORA. Voir le [guide de déploiement hybride](/docs/deployment/hybrid).

## Prochaines étapes

- **[Guide de migration API Gateway 2026 →](/blog/api-gateway-migration-guide-2026)** — Cadre de migration indépendant des fournisseurs applicable à toutes les plateformes legacy
- **[Guide de migration Broadcom Layer7 →](/blog/layer7-ca-api-gateway-migration-stoa)** — Guidance détaillée pour les équipes migrant depuis Layer7
- **[Guide de déploiement hybride STOA →](/docs/deployment/hybrid)** — Référence d'architecture pour le plan de contrôle cloud + runtime gateway sur site
- **[Démarrage rapide STOA →](/docs/guides/quickstart)** — Déployez en 15 minutes pour évaluation

---

> Ce guide décrit les étapes techniques de migration et n'implique aucune déficience de la plateforme source. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques commerciales (Software AG, webMethods, IBM, IBM MQ) appartiennent à leurs propriétaires respectifs.

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible en date de février 2026. Les capacités des produits changent fréquemment — vérifiez les fonctionnalités actuelles directement auprès de chaque fournisseur. Voir [marques commerciales](/docs/legal/trademarks) pour plus de détails.
