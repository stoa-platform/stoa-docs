---
slug: saas-playbook-build-vs-buy-api-gateway
title: "Build vs Buy: The True Cost of Your API Gateway Decision"
description: "Honest cost analysis of building vs buying an API gateway for SaaS. Compares engineering cost, maintenance burden, and hidden costs of DIY vs STOA vs managed solutions."
authors: [stoa-team]
tags: [tutorial, comparison, api-gateway]
unlisted: true
keywords:
  - build vs buy API gateway
  - API gateway cost analysis SaaS
  - API gateway ROI
  - total cost of ownership API gateway
  - DIY API gateway cost
  - API gateway engineering cost
  - open source API gateway cost benefit
---
<!-- last verified: 2026-02 -->

"We can build that ourselves in a sprint." We have all said it. Sometimes it is true. For most infrastructure decisions, it is not — especially for API gateways, where the scope of what "that" means expands significantly once you are in production.

This is the final installment of the **SaaS Playbook** series. We have covered [multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101), [rate limiting](/blog/saas-playbook-2-rate-limiting-saas), [audit logging](/blog/saas-playbook-3-audit-compliance), [scaling](/blog/saas-playbook-4-scaling-multi-tenant), and [production readiness](/blog/saas-playbook-5-production-checklist). Now we tackle the meta-question: should you have built all of this yourself?

<!-- truncate -->

> This analysis uses publicly available information about software development costs, engineering salaries, and infrastructure pricing. All named product comparisons are based on publicly available documentation as of February 2026. Costs are illustrative ranges — actual costs depend heavily on your specific situation. See our [trademark notice](/docs/trademarks) for details on third-party product references.

## The Build vs Buy Decision Framework

The question is not "can we build it?" — you almost certainly can. The question is "should we?" which requires understanding three things:

1. **What is the full scope of what you are building?** (Most teams underestimate this)
2. **What is the true cost over a 3-year horizon?** (Initial build is not the only cost)
3. **What is the opportunity cost?** (What would your engineers build instead?)

## The Scope Problem: What Does "API Gateway" Actually Mean?

When teams decide to build their own gateway, they typically plan for:
- HTTP proxying (route requests to backends)
- Authentication (validate JWT tokens)
- Rate limiting (basic request counting)

What they discover in production, 6-18 months later:
- Multi-tenancy (tenant isolation, per-tenant config, CRDs)
- Audit logging (compliance evidence, GDPR support, tamper-proofing)
- Developer portal (documentation, API key self-service, subscription management)
- Rate limiting sophistication (burst handling, per-endpoint limits, tier management)
- Observability (per-tenant metrics, distributed tracing, latency percentiles)
- MCP/AI agent support (new requirement as AI features are added)
- Performance at scale (caching, connection pooling, horizontal scaling)
- Security (OAuth2 DCR, PKCE, mTLS, token rotation)
- GitOps support (declarative config, version control, rollback)
- Incident response tooling (traffic replay, circuit breakers, graceful degradation)

Each of these items is a month-to-quarter-long engineering effort. The cumulative scope is large.

## Three-Year Cost Model

### Option A: Full Custom Build

**Year 1: Initial Build**

| Task | Engineering Weeks | Cost (€800/day senior engineer) |
|---|---|---|
| HTTP proxying + routing | 3 | €12,000 |
| JWT authentication | 2 | €8,000 |
| Basic rate limiting | 2 | €8,000 |
| Multi-tenancy foundation | 4 | €16,000 |
| Developer portal (basic) | 6 | €24,000 |
| Audit logging | 3 | €12,000 |
| Observability | 3 | €12,000 |
| Load testing + hardening | 2 | €8,000 |
| **Year 1 build total** | **25 weeks** | **€100,000** |

**Year 1: Infrastructure**
- 2x m5.xlarge instances (prod + staging): ~€300/month → €3,600/year
- PostgreSQL RDS: ~€150/month → €1,800/year
- **Year 1 infrastructure**: ~€5,400

**Year 1 total: ~€105,400**

**Year 2: Maintenance + Enhancements**

| Task | Engineering Weeks | Cost |
|---|---|---|
| Security patches + CVE remediation | 4 | €16,000 |
| MCP/AI agent support (new requirement) | 6 | €24,000 |
| Performance improvements | 3 | €12,000 |
| Compliance additions (SOC 2 prep) | 4 | €16,000 |
| Bug fixes and incident response | 3 | €12,000 |
| **Year 2 engineering** | **20 weeks** | **€80,000** |

**Year 2 infrastructure**: ~€7,200 (scaled)
**Year 2 total: ~€87,200**

**Year 3: Ongoing Maintenance**

