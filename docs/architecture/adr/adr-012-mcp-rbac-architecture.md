# ADR-012: MCP Tools Architecture — RBAC & Multi-Tenant Governance

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 16 January 2026 |
| **Author** | Christophe + Claude |
| **Linear** | [CAB-602](https://linear.app/hlfh-workspace/issue/CAB-602) (Epic) |

## Context

STOA expose des MCP Tools aux agents IA et développeurs. L'architecture actuelle (20 tools, 7 scopes) est insuffisante pour:

1. **Granularité RBAC** — Pas de distinction claire entre personas (Admin vs Developer vs Consumer vs Agent)
2. **Multi-tenancy** — Namespace tools hardcodé, pas de dynamic generation
3. **Agent Governance** — Manque de framework pour contrôler les agents IA (attestations, policy gates)
4. **Scalabilité** — Tools statiques vs génération dynamique depuis UAC contracts

## Decision

Refactorer l'architecture MCP Tools selon le pattern **Core + Proxied** avec RBAC granulaire par persona.

## Architecture

### Pattern: Core vs Proxied Tools

```
┌─────────────────────────────────────────────────────────────────┐
│                    STOA MCP Tool Registry                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CORE TOOLS (35 static)        │  PROXIED TOOLS (dynamic)       │
│  ─────────────────────────     │  ──────────────────────────    │
│  stoa_{domain}_{action}        │  {tenant}:{api}:{operation}    │
│  Built-in, versioned           │  Generated from UAC contracts  │
│  Platform management           │  Business API exposure         │
│                                │                                 │
│  Examples:                     │  Examples:                      │
│  - stoa_list_apis              │  - acme:crm:search_customers   │
│  - stoa_get_metrics            │  - acme:billing:create_invoice │
│  - stoa_create_subscription    │  - beta:inventory:check_stock  │
│                                │                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Categories (35 Core Tools)

| Category | Count | Tools |
|----------|-------|-------|
| **Platform & Discovery** | 6 | `stoa_platform_info`, `stoa_health_check`, `stoa_list_tools`, `stoa_get_tool_schema`, `stoa_search_tools`, `stoa_get_config` |
| **API Catalog** | 8 | `stoa_list_apis`, `stoa_get_api`, `stoa_search_apis`, `stoa_get_api_versions`, `stoa_create_api`, `stoa_deploy_api`, `stoa_undeploy_api`, `stoa_deprecate_api` |
| **Subscriptions & Access** | 6 | `stoa_list_subscriptions`, `stoa_get_subscription`, `stoa_create_subscription`, `stoa_update_subscription`, `stoa_revoke_subscription`, `stoa_rotate_api_key` |
| **Observability & Metrics** | 8 | `stoa_get_metrics`, `stoa_get_metrics_timeseries`, `stoa_get_slow_requests`, `stoa_list_alerts`, `stoa_list_errors`, `stoa_get_error_details`, `stoa_get_error_snapshot`, `stoa_analyze_errors` |
| **UAC Contracts** | 4 | `stoa_validate_contract`, `stoa_import_openapi`, `stoa_export_openapi`, `stoa_export_mcp` |
| **Security & Compliance** | 3 | `stoa_get_security_score`, `stoa_list_audit_events`, `stoa_scan_vulnerabilities` |

## OAuth2 Scopes (12 scopes)

| Scope | Description | Tier |
|-------|-------------|------|
| `stoa:platform:read` | Read platform config & health | Community |
| `stoa:platform:write` | Modify platform config | Enterprise |
| `stoa:catalog:read` | Browse API catalog | Community |
| `stoa:catalog:write` | CRUD APIs | Enterprise |
| `stoa:subscriptions:read` | View own subscriptions | Community |
| `stoa:subscriptions:write` | Manage subscriptions | Community |
| `stoa:metrics:read` | Access metrics & analytics | Community |
| `stoa:logs:technical` | App logs (debug, traces) | Enterprise |
| `stoa:logs:functional` | Business logs (API calls) | Community |
| `stoa:logs:full` | All logs including PII (masked) | Enterprise |
| `stoa:security:read` | View audit trails, compliance | Enterprise |
| `stoa:security:write` | Security operations, scans | Enterprise |

## RBAC Matrix — 6 Personas

### 1. Platform Administrator (`stoa.admin`)

| Attribute | Value |
|-----------|-------|
| **Description** | Full platform control |
| **Scopes** | ALL |
| **Tools Access** | ALL 35 core + all proxied |
| **Tier** | Enterprise / Partner |

### 2. API Product Owner (`stoa.product_owner`)

| Attribute | Value |
|-----------|-------|
| **Description** | Manages API lifecycle for their team |
| **Scopes** | `catalog:*`, `subscriptions:*`, `metrics:read`, `logs:technical`, `logs:functional` |
| **Tools Access** | Catalog CRUD, Subscriptions, Metrics, Errors |
| **Constraints** | Own team APIs only |

### 3. API Developer (`stoa.developer`)

| Attribute | Value |
|-----------|-------|
| **Description** | Builds and deploys APIs |
| **Scopes** | `catalog:read`, `catalog:write` (dev/staging only), `metrics:read`, `logs:technical` |
| **Tools Access** | Deploy dev/staging, Read metrics/errors |
| **Constraints** | Own team APIs, non-prod environments |

### 4. API Consumer (`stoa.consumer`)

| Attribute | Value |
|-----------|-------|
| **Description** | Uses APIs via subscriptions |
| **Scopes** | `catalog:read`, `subscriptions:read`, `subscriptions:write` (own), `metrics:read` (own usage) |
| **Tools Access** | Browse catalog, Manage own subscriptions, View own usage |

### 5. Security Officer (`stoa.security`)

| Attribute | Value |
|-----------|-------|
| **Description** | Compliance, audit, security oversight |
| **Scopes** | `security:*`, `logs:full`, `metrics:read`, `catalog:read` |
| **Tools Access** | Audit trails, Security scans, Compliance reports |
| **Constraints** | Read-only by default, approval gates for actions |

### 6. AI Agent (`stoa.agent`)

| Attribute | Value |
|-----------|-------|
| **Description** | Autonomous AI agent (Claude, GPT, custom) |
| **Scopes** | Whitelist-only (defined per agent registration) |
| **Tools Access** | Explicitly whitelisted tools only |
| **Constraints** | 10min token TTL, mandatory attestations, policy gates (OPA), full audit |

## Agent Governance Framework

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Request Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Authentication (OAuth2 + DPoP/mTLS)                         │
│     └─→ Verify agent identity, check token validity             │
│                                                                  │
│  2. Whitelist Check                                              │
│     └─→ Is this tool in agent's allowed list?                   │
│                                                                  │
│  3. Policy Gate (OPA)                                            │
│     └─→ Evaluate business rules (time, data sensitivity, etc.)  │
│                                                                  │
│  4. Attestation Required?                                        │
│     └─→ If sensitive action, require signed attestation         │
│                                                                  │
│  5. Execute & Audit                                              │
│     └─→ Run tool, log everything, return result                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Token Security

| Mechanism | Standard | Purpose |
|-----------|----------|---------|
| **DCR** | RFC 7591/7592 | Dynamic Client Registration |
| **DPoP** | RFC 9449 | Proof-of-Possession (public clients) |
| **mTLS** | RFC 8705 | Cert-bound tokens (confidential clients) |
| **Short TTL** | — | 10min max for agents |

## MCP Resources (15)

| Resource URI | Description |
|--------------|-------------|
| `stoa://platform/info` | Platform metadata |
| `stoa://platform/health` | Health status |
| `stoa://apis` | API catalog list |
| `stoa://apis/{id}` | Single API details |
| `stoa://apis/{id}/versions` | API version history |
| `stoa://subscriptions` | User's subscriptions |
| `stoa://subscriptions/{id}` | Single subscription |
| `stoa://metrics/{api_id}/summary` | API metrics summary |
| `stoa://metrics/{api_id}/timeseries` | Time-series data |
| `stoa://errors/{api_id}/recent` | Recent errors |
| `stoa://errors/{snapshot_id}` | Error snapshot detail |
| `stoa://alerts/active` | Active alerts |
| `stoa://audit/events` | Audit trail |
| `stoa://security/score` | Security posture |
| `stoa://tools` | Available tools for current user |

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Core Tools** | 20 (flat) | 35 (structured by domain) |
| **OAuth2 Scopes** | 7 | 12 (granular) |
| **Personas** | Implicit | 6 explicit with RBAC matrix |
| **Multi-tenant** | Hardcoded namespace | Dynamic `{tenant}:{api}:{op}` |
| **Agent Governance** | None | Full framework (whitelist, attestations, policy gates) |
| **Tool Generation** | Manual | Auto from UAC contracts |

## Consequences

### Positive

- ✅ Enterprise-grade access control (RBAC by persona)
- ✅ Scalable multi-tenant architecture
- ✅ Safe AI agent integration with policy gates
- ✅ Automatic tool exposure from UAC contracts
- ✅ Compliance-ready (NIS2/DORA audit trails)

### Negative

- ⚠️ Migration effort for existing integrations
- ⚠️ Increased complexity in authorization layer
- ⚠️ OPA policy maintenance overhead

### Mitigations

- Backward compatibility layer for v1 tools during migration
- Policy templates for common use cases
- Gradual rollout by tenant

## References

- RFC 7591/7592 — Dynamic Client Registration
- RFC 9449 — DPoP (Proof-of-Possession)
- RFC 8705 — mTLS Certificate-Bound Tokens
- [MCP Specification](https://modelcontextprotocol.io)
- [OPA](https://www.openpolicyagent.org)
- [ADR-001: API Exposure Strategy](./adr-001-api-exposure-strategy.md)
