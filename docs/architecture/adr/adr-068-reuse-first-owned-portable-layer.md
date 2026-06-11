---
title: "ADR-068: Reuse-First — Owned Portable Layer over Commodity Federated Runtimes"
sidebar_label: "ADR-068: Reuse-First Portable Layer"
sidebar_position: 68
description: "Direct customization at the governance layer you own and that survives a runtime change; federate and reuse commodity runtimes; never deepen a vendor's proprietary surface."
keywords: [ADR, reuse-first, portability, governance, gateway adapter, vendor neutral, AI economics, owned layer]
---

# ADR-068 — Reuse-First: Owned Portable Layer over Commodity Federated Runtimes

## 1. Status

**Status:** Proposed

**Date:** 2026-06-10

**Deciders:** STOA Core Team

**Related decisions:** ADR-004 Gateway Adapter Pattern, ADR-019 Business Model & Moat Strategy, ADR-026 Multi-IAM Federation, ADR-037 Deployment Modes — Sovereign First, ADR-040 Born GitOps, ADR-057 Product Lineup, ADR-066 STOA Token Compression, ADR-067 UAC as LLM-Optimized Executable Contract.

> This is the sanitized, architecture-only projection of an internal decision. It deliberately omits any customer identity, named target vendor, pricing, and go-to-market specifics. The rule and the three-bin partition are presented as reusable architecture guidance.

---

## 2. Context

An organization freezes its incumbent commercial integration suite: no further evolution on that runtime. This opens a multi-year hybrid interim (new cloud workloads alongside frozen legacy), with a **probable future target runtime** at the end of it — which may be **either a managed commercial suite or a self-hosted open-source stack**. The rule in this ADR must therefore hold for **both** outcomes; it must not bet on a single future.

A freeze is also an **economic signal** — typically a cost-reduction move. Any plan that assumes budget for an intermediate layer during the freeze must treat that assumption as a **risk**, bounded by an explicit economic checkpoint (see §7).

Structural economic constraint: **AI collapses the cost of *writing* code, not the cost of *owning* it** (maintenance, security, governance, certification, bus-factor). Automated review is becoming cheap for *correction* (low-stakes), but not for *intent*, *regulatory responsibility*, or *independent assurance* — exactly what dominates in regulated environments. Consequence: custom code **commoditizes**, and durable value migrates to what does not regenerate itself — **the owned product, portable contracts, and governance**.

Decision to make: **where to invest customization so it capitalizes and re-adapts onto the next runtime, at a cost below both the incumbent and the future vendor.**

## 3. Decision Drivers

- Portability incumbent → hybrid → next runtime **without rewriting governance**.
- Sovereignty of the **governance layer** (on-prem, owned), even when a target control plane is a managed service.
- Customization cost **below the commercial suites**, amortized across the interim, the future target, and multiple customers (the product).
- Security, governance, and RBAC **by construction** — absent from proprietary surfaces.
- Maintainability with a **lightweight structure**: no bus-factor on N bespoke forks.
- No heavyweight in-house federation engine; no opportunity-driven architecture.
- The **AI leverage** must be aimed at the durable layer, not at disposable code.

## 4. Options Considered

1. **All custom in-house** (rebuild gateway + ESB + portal + governance). *Rejected*: internal lock-in, bus-factor, ownership cost — none of which AI reduces.
2. **All vendor-native** (wait for the target suite, customize inside its proprietary tooling). *Rejected*: locked custom, paid to extend, discarded on any move off that vendor, governance trapped in a managed service; covers neither the interim, the draining legacy, nor non-vendor workloads.
3. **Replace everything with OSS** (a wholesale rip-and-replace). *Rejected*: heavy replacement effort that does not tell the transition story.
4. **Deepen the proprietary surface** (vendor web components, deep platform extensions). *Rejected*: insecure, ungoverned, discarded, locked — the very example of custom to avoid.
5. **★ Reuse-first: owned portable layer + commodity federated runtimes.** *Selected.*

## 5. Decision — The Three-Bin Rule

| Bin | Nature | What | Posture |
|---|---|---|---|
| **A — BUILD** | Owned + portable | Adapters, decoupled portal, thin orchestrator, RBAC bound to the master IdP, self-service, OpenAPI/Git contracts, audit store | **Build fast with AI**, custom *at the seams* |
| **B — FEDERATE / REUSE** | Commodity | Runtimes (incumbent → OSS gateway → future target), Keycloak, OTel, OpenSearch | **Never rebuilt** |
| **C — DON'T TOUCH** | Proprietary (discarded + locked + insecure) | Vendor web components, deep platform extensions, mediation logic bent into customization | **Avoided** |

**Decision gate** (any new element): *"Do I own it? Does its **contract/intent** (OpenAPI, policy) survive a runtime change — even if its **code** is re-targeted?"* → two *yes* = BUILD.

> **Note on adapters.** An adapter is **Bin A by its *contract*** (the captured intent — durable, ports to the next runtime) but **disposable by its *code*** (the per-runtime implementation: an adapter for runtime X ≠ an adapter for runtime Y). What is owned and what survives is the **contract + policy**, not the connector. The gate therefore validates a BUILD only on the **intent part**; the mediation code stays explicitly re-targetable. Governance corollary: bound the mass of custom adapter code and cover it with **contract CI + drift detection**, so it stays "controlled-disposable" rather than a creeping custom engine.

