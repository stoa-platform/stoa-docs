---
sidebar_position: 3
title: Contributor Rewards
description: How STOA values and compensates open source contributions — 45% revenue sharing, four-dimension impact scoring, and quarterly distributions
keywords: [contributor rewards, revenue sharing, compensation, open source, community]
---

# Contributor Rewards Program

STOA redistributes **45% of enterprise revenue** to the community. This page explains how contributions are valued and rewarded.

:::tip Why This Matters
**"The code becomes commodity. The vision remains rare. Pay for what's rare."**

In the age of AI, raw code output is increasingly commoditized. We pay for human judgment, community building, and lasting impact.
:::

---

## Revenue Distribution Model

```
┌─────────────────────────────────────────────────────────────┐
│              STOA Enterprise Revenue Split                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  Foundation  │  │  Maintainers │  │ Contributors │     │
│   │     10%      │  │     20%      │  │     15%      │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│   ┌─────────────────────────────────────────────────┐      │
│   │              Operations                          │      │
│   │                    55%                           │      │
│   │  (Development, Support, Infrastructure)          │      │
│   └─────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Breakdown

| Pool | % | Usage |
|------|---|-------|
| **Foundation** | 10% | Infrastructure, events, legal, grants |
| **Maintainers** | 20% | Core maintainer compensation |
| **Contributors** | 15% | Quarterly distribution based on points |
| **Operations** | 55% | Development, support, infrastructure |

---

## The Four-Dimension Value Framework

We don't just count lines of code. We measure **impact** across four dimensions:

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Technical** | 30% | Quality, performance, security |
| **Community** | 30% | Adoption, satisfaction, engagement |
| **Durability** | 25% | Maintainability, technical debt avoided |
| **Ecosystem** | 15% | Integrations, plugins, standards |

### Formula

```
Points = (Technical × 0.30) + (Community × 0.30) + 
         (Durability × 0.25) + (Ecosystem × 0.15)
```

---

## Point System

### Code Contributions

| Contribution | Points | Notes |
|--------------|--------|-------|
| PR merged (major feature) | 50 | New capability |
| PR merged (minor feature) | 20 | Existing improvement |
| PR merged (bugfix) | 10 | Correction |
| PR merged (refactor) | 15 | Code quality |

### Documentation

| Contribution | Points | Notes |
|--------------|--------|-------|
| PR merged (docs) | 10 | Guide, tutorial |
| Translation | 15 | i18n |

### Community

| Contribution | Points | Notes |
|--------------|--------|-------|
| Issue triage + reproduction | 5 | Bug validation |
| RFC accepted | 100 | Major design |
| Community help (Discord/Forum) | 2 | Per helpful response |
| Talk/Meetup | 30 | External presentation |
| Blog post | 30 | Technical content |

### Security

| Contribution | Points | Notes |
|--------------|--------|-------|
| Security fix (critical) | 200 | CVE critical |
| Security fix (high) | 100 | CVE high |
| Security fix (medium) | 50 | CVE medium |
| Responsible disclosure | 50 | Private report |

---

## Contribution Tiers (Anti-AI-Gaming)

Not all contributions are equal in the AI age:

| Tier | Type | Points | Examples |
|------|------|--------|----------|
| **1** | AI-Proof | HIGH | RFC, mentoring, ADR, community building |
| **2** | AI-Assisted | MEDIUM | Complex features, critical bugs |
| **3** | AI-Easy | LOW | Refactoring, basic tests, typos |


---

## Distribution Formula

```
Pool_Q = 15% × Enterprise_Revenue_Q

Reward(contributor) = (Points_contributor / Total_points_all) × Pool_Q
```

### Example

```
Quarterly Revenue = R
Contributors Pool = 15% × R
Total points Q = 2,000

Contributor A: 500 points (25%)
→ Reward = 25% × Pool

Contributor B: 200 points (10%)
→ Reward = 10% × Pool

Contributor C: 100 points (5%)
→ Reward = 5% × Pool
```

---

## Point Lifecycle

```
T+0          T+1-3d        T+7d          T+30d
│            │             │             │
▼            ▼             ▼             ▼
PR Created → Merge Review → Staging →   Prod Impact
│            │             │             │
Points      Points        Points        Points
ESTIMATED   ADJUSTED      VALIDATED     FINAL
(auto)      (review)      (metrics)     (verified)
```

---

## Transparency

Everything is public:

- **Dashboard**: Real-time point tracking per contributor
- **Quarterly Reports**: Pool size, distributions, recipients
- **Appeal Process**: 7-day window to contest any decision

---

## Program Status

The rewards program is being developed in phases:

1. **Documentation & Design** — Define point system and validation process *(current)*
2. **Launch** — First distributions, transparency reports
3. **Scale** — Automated tracking, public dashboard

---

## Get Started

1. **Join Discord** — [discord.gg/j8tHSSes](https://discord.gg/j8tHSSes)
2. **Pick an issue** — Look for `good-first-issue` labels
3. **Submit a PR** — Follow contribution guidelines
4. **Earn points** — Your contributions are tracked automatically
5. **Get rewarded** — Quarterly distributions

---

*Questions? Ask in `#contributors` on Discord or email [contributors@gostoa.dev](mailto:contributors@gostoa.dev)*
