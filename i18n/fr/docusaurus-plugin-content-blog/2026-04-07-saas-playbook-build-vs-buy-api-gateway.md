---
unlisted: true
slug: saas-playbook-build-vs-buy-api-gateway
title: "Build vs Buy API Gateway : Analyse du Coût Réel pour le SaaS"
description: "Le DIY semble bon marché jusqu'à ce que vous comptiez la maintenance. Coût d'ingénierie, dépenses cachées et coût total de possession pour build vs buy vs open-source."
authors: [stoa-team]
tags: [tutorial, comparison, api-gateway]
keywords:
  - build vs buy API gateway
  - API gateway cost analysis SaaS
  - API gateway ROI
  - total cost of ownership API gateway
  - DIY API gateway cost
  - API gateway engineering cost
  - open source API gateway cost benefit
---
<!-- last verified: 2026-02 -->

« On peut construire ça nous-mêmes en un sprint. » Nous l'avons tous dit. Parfois c'est vrai. Pour la plupart des décisions d'infrastructure, ça ne l'est pas — surtout pour les API gateways, où la portée de « ça » s'élargit considérablement une fois en production.

Il s'agit du dernier volet de la série **SaaS Playbook**. Nous avons couvert la [multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101), le [rate limiting](/blog/saas-playbook-2-rate-limiting-saas), la [journalisation d'audit](/blog/saas-playbook-3-audit-compliance), la [mise à l'échelle](/blog/saas-playbook-4-scaling-multi-tenant) et la [préparation à la production](/blog/saas-playbook-5-production-checklist). Maintenant nous abordons la méta-question : auriez-vous dû construire tout cela vous-même ?

<!-- truncate -->

> Cette analyse utilise des informations publiquement disponibles sur les coûts de développement logiciel, les salaires d'ingénierie et les prix d'infrastructure. Toutes les comparaisons de produits nommés sont basées sur la documentation publiquement disponible en date de février 2026. Les coûts sont des fourchettes illustratives — les coûts réels dépendent fortement de votre situation spécifique. Consultez notre [avis de marques](/docs/legal/trademarks) pour les détails sur les références de produits tiers.

## Le Cadre de Décision Build vs Buy

La question n'est pas « pouvons-nous le construire ? » — vous le pouvez presque certainement. La question est « devrions-nous le faire ? », ce qui nécessite de comprendre trois choses :

1. **Quelle est la portée complète de ce que vous construisez ?** (La plupart des équipes sous-estiment cela)
2. **Quel est le vrai coût sur un horizon de 3 ans ?** (La construction initiale n'est pas le seul coût)
3. **Quel est le coût d'opportunité ?** (Que construiraient vos ingénieurs à la place ?)

## Le Problème de Portée : Que Signifie Vraiment « API Gateway » ?

Quand les équipes décident de construire leur propre gateway, elles planifient généralement pour :
- Le proxying HTTP (router les requêtes vers les backends)
- L'authentification (valider les tokens JWT)
- Le rate limiting (comptage basique des requêtes)

Ce qu'elles découvrent en production, 6 à 18 mois plus tard :
- La multi-tenancy (isolation des tenants, configuration par tenant, CRDs)
- La journalisation d'audit (preuves de conformité, support GDPR, inviolabilité)
- Le portail développeur (documentation, self-service de clé API, gestion des abonnements)
- La sophistication du rate limiting (gestion des bursts, limites par endpoint, gestion des niveaux)
- L'observabilité (métriques par tenant, tracing distribué, centiles de latence)
- Le support MCP/agent IA (nouvelle exigence à mesure que des fonctionnalités IA sont ajoutées)
- La performance à grande échelle (cache, connection pooling, mise à l'échelle horizontale)
- La sécurité (OAuth2 DCR, PKCE, mTLS, rotation des tokens)
- Le support GitOps (configuration déclarative, contrôle de version, rollback)
- Les outils de réponse aux incidents (rejeu de trafic, circuit breakers, dégradation gracieuse)

Chacun de ces éléments est un effort d'ingénierie d'un mois à un trimestre. La portée cumulée est importante.

## Modèle de Coût sur 3 Ans

### Option A : Construction Entièrement Personnalisée

**Année 1 : Construction Initiale**

| Tâche | Semaines d'Ingénierie | Coût (800€/jour ingénieur senior) |
|---|---|---|
| Proxying HTTP + routage | 3 | 12 000 € |
| Authentification JWT | 2 | 8 000 € |
| Rate limiting basique | 2 | 8 000 € |
| Fondation multi-tenancy | 4 | 16 000 € |
| Portail développeur (basique) | 6 | 24 000 € |
| Journalisation d'audit | 3 | 12 000 € |
| Observabilité | 3 | 12 000 € |
| Tests de charge + durcissement | 2 | 8 000 € |
| **Total construction Année 1** | **25 semaines** | **100 000 €** |

**Année 1 : Infrastructure**
- 2× instances m5.xlarge (prod + staging) : ~300€/mois → 3 600€/an
- PostgreSQL RDS : ~150€/mois → 1 800€/an
- **Infrastructure Année 1** : ~5 400€

**Total Année 1 : ~105 400€**

**Année 2 : Maintenance + Améliorations**

| Tâche | Semaines d'Ingénierie | Coût |
|---|---|---|
| Patches de sécurité + remédiation CVE | 4 | 16 000 € |
| Support MCP/agent IA (nouvelle exigence) | 6 | 24 000 € |
| Améliorations de performance | 3 | 12 000 € |
| Ajouts de conformité (préparation SOC 2) | 4 | 16 000 € |
| Correctifs et réponse aux incidents | 3 | 12 000 € |
| **Ingénierie Année 2** | **20 semaines** | **80 000 €** |

**Infrastructure Année 2** : ~7 200€ (mis à l'échelle)
**Total Année 2 : ~87 200€**

**Année 3 : Maintenance Continue**

| Tâche | Semaines d'Ingénierie | Coût |
|---|---|---|
| Patches de sécurité | 3 | 12 000 € |
| Nouvelles exigences de conformité | 3 | 12 000 € |
| Parité fonctionnelle avec les alternatives commerciales | 4 | 16 000 € |
| Refactoring de la dette technique accumulée | 4 | 16 000 € |
| Incidents d'astreinte | 2 | 8 000 € |
| **Ingénierie Année 3** | **16 semaines** | **64 000 €** |

**Infrastructure Année 3** : ~9 000€
**Total Année 3 : ~73 000€**

**Total Construction Personnalisée sur 3 Ans : ~265 600€**

Cette estimation suppose :
- Un ingénieur senior dédié (800€/jour) à 50 % d'allocation sur 3 ans
- Pas d'incident de sécurité majeur (qui ajoute un coût significatif)
- Pas de défaillance de conformité (qui peut être très coûteux)
- Une stabilité raisonnable des exigences (ce qui est rarement le cas)

### Option B : Open-Source Auto-Hébergé (STOA ou Kong CE)

**Année 1 : Configuration Initiale**

| Tâche | Semaines d'Ingénierie | Coût |
|---|---|---|
| Déploiement + configuration | 1 | 4 000 € |
| Intégration d'authentification (Keycloak) | 1 | 4 000 € |
| Configuration multi-tenancy | 1 | 4 000 € |
| Personnalisation du portail développeur | 1 | 4 000 € |
| Intégration d'observabilité | 0,5 | 2 000 € |
| Tests de charge + validation | 1 | 4 000 € |
| **Configuration Année 1** | **5,5 semaines** | **22 000 €** |

**Infrastructure Année 1** :
- Cluster K8s (2 nœuds : 4 CPU / 16 GB) : ~200€/mois → 2 400€/an
- PostgreSQL : ~80€/mois → 960€/an
- **Infrastructure Année 1** : ~3 360€

**Total Année 1 : ~25 360€**

**Année 2 : Opérations Continues**

| Tâche | Semaines d'Ingénierie | Coût |
|---|---|---|
| Gestion des mises à jour | 1 | 4 000 € |
| Adoption de nouvelles fonctionnalités (MCP, guardrails) | 1 | 4 000 € |
| Réponse aux incidents | 1 | 4 000 € |
| **Ingénierie Année 2** | **3 semaines** | **12 000 €** |

**Infrastructure Année 2** : ~4 000€ (avec mise à l'échelle)
**Total Année 2 : ~16 000€**

**Année 3 : État Stable**

| Tâche | Semaines d'Ingénierie | Coût |
|---|---|---|
| Mises à jour + maintenance | 2 | 8 000 € |
| **Ingénierie Année 3** | **2 semaines** | **8 000 €** |

**Infrastructure Année 3** : ~5 000€
**Total Année 3 : ~13 000€**

**Total OSS Auto-Hébergé sur 3 Ans : ~54 360€**

### Option C : Gateway SaaS Managé (Cloud-Native)

Utilisation d'AWS API Gateway (ou service managé équivalent) à échelle modérée :

| Année | Appels API | Coût par Million | Coût Annuel | Ingénierie | Total |
|---|---|---|---|---|---|
| Année 1 | 100M appels | $3,50/million | ~350€ | 10 000€ (configuration) | ~10 350€ |
| Année 2 | 500M appels | $3,50/million | ~1 750€ | 5 000€ (maintenance) | ~6 750€ |
| Année 3 | 2Md appels | $3,50/million | ~7 000€ | 5 000€ | ~12 000€ |

**Total SaaS Managé sur 3 Ans : ~29 100€** (à cette échelle)

À plus grande échelle (10Md+ appels/an), le SaaS managé devient significativement plus coûteux que l'auto-hébergé. Le point d'équilibre entre le SaaS managé et l'OSS auto-hébergé est typiquement autour de 500M à 1Md d'appels API/mois, selon la taille des requêtes et la tarification régionale.

## Le Résumé sur 3 Ans

| Option | Coût 3 Ans | Heures d'Ingénierie | Vendor Lock-in | Support MCP | Multi-tenancy |
|---|---|---|---|---|---|
| Construction Personnalisée | ~265 600€ | ~1 220h | Aucun | Personnalisé (coût supplémentaire) | Personnalisé (coût supplémentaire) |
| OSS Auto-Hébergé | ~54 360€ | ~165h | Aucun | Inclus (STOA) | Inclus (STOA) |
| SaaS Managé (faible échelle) | ~29 100€ | ~100h | Élevé | Limité | Limité |
| SaaS Managé (grande échelle) | ~200 000€+ | ~100h | Élevé | Limité | Limité |

## Les Coûts Cachés

Le tableau ci-dessus sous-estime encore le vrai coût des constructions personnalisées de plusieurs façons.

### Coût d'Astreinte

Votre gateway personnalisé aura des incidents. Une rotation d'astreinte pour un gateway personnalisé signifie que vos ingénieurs portent un biper pour une infrastructure qu'ils ont construite et doivent comprendre en profondeur. Une rotation de 4 personnes avec des escalades P3 fait en moyenne 3 à 5 incidents par mois en année 2. Chaque incident coûte 2 à 4 heures d'ingénierie. C'est 60 à 180 heures/an rien que pour la réponse aux incidents.

Les gateways open-source ont le support de la communauté, des options de support commercial et de larges bases de connaissances. Votre gateway personnalisé a votre équipe.

### Coût de la Dette de Sécurité

Les vulnérabilités de sécurité dans les API gateways sont de haute sévérité. Un bug de validation JWT manqué, une traversée de chemin dans la logique de routage ou une vulnérabilité SSRF dans le proxying upstream peut être catastrophique. L'audit de sécurité d'un gateway personnalisé coûte 15 000 à 40 000€ auprès d'une société externe. Trouver une vulnérabilité critique en production coûte beaucoup plus.

Les gateways open-source bénéficient d'un examen de sécurité continu de leurs communautés. Les gateways personnalisés ont autant d'examen de sécurité que vous leur en donnez.

### Coût d'Audit de Conformité

Quand votre premier client enterprise demande un rapport SOC 2 Type II, votre auditeur examinera votre architecture d'API gateway. Un gateway personnalisé signifie expliquer et prouver chaque contrôle de sécurité depuis le début. Un gateway open-source établi avec une architecture de sécurité documentée réduit considérablement ce travail. Le coût marginal de l'audit d'un gateway personnalisé par rapport à un gateway open-source établi est de 5 000 à 20 000€ par cycle d'audit.

### Coût d'Opportunité

Le plus grand coût caché est ce que votre équipe n'a pas construit pendant qu'elle construisait un gateway. Pour la plupart des entreprises SaaS, un API gateway est une infrastructure — ce n'est pas votre avantage concurrentiel. Chaque semaine passée à construire des fonctionnalités de gateway est une semaine non consacrée à la construction des fonctionnalités produit qui font avancer votre business.

## Quand le Personnalisé a du Sens

Malgré l'analyse de coûts ci-dessus, il existe des scénarios où un gateway personnalisé est le bon choix :

**Quand le gateway EST le produit** : Si votre entreprise construit une plateforme de gestion d'API (comme STOA lui-même), construire un gateway est au cœur de votre proposition de valeur, pas une distraction.

**Quand vos exigences sont genuinement inhabituelles** : Certaines industries ou cas d'usage ont des exigences qu'aucun gateway existant ne gère bien. Avant de conclure cela, assurez-vous d'avoir réellement évalué les options existantes en profondeur.

**Quand les exigences réglementaires interdisent les logiciels tiers** : Certaines industries réglementées nécessitent des logiciels avec des certifications spécifiques ou des contrôles de chaîne d'approvisionnement qui excluent les options open-source ou commerciales.

**Quand vous avez besoin d'une intégration avec une plateforme interne propriétaire** : Certaines grandes entreprises ont une infrastructure interne qui nécessite une intégration personnalisée profonde.

Pour la plupart des entreprises SaaS en phase initiale à intermédiaire, aucune de ces conditions ne s'applique.

## La Recommandation

L'analyse de coûts pointe clairement vers : pour la plupart des entreprises SaaS, un gateway open-source auto-hébergé offre le meilleur équilibre entre coût total, flexibilité et levier d'ingénierie.

Les facteurs clés de décision :
- **Échelle < 500M req/mois** : Le SaaS managé est le moins cher et le plus simple
- **Échelle > 500M req/mois ou multi-tenancy requise** : L'OSS auto-hébergé est le choix optimal
- **Exigences de conformité enterprise ou agents MCP/IA** : L'OSS auto-hébergé (STOA spécifiquement) a l'ensemble de fonctionnalités le plus solide
- **Construction personnalisée** : Rarement optimal à moins que le gateway soit votre produit

Pour le calcul qui a du sens pour votre situation spécifique, parcourez les modèles ci-dessus avec votre volume réel de requêtes, votre taux horaire d'ingénieur et vos exigences de conformité.

## Finaliser le SaaS Playbook

Cela conclut la série SaaS Playbook :

1. **[Partie 1 : Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101)** — Isolez vos tenants sans perdre la tête
2. **[Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas)** — Quotas par tenant, gestion des bursts, niveaux de clé API
3. **[Partie 3 : Audit et Conformité](/blog/saas-playbook-3-audit-compliance)** — Logs immuables, GDPR, SOC 2
4. **[Partie 4 : Mise à l'Échelle des APIs Multi-Tenant](/blog/saas-playbook-4-scaling-multi-tenant)** — De 50 à 5000 tenants
5. **[Partie 5 : Checklist de Production](/blog/saas-playbook-5-production-checklist)** — 20 portes avant le go-live
6. **Analyse Build vs Buy** — Cet article

Également dans cette série : **[Guide d'Achat API Gateway PME 2026](/blog/smb-api-gateway-buying-guide-2026)** — Une comparaison de fonctionnalités pour les équipes évaluant des options.

Prêt à démarrer ? Le chemin le plus rapide vers un API gateway multi-tenant prêt pour la production : [Quickstart STOA Docker Compose](/blog/mcp-gateway-quickstart-docker).

## FAQ

### L'open-source est-il vraiment « gratuit » ?

Non. L'open-source élimine les coûts de licence logicielle mais pas les coûts d'infrastructure, le temps d'ingénierie pour le déploiement et la maintenance, ni les coûts de support. L'analyse de coûts ci-dessus en tient compte. L'OSS auto-hébergé est moins cher que la construction personnalisée ou le SaaS managé à la plupart des échelles parce que l'investissement d'ingénierie est bien moindre — vous configurez et opérez un logiciel, vous ne le construisez pas.

### Quelle est la précision des estimations de coûts d'ingénierie ?

Les estimations utilisent 800€/jour comme coût chargé d'un ingénieur senior en Europe de l'Ouest. Votre coût réel dépend de la localisation, du mix de séniorité et de si vous utilisez des contractants ou des employés. Utilisez-les comme guide directionnel, pas comme prédictions précises. Les coûts relatifs entre les options sont plus fiables que les chiffres absolus.

### Et si nous commençons par une construction personnalisée et basculons plus tard ?

Passer d'un gateway personnalisé à l'OSS a un coût de migration (typiquement 2 à 6 semaines d'ingénierie) mais est presque toujours la bonne décision à long terme si le gateway personnalisé a acquis une complexité non triviale. Le risque principal : les gateways personnalisés accumulent de la logique métier (flux d'authentification personnalisés, règles de routage propriétaires) qui est coûteuse à migrer. Plus tôt vous faites le changement, plus le coût de migration est faible.

### Cette analyse prend-elle en compte les gateways open-source commerciaux (licence BSL) ?

Non. Certains gateways qui semblent open-source utilisent la Business Source License (BSL) ou des licences similaires qui restreignent l'usage commercial. STOA et Kong CE sont sous licence Apache 2.0 — véritablement open source sans restrictions commerciales. Vérifiez toujours la licence avant de vous engager dans une option OSS. Pour notre raisonnement sur Apache 2.0 spécifiquement, voir [Pourquoi Apache 2.0 et pas BSL](/blog/why-apache-2-not-bsl).
