---
title: "ADR-035 : Pattern d'Adapter pour Gateway"
description: "Décide du pattern d'adapter déclaratif pour l'orchestration de gateways API multi-vendeurs via des boucles de réconciliation REST idempotentes."
keywords: [adapter gateway, multi-vendeur, webMethods, réconciliation, GitOps, cycle de vie API]
---

# ADR-035 : Pattern d'Adapter pour Gateway

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-01-30 |
| **Migré depuis** | ADR-027 du repo stoa (conflit de numéro) |

## Contexte

La STOA Platform doit orchestrer les opérations du gateway API (cycle de vie des APIs, gestion des politiques, configuration OIDC, provisionnement des applications) dans le cadre de son pipeline GitOps. L'implémentation actuelle s'intègre directement avec webMethods API Gateway via son API REST Admin.

**Verrou technique** : Aucune solution existante ne fournit une réconciliation déclarative et idempotente d'un gateway API propriétaire (webMethods) via API REST avec :
- Gestion de l'état souhaité (Git comme source de vérité)
- Comparaison de l'état observé (runtime du gateway)
- Résolution de conflits bidirectionnelle (déclarations GitOps + provisionnement runtime depuis CAB-800)
- Garanties de convergence

Il n'existe pas de provider Terraform, d'opérateur Kubernetes ou de plugin ArgoCD pour webMethods API Gateway. Le même manque existe pour de nombreux gateways d'entreprise.

## Décision

Introduire le **Pattern d'Adapter pour Gateway** : une interface Python abstraite (`GatewayAdapterInterface`) qui définit le contrat pour l'orchestration du gateway. Chaque gateway supporté fournit une implémentation d'adapter concrète.

### Architecture

```
GatewayAdapterInterface (ABC)
├── WebMethodsGatewayAdapter     ← Première implémentation
├── KongGatewayAdapter           ← Planifié
├── ApigeeGatewayAdapter         ← Planifié
└── AWSApiGatewayAdapter         ← Planifié
```

### Opérations de l'Interface

L'interface couvre 7 domaines de ressources : APIs, Politiques, Applications, Auth/OIDC, Aliases, Configuration et Sauvegarde.

Toutes les opérations retournent `AdapterResult(success, resource_id, data, error)` et doivent être idempotentes.

### Points d'Intégration

1. **Service de Provisionnement** (CAB-800) : Utilise l'adapter pour le provisionnement d'applications en runtime
2. **Réconciliation Ansible** : Utilise directement l'API REST du gateway (pourrait être refactorisé pour utiliser l'adapter via CLI)
3. **Control Plane API** : Expose le statut du gateway via l'état de provisionnement des abonnements

## Conséquences

### Positives

- **Agnostique au gateway** : STOA peut orchestrer n'importe quel gateway implémentant l'interface
- **Testable** : L'interface abstraite permet des adapters mock pour les tests
- **Extensible** : De nouveaux gateways peuvent être ajoutés sans modifier la logique de réconciliation centrale
- **Éligible CIR** : Le pattern et sa première implémentation constituent une recherche originale (aucun art antérieur pour l'orchestration déclarative de webMethods)

### Négatives

- **Indirection** : Une couche supplémentaire entre le service et l'API du gateway
- **Désalignement d'impédance** : Certaines fonctionnalités spécifiques au gateway peuvent ne pas correspondre proprement à l'interface abstraite
- **Maintenance** : Chaque adapter doit être maintenu et testé indépendamment

### Risques

- Les API REST du gateway peuvent changer entre les versions (atténué par des mappers spécifiques à la version)
- Les opérations multi-étapes complexes (ex. configuration OIDC) peuvent nécessiter un séquençage spécifique au gateway

## ADRs Associés

- [ADR-024 : Architecture Gateway Unifiée](./adr-024-gateway-unified-modes.md) — 4 modes de déploiement
- [ADR-036 : Auto-Enregistrement du Gateway](./adr-036-gateway-auto-registration.md) — Onboarding gateway zéro-config

## Contexte de Recherche (CIR)

Ce travail adresse un problème technique nouveau : la **réconciliation déclarative de gateways API propriétaires**. Indicateurs clés :

1. **Pas d'art antérieur** : Aucun provider Terraform, opérateur K8s ou outil déclaratif n'existe pour webMethods API Gateway
2. **Gestion d'état bidirectionnelle** : Réconciliation de l'état déclaré par Git avec l'état provisionné en runtime (CAB-800)
3. **Abstraction réutilisable** : Le pattern d'adapter est applicable à n'importe quel vendeur de gateway
4. **Publication potentielle** : « Réconciliation Déclarative de Gateways API Propriétaires via Pattern d'Adapter Abstrait »
