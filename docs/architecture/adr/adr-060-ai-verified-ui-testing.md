# ADR-060 — AI-Verified UI Testing Framework: 4-Layer Validation

**Status:** Accepted
**Date:** 2026-04-05
**Author:** Christophe (CAB Ingenierie)
**Parent Ticket:** CAB-1989 [MEGA] AI-Verified UI Testing Framework

---

## Context

AI agents (Claude Code, Hegemon workers) write and modify React UI code across Console and Portal. They run unit tests (vitest) and linters (ESLint, Prettier) to verify correctness, but **cannot verify visual correctness** — a page that compiles and passes tests may still render broken layouts, missing data, or inaccessible markup.

Current gaps:
- No data seeding for E2E tests — dashboards tested with empty state or mocked data
- No ARIA assertions — tests use CSS selectors that break on layout changes
- No visual regression baselines — layout regressions detected only by humans
- No automated accessibility gate — WCAG 2.1 AA compliance is aspirational, not enforced

**Competitors** (Vercel, Netlify) ship visual regression testing as a platform feature. STOA, as an API management platform serving enterprise customers, needs EN 301 549 alignment for EU public sector sales.

---

## Decision

Implement a **4-layer validation framework** that lets AI agents self-verify UI changes:

### Layer 1 — Data Seeding (`DataSeeder`)

API-first test data factory using Playwright's `APIRequestContext`. Creates deterministic entities (APIs, MCP servers, subscriptions) using real arena backends (echo-backend, fapi-echo, llm-mock). Each test run gets a unique `runId` for isolation, with automatic cleanup.

**Why**: Tests asserting "dashboard shows 3 APIs" need those 3 APIs to exist. Without seeding, tests either pass vacuously (empty state) or depend on production data.

### Layer 2 — ARIA Assertions (`aria-helpers`)

Role-based assertions using Playwright's accessibility tree locators (`getByRole`, `aria-label`). Verify table row counts, metric card values, list items, and heading hierarchy through the accessibility layer.

**Why**: CSS-selector tests (`getByClass('card')`) break on every Tailwind refactor. ARIA-based tests are resilient to visual changes while enforcing semantic correctness. This also ensures the markup is navigable by screen readers.

### Layer 3 — Visual Regression (Phase 2)

Screenshot comparison using `data-testid` convention for dynamic value masking. Suffixes `-count`, `-timestamp`, `-duration` are auto-masked to avoid false positives from changing numbers. Docker-based CI for pixel-consistent rendering.

**Why**: Layout regressions (overlapping elements, broken dark mode, missing responsive breakpoints) are invisible to unit tests. Visual baselines catch them automatically.

### Layer 4 — Accessibility Gate (Phase 2)

axe-core integration via `@axe-core/playwright`. Automated WCAG 2.1 AA violation scanning as a CI quality gate. Violations block merge; the count is tracked over time via ratchet.

**Why**: EN 301 549 (European Accessibility Act) requires WCAG 2.1 AA for ICT products. Enterprise customers (public sector, banking) require compliance evidence.

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| Real arena backends for seeding | Tests validate actual API contracts | Requires K8s/VPS backends running |
| ARIA-first assertions | Resilient to CSS changes + enforces a11y | Requires `data-testid` + ARIA markup on pages |
| Docker for visual regression | Pixel-consistent baselines across dev/CI | CI time +2-3 min per run |
| axe-core as CI gate | Automated WCAG compliance | Initial violation backlog to resolve |
| Storybook deferred | Avoid maintaining a parallel component catalog | No isolated component testing (covered by vitest) |

### Alternatives Considered

1. **Storybook + Chromatic** — Full component catalog with visual testing. Rejected: maintenance overhead for 2-person team, STOA components are page-level not reusable library.
2. **Percy (BrowserStack)** — SaaS visual regression. Rejected: vendor lock-in, cost, data leaves EU.
3. **Playwright `toHaveScreenshot` only** — Built-in visual comparison. Chosen as foundation, but needs Docker for consistency and masking convention for dynamic values.

---

## Consequences

- **Phase 1** (this ADR): DataSeeder, ARIA helpers, `data-testid` convention, `@axe-core/playwright` dependency. No CI changes.
- **Phase 2**: Visual regression baselines, cross-validation tests, axe-core CI gate workflow.
- **Ongoing**: Every new page/component must include `data-testid` attributes per convention (`docs/DATA-TESTID-CONVENTION.md` in stoa repo).
- **AI agents**: Can self-verify visual correctness by running `npx playwright test` with seeded data and comparing ARIA snapshots.
