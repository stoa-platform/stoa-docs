import React from 'react';
import Head from '@docusaurus/Head';
import { Analytics } from '@vercel/analytics/react';

// JSON-LD Structured Data for SEO
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://gostoa.dev/#organization',
      name: 'STOA Platform',
      url: 'https://gostoa.dev',
      logo: {
        '@type': 'ImageObject',
        url: 'https://docs.gostoa.dev/img/logo.svg',
      },
      sameAs: [
        'https://github.com/stoa-platform',
        'https://discord.gg/stoa-platform',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://docs.gostoa.dev/#website',
      url: 'https://docs.gostoa.dev',
      name: 'STOA Documentation',
      description: 'Cloud-native API management platform built on Kubernetes with GitOps-first architecture',
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
    },
    {
      '@type': 'SoftwareApplication',
      name: 'STOA Platform',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Kubernetes',
      description: 'Open-source API management platform with multi-tenant architecture, GitOps-first configuration, and MCP Gateway for AI agents',
      url: 'https://gostoa.dev',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
};

export default function Root({children}: {children: React.ReactNode}) {
  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      {children}
      <Analytics />
    </>
  );
}
