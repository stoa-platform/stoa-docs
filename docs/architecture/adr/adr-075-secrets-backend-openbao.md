---
sidebar_position: 75
title: "ADR-075: Secrets Backend — OpenBao Through the Vault API"
sidebar_label: "ADR-075: Secrets Backend"
description: "STOA uses one secrets backend for the product and for the platform team's own environments: OpenBao, reached through the Vault HTTP API. Infisical is retired. Customers can keep using a HashiCorp Vault they already run."
keywords: [ADR, secrets management, secrets backend, OpenBao, HashiCorp Vault, Infisical, Vault API, External Secrets Operator, license, MPL-2.0, BSL, architecture decision]
---

# ADR-075: Secrets Backend — OpenBao Through the Vault API

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 2026-11-07 |
| **Decision Makers** | Christophe Aboulicam |
| **Linear** | CAB-1795 |
| **Related** | [ADR-029](./adr-029-mtls-certificate-lifecycle.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-048](./adr-048-integrated-chat-agent.md) |

## Context

STOA reads secrets in two places.

1. **In the product.**
   - The control plane API reads connector credentials, external MCP server credentials and the audit pseudonymization key through the Vault HTTP API. It uses the `hvac` client and, in a cluster, the Kubernetes auth method.
   - The Helm chart can sync gateway secrets with an External Secrets Operator (ESO) `ExternalSecret` that targets a Vault `ClusterSecretStore`.
   - The Docker Compose deployment ships Vault Agent templates.
2. **In the platform team's own operations.** Operational scripts, bootstrap jobs and developer tooling read their secrets from a self-hosted Infisical instance.

Two systems meant two things to harden, back up, rotate and audit. No written decision said which one was the source of truth. The choice was between Infisical and Vault. OpenBao, the open-source fork of Vault maintained under the Linux Foundation, entered the comparison because it keeps the Vault API.

### What each license allows

Checked on 2026-11-07 against the license files on each project's main branch:

| | HashiCorp Vault (1.15 and later) | Infisical | OpenBao |
|---|---|---|---|
| License | Business Source License 1.1. Each version converts to MPL 2.0 four years after its release | MIT, except every `ee/` directory, which is under the proprietary Infisical Enterprise License | Mozilla Public License 2.0 |
| Open source license | No | MIT core only | Yes |
| Internal production use | Allowed. The license states that internal use is not a competitive offering | Allowed for the MIT core. The official image also contains `ee/` code, which runs even without a license key. Its license allows production use only with a subscription | Allowed |
| Distribution with STOA | Allowed. Production use is excluded only for a paid product that competes with the licensor's paid versions of Vault | The `ee/` code may not be distributed | Allowed. Modified OpenBao files stay under MPL 2.0 |
| Not available without a commercial license | Namespaces, replication, HSM auto-unseal, control groups, Sentinel policies, lease count quotas | Audit logs, RBAC and custom roles, secret rotation, dynamic secrets, point-in-time recovery, SSO, IP allowlisting, approval workflows | None. OpenBao has no commercial edition |

### What the platform needs

- **An audit trail.** People, services and AI agents read secrets. Every read must leave a trace. Vault and OpenBao audit devices provide one in the open-source distribution. Infisical's audit logs require a paid plan.
- **The product contract.** Customers who run STOA in their own environment expect to point it at the Vault they already operate. The control plane already speaks the Vault API.

## Decision

1. **One secrets backend, reached through the Vault HTTP API**, serves both the product and the platform team's own environments. Infisical is retired.
2. **OpenBao is the backend STOA runs and ships.** This covers STOA-operated environments and the reference deployments: Helm chart defaults, the Docker Compose quickstart and local development.
3. **The product stays neutral at the API level.**
   - The control plane keeps its Vault API client and uses no OpenBao-only feature in the product path.
   - Customers can point STOA at OpenBao or at a HashiCorp Vault they already license.
   - ESO delivers secrets to Kubernetes workloads through its Vault provider, which documents OpenBao support.
4. **The platform team's backend runs on a dedicated virtual machine outside the Kubernetes cluster.** It survives a cluster rebuild and can serve the cluster bootstrap.

