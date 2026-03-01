---
slug: api-keys-in-git-history
title: "API Keys in Git History: How to Find and Fix Leaked Secrets"
authors: [christophe]
tags: [security, education, tutorial]
description: "90% of secret leaks come from git commits. Detect exposed API keys, remove them from history, and prevent future leaks with pre-commit hooks."
keywords: [api key security, git secrets, gitleaks, secret scanning, api key leak, git history secrets, developer security, credential rotation, secret management]
---
<!-- last verified: 2026-02 -->

# Your API Keys Are in Your Git History (And How to Fix It)

**Deleted API keys stay in git history forever.** This article shows you how to detect leaked secrets with gitleaks, remove them from history, and prevent future leaks with pre-commit hooks and proper secret management.

You removed the hardcoded API key from your code. You committed the fix. You pushed. You're safe now, right?

**No.** The key is still in your git history. Anyone with `git log -p` can find it in seconds.

This isn't a theoretical risk. GitHub scans over 100 million commits per day and finds **thousands of valid secrets** — API keys, database passwords, cloud credentials. Most of them were "removed" by developers who thought deleting the line was enough.

This is one of the most critical security gaps in modern API development — and one of the reasons we built [STOA as an open-source API gateway](/blog/open-source-api-gateway-2026) with secrets management as a default, not an add-on.

<!-- truncate -->

## The Scale of the Problem

Let's be concrete about what happens when a secret leaks:

- **Exposed AWS keys** are exploited within **4 minutes** on average (source: GitGuardian State of Secrets Sprawl 2025)
- **Cryptocurrency wallet keys** found in git repos are drained within **seconds** by automated bots
- **Database credentials** lead to data breaches that cost an average of **$4.45M** per incident (IBM Cost of a Data Breach 2024)

And the most common source? Not sophisticated attacks. Just **developers who committed a secret and thought they deleted it**.

## How Secrets End Up in Git

Here are the five most common ways it happens:

### 1. The `.env` File That Got Committed

```bash
# Oops — committed before .gitignore existed
DATABASE_URL=postgresql://admin:s3cur3p@ss@db.example.com:5432/production
STRIPE_SECRET_KEY=sk_live_4eC39HqLyjWDarjtT1zdp7dc
```

Even if you add `.env` to `.gitignore` later, the committed version **remains in git history forever**.

### 2. The "Quick Test" Hardcode

```python
# "I'll remove it before committing" — narrator: they didn't
client = boto3.client('s3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)
```

### 3. The Config File Template

```yaml
# config.yaml — "it's just a template"
database:
  host: prod-db.internal.company.com
  password: r3alPr0dP@ssword!
```

### 4. The Debugging Commit

```javascript
// TODO: remove before merge
console.log('Token:', process.env.ADMIN_TOKEN);
// Actual token value in .env that got committed alongside
```

### 5. The Docker Compose Override

```yaml
# docker-compose.override.yml — "it's local only"
services:
  api:
    environment:
      - JWT_SECRET=my-super-secret-jwt-key-that-should-never-be-here
```

## How to Detect Leaked Secrets

### Step 1: Scan Your Git History

