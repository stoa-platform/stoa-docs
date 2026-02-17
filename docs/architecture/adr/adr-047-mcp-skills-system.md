---
title: "ADR-047: MCP Skills System — Context Injection"
description: "Decides that STOA uses a hierarchical Skills system with Kubernetes CRDs for declarative context injection into MCP tool execution, resolved at the gateway middleware layer."
keywords: [MCP, skills, context injection, CRD, Kubernetes, gateway middleware, hierarchical resolution, AI agent]
---

# ADR-047: MCP Skills System — Context Injection

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Date** | 2026-02-17 |
| **Decision Makers** | Platform Team |
| **Linear** | CAB-1314 |
| **Council** | 8.00/10 Go |

### Related Decisions

- **ADR-024**: Gateway Unified Modes — edge-mcp mode hosts skill resolution
- **ADR-041**: Plugin Architecture — skills as enterprise feature gate (`k8s` feature flag)
- **ADR-045**: stoa.yaml Declarative Spec — skills section in declarative config
- **ADR-046**: MCP Federation Architecture — skills resolve after federation layer

## Context

AI agents connected via MCP receive tool definitions (name, description, input schema) from the gateway. However, enterprise deployments need to inject **additional context** into tool execution without modifying individual tool definitions — company-specific compliance rules, internal API conventions, domain glossaries, or per-team instructions.

### The Problem

Today, context customization requires one of these workarounds:

1. **Modify every tool description**: Add compliance notes to each tool's `description` field. Doesn't scale — 50 tools x 3 compliance rules = 150 manual edits, repeated on every policy change.

2. **Client-side system prompts**: Each AI agent prepends company rules in its system prompt. Not enforceable — the gateway cannot verify that agents actually include the context.

3. **Middleware hardcoding**: A custom middleware in the gateway that injects static text. Not configurable per tenant, not GitOps-friendly, requires gateway redeployment for changes.

### What We Need

A **declarative, hierarchical** system where platform administrators define context that is automatically injected into tool execution at the gateway layer — without modifying tool schemas and without requiring agent cooperation.

## Decision

### 1. Skill CRD (5th CRD Type)

Introduce a `Skill` Kubernetes Custom Resource Definition alongside existing CRDs (Subscription, Tenant, Tool, ToolSet):

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Skill
metadata:
  name: compliance-gdpr
  namespace: tenant-acme
  labels:
    stoa.dev/scope: tenant        # global | tenant | tool | user
    stoa.dev/priority: "100"      # Higher = applied later (overrides lower)
spec:
  displayName: GDPR Compliance Context
  description: Injects GDPR compliance instructions into tool execution
  scope:
    type: tenant                   # Resolution scope
    tenantId: acme                 # Which tenant (omit for global)
    toolPattern: "api-*"           # Optional: glob pattern to match tools
  context:
    instructions: |
      When processing data through this tool:
      - Never include personally identifiable information (PII) in logs
      - Mask email addresses and phone numbers in responses
      - Apply data minimization: only request fields needed for the operation
    metadata:
      regulation: GDPR
      lastReviewed: "2026-01-15"
  priority: 100                    # Resolution order (higher wins on conflict)
```

**CRD design choices**:
- **Namespace-scoped**: Tenant skills live in the tenant's namespace (existing pattern)
- **Global skills**: Live in `stoa-system` namespace with `scope.type: global`
- **Label-based filtering**: Gateway K8s watcher filters by `stoa.dev/scope` label
- **No PII or secrets in Skill definitions** (Council adjustment #4): Skills are stored in etcd as CRDs and are visible to all cluster operators. Context instructions must be policy/configuration, never credentials or personal data.

### 2. Hierarchical Resolution (CSS Cascade Model)

Skills resolve in a 4-level hierarchy. When multiple skills match a tool execution, they are merged in priority order:

```
Level 1: Global Skills        (stoa-system namespace, scope.type=global)
    ↓ merged with
