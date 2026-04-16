---
slug: smb-api-gateway-buying-guide-2026
title: "SMB API Gateway Guide 2026: Find the Right Fit"
description: "Small team, big choices. Feature tables, pricing models, and a decision framework for SMBs evaluating Kong, Gravitee, STOA, and cloud options."
authors: [stoa-team]
tags: [comparison, tutorial, api-gateway]
keywords:
  - API gateway for small business
  - SMB API gateway comparison 2026
  - top API gateway small team
  - open source API gateway SMB
  - API gateway buying guide
  - Kong alternative SMB
  - API gateway cost comparison
---
<!-- last verified: 2026-04 -->

> **Corrections & Updates (2026-04-16)**: An earlier version of this guide included a Total Cost of Ownership table with specific monthly Euro ranges for self-hosted and managed options. Those figures were illustrative but presented with a precision the underlying inputs did not support. This version replaces the table with a qualitative framework and links to each vendor's public pricing page so readers can plug in their own request volumes and infrastructure rates. The qualitative conclusion — self-hosted open source wins at moderate-to-high scale, managed options stay competitive at low volume — is unchanged.

Choosing an API gateway as a small or medium business in 2026 is harder than it should be. Most comparison articles assume you have a dedicated platform team, a six-figure infrastructure budget, and months to spare on evaluation. Most SaaS companies have none of those things.

This buying guide is written for **SMB teams**: typically 5-30 engineers, a product that is live (or nearly live), and a need for production-grade API management without enterprise complexity and enterprise pricing.

<!-- truncate -->

> Feature comparisons in this guide are based on publicly available documentation as of February 2026. Product capabilities change frequently. Verify current features directly with each vendor. All trademarks belong to their respective owners. See our [trademark notice](/docs/legal/trademarks) for details.

## Who This Guide Is For

This guide targets **API-first SaaS products** at the SMB stage:

- You have an API (REST, GraphQL, or emerging MCP for AI agents)
- You need rate limiting, auth, and routing — possibly multi-tenancy
- You want something you can actually run and understand without a dedicated platform team
- You care about cost at your current scale, not hypothetical enterprise pricing

If you are an enterprise with 200+ services and a multi-cloud deployment, this guide is not for you — look at our [API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026) instead.

## The SMB Decision Framework

Before evaluating any specific product, answer these four questions:

**1. Do you need multi-tenancy?**
If your product serves multiple independent customers via your API, you need first-class multi-tenant support. This is a hard requirement that eliminates some options.

**2. Are AI agents a current or near-term requirement?**
If you are building AI features (copilots, agents, MCP integrations), your gateway needs to handle Model Context Protocol traffic. Most traditional gateways added this as a plugin; some are built for it natively.

**3. What is your team's operational capacity?**
A gateway you can run on Kubernetes versus a managed SaaS versus a Docker Compose setup are very different operational commitments. Be honest about your team's bandwidth.

**4. What are your compliance requirements?**
If you handle EU data (GDPR), healthcare data (HIPAA), or financial data (PCI-DSS), your gateway needs audit logging, data residency controls, and access records. Not all options support this out of the box.

## The Candidates

We evaluate five categories of options commonly considered by SMB teams:

| Category | Representative Options | Best For |
|---|---|---|
| **Open-source, self-hosted** | STOA, Kong CE, Gravitee, Tyk | Control, cost, no vendor lock-in |
| **Cloud-native managed** | AWS API Gateway, Azure APIM, GCP Apigee | All-in cloud, simplicity |
| **Reverse proxy + plugins** | nginx + lua, Traefik, Caddy | Lightweight, custom needs |
| **Commercial managed** | Kong Konnect, MuleSoft | Enterprise with budget |
| **Minimal/serverless** | Cloudflare Workers, Vercel Edge | Stateless proxying, edge routing |

For SMB, the realistic field is typically: **STOA, Kong CE, Gravitee, AWS API Gateway, and Cloudflare Workers**. We focus on these five.

## Feature Comparison

