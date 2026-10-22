import React from 'react';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

export default function NotFoundContent({className = ''}: {className?: string}) {
  return (
    <main className={`container margin-vert--xl ${className}`}>
      <Head><meta name="robots" content="noindex, follow" /></Head>
      <section lang="en">
        <Heading as="h1">Page not found</Heading>
        <p>This page does not exist or has moved.</p>
        <Link to="/">English home</Link>
      </section>
      <section lang="fr" className="margin-top--lg">
        <Heading as="h2">Page introuvable</Heading>
        <p>Cette page n’existe pas ou a été déplacée.</p>
        <Link to="pathname:///fr/">Accueil français</Link>
      </section>
    </main>
  );
}
