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

const languageIcons: Record<Language, string> = {
  curl: '🖥️',
  python: '🐍',
  typescript: '📘',
  mcp: '🤖',
};

export default function QuickStartCode() {
  const [activeLanguage, setActiveLanguage] = useState<Language>('curl');
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = async (text: string, step: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const steps = [
    {
      key: 'subscribe',
      title: translate({id: 'homepage.quickstart.step1', message: '1. Subscribe to an API'}),
      icon: '🔑',
    },
    {
      key: 'call',
      title: translate({id: 'homepage.quickstart.step2', message: '2. Make API Calls'}),
      icon: '🚀',
    },
    {
      key: 'metrics',
      title: translate({id: 'homepage.quickstart.step3', message: '3. Monitor Usage'}),
      icon: '📊',
    },
  ];

  const copyLabel = translate({id: 'homepage.quickstart.copy', message: '📋 Copy'});
  const copiedLabel = translate({id: 'homepage.quickstart.copied', message: '✓ Copied!'});
  const fullGuideLabel = translate({id: 'homepage.quickstart.btn.guide', message: '📚 Full Quick Start Guide'});
  const tryFreeLabel = translate({id: 'homepage.quickstart.btn.try', message: '🚀 Try STOA Free'});

  return (
    <div className="quickstart-container">
      {/* Language Tabs */}
      <div className="language-tabs">
        {(Object.keys(languageLabels) as Language[]).map((lang) => (
          <button
            key={lang}
            className={`language-tab ${activeLanguage === lang ? 'active' : ''}`}
            onClick={() => setActiveLanguage(lang)}
          >
            <span className="tab-icon">{languageIcons[lang]}</span>
            <span className="tab-label">{languageLabels[lang]}</span>
          </button>
        ))}
      </div>

      {/* Code Steps */}
      <div className="code-steps">
        {steps.map(({ key, title, icon }) => (
          <div key={key} className="code-step">
            <div className="step-header">
              <span className="step-icon">{icon}</span>
              <span className="step-title">{title}</span>
              <button
                className={`copy-button ${copiedStep === key ? 'copied' : ''}`}
                onClick={() => copyToClipboard(examples[key][activeLanguage], key)}
              >
                {copiedStep === key ? copiedLabel : copyLabel}
              </button>
            </div>
            <CodeBlock language={activeLanguage === 'mcp' ? 'python' : activeLanguage}>
              {examples[key][activeLanguage]}
            </CodeBlock>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="quickstart-cta">
        <a href="/docs/guides/quickstart" className="cta-button primary">
          {fullGuideLabel}
        </a>
        <a href="https://console.gostoa.dev/signup" className="cta-button secondary">
          {tryFreeLabel}
        </a>
      </div>

      <style>{`
        .quickstart-container {
          margin: 2rem 0;
          border: 1px solid var(--ifm-color-emphasis-300);
          border-radius: 12px;
          overflow: hidden;
          background: var(--ifm-background-surface-color);
        }

        .language-tabs {
          display: flex;
          gap: 0;
          background: var(--ifm-color-emphasis-100);
          border-bottom: 1px solid var(--ifm-color-emphasis-300);
          overflow-x: auto;
        }

        .language-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.9rem;
          color: var(--ifm-color-emphasis-700);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .language-tab:hover {
          background: var(--ifm-color-emphasis-200);
        }

        .language-tab.active {
          background: var(--ifm-background-surface-color);
          color: var(--ifm-color-primary);
          font-weight: 600;
          border-bottom: 2px solid var(--ifm-color-primary);
        }

        .code-steps {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .code-step {
          border: 1px solid var(--ifm-color-emphasis-200);
          border-radius: 8px;
          overflow: hidden;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--ifm-color-emphasis-100);
          border-bottom: 1px solid var(--ifm-color-emphasis-200);
        }

        .step-icon {
          font-size: 1.25rem;
        }

        .step-title {
          flex: 1;
          font-weight: 600;
          color: var(--ifm-color-emphasis-900);
        }

        .copy-button {
          padding: 0.4rem 0.75rem;
          border: 1px solid var(--ifm-color-emphasis-300);
          border-radius: 6px;
          background: var(--ifm-background-surface-color);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .copy-button:hover {
          background: var(--ifm-color-emphasis-200);
        }

        .copy-button.copied {
          background: var(--ifm-color-success);
          color: white;
          border-color: var(--ifm-color-success);
        }

        .code-step pre {
          margin: 0 !important;
          border-radius: 0 !important;
        }

        .quickstart-cta {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--ifm-color-emphasis-100);
          border-top: 1px solid var(--ifm-color-emphasis-300);
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .cta-button.primary {
          background: var(--ifm-color-primary);
          color: white;
        }

        .cta-button.primary:hover {
          background: var(--ifm-color-primary-dark);
          color: white;
        }

        .cta-button.secondary {
          background: var(--ifm-background-surface-color);
          color: var(--ifm-color-primary);
          border: 2px solid var(--ifm-color-primary);
        }

        .cta-button.secondary:hover {
          background: var(--ifm-color-primary);
          color: white;
        }

        @media (max-width: 768px) {
          .language-tabs {
            justify-content: flex-start;
          }

          .language-tab {
            padding: 0.5rem 0.75rem;
            font-size: 0.8rem;
          }

          .tab-label {
            display: none;
          }

          .tab-icon {
            font-size: 1.25rem;
          }

          .quickstart-cta {
            flex-direction: column;
          }

          .cta-button {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
