# STOA Docs — Sovereign iPaaS

Documentation for STOA, a European Sovereign iPaaS with its gateway and control
plane, API management and MCP capabilities. Built with Docusaurus 3.9.2, React
and TypeScript, in English and French.

Public site: <https://docs.gostoa.dev/>. Main website: <https://www.gostoa.dev/>.

## Development

Use Node.js **≥ 20**, consistent with `package.json`, and npm with the committed
lockfile. Select a supported Node LTS when preparing CI.

After obtaining this checkout:

```bash
npm ci
npm start
```

## Production artifact

The output is **`build/`**. To validate source changes without applying scheduled
blog publication, use the installed binary directly, then run post-processing:

```bash
npm run typecheck
./node_modules/.bin/docusaurus build
npm run postbuild
```

`npm run build` also runs `prebuild`, which applies scheduled blog changes based
on the date. Use a disposable checkout for that editorial workflow and review
its effects separately. Do not include those effects in a hosting change.

The Markdown/MDX compiler normalizes absolute internal links for client navigation.
Postbuild enriches the EN/FR sitemaps, normalizes legacy absolute internal links
against generated directory indexes, puts CSP and referrer metadata before
executable scripts, and generates the compatibility pages from `redirects.json`.
It refuses to overwrite existing pages or redirect to a missing directory index.
Those pages return **HTTP 200**, with meta refresh, rather than HTTP 301.

## Hosting target and publication

The target is **Scaleway Object Storage + Edge Services, Paris**. Directory indexes
use trailing slashes. The single error document is root **`404.html`**, bilingual
EN/FR, with `noindex` and links to both home pages.

Publication of **`build/` by GitHub Actions is a separate PR**. No deployment is
implemented here and no Vercel previews are part of the target. Validate routes,
MIME, cache, search, error status and security headers in preproduction before
switching the public site. Keep `vercel.json` and any existing rollback
configuration; the six historical Vercel redirects remain available there.

The site removes audience analytics and uses local EN/FR search with
`@easyops-cn/docusaurus-search-local`. Docs, blog posts and pages are indexed at
build time. The site serves the search index; queries run in the browser and are
not sent to a third party.
Fonts are self-hosted with licences alongside the files. The documentation
[privacy policy](docs/legal/privacy.md) describes processing and the theme cookie.

## Content and related public repositories

- `docs/`: English documentation; `i18n/fr/`: French translations.
- `src/`: pages, components, styles and light theme customizations.
- `static/`: public assets, fonts and assistant indexes.
- [stoa](https://github.com/stoa-platform/stoa): main public product repository;
  its `quickstart/` directory is the primary local R1 path.
- [stoa-quickstart](https://github.com/stoa-platform/stoa-quickstart): separate
  public quickstart repository.

Other components are not published. R1 currently uses the Rust gateway; Envoy is
the accepted target data plane, with migration ahead. Quickstart execution on a
fresh clone has not been attested; the canonical guide marks validation in progress.

## Contributing and licences

Use clear language, keep EN/FR aligned and validate examples against the release.
See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
and [GOVERNANCE.md](GOVERNANCE.md).

STOA's published code is open source under the Apache 2.0 licence.
Le code publié de STOA est open source, sous licence Apache 2.0

This does not extend to services, unpublished components or branding.
See [LICENSE](LICENSE) and [NOTICE](NOTICE). Documentation content remains under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
