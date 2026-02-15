# PLAN-SEO — Editorial Calendar & Content Strategy

> Source of truth for blog content planning on docs.gostoa.dev.
> Updated by Claude Code when articles are published or topics claimed.
> See `.claude/rules/seo-content.md` in stoa repo for templates and quality gates.

## Content Rotation

| Day | Type | Cadence | Notes |
|-----|------|---------|-------|
| Tuesday | Tutorial | Weekly | Step-by-step, code-heavy, long-tail keywords |
| Thursday | Comparison | Biweekly | Feature tables, disclaimers, vs-keywords |
| 1st of month | Glossary | Monthly | Dense internal links, A-Z or thematic |
| 15th of month | News/Update | Monthly | Short, timely, link-rich |

## Seasonal Hooks

| Quarter | Hook | Content Angle |
|---------|------|---------------|
| Q1 (Jan-Mar) | DORA/NIS2 compliance deadlines | Compliance tutorials, regulatory guides |
| Q2 (Apr-Jun) | KubeCon EU | Kubernetes tutorials, cloud-native patterns |
| Q3 (Jul-Sep) | Back-to-school / new projects | Getting started guides, onboarding tutorials |
| Q4 (Oct-Dec) | Year-in-review, planning season | Recap posts, roadmap previews, trend analysis |

## Published Articles (32 total)

### Pillar 1: API Gateway Migration
| Date | Slug | Type | Words | Status |
|------|------|------|-------|--------|
| 2026-02-11 | `api-gateway-migration-guide-2026` | Hub | ~2500 | Published |
| 2026-01-25 | `webmethods-migration-guide` | Spoke | ~1800 | Published |
| 2026-02-11 | `mulesoft-migration-open-source-gateway` | Spoke | ~2000 | Published |
| 2026-02-11 | `datapower-tibco-migration-guide` | Spoke | ~1800 | Published |
| 2026-02-07 | `apigee-alternative-open-source` | Spoke | ~1500 | Published |
| 2026-01-30 | `stoa-vs-kong-api-gateway` | Spoke | ~1500 | Published |

### Pillar 2: MCP & AI Agents
| Date | Slug | Type | Words | Status |
|------|------|------|-------|--------|
| 2026-01-20 | `what-is-mcp-gateway` | Hub | ~1500 | Published |
| 2026-02-09 | `connecting-ai-agents-enterprise-apis` | Hub | ~2000 | Published |
| 2026-02-12 | `mcp-gateway-quickstart-docker` | Spoke | ~1850 | Published |
| 2026-01-22 | `esb-is-dead-long-live-mcp` | Spoke | ~1200 | Published |
| 2026-02-13 | `api-gateway-glossary-2026` | Spoke | ~2400 | Published |

### Pillar 3: Open Source API Management
| Date | Slug | Type | Words | Status |
|------|------|------|-------|--------|
| 2026-01-28 | `open-source-api-gateway-2026` | Hub | ~2000 | Published |
| 2026-02-01 | `api-management-europe-sovereignty` | Spoke | ~1500 | Published |
| 2026-02-03 | `dora-nis2-api-gateway-compliance` | Spoke | ~1500 | Published |
| 2026-02-05 | `multi-tenant-api-gateway-kubernetes` | Spoke | ~1800 | Published |
| 2026-02-19 | `why-apache-2-not-bsl` | Spoke | ~1200 | Published |
| 2026-02-12 | `api-keys-in-git-history` | Spoke | ~1200 | Published |
| 2026-02-14 | `api-security-checklist-solo-dev` | Spoke | ~1500 | Published |
| 2026-02-17 | `gitops-in-10-minutes` | Spoke | ~1500 | Published |

### Other
| Date | Slug | Type | Words | Status |
|------|------|------|-------|--------|
| 2026-01-21 | `introducing-stoa` | Announcement | ~1000 | Published |
| 2026-02-26 | `release-v0.1.0` | Release | ~800 | Published |

## Subject Bank — Upcoming Topics

### Pillar 1: API Gateway Migration (TODO spokes)

| # | Topic | Target Keyword | Type | Priority | Status |
|---|-------|---------------|------|----------|--------|
| M1 | Axway API Gateway to STOA migration | axway api gateway migration | Comparison | P1 | TODO |
| M2 | WSO2 API Manager to STOA migration | wso2 api manager alternative | Comparison | P1 | TODO |
| M3 | Layer7 / CA API Gateway migration | layer7 api gateway migration open source | Comparison | P2 | TODO |
| M4 | AWS API Gateway to self-hosted migration | aws api gateway self hosted alternative | Comparison | P2 | TODO |
| M5 | Azure APIM to open source migration | azure api management alternative open source | Comparison | P2 | TODO |
| M6 | API gateway migration checklist (generic) | api gateway migration checklist 2026 | Tutorial | P1 | Published (api-gateway-migration-checklist) |
| M7 | Zero-downtime API gateway migration | zero downtime api migration strategy | Tutorial | P2 | TODO |

### Pillar 2: MCP & AI Agents (TODO spokes)

