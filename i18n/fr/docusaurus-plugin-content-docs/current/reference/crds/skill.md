---
sidebar_position: 4
title: "CRD Skill"
description: "Spécification de la CRD Skill (skills.gostoa.dev) — injection déclarative de contexte système pour agents IA selon les portées global, tenant, tool et user."
keywords: [Skill CRD, Kubernetes, MCP, injection de contexte, system prompt, ADR-047, gostoa.dev]
---

# CRD Skill

La CRD `Skill` (`charts/stoa-platform/crds/skills.gostoa.dev.yaml`, [ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) définit des instructions système injectées par `stoa-gateway` dans le contexte d'exécution des agents IA selon une hiérarchie de spécificité inspirée de CSS (`global` < `tenant` < `tool` < `user`).

:::warning Injection de contexte vs contrôle bloquant
Une ressource `Skill` injecte des consignes de prompt dans le contexte de l'agent LLM ; elle ne constitue **pas** un contrôle bloquant de sécurité, d'autorisation ou de validation de schéma sur les appels d'outils. Appliquez les contrôles bloquants via les politiques d'outils signées par tenant ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)), les règles OPA et `Tool.spec.inputSchema`.
:::

## Métadonnées de Ressource

| Champ | Valeur |
|-------|--------|
| **Nom CRD** | `skills.gostoa.dev` |
| **Version API** | `gostoa.dev/v1alpha1` |
| **Kind** | `Skill` |
| **Nom court** | `sk` |
| **Portée** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`, `STOA_K8S_ENABLED=true` avec feature `k8s`) |

## Exemple Complet

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: payment-currency-policy
  namespace: tenant-acme
spec:
  name: Consigne Devises Paiement
  description: Guider les agents pour transmettre les codes devises ISO-4217 et les montants en centimes
  scope: tool
  priority: 80
  toolRef: tenant-acme_payment_create
  instructions: |
    Toujours transmettre les montants monétaires en centimes entiers avec un code devise ISO-4217 à 3 lettres (EUR, USD, GBP). Demander confirmation à l'utilisateur au-delà de 100000 centimes avant d'appeler tenant-acme_payment_create.
  enabled: true
```
*(Note : `spec.toolRef` est comparé par égalité exacte au nom d'outil résolu sur la passerelle — pour un `Tool` nommé `payment-create` dans `tenant-acme`, `CrdWatcher` enregistre `tenant-acme_payment_create`.)*

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
| `toolRef` | `string` | — | Chaîne | Nom exact de l'outil enregistré (`{namespace}_{snake_case(name)}`) lorsque `scope: tool` |
| `userRef` | `string` | — | Chaîne | Identifiant de l'utilisateur cible lorsque `scope: user` |
| `enabled` | `boolean` | `true` | Booléen | Active ou désactive ce skill dans le résolveur |

## Spécificité & Ordre de Résolution

Lorsque `stoa-gateway` résout les skills applicables à une requête (`GET /admin/skills/resolve?tenant_id=<id>`), les skills actifs correspondants sont ordonnés par `scope` (`global` → `tenant` → `tool` → `user`) puis par `priority` (`0..100`).

## Sous-ressource `status`

Le schéma CRD définit les champs `.status` (`registered`, `lastSeen`, `error`) et les colonnes d'affichage (`Scope`, `Priority`, `Enabled`, `Registered`). Sur `main`, `CrdWatcher` met à jour le `SkillResolver` en mémoire sans patcher `.status` auprès de l'API Kubernetes :

| Champ | Type | Défaut | Description |
|-------|------|--------|-------------|
| `registered` | `boolean` | `false` | Champ schéma d'état d'enregistrement (non patché par `CrdWatcher` sur `main`) |
| `lastSeen` | `string` | — | Champ schéma d'horodatage (non patché par `CrdWatcher` sur `main`) |
| `error` | `string` | — | Détail d'erreur éventuel |

## Ressources Associées

- [API Admin du Gateway (`/admin/skills/*`)](/docs/api/gateway-admin-api) — Inspecter, résoudre ou synchroniser les skills
- [CRD Tool](./tool.md) — Définir les outils référencés par `spec.toolRef`
- [ADR-047 : Système de Skills MCP](/docs/architecture/adr/adr-047-mcp-skills-system)
