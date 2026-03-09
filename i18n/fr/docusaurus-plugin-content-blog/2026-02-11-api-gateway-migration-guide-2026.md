---
slug: api-gateway-migration-guide-2026
title: "Guide de migration API Gateway : du legacy vers le prêt-pour-l'IA (2026)"
authors: [stoa-team]
tags: [migration, api-gateway, ai, mcp]
description: "Vous migrez depuis Layer7, webMethods ou Apigee ? Cadre d'évaluation étape par étape, traduction des politiques et migration du trafic sans interruption."
keywords:
  - api gateway migration
  - api gateway migration guide 2026
  - legacy api gateway replacement
  - layer7 migration
  - webmethods migration
  - axway migration
  - apigee migration
  - api gateway modernization
  - open source api gateway
  - enterprise api gateway
  - api gateway ai agents
  - mcp api gateway
  - european api gateway
---

<!-- last verified: 2026-02 -->

# Guide de migration API Gateway 2026 : des plateformes legacy vers une infrastructure prête pour l'IA

Migrer depuis un API gateway legacy est l'un des projets d'infrastructure à plus enjeux qu'une équipe plateforme enterprise peut entreprendre. Bien exécuté, il élimine des années de dette technique accumulée, réduit les coûts de licence et ouvre la porte à l'intégration d'agents IA. Mal exécuté, il perturbe les APIs de production et érode la confiance de toutes les équipes qui dépendent de la plateforme.

Ce guide fournit un cadre indépendant des fournisseurs pour planifier et exécuter une migration d'API gateway en 2026 — couvrant l'évaluation, la traduction des politiques, la migration progressive du trafic et les nouvelles exigences introduites par les agents IA. Des guides spécifiques aux plateformes individuelles (Broadcom Layer7, Software AG webMethods, Axway, Apigee) sont liés tout au long.

<!-- truncate -->

## Pourquoi 2026 est le bon moment pour migrer

Trois forces ont convergé pour faire de 2026 la fenêtre de migration naturelle pour les équipes enterprise qui ont différé cette décision.

### Le point d'inflexion des licences legacy

L'acquisition de VMware par Broadcom en 2023 — et la restructuration subséquente des accords de licence de logiciels enterprise — a accéléré les calendriers des équipes qui auraient autrement retardé. Une pression tarifaire similaire émerge de la transition de Software AG et de la consolidation continue du portefeuille Axway. Les organisations qui acceptaient auparavant des coûts de maintenance élevés comme une quantité connue font maintenant face à des contrats renégociés avec des économies matériellement différentes. Cela a créé une appétence budgétaire et exécutive pour des migrations qui ont stagné pendant des années.

### L'infrastructure Kubernetes-native est maintenant le standard

En 2019, exécuter un API gateway legacy sur des VMs aux côtés d'un environnement Kubernetes naissant était une posture intérimaire raisonnable. D'ici 2026, Kubernetes est le standard opérationnel pour les équipes plateforme enterprise, et la friction d'adaptation des déploiements de gateways legacy aux workflows GitOps, au déploiement basé sur Helm et au scaling natif Kubernetes est devenue un impôt d'ingénierie continu. Les plateformes conçues dès le départ pour Kubernetes offrent une surcharge opérationnelle significativement plus faible pour les équipes qui ont fait l'investissement plateforme.

### Les agents IA sont devenus des consommateurs d'API de première classe

L'émergence des agents IA en tant que consommateurs d'API n'est pas une tendance future — elle se produit en production aujourd'hui. Les agents IA ont des patterns d'interaction fondamentalement différents des applications pilotées par des humains : ils découvrent dynamiquement les APIs, invoquent plusieurs outils en séquence, nécessitent des réponses en streaming pour les tâches de longue durée, et génèrent de nouveaux besoins de comptage et de gouvernance (comptabilité au niveau des tokens, quotas par agent, audit trails pour la conformité réglementaire). Les gateways legacy n'ont pas été conçus pour ces patterns. Ajouter le support MCP (Model Context Protocol), la découverte d'outils et le comptage des agents en tant qu'extensions à un moteur de politiques basé sur les assertions conçu pour le trafic REST et SOAP piloté par des humains crée une dette architecturale dès le premier jour de déploiement.

