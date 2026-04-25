---
title: "ADR-067: UAC as LLM-Optimized Executable Contract"
sidebar_label: "ADR-067: UAC LLM Contract"
sidebar_position: 67
description: "Defines minimal endpoint-level LLM metadata for UAC contracts so MCP tools, smoke tests, and AI-assisted development share one executable contract."
keywords: [ADR, UAC, LLM, MCP, smoke tests, AI governance]
---

# ADR-067 — UAC as LLM-Optimized Executable Contract

## 1. Status

**Status:** Proposed

**Date:** 2026-04-25

**Deciders:** STOA Core Team

**Related decisions:** ADR-012 MCP RBAC Architecture, ADR-021 UAC-Driven Observability, ADR-022 UAC Tenant Architecture, ADR-030 AI-Native Context Management, ADR-045 stoa.yaml Declarative API Specification, ADR-051 Lazy MCP Discovery, ADR-063 SDD Level 1 + stoa-impact MCP knowledge agent.

## 2. Context

STOA uses UAC (Universal API Contract) as the central product contract behind the principle **Define once, expose everywhere**.

A UAC can be projected into multiple runtime and product surfaces:

- REST routes
- MCP tools
- security policies
- contract tests
- smoke tests
- documentation and catalog entries
- observability labels and traces

STOA is also developed and maintained with significant AI assistance. That makes the contract more than a runtime artifact. It must be readable, stable, and verifiable by three consumers:

1. the STOA runtime
2. humans and architects
3. LLMs and AI agents

Existing UAC fields already describe technical routing, schemas, lifecycle, classification, and policies. They are not always enough for an agent to decide whether a generated MCP tool should be used, when it should be used, and what behavior must remain stable.

This ADR does not replace the existing `llm_config` capability used for LLM backend contracts. `llm_config` describes an AI backend exposed by STOA. The metadata proposed here describes how an API operation should be understood and governed when projected to an agent-facing tool.

## 3. Problem

A classic API contract can be sufficient for a gateway but insufficient for an LLM.

An agent needs compact operational intent:

- what the operation does
- when to use it
- whether it changes state
- whether an autonomous agent may call it safely
- whether a human approval step is required
- what a valid input/output example looks like

Without this information, AI agents can:

- choose the wrong tool
- call endpoints at the wrong time
- perform writes when a read was expected
- generate inconsistent code around product invariants
- treat dangerous operations as normal helper functions
- produce rewrites that are technically valid but contractually wrong

The gap is operation-level. A single API contract can contain both a safe `GET /customers/{id}` and a destructive `DELETE /customers/{id}`. These operations cannot share the same intent, side effects, approval rule, or examples.

## 4. Decision

STOA will treat UAC as an **LLM-optimized executable contract**.

In v1, STOA adds a compact `llm` metadata block at the **endpoint / operation level**. The block is recommended for endpoints exposed as MCP tools and may be validated in warning mode. It is not immediately mandatory for all existing UAC endpoints.

The decision is deliberately small:

- UAC remains the primary product contract.
- MCP tools remain projections of UAC operations.
- Smoke tests remain runtime proof that a UAC is actually exposed.
- Agent-facing features should be traceable to UAC metadata, not only to code.
- V1 is warning / recommended.
- V2 may make the metadata mandatory for new endpoints exposed through MCP.

The guiding rule is:

> The UAC describes. The smoke test proves.

## 5. UAC LLM Metadata v1

### Scope

The v1 metadata lives on each endpoint:

```json
{
  "path": "/customers/{id}",
  "methods": ["GET"],
  "backend_url": "https://backend.example.com/customers",
  "operation_id": "get_customer",
  "llm": {
    "summary": "Retrieve one customer by id.",
    "intent": "Use when an agent needs customer details before answering, checking eligibility, or preparing a follow-up action.",
    "tool_name": "customer_get_customer",
    "side_effects": "read",
    "safe_for_agents": true,
    "requires_human_approval": false,
    "examples": [
      {
        "input": {"id": "cust_123"},
        "expected_output_contains": {"id": "cust_123"}
      }
    ]
  }
}
```

### Required fields when `llm` is present

| Field | Type | V1 rule |
|-------|------|---------|
| `summary` | string | Short description of what the operation does. Target: one sentence, at most 160 chars. |
| `intent` | string | When an agent should use this operation. Target: one compact sentence, at most 360 chars. |
| `tool_name` | string | Stable MCP tool name for the operation. Transport adapters may map it when a client has stricter name rules. |
| `side_effects` | enum | One of `none`, `read`, `write`, `destructive`. |
| `safe_for_agents` | boolean | Whether an autonomous agent may call the operation under normal policy. |
| `requires_human_approval` | boolean | Whether a human approval step is required before execution. |
| `examples` | array | One or two minimal examples with valid `input` and `expected_output_contains`. |

### `side_effects` semantics

