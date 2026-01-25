---
title: "ADR-022: UAC Tenant Architecture"
sidebar_label: "ADR-022: UAC Tenant Architecture"
sidebar_position: 22
description: "Flat files over inheritance for UAC configuration"
---

# ADR-022: UAC Tenant Architecture — Flat Files over Inheritance

> **Decision:** Un fichier UAC complet et autonome par tenant, sans inheritance ni merge.
>
> **Status:** Accepted
>
> **Date:** 2026-01-25
>
> **Linear:** [CAB-931](https://linear.app/hlfh-workspace/issue/CAB-931)

---

## Contexte

STOA Platform utilise des fichiers **UAC (Universal API Contract)** pour définir la configuration de chaque tenant : policies de sécurité, rate limiting, quotas, accès aux APIs, observabilité, etc.

### Question architecturale

> **Comment structurer les fichiers UAC pour supporter plusieurs tenants tout en restant maintenable, auditable et simple à debugger ?**

### Contraintes identifiées

| Contrainte | Impact |
|------------|--------|
| **MVP 26/02/2026** | 2-3 tenants seulement pour la démo |
| **Auditabilité RSSI** | Le client veut voir "SON" fichier, pas un merge de 6 couches |
| **Debug rapide** | "D'où vient cette valeur ?" doit avoir une réponse immédiate |
| **CIR (Crédit Impôt Recherche)** | Architecture traçable et documentée |

---

## Decision

Adopter l'**Option A : One UAC per Tenant (Flat)** — chaque tenant possède un fichier `uac.yaml` complet et autonome.

### Structure retenue

```
stoa-catalog/
├── _templates/
│   ├── starter.yaml      # Template tier Starter
│   └── enterprise.yaml   # Template tier Enterprise
└── tenants/
    ├── engie/
    │   └── uac.yaml      # Config COMPLÈTE Engie
    ├── demo-tenant/
    │   └── uac.yaml      # Config COMPLÈTE demo
    └── acme-corp/
        └── uac.yaml      # Config COMPLÈTE Acme
```

### Diagramme

```mermaid
flowchart TB
    subgraph Templates["_templates/"]
        T1[starter.yaml]
        T2[enterprise.yaml]
    end

    subgraph Tenants["tenants/"]
        subgraph E["engie/"]
            E1[uac.yaml<br/>COMPLET]
        end
        subgraph D["demo-tenant/"]
            D1[uac.yaml<br/>COMPLET]
        end
        subgraph A["acme-corp/"]
            A1[uac.yaml<br/>COMPLET]
        end
    end

    T1 -.->|"copier pour<br/>bootstrap"| E1
    T2 -.->|"copier pour<br/>bootstrap"| A1

    style E1 fill:#90EE90
    style D1 fill:#90EE90
    style A1 fill:#90EE90
```

---

## Options Considered

### Option A — One UAC per Tenant (Flat) ✅ RETENUE

Un fichier `uac.yaml` complet par tenant, avec templates pour le bootstrap initial.

| Aspect | Évaluation |
|--------|------------|
| **Complexité** | Minimale |
| **Debug** | Trivial — une seule source |
| **Auditabilité** | Excellente — fichier isolé par client |
| **Duplication** | Oui, mais acceptable pour 2-15 tenants |
| **Mass-updates** | Via scripts (`yq`, CI/CD) |

**Pros:**
- Explicite et prévisible
- Chaque tenant a "son" fichier visible
- Debug immédiat : pas de "d'où vient cette valeur ?"
- Enterprise-friendly : le RSSI audite UN fichier
- Zero magie, zero surprise

**Cons:**
- Duplication de config entre tenants similaires
- Mass-updates nécessitent des scripts

---

### Option B — Global UAC unique ❌ REJETÉE

Un seul fichier UAC partagé par tous les tenants.

| Aspect | Évaluation |
|--------|------------|
| **Complexité** | Minimale |
| **Isolation** | Nulle |
| **Blast radius** | Maximal |

**Pros:**
- Zero duplication
- Une seule source de vérité

**Cons:**
- Blast radius maximal : une erreur impacte TOUS les tenants
- Versioning impossible par tenant
- Paralysie du changement : peur de casser tout le monde
- Incompatible avec isolation multi-tenant

---

### Option C — Hybride Ansible-style ❌ REJETÉE

Système d'inheritance multi-couches inspiré d'Ansible.

```yaml
# Merge order (du moins au plus spécifique)
defaults/base.yaml        # Valeurs par défaut globales
├── tiers/starter.yaml    # Override par tier
│   └── verticals/energy.yaml    # Override par vertical
│       └── tenants/engie/uac.yaml   # Override final tenant
```

| Aspect | Évaluation |
|--------|------------|
| **Complexité** | Élevée |
| **Scalabilité** | Excellente (50+ tenants) |
| **Debug** | Complexe |

**Pros:**
- Élégant et DRY
- Scalable pour 50+ tenants
- Modifications globales faciles

**Cons:**
- Over-engineering prématuré pour 2-3 tenants
- Debug complexe : "d'où vient cette valeur ?" nécessite de parcourir 4-6 fichiers
- Ordre de merge à documenter et comprendre
- YAGNI — on n'en a pas besoin maintenant

---

## Rationale

### 1. MVP First

Nous visons 2-3 tenants pour la démo du 26/02/2026. L'Option C (Ansible-style) est conçue pour 50+ tenants — c'est de l'over-engineering prématuré.

### 2. Explicite > Magique

Le RSSI d'un client Enterprise veut voir **son** fichier de configuration, pas comprendre un système de merge à 6 couches. Un fichier flat par tenant = audit trivial.

### 3. YAGNI (You Aren't Gonna Need It)

Si nous atteignons 15+ tenants et que la duplication devient douloureuse, nous migrerons vers Ansible-style. Pas avant. Voir [CAB-934](https://linear.app/hlfh-workspace/issue/CAB-934).

### 4. Philosophie

> **"Ship the simplest thing that works. Refactor when it hurts."**

---

## Consequences

### Positives

- ✅ **Debug instantané** : une valeur = un fichier = une réponse
- ✅ **Auditabilité parfaite** : chaque tenant a son fichier isolé
- ✅ **Onboarding simplifié** : copier un template, modifier, terminé
- ✅ **Blast radius minimal** : une erreur n'impacte qu'un tenant
- ✅ **CI/CD simple** : validation par fichier, pas de résolution de merge

### Négatives

- ⚠️ **Duplication** : les configs similaires sont répétées
- ⚠️ **Mass-updates manuels** : changement global = script sur N fichiers
- ⚠️ **Refactoring futur** : migration vers Ansible-style si 15+ tenants

---

## Trigger de réévaluation

Cette décision sera réévaluée si :

| Condition | Action |
|-----------|--------|
| **15+ tenants actifs** | Évaluer migration vers Ansible-style |
| **Douleur maintenance** | Mass-updates trop fréquents ou erreurs de synchro |
| **Demande client** | Besoin explicite d'inheritance |

Ticket de suivi : [CAB-934 — Evaluate Ansible-style at 15+ tenants](https://linear.app/hlfh-workspace/issue/CAB-934)

---

## Compliance — Impact CIR

Cette décision d'architecture simplifie l'audit CIR (Crédit Impôt Recherche) :

| Aspect CIR | Bénéfice |
|------------|----------|
| **Traçabilité** | Chaque tenant = un fichier versionné dans Git |
| **Reproductibilité** | Configuration explicite, pas de magie |
| **Documentation** | Cet ADR documente le raisonnement technique |
| **État de l'art** | Comparaison avec 3 alternatives justifie le choix |

---

## Liens

- **Linear:** [CAB-931 — UAC Architecture Decision](https://linear.app/hlfh-workspace/issue/CAB-931)
- **Related:** [CAB-912 — MCP Gateway Rust + UAC Enforcer](https://linear.app/hlfh-workspace/issue/CAB-912)
- **Future:** [CAB-934 — Evaluate Ansible-style at 15+ tenants](https://linear.app/hlfh-workspace/issue/CAB-934)
- **Related ADR:** [ADR-021: UAC-Driven Observability](./adr-021-uac-driven-observability.md)
