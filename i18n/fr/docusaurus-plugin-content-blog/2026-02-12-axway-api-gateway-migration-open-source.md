---
slug: axway-api-gateway-migration-open-source
title: "Axway API Gateway : monitoring Prometheus & SNMP sans migration"
authors: [stoa-team]
tags: [migration, comparison, open-source, api-gateway]
description: "Comment ajouter l'observabilité Prometheus et SNMP à votre Axway API Gateway existant. Dashboards Grafana, alertes automatiques, zéro migration vers une autre gateway."
keywords:
  - Axway API gateway migration
  - Axway alternative
  - Axway API Manager replacement
  - API gateway migration open source
  - Axway to open source
  - enterprise API gateway modernization
  - Axway API Management migration
  - API gateway comparison 2026
---

<!-- last verified: 2026-02 -->

# Migration Axway API Gateway : passer à l'open source en 2026

Migrer d'Axway API Gateway vers une alternative open source est un processus structuré pouvant être réalisé en 4-6 mois selon une approche par phases sans interruption. Ce guide fournit un mapping de fonctionnalités, une feuille de route de migration, et des conseils pratiques pour les équipes entreprise évaluant leurs options.

<!-- truncate -->

:::info Partie de la série Migration API Gateway
Cet article fait partie de notre [guide complet de migration API gateway](/blog/api-gateway-migration-guide-2026). Que vous veniez d'Axway, webMethods, MuleSoft ou Apigee, les principes fondamentaux de migration sont les mêmes.
:::

## Pourquoi les équipes évaluent des alternatives à Axway

Axway a été une plateforme de gestion API d'entreprise fiable depuis plus d'une décennie, servant les secteurs des services financiers, de la santé et des gouvernements dans le monde entier. Cependant, plusieurs tendances sectorielles poussent les équipes à évaluer leurs options :

### Évolution des exigences d'infrastructure

Le passage vers une infrastructure Kubernetes-native signifie que les API gateways doivent s'intégrer nativement avec l'orchestration de containers, les service meshes et les workflows GitOps. Les équipes habituées à une configuration déclarative et orientée code trouvent que l'adaptation des plateformes traditionnelles à ces patterns demande des efforts significatifs.

### Intégration des agents IA

Alors que les agents IA (Claude, GPT, systèmes basés sur LLM personnalisés) commencent à consommer des APIs d'entreprise de façon programmatique, les gateways ont besoin d'un support natif pour le Model Context Protocol (MCP). Cela inclut la découverte dynamique d'outils, les réponses en streaming et le metering au niveau des tokens — des capacités qui n'étaient pas dans le paysage des API gateways quand la plupart des plateformes enterprise ont été conçues.

### Momentum de l'open source

L'écosystème des API gateways open source a considérablement mûri. Les projets sous licence Apache 2.0 ou similaire proposent désormais des fonctionnalités de niveau enterprise — multi-tenancy, mTLS, moteurs de politiques, observabilité — qui n'étaient auparavant disponibles que dans des produits commerciaux. Les organisations cherchant à éviter le vendor lock-in et à réduire les coûts de licence évaluent ces alternatives.

### Souveraineté européenne

Les réglementations européennes (NIS2, DORA) exigent que les organisations démontrent leur contrôle sur leur infrastructure API, incluant la résidence des données, la notification d'incidents et la transparence de la chaîne d'approvisionnement. Les gateways auto-hébergés open source fournissent l'auditabilité et la flexibilité de déploiement nécessaires à la conformité.

## Comparaison de fonctionnalités

La comparaison suivante mappe les capacités d'Axway API Gateway à leurs équivalents open source. La disponibilité des fonctionnalités est basée sur la documentation publiquement disponible.

