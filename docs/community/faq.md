---
sidebar_position: 4
title: "FAQ: STOA Platform Questions & Answers"
description: Common questions about STOA's open source model, sustainability, licensing (Apache 2.0), pricing, MCP support, and deployment options
keywords: [FAQ, open source, licensing, Apache 2.0, sustainability, community]
---

# Frequently Asked Questions

Honest answers to skeptical questions about STOA's open source model.

---

## Licensing & Protection

### Why Apache 2.0 instead of BSL or SSPL?

**Short answer**: We chose community over control.

**Long answer**: BSL (Business Source License) and SSPL say "we trust you, but not that much." Result? OpenTofu forked HashiCorp in 3 months. ElasticSearch became OpenSearch.

We do Apache 2.0 with redistribution. Protection isn't the license — it's:

1. **Trademark** — "STOA" is registered with INPI
2. **45% redistribution** — Creates loyalty
3. **Ecosystem** — MCP bindings, UAC templates, community

You want a license that scares people, or a community that wants to stay?

### What stops AWS from forking STOA tomorrow?

They can. But:

1. **Trademark protection** — They can't call it "STOA" (INPI registered ✅)
2. **No certification access** — Without certification, no partner program
3. **Ecosystem stays here** — MCP bindings, UAC templates, integrations
4. **Contributors paid HERE** — Why would they leave?

AWS forked Elasticsearch amid a licensing dispute. We aim to share value directly with contributors. Why would anyone leave?

### Kubernetes had Google with $3M/year. What do you have?

Google gave $3M so K8s stays neutral and no one controls it.

We do the opposite: we keep control AND redistribute 45% to contributors and the foundation. That's more generous than Google proportionally.

The real comparison:

| | Kubernetes | STOA |
|---|---|---|
| Initial investment | $3M from Google | Bootstrap |
| Control | CNCF (neutral) | HLFH (aligned) |
| Contributor rewards | Reputation only | 15% revenue share |
| Foundation funding | Corporate sponsors | 10% revenue |

---

## Business Model

### How do you make money with Apache 2.0?

Same as Red Hat, Confluent, HashiCorp (before BSL):

1. **Enterprise Support** — SLAs, dedicated support, custom integrations
2. **Managed Service** — STOA Cloud (coming 2027)
3. **Certification** — Developer and architect certifications
4. **Training** — Workshops, onboarding, consulting
5. **Partner Program** — Revenue share with integrators

The code is free. The expertise, support, and convenience are not.

### What if a competitor offers the same service cheaper?

They can try. But:

1. **We know the code best** — We wrote it
2. **Upstream patches** — Security fixes available from the source
3. **Community trust** — Contributors work with us, not against us
4. **Roadmap influence** — Enterprise customers shape the product

Red Hat has competitors offering "free" RHEL support. Red Hat still dominates. Same principle.

### Is this sustainable long-term?

The model is designed to be self-sustaining: as enterprise revenue grows, all pools (foundation, maintainers, contributors, operations) grow proportionally. No VC dependency. No "pivot to enterprise" bait-and-switch.

---

## Contributors

### Where's the actual point schedule? Is this vaporware?

It's documented right here on [docs.gostoa.dev/community/rewards](/docs/community/rewards).

Every quarter, we publish:
- The available pool
- Points for each contributor
- Payments made

Full transparency. Want to see the spreadsheet? It's a Google Sheet for now, but the intention is clear.

### How do you prevent gaming the system?

Three mechanisms:

1. **Tier system** — AI-easy contributions (typos, basic refactors) earn less
2. **Automatic detection** — Patterns like PR spam, unusual volume
3. **Reputation multiplier** — History of quality work earns more

Plus: 30% of contributors can veto any scoring change.

### What about invisible work like mentoring and triage?

We track it explicitly:

| Contribution | Points |
|--------------|--------|
| Issue triage + reproduction | 5 |
| Community help (Discord) | 2 per response |
| Mentoring (documented) | 20 per session |
| RFC writing | 100 |

Invisible work isn't invisible anymore.

---

## Governance

### Who decides what gets built?

Layered governance:

1. **Constitution** (immutable) — Core principles, requires 2/3 majority + 1 year notice to change
2. **Laws** (stable) — Value dimensions, weights, requires simple majority + 3 months notice
3. **Regulations** (adaptive) — Specific metrics, quarterly review by council

### What's the Value Evolution Council?

7-seat governing body:

| Seats | Term | Role |
|-------|------|------|
| 3 elected contributors | 2 years | Community voice |
| 2 domain experts | 2 years | Technical + community |
| 1 external advisor | 1 year | Challenge assumptions |
| 1 rotating newcomer | 6 months | Fresh perspective |

Constraints:
- No organization > 2 seats
- At least 2 non-EU members
- At least 2 indie contributors

### Can you just change the rules whenever you want?

No. The Constitution is designed to prevent that:

- **Principles** require 2/3 majority + 1 year notice + ratification
- **Laws** require simple majority + 3 months notice
- **Regulations** require council + 2 weeks feedback

Plus: all changes go through gradual transition periods. No sudden rug pulls.

---

## Still Skeptical?

Good. Skepticism is healthy.

Here's what we ask:

1. **Watch us** — Follow our quarterly reports
2. **Challenge us** — Ask hard questions in Discord
3. **Verify us** — The dashboard will be public
4. **Judge us by results** — First distributions Q2 2026

We'd rather earn your trust than demand it.

---

*Have a question not answered here? Ask in `#questions` on [Discord](https://discord.gg/j8tHSSes) or email [hello@gostoa.dev](mailto:hello@gostoa.dev)*
