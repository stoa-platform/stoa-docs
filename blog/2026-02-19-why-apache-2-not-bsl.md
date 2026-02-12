---
unlisted: true
slug: why-apache-2-not-bsl
title: "Why We Chose Apache 2.0 (And What We Think About BSL)"
authors: [christophe]
tags: [open-source, community, education]
description: "The business case for true open source. Why STOA chose Apache 2.0 over BSL, SSPL, or dual-licensing — and why it matters for your stack decisions."
keywords: [apache 2.0 license, BSL license, open source license comparison, SSPL vs Apache, open core, open source business model, vendor lock-in, source available, true open source]
---
<!-- last verified: 2026-02 -->

# Why We Chose Apache 2.0 (And What We Think About BSL)

In 2024, HashiCorp switched Terraform from MPL to BSL. In 2023, Redis moved from BSD to SSPL. Elastic, MongoDB, CockroachDB — all followed the same playbook: build community with open source, then change the license when the business needs it.

We understand why they did it. We chose a different path anyway.

STOA Platform is licensed under **Apache 2.0** — one of the most permissive open-source licenses that exists. No source-available tricks. No "open core" where the useful features are paywalled. No license change planned for when we hit a revenue target.

Here's why — and why this matters for every developer choosing an [open-source API gateway](/blog/open-source-api-gateway-2026) today.

<!-- truncate -->

## The License Switch Playbook

The pattern is now familiar:

1. **Launch as open source** — attract contributors, build community, gain adoption
2. **Grow into enterprises** — large companies adopt the project, often without paying
3. **Discover the cloud problem** — AWS/GCP/Azure offer the project as a managed service, capturing revenue
4. **Switch the license** — BSL, SSPL, or dual-license to block cloud providers
5. **Community fractures** — OpenTofu (from Terraform), Valkey (from Redis), OpenSearch (from Elasticsearch)

The business logic is sound: if Amazon makes more money from your project than you do, something is broken. We sympathize with that position.

But the license switch has consequences that go far beyond cloud providers.

## Who Actually Gets Hurt

When a project switches from open source to BSL/SSPL, the loudest complaints come from cloud providers. But they're not the ones who suffer most.

**Freelancers and consultants** built businesses around deploying and customizing these tools. BSL restrictions now limit how they can offer managed services to their clients.

**Small companies** who chose the tool *because* it was open source now face legal uncertainty. Can they still self-host? Can they offer it as part of their platform? The BSL fine print varies.

**Contributors** who donated code, documentation, and bug reports to the community edition now find their work locked behind a commercial license they didn't agree to.

**Competitors and forks** spring up (OpenTofu, Valkey), fragmenting the ecosystem and creating confusion about which version to use.

The intended target was AWS. The actual casualties are the community.

## What Apache 2.0 Actually Means

Apache 2.0 is simple:

- **Use it** for any purpose, including commercial
- **Modify it** however you want
- **Distribute it** — modified or unmodified
- **Patent grant** — contributors grant patent rights (protects users from patent lawsuits)
- **No copyleft** — you don't have to open-source your modifications
- **Attribution** — keep the license notice and NOTICE file

That's it. No restrictions on how you deploy it. No restrictions on selling services around it. No restrictions on cloud providers offering it as a service.

## "But What About AWS?"

This is the question everyone asks. If STOA is Apache 2.0, what stops Amazon from launching "AWS STOA Gateway" and eating our lunch?

The honest answer: nothing, legally. The same thing that stops them from doing it to every Apache 2.0 project.

The practical answer: **it doesn't matter**, for several reasons.

### 1. Trademark Protection

The name "STOA", the logo, and the brand are trademarked. Amazon can fork the code, but they can't call it STOA. They'd have to rebrand and maintain their own fork — which is expensive and diverges quickly.

This is exactly what happened with Kubernetes (Google trademark, adopted by CNCF), Envoy (Lyft trademark), and countless other projects. The brand has value independent of the code.

### 2. The Ecosystem Moat

STOA's value isn't just the gateway binary. It's the control plane, the developer portal, the console, the CLI, the Helm charts, the documentation, the ADRs, the community. Forking the code doesn't fork the ecosystem.

The projects that got "AWSed" were single-binary tools (Redis, Elasticsearch). STOA is a platform with multiple integrated components. Forking one piece breaks the integration.

### 3. Enterprise Is the Business

STOA's revenue model isn't "charge for the software." It's:

- **Enterprise support** — SLAs, dedicated support, production troubleshooting
- **Managed service** (future) — we run it for you
- **Certification and training** — official STOA certification
- **Custom integrations** — enterprise-specific adapters and connectors

