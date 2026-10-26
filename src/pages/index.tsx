// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import QuickStartCode from '@site/src/components/QuickStartCode';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          <Translate id="homepage.hero.title">STOA Docs</Translate>
        </Heading>
        <p className="hero__subtitle">
          <Translate id="homepage.hero.tagline">
            Sovereign iPaaS — European integration for APIs and AI agents
          </Translate>
        </p>
        <p className={styles.heroDescription}>
          <Translate id="homepage.hero.description">
            Explore STOA with its gateway and control plane: integration contracts,
            API management and agent access through MCP.
          </Translate>
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro/">
            <Translate id="homepage.hero.btn.docs">📚 Documentation</Translate>
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/guides/quickstart/">
            <Translate id="homepage.hero.btn.getStarted">🚀 Get Started</Translate>
          </Link>
          <Link
            className="button button--outline button--lg"
            href="https://github.com/stoa-platform">
            ⭐ GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function QuickStartSection() {
  return (
    <section className={styles.quickstart}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">
            <Translate id="homepage.quickstart.title">⚡ Quick Start</Translate>
          </Heading>
          <p>
            <Translate id="homepage.quickstart.subtitle">
              Start locally with Docker Compose from the public stoa repository. Execution validation is in progress.
            </Translate>
          </p>
        </div>
        <QuickStartCode />
      </div>
    </section>
  );
}

type FeatureItem = {
  titleId: string;
  titleDefault: string;
  icon: string;
  descriptionId: string;
  descriptionDefault: string;
};

const FeatureList: FeatureItem[] = [
  {
    titleId: 'homepage.feature.mcp.title',
    titleDefault: 'MCP Gateway',
    icon: '🤖',
    descriptionId: 'homepage.feature.mcp.desc',
    descriptionDefault:
      'Native Model Context Protocol support. Let AI agents discover and call your APIs automatically with full governance and audit trails.',
  },
  {
    titleId: 'homepage.feature.multiTenant.title',
    titleDefault: 'Multi-Tenant',
    icon: '🏢',
    descriptionId: 'homepage.feature.multiTenant.desc',
    descriptionDefault:
      'Complete tenant isolation with Kubernetes namespaces, separate Keycloak realms, and schema-per-tenant database design.',
  },
  {
    titleId: 'homepage.feature.aiGateway.title',
    titleDefault: 'AI Gateway',
    icon: '📊',
    descriptionId: 'homepage.feature.aiGateway.desc',
    descriptionDefault:
      'Token metering, semantic caching, smart routing across LLM providers. Control AI costs with per-team quotas and dashboards.',
  },
  {
    titleId: 'homepage.feature.gitops.title',
    titleDefault: 'GitOps Native',
    icon: '🔄',
    descriptionId: 'homepage.feature.gitops.desc',
    descriptionDefault:
      'ArgoCD integration for declarative tenant provisioning. Everything as code, everything auditable, everything reproducible.',
  },
  {
    titleId: 'homepage.feature.sovereign.title',
    titleDefault: 'European Sovereign',
    icon: '🇪🇺',
    descriptionId: 'homepage.feature.sovereign.desc',
    descriptionDefault:
      'A European integration platform. Choose deployment and service providers according to your data requirements.',
  },
  {
    titleId: 'homepage.feature.openSource.title',
    titleDefault: 'Open Source',
    icon: '📖',
    descriptionId: 'homepage.feature.openSource.desc',
    descriptionDefault:
      "STOA's published code is open source under the Apache 2.0 licence.",
  },
];

