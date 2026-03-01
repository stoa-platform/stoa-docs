// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
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
          The European Agent Gateway — govern AI-to-API interactions with 
          MCP support, multi-tenant isolation, and NIS2/DORA compliance.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            📚 Documentation
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/guides/quickstart">
            🚀 Get Started
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
          <Heading as="h2">⚡ Quick Start</Heading>
          <p>From zero to API call in 3 steps — works with cURL, Python, TypeScript, or Claude.ai</p>
        </div>
        <QuickStartCode />
      </div>
    </section>
  );
}

type FeatureItem = {
  title: string;
  icon: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'MCP Gateway',
    icon: '🤖',
    description: (
      <>
        Native Model Context Protocol support. Let AI agents discover and call 
        your APIs automatically with full governance and audit trails.
      </>
    ),
  },
  {
    title: 'Multi-Tenant',
    icon: '🏢',
    description: (
      <>
        Complete tenant isolation with Kubernetes namespaces, separate Keycloak 
        realms, and schema-per-tenant database design.
      </>
    ),
  },
  {
    title: 'AI Gateway',
    icon: '📊',
    description: (
      <>
        Token metering, semantic caching, smart routing across LLM providers. 
        Control AI costs with per-team quotas and dashboards.
      </>
    ),
  },
  {
    title: 'GitOps Native',
    icon: '🔄',
    description: (
      <>
        ArgoCD integration for declarative tenant provisioning. 
        Everything as code, everything auditable, everything reproducible.
      </>
    ),
  },
  {
    title: 'European Sovereign',
    icon: '🇪🇺',
    description: (
      <>
        European hosting available. NIS2 and DORA supportive features. 
        Host in EU with full data residency control.
      </>
    ),
  },
  {
    title: 'Open Source',
    icon: '📖',
    description: (
      <>
        Apache 2.0 licensed. No vendor lock-in, no restrictive licensing. 
        Contribute, fork, or self-host freely.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">✨ Why STOA?</Heading>
          <p>Built for the AI era — not retrofitted</p>
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
  description: string;
};

const MigrationGuides: MigrationGuide[] = [
  {
    platform: 'IBM webMethods',
    path: '/docs/guides/migration/ibm-webmethods',
    description: 'webMethods / DataPower to STOA',
  },
  {
    platform: 'Google Apigee',
    path: '/docs/guides/migration/apigee',
    description: 'Apigee X / hybrid to STOA',
  },
  {
    platform: 'Kong',
    path: '/docs/guides/migration/kong',
    description: 'Kong Gateway to STOA',
  },
  {
    platform: 'Oracle OAM',
    path: '/docs/guides/migration/oracle-oam',
    description: 'Oracle Access Manager to STOA',
  },
  {
    platform: 'webMethods Sidecar',
    path: '/docs/guides/migration/webmethods-sidecar',
    description: 'Run STOA alongside webMethods',
  },
];

function MigrationSection() {
  return (
    <section className={styles.migration}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">Migrate from Any API Gateway</Heading>
          <p>
            Step-by-step migration guides from legacy API gateways to an
            AI-native, open-source platform
          </p>
        </div>
        <div className={styles.migrationGrid}>
          {MigrationGuides.map((guide) => (
            <Link key={guide.platform} to={guide.path} className={styles.migrationCard}>
              <strong>{guide.platform}</strong>
              <span>{guide.description}</span>
            </Link>
          ))}
        </div>
        <div className={styles.migrationLinks}>
          <Link
            className="button button--primary button--md"
            to="/blog/api-gateway-migration-guide-2026">
            Complete Migration Guide 2026
          </Link>
          <Link
            className="button button--outline button--md"
            to="/blog/open-source-api-gateway-2026">
            Gateway Comparison 2026
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
          <Heading as="h2">⚡ Time to First Agent Call</Heading>
          <p>STOA optimizes for AI agents, not just human developers</p>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Traditional Gateway</th>
                <th>STOA + MCP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>API Discovery</td>
                <td>📚 Read docs manually</td>
                <td>🔍 Auto-discovery via MCP</td>
              </tr>
              <tr>
                <td>Authentication</td>
                <td>🔑 Manual key management</td>
                <td>⚡ JWT context injection</td>
              </tr>
              <tr>
                <td>First API Call</td>
                <td>⏱️ Days to weeks</td>
                <td>⚡ Seconds</td>
              </tr>
              <tr>
                <td>AI Agent Support</td>
                <td>❌ Not designed for it</td>
                <td>✅ Native MCP Gateway</td>
              </tr>
              <tr>
                <td>Token Metering</td>
                <td>❌ Not available</td>
                <td>✅ Per-team dashboards</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.comparisonCta}>
          <Link
            className="button button--primary button--lg"
            to="/docs/use-cases">
            📖 See Use Cases
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
        <Heading as="h2">Ready to get started?</Heading>
        <p>Deploy STOA in your infrastructure or try our managed cloud.</p>
        <div className={styles.ctaButtons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guides/quickstart">
            🚀 Quick Start Guide
          </Link>
          <Link
            className="button button--secondary button--lg"
            href="https://console.gostoa.dev/signup">
            ☁️ Try STOA Cloud
          </Link>
          <Link
            className="button button--outline button--lg"
            href="mailto:sales@gostoa.dev">
            📧 Contact Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="STOA Platform Docs — The European Agent Gateway | Define Once, Expose Everywhere"
      description="STOA Platform documentation — the open-source AI-native API gateway with MCP support, multi-tenant isolation, and migration guides from webMethods, Apigee, Kong.">
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
