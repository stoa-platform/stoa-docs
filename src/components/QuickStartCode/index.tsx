// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import CodeBlock from '@theme/CodeBlock';

const prepare = `git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env`;

export default function QuickStartCode(): JSX.Element {
  return (
    <div>
      <h3><Translate id="homepage.local.prepare">1. Prepare your local configuration</Translate></h3>
      <CodeBlock language="bash">{prepare}</CodeBlock>
      <p>
        <Translate id="homepage.local.variables">
          Edit .env and replace the supplied credentials before continuing. Required variables:
        </Translate>{' '}
        <code>POSTGRES_PASSWORD</code>, <code>KEYCLOAK_ADMIN_PASSWORD</code>,{' '}
        <code>OPENSEARCH_ADMIN_PASSWORD</code>, <code>OPENSEARCH_DASHBOARDS_PASSWORD</code>,{' '}
        <code>OPENSEARCH_LOGWRITER_PASSWORD</code>, <code>OPENSEARCH_OIDC_CLIENT_SECRET</code>.
      </p>
      <p>
        <Translate id="homepage.local.credentials">
          Also configure GRAFANA_PASSWORD and GRAFANA_OIDC_CLIENT_SECRET. Keep OPENSEARCH_PASSWORD consistent with OPENSEARCH_ADMIN_PASSWORD. The guide explains gateway access settings.
        </Translate>
      </p>
      <h3><Translate id="homepage.local.validate">2. Validate the configuration</Translate></h3>
      <CodeBlock language="bash">{'docker compose -p stoa-local-check -f docker-compose.yml config --quiet'}</CodeBlock>
      <p>
        <Translate id="homepage.local.scope">
          Configuration validated statically only; startup, sign-in and the first API call remain unverified. Use a dedicated local environment without port or container-name conflicts.
        </Translate>
      </p>
      <h3><Translate id="homepage.local.start">3. Start the selected local services</Translate></h3>
      <CodeBlock language="bash">{'docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo'}</CodeBlock>
      <p>
        <Translate id="homepage.local.next">
          This explicit service set excludes Promtail. Follow the guide to check local access. Demo data initialization has not yet been verified for this path and remains pending. Hosted access is available on request.
        </Translate>
      </p>
      <Link className="button button--primary" to="/docs/guides/quickstart">
        <Translate id="homepage.quickstart.btn.guide">📚 Full Quick Start Guide</Translate>
      </Link>
    </div>
  );
}
