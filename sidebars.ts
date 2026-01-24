import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/architecture',
        'concepts/mcp-gateway',
        'concepts/gitops',
        'concepts/multi-tenant',
        'concepts/mcp-gateway-positioning',
      ],
    },
    {
      type: 'category',
      label: 'Enterprise',
      items: [
        'enterprise/use-cases',
        'enterprise/security-compliance',
        'enterprise/support',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/hybrid',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/quick-start',
        'guides/authentication',
        'guides/subscriptions',
        {
          type: 'category',
          label: 'Migration',
          items: [
            'guides/migration/index',
            'guides/migration/ibm-webmethods',
            'guides/migration/oracle-oam',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/control-plane',
        'api/mcp-gateway',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/configuration',
        'reference/mcp-tools',
        'reference/cli',
        {
          type: 'category',
          label: 'ADRs',
          items: [
            'reference/adr/stoactl-cli',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Community',
      collapsed: false,
      items: [
        'community/index',
        'community/philosophy',
        'community/rewards',
        'community/faq',
      ],
    },
    'faq/index',
    'roadmap',
  ],
};

export default sidebars;
