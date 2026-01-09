<div align="center">
  <h1>📚 STOA Docs</h1>
  <p><strong>Documentation for STOA Platform</strong></p>
  <p>
    <a href="https://docs.gostoa.dev">docs.gostoa.dev</a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/stoa-platform/stoa-docs/actions/workflows/deploy.yml">
    <img src="https://github.com/stoa-platform/stoa-docs/actions/workflows/deploy.yml/badge.svg" alt="Deploy">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-green?style=flat-square" alt="License">
  </a>
  <a href="https://docs.gostoa.dev">
    <img src="https://img.shields.io/badge/docs-live-brightgreen?style=flat-square" alt="Docs">
  </a>
</p>

---

## 🚀 Overview

This repository contains the documentation website for STOA Platform, built with [Docusaurus](https://docusaurus.io) and deployed on [Vercel](https://vercel.com).

**Live site**: [https://docs.gostoa.dev](https://docs.gostoa.dev)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Docusaurus 3](https://docusaurus.io) | Documentation framework |
| [React](https://react.dev) | UI components |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [MDX](https://mdxjs.com) | Enhanced Markdown |
| [Vercel](https://vercel.com) | Hosting |

---

## 🏃 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Development

```bash
# Clone the repository
git clone https://github.com/stoa-platform/stoa-docs.git
cd stoa-docs

# Install dependencies
pnpm install

# Start development server
pnpm start

# Open http://localhost:3000
```

### Build

```bash
# Build for production
pnpm build

# Serve production build locally
pnpm serve
```

---

## 📁 Project Structure

```
stoa-docs/
├── docs/                  # Documentation content
│   ├── getting-started/   # Getting started guides
│   ├── concepts/          # Core concepts
│   ├── deployment/        # Deployment guides
│   ├── api/               # API reference
│   └── community/         # Community resources
├── src/
│   ├── components/        # Custom React components
│   ├── css/               # Custom styles
│   └── pages/             # Custom pages
├── static/                # Static assets
├── docusaurus.config.ts   # Docusaurus configuration
└── sidebars.ts            # Sidebar configuration
```

---

## ✍️ Contributing Documentation

We welcome documentation contributions! Here's how:

### Adding a New Page

1. Create a new `.md` or `.mdx` file in the appropriate `docs/` subdirectory
2. Add frontmatter with title and description
3. Update `sidebars.ts` if needed

```markdown
---
title: My New Page
description: A brief description
---

# My New Page

Content goes here...
```

### Style Guide

- Use clear, concise language
- Include code examples where helpful
- Add diagrams for complex concepts
- Test all code snippets

---

## 🚀 Deployment

Deployment is automatic via Vercel on push to `main`.

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | [docs.gostoa.dev](https://docs.gostoa.dev) |
| `*` | Preview | Auto-generated |

---

## 🔗 Related Repositories

| Repository | Description |
|------------|-------------|
| [stoa](https://github.com/stoa-platform/stoa) | Main platform monorepo |
| [stoa-web](https://github.com/stoa-platform/stoa-web) | Marketing website |
| [stoa-helm](https://github.com/stoa-platform/stoa-helm) | Helm charts |

---

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

Documentation content is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

<div align="center">
  <p>Part of the <a href="https://github.com/stoa-platform">STOA Platform</a> project</p>
</div>
