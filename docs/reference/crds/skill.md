---
sidebar_position: 4
title: "Skill CRD"
description: "Skill CRD specification (skills.gostoa.dev) — declarative CSS-like context injection for AI agents across global, tenant, tool, and user scopes."
keywords: [Skill CRD, Kubernetes, MCP, context injection, system prompt, ADR-047, gostoa.dev]
---

# Skill CRD

The `Skill` CRD (`charts/stoa-platform/crds/skills.gostoa.dev.yaml`, [ADR-047](/docs/architecture/adr/adr-047-mcp-skills-system)) defines scoped system-prompt instructions injected by `stoa-gateway` into AI agent tool execution contexts using CSS-like specificity (`global` < `tenant` < `tool` < `user`).

:::warning Context injection vs hard enforcement
A `Skill` injects prompt instructions into the LLM agent's context; it does **not** enforce hard security, authorization, or schema validation guardrails on tool calls. Enforce hard access and payload rules via signed tenant tool policies ([ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)), OPA policies, and `Tool.spec.inputSchema`.
:::

## Resource Metadata

| Field | Value |
|-------|-------|
| **CRD Name** | `skills.gostoa.dev` |
| **API Version** | `gostoa.dev/v1alpha1` |
| **Kind** | `Skill` |
| **Short Name** | `sk` |
| **Scope** | `Namespaced` |
| **Watcher** | `stoa-gateway` (`CrdWatcher`, `STOA_K8S_ENABLED=true` with `k8s` feature) |

## Complete Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: payment-currency-policy
  namespace: tenant-acme
spec:
  name: Payment Currency Guidance
  description: Instruct agents to pass ISO-4217 currency codes and cents precision on payment tools
  scope: tool
  priority: 80
  toolRef: tenant-acme_payment_create
  instructions: |
    Always pass monetary amounts in integer minor units (cents) and explicit ISO-4217 3-letter currency codes (EUR, USD, GBP). Confirm amounts above 100000 cents with the user before calling tenant-acme_payment_create.
  enabled: true
```
*(Note: `spec.toolRef` is matched by exact equality against the resolved gateway tool name — for a `Tool` named `payment-create` in namespace `tenant-acme`, `CrdWatcher` registers `tenant-acme_payment_create`.)*

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
| `toolRef` | `string` | — | String | Exact registered gateway tool name (`{namespace}_{snake_case(name)}`) when `scope: tool` |
| `userRef` | `string` | — | String | Target user identifier when `scope: user` |
| `enabled` | `boolean` | `true` | Boolean | Whether this skill is active in the resolver |

## Specificity & Resolution Order

When `stoa-gateway` resolves skills for an incoming request (`GET /admin/skills/resolve?tenant_id=<id>`), matching enabled skills are ordered first by `scope` (`global` → `tenant` → `tool` → `user`) and then by `priority` (`0..100`).

## Status Subresource (`status`)

The CRD defines `.status` fields (`registered`, `lastSeen`, `error`) and printer columns (`Scope`, `Priority`, `Enabled`, `Registered`). On `main`, `CrdWatcher` upserts skills into the in-memory `SkillResolver` without patching `.status` back to the Kubernetes API server:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `registered` | `boolean` | `false` | Schema field for registration state (not patched by `CrdWatcher` on `main`) |
| `lastSeen` | `string` | — | Schema field for last watcher timestamp (not patched by `CrdWatcher` on `main`) |
| `error` | `string` | — | Schema field for registration error details |

## Related Resources

- [Gateway Admin API (`/admin/skills/*`)](/docs/api/gateway-admin-api) — Inspect, resolve, or sync skills at runtime
- [Tool CRD](./tool.md) — Define tools referenced by `spec.toolRef`
- [ADR-047: MCP Skills System](/docs/architecture/adr/adr-047-mcp-skills-system)
