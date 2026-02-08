---
sidebar_position: 10
title: "OPA Policy Examples"
description: "Open Policy Agent (OPA) policy templates for STOA — tool access control, tenant isolation, and rate limiting."
keywords: [OPA, Open Policy Agent, policy, access control, Rego]
---

# OPA Policy Examples

STOA uses Open Policy Agent (OPA) for fine-grained access control. This guide provides policy templates for common scenarios.

## Overview

OPA policies in STOA control:

- **Tool access** — Which tools a user can invoke
- **Tenant isolation** — Ensuring cross-tenant security
- **Rate limiting** — Per-tenant or per-user limits
- **Data filtering** — PII masking and field-level access
- **Scope enforcement** — OAuth2 scope validation

## Policy Structure

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

# Default deny
default allow := false

# Main authorization rule
allow if {
    valid_token
    valid_scope
    valid_tenant
}
```

## Input Schema

Policies receive this input structure:

```json
{
  "token": {
    "sub": "user-id",
    "aud": "stoa-gateway",
    "iss": "https://auth.gostoa.dev",
    "exp": 1707234567,
    "stoa_realm": "tenant-acme",
    "scope": "tools:read tools:execute",
    "roles": ["api-consumer"]
  },
  "request": {
    "method": "POST",
    "path": "/tools/call",
    "tenant_id": "acme",
    "tool_name": "payment:create",
    "arguments": {
      "amount": 100,
      "currency": "EUR"
    }
  },
  "context": {
    "client_ip": "192.168.1.100",
    "user_agent": "claude-code/1.0"
  }
}
```

## Policy Examples

### 1. Tenant Isolation

Ensure users can only access their own tenant's tools:

```rego
package stoa.gateway.authz

import future.keywords.if

default allow := false

# Allow if token's realm matches request tenant
allow if {
    input.token.stoa_realm == input.request.tenant_id
    token_not_expired
}

token_not_expired if {
    now := time.now_ns() / 1000000000
    now < input.token.exp
}
```

### 2. Scope-Based Access

Control access based on OAuth2 scopes:

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

default allow := false

# Required scopes per action
required_scopes := {
    "tools/call": ["tools:execute"],
    "tools/list": ["tools:read"],
    "subscriptions/create": ["subscriptions:write"],
}

allow if {
    # Get required scopes for this path
    required := required_scopes[input.request.path]

    # Check user has all required scopes
    every scope in required {
        scope in split(input.token.scope, " ")
    }
}
```

### 3. Role-Based Tool Access

Restrict tools based on user roles:

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

default allow := false

# Tools allowed per role
role_tools := {
    "admin": ["*"],  # All tools
    "developer": ["catalog:*", "subscription:*"],
    "viewer": ["catalog:list", "catalog:get"],
}

allow if {
    # Get user's roles
    some role in input.token.roles

    # Check if tool is allowed for role
    allowed := role_tools[role]
    tool_allowed(input.request.tool_name, allowed)
}

# Check if tool matches any allowed pattern
tool_allowed(tool, allowed) if {
    some pattern in allowed
    glob.match(pattern, [], tool)
}
```

### 4. Rate Limiting Policy

Implement per-tenant rate limits:

```rego
package stoa.gateway.ratelimit

import future.keywords.if

# Rate limits per tier
tier_limits := {
    "free": {"requests_per_minute": 60, "burst": 10},
    "pro": {"requests_per_minute": 600, "burst": 100},
    "enterprise": {"requests_per_minute": 6000, "burst": 1000},
}

# Get tenant's tier from external data
tenant_tier := data.tenants[input.request.tenant_id].tier

# Return rate limit configuration
rate_limit := tier_limits[tenant_tier]
```

### 5. PII Masking Policy

Control which fields are visible:

```rego
package stoa.gateway.masking

import future.keywords.if
import future.keywords.in

# Fields that require masking
sensitive_fields := [
    "ssn",
    "credit_card",
    "password",
    "api_key",
    "email",
    "phone",
]