<!-- last verified: 2026-02 -->

| Feature | STOA | Kong CE | Gravitee | AWS API Gateway | Cloudflare Workers |
|---|---|---|---|---|---|
| **License** | Apache 2.0 | Apache 2.0 | Apache 2.0 | Proprietary | Proprietary |
| **Self-hosted** | Yes | Yes | Yes | No | Limited (Workers runtime) |
| **Managed SaaS** | Planned | Kong Konnect (paid) | Gravitee Cloud (paid) | Yes (native) | Yes (native) |
| **Multi-tenancy** | Native (namespace isolation) | Plugin-based | Plugin-based | Account-level only | No native multi-tenancy |
| **MCP / AI agent support** | Native | Enterprise plugin only | 4.8+ beta | No | No |
| **Rate limiting** | Per-tenant, per-tier, per-endpoint | Plugin (rate-limiting) | Plans/flows | Stage-level throttling | Service-level rate limiting |
| **OAuth2 / OIDC** | Native + Keycloak integration | Plugin | Plugin | Built-in (Cognito) | Custom implementation |
| **Developer portal** | Included (open-source) | Kong DevPortal (paid) | Gravitee Dev Portal | AWS Marketplace | Not included |
| **Audit logs** | Per-tenant, tamper-evident | Plugin (file/HTTP) | Audit logs | CloudTrail (extra cost) | Workers Logpush (paid) |
| **OpenAPI / Swagger import** | Yes | Yes | Yes | Yes | No |
| **GitOps / CRD support** | Yes (Kubernetes-native) | Deck (declarative) | Partial | No | No |
| **Guardrails / content filtering** | Yes (GuardrailPolicy CRD) | No | No | No | Custom code |
| **Horizontal scaling** | Yes (K8s or standalone) | Yes | Yes | Yes (managed) | Yes (edge-native) |
| **Cold start latency** | None | None | None | ~100ms cold starts | ~0ms (V8 isolates) |
| **Free tier** | Open-source (self-hosted) | Open-source (self-hosted) | Open-source (self-hosted) | 1M req/month free | 100K req/day free |

## Deep Dive: The Four Critical Dimensions for SMBs

### Dimension 1: Operational Complexity

The question is not which gateway has the most features — it is which gateway your team can actually operate.

**STOA**: Runs on Docker Compose for local dev, deploys to Kubernetes for production. The control plane (including the developer portal and admin UI) comes as a single Helm chart. For a team that already runs Kubernetes, this is familiar territory. For a team without K8s experience, there is a learning curve.

**Kong CE**: Mature, well-documented, large community. DB-less mode (declarative config via Kong Deck) is SMB-friendly — no database dependency. The plugin ecosystem is extensive. Enterprise features (developer portal, RBAC, audit logs) require Kong Konnect (paid SaaS).

**Gravitee**: Strong management UI out of the box. More complex initial setup than Kong — requires MongoDB and Elasticsearch alongside the gateway. Worth the investment if you need a polished developer portal included in the open-source tier.

**AWS API Gateway**: Zero operational overhead if you are already on AWS. No servers to manage. The trade-off is cost at scale (per-request pricing adds up quickly) and AWS lock-in. Limited multi-tenancy and no MCP support.

**Cloudflare Workers**: Excellent for stateless edge routing and simple API proxying. Not a full API gateway — no developer portal, no multi-tenancy, no audit logs. Often used as a CDN/edge layer in front of a dedicated API gateway.

### Dimension 2: Multi-Tenancy

If your SaaS serves multiple customers via a shared API infrastructure, multi-tenancy is a hard requirement. Test it before you commit.

**STOA** has native multi-tenancy at its core. Tenant namespaces, per-tenant UAC contracts, per-tenant Keycloak realms, and per-tenant GuardrailPolicies are the defaults, not add-ons. This makes it the strongest option in this dimension for SMBs building B2B SaaS.

**Kong CE** can implement multi-tenancy via the workspace plugin (Enterprise feature) or by carefully organizing services and routes per tenant. It is achievable but not the default — it requires deliberate architecture work.

