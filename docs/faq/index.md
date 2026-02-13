---
sidebar_position: 5
title: FAQ
description: "Frequently Asked Questions about STOA Platform — architecture, MCP gateway, security, subscriptions, environments, deployment, and support."
keywords: [FAQ, questions, STOA, MCP, API gateway, open source, subscriptions, RBAC]
---

# Frequently Asked Questions

## General

### What is STOA?

STOA is an enterprise API Management platform that unifies REST APIs and MCP Tools under a single governance layer. Purpose-built for cloud-native environments, GitOps-first, and AI-ready.

### Why the name "STOA"?

STOA (Stoa) refers to the ancient Greek covered walkway where Stoic philosophers taught. Our platform embodies Stoic principles:

- **Logos** — Reason & Order: UAC Specification, GitOps
- **Apatheia** — Mastery: Stability, Observability
- **Oikeiosis** — Coherence: Multi-tenancy, Domain alignment
- **Ataraxia** — Serenity: AI Copilot, Sustainable pace

### Is STOA open source?

Yes! STOA is released under **Apache 2.0** license. The core platform is fully open source. We offer optional commercial support and enterprise features through STOA Cloud.

### What makes STOA different from other API gateways?

STOA's kill feature is **UAC (Universal API Contract)** — "Define Once, Expose Everywhere". You define your API contract once, and STOA exposes it across REST, MCP, and multiple gateways simultaneously. No other platform bridges legacy APIs to AI agents natively.

---

## MCP Gateway

### Why not just use Claude/OpenAI directly?

You should! AI providers handle token consumption for reasoning and generation — that's their core value.

STOA MCP Gateway sits **between** the AI and your backend services (tools). It governs:
- **What tools** the AI can call
- **Who** can use them
- **Tracks usage** for billing and compliance

See [MCP Gateway Positioning](/docs/concepts/mcp-gateway-positioning) for details.

### Does STOA re-bill AI provider tokens?

**No.** STOA measures **tool invocations**, not tokens. These are different things:

| Provider | What They Bill |
|----------|---------------|
| Anthropic/OpenAI | Tokens consumed |
| STOA | Tool invocations (optional) |

Your AI provider bill is separate from any STOA usage tracking.

### Do I pay twice?

No. You pay:
1. **AI Provider**: For tokens (reasoning, generation)
2. **STOA** (optional): For tool governance, portal, analytics

These are separate value propositions. Many organizations use STOA even with free/self-hosted LLMs because the governance value is independent of the AI provider.

### What MCP protocol version does STOA support?

STOA supports MCP `2025-03-26` (latest) and `2024-11-05` (backward compatible). The gateway negotiates the highest mutually supported version during the initialization handshake. See [MCP Getting Started](/docs/guides/mcp-getting-started) for a tutorial.

### What transport does the MCP gateway use?

**Server-Sent Events (SSE)** over HTTP, per the MCP specification. STOA also provides REST endpoints for simpler integrations that don't need streaming. See [MCP Gateway API](/docs/api/mcp-gateway) for the full reference.

---

## Architecture

### What's the difference between Control Plane and Data Plane?

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Control Plane** | Python + FastAPI | Configuration, API management, Console |
| **STOA Gateway** | Rust + Tokio + axum | MCP protocol, request routing, rate limiting |
| **External Gateways** | Kong, Gravitee, webMethods | Legacy API proxying (adapter pattern) |

The Control Plane handles administrative tasks. The Data Plane (gateways) handles actual traffic.

### What gateways does STOA support?

STOA uses the **Adapter pattern** to orchestrate multiple API gateways:

| Gateway | Mode | Status |
|---------|------|--------|
| **STOA Gateway** (Rust) | Primary, edge-mcp | Production |
| **Kong** (DB-less) | Adapter | Production |
| **Gravitee** (APIM v4) | Adapter | Production |
| **webMethods** (Software AG) | Adapter | Production |

All adapters implement the same 16-method interface. You can run multiple gateways simultaneously.

### Can I run STOA without Kubernetes?

Yes. While STOA is Kubernetes-native, you can run it:
- **Docker Compose**: For development/testing ([Quick Start](/docs/guides/quickstart))
- **Standalone containers**: For edge deployments
- **Kubernetes**: Recommended for production

---

## Subscriptions & API Keys

### How do API subscriptions work?

