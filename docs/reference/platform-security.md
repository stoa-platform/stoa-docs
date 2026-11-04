---
title: Platform security
description: Source-backed reference for vulnerability management, authentication, and penetration testing.
---

# Platform security

## Purpose and audience

This reference helps architects and security reviewers assess **STOA — Sovereign iPaaS — API & integration platform**, with an MCP module. It separates implemented controls from the target architecture and records the evidence available for review.

## Sources and architecture scope

The source links below pin implementation evidence to a repository revision. Published ADRs describe decisions; they are not deployment attestations.

[ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane.md) decides that the data plane uses upstream Envoy, configured through xDS served by STOA Link, with authorization in external services and the MCP module behind Envoy. It explicitly marks the Link xDS server as not yet implemented. The Rust gateway code cited here is therefore implementation evidence for the maintained gateway, not proof that the Envoy target is deployed.

## Vulnerability management

### Reporting and handling

The repository's [security policy][policy] asks researchers to report privately through its listed security contact, rather than public GitHub issues. Include the affected source revision, reproduction steps, relevant configuration, and impact. The policy describes acknowledgment, assessment, development of a fix for verified findings, and coordinated disclosure. Its safe-harbor conditions limit testing to owned or explicitly authorized accounts and require avoiding privacy violations, data destruction, and service interruption.

### Automated checks and their limits

The following controls are configured in the source repository; configuration alone does not establish a clean scan or complete coverage.

| Control | Configured behavior and limits | Evidence |
|---|---|---|
| Static analysis | Clippy for Rust, Bandit for Python, and security rules for ESLint. Pull-request selection depends on changed paths. | [Security Scan][scan], [path selection][selection] |
| Dependencies | `cargo audit`, `pip-audit`, and production-only `npm audit` for the console and portal. These audit steps allow failure; the Python command includes an explicit advisory exclusion. | [Security Scan][scan] |
| Secrets and containers | Gitleaks checks the PR commit range, or the current tree outside PRs. Trivy checks selected container images for HIGH/CRITICAL findings with fixes available; the container job allows failure. | [Security Scan][scan] |
| Scheduled checks | A separate weekly workflow defines dependency audits, full-history Gitleaks, and image scans. Several steps are informational, a repository variable can disable them, and the portal image reference is unresolved in this revision. | [Scheduled Security Scan][scheduled] |
| Dependency updates | Dependabot groups weekly minor/patch version updates for pip, npm, Cargo, Docker, and GitHub Actions. Major updates and named versions have exclusions. Update proposals do not demonstrate remediation. | [Dependabot configuration][dependabot] |
| CodeQL | GitHub-managed analysis is evidenced by the linked repository run for Actions and Go. This run does not establish CodeQL coverage of every language or component. | [CodeQL run][codeql] |

## Authentication and authorization

The [security policy][policy] identifies Keycloak as the OIDC provider. In the control-plane API, [authentication dependencies][api-auth] verify RS256 signatures using the Keycloak realm public key, validate issuer and lifetime claims, then check the audience against an accepted set that still includes compatibility audiences. [RBAC code][rbac] defines the platform administrator, tenant administrator, DevOps, and viewer roles and enforces tenant access decisions.

The maintained Rust gateway's [JWT validator][jwt] uses OIDC key material and validates signatures, issuer, lifetime, and audience. MCP entrypoints have an explicit resource-audience validation path.

### mTLS and certificate-bound tokens

The Rust gateway contains [certificate extraction and binding middleware][mtls] and [mTLS configuration][mtls-config]. It can consume certificate metadata from a TLS terminator and compare the certificate fingerprint with the JWT `cnf.x5t#S256` claim. This control is configuration-dependent: mTLS is disabled by default, required routes are configurable, and an empty trusted-proxy list accepts all sources. A deployment review must therefore examine the terminator and proxy trust configuration as well as the token check.

[ADR-039](../architecture/adr/adr-039-mtls-cert-bound-tokens.md) records the certificate-binding design. For the Envoy target, [ADR-073, section 5](../architecture/adr/adr-073-adopt-envoy-data-plane.md#5-token-binding-and-dpop--to-be-verified-not-settled) leaves native certificate-bound-token and DPoP support to verification; missing checks belong in the external authorization service. TLS termination placement and certificate-header sanitization are also open points in that decision.

## Penetration-testing approach and evidence boundary

The published [ADR-018](../architecture/adr/adr-018-security-hardening-p0.md) records an internal penetration-testing exercise and the resulting hardening decisions. Its scope includes JWT audience validation, SSE connection exhaustion, container restrictions, and CORS. Its review trail calls for tests alongside fixes, explicit configuration, documentation, and rollback planning.

For an architecture review, use that record as a traceable example of finding-to-remediation reasoning:

1. Identify the security boundary and reproduction conditions in the finding, as requested by the [security policy][policy].
2. Trace the proposed control to its hardening decision and implementation.
3. Review the associated tests, configuration requirements, and rollback conditions.

These review steps summarize the ADR's approach. The ADR is historical evidence, not an independent test report for the current release or the Envoy target. This page supplies no new test results, pass rate, assurance rating, or claim of a recurring external penetration-test programme.

## See also

- [Security configuration](./security-configuration.md)
- [RBAC permissions](./rbac-permissions.md)
- [Envoy data-plane decision](../architecture/adr/adr-073-adopt-envoy-data-plane.md)

[policy]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/SECURITY.md
[scan]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/security-scan.yml
[selection]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/scripts/security-scan-changes.py
[scheduled]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/security-scheduled.yml
[dependabot]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/dependabot.yml
[codeql]: https://github.com/stoa-platform/stoa/actions/runs/41899401121
[api-auth]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/src/auth/dependencies.py
[rbac]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/src/auth/rbac.py
[jwt]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/auth/jwt.rs
[mtls]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/auth/mtls.rs
[mtls-config]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/config/mtls.rs
