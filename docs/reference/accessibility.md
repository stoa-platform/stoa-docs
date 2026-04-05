---
title: Accessibility & WCAG Compliance
sidebar_label: Accessibility
sidebar_position: 18
---

# Accessibility & WCAG Compliance

STOA Platform targets **WCAG 2.1 Level AA** conformance for all user-facing interfaces (Console and Portal). This page documents our accessibility stance, tooling, and alignment with European regulations.

## Standards

| Standard | Scope | Status |
|----------|-------|--------|
| [WCAG 2.1 AA](https://www.w3.org/TR/WCAG21/) | Web Content Accessibility Guidelines | Target conformance |
| [EN 301 549](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf) | European ICT Accessibility Requirements | Aligned (covers WCAG 2.1 AA) |
| [European Accessibility Act](https://ec.europa.eu/social/main.jsp?catId=1202) | EU Directive 2019/882 | Applicable from June 2025 |

### Why EN 301 549?

EN 301 549 is the European harmonized standard for ICT accessibility. It incorporates WCAG 2.1 AA and adds requirements specific to software, documentation, and support services. Compliance is required for:

- **EU public sector procurement** — agencies must procure accessible ICT
- **Financial services** — banking regulators increasingly require accessible customer-facing tools
- **Enterprise RFPs** — accessibility compliance is a standard evaluation criterion

STOA's accessibility posture supports these enterprise sales requirements.

## Implementation

### Automated Testing (axe-core)

STOA uses [axe-core](https://github.com/dequelabs/axe-core) via `@axe-core/playwright` for automated accessibility scanning in E2E tests.

**What axe-core detects:**
- Missing alt text on images
- Insufficient color contrast (AA ratio: 4.5:1 normal text, 3:1 large text)
- Missing form labels
- Invalid ARIA attributes
- Heading hierarchy violations
- Keyboard navigation issues

**What axe-core does NOT detect** (requires manual review):
- Logical reading order
- Meaningful alt text quality
- Complex interaction patterns (drag-and-drop, custom widgets)
- Content comprehension at target reading level

### Semantic HTML & ARIA

All STOA UI pages follow these conventions:

1. **Heading hierarchy** — `h1` > `h2` > `h3`, no level skips
2. **ARIA landmarks** — `role="region"`, `role="navigation"`, `role="tablist"` on interactive containers
3. **ARIA labels** — `aria-label` on tables, lists, metric cards, and tab groups
4. **data-testid convention** — standardized identifiers for E2E and visual regression testing (see [ADR-060](../architecture/adr/adr-060-ai-verified-ui-testing))

### Keyboard Navigation

- All interactive elements are focusable via Tab
- Modal dialogs trap focus
- Escape closes modals and slide-over panels
- Enter/Space activates buttons and links

## Metrics & Tracking

Accessibility violation count is tracked over time using a ratchet approach:
- Current baseline established via axe-core scan
- New violations block CI merge (Phase 2)
- Existing violations tracked for progressive resolution

Metrics script: `scripts/ai-ops/ui-validation-metrics.sh` in the stoa monorepo.

## Conformance Statement

STOA Platform **supports compliance with** WCAG 2.1 Level AA. We are progressively remediating identified violations and tracking conformance metrics. This statement does not constitute a legal guarantee of full conformance — consult your accessibility specialist for formal audit.

:::info Disclaimer
This page describes STOA's accessibility approach and tooling. It is not a legal compliance certificate. Organizations should perform their own accessibility audits for regulatory submissions.
:::