# Determine if field should be masked
mask_field(field_name) if {
    field_name in sensitive_fields
}

# Check user has elevated access
elevated_access if {
    "pii:read" in split(input.token.scope, " ")
}

# Final masking decision
should_mask(field_name) if {
    mask_field(field_name)
    not elevated_access
}
```

### 6. Time-Based Access

Restrict access to business hours:

```rego
package stoa.gateway.authz

import future.keywords.if

default allow := false

# Business hours (UTC)
business_hours := {
    "start": 8,
    "end": 18,
}

allow if {
    # Check if within business hours
    now := time.now_ns()
    hour := time.clock([now, "UTC"])[0]

    hour >= business_hours.start
    hour < business_hours.end

    # And other conditions...
    input.token.stoa_realm == input.request.tenant_id
}

# Admins can access anytime
allow if {
    "admin" in input.token.roles
}
```

### 7. Tool-Specific Validation

Validate tool arguments:

```rego
package stoa.gateway.validation

import future.keywords.if

default valid := false

# Validate payment tool arguments
valid if {
    input.request.tool_name == "payment:create"
    validate_payment_args(input.request.arguments)
}

validate_payment_args(args) if {
    # Amount must be positive
    args.amount > 0

    # Currency must be supported
    args.currency in ["EUR", "USD", "GBP"]

    # Recipient must be provided
    count(args.recipient) > 0
}
```

### 8. Audit Logging Policy

Determine what to audit:

```rego
package stoa.gateway.audit

import future.keywords.if
import future.keywords.in

# Always audit these tools
always_audit := [
    "payment:*",
    "subscription:*",
    "admin:*",
]

# Determine audit level
audit_level := "full" if {
    some pattern in always_audit
    glob.match(pattern, [], input.request.tool_name)
} else := "minimal" if {
    input.token.roles[_] == "admin"
} else := "none"
```

## Deploying Policies

### Embedded Mode (Default)

Policies are bundled with MCP Gateway:

```yaml
# values.yaml
gateway:
  opa:
    embedded: true
    policyPath: /policies
```

### Sidecar Mode

OPA runs as a separate container:

```yaml
# values.yaml
gateway:
  opa:
    embedded: false
    endpoint: http://localhost:8181
```

### Policy Bundle

Package policies as OPA bundle:

```bash
# Create bundle
opa build -b policies/ -o bundle.tar.gz

# Deploy to S3/GCS
aws s3 cp bundle.tar.gz s3://stoa-policies/bundles/
```

## Testing Policies

### Unit Tests

```rego
# authz_test.rego
package stoa.gateway.authz

test_allow_same_tenant {
    allow with input as {
        "token": {"stoa_realm": "acme", "exp": 9999999999},
        "request": {"tenant_id": "acme"}
    }
}

test_deny_different_tenant {
    not allow with input as {
        "token": {"stoa_realm": "acme", "exp": 9999999999},
        "request": {"tenant_id": "beta"}
    }
}
```

Run tests:

```bash
opa test policies/ -v
```

### Integration Testing

```bash
# Test with OPA CLI
opa eval -i input.json -d policies/ "data.stoa.gateway.authz.allow"
```

## Debugging

### Enable Debug Logging

```yaml
gateway:
  opa:
    logLevel: debug
```

### Decision Logs

Query OPA decision logs:

```bash
kubectl logs -l app=mcp-gateway -n stoa-system | grep "opa_decision"
```

### Policy Tracing

Enable tracing for specific requests:

```bash
curl -X POST https://mcp.gostoa.dev/tools/call \
  -H "X-OPA-Trace: true" \
  -d '...'
```

## References

- [OPA Documentation](https://www.openpolicyagent.org/docs/)
- [Rego Language Reference](https://www.openpolicyagent.org/docs/latest/policy-reference/)
- [ADR-012 — MCP RBAC Architecture](/docs/architecture/adr/adr-012-mcp-rbac-architecture)