Les organisations qui migrent maintenant peuvent construire l'infrastructure des agents IA sur la même plateforme que leur API management — plutôt que d'exploiter deux systèmes parallèles.

## Les quatre moteurs de migration — et comment les utiliser

Avant de rédiger un plan de migration, identifiez quels moteurs s'appliquent à votre organisation. Chaque moteur modifie le périmètre, le séquençage et les métriques de succès de la migration.

**La réduction des coûts de licence** pousse les migrations où l'objectif principal est d'éliminer les frais par gateway, par API ou par appel. Le succès se mesure en dépenses annuelles réduites. Ce moteur justifie un périmètre large (tout migrer) mais nécessite une gestion soigneuse du calendrier pour éviter les pénalités de licence pendant la transition.

**La consolidation de plateforme** pousse les migrations où plusieurs produits gateway se sont accumulés dans l'organisation — souvent par des acquisitions, des initiatives départementales ou des relations historiques avec des fournisseurs. Le succès se mesure en réduction du nombre de plateformes et en simplification opérationnelle. Ce moteur nécessite souvent un effort de normalisation des politiques avant la migration technique.

**La compatibilité avec les agents IA** pousse les migrations où l'objectif principal est de permettre de nouvelles capacités plutôt que de remplacer celles existantes. Le succès se mesure en temps-vers-premier-déploiement-agent-IA et en qualité d'observabilité des agents. Ce moteur justifie un modèle de déploiement sidecar : le nouveau gateway gère le trafic des agents IA dès le premier jour tandis que le trafic legacy migre en phases.

**La conformité réglementaire** pousse les migrations où les exigences européennes de souveraineté (NIS2, DORA), les mandats de résidence des données ou les exigences d'auditabilité de la chaîne d'approvisionnement ne peuvent pas être satisfaits par un gateway SaaS commercial. Le succès se mesure en posture de conformité documentée. Ce moteur nécessite un déploiement sur site ou cloud privé du plan de contrôle du nouveau gateway.

La plupart des migrations impliquent plus d'un moteur. Priorisez-les explicitement — le moteur principal détermine quelle phase de la migration doit réussir en premier.

## Évaluation de la plateforme : comprendre ce que vous avez

Une migration ne peut avancer qu'aussi vite que votre compréhension du système existant. Les inventaires incomplets sont la cause la plus courante de retards de migration et d'incidents de production.

### Inventaire des APIs

Construisez un inventaire complet de chaque API actuellement gérée par le gateway. Pour chaque API, documentez :

- **Protocole** : REST, SOAP, XML-RPC, GraphQL, gRPC, WebSocket
- **Méthode d'authentification** : OAuth2, SAML, clé API, mTLS, Kerberos, NTLM, Basic
- **Volume de trafic** : Requêtes par jour, TPS de pointe, niveau SLA
- **Criticité métier** : Générateur de revenus, outillage interne, face aux partenaires, réglementaire
- **Complexité des politiques** : Simple (auth + routage) vs. complexe (transformation, orchestration, WS-Security, assertions personnalisées)
- **Dépendances** : Quelles applications consomment cette API, quels services backend elle appelle

Le résultat de cet inventaire détermine le séquençage de votre migration. Les APIs avec des profils REST/OAuth2 simples migrent en premier. Les APIs avec des profils SOAP/WS-Security, Kerberos ou des chaînes d'assertions personnalisées complexes migrent en dernier — ou fonctionnent en parallèle indéfiniment si le cas métier pour la migration ne justifie pas l'effort de traduction.

### Évaluation de l'infrastructure