| Value | Meaning | Default MCP hint |
|-------|---------|------------------|
| `none` | Pure operation, no external read or write. | `readOnlyHint=true`, `openWorldHint=false`, `destructiveHint=false` |
| `read` | Reads external data without changing it. | `readOnlyHint=true`, `openWorldHint=true`, `destructiveHint=false` |
| `write` | Creates or updates state, but is not destructive by product semantics. | `readOnlyHint=false`, `destructiveHint=false` |
| `destructive` | Deletes, revokes, overwrites, triggers irreversible business action, or has high blast radius. | `readOnlyHint=false`, `destructiveHint=true` |

The v1 hard rule is:

```text
side_effects=destructive -> requires_human_approval=true
```

If this rule is violated, v1 validators should emit an error when `llm` is present. Missing `llm` metadata on an MCP-exposed endpoint is only a warning in v1.

### Fields intentionally deferred to v2

The following fields are useful but excluded from v1 to keep UAC short:

- `sensitive_data`
- `do_not_use_when`
- `permissions`
- `rate_limit_policy`
- `approval_policy`
- `test_generation_hints`

These should not be smuggled into `summary` or `intent`. If an operation needs complex governance in v1, the UAC should reference existing policy/classification mechanisms rather than embedding a long prompt-like block.

### LLM-ready definition

In v1, an endpoint is **LLM-ready** if:

1. it has an `llm` block with all v1 fields;
2. `summary` and `intent` are compact enough to fit in tool discovery responses;
3. `tool_name` is stable and unique inside the tenant/API namespace;
4. `side_effects` is explicit;
5. destructive operations require human approval;
6. examples validate against `input_schema` where an input schema exists;
7. examples do not contain secrets or real customer data.

## 6. Runtime implications

V1 must not introduce a broad runtime refactor.

Runtime implications are limited to validation and projection:

- The existing UAC runtime contract remains valid.
- Existing endpoint routing, backend URL handling, classification, and policies remain unchanged.
- `llm` is optional in v1 and can be ignored by older runtime components.
- Validators may warn when an endpoint with MCP exposure has no `llm` block.
- Validators should error when a present `llm` block is malformed.
- Validators should error when `side_effects=destructive` and `requires_human_approval=false`.
- Validators should warn when HTTP-method-derived behavior conflicts with `llm.side_effects`.

The runtime should treat UAC LLM metadata as an executable hint surface, not as a replacement for authorization, OPA, RBAC, or approval enforcement.

## 7. MCP implications

MCP tools are agent-facing projections of UAC operations.

When `llm` metadata is present, MCP generation should prefer it over purely mechanical defaults:

| MCP field / behavior | Source in v1 |
|----------------------|--------------|
| Tool name | `llm.tool_name`, with legacy fallback to `operation_id` / generated name during transition. |
| Tool description | Compact composition of `llm.summary` and `llm.intent`. |
| `readOnlyHint` | Derived from `llm.side_effects`. |
| `destructiveHint` | `true` when `llm.side_effects=destructive`. |
| Approval UX / policy hint | `llm.requires_human_approval`. |
| Agent allow-list hint | `llm.safe_for_agents`. |
| Smoke examples | `llm.examples`. |

The current gateway already derives MCP annotations from UAC actions and HTTP methods. This ADR does not discard that behavior. V1 adds explicit product intent so generated tools are not only syntactically valid, but also understandable by LLM clients.

During adoption, name behavior must remain backward compatible. Existing generated tool names may keep their current format until a contract is explicitly migrated. New LLM-ready endpoints should use `llm.tool_name` as their stable canonical name.

Transport-specific tool name constraints are adapter concerns. If a client rejects characters such as `:`, the adapter may map the canonical name to a transport-safe alias, but scoring, logging, catalog references, and smoke assertions should preserve the canonical identity.

## 8. Smoke test implications

UAC metadata is not proof that a feature works. It is a declared contract.

Smoke tests provide the runtime proof:

```text
UAC describes.
Smoke proves.
```

For LLM-ready endpoints, smoke tests should verify at least:

1. the UAC validates structurally;
2. the MCP projection exists in `tools/list` with the expected `tool_name`;
3. the MCP description includes the intended compact summary/intent;
4. the MCP annotations match `side_effects`;
5. `examples[].input` validates against the input schema;
6. safe read-only examples can be invoked in a deterministic smoke environment;
7. write/destructive examples are not blindly executed in smoke;
8. destructive tools surface approval or policy gating instead of silent execution.

This keeps smoke tests practical. V1 should not require full business scenario replay for every endpoint. It should prove discoverability, schema compatibility, safe invocation for safe reads, and gating for risky operations.

## 9. PR / AI development implications

AI-assisted development should treat UAC as the product boundary for agent-exposed behavior.

V1 PR rule:

- If a PR adds or changes an MCP-exposed endpoint, it should add or update `endpoint.llm` metadata.
- If the metadata is missing, review and CI may warn, but should not block all existing endpoints in v1.
- If `endpoint.llm` is present and invalid, CI should fail.
- If a PR marks an operation as `destructive`, it must set `requires_human_approval=true`.
- If a PR exposes a feature only in code without an associated UAC operation or flow contract, reviewers should treat that as a contract gap.

