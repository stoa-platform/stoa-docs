---
sidebar_position: 1
title: "STOA Governance: Quality Standards & Processes"
description: STOA Platform governance, quality standards, and decision-making processes — implementation review loop, ADRs, Council review, and transparent contributions
keywords: [governance, standards, quality, decisions, community]
---

# STOA Governance

This section documents STOA Platform's governance model, quality standards, and decision-making processes.

## Why Governance Matters

STOA aims to be the **European Agent Gateway** — a sovereign, enterprise-grade API management platform. This requires:

- **Consistent quality** across all contributions
- **Security-first** mindset in every decision
- **Transparent processes** for the community
- **Clear accountability** for maintainers

## Core Standards

### Implementation Review Loop

The [Implementation Review Loop](./review-loop) (Standard Marchemalo) ensures every significant code change passes rigorous validation before reaching production.

**Key principles:**
- Multi-persona review (Architecture, Security, Business)
- Iterative improvement until score of 9/10 or above
- Timeboxed iterations with clear escalation paths
- Capitalization of patterns and decisions

### Architecture Decision Records (ADRs)

All significant architectural decisions are documented in [ADRs](../architecture/adr/adr-001-api-exposure-strategy). These provide:

- Context and problem statement
- Considered options
- Decision and rationale
- Consequences and trade-offs

Over 40 ADRs have been published, covering topics from API exposure strategy (ADR-001) to GitOps reconciliation operators (ADR-042).

### Patterns Library

Validated implementation patterns are collected and documented across the codebase:

- **Gateway Adapter Pattern** — abstract interface for multi-gateway orchestration ([Multi-Gateway Setup](/docs/guides/multi-gateway-setup))
- **UAC (Universal API Contract)** — define once, expose everywhere ([UAC Concept](/docs/concepts/uac))
- **Ship/Show/Ask** — PR categorization for autonomous or reviewed merges
- **Micro-PR Strategy** — Stripe-inspired small PRs (under 300 LOC) for reviewability

## The Council

STOA's quality is maintained by a "Council" of review personas:

| Persona | Focus | When Activated |
|---------|-------|----------------|
| **Archi 50x50** | Architecture, patterns, maintainability | Always |
| **Team Coca** | Security (crypto, injection, secrets, access) | Security-related changes |
| **OSS Killer** | Business value, scope, over-engineering | New features, unclear scope |
| **Better Call Saul** | Legal, IP, compliance | IP/licensing/data issues |

## Contribution Workflow

```
1. Open Issue/Ticket
       ↓
2. Implementation Plan (if significant)
       ↓
3. Council Review (iterative)
       ↓
4. Implementation
       ↓
5. PR Review
       ↓
6. Merge + Deploy
       ↓
7. Capitalization (ADR/Pattern if new)
```

## Contributing Guide

### Getting Started

1. Fork the repository on GitHub
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Follow the [commit conventions](/docs/reference/changelog): `type(scope): description`
4. Run the component quality gate before pushing (see below)
5. Open a Pull Request against `main`

### Quality Gates by Component

| Component | Pre-Push Command |
|-----------|-----------------|
| Python (API) | `ruff check . && black --check . && pytest tests/ -q` |
| TypeScript (UI, Portal) | `npm run lint && npm run format:check && npm test -- --run` |
| Rust (Gateway) | `cargo fmt --check && cargo clippy -- -D warnings && cargo test` |

### PR Requirements

- Signed commits (DCO check enforced)
- CI green (3 required checks: License, SBOM, Signed Commits)
- Component-specific CI passes
- Under 300 LOC changed (split larger changes into stacked PRs)

## Code of Conduct

STOA Platform follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct (v2.1).

**Our pledge**: We are committed to providing a welcoming and inspiring community for all, regardless of background or identity.

**Scope**: This Code of Conduct applies within all community spaces — GitHub issues, pull requests, discussions, and any other STOA-related communication channels.

**Enforcement**: Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project maintainers at `conduct@gostoa.dev`. All complaints will be reviewed and investigated promptly and fairly.

## Current Governance Model

STOA is currently in **BDFL (Benevolent Dictator For Life)** phase during early development.

**BDFL:** Christophe ABOULICAM ([@caboulicam](https://github.com/caboulicam))

As the community grows, governance will evolve toward a distributed model with:
- Technical Steering Committee
- Working Groups
- Community voting on major decisions

## Related Documents

- [Implementation Review Loop](./review-loop) — Quality validation process
- [ADRs](../architecture/adr/adr-001-api-exposure-strategy) — Architecture Decision Records
- [Community](../community/) — Community resources
- [FAQ](../community/faq) — Frequently asked questions