| Task | Engineering Weeks | Cost |
|---|---|---|
| Security patches | 3 | €12,000 |
| New compliance requirements | 3 | €12,000 |
| Feature parity with commercial alternatives | 4 | €16,000 |
| Refactoring accumulated technical debt | 4 | €16,000 |
| On-call incidents | 2 | €8,000 |
| **Year 3 engineering** | **16 weeks** | **€64,000** |

**Year 3 infrastructure**: ~€9,000
**Year 3 total: ~€73,000**

**3-Year Custom Build Total: ~€265,600**

This estimate assumes:
- One dedicated senior engineer (€800/day) at 50% allocation over 3 years
- No major security incidents (which add significant cost)
- No compliance failures (which can be very expensive)
- Reasonable stability in requirements (which rarely holds)

### Option B: Open-Source Self-Hosted (STOA or Kong CE)

**Year 1: Initial Setup**

| Task | Engineering Weeks | Cost |
|---|---|---|
| Deployment + configuration | 1 | €4,000 |
| Authentication integration (Keycloak) | 1 | €4,000 |
| Multi-tenancy configuration | 1 | €4,000 |
| Developer portal customization | 1 | €4,000 |
| Observability integration | 0.5 | €2,000 |
| Load testing + validation | 1 | €4,000 |
| **Year 1 setup** | **5.5 weeks** | **€22,000** |

**Year 1 infrastructure**:
- K8s cluster (2 nodes: 4 CPU / 16 GB): ~€200/month → €2,400/year
- PostgreSQL: ~€80/month → €960/year
- **Year 1 infrastructure**: ~€3,360

**Year 1 total: ~€25,360**

**Year 2: Ongoing Operations**

| Task | Engineering Weeks | Cost |
|---|---|---|
| Upgrade management | 1 | €4,000 |
| New feature adoption (MCP, guardrails) | 1 | €4,000 |
| Incident response | 1 | €4,000 |
| **Year 2 engineering** | **3 weeks** | **€12,000** |

**Year 2 infrastructure**: ~€4,000 (with scaling)
**Year 2 total: ~€16,000**

**Year 3: Steady State**

| Task | Engineering Weeks | Cost |
|---|---|---|
| Upgrades + maintenance | 2 | €8,000 |
| **Year 3 engineering** | **2 weeks** | **€8,000** |

**Year 3 infrastructure**: ~€5,000
**Year 3 total: ~€13,000**

**3-Year OSS Self-Hosted Total: ~€54,360**

### Option C: Managed SaaS Gateway (Cloud-Native)

Using AWS API Gateway (or equivalent managed service) at moderate scale:

| Year | API Calls | Cost per Million | Annual Cost | Engineering | Total |
|---|---|---|---|---|---|
| Year 1 | 100M calls | $3.50/million | ~€350 | €10,000 (setup) | ~€10,350 |
| Year 2 | 500M calls | $3.50/million | ~€1,750 | €5,000 (maintenance) | ~€6,750 |
| Year 3 | 2B calls | $3.50/million | ~€7,000 | €5,000 | ~€12,000 |

**3-Year Managed SaaS Total: ~€29,100** (at this scale)

At higher scale (10B+ calls/year), managed SaaS becomes significantly more expensive than self-hosted. The break-even point between managed SaaS and OSS self-hosted is typically around 500M-1B API calls/month, depending on request size and regional pricing.

## The 3-Year Summary

| Option | 3-Year Cost | Engineering Hours | Vendor Lock-in | MCP Support | Multi-tenancy |
|---|---|---|---|---|---|
| Custom Build | ~€265,600 | ~1,220h | None | Custom (extra cost) | Custom (extra cost) |
| OSS Self-Hosted | ~€54,360 | ~165h | None | Included (STOA) | Included (STOA) |
| Managed SaaS (low scale) | ~€29,100 | ~100h | High | Limited | Limited |
| Managed SaaS (high scale) | ~€200,000+ | ~100h | High | Limited | Limited |

## The Hidden Costs

The table above still underestimates the real cost of custom builds in several ways.

### On-Call Cost

Your custom gateway will have incidents. An on-call rotation for a custom gateway means your engineers are carrying a pager for infrastructure they built and must understand deeply. A 4-person on-call rotation at P3 escalations averages 3-5 incidents per month in year 2. Each incident costs 2-4 engineering hours. That is 60-180 hours/year in incident response alone.

Open-source gateways have community support, commercial support options, and large knowledge bases. Your custom gateway has your team.

### Security Debt Cost

Security vulnerabilities in API gateways are high severity. A missed JWT validation bug, a path traversal in routing logic, or a SSRF vulnerability in upstream proxying can be catastrophic. Security audit of a custom gateway costs €15,000-40,000 from an external firm. Finding a critical vulnerability in production costs much more.

