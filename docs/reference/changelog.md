---
sidebar_position: 14
title: "Changelog"
description: "STOA Platform release history — version changelog, breaking changes, migration notes, and release process."
keywords:
  - changelog
  - releases
  - version history
  - breaking changes
  - migration
---

# Changelog

## Versioning Policy

STOA Platform follows [Semantic Versioning](https://semver.org/):

| Segment | When Incremented | Example |
|---------|-----------------|---------|
| **Major** (X.0.0) | Breaking API changes | Removed endpoint, changed schema |
| **Minor** (0.X.0) | New features, backwards-compatible | New endpoint, new CRD field |
| **Patch** (0.0.X) | Bug fixes, security patches | Fix regression, update dependency |

## Component Versions

Each component is versioned independently. The Helm chart bundles compatible versions:

| Component | Current | Compatibility |
|-----------|---------|---------------|
| Control Plane API | 2.0.0 | Database schema v2 |
| STOA Gateway | 1.0.0 | CP API v2.x |
| Console UI | 1.0.0 | CP API v2.x |
| Developer Portal | 1.0.0 | CP API v2.x |
| Helm Chart | 1.0.0 | All above |

## Release Process

1. **Feature freeze** — no new features after freeze date
2. **Release candidate** — tagged `vX.Y.Z-rc.1`, deployed to staging
3. **Testing** — E2E tests, smoke tests, manual verification
4. **Release** — tagged `vX.Y.Z`, Docker images pushed, Helm chart updated
5. **Announcement** — changelog published, blog post if significant

## Recent Releases

### v2.0.0 (February 2026)

**Highlights:**
- STOA Gateway (Rust) replaces Python MCP Gateway as primary gateway
- Multi-gateway adapter pattern (Kong, Gravitee, webMethods support)
- Environment management (dev/staging/production)
- Gateway Arena benchmarking
- Audit trail with OpenSearch
- ArgoCD GitOps integration
- 4 CRDs: Tool, ToolSet, GatewayInstance, GatewayBinding
- mTLS support (RFC 8705)
- Documentation v1.0

**Breaking Changes:**
- Python MCP Gateway moved to `archive/mcp-gateway/`
- Gateway API endpoints changed from `/mcp/*` to `/v1/*`
- CRD API group changed from `stoa.io` to `gostoa.dev`
- Keycloak client `stoa-mcp-gateway` audience mapper must include new gateway

**Migration:**
- Update CRDs: `kubectl apply -f charts/stoa-platform/crds/`
- Update Keycloak audience mapper to include `stoa-gateway`
- Re-deploy all components with new Helm chart

### v1.0.0 (October 2025)

**Highlights:**
- Initial public release
- Control Plane API with FastAPI
- Python MCP Gateway with OPA policies
- Console UI (React)
- Developer Portal (React)
- Keycloak OIDC integration
- Multi-tenant RBAC (4 roles)
- Helm chart for Kubernetes deployment
- E2E test suite (Playwright + BDD)

## Deprecation Policy

| Stage | Timeline | Action |
|-------|----------|--------|
| **Deprecated** | Announced in changelog | Feature works but logs warnings |
| **Removal planned** | Next major version | Documentation updated, migration guide provided |
| **Removed** | Major version release | Feature removed, breaking change documented |

Deprecated features are supported for at least one major version cycle.

## How to Stay Updated

- **GitHub Releases**: [github.com/stoa-platform/stoa/releases](https://github.com/stoa-platform/stoa/releases)
- **Blog**: [docs.gostoa.dev/blog](https://docs.gostoa.dev/blog)
- **RSS**: Subscribe to the blog RSS feed for release announcements

## Related

- [Upgrade Guide](/docs/admin/upgrade) -- Version upgrade procedures
- [Roadmap](/docs/roadmap) -- Planned features
- [ADRs](/docs/architecture/adr) -- Architecture decisions