function Feature({titleId, titleDefault, icon, descriptionId, descriptionDefault}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">
          <Translate id={titleId}>{titleDefault}</Translate>
        </Heading>
        <p>
          <Translate id={descriptionId}>{descriptionDefault}</Translate>
        </p>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">
            <Translate id="homepage.features.title">✨ Why STOA?</Translate>
          </Heading>
          <p>
            <Translate id="homepage.features.subtitle">
              Built for the AI era — not retrofitted
            </Translate>
          </p>
        </div>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

type MigrationGuide = {
  platform: string;
  path: string;
  descriptionId: string;
  descriptionDefault: string;
};

const MigrationGuides: MigrationGuide[] = [
  {
    platform: 'IBM webMethods',
    path: '/docs/guides/migration/ibm-webmethods/',
    descriptionId: 'homepage.migration.webmethods',
    descriptionDefault: 'webMethods / DataPower to STOA',
  },
  {
    platform: 'Google Apigee',
    path: '/docs/guides/migration/apigee/',
    descriptionId: 'homepage.migration.apigee',
    descriptionDefault: 'Apigee X / hybrid to STOA',
  },
  {
    platform: 'Kong',
    path: '/docs/guides/migration/kong/',
    descriptionId: 'homepage.migration.kong',
    descriptionDefault: 'Kong Gateway to STOA',
  },
  {
    platform: 'Oracle OAM',
    path: '/docs/guides/migration/oracle-oam/',
    descriptionId: 'homepage.migration.oam',
    descriptionDefault: 'Oracle Access Manager to STOA',
  },
  {
    platform: 'webMethods Sidecar',
    path: '/docs/guides/migration/webmethods-sidecar/',
    descriptionId: 'homepage.migration.sidecar',
    descriptionDefault: 'Run STOA alongside webMethods',
  },
];

function MigrationSection() {
  return (
    <section className={styles.migration}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">
            <Translate id="homepage.migration.title">
              Migrate from Any API Gateway
            </Translate>
          </Heading>
          <p>
            <Translate id="homepage.migration.subtitle">
              Step-by-step migration guides from legacy API gateways to an
              AI-native, open-source platform
            </Translate>
          </p>
        </div>
        <div className={styles.migrationGrid}>
          {MigrationGuides.map((guide) => (
            <Link key={guide.platform} to={guide.path} className={styles.migrationCard}>
              <strong>{guide.platform}</strong>
              <span>
                <Translate id={guide.descriptionId}>{guide.descriptionDefault}</Translate>
              </span>
            </Link>
          ))}
        </div>
        <div className={styles.migrationLinks}>
          <Link
            className="button button--primary button--md"
            to="/blog/api-gateway-migration-guide-2026/">
            <Translate id="homepage.migration.btn.guide">
              Complete Migration Guide 2026
            </Translate>
          </Link>
          <Link
            className="button button--outline button--md"
            to="/blog/open-source-api-gateway-2026/">
            <Translate id="homepage.migration.btn.comparison">
              Gateway Comparison 2026
            </Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.cta}>
      <div className="container">
        <Heading as="h2">
          <Translate id="homepage.cta.title">Ready to get started?</Translate>
        </Heading>
        <p>
          <Translate id="homepage.cta.subtitle">
            Explore the local R1 path. Enterprise options are tailored and quoted on request.
          </Translate>
        </p>
        <div className={styles.ctaButtons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guides/quickstart/">
            <Translate id="homepage.cta.btn.quickstart">🚀 Quick Start Guide</Translate>
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/architecture/adr/adr-073-adopt-envoy-data-plane/">
            <Translate id="homepage.cta.btn.architecture">Envoy target architecture</Translate>
          </Link>
          <Link
            className="button button--outline button--lg"
            href={translate({id: 'homepage.contact.url', message: 'https://www.gostoa.dev/contact/'})}>
            <Translate id="homepage.cta.btn.contact">📧 Contact Sales</Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      title={translate({
        id: 'homepage.layout.title',
        message: 'STOA Docs — Sovereign iPaaS',
      })}
      description={translate({
        id: 'homepage.layout.description',
        message: 'STOA Sovereign iPaaS documentation: European integration with its gateway and control plane, API and MCP capabilities.',
      })}>
      <HomepageHeader />
      <main>
        <QuickStartSection />
        <FeaturesSection />
        <MigrationSection />
        <CTASection />
      </main>
    </Layout>
  );
}