| Composant | Ce qu'il faut documenter |
|-----------|--------------------------|
| Instances gateway | Nombre, emplacement, version, mode de clustering, VM vs conteneur |
| Moteur de politiques | Nombre total de services, bibliothèque de fragments de politiques, extensions personnalisées |
| Intégration identity | Structure LDAP/AD, fédération SSO (SAML, Kerberos, OIDC) |
| Inventaire des certificats | Signés par CA, auto-signés, gérés par HSM, dates d'expiration |
| Monitoring | Pile d'observabilité actuelle, configuration d'alertes, tableaux de bord SLA |
| Patterns de trafic | TPS de pointe par service, distribution géographique, par lots vs temps réel |

### Classification de la complexité de migration

Classifiez chaque API dans l'une des trois voies de migration :

**Vert (migrer en Phase 3-4) :** APIs REST avec authentification OAuth2 ou clé API, aucune logique de politique personnalisée, aucune dépendance SOAP/WS-Security. Ces APIs représentent la majorité du trafic dans la plupart des patrimoines modernes et peuvent être migrées avec un faible risque.

**Jaune (migrer en Phase 4-5) :** APIs REST avec une logique de politique complexe (orchestration multi-étapes, transformation de réponses, règles de routage complexes), APIs authentifiées par SAML, ou APIs avec autorisation basée sur des groupes LDAP/AD. Celles-ci nécessitent un travail de traduction des politiques mais pas de conversion de protocole.

**Rouge (migrer en Phase 5-6 ou maintenir en parallèle) :** APIs SOAP/WS-Security, APIs authentifiées par Kerberos/NTLM, APIs avec des assertions personnalisées ou des extensions propriétaires, APIs avec des opérations cryptographiques gérées par HSM. Celles-ci nécessitent un effort de traduction significatif et une opération parallèle étendue.

## Le cadre de migration en six phases

Ce cadre s'applique à toutes les plateformes gateway legacy. La durée des phases évolue avec la taille et la complexité du patrimoine — un patrimoine de 50 services peut se terminer en 4 mois ; un patrimoine enterprise de 500 services peut nécessiter 12 à 18 mois.

### Phase 1 : Évaluation et alignement des parties prenantes (Semaines 1-6)

La première phase est principalement organisationnelle, pas technique. L'évaluation technique (inventaire des APIs, documentation de l'infrastructure) est simple ; le travail difficile consiste à aligner les parties prenantes sur le périmètre, le séquençage et les critères de succès.

Livrables clés pour la Phase 1 :

Le **document de périmètre de migration** définit quelles APIs sont dans le périmètre de cette migration, lesquelles sont hors périmètre (et pourquoi), et quels sont les critères de décision de poursuite pour chaque API hors périmètre. Ce document évite le scope creep et fournit une référence quand des équipes individuelles font pression pour des exceptions.

Le **registre des risques** identifie les modes de défaillance spécifiques qui comptent pour votre organisation : perturbation du trafic de production, pannes d'authentification, violations de SLA et lacunes de conformité. Chaque risque devrait avoir un propriétaire identifié et un plan d'atténuation documenté.

Le **cadre des métriques de succès** définit comment vous saurez que la migration a réussi. Les métriques typiques incluent : réduction des coûts de licence gateway (mesurée à la fin de la migration), réduction du temps d'intégration pour les nouvelles APIs (mesurée 90 jours après la migration), et parité de latence P99 entre l'ancien et le nouveau gateway (mesurée à chaque point de contrôle de migration du trafic).

L'alignement des parties prenantes est non négociable à cette phase. Les équipes plateforme qui tentent d'exécuter des migrations de gateways comme des projets purement techniques — sans sponsorship exécutif et adhésion des équipes produit — rencontrent systématiquement de la résistance pendant la phase de migration du trafic quand les équipes individuelles sont invitées à mettre à jour leurs applications.

### Phase 2 : Déploiement parallèle (Semaines 7-10)

Déployez le nouveau gateway aux côtés du système existant sans toucher au trafic de production. À cette phase, l'objectif est la familiarité opérationnelle, pas la migration.

```
Flux existant (inchangé) :
  Tous les consommateurs → Gateway Legacy → APIs Backend

Nouveau flux (ajouté en parallèle) :
  Agents IA    → Nouveau Gateway (MCP) → APIs Backend
  Nouvelles APIs → Nouveau Gateway       → APIs Backend
  Shadow         → Nouveau Gateway       → /dev/null (pour validation)
```