Subscriptions connect a consumer to an API via a plan. The lifecycle is: **Pending** → **Active** → (Suspended/Revoked/Expired). See [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) for the full guide.

### What does an API key look like?

API keys use a prefixed format for easy identification:

```
stoa_sk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
└──────┘ └──────────────────────────────────┘
 prefix   32 hex characters (128 bits entropy)
```

MCP tool subscriptions use the `stoa_mcp_` prefix instead of `stoa_sk_`.

### Can I rotate API keys without downtime?

Yes. STOA supports **zero-downtime key rotation** with a configurable grace period (1-168 hours). During the grace period, both old and new keys are valid. See [API Key Rotation](/docs/guides/api-key-rotation).

### What happens when I exceed my quota?

The gateway returns `429 Too Many Requests` with a `Retry-After` header and `X-RateLimit-*` headers showing your remaining quota. See [Quota Enforcement](/docs/reference/quotas).

### What's the difference between a consumer and a subscriber?

A **consumer** is an external partner/application registered in STOA with OAuth2 credentials. A **subscriber** is a user who creates subscriptions. A consumer can have multiple subscriptions. See [Consumer Onboarding](/docs/guides/consumer-onboarding).

---

## Environments

### What environments does STOA support?

Three environments by default: **Development** (full access), **Staging** (full access), and **Production** (read-only). See [Environment Management](/docs/guides/environment-management).

### Why is production read-only?

Production uses read-only mode to prevent accidental changes. All modifications must go through the promotion pipeline (dev → staging → prod). Platform admins (`cpi-admin`) can override this for emergency hotfixes.

### How do I switch environments?

In the Console UI, use the environment selector dropdown in the header. Via API, add `?environment=staging` to your queries. The selected environment scopes all data and enforces access modes.

---

## Security

### How are API keys protected?

API keys are:
1. Stored as **SHA-256 hashes** — the original key cannot be recovered
2. The full key is shown only **once** at creation
3. Support **rotation with grace period** for zero-downtime updates
4. Never logged in plain text
5. Cached at the gateway for 5 minutes (invalidated on rotation)

### Does STOA support SSO?

Yes. STOA integrates with **Keycloak** for OIDC/SAML authentication. You can connect your existing identity provider (Okta, Azure AD, Google Workspace, etc.).

### What RBAC roles are available?

Four roles: `cpi-admin` (platform-wide), `tenant-admin` (tenant-scoped), `devops` (deploy/promote), `viewer` (read-only). See [RBAC Permissions](/docs/reference/rbac-permissions) for the full permission matrix.

### Does STOA support mTLS?

Yes. Consumers can authenticate via mutual TLS (mTLS) certificates with support for certificate rotation and grace periods. See [Consumer Onboarding](/docs/guides/consumer-onboarding).

### What about audit logging?

Every action is logged:
- Tool invocations (who, what, when, parameters)
- Configuration changes
- Authentication events
- Policy decisions

Logs are stored in OpenSearch and can be exported to your SIEM.

---

## Deployment

### What are the infrastructure requirements?

**Minimum (development):**
- 2 CPU cores, 4GB RAM, 20GB storage

**Recommended (production):**
- 4+ CPU cores, 8GB+ RAM, 50GB+ SSD, Kubernetes 1.28+

See [Hardware Requirements](/docs/reference/hardware-requirements) for detailed sizing.

### Which cloud providers are supported?

STOA runs on any cloud or on-premises:
- **OVH** (reference production deployment)
- **Hetzner** (reference staging deployment)
- **AWS**, **GCP**, **Azure**
- **On-premises** (VMware, bare metal)

### Does STOA use GitOps?

Yes. STOA uses ArgoCD for declarative, auditable configuration management with auto-sync and self-healing. See [GitOps with ArgoCD](/docs/concepts/gitops).

### How do I get started?

See our [Quick Start Guide](/docs/guides/quickstart) for a 5-minute setup.

---

## Support

### Where can I get help?

- **Documentation**: You're here!
- **GitHub Issues**: [stoa-platform/stoa](https://github.com/stoa-platform/stoa)
- **Discord**: [Join the community](https://discord.gostoa.dev)
- **Enterprise Support**: contact@gostoa.dev

### How do I report a security vulnerability?

Please email **security@gostoa.dev** with details. Do not open public issues for security vulnerabilities.

### Can I contribute?

Absolutely! See our [Contributing Guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md).
