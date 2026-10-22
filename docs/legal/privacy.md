---
title: Documentation Privacy
description: Documentation website processing and theme preference.
sidebar_position: 3
---

This policy covers the documentation website. STOA services and commercial correspondence require information specific to their own processing.

## Controller and rights

CAB Ingénierie is the publisher. [À COMPLÉTER : full legal identity and contact for data rights]. You may request access, correction, erasure and, depending on the processing, restriction or objection, and complain to the CNIL.

## Hosting and logs

Pages are stored and delivered in Paris using Scaleway Object Storage and Edge Services.

| Processing | Data and purpose | Retention |
|---|---|---|
| Edge Services logs | IP address, date, time, method, requested path, HTTP/TLS information, browser, country and status; security and operation | 7 days in Paris |
| Edge Services technical metrics | Request, cache and country aggregates; operation | 31 days |
| Object Storage access logs | Not enabled | Not applicable |

Security and operation rely on legitimate interest. Logs are not used for audience measurement. Neither Google Analytics nor Vercel Analytics is integrated into the site.

## Processors and search

- Scaleway: hosting and page delivery.
- Cloudflare: DNS and bare-domain redirection for the main website. Requests to that domain may pass through its worldwide network. [À COMPLÉTER : applicable retention and transfer safeguards].
- Algolia DocSearch: retained third-party search service. Searching sends the query and technical connection information to Algolia. [À COMPLÉTER : location, retention, legal basis, recipients and transfer safeguards].

Retaining Algolia and its contractual framework remain open decisions. Paris hosting alone does not establish the absence of transfers outside the European Union. Fonts and theme assets are self-hosted.

## Theme preference

The functional `stoa-theme` cookie contains only `light` or `dark`, with no identifier. It remembers the visitor’s requested colour preference, with a proposed lifetime of 12 months, pending Legal confirmation. It uses `Path=/; SameSite=Lax; Secure` and domain `.gostoa.dev` when the host is that domain or one of its subdomains; elsewhere it remains host-only.

Docusaurus also retains this preference in browser local storage. You can remove these preferences in browser settings. Consent exemption for this preference remains subject to Legal confirmation. The site adds no other cookies or audience trackers; third-party search behaviour remains to be verified.

## Pending details

[À COMPLÉTER : legal validation of the processing table, processors and data rights information before publication].
