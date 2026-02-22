# Content TODO — Internal Links Tracking

Links referenced in published/scheduled articles that point to articles or pages not yet created.

## Broken Internal Links (as of 2026-02-22)

### Phase 3 Examples — stoa-quickstart (CAB-1393)

Referenced in Phase 2 articles but not yet created in stoa-quickstart repo:
- `stripe-api-proxy` — Stripe API behind STOA with rate limiting
- `notion-mcp-bridge` — Notion API exposed as MCP tool
- `multi-tenant-saas` — Multi-tenant API gateway setup
- `jwt-auth-gateway` — JWT validation + RBAC
- `openai-proxy` — OpenAI API proxy with token budgets

**Ticket**: CAB-1393 Phase 3 | **Target**: stoa-quickstart repo

---

## Valid Links Verified (2026-02-22)

### Blog articles that exist and are referenced
- `/blog/hello-world-api-gateway-freelancer` — 2026-03-04 (scheduled, unlisted)
- `/blog/week-1-operations` → actually `/docs/guides/week-1-operations` (guide, not blog)
- `/blog/freelancer-api-security-part-1-vulnerabilities` — 2026-03-11 (scheduled, unlisted)
- `/blog/freelancer-api-security-part-2-rate-limiting` — 2026-03-12 (scheduled, unlisted)
- `/blog/freelancer-api-security-part-3-audit-trails` — 2026-03-13 (scheduled, unlisted)
- `/blog/stoa-quickstart-first-api-5-minutes` — 2026-02-20 ✅ published
- `/blog/convert-rest-api-to-mcp-tools` — 2026-02-12 ✅ published
- `/blog/stoa-docker-compose-local-development` — 2026-02-28 ✅ published
- `/blog/why-apache-2-not-bsl` — 2026-02-19 ✅ published
- `/blog/api-security-checklist-solo-dev` — 2026-02-14 ✅ published

### Docs pages that exist and are referenced
- `/docs/guides/quick-start` ✅
- `/docs/guides/portal` ✅
- `/docs/guides/consumer-onboarding` ✅
- `/docs/guides/authentication` ✅
- `/docs/guides/observability` ✅
- `/docs/deployment/hybrid-deployment` ✅
- `/docs/guides/week-1-operations` — 2026-02-22 ✅ created (CAB-1393 Phase 1)

---

## Scheduled Publishing Dates

| Article | File Date | `unlisted: true` | Goes Live |
|---------|-----------|------------------|-----------|
| Hello World Freelancer | 2026-03-04 | ✅ | 2026-03-04 |
| Security Part 1 | 2026-03-11 | ✅ | 2026-03-11 |
| Security Part 2 | 2026-03-12 | ✅ | 2026-03-12 |
| Security Part 3 | 2026-03-13 | ✅ | 2026-03-13 |

All future-dated articles have `unlisted: true` in frontmatter per SEO rules.
The daily CI cron (`manage-scheduled-posts.sh`) removes `unlisted: true` on the publish date.

---

## Maintenance Notes

- Update this file whenever a new article creates forward-links to unwritten articles
- Remove entries when the linked article is published
- This file is NOT served by Docusaurus (no frontmatter) — it's a dev artifact
