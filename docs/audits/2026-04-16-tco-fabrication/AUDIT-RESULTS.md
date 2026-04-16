# TCO Fabrication Audit — Results

- **Ticket**: [CAB-2070](https://linear.app/hlfh-workspace/issue/CAB-2070)
- **Date**: 2026-04-16
- **Detector**: `P1_UNSOURCED_TCO` (shipped by CAB-2069, PR stoa-docs#157)
- **Scope**: 11 articles named in CAB-2070 + SMB buying guide (memory-flagged) + build-vs-buy baseline (CAB-2069 regression check) = 14 articles total

## Phase 1 — Initial audit

| Article | P0 | P1 |
|---|---|---|
| 2026-01-25-webmethods-migration-guide | 0 | 0 |
| 2026-02-07-apigee-alternative-open-source | 0 | 0 |
| 2026-02-11-api-gateway-migration-guide-2026 | 0 | 0 |
| 2026-02-11-datapower-tibco-migration-guide | 0 | 0 |
| 2026-02-11-mulesoft-migration-open-source-gateway | 0 | 0 |
| 2026-02-12-axway-api-gateway-migration-open-source | 0 | 0 |
| 2026-02-12-wso2-api-manager-open-source-alternative | 0 | 0 |
| 2026-03-17-saas-playbook-part-1-multi-tenancy-101 | 0 | 0 |
| **2026-03-19-smb-api-gateway-buying-guide-2026** | 0 | **6** |
| 2026-03-24-saas-playbook-part-2-rate-limiting-saas | 0 | 0 |
| 2026-03-26-saas-playbook-part-3-audit-compliance | 0 | 0 |
| 2026-03-31-saas-playbook-part-4-scaling-multi-tenant | 0 | 0 |
| 2026-04-02-saas-playbook-part-5-production-checklist | 0 | 0 |
| 2026-04-07-saas-playbook-build-vs-buy-api-gateway | 0 | 0 |
| **Total** | **0** | **6** |

### SMB buying guide — 6 P1 detail

All violations in the same Dimension 4 TCO table:

- Line 135: STOA self-hosted row (`~€30-50 / ~€200-500`)
- Line 136: Kong CE self-hosted row (`~€30-50 / ~€200-500`)
- Line 137: Gravitee self-hosted row (`~€80-120 / ~€400-800`)
- Line 138: AWS API Gateway row (`$3.50/million`)
- Line 139: Kong Konnect row (`~€500+/month`)
- Line 140: Cloudflare Workers row (`~€50+`)

Pattern: markdown table rows containing EUR/USD amounts without a markdown link to a primary source within ±10 lines of context. The "illustrative ranges" disclaimer below the table was close but unlinked.

## Phase 2 — Remediation

**Waves compressed to 1**: Only the SMB buying guide required remediation. The other 11 target articles and the build-vs-buy baseline were already clean under the `P1_UNSOURCED_TCO` detector.

**PR scope**: single PR (this one). No sales comms notification required (GTM messaging unchanged on exactly 1 article; ticket threshold is >=2).

### Changes applied to `blog/2026-03-19-smb-api-gateway-buying-guide-2026.md`

Following the CAB-2069 pattern:

1. Bumped `<!-- last verified: 2026-02 -->` → `2026-04`
2. Added `> **Corrections & Updates (2026-04-16)**` block flagging the revision
3. Replaced the 6-row TCO table with a qualitative framework:
   - **Self-hosted options** — link to AWS / GCP / Azure pricing calculators for node sizing + link to Gravitee architecture docs for the Elasticsearch dependency
   - **Managed options** — link to each vendor's public pricing page (AWS API Gateway, Cloudflare Workers, Kong Konnect)
   - Preserved the qualitative conclusion: self-hosted wins past moderate scale; managed stays competitive at low volume + for teams without platform capacity

## Phase 3 — Re-audit

| Article | P0 | P1 |
|---|---|---|
| (all 14 articles) | 0 | 0 |

**Result**: `0 P0, 0 P1` across all 14 articles. DoD met.

## Evidence

Per-article audit output (post-remediation, ANSI raw) is archived alongside this file:

```
2026-01-25-webmethods-migration-guide.out
2026-02-07-apigee-alternative-open-source.out
2026-02-11-api-gateway-migration-guide-2026.out
2026-02-11-datapower-tibco-migration-guide.out
2026-02-11-mulesoft-migration-open-source-gateway.out
2026-02-12-axway-api-gateway-migration-open-source.out
2026-02-12-wso2-api-manager-open-source-alternative.out
2026-03-17-saas-playbook-part-1-multi-tenancy-101.out
2026-03-19-smb-api-gateway-buying-guide-2026.out
2026-03-24-saas-playbook-part-2-rate-limiting-saas.out
2026-03-26-saas-playbook-part-3-audit-compliance.out
2026-03-31-saas-playbook-part-4-scaling-multi-tenant.out
2026-04-02-saas-playbook-part-5-production-checklist.out
2026-04-07-saas-playbook-build-vs-buy-api-gateway.out
```

## Notes on detector coverage

The CAB-2069 detector is deliberately narrow — "markdown currency row in a table without an inline source link in ±10 context lines". It does **not** catch:

- Non-tabular fabricated figures (prose claims like "saves €40k/year")
- Engineering-weeks tables without currency symbols
- Sourced-but-stale figures (primary link present but vendor pricing has since changed)

That narrowness is intentional (high precision on the original incident shape, low false-positive rate). The 11-article clean result means the rest of the blog surface uses either qualitative framing or properly linked figures — not that the content is fully audited against every form of fabricated claim.

Future detector extensions (out of scope for CAB-2070) could add:

- Engineering-weeks table rows with `€[0-9]` amounts
- Loose prose `€[0-9]+k` / `€[0-9]+m` numbers without adjacent link
- Time-decay warning when `last verified` is older than N months

## Links

- Linear: [CAB-2070](https://linear.app/hlfh-workspace/issue/CAB-2070) (this ticket) | [CAB-2069](https://linear.app/hlfh-workspace/issue/CAB-2069) (detector + build-vs-buy fix)
- PR CAB-2069: [stoa-docs#157](https://github.com/stoa-platform/stoa-docs/pull/157) (`7a79e9a`)
- Script: `stoa-docs/scripts/audit-content-compliance.sh`
- Rule source: `stoa/.claude/rules/content-compliance.md`
