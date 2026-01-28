---
sidebar_position: 4
---

# Web Analytics

Track visitors and page views on your STOA deployment using Vercel Analytics.

## Overview

STOA documentation uses [Vercel Analytics](https://vercel.com/docs/analytics) for privacy-friendly web analytics:

- **Visitor Tracking** - Count unique visitors
- **Page Views** - Monitor page engagement
- **Privacy-First** - No cookies, GDPR compliant
- **Real-Time Data** - Instant insights

## Getting Started

To start counting visitors and page views, follow these steps.

### Step 1: Install the Package

Install `@vercel/analytics` in your project:

```bash npm2yarn
npm i @vercel/analytics
```

### Step 2: Add the React Component

Import and use the `<Analytics/>` React component into your app's layout:

```tsx
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Step 3: Deploy & Visit Your Site

Deploy your changes and visit the deployment to collect your page views.

:::tip
If you don't see data after 30 seconds, check for content blockers and try navigating between pages on your site.
:::

## Viewing Analytics

Once deployed, access your analytics dashboard at:

```
https://vercel.com/[your-team]/[your-project]/analytics
```

## Further Reference

For full examples and advanced configuration, refer to the [Vercel Analytics documentation](https://vercel.com/docs/analytics).

---

Need help? Join our [Discord community](https://discord.gg/j8tHSSes) or check [GitHub Issues](https://github.com/stoa-platform/stoa/issues).
