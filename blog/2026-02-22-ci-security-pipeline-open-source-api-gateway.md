---
slug: ci-security-pipeline-open-source-api-gateway
title: "9-Job CI Security Pipeline: Scanning Every PR Automatically"
description: "Gitleaks, Bandit, Clippy SAST, Trivy, and license checks in one GitHub Actions pipeline. How we catch secrets and CVEs on every PR across 3 languages."
authors: [stoa-team]
tags: [security, architecture, open-source, tutorial]
keywords:
  - ci security pipeline api gateway
  - github actions security scanning
  - open source api gateway security
  - sbom generation cyclonedx spdx
  - sast open source api gateway
---
<!-- last verified: 2026-02 -->

# 9-Job CI Security Pipeline: How STOA Scans Every PR

**STOA runs 9 parallel security jobs on every pull request — secret scanning, SAST for three languages, dependency audits, container scanning, license compliance, SBOM generation, and commit signature verification.** This article breaks down each job, explains what it catches, and shows you how to adopt the same approach in your own projects. This is part of our [open-source API gateway](/blog/open-source-api-gateway-2026) philosophy: security scanning should be built into CI, not bolted on after a breach.

<!-- truncate -->

## Why 9 Jobs, Not 1

A single security scanner can't cover everything. Secret detection tools don't understand code flow. SAST tools don't scan container images. License scanners don't check for CVEs. Each job in the pipeline catches what the others miss.

The 9-job design follows a **defense-in-depth** model: even if one job has a false negative, another job catches the issue at a different layer. A hardcoded API key might slip past Bandit (which looks for code patterns), but Gitleaks will flag it by regex. A vulnerable dependency might not trigger a SAST finding, but `pip-audit` will report the CVE.

Running the jobs in parallel also means the pipeline finishes in the time of the slowest job (~5 minutes for container builds), not the sum of all jobs. Developers get fast feedback without sacrificing coverage.

Here is the full pipeline at a glance:

| # | Job | Tool | Language | Blocking? |
|---|-----|------|----------|-----------|
| 1 | Secret Scan | Gitleaks 8.21 | Any | Yes |
| 2 | SAST Python | Bandit | Python | Yes |
| 3 | SAST Rust | Clippy (strict) | Rust | Yes |
| 4 | SAST JavaScript | ESLint Security | TypeScript | Partial |
| 5 | Dependency Scan | cargo-audit, pip-audit, npm audit | All | No |
| 6 | Container Scan | Trivy | Docker images | No |
| 7 | License Compliance | Trivy SPDX | All | Yes (required check) |
| 8 | SBOM Generation | Trivy CycloneDX + SPDX | All | Yes (required check) |
| 9 | Signed Commits | git verify-commit | Any | Yes (required check) |