**Gravitee** supports multi-tenancy through environment separation and API visibility rules. Gravitee offers more built-in multi-tenancy than Kong CE out of the box, though not as deep as STOA's namespace model.

**AWS API Gateway** has no native multi-tenancy concept below the AWS account level. You can implement tenant separation at the application layer, but the gateway itself is not tenant-aware.

### Dimension 3: AI/MCP Support

If you are building AI-powered features in 2026, your gateway needs to route, authenticate, and rate-limit MCP traffic. This is increasingly a non-negotiable requirement for developer-facing SaaS products.

**STOA** was built with MCP as a primary concern. MCP tool registration, per-tenant tool allowlists, AI guardrails (content filtering, PII redaction), and MCP-native rate limiting are all first-class features. For teams building AI-first products, this is the strongest option.

**Kong CE** added MCP support in Kong Gateway 3.12 (October 2025) via an `ai-mcp-proxy` plugin. As of early 2026, the plugin is Enterprise-only. The OSS Kong CE tier does not include MCP support.

**Gravitee** released MCP support in version 4.8 (early 2026, beta). Still maturing, but shows commitment from the Gravitee team.

**AWS API Gateway and Cloudflare Workers** have no native MCP support. Custom implementation is possible but requires significant engineering effort.

### Dimension 4: Total Cost of Ownership

"Free" open-source software is never actually free — you pay in engineering time and operational complexity. "Managed" SaaS appears simple but costs grow quickly with scale. Rather than give you a single TCO number that will be wrong for your situation, here is the cost shape for each option and where to source the numbers yourself.

**Self-hosted options (STOA, Kong CE, Gravitee)** — your cost is one or two Kubernetes nodes plus supporting infrastructure. Size your nodes against real traffic and price them with your cloud's official calculator:

- [AWS Pricing Calculator](https://calculator.aws/) for EKS + EC2
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator) for GKE
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for AKS

Gravitee's stack includes a mandatory Elasticsearch cluster for analytics, so a Gravitee self-hosted deployment adds an Elasticsearch node pool on top of the gateway nodes — expect a higher node count than STOA or Kong CE for the same throughput. See [Gravitee architecture docs](https://documentation.gravitee.io/apim/overview/architecture) for the required components.

**Managed options (AWS API Gateway, Cloudflare Workers, Kong Konnect)** — cost is per-request or subscription-based and published by the vendor:

