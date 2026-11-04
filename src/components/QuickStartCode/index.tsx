// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 CAB Ingénierie / Christophe ABOULICAM
import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';
import {translate} from '@docusaurus/Translate';

type Language = 'curl' | 'python' | 'typescript' | 'mcp';

interface CodeExample {
  curl: string;
  python: string;
  typescript: string;
  mcp: string;
}

// URLs use STOA hosted service. Self-hosted users: replace gostoa.dev with your domain.
const examples: Record<string, CodeExample> = {
  subscribe: {
    curl: `# Subscribe to an API
# Set STOA_API_URL to your instance (e.g. https://api.gostoa.dev)
curl -X POST $STOA_API_URL/v1/subscriptions \\
  -H "Authorization: Bearer $STOA_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_id": "billing-api",
    "plan": "starter"
  }'`,
    python: `# Subscribe to an API
import httpx

STOA_API_URL = "https://api.gostoa.dev"  # Replace with your domain

client = httpx.Client(
    base_url=f"{STOA_API_URL}/v1",
    headers={"Authorization": f"Bearer {STOA_TOKEN}"}
)

response = client.post("/subscriptions", json={
    "api_id": "billing-api",
    "plan": "starter"
})

subscription = response.json()
print(f"Subscribed! Key: {subscription['api_key']}")`,
    typescript: `// Subscribe to an API
const STOA_API_URL = 'https://api.gostoa.dev'; // Replace with your domain

const response = await fetch(
  \`\${STOA_API_URL}/v1/subscriptions\`,
  {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${STOA_TOKEN}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_id: 'billing-api',
      plan: 'starter',
    }),
  }
);

const subscription = await response.json();
console.log(\`Subscribed! Key: \${subscription.api_key}\`);`,
    mcp: `# In Claude.ai with STOA MCP connected
# Just ask: "Subscribe me to the billing API"

# Claude automatically calls:
stoa_subscription(
    action="create",
    api_id="billing-api",
    plan="starter"
)

# Response: Subscription created with API key`,
  },
  call: {
    curl: `# Call an API through STOA Gateway
# Set STOA_GATEWAY_URL to your instance (e.g. https://mcp.gostoa.dev)
curl $STOA_GATEWAY_URL/v1/billing/invoices \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json"`,
    python: `# Call an API through STOA Gateway
import httpx

STOA_GATEWAY_URL = "https://mcp.gostoa.dev"  # Replace with your domain

client = httpx.Client(
    base_url=f"{STOA_GATEWAY_URL}/v1",
    headers={"X-API-Key": API_KEY}
)

invoices = client.get("/billing/invoices").json()
for inv in invoices["data"]:
    print(f"Invoice {inv['id']}: €{inv['amount']}")`,
    typescript: `// Call an API through STOA Gateway
const STOA_GATEWAY_URL = 'https://mcp.gostoa.dev'; // Replace with your domain

const response = await fetch(
  \`\${STOA_GATEWAY_URL}/v1/billing/invoices\`,
  {
    headers: {
      'X-API-Key': API_KEY,
    },
  }
);

const { data: invoices } = await response.json();
invoices.forEach(inv =>
  console.log(\`Invoice \${inv.id}: €\${inv.amount}\`)
);`,
    mcp: `# In Claude.ai - natural language API calls
# Ask: "Show me all pending invoices"

# Claude discovers the API via MCP and calls:
# GET /billing/invoices?status=pending

# You get a formatted response:
# "You have 3 pending invoices totaling €1,250"`,
  },
  metrics: {
    curl: `# Check your API usage and quota
curl $STOA_API_URL/v1/subscriptions/sub-123/quota \\
  -H "Authorization: Bearer $STOA_TOKEN"

# Response:
# {
#   "requests_used": 8420,
#   "requests_limit": 10000,
#   "reset_at": "2026-02-01T00:00:00Z"
# }`,
    python: `# Check your API usage and quota
import httpx

STOA_API_URL = "https://api.gostoa.dev"  # Replace with your domain

client = httpx.Client(
    base_url=f"{STOA_API_URL}/v1",
    headers={"Authorization": f"Bearer {STOA_TOKEN}"}
)

quota = client.get("/subscriptions/sub-123/quota").json()

print(f"Usage: {quota['requests_used']}/{quota['requests_limit']}")
print(f"Remaining: {quota['requests_limit'] - quota['requests_used']}")`,
    typescript: `// Check your API usage and quota
const STOA_API_URL = 'https://api.gostoa.dev'; // Replace with your domain

const response = await fetch(
  \`\${STOA_API_URL}/v1/subscriptions/sub-123/quota\`,
  {
    headers: {
      'Authorization': \`Bearer \${STOA_TOKEN}\`,
    },
  }
);

const quota = await response.json();
console.log(\`Usage: \${quota.requests_used}/\${quota.requests_limit}\`);
console.log(\`Remaining: \${quota.requests_limit - quota.requests_used}\`);`,
    mcp: `# In Claude.ai - check your quota naturally
# Ask: "How many API calls do I have left?"

# Claude calls:
stoa_metrics(
    action="quota",
    subscription_id="sub-123"
)

# Response: "You've used 8,420 of 10,000 requests
# (84%). Resets February 1st."`,
  },
};

const languageLabels: Record<Language, string> = {
  curl: 'cURL',
  python: 'Python',
  typescript: 'TypeScript',
  mcp: 'MCP (Claude.ai)',
};

export default function QuickStartCode(): JSX.Element {
  const [activeLanguage, setActiveLanguage] = useState<Language>('curl');
  const steps = [
    {key: 'subscribe', title: translate({id: 'homepage.quickstart.step1', message: '1. Subscribe to an API'})},
    {key: 'call', title: translate({id: 'homepage.quickstart.step2', message: '2. Make API Calls'})},
    {key: 'metrics', title: translate({id: 'homepage.quickstart.step3', message: '3. Monitor Usage'})},
  ];

  return (
    <div>
      <div className="button-group margin-bottom--md" role="group" aria-label={translate({id: 'homepage.quickstart.language', message: 'Code language'})}>
        {(Object.keys(languageLabels) as Language[]).map((language) => (
          <button key={language} type="button" className="button button--secondary"
            aria-pressed={activeLanguage === language} onClick={() => setActiveLanguage(language)}>
            {languageLabels[language]}
          </button>
        ))}
      </div>
      {steps.map(({key, title}) => (
        <section key={key}>
          <h3>{title}</h3>
          <CodeBlock language={activeLanguage === 'mcp' ? 'python' : activeLanguage}>
            {examples[key][activeLanguage]}
          </CodeBlock>
        </section>
      ))}
      <a className="button button--primary" href="/docs/guides/quickstart">
        {translate({id: 'homepage.quickstart.btn.guide', message: '📚 Full Quick Start Guide'})}
      </a>
    </div>
  );
}
