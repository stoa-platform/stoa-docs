---
slug: dora-nis2-api-gateway-compliance
title: "Conformité DORA & NIS2 pour les API Gateways : checklist des exigences"
authors: [christophe]
tags: [compliance, architecture]
description: "DORA et NIS2 imposent des audit trails, du chiffrement et des tests de résilience pour les APIs. Checklist des contrôles gateway pour les secteurs financiers et critiques."
keywords:
  - DORA compliance API
  - NIS2 API gateway
  - European API compliance
  - financial regulation API
  - API gateway compliance
  - digital operational resilience
  - cybersecurity directive
---

Le paysage réglementaire européen a radicalement changé pour les organisations gérant une infrastructure numérique. **La conformité DORA NIS2** n'est plus une préoccupation future — c'est une exigence opérationnelle immédiate pour toute organisation exploitant des API gateways dans les secteurs des services financiers, de la santé, de l'énergie ou des infrastructures critiques dans l'UE.

<!-- truncate -->

Si votre API gateway gère du trafic pour des secteurs réglementés, vous devez comprendre comment ces deux directives s'articulent avec votre stratégie de gestion des APIs. Cet article décompose ce que DORA et NIS2 exigent, comment ils impactent spécifiquement l'infrastructure API, et quelles capacités votre gateway devrait fournir pour soutenir les efforts de conformité.

<!-- last verified: 2026-02 -->

> **Avertissement :** Cet article fournit des informations générales sur les exigences réglementaires et la façon dont les capacités d'un API gateway peuvent soutenir les efforts de conformité. Il ne constitue pas un avis juridique. Les organisations devraient consulter un conseiller juridique qualifié pour leurs exigences de conformité spécifiques.

## Que sont DORA et NIS2 ?

### DORA : Digital Operational Resilience Act

DORA (Règlement (UE) 2022/2554) cible le secteur financier. Il est entré en pleine application en janvier 2025 et impose des exigences strictes sur la gestion des risques ICT pour les banques, les compagnies d'assurance, les prestataires de paiement et leurs fournisseurs ICT tiers.

Piliers clés de DORA :

- **Gestion des risques ICT** — Les organisations doivent identifier, se protéger contre, détecter, répondre et récupérer des incidents liés aux ICT.
- **Notification d'incidents** — Les incidents ICT majeurs doivent être signalés aux régulateurs dans des délais stricts.
- **Tests de résilience opérationnelle numérique** — Tests réguliers incluant des tests de pénétration sous leadership de menaces (TLPT).
- **Gestion des risques tiers** — Les fournisseurs ICT critiques sont soumis à une surveillance directe.
- **Partage d'informations** — Partage encouragé de renseignements sur les cybermenaces.

### NIS2 : Directive sur la sécurité des réseaux et de l'information

NIS2 (Directive (UE) 2022/2555) est plus large dans sa portée. Elle s'applique aux entités « essentielles » et « importantes » dans 18 secteurs, incluant l'énergie, le transport, la santé, l'infrastructure numérique et l'administration publique.

Exigences clés de NIS2 :

- **Mesures de gestion des risques** — Mesures techniques, opérationnelles et organisationnelles pour gérer les risques de cybersécurité.
- **Notification d'incidents** — Alerte précoce dans les 24 heures, notification complète dans les 72 heures.
- **Sécurité de la chaîne d'approvisionnement** — Évaluation des risques des tiers et des fournisseurs.
- **Continuité des activités** — Gestion des sauvegardes, reprise après sinistre et gestion de crise.
- **Chiffrement et contrôle d'accès** — Utilisation de la cryptographie et de l'authentification multi-facteurs.

## Comment DORA et NIS2 impactent l'infrastructure API Gateway

Les API gateways sont au cœur des architectures numériques modernes. Ils traitent chaque requête entre les clients, les services et de plus en plus les agents IA. Cette position centrale en fait une surface de conformité critique pour les deux directives.

### Journalisation d'audit et traçabilité

DORA et NIS2 exigent tous deux une journalisation complète des événements pertinents pour la sécurité. Pour un API gateway, cela signifie :

- **Chaque appel API** doit être journalisé avec l'identité de l'appelant, l'horodatage, l'action et le résultat.
- **Les événements d'authentification** (réussis et échoués) doivent être enregistrés et conservés.
- **Les décisions de politique** (autoriser/refuser) doivent être traçables jusqu'à des règles spécifiques.
- **L'intégrité des logs** doit être garantie — les logs ne peuvent pas être altérés ou supprimés silencieusement.

