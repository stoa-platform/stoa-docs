<!--
Fixture for P1_REGULATORY_CLAIM detector — MUST pass (exit 0, no P1).

Every regulatory-framework + state-verb pair is either:
  (a) accompanied by a markdown link to an official source in its ±10 line
      context (eur-lex.europa.eu, enisa.europa.eu, iso.org, nist.gov), or
  (b) worded with a whitelisted softener ("supports compliance with",
      "helps you comply with"), or
  (c) scoped to gostoa.dev's own claims.
-->

# Regulatory Positioning Fixture — Sourced

This file is intentionally constructed so every regulatory claim has either
a primary-source link or a whitelisted softener, so `P1_REGULATORY_CLAIM`
must return zero findings here.

## DORA — sourced

STOA supports compliance with the EU Digital Operational Resilience Act
(DORA), as defined in
[Regulation (EU) 2022/2554](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554).
Operators remain responsible for the formal aligned posture their
organisation adopts.

## AI Act — softened

STOA helps you comply with the EU AI Act (Regulation (EU) 2024/1689).
See [eur-lex.europa.eu](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
for the certified text.

## NIS2 — official ENISA reference

The NIS2 Directive establishes the baseline for network and information
security. ENISA's guidance at
[enisa.europa.eu](https://www.enisa.europa.eu/topics/cybersecurity-policy/nis-directive-new)
is the primary source operators use to determine whether their STOA
deployment is aligned with sector-specific requirements.

## ISO 27001 — sourced

STOA's logging posture is aligned with clauses referenced in
[ISO/IEC 27001:2022](https://www.iso.org/standard/27001) (Annex A.8.15,
logging). Annex mapping is a per-operator exercise; no STOA claim of
certified status is made.

## GDPR — gostoa.dev scope

STOA's own GDPR posture is documented at
[gostoa.dev/legal](https://gostoa.dev/legal).