[Gitleaks](https://github.com/gitleaks/gitleaks) is the standard tool. It scans your entire git history, not just the current files:

```bash
# Install
brew install gitleaks  # macOS
# or
docker pull ghcr.io/gitleaks/gitleaks:latest

# Scan your entire repo history
gitleaks detect --source . --verbose

# Scan only staged changes (pre-commit)
gitleaks protect --staged
```

**What it finds:**

```
Finding:     STRIPE_SECRET_KEY=sk_live_4eC39HqLyjWDarjtT1zdp7dc
Secret:      sk_live_4eC39HqLyjWDarjtT1zdp7dc
RuleID:      stripe-api-key
Entropy:     4.56
File:        config/.env
Commit:      a1b2c3d4e5f6
Author:      dev@example.com
Date:        2026-01-15T10:30:00Z
```

### Step 2: Check GitHub's Secret Scanning

If your repo is on GitHub, you already have basic secret scanning. Go to **Settings > Code security and analysis > Secret scanning**. GitHub detects patterns from 200+ service providers and can auto-revoke some tokens.

### Step 3: Scan Your Docker Images

Secrets baked into Docker images are just as dangerous:

```bash
# Scan a Docker image for secrets
trivy image --scanners secret your-image:latest
```

## How to Remove Secrets from Git History

**Important:** Removing a secret from history doesn't un-leak it. If the repo was ever public, or if anyone cloned it, **rotate the secret immediately**. Treat it as compromised.

### Option 1: `git filter-repo` (Recommended)

```bash
# Install
pip install git-filter-repo

# Remove a specific file from all history
git filter-repo --invert-paths --path config/.env

# Remove a specific string from all files in history
git filter-repo --replace-text <(echo 'sk_live_4eC39HqLyjWDarjtT1zdp7dc==>REDACTED')
```

### Option 2: BFG Repo Cleaner

```bash
# Remove all files named .env from history
java -jar bfg.jar --delete-files .env

# Replace specific strings
java -jar bfg.jar --replace-text passwords.txt
```

After either option:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

## How to Prevent It From Happening Again

Here's a practical checklist — no enterprise tools needed, all free:

### 1. Pre-commit Hook with Gitleaks

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
```

Every `git commit` now scans staged files for secrets **before** they enter history.

### 2. Proper `.gitignore` from Day One

```gitignore
# Secrets — never commit
.env
.env.*
*.pem
*.key
*credentials*
*.tfvars
*.tfstate

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store
Thumbs.db
```

### 3. Environment Variables, Not Files

```bash
# Bad: hardcoded in code
API_KEY = "sk_live_abc123"

# Good: environment variable
API_KEY = os.environ["API_KEY"]

# Better: secret manager reference
API_KEY = vault.read("secret/api/stripe")
```

### 4. Git Config: Global Ignore

```bash
# Create a global gitignore for ALL your repos
echo ".env" >> ~/.gitignore_global
echo "*.pem" >> ~/.gitignore_global
echo "*.key" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

### 5. CI/CD Secret Scanning

Add to your GitHub Actions workflow:

```yaml
- name: Scan for secrets
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## What STOA Does Differently

Every technique above requires **you** to set it up, maintain it, and hope your team follows the rules. That's the fundamental problem: security that depends on human discipline doesn't scale.

STOA Platform handles secrets management as a **built-in, zero-config feature** — even in the free, open-source tier:

- **No API keys in code** — STOA uses short-lived tokens with automatic rotation. No static keys to leak.
- **mTLS by default** — Services authenticate with certificates, not passwords. No shared secrets.
- **Audit trail** — Every API call is logged with caller identity, not just an anonymous key. When something goes wrong, you know *who*, not just *what*.
- **Policy-as-code** — Access control is defined in version-controlled policies (OPA), not scattered across environment variables.
- **Secret injection at runtime** — Credentials flow from your secret manager to pods at startup, never touching git.

The difference: with traditional approaches, security is something you **add**. With STOA, security is something you **can't accidentally remove**.

## Quick Start: Secure Your Existing Project Today

Even without STOA, do these three things right now:

```bash
# 1. Install gitleaks
brew install gitleaks

# 2. Scan your repo
cd your-project && gitleaks detect --source . --verbose

# 3. Set up pre-commit hook
gitleaks protect --install
```

If gitleaks finds something: **rotate the secret immediately**, then clean the history.

If you want to go further — automatic rotation, mTLS, audit trails, policy-as-code — [try STOA](/docs/guides/quickstart). It's free, open source, and takes 5 minutes to set up.

## FAQ

### Can I use gitleaks on private repositories?

Yes. Gitleaks runs locally — it scans your local git history without sending anything to external servers. It works on any repository, private or public.

### What if I already pushed a secret to a public repo?

**Rotate the secret immediately.** Assume it's compromised. Then clean the history with `git filter-repo` and force push. GitHub's secret scanning may have already flagged it — check your repository's Security tab.

### Does STOA eliminate the need for API keys entirely?

For service-to-service communication, yes — STOA uses [mTLS certificates](https://docs.gostoa.dev/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) instead of static keys. For external consumers, STOA issues short-lived OAuth tokens that expire automatically. The goal is zero static secrets in your codebase.

### How does this relate to the OWASP API Security Top 10?

Exposed secrets map to OWASP API8:2023 — Security Misconfiguration. Our [API Security Checklist](/blog/api-security-checklist-solo-dev) covers all 10 OWASP API risks with practical fixes.

---

**Related**: [Open Source API Gateway Guide](/blog/open-source-api-gateway-2026) | [API Security Checklist](/blog/api-security-checklist-solo-dev) | [Quick Start](/docs/guides/quickstart)

*Found this useful? Star us on [GitHub](https://github.com/stoa-platform/stoa) and join the conversation on [Discord](https://discord.gostoa.dev).*