La phase de déploiement parallèle établit trois choses critiques pour les phases ultérieures :

**Runbooks opérationnels** : Votre équipe a besoin de savoir comment déployer, scaler, redémarrer et déboguer le nouveau gateway avant qu'il ne porte du trafic de production. Construisez cette connaissance pendant le déploiement parallèle.

**Baselines de monitoring** : Établissez ce que le normal signifie pour le nouveau gateway sous aucune charge, puis sous du trafic shadow. Vous avez besoin de ces baselines pour distinguer « problème gateway » de « problème backend » pendant la migration du trafic.

**La règle des nouvelles APIs** : Dès le moment où le nouveau gateway est déployé, toutes les nouvelles APIs passent par lui. Cela crée une valeur opérationnelle immédiate, génère du trafic réel pour la validation du monitoring, et assure que l'équipe plateforme gagne en confiance avant que la migration ne commence.

### Phase 3 : Fédération d'identité (Semaines 8-12, chevauche la Phase 2)

La fédération d'identité est la composante à risque le plus élevé de la plupart des migrations de gateways et bénéficie d'une attention précoce. L'objectif est de configurer l'infrastructure d'identité du nouveau gateway (typiquement Keycloak ou un fournisseur OIDC similaire) pour fédérer avec le fournisseur d'identité existant — sans le remplacer.

Le pattern de fédération ressemble à ceci :

```
Applications → Nouveau Gateway → Keycloak (OIDC) → IdP existant (SAML/LDAP/Kerberos)
```

Keycloak agit comme un broker OIDC qui traduit entre le protocole OIDC moderne utilisé par le nouveau gateway et les protocoles d'identité legacy utilisés par l'IdP existant. Cela signifie :

- Les installations Oracle OAM / CA SiteMinder peuvent être fédérées via SAML 2.0 sans migration
- Les installations Active Directory / LDAP peuvent être fédérées via le fournisseur LDAP de Keycloak
- Les environnements Kerberos peuvent être fédérés via le fournisseur SPNEGO/Kerberos de Keycloak

Le principe clé : **la migration d'identité et la migration de gateway sont des flux de travail indépendants**. Vous n'avez pas besoin de migrer votre fournisseur d'identité pour migrer votre gateway. La fédération permet aux deux systèmes de coexister.

Validez chaque pattern d'authentification dans un environnement non-production avant qu'il ne porte du trafic de production. Testez spécifiquement : les flux d'échange de tokens (RFC 8693), le mapping des claims des attributs SAML legacy vers les claims OIDC, la propagation des appartenances aux groupes pour l'autorisation, et la gestion de l'expiration et du rafraîchissement des tokens.

### Phase 4 : Traduction des politiques (Semaines 11-18)

La traduction des politiques est la phase techniquement la plus exigeante de la plupart des migrations. L'objectif est d'implémenter un comportement équivalent sur le nouveau gateway pour chaque politique dans le système legacy.

La méthodologie de traduction :

**Documenter avant de traduire.** Pour chaque politique ou chaîne d'assertions, rédigez une description en langage courant de ce qu'elle fait : entrées, conditions, sorties et effets de bord. Cette documentation a deux avantages : elle vous force à comprendre la politique suffisamment bien pour la traduire correctement, et elle crée une documentation durable des règles métier qui ont souvent été implicites dans la configuration des politiques pendant des années.

**Traduire l'intention, pas l'implémentation.** De nombreuses politiques legacy contiennent des workarounds accumulés — des workarounds pour les limitations de la plateforme d'origine, pour des bugs dans des versions spécifiques, pour des cas limites dans des applications consommateurs particulières. Lors de la traduction, implémentez l'intention (quelle règle métier cette politique devrait-elle appliquer ?) plutôt que l'implémentation (quelles étapes la politique actuelle exécute-t-elle ?). Cela produit souvent des politiques plus simples et plus maintenables sur la nouvelle plateforme.

