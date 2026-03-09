---
sidebar_position: 4
title: Positionnement du MCP Gateway
description: "Clarifier ce que gère le MCP Gateway STOA par rapport aux fournisseurs d'IA — gouvernance des invocations d'outils, isolation multi-tenant et application des politiques (pas la facturation des tokens)"
keywords: [STOA, MCP Gateway, positioning, AI agents, governance, billing, concepts]
---

# Positionnement du MCP Gateway

Une question fréquente lors de l'évaluation de STOA : **« Quel est le lien avec la facturation des fournisseurs d'IA ? Les tokens ne sont-ils pas déjà gérés par Claude/OpenAI ? »**

Cette page clarifie exactement ce que gère le MCP Gateway STOA et sa relation avec les fournisseurs d'IA.

## Les Deux Couches

| Couche | Géré par | Ce qui est mesuré | Modèle de facturation |
|--------|----------|-------------------|----------------------|
| **Fournisseur d'IA** | Anthropic, OpenAI, etc. | Tokens consommés | Paiement par token |
| **MCP Gateway (STOA)** | Votre organisation | Invocations d'outils | Paiement par requête |

:::tip Idée Clé
**Ce sont des choses différentes.** STOA ne re-facture pas les tokens — STOA facture les **invocations d'outils** et fournit la **gouvernance**.
:::

## Ce que Fait le MCP Gateway STOA

### 1. Gouvernance et Application des Politiques

```
┌─────────────────────────────────────────────────────────┐
│                    Agent IA (Claude)                     │
│                          │                               │
│                    appelle outil                          │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              STOA MCP Gateway                    │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │    │
│  │  │   OPA   │  │  Audit  │  │  Rate Limiting  │  │    │
│  │  │Politiques│  │  Trail  │  │   par tenant    │  │    │
│  │  └─────────┘  └─────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                    redirige vers                          │
│                          ▼                               │
│                   Service Backend                        │
└─────────────────────────────────────────────────────────┘
```

- **Politiques OPA** : Autorisation fine par outil, par utilisateur, par tenant
- **Piste d'Audit** : Journal complet de qui a appelé quel outil, quand et avec quels paramètres
- **Rate Limiting** : Contrôle de l'utilisation par équipe, par application, par utilisateur

### 2. Multi-Tenancy et Isolation

- **Isolation des Tenants** : Chaque équipe/département ne voit que ses outils autorisés
- **Quotas** : Définir des limites par tenant (ex. : « Équipe Marketing : 10 000 appels/mois »)
- **Tableaux de Bord** : Analyses d'utilisation par équipe, allocation des coûts

### 3. Catalogue Unifié

```
┌─────────────────────────────────────────┐
│         STOA Developer Portal            │
├─────────────────────────────────────────┤
│  APIs REST        │    Outils MCP        │
│  ────────────     │    ──────────        │
│  • API Paiement   │    • create_invoice  │
│  • API User       │    • search_orders   │
│  • API Produit    │    • generate_report │
└─────────────────────────────────────────┘
         Même portail, même abonnement,
              même gouvernance
```

### 4. Expérience Développeur

- **S'abonner** : Abonnement aux outils en un clic
- **Tester** : Essayez les outils directement depuis le portail
- **Surveiller** : Utilisation en temps réel, latence, taux d'erreur
- **Clés API** : Gestion sécurisée des clés avec 2FA

## Ce que STOA NE Fait PAS

:::danger Hors Périmètre
Ces éléments ne font explicitement **pas** partie de la proposition de valeur de STOA :
:::

| ❌ Ce que nous ne faisons pas | Pourquoi |
|-------------------------------|----------|
| Re-facturer les tokens Claude/OpenAI | C'est le rôle du fournisseur d'IA |
| Intercepter les réponses LLM | Problème de confidentialité, ajoute de la latence |
| Créer un « wrapper de l'API Claude » | Aucune valeur ajoutée, juste de la complexité |
| Compter les tokens dans les réponses | Déjà fait par le fournisseur |

## L'Équation de Valeur

**Sans le MCP Gateway STOA :**
- Les agents IA appellent les outils directement
- Aucune visibilité sur l'utilisation
- Aucune gouvernance
- Aucune isolation multi-tenant
- Chaque équipe gère son propre accès aux outils

**Avec le MCP Gateway STOA :**
- Catalogue d'outils centralisé
- Gouvernance Policy-as-Code
- Piste d'audit complète
- Analytiques d'utilisation et allocation des coûts
- Portail développeur en self-service

## Résumé

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Fournisseur d'IA (Claude, OpenAI, etc.)                │
│   └── Gère : Tokens, raisonnement, génération            │
│   └── Facture : Par token consommé                       │
│                                                          │
│   STOA MCP Gateway                                       │
│   └── Gère : Accès aux outils, gouvernance, multi-tenant │
│   └── Facture : Par invocation d'outil (optionnel)       │
│                                                          │
│   Vos Services Backend                                   │
│   └── Exécutent : Logique métier, accès aux données      │
│   └── Possèdent : Vos données, vos APIs                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**STOA est la couche de gouvernance entre les agents IA et vos outils d'entreprise.**
