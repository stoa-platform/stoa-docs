---
sidebar_position: 2
title: "ADR-002: stoactl CLI Design"
description: "Architecture Decision Record for the GitOps-native STOA CLI tool built with Go and Cobra for kubectl-style API management."
keywords: [stoactl, CLI, Go, Cobra, GitOps, kubectl, API management]
---

# ADR-002: stoactl CLI Design

**Status**: Proposed
**Date**: 2026-01-24
**Author**: Christophe ABOULICAM
**Related**: CAB-899

## Context

STOA needs a CLI that enables GitOps workflows and CI/CD integration. DevOps teams expect a declarative, kubectl-like experience for infrastructure-as-code patterns.

### Requirements

1. **GitOps-native**: `stoactl apply -f` as the primary workflow
2. **Familiar UX**: kubectl/helm/terraform muscle memory
3. **CI/CD-friendly**: Non-interactive, scriptable, exit codes
4. **Multi-context**: Switch between environments easily
5. **Idempotent**: Safe to run repeatedly

## Decision

Create `stoactl` as a separate, declarative CLI following the **kubectl pattern**.

### Naming Convention
```
stoactl <verb> <resource> [name] [flags]
```

| Verb | Description | Example |
|------|-------------|---------|
| `get` | List/describe resources | `stoactl get apis` |
| `apply` | Create or update from file | `stoactl apply -f api.yaml` |
| `delete` | Remove resource | `stoactl delete api billing-api` |
| `describe` | Detailed view | `stoactl describe api billing-api` |
| `logs` | Stream logs | `stoactl logs api billing-api -f` |
| `config` | Manage contexts | `stoactl config use-context prod` |

### Resources

| Resource | Aliases | Description |
|----------|---------|-------------|
| `api` | `apis` | API definitions |
| `subscription` | `sub`, `subs` | API subscriptions |
| `apikey` | `key`, `keys` | API credentials |
| `tenant` | `tenants` | Tenant configurations |
| `contract` | `uac`, `contracts` | UAC contracts |
| `policy` | `policies` | Rate limits, CORS, etc. |

### Resource Definitions (YAML)

#### API Definition
```yaml
apiVersion: stoa.io/v1
kind: API
metadata:
  name: billing-api
  namespace: acme  # tenant
  labels:
    team: finance
spec:
  version: v2
  description: "Invoice and payment management"
  upstream:
    url: https://billing.internal.acme.com
    timeout: 30s
    retries: 3
  routing:
    path: /billing
    stripPath: true
    methods: [GET, POST, PUT, DELETE]
  authentication:
    required: true
    providers:
      - type: apikey
        header: X-API-Key
      - type: jwt
        issuer: https://auth.<YOUR_DOMAIN>/realms/acme
  policies:
    rateLimit:
      requestsPerHour: 10000
    cors:
      origins: ["https://*.acme.com"]
    cache:
      enabled: true
      ttlSeconds: 300
  catalog:
    visibility: public
    categories: [Finance, Billing]
```

#### Subscription Definition
```yaml
apiVersion: stoa.io/v1
kind: Subscription
metadata:
  name: mobile-app-billing
  namespace: acme
spec:
  apiRef:
    name: billing-api
  plan: premium
  application:
    name: ACME Mobile App
    owner: mobile-team@acme.com
  quotas:
    requestsPerMonth: 1000000
```

### Configuration File

Location: `~/.stoa/config`
```yaml
apiVersion: stoa.io/v1
kind: Config
current-context: production

contexts:
  - name: production
    context:
      server: https://api.<YOUR_DOMAIN>
      tenant: acme

  - name: staging
    context:
      server: https://api.staging.gostoa.dev
      tenant: acme-staging

  - name: local
    context:
      server: http://localhost:8080
      tenant: dev
```

### Command Examples
```bash
# Context management
stoactl config set-context prod --server=https://api.<YOUR_DOMAIN> --tenant=acme
stoactl config use-context prod
stoactl auth login

# CRUD operations
stoactl get apis
stoactl get api billing-api -o yaml
stoactl apply -f api.yaml
stoactl apply -f api.yaml --dry-run
stoactl diff -f api.yaml
stoactl delete api billing-api

# Output formats
stoactl get apis -o wide
stoactl get apis -o yaml
stoactl get apis -o json
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Misuse (bad flags) |
| 3 | Authentication failed |
| 4 | Resource not found |
| 5 | Conflict |
| 6 | Validation error |

## Implementation

### Technology: Go

- Single binary distribution
- Cobra/Viper CLI libraries
- Cross-platform compilation
- kubectl/helm ecosystem familiarity

### Distribution

| Channel | Command | Status |
|---------|---------|--------|
| Homebrew | `brew install stoa-platform/tap/stoactl` | Planned Q3 2026 |
| Binary | GitHub Releases | Planned Q3 2026 |
| Docker | `docker run ghcr.io/stoa-platform/stoactl` | Planned Q3 2026 |

> Distribution channels will be available when the CLI exits private beta. [Request access](mailto:christophe@hlfh.io) to participate.

## Consequences

### Positive
- DevOps teams get familiar GitOps workflow
- CI/CD integration is trivial
- Resource definitions are self-documenting
- Multi-environment management built-in

### Negative
- Two CLIs to maintain (`stoa` interactive + `stoactl` GitOps)
- YAML fatigue for simple operations

## References

- [kubectl Conventions](https://kubernetes.io/docs/reference/kubectl/conventions/)
- [Cobra CLI Framework](https://cobra.dev/)
