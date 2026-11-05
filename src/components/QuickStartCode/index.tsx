// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import CodeBlock from '@theme/CodeBlock';

const prepare = `git clone https://github.com/stoa-platform/stoa.git
cd stoa/deploy/docker-compose
cp .env.example .env`;

const validate =
  'docker compose -p stoa-local-check -f docker-compose.yml config --quiet';

const start =
  'docker compose up -d nginx redpanda-init opensearch-init data-prepper tempo';

// Every variable Compose requires (declared empty in .env.example, except
// OPENSEARCH_PASSWORD which is missing from it). Names only, never values.
const requiredVariables = [
  'POSTGRES_PASSWORD',
  'KEYCLOAK_ADMIN_PASSWORD',
  'GATEWAY_API_KEY',
  'GRAFANA_PASSWORD',
  'KEYCLOAK_CLIENT_SECRET',
  'MCP_KEYCLOAK_CLIENT_SECRET',
  'IDENTITY_GOVERNANCE_CLIENT_SECRET',
  'E2E_DPOP_CLIENT_SECRET',
  'OAUTH2_PROXY_CLIENT_SECRET',
  'OPENSEARCH_OIDC_CLIENT_SECRET',
  'OPENSEARCH_ADMIN_PASSWORD',
  'OPENSEARCH_DASHBOARDS_PASSWORD',
  'OPENSEARCH_LOGWRITER_PASSWORD',
  'OPENSEARCH_PASSWORD',
  'LDAP_ADMIN_PASSWORD',
  'FEDERATION_ALPHA_BROKER_SECRET',
  'FEDERATION_DEMO_CLIENT_SECRET',
  'DEMO_DEMO_ORG_ALPHA_DEMO_ALPHA_PASSWORD',
  'DEMO_DEMO_ORG_BETA_DEMO_BETA_PASSWORD',
  'DEMO_IDP_SOURCE_ALPHA_ALICE_ALPHA_PASSWORD',
  'DEMO_IDP_SOURCE_ALPHA_BOB_ALPHA_PASSWORD',
  'DEMO_IDP_SOURCE_BETA_CAROL_BETA_PASSWORD',
  'DEMO_IDP_SOURCE_BETA_DAVE_BETA_PASSWORD',
];

export default function QuickStartCode(): JSX.Element {
  return (
    <div>
      <h3><Translate id="homepage.local.prepare">1. Prepare your local configuration</Translate></h3>
      <CodeBlock language="bash">{prepare}</CodeBlock>
      <p>
        <Translate id="homepage.local.variables">
          Edit .env before continuing. Every variable below is declared empty in .env.example and is required by Compose: set your own value for each one, and add OPENSEARCH_PASSWORD yourself because it is missing from .env.example.
        </Translate>
      </p>
      <p>
        {requiredVariables.map((name, index) => (
          <span key={name}>
            <code>{name}</code>
            {index < requiredVariables.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </p>
      <p>
        <Translate id="homepage.local.credentials">
          Keycloak imports the federation demo realms at every start, so their variables are required even without the federation profile. GRAFANA_OIDC_CLIENT_SECRET is also needed for Grafana sign-in through Keycloak. The guide explains each variable.
        </Translate>
      </p>
      <h3><Translate id="homepage.local.validate">2. Validate the configuration</Translate></h3>
      <CodeBlock language="bash">{validate}</CodeBlock>
      <p>
        <Translate id="homepage.local.scope">
          Configuration validated statically only; startup, sign-in and the first API call remain unverified. Use a dedicated local environment without port or container-name conflicts.
        </Translate>
      </p>
      <h3><Translate id="homepage.local.start">3. Start the selected local services</Translate></h3>
      <CodeBlock language="bash">{start}</CodeBlock>
      <p>
        <Translate id="homepage.local.next">
          This explicit service set starts the application stack and its observability dependencies without Promtail, which reads the logs of every container on the host. The guide explains how to create the first administrator and sign in; demo data seeding is not verified at runtime. Hosted access is available on request.
        </Translate>
      </p>
      <Link className="button button--primary" to="/docs/guides/quickstart">
        <Translate id="homepage.quickstart.btn.guide">📚 Full Quick Start Guide</Translate>
      </Link>
    </div>
  );
}