**Tester avec du trafic shadow avant la production.** Mirrorez le trafic de production vers le nouveau gateway et comparez les réponses. Les différences comportementales dans le format de réponse, les codes d'erreur, les valeurs de headers ou le timing peuvent être invisibles dans les tests unitaires mais surgissent immédiatement sous du trafic réel.

Le tableau suivant mappe les patterns de politiques legacy courants à leurs équivalents modernes :

| Pattern Legacy | Équivalent moderne | Notes |
|---------------|---------------------|-------|
| Validation token OAuth2 | Validation JWT (intégrée) | Flux OIDC standard |
| Gestion des assertions SAML | Bridge SAML Keycloak | Mapper attributs SAML aux claims OIDC |
| Auth Kerberos/NTLM | Fédération Kerberos Keycloak | Bridge SPNEGO → OIDC |
| Rate limiting / quota | Politique de quota par tenant | Configurable par API, par consommateur |
| Transformation XML/SOAP | Proxy XSLT ou couche service | Déplacer les transformations vers le service |
| Code d'extension personnalisé | Politique OPA/Rego | Plus auditable, version-contrôlé |
| Lookup de groupes LDAP | Fédération LDAP Keycloak | Groupes exposés comme claims OIDC |
| Signature WS-Security | Proxy SOAP + mTLS | Frontière WS-Security au niveau service |
| Whitelist/blacklist IP | NetworkPolicy Kubernetes + gateway | Réseau Kubernetes natif |
| Audit logging | OpenTelemetry + logs structurés | Natif gateway, basé sur les standards |

### Phase 5 : Migration du trafic en canary (Semaines 16-24)

La migration du trafic en canary transfère la charge de production du gateway legacy vers le nouveau gateway en incréments contrôlés. Chaque incrément est maintenu pendant une période d'observation définie avant le suivant.

Une séquence canary standard :

| Étape | Trafic sur le nouveau gateway | Période d'observation | Temps de rollback |
|-------|-------------------------------|----------------------|-------------------|
| Canary | 5% | 48 heures | < 1 minute |
| Majorité précoce | 25% | 1 semaine | < 1 minute |
| Split | 50% | 1 semaine | < 1 minute |
| Majorité tardive | 90% | 2 semaines | < 1 minute |
| Bascule complète | 100% | — | Legacy en standby |

**À chaque étape, le rollback est à un changement DNS ou d'ingress.** Le gateway legacy continue de fonctionner en parallèle tout au long de la Phase 5. C'est non négociable : la capacité de rollback en moins d'une minute est ce qui rend la migration canary sûre.

Métriques à monitorer à chaque étape :

- Latence P50, P95, P99 par API — comparer entre l'ancien et le nouveau gateway
- Taux d'erreur (4xx, 5xx) par API — toute augmentation nécessite une investigation avant de progresser
- Taux de succès d'authentification — surveiller les échecs de validation de token à l'échelle
- Débit (requêtes par seconde) — valider que le nouveau gateway scale sous charge de production
- Rapports d'erreur des consommateurs — surveiller activement les équipes signalant des changements comportementaux

Critères de feu vert avant de passer à l'étape suivante : toutes les métriques dans les 5% des valeurs du gateway legacy, pas d'augmentation du taux d'erreur inexpliquée, pas d'escalades des consommateurs.

### Phase 6 : Décommissionnement (Semaines 22-30)

Le gateway legacy ne devrait être décommissionné qu'après que deux conditions sont remplies : zéro trafic de production pendant au moins deux semaines, et archivage documenté de toute la configuration des politiques.

Checklist de décommissionnement :