None of these are threatened by a code fork. You can't fork a support contract.

### 4. We're Not Big Enough to AWS

Let's be honest: AWS copies projects that have massive adoption and a clear managed-service revenue opportunity. STOA is a pre-revenue open-source project. We'd be honored if AWS thought we were worth copying — it would mean we've made it.

If that day comes, we'll compete on ecosystem, support, and speed of innovation. Not on license restrictions.

## The Trust Problem

Here's the deeper issue: **license switches destroy trust**.

When a project changes its license, every user and contributor learns a lesson: *the license can change at any time*. Even if the new license is reasonable today, the precedent is set.

We think trust compounds. Every year STOA stays Apache 2.0 builds confidence:

- **Contributors** know their work will remain open
- **Companies** know they can build on STOA without legal risk
- **Community** knows the project serves users, not just investors

This is a competitive advantage that takes years to build and seconds to destroy.

## The Revenue-Sharing Alternative

Instead of restricting the license to capture revenue, we designed a contributor rewards program where **45% of enterprise revenue flows back to the community** (see [Contributor Rewards](https://docs.gostoa.dev/docs/community/rewards)).

The logic: if the community creates value, the community should share in the revenue — not be locked out of it.

This is still a framework (we're pre-revenue). But the intent is public and documented from day one, not announced retroactively after funding rounds.

## How to Evaluate Open-Source Licenses

If you're choosing between API gateways (or any infrastructure), here's a practical evaluation framework:

| Question | Apache 2.0 / MIT | BSL / SSPL / Source-Available |
|----------|-------------------|-------------------------------|
| Can I self-host without restrictions? | Yes | Depends on use case |
| Can I offer it as part of my platform? | Yes | Usually no |
| Can I modify and redistribute? | Yes | Yes, but with conditions |
| Can my clients use my fork commercially? | Yes | Check the fine print |
| Will the license change in the future? | Possible but unlikely (no business incentive) | Already happened once... |
| Can I contribute without signing a CLA that enables relicensing? | Usually yes | Often requires CLA |

**The CLA question is critical.** Many "open source" projects require contributors to sign a Contributor License Agreement that grants the company the right to relicense their contributions. This is the legal mechanism that enables future license switches. Check the CLA before contributing.

STOA uses the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) — a lightweight sign-off that confirms you wrote the code and have the right to contribute it. No relicensing rights granted.

## Our Commitment

STOA Platform will remain Apache 2.0. Not because we have no business model (we do). Not because we don't care about cloud providers (we do). But because:

1. **Trust is more valuable than lock-in** — every user who chooses STOA knowing the license won't change is a user who stays
2. **Community > Control** — the best infrastructure projects are owned by their communities, not by a single company
3. **Security shouldn't be paywalled** — if your API gateway's security features are behind a commercial license, you don't have a security product — you have a sales funnel

## What You Can Do

If you care about true open source:

- **Check the license** before adopting any tool — not just the label, but the actual terms
- **Check the CLA** — if they can relicense your contributions, they eventually will
- **Support Apache 2.0 / MIT / BSD projects** — star them, contribute, tell others
- **Ask vendors the hard question**: "Do you commit to never changing the license?"

---

## FAQ

### Can Apache 2.0 really sustain a business?

Yes. Kubernetes (Google), Envoy (Lyft), Apache Kafka (Confluent), and Terraform/OpenTofu prove that Apache 2.0 projects can generate billions in enterprise revenue. The business model is services, not license restrictions.

### What if someone forks STOA and competes with you?

They can fork the code but not the brand (trademark), the community, or the ecosystem. Maintaining a competitive fork requires sustained engineering investment. Most forks die within 6 months — the ones that survive (OpenTofu, Valkey) prove there was a real community need.

### How does STOA's license affect my project?

Apache 2.0 is one of the most permissive licenses. You can use STOA commercially, modify it, embed it in proprietary software, and redistribute it. The only requirement: keep the license notice and NOTICE file. No copyleft, no patent traps.

### Where can I read more about STOA's open-source philosophy?

See our [community philosophy](https://docs.gostoa.dev/docs/community/philosophy) for the full HLFH values, and our [contributor rewards program](https://docs.gostoa.dev/docs/community/rewards) for how we plan to share revenue with the community. For the security side of open source, see our [API security checklist](/blog/api-security-checklist-solo-dev).

---

**Related**: [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026) | [STOA Philosophy](https://docs.gostoa.dev/docs/community/philosophy) | [API Security Checklist](/blog/api-security-checklist-solo-dev)

*STOA is Apache 2.0. Always has been. Always will be. [Star us on GitHub](https://github.com/stoa-platform/stoa) if that matters to you.*
