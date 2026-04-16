<!--
Fixture for P1_UNSOURCED_TCO detector — should PASS (exit 0, no P1 findings).
Every currency row in a table is accompanied by a markdown link to a primary
source within ±10 lines, or uses a whitelisted marker (Vendor-dependent,
"see vendor pricing", gostoa.dev, or "See ... calculator").
-->

# Sourced TCO Fixture

This file is intentionally constructed so every Euro/dollar amount in a
markdown table has a corresponding external source link in its ±10 line
context, so the `P1_UNSOURCED_TCO` detector MUST return zero findings here.

## Engineer cost (sourced via Levels.fyi)

Per-day loaded cost based on [Levels.fyi](https://www.levels.fyi/) senior
engineer compensation for the relevant metro.

| Role | Base range | Loaded per-day |
|---|---|---|
| Senior backend | €90k-€130k | ~€650 |
| Staff backend | €130k-€180k | ~€950 |

## Infrastructure (sourced via AWS calculator)

Estimate built in the [AWS Pricing Calculator](https://calculator.aws/) for a
two-node EKS + small RDS Postgres scenario.

| Component | Monthly |
|---|---|
| 2x m6i.large (reserved) | ~€110 |
| RDS Postgres db.t4g.small | ~€40 |

## Managed gateway (see vendor pricing)

| Vendor | Model |
|---|---|
| Vendor A | Per-request, see vendor pricing page |
| Vendor B | Subscription, Vendor-dependent |
| Vendor C | Per-million, see AWS pricing |

## STOA pricing (gostoa.dev)

Published tiers are on [gostoa.dev](https://gostoa.dev/pricing).

| Tier | Monthly |
|---|---|
| Starter | €99 |
| Growth | €499 |