- Vérifier zéro trafic sur toutes les instances de gateway legacy (vérifier les logs d'accès, pas seulement la configuration de routage)
- Exporter et archiver tous les bundles de politiques, configurations de services et certificats
- Mettre à jour les accords de licence fournisseur selon les termes contractuels
- Mettre à jour les enregistrements DNS, les règles de pare-feu et les politiques réseau pour supprimer les références au gateway legacy
- Notifier toutes les équipes dépendantes de la fin de la migration
- Mettre à jour les runbooks, les diagrammes d'architecture et les tableaux de bord de monitoring

## Guides de migration spécifiques aux plateformes

Pour une guidance détaillée et pratique pour votre plateforme spécifique :

- **[Migration Broadcom Layer7 API Gateway →](/blog/layer7-ca-api-gateway-migration-stoa)** — Traduction des politiques basées sur les assertions, workloads WS-Security, fédération CA SiteMinder
- **[Migration Software AG webMethods →](/blog/webmethods-migration-guide)** — Langage IS Flow, mapping des dépendances IS, licences IBM, remplacement du workflow Designer
- **[Migration Axway API Gateway →](/blog/axway-api-gateway-migration-open-source)** — Traduction Policy Studio, workloads B2B/EDI, dépendances écosystème AMPLIFY
- **[Migration Google Apigee →](/blog/apigee-alternative-open-source)** — Découplage des dépendances GCP, traduction des bundles proxy, résidence des données européenne
- **[Migration WSO2 API Manager →](/blog/wso2-api-manager-open-source-alternative)** — Traffic manager, séparation des composants API gateway, chemin open source vers open source
- **[Migration MuleSoft Anypoint →](/blog/mulesoft-migration-open-source-gateway)** — Traduction DataWeave, découplage des dépendances Salesforce, migration CloudHub
- **[Migration IBM DataPower / TIBCO →](/blog/datapower-tibco-migration-guide)** — Remplacement de l'appliance WS-Security, médiation SOAP, politiques TIBCO API Manager
- **[Kong OSS / Enterprise →](/docs/guides/migration/kong)** *(docs)* — Config déclarative, migration des plugins Lua, mapping des workspaces Kong Enterprise
- **[Oracle OAM / API Platform →](/docs/guides/migration/oracle-oam)** *(docs)* — Remplacement WebGate, migration des droits OIM, fédération Oracle LDAP

## Compatibilité avec les agents IA : la nouvelle destination de migration

En 2020, une migration réussie d'API gateway signifiait : vos APIs sont accessibles, sécurisées, monitorées, et vos développeurs peuvent se servir eux-mêmes. En 2026, cette baseline est nécessaire mais pas suffisante.

Les agents IA sont maintenant des consommateurs d'API, et ils ont des exigences que votre gateway doit être en mesure de satisfaire :

### Support du Model Context Protocol (MCP)

MCP est un standard émergent qui permet aux agents IA de découvrir et d'invoquer des outils API dynamiquement. Plutôt que d'exiger que chaque application IA code en dur la logique client API, les gateways compatibles MCP exposent un endpoint de découverte que les agents peuvent interroger pour comprendre quelles APIs sont disponibles, quels paramètres elles acceptent et quelles réponses elles retournent.

Concrètement, cela signifie que votre gateway doit être capable de : exposer les APIs REST et SOAP existantes comme des outils MCP sans nécessiter de modifications aux backends, fournir des descriptions d'outils structurées que les agents IA peuvent interpréter, et gérer les patterns de gestion de sessions que les workloads agentiques nécessitent.

### Comptage et gouvernance au niveau agent

Le comptage API traditionnel suit les requêtes par application ou par utilisateur. Les agents IA introduisent une nouvelle exigence de responsabilité : quel agent, agissant au nom de quel utilisateur, pour quelle application IA, a consommé quelles APIs, à quel coût ?

Cela nécessite l'application de quotas par agent, des audit trails par agent (pour la conformité réglementaire en finance et santé), et une comptabilité au niveau des tokens pour les agents LLM-backed qui génèrent des appels API proportionnels à la taille de la fenêtre de contexte.

### Support du streaming et des requêtes longue durée

Les agents IA ont fréquemment besoin de réponses en streaming — soit pour la génération en temps réel (SSE, WebSocket), soit pour les tâches de longue durée qui dépassent les contraintes de timeout des APIs requête-réponse traditionnelles. Les gateways legacy optimisés pour les requêtes REST sous la seconde gèrent mal ces patterns.

### Souveraineté européenne pour les workloads IA

Pour les entreprises européennes soumises à NIS2 et DORA, router le trafic des agents IA via des gateways hébergés dans le cloud tiers crée des défis de résidence des données et d'audit trail. Le déploiement de gateway sur site ou cloud privé garantit que les interactions des agents IA — y compris les prompts et réponses qui circulent via le gateway — restent sous contrôle organisationnel.

## Modes de défaillance courants lors de la migration

Comprendre les modes de défaillance les plus fréquents permet aux équipes de construire des atténuations explicites dans leurs plans.

**Inventaire incomplet :** La cause la plus courante d'incidents de production pendant la migration du trafic est une API qui n'était pas dans l'inventaire — un endpoint legacy encore utilisé par un système qui n'était pas inclus dans la communication aux parties prenantes. Atténuation : valider l'inventaire en analysant les logs d'accès du gateway pour les 90 jours précédents, pas seulement le registre de services ou la documentation.

**Erreurs de traduction d'identité à l'échelle :** Les cas limites de validation de tokens et de mapping de claims qui passent les tests unitaires surgissent souvent sous charge de production. Atténuation : tests de trafic shadow pendant la Phase 4 avec comparaison active des réponses d'authentification.

**Sous-estimation de SOAP/WS-Security :** Les organisations sous-estiment systématiquement l'effort de traduction pour les workloads WS-Security. Un service qui ressemble à une API simple peut dépendre de la signature XML, du chiffrement XML ou de l'échange de tokens WS-Trust qui nécessite un travail de politique significatif. Atténuation : classification Voie Rouge en Phase 1, calendrier étendu pour les services SOAP.

**Résistance des parties prenantes pendant la migration du trafic :** Quand les équipes produit individuelles sont invitées à valider leurs applications contre le nouveau gateway, elles font souvent émerger des problèmes qui avaient été masqués par le comportement du gateway legacy — des workarounds, des fonctionnalités non documentées, une gestion d'erreurs non standard. Cette résistance est légitime et doit être planifiée. Atténuation : des ressources de support de migration dédiées pour chaque équipe produit pendant leur fenêtre de migration du trafic.

**Plan de rollback non testé :** Un plan de rollback qui n'a jamais été exécuté n'est pas un plan de rollback. Atténuation : exécuter un exercice complet de rollback dans un environnement de pré-production avant le premier déploiement canary de production.

## Mesurer le succès de la migration

Définissez les métriques de succès avant que la migration ne commence, pas après. Les métriques qui comptent dépendent de votre moteur de migration principal, mais les suivantes sont largement applicables :

**Métriques opérationnelles (mesurées en continu pendant la migration) :**
- Latence P99 du gateway : nouveau gateway dans les 5% du legacy à chaque étape de trafic
- Taux d'erreur : pas d'augmentation inexpliquée au-dessus de la baseline à aucune étape de trafic
- Disponibilité : uptime du nouveau gateway égal ou supérieur au legacy pendant la fenêtre de migration

**Métriques métier (mesurées 90 jours après la migration) :**
- Temps d'intégration des APIs : réduction du temps du développement API terminé à l'API accessible en production
- Adoption self-service : pourcentage d'abonnements API complétés sans intervention manuelle
- Coût de licence : réduction des dépenses réelles contre la baseline pré-migration

**Métriques de capacité plateforme (mesurées à la fin de la migration) :**
- Compatibilité avec les agents IA : nombre d'APIs exposées comme outils MCP le jour J+1 post-migration
- Couverture d'observabilité : pourcentage d'APIs avec des tableaux de bord latence P99, taux d'erreur et consommateurs
- Couverture policy-as-code : pourcentage de politiques gateway définies en YAML ou Rego version-contrôlé

## Foire aux questions

### Combien de temps dure une migration d'API gateway ?

Pour un petit patrimoine (moins de 50 services), prévoyez 3-4 mois. Pour un patrimoine moyen (50-150 services), prévoyez 4-6 mois. Pour un grand patrimoine (150+ services, plusieurs plateformes legacy, workloads SOAP/WS-Security), prévoyez 9-18 mois. La variable principale est la complexité de traduction des politiques — les services SOAP/WS-Security et Kerberos nécessitent significativement plus de temps que les services REST/OAuth2.

### Puis-je continuer à faire fonctionner mon gateway legacy pour certains services indéfiniment ?

Oui. Le pattern de déploiement sidecar supporte une opération hybride indéfinie. De nombreuses organisations gardent leur gateway legacy pour les workloads SOAP/WS-Security tout en routant tout le trafic REST, agents IA et nouvelles APIs via le nouveau gateway. L'économie de l'opération hybride (deux ensembles de surcharges opérationnelles) finit par motiver une migration complète, mais il n'y a pas de raison technique pour que l'état hybride ne puisse pas être maintenu.

### Dois-je migrer mon fournisseur d'identité en même temps ?

Non. La migration d'identité et la migration de gateway sont des flux de travail indépendants. Keycloak (ou équivalent) peut fédérer avec Oracle OAM, CA SiteMinder, Active Directory et Kerberos sans nécessiter que ces systèmes soient remplacés. De nombreuses organisations terminent la migration de gateway pendant que leur IdP legacy continue de fonctionner sans changement pendant des années.

### Que se passe-t-il si mon gateway legacy a des extensions ou plugins personnalisés ?

Les extensions personnalisées (assertions basées sur Java dans Layer7, services IS dans webMethods, filtres personnalisés dans Axway) représentent la composante de migration à risque le plus élevé. Pour chaque extension, documentez l'objectif métier (pas l'implémentation), puis évaluez trois options : implémenter une logique équivalente comme une politique OPA/Rego, déplacer la logique vers la couche service (un microservice qui effectue la même fonction), ou maintenir le gateway legacy en parallèle pour les services qui dépendent de l'extension. La troisième option est valide — toutes les extensions personnalisées ne valent pas l'effort de traduction.

