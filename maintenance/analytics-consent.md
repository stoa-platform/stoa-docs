# Docs audience measurement

## Configuration and scope

`src/analytics/config.ts` keeps the existing public STOA measurement ID,
`G-8PL054C7RH`, shared by `gostoa.dev` and `docs.gostoa.dev`. Hostname and the
non-personal `site_section: docs` event parameter distinguish Docs traffic. This
preserves the existing stream and historical data without creating a new stream,
property or identity namespace. An empty or invalid ID disables the Google tag.
The tag is also restricted to HTTPS on the exact `docs.gostoa.dev` hostname.
Localhost and deployment previews can test the choice UI without sending data.

The preset's automatic `gtag` integration is removed. A single Docusaurus client
module loads Google and a configured Clarity project only after a valid acceptance. No Google preconnect, tag
request, event or denied-consent ping is sent by this integration before consent
or following a saved refusal. A permanent, bilingual audience-settings button
supports acceptance and refusal with equal prominence. The compact, bottom-edge
panel is approximately 420 px wide, has no page overlay, and keeps provider,
replay, six-month retention and withdrawal details in a native collapsed
“Learn more / En savoir plus” section. This presentation does not change the
consent record, collection gates, events or routes. The panel follows the active
Docusaurus light/dark surfaces, with a subtle green STOA accent and identical
styling for acceptance and refusal.

The choice is stored in local storage under `stoa.docs.analytics-consent.v2` for
six calendar months. It is renewed only by a new explicit choice. Expired or
malformed records prompt again and disable GA. If storage is unavailable, the
choice applies to the current page session only. Other tabs and an already open
page detect withdrawal/expiry. A late-loading Google script cannot replay an
earlier acceptance after it has been withdrawn.

Advertising storage, user data and personalisation remain denied. Google signals
and advertising personalisation are disabled. The standard GA cookie naming and
domain behavior are retained for continuity across STOA and Docs, with a
six-month maximum configured lifetime and no sliding renewal. Withdrawal
disables the Docs tag immediately and removes accessible `_ga` / `_ga_*`
cookies, plus Clarity `_clck` / `_clsk`, on the Docs host and `.gostoa.dev`, without touching other cookies.
Consent remains per origin. Another STOA origin with valid acceptance may
subsequently create its own measurement cookies again.

## Required stream settings

Before deploying, disable **Enhanced measurement** on the shared stream, or at a
minimum disable **Page changes based on browser history events** and automatic
outbound-click tracking. `send_page_view: false` disables the tag's initial
automatic pageview; it does not disable Enhanced Measurement's history listener.
Leaving that listener active causes duplicate SPA pageviews.

No Google Tag Manager container is required. Do not add another GA tag in the
preset, page head, Vercel dashboard or a tag manager for the same stream.

## Optional Clarity replay recording

`DOCS_CLARITY_PROJECT_ID` selects the authorised shared STOA + Docs project,
`zbgxdbg9n9`. An empty value disables it; it must not use the CAB/Labs project.
The same production-host and consent
gates apply. Version 2 of the preference requires a new choice instead of
silently extending a former Google-only acceptance to replay recording.

Before enabling the ID, select **Strict masking** and **Require cookie consent**
in Clarity. The client adds `data-clarity-mask="true"` to the document root and
existing form fields before the tag loads; descendants remain masked. It sends
`consentv2` with `ad_Storage: denied`, `analytics_Storage: granted`, and only the
fixed custom tag `site_section: docs`. It does not call `identify`.

Clarity is excluded on `/search`, `/feedback`, `/demo` and their French variants,
and is not started if the initial URL or referrer contains query parameters or a
fragment. Input, textarea, select and editable-field focus stops it for the rest
of that document. Google can continue its limited events. Strict masking is not
a claim of anonymity: Clarity still processes interaction and navigation data.

