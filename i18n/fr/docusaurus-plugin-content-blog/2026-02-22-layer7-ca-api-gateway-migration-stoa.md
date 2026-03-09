---
slug: layer7-ca-api-gateway-migration-stoa
title: "Migration Broadcom Layer7 vers l'Open Source (Guide 2026)"
authors: [stoa-team]
tags: [migration, comparison, api-gateway]
description: "Les politiques basées sur les assertions de Layer7 ne se traduisent pas 1:1. Apprenez à les mapper vers des gateways modernes avec ce plan de migration d'entreprise par phases."
keywords:
  - layer7 migration
  - ca api gateway alternative
  - broadcom layer7 to stoa
  - layer7 api gateway replacement
  - ca api management migration
  - broadcom layer7 open source
  - api gateway migration 2026
  - enterprise api gateway modernization
---

<!-- last verified: 2026-02 -->

# Migration du Gateway API Broadcom Layer7 : Passage à l'Open Source en 2026

Migrer du Gateway API Broadcom Layer7™ vers une alternative open source est un processus structuré qui peut être accompli en 4 à 6 mois en utilisant une approche par phases sans interruption. Ce guide couvre le mapping des fonctionnalités, une feuille de route de migration en cinq phases, et des conseils pratiques pour traduire le modèle de politique basé sur les assertions de Layer7 vers des équivalents open source modernes.

<!-- truncate -->

:::info Partie de la Série de Guides de Migration de Gateway API
Cet article fait partie de notre [guide complet de migration de gateway API](/blog/api-gateway-migration-guide-2026). Que vous partiez de Layer7, webMethods, Axway ou Apigee, les principes fondamentaux de migration sont les mêmes.
:::

## Pourquoi les Équipes Évaluent des Alternatives à Layer7

Le Gateway API Broadcom Layer7™ — à l'origine CA API Gateway, lui-même issu de Layer 7 Technologies — est un pilier de la gestion d'API dans les services financiers, la santé et le secteur public depuis plus d'une décennie. Son modèle de politique basé sur les assertions et son support SOAP/XML approfondi en ont fait le choix par défaut pour les équipes d'entreprise construisant sur WS-Security et SAML. Plusieurs évolutions poussent aujourd'hui les équipes à évaluer des alternatives.

**Restructuration des licences Broadcom.** L'acquisition de VMware par Broadcom en 2023 — et la réorganisation subséquente du portefeuille de logiciels d'entreprise — a incité les organisations à réévaluer l'économie des licences des produits Broadcom dans l'ensemble, y compris Layer7. Les équipes qui avaient accepté des conditions contractuelles antérieures comme stables renégocient maintenant dans des conditions matériellement différentes.

**Attentes natives Kubernetes.** Layer7 a été conçu pour des déploiements sur VM et appliances. Bien que le support Kubernetes ait été ajouté, les équipes qui ont standardisé sur Helm, GitOps et l'observabilité native Kubernetes constatent que l'adaptation de Layer7 à ces workflows crée une surcharge d'ingénierie continue que les gateways natifs Kubernetes évitent par conception.

**Exigences des agents IA.** MCP (Model Context Protocol), la découverte d'outils, les réponses en streaming et la mesure au niveau des tokens ne sont pas des ajouts à un gateway moderne — ce sont des exigences de conception fondamentales pour servir des charges de travail d'agents IA. L'ajout de ces capacités en tant qu'extensions à un moteur de politique basé sur les assertions crée des frictions architecturales qui s'amplifient à mesure que le trafic d'agents croît.

**Souveraineté européenne.** NIS2 et DORA requièrent un contrôle démontrable sur l'infrastructure API. Les gateways open source auto-hébergés sous licence Apache 2.0 fournissent l'auditabilité, la flexibilité de déploiement et la transparence de la chaîne d'approvisionnement que ces réglementations exigent.

## Comparaison des Fonctionnalités

La disponibilité des fonctionnalités est basée sur la documentation publiquement disponible en date de 2026-02.

<!-- last verified: 2026-02 -->