Three of these jobs are **required checks** for merging — meaning a PR cannot be merged until they pass. The rest are either blocking (fail the job but don't block merge) or advisory (report findings without failing). This graduated approach prevents alert fatigue while still catching critical issues.

---

## Job-by-Job Breakdown

### 1. Gitleaks — Secret Detection

**What it catches:** API keys, tokens, passwords, private keys, and other credentials committed to the repository — including those buried deep in git history.

Gitleaks scans the full repository with `fetch-depth: 0`, meaning it checks every commit, not just the latest one. This matters because [secrets in git history persist even after deletion](/blog/api-keys-in-git-history) — a `git rm` only removes the file from the working tree, not from past commits.

STOA uses a custom `.gitleaks.toml` configuration that extends the default ruleset with allowlists for known false positives:

```toml
[extend]
useDefault = true

[allowlist]
paths = [
  '''docs/.*\.md''',         # Documentation with example keys
  '''tests/.*''',            # Test fixtures with dummy credentials
  '''deploy/docker-compose/.*''',  # Local-only compose files
  '''scripts/demo/.*''',     # Demo scripts with test credentials
]

regexes = [
  '''stoa_[a-zA-Z]+_[a-zA-Z0-9]{8,}_example''',  # Placeholder keys
  '''your[_-]?api[_-]?key''',
]
```

The allowlist is explicit and minimal. Every path added to it has a comment explaining why. False positives in documentation and test fixtures are expected — real secrets in `src/` are not.

**Blocking?** Yes. A secret leak is always a P0.

### 2. Bandit — Python SAST

**What it catches:** SQL injection, shell injection, hardcoded passwords, use of `eval()`, insecure hash functions, weak cryptography, and other Python-specific security anti-patterns.

Bandit runs against both Python components (`control-plane-api` and `mcp-gateway`) using a matrix strategy:

```yaml
strategy:
  fail-fast: false
  matrix:
    project: [control-plane-api, mcp-gateway]
```

The severity and confidence thresholds are both set to **MEDIUM**, which filters out low-confidence noise while still catching meaningful issues:

```bash
bandit -r $PROJECT/ --severity-level medium --confidence-level medium
```

Results are also exported as JSON artifacts (retained for 30 days) for trend analysis and audit trails.

**Blocking?** Yes. MEDIUM+ severity with MEDIUM+ confidence fails the job.

### 3. Clippy SAST — Rust Security Linting

**What it catches:** Unsafe patterns, panics in production code, leftover debug macros, unfinished implementations, and risky error handling in Rust code.

The standard Clippy check in CI uses `-D warnings` (deny all warnings). The security scan goes further with targeted rules:

```bash
cargo clippy --all-targets --all-features -- \
  -W warnings \
  -D clippy::todo \
  -D clippy::unimplemented \
  -D clippy::dbg_macro \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic
```

The `-D` (deny) flags make the build fail if `todo!()`, `unimplemented!()`, or `dbg!()` macros are found — these are development shortcuts that must never reach production. The `-W` (warn) flags for `unwrap_used`, `expect_used`, and `panic` flag potential panic points without failing the build outright, since some uses are legitimate (e.g., in test code included via `--all-targets`).

**Blocking?** Yes. Denied lints fail the job.

### 4. ESLint Security — TypeScript SAST

**What it catches:** `eval()` with dynamic expressions, unsafe regex patterns, object injection, timing attacks, CSRF bypasses, and buffer overflows in TypeScript code.

The ESLint security job uses a **two-tier design** — 7 rules are reported, but only 2 are merge-blocking:

```yaml
# Tier 1: Full report (non-blocking, 7 rules)
npx eslint 'src/**/*.{ts,tsx}' \
  --plugin security \
  --rule '{"security/detect-object-injection": "error", ...}' \
  --max-warnings 0

# Tier 2: Blocking gate (2 critical rules only)
npx eslint 'src/**/*.{ts,tsx}' \
  --no-eslintrc \
  --rule '{"security/detect-eval-with-expression": "error",
           "security/detect-unsafe-regex": "error"}'
```

Why partial blocking? Rules like `detect-object-injection` produce false positives on legitimate bracket notation (`obj[key]`). Making all 7 rules blocking would drown developers in noise. The two blocking rules — `eval` with expressions and unsafe regex — have near-zero false positive rates and represent critical vulnerabilities (XSS and ReDoS respectively).

**Blocking?** Partially. `detect-eval-with-expression` and `detect-unsafe-regex` block the merge. The other 5 rules report findings without failing.

### 5. Dependency Scanning — CVE Detection

**What it catches:** Known vulnerabilities (CVEs) in third-party dependencies across all three language ecosystems.

Three tools run in sequence, each targeting one ecosystem:

| Tool | Ecosystem | Command |
|------|-----------|---------|
| `cargo audit` | Rust (Cargo.lock) | `cargo audit` |
| `pip-audit` | Python (requirements.txt) | `pip-audit -r requirements.txt --desc` |
| `npm audit` | Node.js (package-lock.json) | `npm audit --audit-level=high` |

**Why non-blocking?** Dependency vulnerabilities often require upstream fixes that are outside the PR author's control. A transitive dependency three levels deep might have a known CVE with no available patch. Making this job blocking would freeze all development until every upstream maintainer releases a fix — an unreasonable constraint for an open-source project.

Instead, findings are tracked as warnings. The daily scheduled run (cron at 06:00 UTC) ensures the team sees new CVEs within 24 hours even without active PRs.

**Blocking?** No. `continue-on-error: true` on the job. Findings are visible in the workflow summary.

### 6. Container Scanning — Image Vulnerability Detection

**What it catches:** OS-level and library vulnerabilities in Docker images, including base image CVEs (Alpine, Debian) and application-level issues baked into the final image.

Trivy scans all 5 component images:

```yaml
matrix:
  image:
    - name: control-plane-api
    - name: mcp-gateway
    - name: portal
    - name: stoa-gateway
    - name: control-plane-ui
```

Each image is built locally in CI and scanned for CRITICAL and HIGH severity vulnerabilities, ignoring unfixed issues (no patch available yet):

```yaml
severity: 'CRITICAL,HIGH'
vuln-type: 'os,library'
ignore-unfixed: true
exit-code: '1'
```

Results are exported as SARIF files and uploaded to GitHub Security (when Advanced Security is enabled). This creates a centralized view of all container vulnerabilities across the repository.

**Blocking?** No at the job level (`continue-on-error: true`), but the Trivy step itself exits with code 1 on HIGH+ findings — making individual image failures visible in the workflow summary.

### 7. License Compliance — Copyleft Detection

**What it catches:** Dependencies using copyleft licenses (GPL, AGPL, LGPL, SSPL, EUPL) that would be incompatible with STOA's Apache 2.0 license.

Trivy scans the filesystem and generates an SPDX report, then a Python script checks every package's declared license against a copyleft blocklist:

```python
copyleft = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1',
            'LGPL-3.0', 'SSPL-1.0', 'EUPL-1.2']
```

This is particularly important for an open-source project. Accidentally including a GPL dependency would require either relicensing the entire project or removing the dependency — both expensive operations. Catching it at PR time costs nothing. To understand why STOA chose Apache 2.0 over BSL or other licenses, see [Why Apache 2.0, Not BSL](/blog/why-apache-2-not-bsl).

**Blocking?** Yes. This is one of the 3 required checks for merging.

### 8. SBOM Generation — Software Bill of Materials

**What it catches:** Nothing directly — SBOMs are a transparency tool, not a detection tool. They generate a machine-readable inventory of every component, library, and dependency in the project.

STOA generates SBOMs in both major formats:

| Format | Standard | Primary Consumer |
|--------|----------|-----------------|
| CycloneDX | OASIS | Security tools, vulnerability management |
| SPDX | ISO/IEC 5962:2021 | License compliance, procurement |

Both files are uploaded as artifacts with 90-day retention — long enough for audits and incident response.

Why does this matter? Regulations like [DORA and NIS2](/blog/dora-nis2-api-gateway-compliance) require organizations to maintain accurate software inventories. If a new CVE is published for a library you use, the SBOM tells you immediately whether you're affected — without manually grepping lock files across 5 components.

**Blocking?** Yes. This is one of the 3 required checks for merging.

### 9. Verified Signed Commits — Supply Chain Integrity

**What it catches:** Unsigned commits that could indicate compromised credentials or unauthorized contributions.

The job checks GPG signatures on PR commits (or the last 10 commits on push):

```bash
for COMMIT in $COMMITS; do
  if git verify-commit "$COMMIT" 2>/dev/null; then
    echo "Signed"
  else
    UNSIGNED=$((UNSIGNED + 1))
  fi
done
```

Currently configured as a **warning** (`continue-on-error: true`) rather than a hard block, since not all contributors have GPG keys configured. The workflow summary clearly shows which commits are signed and which are not.

**Blocking?** Yes (required check), but the job itself uses `continue-on-error: true` — it reports unsigned commits without preventing the merge. This graduated approach lets the team track adoption without blocking contributions.

---

## The Three Required Checks

GitHub branch protection enforces 3 checks that must pass before any PR can merge to `main`:

1. **License Compliance** — no copyleft dependencies
2. **SBOM Generation** — software inventory is always current
3. **Verified Signed Commits** — supply chain awareness

These three were chosen because they represent **organizational commitments**, not just code quality. License compliance protects the project's legal status. SBOMs satisfy regulatory requirements. Signed commits build trust in the supply chain. None of them can be "fixed later" — a copyleft dependency merged today creates legal exposure immediately.

The SAST and dependency jobs (Bandit, Clippy, ESLint, audits) are blocking at the job level but not required for merge. This means their failures are visible and must be acknowledged, but an urgent hotfix can bypass them if needed.

---

## Polyglot by Design

STOA is a polyglot monorepo: Python (API, MCP Gateway), Rust (STOA Gateway), and TypeScript (Console, Portal). The security pipeline covers all three ecosystems with language-appropriate tools:

| Concern | Python | Rust | TypeScript | Language-Agnostic |
|---------|--------|------|------------|-------------------|
| SAST | Bandit | Clippy (strict) | ESLint Security | — |
| Dependencies | pip-audit | cargo-audit | npm audit | — |
| Secrets | — | — | — | Gitleaks |
| Containers | Trivy | Trivy | Trivy | Trivy |
| Licenses | — | — | — | Trivy SPDX |
| SBOM | — | — | — | Trivy CycloneDX + SPDX |
| Signatures | — | — | — | git verify-commit |

Every language gets its own SAST and dependency scanner. Cross-cutting concerns (secrets, containers, licenses, SBOMs, signatures) use language-agnostic tools that work on the entire repository.

---

## How to Adopt This in Your Own Project

You don't need a polyglot monorepo to benefit from this approach. Here's how to start:

### Step 1: Add Gitleaks (30 minutes)

Secret scanning has the highest ROI of any security job. One leaked API key can cost more than every other vulnerability combined.

```yaml
- name: Secret Scan
  uses: gitleaks/gitleaks-action@v2
  with:
    config-path: .gitleaks.toml
```

Start with the default rules. Add allowlist paths only when you get false positives — and document why each path is allowlisted.

### Step 2: Add SAST for Your Language (1 hour)

Pick the SAST tool for your primary language:

- **Python**: `pip install bandit && bandit -r src/ -ll`
- **Rust**: `cargo clippy -- -D clippy::todo -D clippy::dbg_macro`
- **TypeScript**: `npx eslint --plugin security --rule '{"security/detect-eval-with-expression": "error"}'`
- **Go**: `go vet ./...` + `staticcheck ./...`
- **Java**: SpotBugs or PMD

### Step 3: Add SBOM Generation (15 minutes)

```yaml
- name: Generate SBOM
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    format: 'cyclonedx'
    output: 'sbom.json'

- name: Upload SBOM
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.json
    retention-days: 90
```

Even if you don't need SBOMs for compliance today, having them available when a major CVE drops (like Log4Shell) saves hours of "do we use this library?" investigation.

---

## Supply Chain Hardening: Pinned Action SHAs

One detail worth highlighting: every GitHub Action in the pipeline is pinned to a specific commit SHA, not a version tag:

```yaml
# Instead of this (mutable tag):
uses: actions/checkout@v4

# STOA uses this (immutable SHA):
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
```

Version tags like `v4` are mutable — a compromised maintainer could push malicious code to the same tag. Commit SHAs are immutable. This is a simple change that eliminates an entire class of supply chain attacks.

---

## FAQ

### Why are dependency scans non-blocking?

Dependency vulnerabilities are often in transitive dependencies that the project doesn't control directly. Making them blocking would freeze development whenever an upstream library has a known CVE with no available patch. Instead, they're tracked as warnings with daily scheduled scans to ensure visibility.

### What is an SBOM and why does it matter?

A Software Bill of Materials (SBOM) is a machine-readable inventory of every component in your software — like a nutrition label for code. It matters because regulations like DORA and NIS2 require organizations to know exactly what's in their software supply chain. When a new CVE is published, the SBOM tells you in seconds whether you're affected.

### Why pin GitHub Actions to SHAs instead of version tags?

Version tags (`v4`, `v3`) are mutable — anyone with write access to the action repository can change what code a tag points to. Commit SHAs are immutable. Pinning to SHAs means the exact code you audited is the code that runs in your CI, even if the action's repository is compromised later.

### Why ESLint Security instead of Semgrep for TypeScript?

ESLint Security integrates natively with the existing ESLint setup — no additional tool installation, no separate configuration language, no runtime dependency. Semgrep is more powerful for cross-language analysis, but for a TypeScript-only scan, ESLint Security provides sufficient coverage with zero additional complexity. The two critical rules (`detect-eval-with-expression` and `detect-unsafe-regex`) catch the highest-impact TypeScript vulnerabilities.

### How do you handle Gitleaks false positives?

Every false positive is added to `.gitleaks.toml` with an explicit path pattern and a comment explaining why it's safe. The allowlist uses path-level exclusions (not global rule disabling), so only specific files are exempted. Common false positives include example API keys in documentation, test fixtures with dummy credentials, and Docker Compose files with local-only passwords.

---

## What's Next

Security scanning is one layer of a broader strategy. For related topics:

- [Your API Keys Are in Your Git History](/blog/api-keys-in-git-history) — deep dive on secret detection and remediation
- [API Security Checklist for Solo Devs](/blog/api-security-checklist-solo-dev) — 10 practical security steps for individual developers
- [DORA & NIS2 Compliance for API Gateways](/blog/dora-nis2-api-gateway-compliance) — how SBOMs and audit trails support regulatory requirements
- [Open-Source API Gateway Landscape 2026](/blog/open-source-api-gateway-2026) — comparing security postures across open-source API gateways

> Feature comparisons are based on publicly available documentation as of 2026-02. Product capabilities change frequently. We encourage readers to verify current features directly with each vendor. All trademarks belong to their respective owners.


---

## Ready to bridge your existing APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
