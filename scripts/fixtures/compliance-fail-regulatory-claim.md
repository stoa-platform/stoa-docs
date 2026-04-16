<!--
Fixture for P1_REGULATORY_CLAIM detector — MUST fail (exit 2, >=1 P1).

Every regulatory-framework + state-verb pair is unsourced: no markdown link
to an official source within +-10 lines, no whitelisted softener, no scoping
to gostoa.dev.

Deliberately avoids phrasings already covered by P0_CERTIFICATION_PATTERNS
so this fixture isolates the new P1 logic (uses aligned / ready /
conformant verbs with frameworks that escape the pre-existing P0 rules).
-->

# Regulatory Positioning Fixture — Fabricated

This file is intentionally wrong on purpose. Each claim should trip the
`P1_REGULATORY_CLAIM` detector.

## DORA — no source

The gateway platform ships DORA aligned out of the box. The architecture
was designed from day one to meet Digital Operational Resilience Act
requirements.

## AI Act — no source

Runtime posture is AI Act aligned across every deployment mode.
Alignment was validated internally, no external auditor was engaged.

## NIS2 — no source

Every gateway instance is NIS2 ready. The incident response pipeline maps
to the directive's sector annexes.

## GDPR — no source

Data subject rights are GDPR aligned across all tenants. Pseudonymisation
primitives are implemented in the default audit policy.

## HIPAA — no source

Healthcare tenants are HIPAA conformant. PHI handling is covered by the
default audit policy with no operator-side configuration needed.
