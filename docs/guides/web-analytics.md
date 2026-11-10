---
sidebar_position: 4
title: "Web Analytics"
description: "How STOA Docs measures visits and masked session replays after your permission."
keywords: [analytics, Google Analytics, consent, privacy]
custom_edit_url: null
---

# Web Analytics

STOA Docs uses Google Analytics to understand which documentation pages are useful and whether visitors reach the quick start or the STOA GitHub repositories. Microsoft Clarity can also provide masked replays of page interactions. Both load only after you choose **Allow** in the audience panel.

## Your choice

You can **Decline** and continue using all documentation. The permanent **Audience settings** button lets you change your choice at any time. Acceptance and refusal are saved for six calendar months, then the site asks again. If your browser blocks local storage, your choice applies only to the current page session.

Before acceptance, after refusal, or once your choice expires, the site does not load Google Analytics or Clarity, or send their measurement events. Withdrawing permission also disables an already loaded tag and removes accessible `_ga`, `_clck` and `_clsk` measurement cookies on Docs and its parent domain. If Clarity was loaded, the page reloads to end that recording context. It does not erase historical aggregate reports. Your choice applies to this website; another STOA website with permission may create measurement cookies again.

## What is measured

- A page visit after permission, then one event for each new documentation path.
- A click on a quick-start guide link.
- A click on a STOA GitHub organisation or repository link.

The events contain a clean page address, a fixed site label and the interface language. Query strings, URL fragments, search text, form content, link text, email addresses and user IDs are not included. External referral addresses are reduced to their origin. Advertising storage, advertising personalisation and Google signals are disabled.

The documentation and the STOA marketing website use the existing STOA measurement stream. Hostname and the `site_section` field distinguish their traffic. This preserves the historical reporting stream.

## Masked interaction replays

Clarity uses strict content masking, including a `data-clarity-mask` attribute covering the page and form fields. It does not receive an application user ID. Recording stops when you focus a text-entry field, and is excluded from dedicated search, feedback and demo pages. It is not started on pages whose initial address or referrer has query parameters or a fragment.

Masked replays still contain interaction and navigation data; they are not described as anonymous. The URL cleaning rules above apply to the explicit Google events, not a replacement of Clarity's own metadata.

## Previous Vercel Analytics integration

The site's previous Vercel Analytics component has been removed. Google Analytics and the optional Clarity replay recorder are controlled by your shared choice. Historical Vercel reports remain separate and are not combined with Google Analytics counts.

## Deployment notes

The public measurement ID is configured in `src/analytics/config.ts`; an empty value disables measurement. The automatic Docusaurus Google Analytics preset is not used. Do not add a second tag.

Page visits are measured with the Docusaurus route lifecycle. The stream's automatic pageviews on history changes and automatic outbound-click tracking must remain disabled to avoid duplicate events. The site's explicit events are `page_view`, `quickstart_click` and `github_click`.

See the repository's [audience measurement runbook](https://github.com/stoa-platform/stoa-docs/blob/main/maintenance/analytics-consent.md) for verification and rollback. A loaded script alone does not demonstrate that events were received; ingestion must be confirmed in Google Analytics.
