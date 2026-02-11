// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
//
// Swizzled wrapper: injects BreadcrumbList JSON-LD structured data on doc pages
// for better Google rich results (breadcrumb trail in search results).
import React from 'react';
import DocItem from '@theme-original/DocItem';
import type DocItemType from '@theme/DocItem';
import type {WrapperProps} from '@docusaurus/types';
import Head from '@docusaurus/Head';

type Props = WrapperProps<typeof DocItemType>;

const BASE_URL = 'https://docs.gostoa.dev';

const sectionNames: Record<string, string> = {
  architecture: 'Architecture',
  adr: 'ADR',
  concepts: 'Concepts',
  guides: 'Guides',
  migration: 'Migration',
  fiches: 'Technical Guides',
  api: 'API Reference',
  reference: 'Reference',
  crds: 'CRDs',
  enterprise: 'Enterprise',
  deployment: 'Deployment',
  governance: 'Governance',
  community: 'Community',
};

function buildBreadcrumbs(permalink: string): Array<{name: string; item: string}> {
  const crumbs: Array<{name: string; item: string}> = [
    {name: 'Docs', item: `${BASE_URL}/docs/intro`},
  ];

  const path = permalink.replace(/^\/docs\//, '');
  const segments = path.split('/').filter(Boolean);
  let accumulated = '/docs';

  for (const segment of segments) {
    accumulated += `/${segment}`;
    const label = sectionNames[segment] || segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({name: label, item: `${BASE_URL}${accumulated}`});
  }

  return crumbs;
}

export default function DocItemWrapper(props: Props): React.ReactElement {
  const {metadata} = props.content;
  const breadcrumbs = buildBreadcrumbs(metadata.permalink);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Head>
      <DocItem {...props} />
    </>
  );
}