| # | Topic | Target Keyword | Type | Priority | Status |
|---|-------|---------------|------|----------|--------|
| A1 | MCP protocol deep-dive: architecture & spec | mcp protocol architecture explained | Tutorial | P1 | TODO |
| A2 | AI agent security: authentication patterns | ai agent api authentication security | Tutorial | P1 | Published (ai-agent-security-authentication-patterns) |
| A3 | Building custom MCP tools with STOA | build custom mcp tools tutorial | Tutorial | P1 | TODO |
| A4 | MCP vs OpenAI function calling vs LangChain | mcp vs openai function calling comparison | Comparison | P1 | TODO |
| A5 | AI gateway rate limiting and quota management | ai gateway rate limiting best practices | Tutorial | P2 | TODO |
| A6 | Enterprise AI agent governance patterns | enterprise ai agent governance api | Tutorial | P2 | TODO |
| A7 | From REST API to MCP tool: conversion guide | convert rest api to mcp tool | Tutorial | P1 | TODO |
| A8 | AI agent observability: tracing MCP calls | ai agent observability tracing mcp | Tutorial | P2 | TODO |
| A9 | MCP gateway glossary: 20 terms explained | mcp gateway glossary terms | Glossary | P2 | TODO |

### Pillar 3: Open Source API Management (TODO spokes)

| # | Topic | Target Keyword | Type | Priority | Status |
|---|-------|---------------|------|----------|--------|
| O1 | API gateway performance benchmarks 2026 | api gateway performance comparison 2026 | Comparison | P2 | TODO |
| O2 | Kubernetes-native API gateway patterns | kubernetes native api gateway patterns | Tutorial | P1 | Published (kubernetes-native-api-gateway-patterns) |
| O3 | API versioning strategies for enterprises | api versioning strategy enterprise | Tutorial | P2 | TODO |
| O4 | Open source API gateway security hardening | open source api gateway security hardening | Tutorial | P1 | Published (api-gateway-security-hardening-guide) |
| O5 | Multi-cloud API management with GitOps | multi cloud api management gitops | Tutorial | P2 | TODO |
| O6 | API gateway observability: logs, metrics, traces | api gateway observability setup | Tutorial | P2 | TODO |
| O7 | RBAC for API gateways: design patterns | api gateway rbac design patterns | Tutorial | P2 | TODO |
| O8 | API gateway circuit breaker patterns explained | api gateway circuit breaker pattern | Tutorial | P1 | TODO |

### Community & Thought Leadership

| # | Topic | Target Keyword | Type | Priority | Status |
|---|-------|---------------|------|----------|--------|
| C1 | STOA community spotlight: first contributors | open source community spotlight | News | P2 | TODO |
| C2 | Launch Week Q1 2026 recap | stoa platform launch week | News | P1 | TODO |
| C3 | Why we chose Apache 2.0 (deep-dive) | apache 2.0 vs bsl open source license | Tutorial | P2 | Published (why-apache-2-not-bsl) |
| C4 | Building an API platform with AI-first approach | ai first api platform development | Tutorial | P2 | TODO |
| C5 | How we test 500+ gateway scenarios | api gateway testing strategy | Tutorial | P2 | TODO |
| C6 | European digital sovereignty and API management | european digital sovereignty api | Tutorial | P2 | TODO |

### Dev Experience & Quickstarts

| # | Topic | Target Keyword | Type | Priority | Status |
|---|-------|---------------|------|----------|--------|
| D1 | STOA quick start: your first API in 5 minutes | stoa platform quick start tutorial | Tutorial | P1 | Published (stoa-quickstart-first-api-5-minutes) |
| D2 | stoactl CLI: manage APIs from your terminal | stoactl cli api management terminal | Tutorial | P1 | TODO |
| D3 | Docker Compose: full STOA stack locally | stoa docker compose local development | Tutorial | P1 | TODO |
| D4 | STOA developer portal: publish your first API | api developer portal publish api | Tutorial | P2 | TODO |
| D5 | GitOps for API management: ArgoCD + STOA | gitops api management argocd | Tutorial | P2 | TODO |

## Recommended Next 10 Articles (Priority Order)

Based on pillar gaps, keyword opportunity, and seasonal relevance:

1. ~~**A7** — REST to MCP conversion~~ ✅ Published
2. ~~**M1** — Axway migration~~ ✅ Published
3. ~~**A1** — MCP protocol deep-dive~~ ✅ Published
4. ~~**M2** — WSO2 migration~~ ✅ Published
5. ~~**O2** — K8s-native API gateway patterns~~ ✅ Published (batch 6)
6. ~~**A4** — MCP vs OpenAI vs LangChain~~ ✅ Published
7. ~~**D1** — Quick start tutorial~~ ✅ Published (batch 6)
8. ~~**O4** — Security hardening guide~~ ✅ Published (batch 6)
9. ~~**A2** — AI agent security patterns~~ ✅ Published (batch 6)
10. ~~**M6** — Generic migration checklist~~ ✅ Published (batch 6)