### Requirements for the platform team's instance

Before the first real secret is written:

- TLS on every listener;
- an audit device enabled;
- integrated storage with encrypted backups, and a restore test from the off-host copy;
- a written unseal procedure.

### Open points, settled during implementation

- **Unseal.** The platform VM has no cloud KMS. The options are Shamir unseal, which is manual after each restart, and the static key seal. OpenBao recommends the static key seal only when an existing source of trust holds the key. The choice and the procedure go into the operations runbook.
- **Network path.** Kubernetes workloads reach the backend over a private path. The auth method (Kubernetes or JWT) is configured to match.
- **Client compatibility.** A CI job runs the control plane's `hvac` client against OpenBao before the reference deployments switch images.

## Consequences

### Positive

- One system to harden, back up, rotate and audit.
- No product rewrite: the control plane, the chart and the Compose deployment already use the Vault API.
- An open-source secrets stack, in line with the "Open Source first" and "Self-hosted possible" principles and with sovereign deployments ([ADR-037](./adr-037-deployment-modes-sovereign-first.md)).
- Audit devices, policies, dynamic secrets, PKI and SSH secrets engines without a commercial license. The Vault PKI provider of [ADR-029](./adr-029-mtls-certificate-lifecycle.md) keeps the same API.

### Negative

- OpenBao needs an unseal step after each restart unless an auto-unseal mechanism is configured. Infisical has no seal.
- The operational tooling that reads Infisical has to move to the Vault API.
- MPL 2.0 is a file-level copyleft: modified OpenBao files must stay under MPL 2.0 when distributed.

### Mitigations

- The unseal procedure and the restore test are rehearsed before the first real secret.
- Operational tooling moves in small pull requests. The Infisical instance is removed after its last consumer has moved.
- STOA runs OpenBao as a separate service and does not modify it, so the MPL 2.0 obligations stay limited to publishing the upstream source.
- The product path stays on the generic Vault API, and the CI compatibility job guards it. HashiCorp Vault therefore stays usable by customers.

### Follow-up

- The encryption key that [ADR-048](./adr-048-integrated-chat-agent.md) places in Infisical moves to the secrets backend, along with the operational tooling.
- Public pages that still describe Infisical are updated in follow-up pull requests.

## Alternatives Considered

| Option | Why it was not chosen |
|---|---|
| HashiCorp Vault as the platform's own backend | BSL 1.1 is not an open-source license. Namespaces, replication and HSM auto-unseal need a commercial license. Customers can still use it (Decision 3). |
| Infisical for the platform team, Vault API for the product | Two systems to secure. Infisical has no audit logs without a paid plan. Its `ee/` license leaves production use without a subscription unclear. |
| Infisical everywhere | It would mean rewriting the control plane's credential resolution and audit pseudonymization, with the same license and audit limits. |

## References

- [HashiCorp Vault license (BSL 1.1)](https://github.com/hashicorp/vault/blob/main/LICENSE) and [HashiCorp licensing FAQ](https://www.hashicorp.com/license-faq)
- [Vault Enterprise features](https://developer.hashicorp.com/vault/docs/enterprise)
- [Infisical license](https://github.com/Infisical/infisical/blob/main/LICENSE) and [Infisical Enterprise license for `ee/`](https://github.com/Infisical/infisical/blob/main/backend/src/ee/LICENSE.md)
- [Infisical features enabled without a license key](https://github.com/Infisical/infisical/blob/main/backend/src/ee/services/license/license-fns.ts) (`getDefaultOnPremFeatures`)
- [Infisical pricing](https://infisical.com/pricing)
- [OpenBao](https://openbao.org/) and [OpenBao license (MPL 2.0)](https://github.com/openbao/openbao/blob/main/LICENSE)
- [OpenBao seal configuration](https://openbao.org/docs/configuration/seal/) and [static key seal](https://openbao.org/docs/configuration/seal/static/)
- [External Secrets Operator — OpenBao provider](https://external-secrets.io/latest/provider/openbao/)
