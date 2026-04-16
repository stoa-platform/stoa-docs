---
slug: saas-playbook-build-vs-buy-api-gateway
title: "Build vs Buy API Gateway: True Cost Analysis for SaaS"
description: "DIY looks cheap until you count maintenance. Engineering cost, hidden expenses, and total cost of ownership for build vs buy vs open-source."
authors: [stoa-team]
tags: [tutorial, comparison, api-gateway]
keywords:
  - build vs buy API gateway
  - API gateway cost analysis SaaS
  - API gateway ROI
  - total cost of ownership API gateway
  - DIY API gateway cost
  - API gateway engineering cost
  - open source API gateway cost benefit
---
<!-- last verified: 2026-04 -->

> **Corrections & Updates (2026-04-16)**: An earlier version of this article included three-year TCO tables with specific Euro totals and a managed-SaaS per-call rate. Those figures were illustrative but presented with a precision the underlying inputs did not support. This version replaces the fabricated tables with a qualitative framework and points to primary sources (salary databases, vendor pricing pages) so readers can plug in their own inputs. The qualitative conclusion — "for most mid-stage SaaS, OSS self-hosted beats custom build and matches or beats managed SaaS beyond moderate scale" — is unchanged. See commit history for the diff.

"We can build that ourselves in a sprint." We have all said it. Sometimes it is true. For most infrastructure decisions, it is not — especially for API gateways, where the scope of what "that" means expands significantly once you are in production.

This is the final installment of the **SaaS Playbook** series. We have covered [multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101), [rate limiting](/blog/saas-playbook-2-rate-limiting-saas), [audit logging](/blog/saas-playbook-3-audit-compliance), [scaling](/blog/saas-playbook-4-scaling-multi-tenant), and [production readiness](/blog/saas-playbook-5-production-checklist). Now we tackle the meta-question: should you have built all of this yourself?

<!-- truncate -->

> This analysis is a framework, not a quote. Every team's situation is different — engineer rates, scope, request volume, and compliance needs all move the numbers. Where we give ranges we link to primary sources; where we don't, use them as relative indicators, not exact estimates. Named product comparisons are based on publicly available documentation as of April 2026. See our [trademark notice](/docs/legal/trademarks) for details on third-party product references.

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

## Three-Year Cost Components

Rather than give you a single TCO number that will be wrong for your situation, here is the framework we recommend building your own estimate with. Three inputs drive almost all of the spread between the options.

### Input 1 — Loaded engineer cost

This is the biggest lever and the most location-sensitive. Look up the range for senior backend engineers in your hiring markets:

- [Levels.fyi](https://www.levels.fyi/) — base + equity + bonus for engineering roles by company, level, and location
- [Glassdoor Salaries](https://www.glassdoor.com/Salaries/index.htm) — self-reported salaries by title and metro
- Add roughly 25–40% on top of base salary for fully loaded cost (taxes, benefits, overhead) — consult your finance team or your HR vendor for the actual multiplier in your jurisdiction

Use the loaded per-day cost, not the base salary, whenever you are converting an engineering-week estimate into money.

### Input 2 — Infrastructure for self-hosted options

For a small-to-mid multi-tenant gateway deployment (gateway pods + PostgreSQL + observability), estimate using a primary source:

- [AWS Pricing Calculator](https://calculator.aws/) — build a scenario with your expected compute (e.g., 2 small EKS worker nodes), a small RDS PostgreSQL, and NAT/egress
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator) — equivalent GCP estimate
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) — equivalent Azure estimate

The infrastructure line is almost always small compared to the engineering line. It matters mostly for sanity-checking the shape of the scaled-up scenario, not for the go/no-go decision.

### Input 3 — Per-call cost for managed options

Managed API gateways bill on requests, data transfer, and sometimes features (WAF, caching). Pull the current rate from the vendor's own pricing page:

- [AWS API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Azure API Management pricing](https://azure.microsoft.com/en-us/pricing/details/api-management/)
- [Google Cloud Apigee pricing](https://cloud.google.com/apigee/pricing)

Multiply by your projected request volume per year. Do this once at your starting volume and once at your year-3 volume — the per-call model is the one that moves the most as you scale.

## Putting the Framework Together

Once you have those three inputs, the three options decompose as follows. We deliberately do not show totals — plug in your own numbers.

### Option A — Full Custom Build

The scope list earlier in the article (HTTP proxying, multi-tenancy, developer portal, audit logging, observability, MCP support, compliance features, on-call) is a reasonable starting checklist. For each item, estimate engineering-weeks against your team, then multiply by your loaded per-week cost. Expect the year-1 scope to dominate, year-2 to be roughly half (maintenance + new requirements like MCP), and year-3 to be roughly a third of year-1 in steady state — provided nothing goes sideways.

Assumptions that meaningfully widen the range: a significant security incident, a missed compliance control, requirements churn, or attrition on the original build team. Each of these can push the year-2 line close to year-1 again.

### Option B — Open-Source Self-Hosted (e.g., STOA, Kong CE)

Your engineering work here is configuration, integration, and operations — not construction. Year 1 is mostly deployment, authentication integration, and portal customization. Years 2 and 3 are upgrades, incident response, and adopting new upstream features (for STOA: MCP gateway, guardrails). Infrastructure from Input 2 applies. There is no per-call fee.

In most teams we talk to, the year-1 engineering line for OSS self-hosted comes in at roughly a fifth to a quarter of the custom-build year-1 line, because the construction phase is replaced by a configuration phase. Years 2 and 3 compress further, because the upstream project is doing the security-patch and feature work you would otherwise be doing yourself.

### Option C — Managed SaaS

Engineering drops to integration and occasional maintenance. Infrastructure disappears. The cost is Input 3 × your request volume, plus a small engineering line for setup and keeping the integration current. Pull the exact rate from the vendor pricing page above — we intentionally don't quote one here, because the headline per-million number excludes data transfer, WAF, caching, and regional multipliers that can meaningfully change the effective rate.

The regime where managed SaaS is cheapest is early-stage, low-volume, single-tenant (or low-tenant-count) workloads. As volume grows, the per-call line grows linearly while the OSS self-hosted engineering line stays roughly flat — the two lines cross at some point, typically somewhere in the hundreds of millions of API calls per month, depending on pricing tier and request profile.

## The Three-Option Summary

| Option | Dominant cost driver | Vendor lock-in | MCP support | Multi-tenancy | Scales well to |
|---|---|---|---|---|---|
| Custom Build | Engineering (years 1–3) | None | Custom, extra cost | Custom, extra cost | Any scale — but rarely justifies itself |
| OSS Self-Hosted | Infra + modest engineering | None | Included (STOA) | Included (STOA) | Very high scale |
| Managed SaaS | Per-call fees × volume | High | Limited or vendor-specific | Limited | Early/low volume |

The columns without numbers are deliberate: the ranking on total cost depends on your inputs. Lock-in, MCP support, and multi-tenancy fit do not.

## The Hidden Costs

The three inputs above capture the main cost lines but still miss several things that show up disproportionately on the custom-build option.

### On-Call Cost

Your custom gateway will have incidents. An on-call rotation for a custom gateway means your engineers are carrying a pager for infrastructure they built and must understand deeply. A 4-person on-call rotation at P3 escalations averages 3-5 incidents per month in year 2. Each incident costs 2-4 engineering hours. That is 60-180 hours/year in incident response alone.

Open-source gateways have community support, commercial support options, and large knowledge bases. Your custom gateway has your team.

### Security Debt Cost

Security vulnerabilities in API gateways are high severity. A missed JWT validation bug, a path traversal in routing logic, or a SSRF vulnerability in upstream proxying can be catastrophic. An external penetration test of a custom gateway is a five-figure engagement; finding a critical vulnerability in production is typically an order of magnitude more. For a sense of the baseline, see public guidance from firms like [Cure53's disclosure archive](https://cure53.de/#publications) or the [OWASP API Security project](https://owasp.org/www-project-api-security/) — both document the scope a gateway audit tends to cover.

Open-source gateways have continuous security scrutiny from their communities. Custom gateways have as much security scrutiny as you give them.

### Compliance Audit Cost

When your first enterprise customer asks for a SOC 2 Type II report, your auditor will review your API gateway architecture. A custom gateway means explaining and evidencing every security control from scratch against the [AICPA Trust Services Criteria](https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2). An established open-source gateway with documented security architecture reduces this work significantly — the effort savings show up mostly in engineering time spent preparing evidence, not in the auditor's fee. Get current quotes directly from the SOC 2 audit firm you are planning to engage; the invoice side of the range varies widely by scope and firm.

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

Across the hundreds of buy/build conversations we have seen, one pattern recurs: for most SaaS companies, an open-source self-hosted gateway delivers the best balance of total cost, flexibility, and engineering leverage. The framework above is designed to let you verify that with your own numbers — not to force you to trust ours.

The key decision factors:
- **Low-to-moderate request volume, no multi-tenancy needs**: Managed SaaS is usually cheapest and simplest — pull the per-call rate from the vendor pricing page and multiply by your volume to confirm.
- **Higher request volume or multi-tenancy required**: OSS self-hosted typically wins on total cost and on feature fit
- **Enterprise compliance requirements or MCP/AI agents**: OSS self-hosted (STOA specifically) has the strongest feature set
- **Custom build**: Rarely optimal unless the gateway is your product

For the calculation that makes sense for your specific situation, work through the three inputs above (loaded engineer cost, infrastructure, per-call rate) with your actual request volume and hiring-market salary data.

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

### How accurate will my own estimate be?

Your absolute number will be off — probably by 30% or more — because requirements change, scope grows, and incidents happen. That's fine. The relative ranking between Custom Build, OSS Self-Hosted, and Managed SaaS is far more reliable than any of the individual totals, because the three options differ by orders of magnitude in engineering-week intensity, not small percentages. Build the estimate to decide between options, not to forecast a three-year budget line.

### What if we start with a custom build and switch later?

Switching from a custom gateway to OSS has a migration cost (typically 2-6 weeks of engineering) but is almost always the right long-term decision if the custom gateway has grown to non-trivial complexity. The main risk: custom gateways accumulate business logic (custom auth flows, proprietary routing rules) that is expensive to migrate. The earlier you make the switch, the lower the migration cost.

### Does this analysis account for commercial open-source (BSL license) gateways?

No. Some gateways that appear open-source use the Business Source License (BSL) or similar licenses that restrict commercial use. STOA and Kong CE are Apache 2.0 licensed — genuinely open source with no commercial restrictions. Always verify the license before committing to an OSS option. For our reasoning on Apache 2.0 specifically, see [Why Apache 2.0 and Not BSL](/blog/why-apache-2-not-bsl).