### Que faire des APIs SOAP — dois-je les moderniser ou les migrer ?

Traitez la modernisation SOAP comme un projet séparé de la migration de gateway. Pour la planification de la migration, traitez chaque API SOAP comme un élément de la Voie Rouge : gardez le gateway legacy la gérant jusqu'à ce qu'une décision de modernisation séparée soit prise. Tenter de moderniser les APIs SOAP et de migrer le gateway simultanément double le risque du projet.

### Comment gérer la migration dans un secteur réglementé ?

Les secteurs réglementés (banque, santé, assurance) introduisent des exigences supplémentaires : des périodes de double-run pour la continuité de l'audit trail, des processus de gestion du changement nécessitant un préavis, et des exigences de documentation pour chaque changement de configuration. Intégrez-les dans votre calendrier. L'approche de migration par phases est particulièrement bien adaptée aux environnements réglementés car elle produit un audit trail clair de ce qui a changé, quand et avec quelle validation.

## Prochaines étapes

- **[Guide de migration Broadcom Layer7 →](/blog/layer7-ca-api-gateway-migration-stoa)** — Guidance détaillée pour les équipes migrant depuis Broadcom Layer7 API Gateway™
- **[Comparaison des API Gateways open source 2026 →](/blog/open-source-api-gateway-2026)** — Comparer STOA, Kong, Gravitee, Tyk et d'autres
- **[Démarrage rapide STOA →](/docs/guides/quickstart)** — Déployez en 15 minutes pour évaluer
- **[Guide de déploiement hybride →](/docs/deployment/hybrid)** — Référence d'architecture pour le plan de contrôle cloud + gateway sur site

---

> Ce guide est indépendant des fournisseurs et décrit des patterns de migration généraux applicables à n'importe quelle plateforme gateway API. Il n'implique aucune déficience des plateformes mentionnées. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques commerciales appartiennent à leurs propriétaires respectifs.

> Les comparaisons de fonctionnalités et les estimations de calendrier reflètent la documentation publiquement disponible et l'expérience terrain en date de février 2026. Les capacités et les tarifs changent fréquemment — vérifiez les informations actuelles directement auprès de chaque fournisseur.