Un API gateway qui ne fournit que des logs d'accès basiques est insuffisant. Vous avez besoin d'audit trails structurés et immuables qui peuvent être interrogés lors d'investigations réglementaires.

### Chiffrement en transit et au repos

NIS2 exige explicitement l'utilisation de la cryptographie. Pour les API gateways, cela se traduit par :

- **mTLS** entre les services (pas seulement la terminaison TLS à la frontière).
- **Chiffrement au repos** pour toutes les clés API, tokens ou credentials stockés.
- **Gestion des certificats** avec rotation et révocation automatisées.
- **Gestion des clés** intégrée à une solution de gestion des secrets comme HashiCorp Vault.

### Détection des incidents et réponse

DORA impose que les organisations détectent les anomalies et répondent rapidement aux incidents. Votre API gateway doit supporter :

- **Détection d'anomalies en temps réel** — Patterns de trafic inhabituels, échecs d'authentification, dépassements de rate limits.
- **Alertes automatisées** — Intégration avec les plateformes SIEM et de gestion des incidents.
- **Circuit breaking et rate limiting** — Mitigation automatique des attaques en cours.
- **Capacité forensique** — La capacité de reconstruire la séquence d'événements pendant un incident.

### Résilience et continuité des activités

Les exigences de test de résilience de DORA signifient que votre API gateway ne peut pas être un point de défaillance unique :

- **Haute disponibilité** — Déploiement actif-actif ou actif-passif sur plusieurs zones de disponibilité.
- **Dégradation gracieuse** — Le gateway doit continuer à fonctionner (éventuellement en mode réduit) lors de défaillances partielles.
- **Reprise après sinistre** — Procédures de récupération documentées et testées avec des RTOs et RPOs définis.
- **Tests de chaos** — Tests réguliers de scénarios de défaillance pour valider la résilience.

### Risques tiers et chaîne d'approvisionnement

Si vous utilisez un API gateway managé d'un fournisseur cloud, DORA peut classer ce fournisseur comme « fournisseur ICT tiers critique ». Cela signifie :

- **Le vendor lock-in devient un risque de conformité** — Vous devez démontrer que vous pouvez changer de fournisseur.
- **La souveraineté des données compte** — Où est traité et journalisé votre trafic API ?
- **L'open source réduit le risque** — Les gateways open source auto-hébergés éliminent la dépendance à un seul fournisseur.

## Quelles fonctionnalités votre API Gateway a besoin

Sur la base des exigences DORA et NIS2, voici une checklist de conformité pour l'infrastructure API gateway :

| Exigence | DORA | NIS2 | Capacité Gateway requise |
|---|:---:|:---:|---|
| Logs d'audit immuables | Oui | Oui | Journalisation structurée avec stockage anti-falsification |
| mTLS / chiffrement | Oui | Oui | TLS de bout en bout, mTLS entre services |
| Contrôle d'accès (RBAC) | Oui | Oui | Accès granulaire basé sur les rôles avec MFA |
| Alertes d'incidents | Oui | Oui | Monitoring en temps réel, intégration SIEM |
| Rate limiting | Oui | - | Limites configurables par tenant, par endpoint |
| Circuit breaking | Oui | - | Basculement automatique lors de défaillances backend |
| Tests de résilience | Oui | - | Support du chaos engineering, health probes |
| Souveraineté des données | - | Oui | Option de déploiement sur site / hybride |
| Transparence de la chaîne d'approvisionnement | Oui | Oui | Génération SBOM, audit des dépendances |
| Reprise après sinistre | Oui | Oui | Déploiement multi-AZ, sauvegarde/restauration |

## Comment STOA répond aux exigences DORA et NIS2

STOA a été conçu avec les exigences réglementaires européennes comme préoccupation de première classe. Voici comment la plateforme se mappe à chaque domaine de conformité :

### Audit trail complet

STOA s'intègre avec [OpenSearch pour la journalisation centralisée](/docs/enterprise/security-compliance), fournissant des logs d'audit structurés et interrogeables pour chaque appel API, événement d'authentification et décision de politique. Les logs incluent le contexte tenant, l'identité de l'appelant et les métadonnées complètes de la requête.

### Déploiement hybride pour la souveraineté des données

