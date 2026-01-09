import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/architecture',
        'concepts/gitops',
        'concepts/multi-tenant',
        'concepts/mcp-gateway-positioning',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/quick-start',
        'guides/authentication',
        'guides/subscriptions',
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
        'reference/cli',
      ],
    },
    'faq/index',
    'roadmap',
  ],
};

export default sidebars;
