---
sidebar_position: 19
title: "ADR-019: Business Model & Moat Strategy"
---

# ADR-019: Business Model & Moat Strategy

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-01-27 |
| **Authors** | Christophe ABOULICAM |
| **Reviewers** | OSS Killer, Archi Vétéran |
| **Tags** | `strategy`, `business`, `open-source` |

## Context

STOA Platform is released under Apache 2.0 license. This creates an important strategic question: how to build a sustainable business while maintaining genuine open-source principles.

This ADR documents the strategic approach to STOA's commercial viability.

## Decision

We adopt a model inspired by successful open-source projects, with three layers:

1. **Trademark Protection** (Legal Layer)
2. **Velocity & Expertise** (Execution Layer)
3. **Ecosystem & Certification** (Network Layer)

### 1. Trademark Protection — The Legal Layer

| Asset | Status | Protection |
|-------|--------|------------|
| "STOA Platform" | Registered (INPI, Jan 2026) | Cannot use without license |
| "STOA" | Registered (INPI, Jan 2026) | Cannot use without license |
| Logo & Visual Identity | Protected | Derivative works prohibited |

**What this means:**
- Anyone can fork the CODE (Apache 2.0)
- Nobody can call their fork "STOA" or "STOA-based" commercially
- No "STOA Compatible" claims without certification
- No use of STOA branding in marketing materials

**Fork scenarios:**

| Scenario | Allowed? | Notes |
|----------|----------|-------|
| Internal use of forked code | Yes | Apache 2.0 permits |
| Sell as "ACME Gateway" (no STOA mention) | Yes | Their responsibility to maintain |
| Sell as "ACME Gateway, STOA-compatible" | No | Trademark violation |
| Contribute back to STOA | Yes | Welcome! |
| Offer "STOA support services" | No | Requires partner agreement |

### 2. Velocity & Expertise — The Execution Layer

The STOA team brings deep enterprise API management expertise that cannot be replicated simply by reading the source code. This includes architecture context, security incident response, and production troubleshooting knowledge.

### 3. Ecosystem & Certification — The Network Layer

**STOA Certified Program** (Planned Q3 2026):

| Certification | Target | Value |
|---------------|--------|-------|
| STOA Certified Engineer | Individuals | Validated STOA expertise |
| STOA Certified Partner | ESN/Consulting | Listed on gostoa.dev, lead sharing |
| STOA Certified Deployment | Enterprises | Audit support, compliance evidence |

**Community & Ecosystem:**

| Asset | Status |
|-------|--------|
| Official Discord | Setup pending |
| Monthly newsletter | Setup pending |
| MCP Tool Registry | Planned |
| Migration adapters | Planned |
| Contribution recognition | Planned Q3 2026 |

## Consequences

### Positive
- Clear value proposition beyond "free code"
- Sustainable business model
- Community can grow without threatening commercial viability
- Partners have clear engagement model

### Negative
- Certification program requires investment to build
- Some enterprises may still fork (acceptable)
- Need to deliver on velocity promise consistently

### Risks
- If community doesn't grow, network layer is weak
- Certification value depends on market recognition

### Mitigations
- Early partner program to validate commercial model
- Community growth tied to public roadmap transparency

## Compliance

- Apache 2.0 license: Fully compliant, no source-available restrictions
- Trademark protection: Standard practice (similar to Linux, Kubernetes, etc.)
- No "open-core bait-and-switch": Core features stay open

## References

- [Kubernetes Trademark Guidelines](https://www.linuxfoundation.org/trademark-usage)
- [CNCF Project Governance](https://www.cncf.io/projects/)
- INPI Trademark Registration: STOA Platform (2026), STOA (2026)