| Capacité | Axway API Gateway | Alternative open source (STOA) |
|---|---|---|
| **Routage API** | Routage basé sur politiques, réécriture d'URL | Correspondance de routes, normalisation de chemins, réécriture d'URL |
| **Authentification** | OAuth2, clé API, HTTP Basic, mutual TLS | OAuth2/OIDC (Keycloak), clé API, mTLS, JWT |
| **Autorisation** | Basée sur les rôles, filtres personnalisés | Moteur de politique OPA (ABAC), scopes par tenant |
| **Rate Limiting** | Quotas par application, par API | Quotas par tenant, par outil, par API |
| **Portail API** | Axway API Portal (basé sur Joomla) | Developer Portal (React, découverte API + abonnements) |
| **Catalogue API** | Catalogue API Manager | Control Plane API + Console UI |
| **Monitoring du trafic** | Analytics temps réel, API Gateway Analytics | Métriques Prometheus, dashboards Grafana, OpenTelemetry |
| **Moteur de politiques** | Policy Studio (éditeur visuel) | Politiques OPA/Rego (policy-as-code, GitOps) |
| **Support protocoles** | REST, SOAP, XML, JMS, FTP | REST, MCP, SSE, WebSocket |
| **Déploiement** | Basé sur VM, support Docker | Kubernetes-natif (Helm), Docker Compose |
| **Multi-Tenancy** | Organisations API Manager | Isolation tenant au niveau namespace (CRDs) |
| **Support agents IA** | Pas supporté nativement | Gateway MCP natif, découverte d'outils, metering agent |
| **Configuration** | GUI Policy Studio + XML | YAML/CRDs déclaratifs, GitOps, CLI |
| **Gestion des certificats** | PKI intégrée, magasin de certificats | cert-manager + module mTLS |
| **Haute disponibilité** | Clustering actif-actif | Réplicas Kubernetes + HPA |
| **Licence** | Commerciale (abonnement) | Apache 2.0 (entièrement open source) |

### Les points forts d'Axway

La plateforme Axway inclut plusieurs capacités qui reflètent son héritage enterprise :

- **Intégration B2B** : Axway B2Bi pour la communication partenaires EDI/AS2 est un produit spécialisé sans équivalent open source direct. Les organisations avec des besoins importants d'intégration B2B doivent évaluer cela séparément de la migration du gateway API.
- **Policy Studio** : L'éditeur de politiques visuel est puissant pour les équipes qui préfèrent la configuration basée GUI plutôt que le code. Les organisations qui transitionnent vers le GitOps/code-as-config peuvent voir les choses différemment.
- **Plateforme AMPLIFY** : L'écosystème Axway AMPLIFY plus large inclut le Managed File Transfer, l'intégration B2B et la collaboration de contenu. La migration du gateway API ne nécessite pas de migrer ces composants.

### Les avantages de l'open source

- **Support agents IA** : Le support natif du protocole MCP, la découverte d'outils et le metering agent sont intégrés au cœur du gateway, pas ajoutés comme plugins.
- **GitOps-First** : Toute la configuration est en YAML déclaratif géré dans Git. Pas de formats binaires propriétaires ni de workflows dépendant d'une GUI.
- **Transparence des coûts** : Licence Apache 2.0 sans frais par API, par appel ou par nœud.
- **Communauté** : Les projets open source bénéficient des contributions de la communauté, d'audits de sécurité indépendants et d'intégrations avec l'écosystème.

## Feuille de route de migration

### Phase 1 : Évaluation et inventaire (semaines 1-4)

Avant de migrer, construisez une image complète de votre déploiement Axway :

**Inventaire API :**
- Exporter votre catalogue API depuis API Manager
- Classifier les APIs par protocole (REST, SOAP, XML), volume de trafic et criticité métier
- Identifier les politiques personnalisées (Policy Studio) qui nécessitent une traduction
- Cartographier les patterns d'authentification par API (OAuth2, clé API, mutual TLS, filtres personnalisés)

**Évaluation de l'infrastructure :**
| Élément | Ce qu'il faut documenter |
|---------|-------------------------|
| Instances gateway | Nombre, localisation, version |
| API Manager | Organisations, utilisateurs, applications |
| Projets Policy Studio | Politiques personnalisées, chaînes de filtres |
| Certificats | Structure PKI, cycle de vie des certificats |
| Intégrations externes | LDAP, SMTP, Syslog, SNMP |
| Patterns de trafic | TPS de pointe par API, variations saisonnières |

**Cartographie des dépendances :**
- Quels systèmes dépendent des fonctionnalités spécifiques à Axway (filtres personnalisés, protocoles B2B) ?
- Quelles APIs sont candidates à une migration précoce (REST, auth standard, pas de politiques personnalisées) ?
- Quelles APIs devraient rester sur Axway plus longtemps (B2B/EDI, médiation SOAP complexe) ?

### Phase 2 : Déploiement sidecar (semaines 5-8)

Déployer le nouveau gateway aux côtés d'Axway sans toucher le trafic de production :

```
Flux existant (inchangé) :
  Consommateurs ──→ Axway API Gateway ──→ APIs Backend

Nouveau flux (ajouté) :
  Agents IA ──→ STOA MCP Gateway ──→ APIs Backend
  Nouvelles APIs  ──→ STOA API Gateway  ──→ APIs Backend
```

