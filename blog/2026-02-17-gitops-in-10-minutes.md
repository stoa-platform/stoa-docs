---
unlisted: true
slug: gitops-in-10-minutes
title: "GitOps in 10 Minutes: Why Your Infrastructure Should Be a Git Repo"
authors: [christophe]
tags: [education, tutorial, architecture]
description: "GitOps explained for developers who have never touched infrastructure. What it is, why it matters, and how to start — no Kubernetes PhD required."
keywords: [gitops tutorial, gitops beginner, infrastructure as code, argocd, kubernetes gitops, config as code, git infrastructure, devops for developers, gitops explained]
---

# GitOps in 10 Minutes: Why Your Infrastructure Should Be a Git Repo

**GitOps means your infrastructure is defined in Git and automatically deployed from it.** This guide explains what GitOps is, why it matters for solo devs and small teams, and how to start — from versioning config files to full ArgoCD automation.

You know how to `git push` your code. But what about your infrastructure?

Your Nginx config, your firewall rules, your database credentials, your Kubernetes manifests — where do they live? If the answer involves SSH, a shared Wiki page, or "ask Jean-Michel, he set it up" — you have a problem.

**GitOps** means treating infrastructure the same way you treat code: versioned, reviewed, auditable, and automatically deployed from a Git repo. No more SSH. No more "works on my machine." No more mystery configs.

