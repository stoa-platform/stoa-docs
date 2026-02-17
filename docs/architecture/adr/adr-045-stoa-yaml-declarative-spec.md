---
title: "ADR-045: stoa.yaml Declarative API Specification"
description: "Defines the stoa.yaml declarative API configuration format, enabling GitOps-native API deployment via CLI, Console UI, and MCP Copilot."
keywords: [ADR, stoa.yaml, declarative, GitOps, API deployment, Kubernetes-style, Vercel, CLI, stoactl]
---

# ADR-045: stoa.yaml Declarative API Specification

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-16 |
| **Author** | Christophe ABOULICAM |
| **Deciders** | STOA Core Team |
| **Category** | Architecture / Developer Experience / GitOps |
| **Linear** | CAB-1352 |

### Related Decisions

- **ADR-007**: GitOps with ArgoCD
- **ADR-024**: Gateway Unified Modes (edge-mcp, sidecar, proxy, shadow)
- **ADR-037**: Deployment Modes -- Sovereign First Strategy
- **CAB-374**: Deployment Lifecycle MEGA (parent ticket)
- **CAB-1353**: Deployment Lifecycle API (PR #570)

## Context

STOA Platform enables organizations to deploy APIs across multiple gateways (STOA, Kong, Gravitee, webMethods, Apigee) with a unified control plane. Today, API deployment requires multiple steps across different interfaces:

1. Upload OpenAPI spec via Console UI
2. Configure rate limits manually in Console
3. Configure CORS via separate policy screen
4. Deploy to gateway via "Deploy" button
5. Repeat for each environment (dev, staging, production)

### Problem Statement

**No single source of truth**: API configuration is scattered across Console UI forms, manual deployments, and undocumented settings.

**No GitOps workflow**: Developers cannot version-control their API configuration alongside their backend code.

**No CI/CD integration**: Automated pipelines cannot deploy APIs programmatically without complex API client scripts.

**No MCP Copilot support**: AI agents cannot propose or execute API deployments without a declarative format.

### Inspiration

| Platform | Format | Philosophy |
|----------|--------|------------|
| **Vercel** | `vercel.json` | Config-as-code, zero-config defaults |
| **Kubernetes** | YAML manifests | Declarative desired state |
| **Terraform** | `.tf` files | Infrastructure-as-code |
| **Kong** | `kong.yaml` (DB-less) | Declarative gateway config |

## Decision

### Introduce `stoa.yaml` -- Kubernetes-Inspired Declarative API Spec

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: customer-api
  tenant: acme
spec:
  source:
    type: openapi
    url: https://api.example.com/v1/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
  policies:
    rateLimit:
      requests: 1000
      window: 1m
    cors:
      origins: ["https://app.acme.com"]
      methods: ["GET", "POST"]
  deployment:
    strategy: rolling
    rollback: automatic
```

### Design Principles

1. **Single source of truth** -- `stoa.yaml` lives in the same git repo as the API backend code
2. **Kubernetes-style** -- Familiar `apiVersion`, `kind`, `metadata`, `spec` structure
3. **Vercel-inspired defaults** -- Sensible zero-config defaults (rate limit = 1000/min, CORS = `["*"]`)
4. **Multi-entry-point** -- Same spec consumed by CLI, Console UI, MCP Copilot
5. **Diff-driven** -- Tools can compute what changed (like `kubectl diff` or `terraform plan`)
6. **Environment-aware** -- Single spec, environment-specific overrides

### Schema Structure

#### Top-Level Fields

```yaml
apiVersion: stoa/v1alpha1        # Versioned API contract
kind: APIDeployment              # Resource type
metadata:                        # Identity + ownership
  name: string                   # API unique identifier
  tenant: string                 # Multi-tenant namespace
  labels:                        # Optional key-value tags
    team: payments
spec:                            # Desired state
  ...
```

#### `spec.source` -- API Definition

```yaml
spec:
  source:
    type: openapi | asyncapi | grpc | graphql
    url: https://...           # Remote URL (preferred)
    file: ./openapi.yaml       # Local file (relative to stoa.yaml)
    inline: |                  # Inline YAML (for small APIs)
      openapi: 3.0.0
      ...
```

Exactly one of `url`, `file`, or `inline` must be provided.

#### `spec.gateways` -- Deployment Targets

```yaml
spec:
  gateways:
    - name: stoa-edge           # Gateway instance name
      mode: edge-mcp            # Deployment mode (ADR-024)
      environment: production
    - name: kong-staging
      mode: proxy
      environment: staging
```

Zero-config default: if omitted, deploys to `default` gateway in `stoa-edge` mode.

#### `spec.policies` -- Traffic Policies

```yaml
spec:
  policies:
    rateLimit:
      requests: 1000
      window: 1m
      scope: tenant | api | consumer
    cors:
      origins: ["https://app.acme.com"]
      methods: ["GET", "POST", "PUT", "DELETE"]
      credentials: true
    authentication:
      type: oauth2 | api-key | mtls
      issuer: https://auth.acme.com/realms/prod
      scopes: ["read:customers", "write:customers"]
```

Zero-config defaults: no `rateLimit` = 1000 req/min, no `cors` = `origins: ["*"]`, no `authentication` = `type: api-key`.

#### `spec.deployment` -- Deployment Strategy

```yaml
spec:
  deployment:
    strategy: rolling | blue-green | canary
    rollback: automatic | manual
    healthCheck:
      path: /health
      interval: 10s
    notifications:
      webhook: https://slack.com/webhook/...
      onFailure: true
```

#### Environment Overrides

```yaml
spec:
  policies:
    rateLimit:
      requests: 1000
      window: 1m
  environments:
    dev:
      policies:
        rateLimit:
          requests: 10000
    production:
      gateways:
        - name: stoa-prod-1
        - name: stoa-prod-2
      policies:
        rateLimit:
          requests: 100
```

Merge logic: base `spec` + environment-specific overrides (deep merge).

### Entry Points -- 3 Ways to Deploy

#### 1. CLI (`stoactl deploy`)

```bash
stoactl deploy                        # Deploy to default environment
stoactl deploy --env production       # Deploy to production
stoactl deploy --dry-run              # Preview changes
stoactl deploy --watch                # Stream deployment logs
```

#### 2. Console UI (Form to YAML Generator)

1. Fill out Console UI form
2. Console generates `stoa.yaml` from form inputs
3. User downloads `stoa.yaml` or commits directly to git
4. Bidirectional sync: form edits update YAML, YAML edits update form

#### 3. MCP Copilot (AI Agent)

AI agents can generate, validate, diff, and deploy via MCP tools:
- `generate_stoa_yaml` -- parameters to YAML
- `validate_stoa_yaml` -- validation result
- `diff_deployment` -- current state diff
- `deploy_api` -- execute deployment

## Examples

### Minimal REST API Proxy

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: weather-api
  tenant: acme
spec:
  source:
    url: https://api.weather.com/v3/openapi.json
```

Deploys to default gateway with default rate limit (1000/min), CORS (`*`), and API key auth.

### MCP Tool Registration

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: customer-lookup
  tenant: acme
  labels:
    mcp-enabled: "true"
spec:
  source:
    type: openapi
    url: https://crm.acme.com/api/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
  policies:
    rateLimit:
      requests: 500
      window: 1m
      scope: consumer
    authentication:
      type: oauth2
      issuer: https://auth.acme.com/realms/prod
      scopes: ["read:customers"]
  mcp:
    tools:
      - name: lookup_customer_by_email
        description: "Find customer record by email address"
        endpoint: /customers/search
        method: POST
        parameters:
          email:
            type: string
            required: true
```

### Multi-Gateway Deployment

```yaml
apiVersion: stoa/v1alpha1
kind: APIDeployment
metadata:
  name: payment-api
  tenant: acme
spec:
  source:
    url: https://api.acme.com/payments/openapi.json
  gateways:
    - name: stoa-edge
      mode: edge-mcp
    - name: kong-legacy
      mode: proxy
    - name: webmethods-mainframe
      mode: sidecar
  policies:
    rateLimit:
      requests: 100
      window: 1m
    authentication:
      type: mtls
  deployment:
    strategy: blue-green
    rollback: automatic
    notifications:
      webhook: https://hooks.slack.com/services/XXX
      onFailure: true
```

## Implementation Phases

### Phase 1: Schema Definition + Validation (CAB-1352, 3 pts)

- JSON Schema for `stoa.yaml`
- Python Pydantic model (`APIDeploymentSpec`)
- CLI command: `stoactl validate stoa.yaml`

### Phase 2: CLI Entry Point (CAB-1358, 5 pts)

- `stoactl deploy` command with `--dry-run`, `--env`, `--watch` flags
- Environment variable expansion in `stoa.yaml`

### Phase 3: Console UI Roundtrip (CAB-1359, 8 pts)

- Console "Import stoa.yaml" / "Export stoa.yaml" buttons
- Bidirectional sync: form edits update YAML, YAML edits update form

### Phase 4: MCP Copilot Tools (CAB-1360, 5 pts)

- 4 MCP tools: generate, validate, diff, deploy

**Total: 21 points**

## Consequences

### Positive

- **GitOps-native**: API config lives in git alongside backend code
- **Developer experience**: Single command (`stoactl deploy`) replaces multi-step UI
- **Multi-environment safety**: Environment overrides prevent config drift
- **AI-assisted deployment**: MCP Copilot can propose, validate, and deploy
- **Hybrid workflows**: Developers use CLI, DevOps use Console UI, both stay in sync

### Negative

- **Learning curve**: New users must learn YAML syntax (mitigated by Console UI and MCP Copilot)
- **Schema evolution**: Breaking changes require migration scripts (use `v1alpha1` versioning)
- **Roundtrip sync**: Bidirectional UI/YAML sync requires comment and formatting preservation

### Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Developers stick to UI | Medium | Medium | Make CLI the default in docs |
| Schema becomes kitchen sink | High | High | Strict review for new fields |
| Environment overrides too complex | Medium | Medium | Limit to 2 levels deep |

## Alternatives Considered

### JSON Format
Rejected: YAML is more human-readable for configuration, supports comments, and aligns with Kubernetes ecosystem.

### HCL (HashiCorp Configuration Language)
Rejected: Less familiar than YAML, limited parser availability in Python/TypeScript.

### Multiple Files (Pulumi-Style)
Rejected: No single source of truth, more files = more confusion for beginners.

### No Declarative Format (REST API Only)
Rejected: No GitOps workflow, no version control, no AI Copilot support.

## References

- [Kubernetes API Conventions](https://kubernetes.io/docs/reference/using-api/api-concepts/)
- [Vercel Configuration](https://vercel.com/docs/projects/project-configuration)
- [Kong Declarative Configuration](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
- STOA Internal: CAB-374, CAB-1353 (PR #570), ADR-007, ADR-024