**Actions clés :**
1. Déployer STOA sur votre cluster Kubernetes via le [chart Helm](/docs/deployment/hybrid) ou le [quickstart Docker Compose](/docs/guides/quickstart)
2. Configurer la fédération Keycloak avec votre fournisseur d'identité existant (LDAP, Active Directory, SAML IdP)
3. Enregistrer vos 3-5 premières APIs non-critiques sur le nouveau gateway
4. Valider le routage, l'authentification et la correction des réponses
5. **Règle : toutes les nouvelles APIs passent par STOA à partir de ce moment**

### Phase 3 : Traduction des politiques (semaines 9-14)

Traduire les politiques Policy Studio d'Axway vers leurs équivalents open source :

| Politique Axway | Équivalent open source | Notes |
|---|---|---|
| Filtre HTTP Basic auth | Realm Keycloak + client | Gestion d'identité centralisée |
| Validation token OAuth2 | Validation JWT (intégrée au gateway) | Flux OIDC standard |
| Filtre rate limiting | Politique de quota par tenant | Configurable via CRD ou API |
| Transformation XML/SOAP | Code au niveau service ou proxy XSLT | Déplacer les transformations vers la couche service |
| Filtre JavaScript personnalisé | Politique OPA/Rego | Plus puissante, auditable |
| Validation de certificat | Module mTLS + cert-manager | PKI Kubernetes-native |
| Filtrage de contenu | Validation de schéma d'entrée | JSON Schema dans le Tool CRD |
| Liste blanche IP | NetworkPolicy + politique gateway | Réseau Kubernetes-natif |

Pour chaque politique :
1. Documenter le comportement actuel (entrée, conditions, sortie)
2. Implémenter l'équivalent sur le nouveau gateway
3. Tester avec du trafic shadow pour valider un comportement identique
4. Documenter les éventuelles différences de comportement

### Phase 4 : Migration du trafic (semaines 15-20)

Déplacer progressivement le trafic de production via le routage DNS ou ingress :

1. **5% canary** — Router une petite portion du trafic via le nouveau gateway. Surveiller la latence, les taux d'erreur, la précision des réponses.
2. **25% split** — Augmenter le trafic. Valider sous charge modérée.
3. **50% split** — Opération parallèle soutenue. Comparer les métriques entre anciens et nouveaux gateways.
4. **90% nouveau gateway** — Axway ne gère que les APIs pas encore migrées.
5. **100% nouveau gateway** — Tout le trafic passe par le nouveau gateway. Axway entre en veille.

**À chaque étape, vous pouvez revenir en arrière** vers Axway avec un changement DNS ou ingress en moins d'une minute.

**Métriques à surveiller à chaque étape :**
- Latence p50, p95, p99 par API
- Taux d'erreur (4xx, 5xx) par API
- Taux de succès/échec d'authentification
- Débit (requêtes par seconde)

### Phase 5 : Décommissionnement (semaines 21-26)

Quand Axway ne gère plus de trafic de production :

1. **Vérifier zéro trafic** sur toutes les instances Axway pendant au moins 2 semaines
2. **Exporter et archiver** les définitions API, les configurations de politiques et les certificats
3. **Décommissionner** les instances Axway et résilier les accords de licence
4. **Mettre à jour la documentation**, les runbooks et les dashboards de monitoring
5. **Informer les équipes** de la fin du basculement

## Défis courants et solutions

### Défi 1 : Complexité de Policy Studio

Axway Policy Studio permet de construire des chaînes de filtres complexes avec des outils visuels. Traduire celles-ci en politiques basées sur du code nécessite de comprendre ce que fait chaque filtre.

**Solution :** Commencez par documenter le comportement de chaque politique en texte clair (pas en XML Axway). Ensuite implémentez l'équivalent en politique OPA/Rego ou en configuration gateway. De nombreuses chaînes Policy Studio contiennent une complexité accumulée qui peut être simplifiée lors de la migration.

### Défi 2 : Gestion des certificats

Axway dispose de capacités PKI intégrées et d'un magasin de certificats. Passer à la gestion de certificats Kubernetes-native nécessite une approche différente.

