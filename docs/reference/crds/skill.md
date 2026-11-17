---
sidebar_position: 4
title: "Skill CRD"
description: "Skill CRD specification (skills.gostoa.dev) — declarative CSS-like context injection for AI agents across global, tenant, tool, and user scopes."
keywords: [Skill CRD, Kubernetes, MCP, context injection, system prompt, ADR-047, gostoa.dev]
---

# Skill CRD

The `Skill` CRD (`charts/stoa-platform/crds/skills.gostoa.dev.yaml`, [ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) defines scoped system-prompt instructions injected by `stoa-gateway` into AI agent tool execution contexts using CSS-like specificity (`global` < `tenant` < `tool` < `user`).

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `skills.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `Skill` |
| **Short Name** | `sk` |
| **Scope** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`) |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: payment-currency-guardrail
  namespace: tenant-acme
spec:
  name: Payment Currency Policy
  description: Enforce ISO-4217 currency codes and cents precision on payment tools
  scope: tool
  priority: 80
  toolRef: payment-create
  instructions: |
    Always pass monetary amounts in integer minor units (cents) and explicit ISO-4217 3-letter currency codes (EUR, USD, GBP). Confirm amounts above 100000 cents with the user before calling payment-create.
  enabled: true
status:
  registered: true
  lastSeen: "2026-11-01T12:00:00Z"
```

## Spec Fields (`openAPIV3Schema`)

### Required Fields

| Field | Type | Enforced Values / Constraints | Description |
|-------|------|-------------------------------|-------------|
| `name` | `string` | Required | Human-readable skill name |
| `scope` | `string` | Required; Enum: `global`, `tenant`, `tool`, `user` | Specificity scope (`global` < `tenant` < `tool` < `user`) |

### Optional Fields

| Field | Type | Default | Enforced Values / Constraints | Description |
|-------|------|---------|-------------------------------|-------------|
| `description` | `string` | — | String | Skill summary for administrative visibility |
| `priority` | `integer` | `50` | `minimum: 0`, `maximum: 100` | Tie-breaker priority within the same `scope` (higher value wins) |
| `instructions` | `string` | — | String | System-prompt instructions injected into the agent context |
| `toolRef` | `string` | — | String | Target tool name when `scope: tool` |
| `userRef` | `string` | — | String | Target user identifier when `scope: user` |
| `enabled` | `boolean` | `true` | Boolean | Whether this skill is active in the resolver |

## Specificity & Resolution Order

When `stoa-gateway` resolves skills for an incoming request (`GET /admin/skills/resolve`), matching enabled skills are ordered first by `scope` (`global` → `tenant` → `tool` → `user`) and then by `priority` (`0..100`).

## Status Subresource (`status`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `registered` | `boolean` | `false` | Whether the skill is registered in `stoa-gateway`'s `SkillResolver` |
| `lastSeen` | `string` | — | Timestamp of the last watcher event |
| `error` | `string` | — | Error details if registration failed |

`kubectl get skills` (or `kubectl get sk`) displays `Scope`, `Priority`, `Enabled`, and `Registered`.

## Related Resources

- [Gateway Admin API (`/admin/skills/*`)](/docs/api/gateway-admin-api) — Inspect, resolve, or sync skills at runtime
- [Tool CRD](./tool.md) — Define tools referenced by `spec.toolRef`
- [ADR-047: MCP Skills System](/docs/architecture/adr/adr-047-mcp-skills-system)
