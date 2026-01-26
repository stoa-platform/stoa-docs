# ADR-019: Business Model & Moat Strategy

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-01-27 |
| **Authors** | Christophe ABOULICAM |
| **Reviewers** | OSS Killer, Archi Vétéran |
| **Tags** | `strategy`, `business`, `open-source` |

## Context

STOA Platform is released under Apache 2.0 license. This creates an existential question:

> "If a prospect can fork STOA, hire 1 dev + AI, and build their own 'ACME Gateway' — why would they pay CAB Ingénierie?"

This ADR documents the strategic moats that protect STOA's commercial viability while maintaining genuine open-source principles.

## Decision

We adopt a **"Kubernetes/CNCF-inspired" model** with three layers of protection:

1. **Trademark Protection** (Legal Moat)
2. **Velocity & Expertise** (Execution Moat)
3. **Ecosystem & Certification** (Network Moat)

### 1. Trademark Protection — The Legal Moat

| Asset | Status | Protection |
|-------|--------|------------|
| "STOA Platform" | ✅ INPI registered (Jan 2026, 420€) | Cannot use without license |
| "STOA" | ✅ INPI registered (Jan 2026) | Cannot use without license |
| Logo & Visual Identity | ✅ Protected | Derivative works prohibited |

**What this means:**
- Anyone can fork the CODE (Apache 2.0)
- Nobody can call their fork "STOA" or "STOA-based" commercially
- No "STOA Compatible" claims without certification
- No use of STOA branding in marketing materials

**Fork scenarios:**

| Scenario | Allowed? | Notes |
|----------|----------|-------|
| Internal use of forked code | ✅ Yes | Apache 2.0 permits |
| Sell as "ACME Gateway" (no STOA mention) | ✅ Yes | Their problem to maintain |
| Sell as "ACME Gateway, STOA-compatible" | ❌ No | Trademark violation |
| Contribute back to STOA | ✅ Yes | Welcome! |
| Offer "STOA support services" | ❌ No | Requires partner agreement |

### 2. Velocity & Expertise — The Execution Moat

**The 4x Reality:**
```
Fork team:
├── 6 months to understand architecture
├── 3 months to adapt to their context
├── Ongoing: chase STOA updates or diverge
└── Total: 9+ months before production

STOA + CAB partnership:
├── 2 days: Architecture workshop
├── 2 weeks: POC with your APIs
├── 2 months: Production deployment
└── Ongoing: Updates, support, roadmap influence
```

**What CAB brings that a fork cannot replicate:**

| Capability | Fork | CAB Partnership |
|------------|------|-----------------|
| Architecture decisions context | Read ADRs, guess intent | Direct access to author |
| Security patches | Wait for public disclosure | 24h private notification |
| Roadmap influence | None | Design partner input |
| Production troubleshooting | Stack Overflow | Expert who built it |
| Enterprise integration patterns | Figure it out | 7 years APIM @ major central bank |
| MCP/AI Gateway expertise | Emerging, few experts | Day-1 MCP-native design |

**The expertise stack:**
```
Christophe ABOULICAM
├── 7 years API Management @ major central bank
├── Built APIM offering from scratch (0 → production)
├── Enterprise patterns: F5, webMethods, Keycloak, Vault
├── MCP protocol: Early adopter, contributor
└── AI-native architecture: Not retrofitted, designed for agents
```

### 3. Ecosystem & Certification — The Network Moat

**STOA Certified Program** (Planned Q3 2026):

| Certification | Target | Value |
|---------------|--------|-------|
| STOA Certified Engineer | Individuals | LinkedIn badge, job market advantage |
| STOA Certified Partner | ESN/Consulting | Listed on gostoa.dev, lead sharing |
| STOA Certified Deployment | Enterprises | Audit stamp, compliance evidence |

**Why certification matters:**

For the **enterprise buyer**:
> "We chose STOA Certified because our auditors accept it. A fork would require a full security audit (€50-100K) and ongoing maintenance liability."

For the **consultant**:
> "I'm STOA Certified — I can implement in 2 months what would take an uncertified team 6 months."