**Solution :** Utilisez [cert-manager](https://cert-manager.io/) pour la gestion automatisée du cycle de vie des certificats sur Kubernetes. Pour le mTLS entre le gateway et les backends, le module mTLS de STOA s'intègre avec cert-manager et supporte la rotation de certificats sans interruption.

### Défi 3 : Workloads B2B/EDI

Si vous utilisez Axway B2Bi aux côtés du gateway API pour la communication partenaires B2B/EDI, c'est un produit séparé avec des capacités spécialisées.

**Solution :** La migration B2B/EDI est hors du périmètre de la migration du gateway API. Conservez Axway B2Bi pour la communication partenaires tout en migrant la couche gateway API. Les deux peuvent coexister indéfiniment. Évaluez les alternatives B2B/EDI séparément si nécessaire.

### Défi 4 : Transition des compétences de l'équipe

Les équipes expérimentées avec Policy Studio et l'administration Axway doivent apprendre Kubernetes, GitOps et OPA.

**Solution :** La Phase 2 (déploiement sidecar) est conçue pour cela. Les équipes apprennent la nouvelle plateforme sur les nouvelles APIs avant de migrer les existantes. Prévoyez 2-4 semaines de formation pratique pendant la phase sidecar.

### Défi 5 : Continuité de la conformité et de l'audit

Les industries réglementées ont besoin d'audit trails continus tout au long de la migration.

**Solution :** Exécutez les deux gateways en parallèle pendant les Phases 3-4. Chaque gateway produit ses propres logs d'audit. Après la migration complète, les événements d'audit structurés du nouveau gateway (par tenant, par outil, par invocation) fournissent généralement des données plus riches que la plateforme source.

## Résumé du calendrier

Pour un déploiement Axway de taille moyenne (50-150 APIs, 2-3 instances gateway) :

| Phase | Durée | Taille d'équipe | Niveau de risque |
|---|---|---|---|
| Évaluation et inventaire | 4 semaines | 2 architectes | Aucun |
| Déploiement sidecar | 4 semaines | 1-2 ingénieurs plateforme | Faible |
| Traduction des politiques | 6 semaines | 2-3 ingénieurs | Faible-Moyen |
| Migration du trafic | 6 semaines | 2-3 ingénieurs | Moyen (atténué par canary) |
| Décommissionnement | 4-6 semaines | 1-2 ingénieurs | Faible |
| **Total** | **4-6 mois** | **Pic : 3-5 personnes** | |

## Foire aux questions

### Combien de temps prend typiquement une migration Axway ?

Pour un déploiement de taille moyenne (50-150 APIs), prévoyez 4-6 mois avec l'approche par phases décrite ici. La variable la plus importante est la traduction des politiques (Phase 3) — les chaînes Policy Studio complexes avec des filtres personnalisés prennent plus de temps à réimplémenter. Commencez par un inventaire pour dimensionner l'effort. Voir le [guide de migration complet](/blog/api-gateway-migration-guide-2026) pour des cadres applicables à toutes les plateformes legacy.

### Puis-je conserver Axway pour certaines APIs et utiliser le nouveau gateway pour d'autres ?

Oui. Le pattern de déploiement sidecar est conçu exactement pour cela. De nombreuses organisations conservent leur gateway legacy pour les APIs avec une médiation complexe ou des protocoles B2B tout en routant tout nouveau développement et trafic d'agents IA via le nouveau gateway. Ce modèle hybride peut fonctionner indéfiniment.

### Qu'en est-il des fonctionnalités Axway AMPLIFY au-delà du gateway API ?

Axway AMPLIFY inclut le Managed File Transfer, l'intégration B2B et la collaboration de contenu en plus de la gestion API. La migration du gateway ne nécessite pas de migrer ces composants. Évaluez chaque produit indépendamment selon vos exigences.

### La migration est-elle réversible ?

Oui, à chaque phase. Pendant les Phases 2-4, Axway continue de fonctionner en parallèle. Le trafic peut être réorienté vers Axway avec un changement DNS ou ingress en moins d'une minute. La seule étape irréversible est la Phase 5 (décommissionnement), qui ne doit avoir lieu qu'après 2+ semaines de zéro trafic sur Axway.

## Prochaines étapes

- **[Guide de migration API Gateway 2026](/blog/api-gateway-migration-guide-2026)** — Cadre de migration complet vendor-neutral
- **[Comparaison API Gateway Open Source 2026](/blog/open-source-api-gateway-2026)** — Comparer STOA, Kong, Gravitee, et plus
- **[Documentation de migration](/docs/guides/migration/)** — Guides techniques détaillés par plateforme
- **[Guide de démarrage rapide](/docs/guides/quickstart)** — Déployer STOA en 15 minutes pour évaluation

---

> Ce guide décrit les étapes techniques de migration et n'implique aucune défaillance de la plateforme source. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques commerciales appartiennent à leurs propriétaires respectifs.

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible en 2026-02. Les capacités des produits changent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque fournisseur. Voir [marques commerciales](/docs/legal/trademarks) pour les détails.