Internal-link and popstate capture handlers stop Clarity before the SDK observes
navigation. A React Router/history transition callback also runs before the
router's programmatic push/replace; it never blocks navigation or replaces the
native history methods. The Docusaurus lifecycle restarts recording after the next safe route only
if no text-entry field has been used. This avoids the SDK's own SPA restart timer
on those navigation paths. Source reviewed: Microsoft Clarity 0.8.77 at
[9e9cc711](https://github.com/microsoft/clarity/blob/9e9cc711d5711153567b76f7a3ca0b6e23db0b22/packages/clarity-js/src/core/history.ts).
Browser/network verification with the actual hosted project is required before
claiming this behavior for that served SDK version.
The router guard uses the existing history prompt slot; a future unsaved-form
prompt must compose with it. Direct native history changes outside this router
are not covered by that callback; the current site has none during recording.

Withdrawal after Clarity has loaded saves refusal, purges tracker cookies and
reloads the document, avoiding a possible SDK-internal restart. A refusal URL
fragment makes that reload fail closed even if local storage cannot be written.
A new acceptance removes that fragment. No reload is performed on input focus.
Do not signal `consentv2: denied` as a substitute for stopping collection: the
SDK can continue cookieless recording and its denied branch restarts internally.

## Events and data minimisation

| Event | Trigger | Payload |
| --- | --- | --- |
| `page_view` | Accepted initial page, then each changed pathname | Clean page URL, clean referrer, fixed title `STOA Docs`, `site_section: docs`, locale |
| `quickstart_click` | Link to the EN/FR quickstart or stoactl quickstart | Same fixed page context; no target URL or link text |
| `github_click` | Link to `github.com/stoa-platform` or its repositories | Same fixed page context; no target URL or link text |
| `social_linkedin_company_click`, `social_linkedin_profile_click`, `social_x_profile_click` | Click on the exact configured LinkedIn CAB Ingénierie, LinkedIn Christophe Aboulicam or X profile URL | Same fixed page context |

URLs contain origin and pathname only. Query strings and fragments are omitted.
External referrers are reduced to their origin. Internal referrers use a clean
pathname. Search text, form values, link text, user IDs and email addresses are
not included. Repeated callbacks or hash/query-only changes do not count as new
pages; going from A to B and back to A counts all three visits. The page visited
before consent is not replayed: acceptance counts the current page once.

Use tagged links to identify social arrivals in GA4. For example, share
`https://docs.gostoa.dev/?utm_source=linkedin&utm_medium=social&utm_campaign=docs&utm_content=post`.
The landing page accepts `linkedin` or `x` as the source, `social` as the medium,
and `docs` as the campaign. Optional content is `company_profile`,
`personal_profile` or `post`. Only these fixed values are sent as campaign
configuration after consent. The page and referrer URLs stay clean. The replay
guard also applies to tagged URLs. For outbound clicks, report by the three
event names above. For arrivals, use the session source, medium and campaign.

## Vercel Analytics replacement

The previous `<Analytics />` and its import are removed from `src/theme/Root.tsx`.
Google Analytics and the optional Clarity replay integration are controlled
by this shared preference. The Vercel package is retained in the lockfile to avoid an
unrelated dependency change; it is not imported by the site. Historical Vercel
dashboards are unchanged and must not be combined with GA counts.

## Verification

1. Run `node --test tests/analytics-consent.test.mjs` with a Node version that
   supports native TypeScript stripping (22.18+ or 23.6+). These tests use a fake
   browser and do not send analytics requests.
2. Check the changed TypeScript and UI, then build both locales using the
   project's installed Docusaurus binary directly:
   `node node_modules/@docusaurus/core/bin/docusaurus.mjs build`.
   Run `node scripts/enrich-sitemap-hreflang.mjs` after a successful build.
   Do not use `npm run build` for this audit: its prebuild hook applies scheduled
   editorial changes. Use an isolated worktree and the authorised build host.
3. In a clean browser session, verify no request to Google before acceptance and
   after refusal. Accept: one tag, one pageview; navigate EN/FR: one pageview per
   pathname. Change hash/query only: no extra pageview.
4. Withdraw while the tag loads and after it loads. Verify no subsequent event,
   including quickstart/GitHub clicks. Verify saved refusal, expiry, storage
   restrictions and a changed choice in another tab.
5. Inspect outgoing payloads: no query, fragment, free text or advertising data.
   Confirm events reach the existing stream with `site_section: docs` and the
   Docs hostname. Loading a script successfully
   alone does not prove ingestion.
6. Compare routes, robots and existing sitemap entries against the base revision.
7. Open a tagged social link and accept analytics. Confirm the campaign fields
   reach GA4 and Clarity stays off on the tagged landing page. On a clean page,
   check that the three social links produce separate events after acceptance.

## Rollback

Revert the consent integration commit only through an explicit decision: the
previous automatic integration did not implement this consent gate. The safe
immediate disable is empty `DOCS_GA_MEASUREMENT_ID` and
`DOCS_CLARITY_PROJECT_ID` values, followed by the normal deployment.
No rollback action should delete the historical stream or Analytics property.

## References

- [Docusaurus 3.9.2 client lifecycle](https://docusaurus.io/docs/3.9.2/advanced/client)
- [Google manual pageviews and SPA history settings](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google basic consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Google privacy controls and disable flag](https://developers.google.com/tag-platform/security/guides/privacy)

- [Microsoft Clarity consent API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Microsoft Clarity masking](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)