V2 PR rule, once adoption is proven:

- New endpoints exposed through MCP must be LLM-ready before merge.
- Legacy endpoints may be grandfathered until touched.

This supports bounded AI PRs. A PR generated by an AI agent should be traceable to a contract operation, examples, and smoke proof rather than relying on code-only intent.

## 10. Consequences

### Positive

- Agents receive clearer tool descriptions and are less likely to choose the wrong operation.
- MCP generation gains a stable operation-level source for tool naming and descriptions.
- Smoke tests can reuse examples instead of inventing separate fixtures.
- Destructive operations become visible in the contract before runtime incidents.
- Human reviewers get a compact place to verify product intent.
- STOA gains a guardrail against AI-assisted rewrites that are valid code but invalid product behavior.

### Negative

- Endpoint authors must maintain a few extra fields.
- Metadata can drift if not checked by validators and smoke tests.
- The word `safe_for_agents` can create false confidence if runtime policies are weak.
- Tool naming migration may reveal inconsistencies between existing generated names, client transport constraints, and canonical names.

### Mitigations

- Keep v1 warning / recommended for missing metadata.
- Fail only malformed metadata when present.
- Limit examples to one or two compact cases.
- Defer sensitive data, permissions, rate limits, and approval policy to v2.
- Add smoke proof before making the field mandatory.

## 11. Risks

### UAC bloat

Risk: teams turn `llm` into long prompt text.

Mitigation: field length guidance, examples cap, v2 fields deferred, no embedded policy prose.

### False safety

Risk: `safe_for_agents=true` is mistaken for authorization.

Mitigation: document that runtime auth, RBAC, OPA, and approval gates remain authoritative.

### Drift between UAC and MCP generation

Risk: `llm.tool_name` differs from generated or discovered tool names.

Mitigation: smoke tests assert discovery by expected canonical name.

### Over-migration

Risk: making v1 mandatory immediately creates a large cleanup project.

Mitigation: warning mode in v1, mandatory only for new MCP endpoints in v2.

### Sensitive examples

Risk: examples accidentally contain real customer data or secrets.

Mitigation: validators and review checklist reject secrets and require synthetic examples.

## 12. Alternatives considered

### A. Keep using OpenAPI descriptions only

Rejected for v1. OpenAPI descriptions can help humans, but they do not consistently encode agent intent, side effects, approval requirements, and smoke examples.

### B. Add a separate agent manifest outside UAC

Rejected. A separate manifest would create a second source of truth and drift from the runtime contract.

### C. Put metadata at contract level only

Rejected. Side effects, examples, and agent safety are operation-level properties. Contract-level metadata is too coarse for MCP tool generation.

### D. Add full AI governance fields immediately

Rejected. Fields such as `permissions`, `approval_policy`, `sensitive_data`, and `test_generation_hints` are useful, but adding them now would turn the UAC into a large policy document before the basic loop is proven.

### E. Do nothing

Rejected. Existing generated MCP tools can be syntactically correct while still being unclear or unsafe for agents.

## 13. Adoption plan

### Phase 0 — ADR only

Accept this ADR and align the team on endpoint-level LLM metadata.

### Phase 1 — Schema and validator in warning mode

Allow optional `endpoints[].llm` in the UAC schema.

Warn when a published MCP-exposed endpoint has no `llm` metadata. Fail malformed `llm` blocks when present.

### Phase 2 — Apply to one or two low-risk contracts

Migrate a small demo or smoke contract first, preferably read-only operations.

Avoid broad migration of all existing UACs.

### Phase 3 — MCP generator consumes v1 fields

Use `summary`, `intent`, `tool_name`, and `side_effects` during MCP tool generation when available. Preserve legacy fallback behavior.

### Phase 4 — Smoke test integration

Extend smoke tests to verify discovery, annotations, example schema validity, safe read invocation, and destructive gating.

### Phase 5 — V2 enforcement for new MCP endpoints

Once the loop is proven, make LLM metadata mandatory for new endpoints exposed through MCP. Legacy endpoints remain grandfathered until modified.

## 14. Open questions

1. Should `llm.tool_name` be the canonical stored name, or should it remain an alias over the existing `tenant:contract:operation` naming pattern?
2. Which component owns transport-safe name mapping when a client rejects characters accepted by STOA canonical names?
3. Should `safe_for_agents=false` hide a tool from discovery, or expose it with a policy/approval marker?
4. Where should `requires_human_approval` be enforced first: MCP client UX, gateway policy, Control Plane approval workflow, or all three progressively?
5. Should write operations that move money or trigger external business commitments be classified as `write` or `destructive` by default?
6. When v2 starts, should enforcement be tied to `status=published`, MCP binding enabled, or both?
7. Should contract-level LLM defaults ever be allowed, or would that reintroduce inheritance and ambiguity rejected by ADR-022?
