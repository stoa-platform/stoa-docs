---
sidebar_position: 4
title: "FAQ : Questions & Réponses sur la Plateforme STOA"
description: Questions fréquentes sur le modèle open source de STOA, sa viabilité, sa licence (Apache 2.0), ses tarifs, son support MCP et ses options de déploiement
keywords: [FAQ, open source, licensing, Apache 2.0, sustainability, community]
---

# Questions Fréquentes

Des réponses honnêtes aux questions sceptiques sur le modèle open source de STOA.

---

## Licence & Protection

### Pourquoi Apache 2.0 plutôt que BSL ou SSPL ?

**En bref** : Nous avons choisi la communauté plutôt que le contrôle.

**En détail** : BSL (Business Source License) et SSPL disent "nous vous faisons confiance, mais pas à ce point." Résultat ? OpenTofu a forké HashiCorp en 3 mois. Elasticsearch est devenu OpenSearch.

Nous faisons le choix d'Apache 2.0 avec redistribution. La protection ne vient pas de la licence — elle vient de :

1. **La marque** — "STOA" est déposée auprès de l'INPI
2. **45% de redistribution** — Crée de la fidélité
3. **L'écosystème** — Bindings MCP, templates UAC, communauté

Vous voulez une licence qui fait peur aux gens, ou une communauté qui veut rester ?

### Qu'est-ce qui empêche AWS de forker STOA demain ?

Ils peuvent. Mais :

1. **Protection de la marque** — Ils ne peuvent pas l'appeler "STOA" (déposé INPI ✅)
2. **Pas d'accès à la certification** — Sans certification, pas de programme partenaire
3. **L'écosystème reste ici** — Bindings MCP, templates UAC, intégrations
4. **Les contributeurs sont payés ICI** — Pourquoi partiraient-ils ?

AWS a forké Elasticsearch au milieu d'un litige de licence. Notre objectif est de partager la valeur directement avec les contributeurs. Pourquoi quelqu'un partirait-il ?

### Kubernetes avait Google avec 3M$/an. Qu'avez-vous ?

Google a donné 3M$ pour que K8s reste neutre et que personne n'en prenne le contrôle.

Nous faisons le contraire : nous gardons le contrôle ET redistribuons 45% aux contributeurs et à la fondation. C'est proportionnellement plus généreux que Google.

La vraie comparaison :

| | Kubernetes | STOA |
|---|---|---|
| Investissement initial | 3M$ de Google | Bootstrap |
| Contrôle | CNCF (neutre) | HLFH (aligné) |
| Récompenses contributeurs | Réputation uniquement | 15% du chiffre d'affaires |
| Financement de la fondation | Sponsors corporate | 10% du chiffre d'affaires |

---

## Modèle Commercial

### Comment gagnez-vous de l'argent avec Apache 2.0 ?

Comme Red Hat, Confluent, HashiCorp (avant BSL) :

1. **Support Entreprise** — SLAs, support dédié, intégrations personnalisées
2. **Service Géré** — STOA Cloud (prévu 2027)
3. **Certification** — Certifications développeur et architecte
4. **Formation** — Ateliers, accompagnement, conseil
5. **Programme Partenaires** — Partage des revenus avec les intégrateurs

Le code est gratuit. L'expertise, le support et la commodité ne le sont pas.

### Et si un concurrent propose le même service moins cher ?

Ils peuvent essayer. Mais :

1. **Nous connaissons le code mieux que quiconque** — Nous l'avons écrit
2. **Correctifs upstream** — Correctifs de sécurité disponibles à la source
3. **Confiance de la communauté** — Les contributeurs travaillent avec nous, pas contre nous
4. **Influence sur la feuille de route** — Les clients enterprise façonnent le produit

Red Hat a des concurrents qui proposent un support RHEL "gratuit". Red Hat domine toujours. Même principe.

### Ce modèle est-il viable sur le long terme ?

Le modèle est conçu pour être auto-suffisant : à mesure que les revenus enterprise augmentent, tous les fonds (fondation, mainteneurs, contributeurs, opérations) augmentent proportionnellement. Pas de dépendance au capital-risque. Pas de "pivot enterprise" en trompe-l'œil.

---

## Contributeurs

### Où est le vrai barème de points ? N'est-ce pas du vaporware ?

Il est documenté ici même sur [docs.gostoa.dev/community/rewards](/docs/community/rewards).

Chaque trimestre, nous publions :
- Le fonds disponible
- Les points de chaque contributeur
- Les paiements effectués

Transparence totale. Vous voulez voir le tableur ? C'est un Google Sheet pour l'instant, mais l'intention est claire.

### Comment évitez-vous le contournement du système ?

Trois mécanismes :

1. **Système de niveaux** — Les contributions faciles avec l'IA (fautes de frappe, refactorisations basiques) rapportent moins
2. **Détection automatique** — Patterns comme le spam de PRs, les volumes inhabituels
3. **Multiplicateur de réputation** — Un historique de travail de qualité rapporte plus

De plus : 30% des contributeurs peuvent opposer leur veto à tout changement de notation.

### Et le travail invisible comme le mentorat et le triage ?