Level 2: Tenant Skills        (tenant namespace, scope.type=tenant)
    ↓ merged with
Level 3: Tool-Specific Skills (scope.toolPattern matches tool name)
    ↓ merged with
Level 4: User Skills          (scope.userId matches authenticated user)
    ↓
Final resolved context (injected into tool execution)
```

**Resolution rules**:
- Higher levels are more specific and override lower levels on conflict
- Within the same level, `priority` field breaks ties (higher number wins)
- Multiple non-conflicting skills at the same level are concatenated
- Empty levels are skipped (no context injected at that level)

**Example resolution**:

```
Global: "Always include a request ID in API calls"          (priority: 10)
Tenant: "Use ISO 8601 dates, amounts in EUR"                (priority: 50)
Tool:   "api-create requires approval for amounts > 10000"  (priority: 100)
User:   (none)

Resolved: "Always include a request ID in API calls.
           Use ISO 8601 dates, amounts in EUR.
           api-create requires approval for amounts > 10000"
```

### 3. Gateway Middleware Injection Point

Context injection happens in the gateway request pipeline, between federation (ADR-046) and tool resolution:

```
MCP tools/call request
       │
       ▼
┌─────────────────────┐
│  Auth (JWT/API key)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Federation          │  (ADR-046: sub-account policy)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Skill Resolution (NEW)             │
│                                     │
│  1. Extract: tenant_id, tool_name,  │
│     user_id from request context    │
│  2. Query skill cache (moka)        │
│  3. Resolve hierarchy (4 levels)    │
│  4. Attach SkillContext extension    │
│     to Axum request                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Tool Resolution     │  Tool handler reads SkillContext
│  + Execution         │  and prepends to execution payload
└──────────────────────┘
```

**Critical design choice (Council adjustment #3)**: Skill context injection is **gateway-internal only**. It enriches the tool execution payload sent to the backend, but does NOT modify the MCP tool schema (`tools/list` response) returned to clients. Clients see unchanged tool definitions — the context is invisible to the MCP protocol layer.

**Implementation** (Rust, `k8s` feature flag):
- `SkillResolver` struct with moka-cached skill definitions (stale-while-revalidate)
- K8s watcher on `Skill` CRDs (same pattern as existing Tool/ToolSet watchers)
- `SkillContext` Axum request extension (similar to `TenantContext`, `SubAccountContext`)
- Fallback: when `k8s` feature is disabled, skill resolution is a no-op (returns empty context)

### 4. Primary Author and Workflow (Council adjustment #1)

| Author | Workflow | Use Case |
|--------|----------|----------|
| **Platform Admin** (primary) | Console UI: Skills page with YAML editor + preview | Define compliance rules, API conventions |
| **DevOps Engineer** | `kubectl apply -f skill.yaml` / GitOps via ArgoCD | Infrastructure-as-code, version-controlled |
| **stoactl** | `stoactl skill create/list/get/delete` | CLI-driven management |

The Console UI provides a preview panel showing the resolved context for a given tenant/tool/user combination — this serves as the debugging trace (Council adjustment #2).

### 5. Resolution Trace Endpoint (Council adjustment #2)

A debug endpoint for operators to understand what context an agent would receive:

```
GET /admin/skills/resolve?tenant=acme&tool=api-create&user=john
```

Response:
```json
{
  "resolved_context": "Always include a request ID...\nUse ISO 8601...\napi-create requires approval...",
  "trace": [
    {"level": "global", "skill": "request-id-policy", "priority": 10, "matched": true},
    {"level": "tenant", "skill": "compliance-gdpr", "priority": 50, "matched": true},
    {"level": "tool", "skill": "api-create-approval", "priority": 100, "matched": true},
    {"level": "user", "skill": null, "matched": false}
  ]
}
```

This endpoint is part of the gateway admin API (bearer token auth, `stoa:admin` scope).

## Alternatives Considered

### A. Tool Description Enrichment

Modify each tool's `description` field to include context.

**Rejected because**: doesn't scale, pollutes the MCP protocol layer, requires re-registering tools on every context change, and cannot differentiate per-tenant or per-user.

### B. MCP Protocol Extension (custom `context` field)

Add a non-standard `context` field to MCP `tools/call` responses.

**Rejected because**: breaks MCP spec compliance. Clients that don't understand the field would ignore it. The MCP protocol has no concept of server-side context injection — this is a gateway concern, not a protocol concern.

### C. ConfigMap-Based Configuration

Use Kubernetes ConfigMaps instead of a dedicated CRD.

**Rejected because**: ConfigMaps lack schema validation, don't support the `scope`/`priority` fields natively, and can't leverage the K8s watcher pattern with typed deserialization. CRDs provide validation, versioning, and `kubectl get skills` discoverability.

### D. Database-Only (no CRD)

Store skills in the Control Plane API database only.

**Rejected because**: breaks the GitOps pattern (ADR-040). CRDs enable `kubectl apply` and ArgoCD-managed skill definitions. The CP API database stores the resolved cache; the CRD is the source of truth.

## Consequences

### Positive

- **Declarative**: Skills are Kubernetes-native, GitOps-friendly (ArgoCD, kubectl)
- **Hierarchical**: CSS-like cascade gives fine-grained control (global rules + tenant overrides)
- **Non-invasive**: Tool schemas unchanged, MCP protocol compliance preserved
- **Observable**: Resolution trace endpoint for debugging
- **Feature-gated**: `k8s` Cargo feature flag — community image has no-op, enterprise has full resolution

### Negative

- **5th CRD**: Adds operational surface area for K8s operators
- **Cache consistency**: Skill changes take up to TTL seconds to propagate (mitigated by stale-while-revalidate)
- **No client awareness**: Agents don't know context was injected — useful for enforcement, but opaque for debugging on the client side

### Risks

| Risk | Mitigation |
|------|------------|
| Skill context too large (token budget) | Enforce max context size per skill (e.g., 2000 chars); warn in Console UI |
| Conflicting skills at same priority | Deterministic tie-breaking: alphabetical by skill name within same priority |
| Skills containing PII/secrets | Validation webhook rejects skills with known secret patterns; documentation warns operators |
| K8s watcher miss (CRD created but not seen) | Stale-while-revalidate + periodic full resync (every 5 min) |

## Implementation Phases

### Phase 1: Skill Model + CRD (~8 pts)

- `Skill` CRD definition (`charts/stoa-platform/crds/skill.yaml`)
- Skill repository in Control Plane API (CRUD + sync)
- K8s watcher in gateway (`k8s` feature flag, same pattern as Tool CRD)
- `SkillResolver` with moka cache
- Unit tests: 15+ tests

### Phase 2: Gateway Context Injection (~8 pts)

- Skill resolution middleware (Axum layer between federation and tool resolution)
- Hierarchical resolution logic (4-level cascade)
- `SkillContext` request extension
- Tool handler integration (prepend context to execution payload)
- Resolution trace admin endpoint
- Unit tests: 15+ tests

### Phase 3: Agent Integration + Tests (~5 pts)

- Console UI: Skills management page (list, create, edit, preview)
- `stoactl skill` commands (create, list, get, delete)
- E2E tests: 5+ scenarios (global skill, tenant override, tool-specific, resolution trace)
- Documentation: Skills guide in stoa-docs

## References

- [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [MCP Specification 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024: Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-040: Born GitOps Multi-Environment](/docs/architecture/adr/adr-040-born-gitops-multi-environment)
- [ADR-041: Plugin Architecture](/docs/architecture/adr/adr-041-plugin-architecture-community-enterprise)
- [ADR-046: MCP Federation Architecture](/docs/architecture/adr/adr-046-mcp-federation-architecture)