- [AWS API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/) — REST, HTTP, and WebSocket tiers
- [Cloudflare Workers pricing](https://www.cloudflare.com/plans/developer-platform/) — free tier plus per-million-request pricing
- [Kong Konnect pricing](https://konghq.com/pricing) — tiered SaaS plans, Enterprise contact sales

The qualitative shape: self-hosted cost grows roughly with node count (sub-linear with traffic once you scale past a single node), while per-request managed pricing grows linearly. The break-even point where self-hosted becomes cheaper depends on your loaded engineer cost, your team's Kubernetes familiarity, and the specific managed tier you would buy — for most SMB SaaS teams already running Kubernetes it lands well inside the volumes covered in this guide. Teams without platform engineering capacity should weight managed options higher even if the raw per-request cost is higher.

*Pricing pages linked above are the primary sources. Named product comparisons are based on publicly available documentation as of April 2026. Verify current pricing directly with each vendor.*

## Our Recommendation by Profile

### Profile A: "B2B SaaS, multi-tenant, 5-15 engineers, Kubernetes already in use"

**Recommendation: STOA**

You need multi-tenancy, you already operate Kubernetes, and you may be adding AI features to your product. STOA's native multi-tenancy, MCP support, and GitOps-first architecture align well with this profile. The Helm chart is the fastest path to production.

Start with the [Docker Compose quickstart](/blog/mcp-gateway-quickstart-docker) for local development, then deploy to K8s via the Helm chart.

### Profile B: "Developer API product, no multi-tenancy needed, team already knows Kong"

**Recommendation: Kong CE**

If your team already has Kong experience and multi-tenancy is not a requirement, Kong CE is the pragmatic choice. The ecosystem is mature, documentation is excellent, and you can always upgrade to Kong Konnect later. Use Kong Deck for declarative config management.

### Profile C: "All-in on AWS, want zero ops, cost is not the primary concern"

**Recommendation: AWS API Gateway**

The zero-operational-overhead argument is real. If your entire stack is on AWS and you are not hitting the point where per-request pricing becomes painful, AWS API Gateway's simplicity is worth the cost and the lock-in.

### Profile D: "API product with a polished developer portal as a key differentiator"

**Recommendation: Gravitee**

Gravitee's management UI and developer portal are notably polished for an open-source product. If the developer portal is a key part of your product experience and you do not need deep multi-tenancy or MCP support today, Gravitee is worth the additional Elasticsearch dependency.

### Profile E: "Stateless edge proxying, no need for a full gateway stack"

**Recommendation: Cloudflare Workers**

If your use case is primarily routing, edge caching, and basic auth — with no developer portal, no multi-tenancy, no audit logs — Cloudflare Workers is fast and cheap. Treat it as a CDN/edge layer, not a full API management platform.

## Decision Checklist

Before committing, run through this checklist:

- [ ] **Multi-tenancy required?** If yes, evaluate STOA and Gravitee first
- [ ] **MCP/AI agents in roadmap?** If yes, STOA is currently the strongest OSS option
- [ ] **Team has K8s experience?** If yes, self-hosted OSS is viable; if no, evaluate managed options
- [ ] **Developer portal needed?** Factor in Gravitee and Kong Konnect (paid)
- [ ] **Compliance requirements (GDPR, HIPAA)?** Confirm audit log and data residency support
- [ ] **Budget for 2 years at current scale?** Run the TCO numbers — managed SaaS cost grows faster than self-hosted
- [ ] **Migration path?** If you might outgrow this choice, prefer OSS with a clear upgrade path

## Getting Started with STOA

If STOA matches your profile, the fastest path to evaluation is:

```bash
# Clone the quickstart
git clone https://github.com/stoa-platform/stoa-quickstart.git
cd stoa-quickstart

# Start the full stack (gateway + control plane + portal + auth)
docker compose up -d

# Open the console
open http://localhost:3001
```

Full setup guide: [Docker Compose Local Development](/blog/stoa-docker-compose-local-development).

For a comparison of STOA specifically against Kong: [STOA vs Kong](/blog/stoa-vs-kong).

For the full SaaS Playbook series, start with [Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101).

## FAQ

### Is STOA production-ready for SMBs?

STOA reached its first production release (v0.1.0) in February 2026. It is running in production at early-adopter companies. As an Apache 2.0 open-source project, you can audit the code, fork it, and run it without vendor lock-in. That said, it is newer than Kong or Gravitee — evaluate based on your risk tolerance.

### Can I migrate from AWS API Gateway to a self-hosted option later?

Yes, but plan for it. AWS API Gateway uses AWS-specific features (Lambda integrations, Cognito auth, CloudWatch logging) that do not map directly to any other gateway. Budget for migration work proportional to how deeply you have used AWS-native features.

### Which open-source API gateway has the largest community?

Kong has the largest open-source community as of early 2026, followed by Gravitee and STOA. Community size matters for plugin availability, Stack Overflow answers, and ecosystem maturity. If this is a priority, Kong CE has a meaningful head start.

### Does STOA work without Kubernetes?

Yes. STOA Gateway can run in standalone mode via Docker Compose. The Kubernetes deployment is recommended for production (for HA and scaling), but is not required for evaluation or smaller deployments.

### What happens to my data if I start with STOA and decide to switch later?

STOA uses standard formats throughout: OpenAPI specs for API definitions, JWT/OAuth2 for auth, PostgreSQL for the control plane database. Your API definitions are portable. Your auth configuration can be exported from Keycloak. There is no proprietary data format lock-in.