Nous le suivons explicitement :

| Contribution | Points |
|--------------|--------|
| Triage d'issue + reproduction | 5 |
| Aide communautaire (Discord) | 2 par réponse |
| Mentorat (documenté) | 20 par session |
| Rédaction de RFC | 100 |

Le travail invisible n'est plus invisible.

---

## Gouvernance

### Qui décide de ce qui est construit ?

Une gouvernance en couches :

1. **Constitution** (immuable) — Principes fondamentaux, nécessite 2/3 de majorité + 1 an de préavis pour changer
2. **Lois** (stables) — Dimensions de valeur, pondérations, nécessite majorité simple + 3 mois de préavis
3. **Règlements** (adaptatifs) — Métriques spécifiques, revue trimestrielle par le conseil

### Qu'est-ce que le Conseil d'Évolution de la Valeur ?

Un organe de gouvernance à 7 membres :

| Sièges | Mandat | Rôle |
|--------|--------|------|
| 3 contributeurs élus | 2 ans | Voix de la communauté |
| 2 experts du domaine | 2 ans | Technique + communauté |
| 1 conseiller externe | 1 an | Remettre en question les suppositions |
| 1 nouveau membre tournant | 6 mois | Perspective fraîche |

Contraintes :
- Aucune organisation > 2 sièges
- Au moins 2 membres hors UE
- Au moins 2 contributeurs indépendants

### Pouvez-vous changer les règles quand vous voulez ?

Non. La Constitution est conçue pour l'empêcher :

- Les **Principes** nécessitent 2/3 de majorité + 1 an de préavis + ratification
- Les **Lois** nécessitent majorité simple + 3 mois de préavis
- Les **Règlements** nécessitent le conseil + 2 semaines de retours

De plus : tous les changements passent par des périodes de transition graduelles. Pas de changements brusques.

---

## Technique

### Qu'est-ce que MCP et pourquoi STOA le supporte-t-il ?

MCP (Model Context Protocol) est un standard ouvert d'Anthropic qui permet aux agents IA de découvrir et d'appeler des outils. STOA agit comme un MCP gateway — il expose vos APIs existantes comme des outils MCP afin que les agents IA puissent les utiliser en toute sécurité, avec authentification, limitation de débit et pistes d'audit.

En bref : **MCP est la façon dont les agents IA parlent aux APIs. STOA rend cette conversation sécurisée et gouvernée.**

Consultez notre [guide MCP Gateway](/docs/guides/mcp-getting-started) pour plus de détails.

### Qu'est-ce que l'UAC (Universal API Contract) ?

L'UAC est l'approche "Define Once, Expose Everywhere" de STOA. Vous écrivez un contrat d'API et STOA génère automatiquement :

- Des bindings REST/OpenAPI
- Des définitions d'outils MCP
- Des schémas GraphQL (planifié)
- Des définitions de services gRPC (planifié)

Cela signifie que vous définissez votre surface API une seule fois et l'exposez via n'importe quel protocole. Consultez la [page concept UAC](/docs/concepts/uac).

### Puis-je exécuter STOA sur site ?

Oui. STOA est conçu pour un déploiement hybride :

- Le **Control Plane** peut fonctionner dans le cloud ou sur site
- Le **Data Plane** (STOA Gateway) fonctionne là où se trouvent vos APIs — sur site, dans le cloud ou en edge
- **Pas de communication sortante imposée** — le gateway fonctionne indépendamment

Consultez le [guide de déploiement](/docs/deployment/hybrid) pour les détails d'architecture.

### Quels API gateways STOA peut-il remplacer ou compléter ?

STOA fonctionne aux côtés des gateways existants (Kong, Gravitee, Apigee, webMethods, AWS API Gateway, Azure APIM) grâce à son système d'adaptateurs. Vous n'avez pas besoin de tout remplacer — STOA orchestre vos gateways existants depuis un seul Control Plane.

Consultez nos [guides de migration](/docs/guides/migration/) pour les transitions spécifiques à chaque gateway.

### Quelle est la pile technologique ?

| Composant | Technologie |
|-----------|------------|
| Control Plane API | Python 3.11, FastAPI, SQLAlchemy |
| Console UI | React 18, TypeScript, Vite |
| Developer Portal | React 18, TypeScript, Vite |
| STOA Gateway | Rust (Tokio, axum) |
| Auth | Keycloak (OIDC/OAuth 2.1) |
| Observabilité | OpenTelemetry, Prometheus, Grafana |

---

## Encore Sceptique ?

C'est bien. Le scepticisme est sain.

Voici ce que nous vous demandons :

1. **Observez-nous** — Suivez nos rapports trimestriels
2. **Challengez-nous** — Posez des questions difficiles sur Discord
3. **Vérifiez-nous** — Le tableau de bord sera public
4. **Jugez-nous sur les résultats** — Premières distributions dès que les revenus enterprise arrivent

Nous préférons mériter votre confiance plutôt que l'exiger.

---

*Vous avez une question sans réponse ici ? Posez-la dans `#questions` sur [Discord](https://discord.gostoa.dev) ou par email à [hello@gostoa.dev](mailto:hello@gostoa.dev)*