**All 10 recommended articles are now published.** Next priorities: A3, A5, A6, O8, D2, D3.

## Hub Health Dashboard

| Pillar | Hub Article | Published Spokes | TODO Spokes | Health |
|--------|------------|------------------|-------------|--------|
| Migration | `api-gateway-migration-guide-2026` | 7 | 5 | Excellent (7+) |
| MCP & AI | `what-is-mcp-gateway` + `connecting-ai-agents-enterprise-apis` | 7 | 5 | Excellent (7+) |
| Open Source | `open-source-api-gateway-2026` | 9 | 6 | Excellent (9+) |

**All 3 pillars now have 7+ published spokes.** Focus on Dev Experience (D-series) and remaining depth topics.

## Content Templates

### Tutorial Template

```markdown
---
slug: <kebab-case>
title: <How to [Action] with [Technology] (Step-by-Step Guide)>
description: <Learn how to [action] using [technology]. Complete tutorial with code examples.>
authors: [stoa-team]
tags: [tutorial, <1-3 relevant tags>]
keywords:
  - <primary keyword>
  - <secondary keywords>
---
<!-- last verified: YYYY-MM -->

# <Title>

<2-3 sentence answer-first summary. What will the reader learn? Why does it matter?>

<!-- truncate -->

## Prerequisites

- <Prerequisite 1>
- <Prerequisite 2>

## Step 1: <Action>

<Explanation + code block>

## Step 2: <Action>

<Explanation + code block>

## Step N: <Action>

<Final step + verification>

## What You've Built

<Summary of what was accomplished. Link to next steps.>

## FAQ

### <Question 1>?
<Answer with internal link>

### <Question 2>?
<Answer with internal link>

### <Question 3>?
<Answer with internal link>

---

**Next steps**: [Link to hub article](/blog/<hub-slug>) | [Link to related tutorial](/blog/<related-slug>)
```

### Comparison Template

```markdown
---
slug: <product-a-vs-product-b-keyword>
title: <Product A vs Product B: [Keyword] Comparison [Year]>
description: <Compare Product A and Product B for [use case]. Feature comparison with migration guide.>
authors: [stoa-team]
tags: [comparison, <relevant tags>]
keywords:
  - <product A vs product B>
  - <secondary keywords>
---
<!-- last verified: YYYY-MM -->

# <Title>

<2-3 sentence summary. What are the key differences? Who should choose which?>

<!-- truncate -->

## Overview

| Feature | Product A | Product B | STOA |
|---------|-----------|-----------|------|
| <Feature 1> | ... | ... | ... |
| <Feature 2> | ... | ... | ... |

## <Feature Category 1>

<Analysis with sources>

## <Feature Category 2>

<Analysis with sources>

## When to Choose Each

### Choose Product A when...
### Choose Product B when...
### Choose STOA when...

## Migration Path

<Brief migration overview. Link to detailed migration guide if exists.>

## FAQ

### <Question>?
<Answer>

---

> Feature comparisons are based on publicly available documentation as of
> [YYYY-MM]. Product capabilities change frequently. We encourage readers
> to verify current features directly with each vendor. All trademarks
> belong to their respective owners. See [trademarks](/docs/trademarks).

**Related**: [Migration Hub](/blog/api-gateway-migration-guide-2026) | [Open Source Gateway Guide](/blog/open-source-api-gateway-2026)
```

### Glossary Template

```markdown
---
slug: <topic-glossary-year>
title: <Topic Glossary: N Terms Every Developer Should Know [Year]>
description: <Complete glossary of [topic] terms with examples. From [A-term] to [Z-term].>
authors: [stoa-team]
tags: [education, <relevant tags>]
keywords:
  - <topic glossary>
  - <secondary keywords>
---
<!-- last verified: YYYY-MM -->

# <Title>

<2-3 sentence summary. Who is this for? What will they learn?>

<!-- truncate -->

## A

### <Term>
<Definition. Link to relevant docs or blog post.>

## B

### <Term>
<Definition. Link to relevant docs or blog post.>

...

## FAQ

### <Question>?
<Answer>

---

**Related**: [Hub Article](/blog/<hub-slug>) | [Tutorial](/blog/<tutorial-slug>)
```

### News/Update Template

```markdown
---
slug: <topic-update-month-year>
title: <What's New in [Topic] — [Month Year] Update>
description: <[Topic] updates for [Month Year]: [highlight 1], [highlight 2], and more.>
authors: [stoa-team]
tags: [announcement, <relevant tags>]
keywords:
  - <topic update month year>
  - <secondary keywords>
---

# <Title>

<2-3 sentence summary of key updates.>

<!-- truncate -->

## Highlights

### <Update 1>
<Brief description + link>

### <Update 2>
<Brief description + link>

## Community

<Community news, contributor shoutouts, upcoming events>

## What's Next

<Roadmap preview + link to roadmap page>

---

**Links**: [Full Changelog](/blog/tags/release) | [Roadmap](/docs/roadmap) | [Community](/docs/community/)
```