| Capacité | Broadcom Layer7 API Gateway™ | STOA (Open Source) |
|---|---|---|
| **Routage API** | Routage basé sur les politiques, assertions de routage | Correspondance de route, normalisation de chemin, réécriture d'URL |
| **Authentification** | OAuth2, SAML 2.0, Kerberos, NTLM, mTLS, clé API | OAuth2/OIDC (Keycloak), clé API, mTLS, JWT |
| **Autorisation** | Groupes LDAP/AD, assertions personnalisées | Moteur de politique OPA (ABAC), scopes par tenant |
| **Limitation de débit** | Assertions de quota, quotas de débit | Quotas par tenant, par outil, par API |
| **Portail développeur** | CA API Developer Portal (add-on optionnel) | Portail développeur (React, abonnements en libre-service) |
| **Catalogue d'API** | Console CA API Management | Control Plane API + Console UI |
| **Observabilité** | API Monitor Layer7, journaux d'audit du gateway | Prometheus, Grafana, OpenTelemetry, Loki |
| **Moteur de politique** | Policy Manager GUI (basé sur les assertions, 500+ types) | OPA/Rego (politique-as-code, géré par GitOps) |
| **Support de protocoles** | REST, SOAP, XML, WS-Security, JMS | REST, MCP, SSE, WebSocket |
| **Déploiement** | VM, appliance, Docker, Kubernetes (OTK) | Natif Kubernetes (Helm), Docker Compose |
| **Multi-tenancy** | Séparation des comptes de service, clustering | Isolation au niveau des namespaces (CRDs) |
| **Support des agents IA** | Non supporté nativement | MCP gateway natif, découverte d'outils, mesure des agents |
| **Configuration** | GUI Policy Manager + export bundle XML | YAML/CRDs déclaratifs, GitOps, CLI stoactl |
| **SSO / Fédération** | Intégration CA SiteMinder, fédération SAML | Keycloak (pont IdP SAML, OIDC natif) |
| **Gestion des certificats** | Magasin de certificats intégré, intégration HSM | cert-manager + module mTLS |
| **Haute disponibilité** | Clustering actif-actif | Répliques Kubernetes + HPA |
| **Licence** | Commercial (abonnement Broadcom) | Apache 2.0 (entièrement open source) |

### Points Forts de Layer7

- **Profondeur SOAP/WS-Security.** Layer7 dispose d'années de support éprouvé pour WS-Security, WS-Trust et le chiffrement XML. Les organisations avec de grandes bases SOAP s'y sont appuyées pour l'intégration réglementaire et partenaire. Ces charges de travail nécessitent une traduction soigneuse des politiques — pas un remplacement.
- **Étendue du Policy Manager.** Plus de 500 types d'assertions couvrant l'authentification, la transformation, le routage, l'audit et la gestion des protocoles. Les équipes avec des chaînes d'assertions complexes ont investi un temps significatif à construire et maintenir cette configuration.
- **Intégration CA SiteMinder.** La fédération native Layer7-SiteMinder est une dépendance critique pour les organisations qui ont standardisé sur SiteMinder pour le SSO web. Keycloak peut fédérer via SAML 2.0, faisant de cela un écart comblable plutôt qu'un bloquant.
- **Intégration HSM.** Support de Hardware Security Module pour les opérations cryptographiques dans les environnements haute sécurité. Une configuration HSM équivalente est requise sur la nouvelle plateforme avant de migrer les services dépendants du HSM.

### Avantages de l'Open Source

- **Natif IA dès la conception.** Le support du protocole MCP, la découverte d'outils et la mesure des agents sont intégrés au cœur du gateway — pas des assertions à configurer.
- **GitOps en premier.** Toute la configuration est en YAML versionné. Pas d'exports de bundles XML ni de workflows dépendant d'une GUI.
- **Natif Kubernetes.** Déploiement Helm, mise à l'échelle native Kubernetes, intégration service mesh, PKI cert-manager — conçu pour la plateforme.
- **Transparence des coûts.** Licence Apache 2.0 sans frais par gateway, par API ou par appel.

## Feuille de Route de Migration

### Phase 1 : Inventaire et Classification (Semaines 1-4)

Constituez une image complète de votre déploiement Layer7 avant de rédiger un plan de migration.

**Inventaire des APIs — pour chaque service, documentez :**
- Protocole : REST, SOAP, XML-RPC, WS-Security
- Authentification : OAuth2, SAML, clé API, Kerberos, NTLM, mTLS, Basic
- Complexité des politiques : nombre d'assertions, assertions personnalisées, utilisation WS-Security
- Volume de trafic et niveau SLA
- Applications consommatrices

**Inventaire d'infrastructure :**