**Anti-disposable lock** — portable standards everywhere: OpenAPI (contracts), OTel (observability), OIDC/Keycloak (identity), GitOps (deployment). On the day of a runtime change: **you switch the target, you do not rebuild governance.**

**Portability is bounded, not zero — say it before they do.** Three levels, to be stated as-is:

- **Ports as-is**: OpenAPI contracts, catalog, identity (OIDC), observability (OTel), self-service journeys, audit store.
- **Ports with translation**: **policies** (rate limiting, quotas, security mediation) have different semantics per gateway — a cross-gateway move is a *lossy-but-controlled translation*, not a trivial re-target. The policy intent is captured in the contract; the adapter translates it best-effort; the gaps are documented.
- **To be re-provisioned**: existing subscriptions and credentials (re-provisioning is automatable via self-service, but not free).

The switch cost is therefore **not zero**: it is **bounded and an order of magnitude below** re-customizing a vendor surface.

**Portable / non-portable dividing line:** the **experience + governance + contracts** layer ports across runtimes; the **mediation logic** (per-runtime flow services) **does not** — you capture the **intent** (contract + policy), not the implementation.

## 6. Ownership and Continuity Model

"The owned layer" is ambiguous in front of a review board, and each naive reading has a problem: owned *by the organization* = internal custom build (back to in-house lock-in); owned *by a single small vendor* = third-party risk rated more severely than an established suite. The answer is an **explicit hybrid model**, stated *before* the question is asked:

| Dimension | Answer |
|---|---|
| Code | **Open source (Apache 2.0)** — the organization can audit, fork, and operate autonomously. Zero legal lock-in: the "vendor disappears" scenario is covered by construction (CNCF-style: brand + governance, no captive license). |
| Operation | **The organization operates** the control plane on-prem (vendor model, not operator). No operational dependency on the third party. |
| Support & continuity | A **commercial support channel** carries the service commitment and continuity — the contractual support counterparty is an established services organization, not the small vendor. |
| Expertise | Vendor (technology, roadmap, certification of independent consultants) + certified consultants = no single-person bus-factor on the customer side. |

For critical-third-party assessment, the dependency evaluated is not "a small vendor": it is **Apache-2.0 code operated by the organization, supported by an established services organization**. That triptych is what gets presented — never "our product" alone.

## 7. Bootstrap and Economic Checkpoint

**Sequenced bootstrap — each step capitalizes and ports to the next runtime:**

1. **Incumbent adapter + OpenAPI contracts in Git** → legacy federated, visible, drainable; durable registry laid down.
2. **Owned decoupled portal** (RBAC via Keycloak, GitOps) → stop customizing the incumbent's surface.
3. **New cloud = runtime #2** (lightweight OSS gateway + integration framework) → all new APIs off the incumbent.
4. **Target-runtime adapter (stub) + OpenAPI import proof** → migration de-risked from day zero.

**Economic checkpoint (the interim must pay for itself — criteria, not a wish).** Review at **T+6 months** after the layer goes to production. **GO to extend** if at least **two** criteria hold, otherwise **do not extend** (the layer stays as-is; the next-runtime bet plays out without additional investment):

1. ≥ *N* legacy APIs cataloged and governed through the layer (*N* fixed during scoping);
2. Self-service adopted: subscription lead time moved from **days to minutes**, measured on real requests;
3. ≥ 1 **new** API delivered on the new-cloud runtime (off the incumbent) via the same contract.

These criteria hold **regardless of the eventual outcome** — that is what makes the interim self-justifying.

## 8. Consequences

### Positive

- Interim investment **not discarded** at a runtime change (commercial or OSS target): you re-target the adapter; switch cost **bounded** (contracts as-is, policies translated, subscriptions re-provisioned).
- Governance-layer sovereignty **maintained** even when a target control plane is a managed SaaS.
- Customization cost **< commercial suites**; security/governance/RBAC by construction.
- Maintainable with a lightweight structure, no bespoke bus-factor.
- **Reinforced by AI progress**: the cheaper code gets, the more the moat shifts to the owned product + contracts + governance — exactly this architecture.

### Negative / Risks (accepted)

- More integration glue than the all-vendor path; adapters must be maintained when admin APIs move.
- Mediation logic stays **per-runtime** (a cross-runtime move is a rebuild, not a port), and policy portability is a lossy-but-controlled translation (see §5) — switch cost is low but **non-zero**.
- If a future managed target covers integration **and** answers the agent need natively, STOA's durable surface narrows to multi-runtime/vendor-neutral + the bridge → the interim must **pay for itself** (checkpoint in §7).
- The proof-of-concept must **explicitly separate** disposable scaffold (demo orchestrator) from product value, or it ships the blueprint for build-it-yourself.
- Dependency on OSS building blocks: choose **supported** versions suitable for a regulated organization (e.g. a supported distribution over a bare upstream).

## 9. References

- ADR-004 Gateway Adapter Pattern; ADR-019 Business Model & Moat Strategy; ADR-037 Deployment Modes — Sovereign First; ADR-057 Product Lineup; ADR-067 UAC as LLM-Optimized Executable Contract.
