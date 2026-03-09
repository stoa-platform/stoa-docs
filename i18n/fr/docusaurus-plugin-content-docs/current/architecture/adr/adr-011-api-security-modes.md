---
sidebar_position: 11
title: "ADR-011 : Modes de sécurité API"
description: "Décide la stratégie de sélection des modes de sécurité API, prenant en charge mTLS, OAuth2 et l'authentification hybride pour différents scénarios enterprise."
keywords: [sécurité API, mTLS, OAuth2, authentification hybride, modes de sécurité]
---

# ADR-011 : Sélection du mode de sécurité API — mTLS / OAuth2 / Hybride

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 11 janvier 2026 |
| **Linear** | [CAB-410](https://linear.app/hlfh-workspace/issue/CAB-410) |

## Contexte

STOA Gateway doit prendre en charge plusieurs modes de sécurité API selon les contextes d'utilisation. Plutôt que de laisser les équipes deviner, nous formalisons un **arbre de décision** qui recommande automatiquement le bon mode.

## Options envisagées

| Option | Description | Verdict |
|--------|-------------|---------|
| **mTLS uniquement** | Authentification par certificat client | ✅ Pour les API CORE internes |
| **OAuth2 uniquement** | Tokens JWT avec scopes | ✅ Pour les API SELF-SERVICE |
| **mTLS + OAuth2** | Double authentification | ✅ Pour les API critiques exposées |
| **Clé API uniquement** | Secret statique | ⚠️ Niveau community seulement |

## Décision

Implémenter un arbre de décision automatisé pour recommander le mode de sécurité API optimal.

### Arbre de décision

```
                    ┌─────────────────────┐
                    │  Type de consommateur│
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
         [Interne]                        [Externe]
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │  Type de flux ? │               │  OAuth2 requis  │
    └────────┬────────┘               └────────┬────────┘
             │                                  │
    ┌────────┴────────┐                        │
    │                 │                        ▼
  [A2A]           [User]              ┌─────────────────┐
    │                 │               │ Domaine critique?│
    │                 ▼               └────────┬────────┘
    │         OAuth2 requis                    │
    ▼                                 ┌────────┴────────┐
┌─────────────────┐                   │                 │
│Domaine critique?│                 [Oui]            [Non]
└────────┬────────┘                   │                 │
         │                            ▼                 ▼
    ┌────┴────┐              ┌──────────────┐  ┌──────────────┐
    │         │              │ mTLS + OAuth2│  │  OAuth2 seul │
  [Oui]    [Non]             │  (HYBRIDE)   │  │(SELF-SERVICE)│
    │         │              └──────────────┘  └──────────────┘
    ▼         ▼
┌────────┐ ┌────────────┐
│ mTLS   │ │ OAuth2 ou  │
│ (CORE) │ │ mTLS selon │
└────────┘ │ gouvernance│
           └────────────┘
```

### Règles de décision

| Cas | Conditions | Mode recommandé |
|-----|------------|-----------------|
| **🟢 CORE** | Interne + A2A + Critique + Droits stables | `mTLS` |
| **🔵 SELF-SERVICE** | Externe + User/BFF + Priorité DX | `OAuth2` |
| **🟣 HYBRIDE** | Critique + Externe + Gouvernance forte | `mTLS + OAuth2` |

## Conséquences

### Positives

- Recommandation automatique et cohérente
- Réduction des erreurs de configuration de sécurité
- Décisions documentées pour l'audit

### Négatives

- Complexité supplémentaire des outils
- Courbe d'apprentissage pour les équipes

### Neutres

- Les équipes peuvent déroger avec une justification documentée

## Outil MCP : `security-advisor`

```json
// Entrée
{
  "consumer_type": "internal | external",
  "flow_type": "a2a | user",
  "rights_variability": "static | dynamic",
  "domain_criticality": "low | high",
  "governance_level": "basic | strong"
}

// Sortie
{
  "recommended_security_mode": "mTLS | OAuth2 | mTLS+OAuth2",
  "justification": ["Domaine critique", "Flux A2A interne"],
  "risk_level": "low | medium | high",
  "implementation_notes": ["Certificat client à courte durée de vie", "Politique ABAC"]
}
```

## Références

- [CAB-410 : Implémentation de l'arbre de décision](https://linear.app/hlfh-workspace/issue/CAB-410)
- [CAB-361 : OAuth2/OIDC Enterprise](https://linear.app/hlfh-workspace/issue/CAB-361)
- ADR-015 : Tokens liés à l'expéditeur (planifié)