| Composant | Ce qu'il faut documenter |
|-----------|-----------------|
| Instances gateway | Nombre, localisation, version, configuration de clustering |
| Policy Manager | Services publiés, fragments de politiques, assertions encapsulées |
| Certificats | Signés par CA, auto-signés, gérés par HSM, dates d'expiration |
| Intégration LDAP/AD | Structure de répertoire, mappings de groupes, chaînes d'auth |
| CA SiteMinder | Points de fédération, ressources protégées |
| Patterns de trafic | TPS de pointe, répartition SOAP vs REST |

**Classifiez chaque service dans des pistes de migration :**

- **Vert** — REST + OAuth2/clé API, routage simple : migrer dans les Phases 3-4
- **Jaune** — REST + SAML, groupes LDAP, assertions de routage complexes : migrer dans les Phases 4-5
- **Rouge** — SOAP/WS-Security, Kerberos/NTLM, assertions Java personnalisées, HSM : Phase 5-6 ou en parallèle indéfiniment

### Phase 2 : Déploiement Sidecar (Semaines 5-8)

Déployez STOA aux côtés de Layer7 sans toucher au trafic de production. Toutes les nouvelles APIs passent par le nouveau gateway dès ce point.

```
Flux existant (inchangé) :
  Consommateurs ──→ Broadcom Layer7 API Gateway™ ──→ APIs Backend

Ajouté en parallèle :
  Agents IA ──→ STOA MCP Gateway ──→ APIs Backend
  Nouvelles APIs ──→ STOA Gateway ──→ APIs Backend
```

**Actions :**
1. Déployer STOA via le [chart Helm](/docs/deployment/hybrid) ou le [quickstart Docker Compose](/docs/guides/quickstart)
2. Configurer la fédération Keycloak avec votre fournisseur d'identité existant (LDAP, AD, SAML CA SiteMinder)
3. Enregistrer 3 à 5 APIs de piste Verte sur le nouveau gateway pour validation
4. Établir des références de monitoring avant l'arrivée du trafic de production

### Phase 3 : Fédération d'Identité (Semaines 6-12, chevauchement avec Phase 2)

La fédération connecte l'identité OIDC du nouveau gateway à votre stack d'identité Layer7 existant :

```
Applications → STOA → Keycloak (OIDC) → CA SiteMinder / LDAP / Kerberos (inchangé)
```

Cela signifie que l'infrastructure d'identité de Layer7 — SiteMinder, Active Directory, Kerberos — n'a pas besoin de migrer. Keycloak fédère via SAML 2.0 (SiteMinder), fournisseur LDAP (AD), et SPNEGO (Kerberos), traduisant chacun en tokens OIDC que STOA valide nativement.

Validez chaque pattern d'authentification hors production avant qu'il ne transporte du trafic : mapping des attributs SAML vers les claims OIDC, délégation contrainte Kerberos, propagation des appartenances aux groupes, et comportement de renouvellement des tokens.

### Phase 4 : Traduction des Assertions (Semaines 9-18)

Traduisez les chaînes d'assertions du Policy Manager Layer7 vers leurs équivalents open source.

**Méthodologie de traduction :**
1. **Documentez l'intention de la chaîne d'assertions** en langage courant — quelle règle métier enforce-t-elle ? De nombreuses chaînes contiennent des contournements accumulés pour des limitations ou bugs qui n'ont pas besoin d'être répliqués.
2. **Implémentez selon l'intention, pas l'implémentation** — les politiques OPA/Rego sont plus expressives que les assertions GUI, donc la politique équivalente est souvent plus simple.
3. **Validez avec du trafic shadow** — miroir des requêtes de production vers le nouveau gateway et comparez les réponses avant de promouvoir.

**Référence de traduction des assertions :**

| Assertion Layer7 | Équivalent Open Source | Notes |
|---|---|---|
| Authentification contre LDAP | Fédération LDAP Keycloak | Groupes exposés comme claims OIDC |
| Token OAuth2 / OpenID Connect | Validation JWT (intégré au gateway) | Flux OIDC standard |
| Validation de token SAML | Bridge SAML Keycloak | Mapping attribut → claim OIDC |
| Kerberos / SPNEGO | Fédération Kerberos Keycloak | Bridge transparent SPNEGO → OIDC |
| Limitation de débit / quota de débit | Politique de quota par tenant | Configurable via CRD ou API |
| Signature XML WS-Security | Proxy SOAP + frontière mTLS | Déplacer WS-Security vers la couche service |
| Transformation XML/SOAP | Proxy XSLT ou couche service | Sortir les transformations du gateway |
| Assertion personnalisée (Java) | Politique OPA/Rego ou logique service | Documenter l'intention en premier |
| Assertion encapsulée | Module de politique OPA (réutilisable) | Versionné, auditable |
| Autorisation/refus IP | Kubernetes NetworkPolicy + règle gateway | Réseau natif Kubernetes |
| Audit / journalisation vers SIEM | OpenTelemetry → SIEM existant | Basé sur des standards, sans verrouillage propriétaire |