Open-source gateways have continuous security scrutiny from their communities. Custom gateways have as much security scrutiny as you give them.

### Compliance Audit Cost

When your first enterprise customer asks for a SOC 2 Type II report, your auditor will review your API gateway architecture. A custom gateway means explaining and evidencing every security control from scratch. An established open-source gateway with documented security architecture reduces this work significantly. The marginal cost of auditing a custom gateway vs an established open-source one is €5,000-20,000 per audit cycle.

### Opportunity Cost

The biggest hidden cost is what your team did not build while they were building a gateway. For most SaaS companies, an API gateway is infrastructure — it is not your competitive advantage. Every week spent building gateway features is a week not spent building the product features that drive your business.

## When Custom Makes Sense

Despite the cost analysis above, there are scenarios where a custom gateway is the right choice:

**When the gateway IS the product**: If your company is building an API management platform (like STOA itself), building a gateway is core to your value proposition, not a distraction from it.

**When your requirements are genuinely unusual**: Some industries or use cases have requirements that no existing gateway handles well. Before concluding this, be sure to actually evaluate existing options thoroughly.

**When regulatory requirements prohibit third-party software**: Some regulated industries require software with specific certifications or supply chain controls that rule out open-source or commercial options.

**When you need integration with a proprietary internal platform**: Some large enterprises have internal infrastructure that requires deep custom integration.

For most early-to-mid-stage SaaS companies, none of these conditions apply.

## The Recommendation

The cost analysis points clearly: for most SaaS companies, an open-source self-hosted gateway delivers the best balance of total cost, flexibility, and engineering leverage.

The key decision factors:
- **Scale < 500M req/month**: Managed SaaS is cheapest and simplest
- **Scale > 500M req/month or multi-tenancy required**: OSS self-hosted is the optimal choice
- **Enterprise compliance requirements or MCP/AI agents**: OSS self-hosted (STOA specifically) has the strongest feature set
- **Custom build**: Rarely optimal unless the gateway is your product

For the calculation that makes sense for your specific situation, work through the models above with your actual request volume, engineer hourly rate, and compliance requirements.

## Completing the SaaS Playbook

This concludes the SaaS Playbook series:

1. **[Part 1: Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101)** — Isolate your tenants without losing your mind
2. **[Part 2: Rate Limiting Strategies](/blog/saas-playbook-2-rate-limiting-saas)** — Per-tenant quotas, burst handling, API key tiers
3. **[Part 3: Audit & Compliance](/blog/saas-playbook-3-audit-compliance)** — Immutable logs, GDPR, SOC 2
4. **[Part 4: Scaling Multi-Tenant APIs](/blog/saas-playbook-4-scaling-multi-tenant)** — From 50 to 5000 tenants
5. **[Part 5: Production Checklist](/blog/saas-playbook-5-production-checklist)** — 20 gates before you go live
6. **Build vs Buy Analysis** — This article

Also in this series: **[SMB API Gateway Buying Guide 2026](/blog/smb-api-gateway-buying-guide-2026)** — A feature comparison for teams evaluating options.

Ready to start? The fastest path to a production-ready multi-tenant API gateway: [STOA Docker Compose Quickstart](/blog/mcp-gateway-quickstart-docker).

## FAQ

### Is open-source really "free"?

No. Open source eliminates software licensing costs but not infrastructure costs, engineering time for deployment and maintenance, or support costs. The cost analysis above accounts for this. OSS self-hosted is cheaper than custom build or managed SaaS at most scales because the engineering investment is much smaller — you are configuring and operating software, not building it.

### How accurate are the engineering cost estimates?

The estimates use €800/day as a loaded senior engineer cost in Western Europe. Your actual cost depends on location, seniority mix, and whether you use contractors or employees. Use them as directional guidance, not precise predictions. The relative costs between options are more reliable than the absolute numbers.

### What if we start with a custom build and switch later?

Switching from a custom gateway to OSS has a migration cost (typically 2-6 weeks of engineering) but is almost always the right long-term decision if the custom gateway has grown to non-trivial complexity. The main risk: custom gateways accumulate business logic (custom auth flows, proprietary routing rules) that is expensive to migrate. The earlier you make the switch, the lower the migration cost.

### Does this analysis account for commercial open-source (BSL license) gateways?

No. Some gateways that appear open-source use the Business Source License (BSL) or similar licenses that restrict commercial use. STOA and Kong CE are Apache 2.0 licensed — genuinely open source with no commercial restrictions. Always verify the license before committing to an OSS option. For our reasoning on Apache 2.0 specifically, see [Why Apache 2.0 and Not BSL](/blog/why-apache-2-not-bsl).
