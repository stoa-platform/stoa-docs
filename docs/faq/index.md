---
sidebar_position: 5
title: FAQ
description: Frequently Asked Questions about STOA Platform
---

# Frequently Asked Questions

## General

### What is STOA?

STOA is an enterprise API Management platform that unifies REST APIs and MCP Tools under a single governance layer. Think of it as **"The Cilium of API Management"** — eBPF-native, CLI-first, and AI-ready.

### Why the name "STOA"?

STOA (Στοά) refers to the ancient Greek covered walkway where Stoic philosophers taught. Our platform embodies Stoic principles:

- **Λόγος (Logos)** — Reason & Order: UAC Specification, GitOps
- **Ἀπάθεια (Apatheia)** — Mastery: Stability, Observability  
- **Οἰκείωσις (Oikeiosis)** — Coherence: Multi-tenancy, Domain alignment
- **Ἀταραξία (Ataraxia)** — Serenity: AI Copilot, Sustainable pace

### Is STOA open source?

Yes! STOA is released under **Apache 2.0** license. The core platform is fully open source. We offer optional commercial support and enterprise features through STOA Cloud.

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

### What about function calling costs?

Some AI providers charge extra for function/tool calling. That's between you and the provider. STOA doesn't intercept those calls — it governs access to **your tools**, not the AI's function calling capability.

---

## Architecture

### What's the difference between Control Plane and Data Plane?

| Component | Language | Purpose |
|-----------|----------|---------|
| **Control Plane** | Go | Configuration, API, UI |
| **Data Plane** | Rust + eBPF | Request processing, high performance |

The Control Plane handles administrative tasks. The Data Plane handles actual traffic with minimal latency.

### Why eBPF?

eBPF allows us to implement rate limiting, observability, and security at the **kernel level**, resulting in:
- 10x better performance than user-space solutions
- Sub-millisecond latency overhead
- Memory footprint < 80MB (vs Kong ~500MB)

### Can I run STOA without Kubernetes?

Yes. While STOA is Kubernetes-native, you can run it:
- **Docker Compose**: For development/testing
- **Standalone binaries**: For edge deployments
- **Kubernetes**: Recommended for production

---

## Security

### How are API keys protected?

API keys are:
1. Stored encrypted in **HashiCorp Vault**
2. Revealed only with **2FA (TOTP)** verification
3. Support **rotation with grace period**
4. Never logged in plain text

### Does STOA support SSO?

Yes. STOA integrates with **Keycloak** for OIDC/SAML authentication. You can connect your existing identity provider (Okta, Azure AD, Google Workspace, etc.).

### What about audit logging?

Every action is logged:
- Tool invocations (who, what, when, parameters)
- Configuration changes
- Authentication events
- Policy decisions

Logs can be exported to your SIEM (Splunk, Elastic, etc.).

---

## Deployment

### What are the infrastructure requirements?

**Minimum (development):**
- 2 CPU cores
- 4GB RAM
- 20GB storage

**Recommended (production):**
- 4+ CPU cores
- 8GB+ RAM
- 50GB+ storage (SSD)
- Kubernetes 1.28+

### Which cloud providers are supported?

STOA runs on any cloud or on-premises:
- **AWS** (reference implementation)
- **GCP**
- **Azure**
- **On-premises** (VMware, bare metal)

### How do I get started?

See our [Quick Start Guide](/docs/guides/quick-start) for a 5-minute setup.

---

## Support

### Where can I get help?

- **Documentation**: You're here! 📚
- **GitHub Issues**: [stoa-platform/stoa](https://github.com/stoa-platform/stoa)
- **Discord**: Coming soon
- **Enterprise Support**: contact@gostoa.dev

### How do I report a security vulnerability?

Please email **security@gostoa.dev** with details. Do not open public issues for security vulnerabilities.

### Can I contribute?

Absolutely! See our [Contributing Guide](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md).