Les assertions Java personnalisées sont l'élément de traduction le plus risqué. Pour chacune : documentez l'objectif métier, puis choisissez — politique OPA/Rego (pour la logique auth/authz), microservice de couche service (pour la transformation de données), ou opération Layer7 parallèle (pour les assertions où le coût de traduction dépasse le bénéfice).

### Phase 5 : Migration du Trafic Canary (Semaines 16-24)

Déplacez la charge de production par incréments contrôlés. Layer7 continue de fonctionner tout au long — le rollback est un changement DNS ou d'ingress à n'importe quelle étape.

| Étape | Trafic STOA | Observation | Rollback |
|-------|-------------|-------------|---------|
| Canary | 5 % | 48 heures | < 1 min |
| Majorité précoce | 25 % | 1 semaine | < 1 min |
| Split | 50 % | 1 semaine | < 1 min |
| Majorité tardive | 90 % | 2 semaines | < 1 min |
| Bascule complète | 100 % | — | Layer7 en veille |

Surveillez à chaque étape : latence P50/P95/P99, taux d'erreur, taux de succès d'authentification, débit. N'avancez que lorsque toutes les métriques sont dans les 5 % de la référence Layer7 sans anomalie inexpliquée.

### Phase 6 : Décommissionnement (Semaines 22-30)

Après deux semaines de zéro trafic de production sur Layer7 :

1. Exporter et archiver tous les bundles de politiques, configurations de services et certificats
2. Mettre à jour les accords de licence Broadcom conformément aux termes contractuels
3. Supprimer les enregistrements DNS, règles de pare-feu et monitoring pour les instances Layer7
4. Notifier toutes les équipes dépendantes et mettre à jour les runbooks

## Défis Courants

### Charges de Travail WS-Security

Layer7 dispose d'un support WS-Security approfondi — signature XML, chiffrement XML, WS-Trust — que les gateways natifs REST gèrent différemment.

**Approche :** Traitez chaque service WS-Security comme un flux de travail séparé. Pour chacun, évaluez : (a) moderniser le contrat de service vers REST/mTLS, (b) déployer un proxy SOAP qui termine WS-Security et passe en REST en interne, ou (c) garder Layer7 en parallèle pour ce service indéfiniment. L'option (c) est valide — chaque contrat SOAP ne vaut pas l'effort de traduction.

### Fédération CA SiteMinder

La fédération SiteMinder est une dépendance critique pour les organisations qui ont standardisé sur elle pour le SSO web.

**Approche :** Configurez Keycloak comme Service Provider SAML 2.0 avec SiteMinder comme IdP. STOA s'authentifie ensuite contre Keycloak en utilisant OIDC. Cela connecte SiteMinder au nouveau gateway sans nécessiter une migration de SiteMinder. Consultez le [guide d'authentification](/docs/guides/quickstart) pour les détails de configuration Keycloak.

### Authentification Kerberos / NTLM

La délégation contrainte Kerberos et NTLM sont courantes dans les déploiements Layer7 du secteur public et des services financiers.

**Approche :** Le fournisseur SPNEGO/Kerberos de Keycloak accepte les tokens Kerberos et les traduit en claims OIDC. Configurez une fois au niveau Keycloak — STOA valide les tokens OIDC, jamais les tickets Kerberos directement. Cela isole la complexité Kerberos au niveau de la couche d'identité.

### Cryptographie Gérée par HSM

Les déploiements Layer7 haute sécurité utilisent des Hardware Security Modules pour le stockage des clés et les opérations cryptographiques.

**Approche :** cert-manager supporte l'intégration HSM via PKCS#11. Configurez cert-manager pour utiliser votre HSM pour la génération de clés et la signature de certificats avant de migrer les services dépendants du HSM. Validez les opérations soutenues par HSM sous charge hors production.

### Inventaire des Assertions Personnalisées

Les grands déploiements Layer7 accumulent des assertions Java personnalisées au fil des années. Ce sont les éléments de traduction les plus laborieux.

