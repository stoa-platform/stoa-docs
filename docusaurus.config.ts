import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import directoryLinks from './scripts/remark-directory-links.mjs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'STOA Docs',
  tagline: 'Sovereign iPaaS — European integration for APIs and AI agents',
  favicon: 'img/favicon.svg',

  trailingSlash: true,

  // SEO & Head Tags
  headTags: [
    // Partial fallback: HTTP-only security headers must be checked at delivery.
    {
      tagName: 'meta',
      attributes: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'",
      },
    },
    {
      tagName: 'meta',
      attributes: {name: 'referrer', content: 'strict-origin-when-cross-origin'},
    },
    {
      tagName: 'link',
      attributes: {rel: 'preload', href: '/fonts/inter/InterVariable.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous'},
    },
    {tagName: 'script', attributes: {src: '/js/theme-cookie.js'}},
    // JSON-LD: Organization
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://www.gostoa.dev/#organization',
        name: 'STOA Platform',
        url: 'https://www.gostoa.dev/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://docs.gostoa.dev/img/logo.svg',
        },
        description: 'Sovereign iPaaS: European integration with its gateway and control plane, including API and MCP capabilities.',
        sameAs: [
          'https://github.com/stoa-platform',
          'https://discord.gostoa.dev',
        ],
      }),
    },
    // JSON-LD: WebSite with SearchAction (enables Google sitelinks search box)
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': 'https://docs.gostoa.dev/#website',
        name: 'STOA Documentation',
        url: 'https://docs.gostoa.dev',
        description: 'Documentation for STOA, the European Sovereign iPaaS, with API and MCP capabilities.',
        publisher: {
          '@id': 'https://www.gostoa.dev/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://docs.gostoa.dev/search/?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    // JSON-LD: SoftwareApplication
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'STOA Platform',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Kubernetes',
        url: 'https://www.gostoa.dev/',
        description: "Sovereign iPaaS with API and MCP capabilities. STOA's published code is open source under the Apache 2.0 licence.",
      }),
    },
  ],

  // Enable Mermaid diagrams
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        language: ['en', 'fr'],
        hashed: true,
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        docsRouteBasePath: '/docs',
        blogRouteBasePath: '/blog',
        explicitSearchResultPath: true,
      },
    ],
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.gostoa.dev',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'stoa-platform', // Usually your GitHub org/user name.
  projectName: 'stoa-docs', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  // Internationalization — FR + EN with locale dropdown (CAB-1383)
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    localeConfigs: {
      en: {label: 'English', htmlLang: 'en-US'},
      fr: {label: 'Français', htmlLang: 'fr-FR'},
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          remarkPlugins: [directoryLinks],
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/stoa-platform/stoa-docs/tree/main/',
        },
        blog: {
          remarkPlugins: [directoryLinks],
          blogTitle: 'STOA Blog — AI Gateway, MCP & Migration Guides',
          blogDescription: 'Tutorials, comparisons, and migration guides for MCP gateways, AI agent architecture, and open-source API management.',
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/stoa-platform/stoa-docs/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['**/tags/**', '/blog/page/**', '/blog/archive/', '/docs/category/**', '**/web-analytics', '**/404.html', '/docs/fr/docs/guides/quickstart/', '/docs/reference/adr/stoactl-cli/', '/markdown-page/', '/mcp-servers/', '/docs/trademarks/', '/docs/legal/'],
          filename: 'sitemap.xml',
          createSitemapItems: async (params) => {
            const {defaultCreateSitemapItems, ...rest} = params;
            const items = await defaultCreateSitemapItems(rest);
            return items.map((item) => {
              // Set higher priority for important pages
              if (item.url === 'https://docs.gostoa.dev/') {
                return {...item, priority: 1.0, changefreq: 'daily'};
              }
              if (item.url.includes('/docs/')) {
                return {...item, priority: 0.8};
              }
              if (item.url.includes('/blog/')) {
                return {...item, priority: 0.6};
              }
              return item;
            });
          },
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Global metadata — used as defaults for all pages
    metadata: [
      {name: 'robots', content: 'index, follow, max-image-preview:large'},
      {name: 'description', content: 'STOA documentation — Sovereign iPaaS with its gateway and control plane. European integration, API and MCP capabilities, and migration guides.'},
      {name: 'keywords', content: 'API gateway, MCP, Model Context Protocol, AI gateway, open source, Kubernetes, multi-tenant, European, NIS2, DORA, STOA, API gateway migration, webMethods alternative, Apigee alternative'},
      {name: 'author', content: 'STOA Platform'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'STOA Documentation'},
      {property: 'og:image', content: 'https://docs.gostoa.dev/img/stoa-social-card.png'},
      {name: 'twitter:card', content: 'summary_large_image'},
      {name: 'twitter:site', content: '@stoagateway'},
      {name: 'twitter:image', content: 'https://docs.gostoa.dev/img/stoa-social-card.png'},
    ],
    announcementBar: {
      id: 'oss-launch-2026',
      content:
        "STOA's published code is open source under the Apache 2.0 licence.",
      backgroundColor: '#1a1a2e',
      textColor: '#e0e0e0',
      isCloseable: true,
    },
    // Social card for link previews (PNG — SVG not supported by social platforms)
    image: 'img/stoa-social-card.png',
    // Mermaid diagram theming
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'STOA',
      logo: {
        alt: 'STOA Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {to: '/docs/tutorials/', label: 'Tutorials', position: 'left'},
        {to: '/blog/', label: 'Blog', position: 'left'},
        {to: '/docs/reference/changelog/', label: 'Release Notes', position: 'left'},
        {
          href: 'https://github.com/stoa-platform',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro/',
            },
            {
              label: 'Guides',
              to: '/docs/guides/quickstart/',
            },
            {
              label: 'API Reference',
              to: '/docs/api/control-plane/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/stoa-platform',
            },
            {
              label: 'Discord',
              href: 'https://discord.gostoa.dev',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog/',
            },
            {
              label: 'Main Website',
              href: 'https://www.gostoa.dev/',
            },
            {
              label: 'Privacy',
              to: '/docs/legal/privacy/',
            },
            {
              label: 'Trademark Notice',
              to: '/docs/legal/trademarks/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} STOA Platform. STOA's published code is open source under the Apache 2.0 licence. Documentation content: CC BY 4.0. Built with Docusaurus. All third-party trademarks are the property of their respective owners.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
