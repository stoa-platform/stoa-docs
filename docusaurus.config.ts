import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'STOA — Open-Source AI API Gateway',
  tagline: 'Modernize Your API Gateway — MCP, Multi-Tenant, European Sovereign',
  favicon: 'img/favicon.ico',

  // Note: trailingSlash left undefined (Docusaurus default) because existing
  // relative links in index.md files break with both true and false.
  // TODO: fix all relative links then set trailingSlash: false for SEO.

  // SEO & Head Tags
  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'robots',
        content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      },
    },
    // JSON-LD: Organization
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://gostoa.dev/#organization',
        name: 'STOA Platform',
        url: 'https://gostoa.dev',
        logo: {
          '@type': 'ImageObject',
          url: 'https://docs.gostoa.dev/img/logo.svg',
        },
        description: 'Open-source AI-native API gateway for MCP and enterprise workloads.',
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
        description: 'Documentation, guides, and migration tutorials for STOA — the open-source AI-native API gateway.',
        publisher: {
          '@id': 'https://gostoa.dev/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://docs.gostoa.dev/search?q={search_term_string}',
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
        license: 'https://www.apache.org/licenses/LICENSE-2.0',
        url: 'https://gostoa.dev',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          description: 'Open source — Apache 2.0 license',
        },
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
  themes: ['@docusaurus/theme-mermaid'],

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

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/stoa-platform/stoa-docs/tree/main/',
        },
        blog: {
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
        // Google Analytics
        gtag: {
          trackingID: 'G-8PL054C7RH',
          anonymizeIP: true,
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['**/tags/**', '/blog/page/**', '/blog/archive', '/docs/category/**', '**/web-analytics'],
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
      {name: 'description', content: 'STOA documentation — open-source API gateway for AI agents. MCP support, multi-tenant isolation, migration guides from webMethods, Apigee, Kong. NIS2/DORA ready.'},
      {name: 'keywords', content: 'API gateway, MCP, Model Context Protocol, AI gateway, open source, Kubernetes, multi-tenant, European, NIS2, DORA, STOA, API gateway migration, webMethods alternative, Apigee alternative'},
      {name: 'author', content: 'STOA Platform'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'STOA Documentation'},
      {property: 'og:image', content: 'https://docs.gostoa.dev/img/stoa-social-card.png'},
      {name: 'twitter:card', content: 'summary_large_image'},
      {name: 'twitter:site', content: '@stoaplatform'},
      {name: 'twitter:image', content: 'https://docs.gostoa.dev/img/stoa-social-card.png'},
    ],
    announcementBar: {
      id: 'demo-day-2026',
      content:
        '📣 STOA Demo Day — Feb 24, 2026. <a target="_blank" rel="noopener noreferrer" href="https://github.com/stoa-platform/stoa/discussions">Join the discussion</a>',
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
    algolia: {
      appId: 'GIWP67WK7V',
      apiKey: '6f5bb332c047a35c99fd3a151c44cc7f',
      indexName: 'Stoa Blog',
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
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/stoa-platform',
          label: 'GitHub',
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
              to: '/docs/intro',
            },
            {
              label: 'Guides',
              to: '/docs/guides/quickstart',
            },
            {
              label: 'API Reference',
              to: '/docs/api/control-plane',
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
              to: '/blog',
            },
            {
              label: 'Main Website',
              href: 'https://gostoa.dev',
            },
            {
              label: 'Trademark Notice',
              to: '/docs/trademarks',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} STOA Platform. Built with Docusaurus. All third-party trademarks are the property of their respective owners.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