**Approche :** Auditez toutes les assertions personnalisées et classifiez chacune : (a) implémenter comme politique OPA/Rego, (b) déplacer vers la couche service, (c) garder sur Layer7 en parallèle. Priorisez (a) et (b) pour les assertions portant de la logique de sécurité ou de gouvernance. Priorisez (c) pour la gestion de protocoles spécialisés où le coût de traduction dépasse la valeur.

## Résumé du Calendrier

Pour un déploiement de taille moyenne (50-150 services, 2-3 instances gateway) :

| Phase | Durée | Taille d'équipe | Risque |
|-------|----------|-----------|------|
| Inventaire et Classification | 4 semaines | 2 architectes | Aucun |
| Déploiement Sidecar | 4 semaines | 1-2 ingénieurs plateforme | Faible |
| Fédération d'Identité | 4 semaines (chevauchement) | 1-2 ingénieurs | Faible-Moyen |
| Traduction des Assertions | 6-10 semaines | 2-4 ingénieurs | Faible-Moyen |
| Migration du Trafic Canary | 6 semaines | 2-3 ingénieurs | Moyen (canary atténué) |
| Décommissionnement | 4-6 semaines | 1-2 ingénieurs | Faible |
| **Total** | **4-6 mois** | **Pic : 4-6 personnes** | |

Ajoutez 2 à 4 semaines par tranche de 30 % des services qui sont SOAP/WS-Security ou authentifiés par Kerberos.

## Questions Fréquentes

### Combien de temps prend généralement une migration Layer7 ?

Pour un déploiement de taille moyenne (50-150 services), comptez 4 à 6 mois avec l'approche par phases ci-dessus. La plus grande variable est la complexité de traduction des assertions — les services SOAP/WS-Security et Kerberos prennent significativement plus de temps que les services REST/OAuth2. Effectuez un sprint de découverte dans la Phase 1 pour quantifier l'effort de traduction avant de vous engager sur un calendrier.

### Puis-je garder Layer7 pour certains services et utiliser STOA pour d'autres ?

Oui. Indéfiniment, si nécessaire. De nombreuses organisations routent le trafic des agents IA, les nouvelles APIs REST et les services de piste Verte à travers le nouveau gateway, tandis que Layer7 gère les charges de travail SOAP/WS-Security et Kerberos. Le modèle hybride fonctionne jusqu'à ce que l'économie de l'exploitation parallèle dépasse l'effort de traduction pour les services restants.

### Dois-je migrer CA SiteMinder dans le cadre de cette migration ?

Non. Keycloak fédère avec SiteMinder via SAML 2.0 — SiteMinder continue de servir comme source d'identité inchangée. La migration du gateway et la migration IdP sont des flux de travail indépendants.

### La migration est-elle réversible ?

Oui, à chaque phase. Pendant les Phases 2-5, Layer7 continue de fonctionner en parallèle. Revenir en arrière est un changement DNS ou d'ingress en moins d'une minute. La seule étape irréversible est la Phase 6 (décommissionnement), qui ne doit être exécutée qu'après 2+ semaines de trafic zéro confirmé sur Layer7.

### Que se passe-t-il avec mes bundles de politiques Policy Manager ?

Exportez tous les bundles sous forme d'archives XML avant le décommissionnement. Au-delà de la valeur d'archivage, le XML du bundle sert de documentation des règles métier originales implémentées dans chaque chaîne d'assertions — utile même des années après la migration pour comprendre pourquoi une politique se comporte d'une certaine façon.

## Prochaines Étapes

- **[Guide de Migration Gateway API 2026](/blog/api-gateway-migration-guide-2026)** — Cadre agnostique aux fournisseurs couvrant toutes les plateformes existantes
- **[Comparaison des Gateways API Open Source 2026](/blog/open-source-api-gateway-2026)** — Comparer STOA, Kong, Gravitee et d'autres
- **[Guide de Démarrage Rapide](/docs/guides/quickstart)** — Déployer STOA en 15 minutes pour évaluation
- **[Guide de Déploiement Hybride](/docs/deployment/hybrid)** — Architecture de référence control plane cloud + gateway sur site

---

> Ce guide décrit les étapes techniques de migration et n'implique aucune défaillance de la plateforme source. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques appartiennent à leurs propriétaires respectifs.

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible en date de 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque fournisseur. Voir les [mentions légales](/docs/legal/trademarks) pour les détails.
