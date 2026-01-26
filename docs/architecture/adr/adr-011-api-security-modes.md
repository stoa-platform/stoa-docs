---
sidebar_position: 11
title: "ADR-011: API Security Modes"
---

# ADR-011: API Security Mode Selection — mTLS / OAuth2 / Hybrid

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 11 January 2026 |
| **Linear** | [CAB-410](https://linear.app/hlfh-workspace/issue/CAB-410) |

## Context

STOA Gateway must support multiple API security modes depending on usage contexts. Rather than letting teams guess, we formalize a **Decision Tree** that automatically recommends the right mode.

## Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **mTLS only** | Client certificate authentication | ✅ For CORE internal APIs |
| **OAuth2 only** | JWT tokens with scopes | ✅ For SELF-SERVICE APIs |
| **mTLS + OAuth2** | Dual authentication | ✅ For critical exposed APIs |
| **API Key only** | Static secret | ⚠️ Community tier only |

## Decision

Implement an automated Decision Tree to recommend the optimal API security mode.

### Decision Tree

```
                    ┌─────────────────────┐
                    │  Consumer type?     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
         [Internal]                        [External]
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │  Flow type?     │               │  OAuth2 required│
    └────────┬────────┘               └────────┬────────┘
             │                                  │
    ┌────────┴────────┐                        │
    │                 │                        ▼
  [A2A]           [User]              ┌─────────────────┐
    │                 │               │ Critical domain?│
    │                 ▼               └────────┬────────┘
    │         OAuth2 required                  │
    ▼                                 ┌────────┴────────┐
┌─────────────────┐                   │                 │
│Critical domain? │                 [Yes]            [No]
└────────┬────────┘                   │                 │
         │                            ▼                 ▼
    ┌────┴────┐              ┌──────────────┐  ┌──────────────┐
    │         │              │ mTLS + OAuth2│  │  OAuth2 only │
  [Yes]    [No]              │   (HYBRID)   │  │(SELF-SERVICE)│
    │         │              └──────────────┘  └──────────────┘
    ▼         ▼
┌────────┐ ┌────────────┐
│ mTLS   │ │ OAuth2 or  │
│ (CORE) │ │ mTLS per   │
└────────┘ │ governance │
           └────────────┘
```

### Decision Rules

| Case | Conditions | Recommended Mode |
|------|------------|------------------|
| **🟢 CORE** | Internal + A2A + Critical + Stable rights | `mTLS` |
| **🔵 SELF-SERVICE** | External + User/BFF + DX priority | `OAuth2` |
| **🟣 HYBRID** | Critical + External + Strong governance | `mTLS + OAuth2` |

## Consequences

### Positive

- Automatic and consistent recommendation
- Reduced security configuration errors
- Documented decisions for audit

### Negative

- Additional tooling complexity
- Learning curve for teams

### Neutral

- Teams can deviate with documented justification

## MCP Tool: `security-advisor`

```json
// Input
{
  "consumer_type": "internal | external",
  "flow_type": "a2a | user",
  "rights_variability": "static | dynamic",
  "domain_criticality": "low | high",
  "governance_level": "basic | strong"
}

// Output
{
  "recommended_security_mode": "mTLS | OAuth2 | mTLS+OAuth2",
  "justification": ["Critical domain", "Internal A2A flow"],
  "risk_level": "low | medium | high",
  "implementation_notes": ["Short-lived client cert", "ABAC policy"]
}
```

## References

- [CAB-410: Decision Tree Implementation](https://linear.app/hlfh-workspace/issue/CAB-410)
- [CAB-361: OAuth2/OIDC Enterprise](https://linear.app/hlfh-workspace/issue/CAB-361)
- ADR-015: Sender-Constrained Tokens (planned)
