---
title: "ADR-037 : Modes de Déploiement — Souveraineté d'Abord"
description: "Décide de la stratégie de déploiement souverain en premier avec des modes on-premise, hybride et SaaS pour les organisations européennes régulées."
keywords: [modes de déploiement, cloud souverain, souveraineté des données, NIS2, DORA, on-premise, hybride]
---

# ADR-037 : Stratégie des Modes de Déploiement — Souveraineté d'Abord

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-06 |
| **Décideurs** | Christophe ABOULICAM |
| **Linear** | [CAB-1111](https://linear.app/hlfh-workspace/issue/CAB-1111/adr-deployment-modes-strategy-sovereign-first) |
| **Migré depuis** | ADR-033 du repo stoa (conflit de numéro) |

## Contexte

STOA Platform cible les organisations européennes régulées (banques, assurances, défense) qui opèrent sous des exigences strictes de souveraineté des données (NIS2, DORA, RGPD, restrictions CLOUD Act).

### Paysage Concurrentiel

Tous les grands vendeurs de gateways API poussent les clients vers des plans de contrôle hébergés dans le cloud :

| Vendeur | Stratégie | Contrainte |
|---------|----------|------------|
| Kong | Kong Gateway (on-prem) + Konnect (SaaS) | Pousse vers Konnect avec une tarification on-prem agressive |
| Apigee | Apigee Hybrid | Le plan de contrôle reste chez Google, le runtime on-prem nécessite Anthos |
| MuleSoft | Anypoint Platform | Plan de contrôle cloud uniquement, Mule Runtime on-prem |
| Gravitee | APIM | Disponible on-prem mais positionnement SaaS-first |

**Aucun ne propose un vrai mode entièrement souverain** où le Plan de Contrôle et le Plan de Données s'exécutent entièrement dans l'infrastructure du client sans aucune dépendance externe.

### Problème

Le premier document de présentation STOA décrit une architecture « Plan de Contrôle Cloud + Gateway On-Premise » (mode Hybride). Cependant, nos clients cibles principaux — les banques centrales européennes et les institutions financières régulées — ne peuvent souvent pas accepter de composant hébergé dans le cloud auprès d'un vendeur tiers en raison de :

1. **CLOUD Act** : Les fournisseurs cloud américains peuvent être contraints de remettre des données, indépendamment de l'endroit où elles sont stockées
2. **Exigences BCE/ECB** : L'infrastructure bancaire centrale doit être entièrement contrôlable
3. **Directive NIS2** : L'infrastructure critique doit démontrer la souveraineté de la chaîne d'approvisionnement
4. **DORA** : Les entités financières doivent s'assurer que le risque lié aux tiers ICT est entièrement géré

## Décision

STOA supportera **trois modes de déploiement**, livrés par phases :

### Modes de Déploiement

| Mode | Plan de Contrôle | Plan de Données | Cible | Phase |
|------|-----------------|-----------------|-------|-------|
| **Souverain** | On-prem client | On-prem client | Banques, défense, EU régulée | **Phase 1 (maintenant)** |
| **Hybride** | STOA Cloud | On-prem client | Entreprise standard | Phase 2 (post-v1.0) |
| **SaaS** | STOA Cloud | STOA Cloud | Startups, PME | Phase 3 |

### Pourquoi la Souveraineté d'Abord

1. **Adéquation marché** : Les clients cibles (BCE, banques centrales, assurances) ne peuvent pas placer le Plan de Contrôle chez un tiers
2. **Avantage concurrentiel** : Kong/Apigee ne proposent pas de vrai mode entièrement on-prem sans dépendances cloud
3. **Crédibilité** : Prouver que cela fonctionne dans le mode le plus contraint rend les modes moins contraints triviaux
4. **Trajectoire UE** : NIS2, DORA, RGPD — la réglementation évolue vers plus de contrôle, pas moins
5. **Client de référence** : Le premier client beta est une grande banque centrale UE → le mode Souverain est le seul mode acceptable

### Stratégie de Support des Versions

| Type | Fenêtre de support | Cible |
|------|-------------------|-------|
| Dernière version | 6 mois | Adopteurs précoces, contributeurs |
| LTS | 2 ans | Entreprise |
| Étendu | 3 ans (payant) | Secteurs régulés |

### Environnements Certifiés

| Plateforme | Version Minimale |
|------------|-----------------|
| Kubernetes | 1.28+ |
| Helm | 3.12+ |
| OpenShift | 4.14+ |
| EKS / GKE / AKS | Current - 2 |

Le bare metal sans orchestrateur (Rancher, OpenShift minimum) n'est **pas supporté**.

### Télémétrie par Mode

| Mode | Télémétrie | Détail |
|------|-----------|--------|
| SaaS | Complète (incluse) | Métriques, logs, traces — temps réel |
| Hybride | Anonymisée (opt-out payant) | Version, uptime, utilisation des fonctionnalités, nombre d'erreurs |
| Souverain | Rapport trimestriel opt-in | PDF anonymisé, pas de flux de données continu |

Le mode Souverain ne nécessitera jamais de connectivité réseau sortante. Le rapport trimestriel optionnel est généré localement et transmis manuellement par le client.

### Orientation Tarifaire

| Mode | Prix Relatif | Marge Typique | Inclut |
|------|-------------|--------------|--------|
| SaaS | $X/mois | ~80% | Tout |
| Hybride | $2X/mois | ~60% | CP Cloud + support |
| Souverain | $4X/mois + support obligatoire | ~40% | Licence + support dédié |

La structure tarifaire oriente naturellement les clients vers Hybride/SaaS à moins qu'ils n'aient de véritables exigences de souveraineté (air-gapped, défense, santé, banques centrales).

## Conséquences

### Positives

- **Positionnement unique** sur le marché européen des gateways API — aucun concurrent n'offre de vrai mode souverain
- **Signal de confiance** pour les secteurs régulés — « nous n'avons pas besoin de voir vos données »
- **Simplifie l'architecture de la Phase 1** — pas d'infrastructure cloud multi-tenant à construire encore
- **Alignement client de référence** — le premier client beta nécessite le mode Souverain
- **Cascade de crédibilité** — si ça fonctionne en air-gapped, ça fonctionne partout

### Négatives

- **Risque de fragmentation des versions** — atténué par les niveaux de support LTS + Étendu avec obligations contractuelles de mise à niveau
- **Coûts de support plus élevés par client** — atténués par les contrats de support obligatoires dans la tarification Souverain et la matrice d'environnements certifiés
- **Pas de télémétrie par défaut** — atténué par les endpoints de vérification de santé + rapports trimestriels optionnels
- **Boucle de feedback plus lente** — atténuée par un programme de design partners avec des canaux de communication directs
- **Revenus cloud différés** — compromis acceptable étant donné que les clients cibles de la Phase 1 n'achèteraient pas un produit cloud-only

### Impact sur les Artefacts Existants

| Artefact | Impact |
|----------|--------|
| Présentation Hybride (actuelle) | **Conserver telle quelle** pour la démo du 24 fév. — Hybride est plus simple à présenter en 5 min |
| Démo 24 fév. | Mentionner Souverain oralement comme « One More Thing » pour le public RSSI/architecte |
| Présentation Souverain | Créer après la démo pour les prospects en banque centrale |
| Docs d'architecture | Mettre à jour pour montrer les 3 modes avec Souverain comme défaut |
| Charts Helm | Doivent fonctionner entièrement hors ligne (pas de téléchargement d'images externes en mode Souverain) |

## Alternatives Considérées

### A. Hybride d'Abord (rejeté)

Commencer avec un Plan de Contrôle Cloud + Plan de Données On-Prem. Rejeté parce que :
- Les clients cibles principaux ne peuvent pas accepter un Plan de Contrôle cloud
- Retarderait l'engagement avec le premier client de référence
- Nécessite de construire l'infrastructure cloud avant d'avoir des revenus

### B. Les Trois Modes Simultanément (rejeté)

Livrer les trois modes dès le départ. Rejeté parce que :
- Surface trop grande pour un fondateur solo
- L'infrastructure cloud (multi-tenant, facturation, SLA) est un produit séparé
- Souverain est le surensemble — Hybride et SaaS sont des sous-ensembles avec infrastructure gérée

### C. SaaS Uniquement (rejeté)

Suivre le marché vers le cloud-only. Rejeté parce que :
- Ignore le marché cible principal (UE régulée)
- Aucune différenciation vs Kong Konnect / Apigee
- Contredit le positionnement de souveraineté UE

## Références

- [Kong Gateway Pricing](https://konghq.com/products/kong-gateway)
- [Apigee Hybrid Architecture](https://cloud.google.com/apigee/docs/hybrid)
- [Gravitee APIM](https://www.gravitee.io)
- [Directive NIS2](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive)
- [Règlement DORA](https://www.eiopa.europa.eu/browse/regulation-and-policy/digital-operational-resilience-act-dora_en)
