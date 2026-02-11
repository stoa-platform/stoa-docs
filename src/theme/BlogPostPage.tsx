// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
//
// Swizzled wrapper: injects TechArticle JSON-LD structured data on blog posts
// for better Google rich results and SERP appearance.
import React from 'react';
import BlogPostPage from '@theme-original/BlogPostPage';
import type BlogPostPageType from '@theme/BlogPostPage';
import type {WrapperProps} from '@docusaurus/types';
import Head from '@docusaurus/Head';

type Props = WrapperProps<typeof BlogPostPageType>;

export default function BlogPostPageWrapper(props: Props): React.ReactElement {
  const {content} = props;
  const {metadata} = content;

  const tags = metadata.tags?.map((t) => t.label) || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: metadata.title,
    description: metadata.description || '',
    datePublished: metadata.date,
    ...(metadata.lastUpdatedAt && {dateModified: metadata.lastUpdatedAt}),
    author: {
      '@type': 'Organization',
      name: 'STOA Platform',
      url: 'https://gostoa.dev',
    },
    publisher: {
      '@id': 'https://gostoa.dev/#organization',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://docs.gostoa.dev${metadata.permalink}`,
    },
    image: 'https://docs.gostoa.dev/img/stoa-social-card.png',
    proficiencyLevel: 'Expert',
    ...(tags.length > 0 && {keywords: tags.join(', ')}),
    isPartOf: {
      '@id': 'https://docs.gostoa.dev/#website',
    },
    inLanguage: 'en',
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Head>
      <BlogPostPage {...props} />
    </>
  );
}