L'[architecture hybride](/docs/deployment/hybrid) de STOA sépare le Plan de Contrôle (qui peut fonctionner dans le cloud) du Plan de Données (qui fonctionne sur site). Cela signifie que le trafic API sensible ne quitte jamais votre infrastructure, répondant directement aux exigences de souveraineté des données NIS2.

### Résilience intégrée

Le STOA Gateway implémente le circuit breaking, des politiques de retry avec backoff exponentiel et du routage basé sur les health-checks. Le modèle de déploiement natif Kubernetes offre une haute disponibilité sur les zones, avec des pod disruption budgets et des mises à jour progressives assurant des opérations sans interruption.

### Transparence open source

En tant que projet sous licence Apache 2.0, STOA fournit une transparence totale du code source. Chaque build génère des SBOMs (Software Bill of Materials) aux formats CycloneDX et SPDX, permettant l'audit de la chaîne d'approvisionnement comme l'exigent DORA et NIS2.

### Isolation multi-tenant

L'architecture multi-tenant de STOA utilise l'isolation par namespace Kubernetes, la séparation des realms Keycloak et la conception schéma-par-tenant de la base de données. Cela garantit qu'un incident de conformité chez un tenant n'affecte pas les autres — une exigence critique pour les plateformes de services financiers.

### Policy-as-Code avec OPA

STOA utilise Open Policy Agent (OPA) pour l'application des politiques, permettant des politiques de sécurité auditables et versionnées. Chaque décision de politique est journalisée et traçable, ce qui simplifie le reporting réglementaire.

## Construire votre feuille de route de conformité

Progresser vers l'alignement DORA et NIS2 n'est pas un projet ponctuel. Cela nécessite :

1. **Évaluation des écarts** — Cartographiez votre infrastructure API actuelle par rapport au tableau d'exigences ci-dessus.
2. **Revue d'architecture** — Évaluez si votre gateway supporte le déploiement hybride et la souveraineté des données.
3. **Journalisation et monitoring** — Implémentez d'abord la journalisation d'audit structurée et immuable.
4. **Tests de résilience** — Établissez des tests de chaos réguliers et documentez les procédures de récupération.
5. **Évaluation des fournisseurs** — Si vous utilisez des services managés, évaluez le risque de lock-in et les stratégies de sortie.

## Démarrer

Si vous évaluez des plateformes d'API gateway pour les secteurs réglementés, STOA fournit sécurité, auditabilité et flexibilité de déploiement pour soutenir les efforts de conformité DORA et NIS2.

- Explorez la [documentation Sécurité et Conformité](https://docs.gostoa.dev/docs/enterprise/security-compliance)
- En savoir plus sur le [Déploiement hybride](https://docs.gostoa.dev/docs/deployment/hybrid)
- Essayez STOA avec le [Guide de démarrage rapide](https://docs.gostoa.dev/docs/guides/quickstart)
- Inscrivez-vous à la [Console STOA](https://console.gostoa.dev) pour voir la plateforme en action

---

## Lectures complémentaires

- [Guide complet de migration API Gateway 2026](/blog/api-gateway-migration-guide-2026) — Cadre de décision pour la modernisation des gateways legacy
- [API Management en Europe : souveraineté des données](/blog/api-management-europe-sovereignty) — Comment la juridiction du gateway impacte la conformité
- [Sécurité et conformité enterprise](/docs/enterprise/security-compliance) — Mapping réglementaire détaillé
- [Architecture de sécurité STOA : défense en profondeur](/blog/stoa-api-security-architecture) — Modèle de sécurité à cinq couches soutenant les exigences de résilience DORA
- [OAuth 2.1 + PKCE pour les MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Authentification basée sur les standards soutenant les exigences de contrôle d'accès NIS2
- [OWASP API Security Top 10 & STOA](/blog/owasp-api-security-top-10-stoa) — Mapping des risques OWASP complémentant la conformité réglementaire
- [Zero Trust pour les API Gateways (Partie 1)](/blog/zero-trust-api-gateways-part-1) — L'architecture Zero Trust s'aligne avec les contrôles de gestion d'accès DORA/NIS2

---

*Christophe Aboulicam est le Fondateur & CTO de HLFH, construisant STOA Platform pour apporter l'API management IA-native aux entreprises européennes.*

> **Avertissement :** STOA Platform fournit des capacités techniques qui soutiennent les efforts de conformité réglementaire. Cela ne constitue pas un avis juridique ni une garantie de conformité. Les organisations devraient consulter un conseiller juridique qualifié pour leurs exigences de conformité.
