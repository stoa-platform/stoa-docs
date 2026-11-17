---
sidebar_position: 4
title: "CRD Skill"
description: "Spécification de la CRD Skill (skills.gostoa.dev) — injection déclarative de contexte système pour agents IA selon les portées global, tenant, tool et user."
keywords: [Skill CRD, Kubernetes, MCP, injection de contexte, system prompt, ADR-047, gostoa.dev]
---

# CRD Skill

La CRD `Skill` (`charts/stoa-platform/crds/skills.gostoa.dev.yaml`, [ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) définit des instructions système injectées par `stoa-gateway` dans le contexte d'exécution des agents IA selon une hiérarchie de spécificité inspirée de CSS (`global` < `tenant` < `tool` < `user`).

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `skills.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `Skill` |
| **Nom court** | `sk` |
| **Portée** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: payment-currency-guardrail
  namespace: tenant-acme
spec:
  name: Politique Devises Paiement
  description: Imposer les codes devises ISO-4217 et les montants en centimes sur les outils de paiement
  scope: tool
  priority: 80
  toolRef: payment-create
  instructions: |
    Toujours transmettre les montants monétaires en centimes entiers avec un code devise ISO-4217 à 3 lettres (EUR, USD, GBP). Demander confirmation à l'utilisateur au-delà de 100000 centimes avant d'appeler payment-create.
  enabled: true
status:
  registered: true
  lastSeen: "2026-11-01T12:00:00Z"
```

## Champs `spec` (`openAPIV3Schema`)

### Champs Obligatoires

| Champ | Type | Valeurs / Contraintes imposées | Description |
|-------|------|--------------------------------|-------------|
| `name` | `string` | Obligatoire | Nom lisible du skill |
| `scope` | `string` | Obligatoire ; Enum : `global`, `tenant`, `tool`, `user` | Portée de spécificité (`global` < `tenant` < `tool` < `user`) |

### Champs Optionnels

| Champ | Type | Défaut | Valeurs / Contraintes imposées | Description |
|-------|------|--------|--------------------------------|-------------|
| `description` | `string` | — | Chaîne | Description administrative du skill |
| `priority` | `integer` | `50` | `minimum: 0`, `maximum: 100` | Priorité à portée égale (la valeur la plus élevée l'emporte) |
| `instructions` | `string` | — | Chaîne | Instructions système injectées dans le contexte de l'agent |
| `toolRef` | `string` | — | Chaîne | Nom de l'outil cible lorsque `scope: tool` |
| `userRef` | `string` | — | Chaîne | Identifiant de l'utilisateur cible lorsque `scope: user` |
| `enabled` | `boolean` | `true` | Booléen | Active ou désactive ce skill dans le résolveur |

## Spécificité & Ordre de Résolution

Lorsque `stoa-gateway` résout les skills applicables à une requête (`GET /admin/skills/resolve`), les skills actifs correspondants sont ordonnés par `scope` (`global` → `tenant` → `tool` → `user`) puis par `priority` (`0..100`).

## Sous-ressource `status`

| Champ | Type | Défaut | Description |
|-------|------|--------|-------------|
| `registered` | `boolean` | `false` | Indique si le skill est enregistré dans le `SkillResolver` de `stoa-gateway` |
| `lastSeen` | `string` | — | Horodatage du dernier événement traité par le watcher |
| `error` | `string` | — | Détail d'erreur en cas d'échec d'enregistrement |

`kubectl get skills` (ou `kubectl get sk`) affiche les colonnes `Scope`, `Priority`, `Enabled` et `Registered`.

## Ressources Associées

- [API Admin du Gateway (`/admin/skills/*`)](/docs/api/gateway-admin-api) — Inspecter, résoudre ou synchroniser les skills
- [CRD Tool](./tool.md) — Définir les outils référencés par `spec.toolRef`
- [ADR-047 : Système de Skills MCP](/docs/architecture/adr/adr-047-mcp-skills-system)
