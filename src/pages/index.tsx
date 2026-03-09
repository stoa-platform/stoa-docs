// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import QuickStartCode from '@site/src/components/QuickStartCode';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroDescription}>
          <Translate id="homepage.hero.description">
            The European Agent Gateway — govern AI-to-API interactions with
            MCP support, multi-tenant isolation, and NIS2/DORA compliance.
          </Translate>
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            <Translate id="homepage.hero.btn.docs">📚 Documentation</Translate>
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/guides/quickstart">
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
              From zero to API call in 3 steps — works with cURL, Python, TypeScript, or Claude.ai
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
      'European hosting available. NIS2 and DORA supportive features. Host in EU with full data residency control.',
  },
  {
    titleId: 'homepage.feature.openSource.title',
    titleDefault: 'Open Source',
    icon: '📖',
    descriptionId: 'homepage.feature.openSource.desc',
    descriptionDefault:
      'Apache 2.0 licensed. No vendor lock-in, no restrictive licensing. Contribute, fork, or self-host freely.',
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
    path: '/docs/guides/migration/ibm-webmethods',
    descriptionId: 'homepage.migration.webmethods',
    descriptionDefault: 'webMethods / DataPower to STOA',
  },
  {
    platform: 'Google Apigee',
    path: '/docs/guides/migration/apigee',
    descriptionId: 'homepage.migration.apigee',
    descriptionDefault: 'Apigee X / hybrid to STOA',
  },
  {
    platform: 'Kong',
    path: '/docs/guides/migration/kong',
    descriptionId: 'homepage.migration.kong',
    descriptionDefault: 'Kong Gateway to STOA',
  },
  {
    platform: 'Oracle OAM',
    path: '/docs/guides/migration/oracle-oam',
    descriptionId: 'homepage.migration.oam',
    descriptionDefault: 'Oracle Access Manager to STOA',
  },
  {
    platform: 'webMethods Sidecar',
    path: '/docs/guides/migration/webmethods-sidecar',
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
            to="/blog/api-gateway-migration-guide-2026">
            <Translate id="homepage.migration.btn.guide">
              Complete Migration Guide 2026
            </Translate>
          </Link>
          <Link
            className="button button--outline button--md"
            to="/blog/open-source-api-gateway-2026">
            <Translate id="homepage.migration.btn.comparison">
              Gateway Comparison 2026
            </Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">
            <Translate id="homepage.comparison.title">
              ⚡ Time to First Agent Call
            </Translate>
          </Heading>
          <p>
            <Translate id="homepage.comparison.subtitle">
              STOA optimizes for AI agents, not just human developers
            </Translate>
          </p>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th><Translate id="homepage.comparison.col.metric">Metric</Translate></th>
                <th><Translate id="homepage.comparison.col.traditional">Traditional Gateway</Translate></th>
                <th>STOA + MCP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Translate id="homepage.comparison.row.discovery">API Discovery</Translate></td>
                <td><Translate id="homepage.comparison.row.discovery.traditional">📚 Read docs manually</Translate></td>
                <td><Translate id="homepage.comparison.row.discovery.stoa">🔍 Auto-discovery via MCP</Translate></td>
              </tr>
              <tr>
                <td><Translate id="homepage.comparison.row.auth">Authentication</Translate></td>
                <td><Translate id="homepage.comparison.row.auth.traditional">🔑 Manual key management</Translate></td>
                <td><Translate id="homepage.comparison.row.auth.stoa">⚡ JWT context injection</Translate></td>
              </tr>
              <tr>
                <td><Translate id="homepage.comparison.row.firstCall">First API Call</Translate></td>
                <td><Translate id="homepage.comparison.row.firstCall.traditional">⏱️ Days to weeks</Translate></td>
                <td><Translate id="homepage.comparison.row.firstCall.stoa">⚡ Seconds</Translate></td>
              </tr>
              <tr>
                <td><Translate id="homepage.comparison.row.aiSupport">AI Agent Support</Translate></td>
                <td><Translate id="homepage.comparison.row.aiSupport.traditional">❌ Not designed for it</Translate></td>
                <td><Translate id="homepage.comparison.row.aiSupport.stoa">✅ Native MCP Gateway</Translate></td>
              </tr>
              <tr>
                <td><Translate id="homepage.comparison.row.metering">Token Metering</Translate></td>
                <td><Translate id="homepage.comparison.row.metering.traditional">❌ Not available</Translate></td>
                <td><Translate id="homepage.comparison.row.metering.stoa">✅ Per-team dashboards</Translate></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.comparisonCta}>
          <Link
            className="button button--primary button--lg"
            to="/docs/use-cases">
            <Translate id="homepage.comparison.btn.useCases">📖 See Use Cases</Translate>
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
            Deploy STOA in your infrastructure or try our managed cloud.
          </Translate>
        </p>
        <div className={styles.ctaButtons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guides/quickstart">
            <Translate id="homepage.cta.btn.quickstart">🚀 Quick Start Guide</Translate>
          </Link>
          <Link
            className="button button--secondary button--lg"
            href="https://console.gostoa.dev/signup">
            <Translate id="homepage.cta.btn.cloud">☁️ Try STOA Cloud</Translate>
          </Link>
          <Link
            className="button button--outline button--lg"
            href="mailto:sales@gostoa.dev">
            <Translate id="homepage.cta.btn.contact">📧 Contact Sales</Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title={translate({
        id: 'homepage.layout.title',
        message: 'STOA Platform Docs — The European Agent Gateway | Define Once, Expose Everywhere',
      })}
      description={translate({
        id: 'homepage.layout.description',
        message: 'STOA Platform documentation — the open-source AI-native API gateway with MCP support, multi-tenant isolation, and migration guides from webMethods, Apigee, Kong.',
      })}>
      <HomepageHeader />
      <main>
        <QuickStartSection />
        <FeaturesSection />
        <MigrationSection />
        <ComparisonSection />
        <CTASection />
      </main>
    </Layout>
  );
}