For the **ESN partner**:
> "We're a STOA Certified Partner — we get early access to roadmap, co-marketing, and lead referrals."

**Community & Ecosystem:**

| Asset | Status | Moat Value |
|-------|--------|------------|
| Official Discord | 🟡 Setup pending | Community support, hiring pool |
| Monthly newsletter | 🟡 Setup pending | Mindshare, announcements |
| MCP Tool Registry | 🟡 Planned | Lock-in via ecosystem |
| Migration adapters (Kong, webMethods) | 🟡 Planned | Reduce switching cost TO STOA |
| Contribution recognition | 🟡 Planned Q3 2026 | **45% revenue redistribution** to contributors |

### Pricing Strategy

| Tier | Prix | Cible | Statut |
|------|------|-------|--------|
| **Community** | Free | Self-hosted, DIY | ✅ Dispo |
| **Cloud Solo** | ~50-100€/mois | Indépendants, petites équipes | 📅 Q4 2026 |
| **Pro** | 500€/mois | PME, support prioritaire | 📅 Q2 2026 |
| **Enterprise** | 2000€/mois | Grands comptes, SLA, custom | 📅 Q3 2026 |
| **Design Partner** | Custom | Early adopters, co-construction | 🟢 Active |

**Tier details:**

| Tier | Includes |
|------|----------|
| **Community** | Apache 2.0 code, public docs, community Discord |
| **Cloud Solo** | Managed hosting, basic support, single-tenant |
| **Pro** | Priority support (48h SLA), private security advisories, quarterly roadmap calls |
| **Enterprise** | 24h SLA, dedicated Slack channel, on-site architecture review, certification included |
| **Design Partner** | Roadmap influence, early access, co-development, case study rights |

**What's NOT open source (commercial features, post-MVP):**
- Advanced multi-tenant billing & chargeback
- Compliance reporting (NIS2, DORA dashboards)
- Enterprise SSO federation (beyond basic OIDC)
- Premium support SLAs
- Audit trail export (compliance format)

## The "Fork Defense" Script

When a prospect asks "Why not just fork?", respond:

> **30-second version:**
> "You can fork — it's Apache 2.0. But you lose: security patches in 24h instead of public disclosure, roadmap influence, official certification for your auditors, and an expert who built the major central bank APIM. Your devs will spend 6 months understanding what I can explain in 2 days. The fork will cost you more than the partnership."

> **Technical version:**
> "The code is 20% of the value. The other 80% is: knowing WHY each ADR decision was made, the gotchas in MCP SSE connection handling, the Keycloak token exchange edge cases, the F5 mTLS termination patterns. You can read the code, but you can't read the 7 years of production incidents that shaped it."

> **Business version:**
> "Your auditors will ask: 'Who maintains this? What's the security response SLA? Who's liable?' With a fork, that's you. With STOA partnership, that's us — and we have the track record."

## Consequences

### Positive
- Clear value proposition beyond "free code"
- Sustainable business model for solo founder
- Community can grow without threatening commercial viability
- Partners have clear engagement model

### Negative
- Certification program requires investment to build
- Some enterprises may still fork (acceptable loss)
- Need to deliver on velocity promise consistently

### Risks
- If community doesn't grow, network moat is weak
- If competitor forks and builds better community, we lose
- Certification value depends on market recognition

### Mitigations
- Certification program investment secured via bootstrap revenue (Design Partner tier)
- Community growth tied to public roadmap transparency
- Early partner program (Q2 2026) to validate pricing before public launch
- 45% revenue redistribution creates aligned incentives with contributors

## Compliance

- Apache 2.0 license: Fully compliant, no source-available tricks
- Trademark protection: Standard practice (Linux, Kubernetes, etc.)
- No "open-core bait-and-switch": Core features stay open

## References

- [Kubernetes Trademark Guidelines](https://www.linuxfoundation.org/trademark-usage)
- [CNCF Project Governance](https://www.cncf.io/projects/)
- [HashiCorp BSL Controversy](https://blog.hashicorp.com/hashicorp-adopts-business-source-license) — What NOT to do
- INPI Trademark Registration: STOA Platform (2026), STOA (2026)