GitOps is a core principle of [open-source API management](/blog/open-source-api-gateway-2026) — and one of the reasons STOA was [designed GitOps-first](https://docs.gostoa.dev/docs/concepts/gitops) from day one.

<!-- truncate -->

## The Problem: Configuration Drift

Here's a scenario every developer has lived:

1. You deploy your app to production. It works.
2. Three months later, someone SSHs into the server to "fix a thing."
3. Another person tweaks an Nginx config directly.
4. A third changes an environment variable through the cloud console.
5. Six months later, **nobody knows what the production config actually is**.

This is **configuration drift** — the gap between what you *think* is deployed and what *actually* runs. It's the silent killer of reliability.

```
What you think is deployed:     What's actually running:
┌─────────────────────┐         ┌─────────────────────┐
│ nginx.conf (v3)     │         │ nginx.conf (v3.1?)  │  ← manual SSH edit
│ API_KEY=abc123      │         │ API_KEY=xyz789       │  ← cloud console change
│ replicas: 2         │         │ replicas: 3          │  ← kubectl scale
│ TLS: Let's Encrypt  │         │ TLS: expired!        │  ← cert not renewed
└─────────────────────┘         └─────────────────────┘
          Your git repo              The actual server
```

## What GitOps Actually Is

GitOps is a simple idea: **Git is the single source of truth for your infrastructure**.

```
Developer → git push → Git Repo → (auto-sync) → Infrastructure
                          ↑                           ↓
                    "What should                "What actually
                     be running"                  is running"
                                    ↕
                          Constantly reconciled
```

**Three core principles:**

1. **Declarative** — You describe the *desired state* ("I want 2 replicas, TLS enabled, rate limit 100/min"), not the steps to get there.
2. **Versioned** — Every change goes through Git: commit, review, merge. Full audit trail.
3. **Automated** — A tool (ArgoCD, Flux, etc.) continuously compares Git with reality and fixes any drift.

## The Old Way vs. GitOps

| | The Old Way | GitOps |
|---|---|---|
| **Deploy** | SSH + manual commands | `git push` → auto-deploy |
| **Rollback** | "Does anyone remember what we changed?" | `git revert` → auto-rollback |
| **Audit** | Check server logs (if they exist) | `git log` — who, when, what, why |
| **Reproduce** | Impossible — config lives on the server | Clone the repo, apply — identical environment |
| **Review** | "Hey, I'm changing the firewall rules" (Slack message) | Pull request with diff, review, approve |
| **Disaster recovery** | Rebuild from memory + documentation (if current) | `git clone` + `apply` — back in minutes |

## A Concrete Example

Let's say you have a simple API deployed on Kubernetes. Here's what a GitOps repo looks like:

```
infra/
├── base/
│   ├── deployment.yaml      # Your API: image, replicas, health checks
│   ├── service.yaml         # How traffic reaches your API
│   ├── ingress.yaml         # Domain name + TLS
│   └── configmap.yaml       # Non-secret configuration
├── overlays/
│   ├── staging/
│   │   └── kustomization.yaml  # staging overrides (1 replica, debug logging)
│   └── production/
│       └── kustomization.yaml  # production overrides (3 replicas, minimal logging)
└── secrets/
    └── sealed-secret.yaml   # Encrypted secrets (safe to commit)
```

### Deploy a change

Want to scale production to 5 replicas? No SSH. No `kubectl`. Just a pull request:

```yaml
# overlays/production/kustomization.yaml
# Change replicas: 3 → replicas: 5
patches:
  - target:
      kind: Deployment
      name: my-api
    patch: |
      - op: replace
        path: /spec/replicas
        value: 5
```

```bash
git add overlays/production/kustomization.yaml
git commit -m "scale(prod): increase API replicas to 5 for launch traffic"
git push origin main
```

ArgoCD detects the change, applies it to the cluster. Done. Full audit trail in git.

### Rollback a bad deploy

Something broke? No panic:

```bash
git revert HEAD
git push origin main
# ArgoCD automatically rolls back to previous state
```

Compare this to the old way: "Quick, SSH into prod and change the thing back. What was the old value? Let me check Slack..."

## Why Freelancers and Small Teams Need GitOps

You might think GitOps is only for big companies with dedicated DevOps teams. **Wrong.** It's actually *more* valuable for small teams and solo developers because:

### 1. You Can't Rely on Memory

When you're juggling 3-5 client projects, you won't remember what you configured 6 months ago. Git remembers.

### 2. Client Handoffs Become Trivial

"Here's the repo. Everything that runs in production is in this folder. `git log` shows every change." No knowledge transfer meetings. No runbooks that are already outdated.

### 3. Disaster Recovery Is Free

Server dies? Hard drive corrupted? Cloud provider outage? With GitOps: clone the repo, point to a new cluster, apply. Everything's back in minutes.

### 4. You Can Prove What You Did

Client asks "when did you change the SSL config?" You don't guess — you show them the commit:

```
commit 8a3f2c1 (2026-01-15)
Author: You <you@example.com>
Date:   Wed Jan 15 14:30:00 2026

    fix(tls): renew SSL cert and switch to Let's Encrypt auto-renewal

    - Old: manual cert from GoDaddy, expired Dec 30
    - New: Let's Encrypt with auto-renewal via cert-manager
    - Tested in staging first (commit 7b2e1d0)
```

## Getting Started: No Kubernetes Required

You don't need Kubernetes to use GitOps. You can start with any infrastructure:

### Level 1: Version Your Config Files

Put your Nginx configs, Docker Compose files, and environment variable templates (not values!) in Git:

```bash
mkdir infra && cd infra
git init

# Add your configs
cp /etc/nginx/nginx.conf ./nginx/
cp ~/docker-compose.yml ./
cp .env.example ./  # Template only — never the actual .env!

git add . && git commit -m "chore: initial infrastructure config"
```

From now on, every config change goes through Git first: edit, commit, then apply.

### Level 2: Automate the Apply

Use a simple CI/CD pipeline to apply changes when you push:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
    paths: ['infra/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Copy configs to server
        run: |
          scp -r infra/nginx/ server:/etc/nginx/
          ssh server "nginx -t && systemctl reload nginx"
```

Not fancy. But now you have versioned configs + automated deployment + audit trail. That's GitOps.

### Level 3: Full GitOps with ArgoCD

When you're ready for Kubernetes (or already there):

```bash
# Install ArgoCD (one-time)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Point ArgoCD at your Git repo
argocd app create my-api \
  --repo https://github.com/you/infra.git \
  --path overlays/production \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default \
  --sync-policy automated
```

Now ArgoCD watches your repo and automatically applies any change you push. Push a commit → cluster updates. Revert a commit → cluster rolls back.

## How STOA Embraces GitOps

STOA Platform was designed GitOps-first from day one (see [ADR-007](https://docs.gostoa.dev/docs/architecture/adr/adr-007-argocd-gitops-deployment)):

- **Every config is declarative** — API contracts, policies, routing rules are YAML/JSON in Git
- **ArgoCD-native** — STOA ships with ArgoCD manifests and Helm charts, auto-sync enabled
- **No manual kubectl** — Changes flow from `git push` through CI to the cluster automatically
- **Drift detection** — If someone manually changes something on the cluster, ArgoCD detects it and reverts to the Git state
- **Sealed secrets** — Credentials are encrypted in Git using sealed-secrets, decrypted only inside the cluster

The result: your entire API gateway configuration — routes, policies, TLS certs, rate limits, access control — lives in Git. Auditable. Reviewable. Reproducible.

Even the free tier works this way. No "GitOps is a premium feature" gatekeeping.

## The Mindset Shift

GitOps isn't really about tools. It's about a mindset:

> **If it's not in Git, it doesn't exist.**

- Server config modified via SSH? It will be overwritten by the next sync.
- Environment variable changed in the console? It will drift back to Git state.
- Database migration run manually? It should have been a versioned script.

This feels restrictive at first. Then it becomes liberating. Because when everything is in Git:
- You never lose configuration
- You always know what's deployed
- You can reproduce any environment
- You can prove every change

**Stop SSHing into servers. Start `git push`-ing your infrastructure.**

---

## FAQ

### Do I need Kubernetes for GitOps?

No. GitOps is a pattern, not a Kubernetes feature. You can version Nginx configs, Docker Compose files, or even shell scripts in Git and auto-apply them with CI/CD. Kubernetes + ArgoCD is the most popular GitOps stack, but Level 1 and Level 2 in this guide work without Kubernetes.

### What's the difference between GitOps and Infrastructure as Code (IaC)?

IaC (Terraform, Pulumi) describes infrastructure declaratively. GitOps adds the **reconciliation loop**: a tool continuously ensures the live state matches the Git state. IaC is "define and apply." GitOps is "define, apply, and keep in sync forever."

### How does STOA use GitOps?

STOA stores API contracts, routing policies, and access rules as declarative YAML. ArgoCD watches the Git repo and applies changes automatically — see [ADR-007](https://docs.gostoa.dev/docs/architecture/adr/adr-007-gitops-argocd) for the full architecture. Even [secret management](/blog/api-keys-in-git-history) follows GitOps patterns via sealed-secrets.

### Is GitOps secure? What about secrets in Git?

Never store plaintext secrets in Git. Use encrypted secrets (sealed-secrets, SOPS) or external secret managers (Vault, Infisical). The encryption key lives outside Git; the encrypted blob is safe to commit. See our [API security checklist](/blog/api-security-checklist-solo-dev) for more.

---

**Related**: [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026) | [API Security Checklist](/blog/api-security-checklist-solo-dev) | [Quick Start](https://docs.gostoa.dev/docs/guides/quick-start)

*Want to manage your APIs with GitOps? [STOA Quick Start](https://docs.gostoa.dev/docs/guides/quick-start) gets you running in 5 minutes. Join the community on [Discord](https://discord.gostoa.dev).*
