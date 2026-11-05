---
title: AI-assisted delivery guardrails
sidebar_label: AI-assisted delivery guardrails
description: "Tools, controls and guardrails applied to AI-assisted contributions to STOA, as they can be verified in the public repositories."
---

# AI-assisted delivery guardrails

This page lists the controls that apply to contributions to STOA when an AI assistant writes or reviews part of the change. It only describes what can be read in the public `stoa` and `stoa-docs` repositories: contribution rules, git hooks, GitHub Actions workflows, published architecture decisions. Each statement cites the file it comes from; the links are pinned to the inspected revisions in the [source revisions](#source-revisions) section.

An AI-assisted change follows the same path as any other change: branch, pull request, checks on the pull request revision, maintainer review, squash merge, release. The [delivery process](./delivery-process.md) page describes that path and the component CI workflows. This page focuses on the controls themselves and on what they do and do not prove.

## Reading rules

- An architecture decision record explains why a control exists. The workflow file at a given revision defines what runs. The job log of a given run shows what ran. Keep the three apart when assessing a change.
- Branch protection, required-check lists and repository variables are repository settings, not files. The workflow files document the expected values; the settings themselves must be verified on the repository.
- Several controls are advisory or warning-only at the inspected revision. They are listed as such below. A green run is not evidence that an advisory control passed.

## Rules that apply to every commit

| Rule | Where it is defined | How it is enforced |
| --- | --- | --- |
| Developer Certificate of Origin sign-off | [CONTRIBUTING.md][contributing] (DCO section), [CLA.md][cla], [DCO][dco] text | Required by the contribution rules for every commit (`git commit -s`). The same requirement is stated in the docs repository [contributing rules][docs-contributing]. |
| Conventional commit messages | [CONTRIBUTING.md][contributing], [commitlint.config.js][commitlint] | Validated locally by the [commit-msg hook][husky-commit-msg]. Allowed types are listed in the config; scopes are a warning-level rule. |
| Lint on staged files | [pre-commit hook][husky-pre-commit] | Runs `lint-staged` before each commit. |
| English for everything committed or published | [CONTRIBUTING.md][contributing] (Language section) | Applies to pull request titles, commit messages, comments, documentation and release notes. |
| Signed commits | [required-checks.yml][required-checks], [check-signed-commits.py][signed-commits-script] | Human commits authored at or after the baseline date set in the script are expected to carry a verified signature; bot and service-account commits are exempt. The job runs with `continue-on-error`, so it is warning-only at this revision. |
| Maintainer review | [CODEOWNERS][codeowners], [GOVERNANCE.md][governance] | Every path requires review by the maintainers team; workflows, authentication, security, charts, deployment and documentation paths are listed explicitly. Governance requires one maintainer approval and a passing CI before merge, and an architecture decision record for architecture changes. |
| Pull request checklist | [PULL_REQUEST_TEMPLATE.md][pr-template] | Declares the type of change, breaking changes, how it was tested, and a quality checklist (tests pass, no new lint warnings, no secrets, commit format). |
| Vulnerability reporting | [SECURITY.md][security-policy] | Private reporting channel, acknowledgement and disclosure process, safe-harbor statement. Not a pull request check, but the reference for security findings raised by any reviewer, human or automated. |

## Automated checks on every pull request

| Check | Workflow | What it does | Blocking at this revision |
| --- | --- | --- | --- |
| CI Gate | [ci-gate.yml][ci-gate], [aggregation script][ci-gate-aggregate] | Detects changed components, calls their CI workflows and the security workflow, aggregates results, enforces container image pinning. See the [delivery process](./delivery-process.md#non-regression-and-quality-gates) for the per-component checks. | Yes for selected components; unselected components must be skipped. |
| Image Pinning Guard | [required-checks.yml][required-checks], [check_image_pinning.py][image-pinning] | Requires pinned container images in changed files. | Yes. |
| License Compliance | [required-checks.yml][required-checks], [check_licences_offline.py][licences-script] | Offline license check of the dependency tree, with a report artifact. The mode comes from the `LICENSES_MODE` repository variable; the default `warn` never fails the job. | Only when the variable is set to `deny` or `enforce`. |
| SBOM Generation | [required-checks.yml][required-checks] | Produces CycloneDX and SPDX software bills of materials with Trivy and uploads them as artifacts. | Yes (job must complete). |
| Regression Test Guard | [regression-guard.yml][regression-guard] | Detects fix pull requests and requires an added or modified regression test. Documentation and configuration-only fixes are exempt; the `skip-regression` label is an explicit override. | Yes, with the documented exemptions. |
| Security Scan | [security-scan.yml][security-scan] | Called by the CI Gate on pull requests, and also on pushes to `main` and daily: SAST for Rust (Clippy), Python (Bandit, medium severity and confidence) and JavaScript (ESLint security plugin, two rules as errors; the zero-warning report step is non-blocking); dependency audits (`cargo audit`, `pip-audit`, `npm audit`); secret scan with Gitleaks on the pull request commit range using [.gitleaks.toml][gitleaks-config]; OpSec scan with [opsec-scan.sh][opsec-scan] for infrastructure addresses, financial data, client references, default passwords and key material patterns; Trivy container scan reporting critical and high findings. | SAST, secret and OpSec scans fail the job. The container scan job and several dependency-audit steps carry `continue-on-error` with a tracked reason in the file. |
| Dependency Review | [dependency-review.yml][dependency-review] | Fails on newly introduced dependencies with high severity vulnerabilities and denies GPL-3.0, AGPL-3.0 and SSPL-1.0 licenses. | Yes. |
| Purged paths guard | [purged-paths-guard.yml][purged-paths], [purged-paths-guard.sh][purged-paths-script] | Fails if a path removed from history reappears in the tree or in the commit range. The paths are stored as SHA-256 digests only. | Yes. |
| AI Context Lint | [ai-context-lint.yml][ai-context-lint], [ai_context_lint.py][ai-context-lint-script] | On changes to `CLAUDE.md`, `AGENTS.md`, `README.md` or `.claude/`, blocks stale markers (retired components, nonexistent paths, outdated stack versions) that an LLM-driven edit could reintroduce. | Yes, on the listed paths. |
| OpenSSF Scorecard | [scorecard.yml][scorecard] | Runs on pushes to `main` and on a schedule; results go to the repository security tab. | Not a pull request check. |
| Dependency updates | [dependabot.yml][dependabot] | Weekly grouped minor and patch updates with a `chore(deps)` prefix; major updates are ignored for the configured ecosystems. | Not a check; produces pull requests that go through the checks above. |

The [required-checks.yml][required-checks] header records which jobs the branch protection treats as required at the time of writing in that file. Confirm the list on the repository settings before relying on it.

## Controls specific to AI-assisted changes

### Advisory AI review of pull requests

[ADR-065](./adr/adr-065-pr-guardian.md) establishes an advisory-only automated review, the STOA PR Guardian. The [workflow][pr-guardian], the [skill][pr-guardian-skill] and the [policy pack][pr-guardian-policy] define it:

- Runs when a pull request is opened, marked ready for review or updated. Skipped for draft pull requests, bot authors, pull requests from forks, the `skip-guardian` and `wip` labels, and when the `DISABLE_PR_GUARDIAN` repository variable is set.
- Diffs above 1000 lines are not reviewed; the workflow posts a notice that human review is required.
- Three axes: architecture decision compliance, security regression, AI code smell. The verdict is binary (GO or NO-GO) with a confidence level. Any security flag promotes the verdict to NO-GO.
- Hard rules in the skill: never approve, never request changes through the review API, comment only, English comments, summary comment starting with a fixed marker so it can be replaced idempotently.
- The agent runs with a restricted tool set (read, glob, grep, shell), a turn limit and a model pinned in the workflow. The run is `continue-on-error`: a failure is reported as a comment, not hidden, and does not block the pull request.

The Guardian does not replace maintainer review. It never approves, and the [CODEOWNERS][codeowners] rule still applies.

### Multi-stage review and the stage 3 code review

[ADR-061](./adr/adr-061-council-multi-stage-review.md) describes a three-stage review: ticket relevance, plan validation, then code review before merge. The stage 3 code review is implemented by [council-gate.yml][council-gate] and [council-review.sh][council-script]:

- Four axes evaluated independently on the diff (conformance, debt, attack surface, contract impact), aggregated into a score; the script approves at 8.0 or above and returns a rework exit code below.
- The workflow job is `continue-on-error`, documented in the file as shadow mode: results are posted as a pull request comment and do not block the merge.
- Skipped for the Dependabot, Claude and GitHub Actions bot accounts and for pull requests from forks; disabled by the `COUNCIL_S3_ENABLED` repository variable; a missing API key turns the job into a no-op.
- The script runs a Gitleaks pre-flight and refuses to send a diff that contains a detected secret.

### AI-driven implementation from issues

[claude-issue-to-pr.yml][issue-to-pr] lets a repository member hand an issue to an AI agent that opens a pull request. The controls in the file are:

- Stages chained by explicit human commands: ticket relevance review, then a `/go` comment, then plan validation, then a `/go-plan` comment, then implementation. The `/go` and `/go-plan` comments are honored only from users whose association is owner, member or collaborator. Issues labeled `ship-fast-path` by stage 1 (ship-mode changes estimated at five points or fewer) skip plan validation, and the workflow posts the `/go-plan` comment itself, as recorded in [ADR-061](./adr/adr-061-council-multi-stage-review.md).
- A `DISABLE_L1_IMPLEMENT` repository variable disables real-event triggers; manual dispatch runs exactly one stage for controlled replays.
- Each stage has a turn limit and a job timeout.
- The resulting pull request goes through the pull request checks listed above. Note that the Guardian and the stage 3 review skip bot-authored pull requests, so those axes fall back to maintainer review for such pull requests.

### AI context contract

[ADR-062](./adr/adr-062-claude-md-hierarchy-no-rules-dir.md), which partially supersedes [ADR-030](./adr/adr-030-ai-context-management.md), defines the instruction files that an AI session loads: a root [CLAUDE.md][claude-md] plus per-component files, limited to binary rules, with detailed protocols kept in on-demand documents. The rules relevant to delivery in the root file at the inspected revision include:

- A red CI on `main` is the absolute priority; nothing merges and nothing starts until it is green.
- The pre-push quality gate is mandatory; `--no-verify` is forbidden outside an explicit emergency.
- Pull requests above 300 changed lines must be split.
- A `fix` without a regression test is blocked; tests are written before code for features and fixes; the API coverage floor is 70 percent and never decreases.
- Merges are squash merges with branch deletion; no direct push to `main`; force pushes, hard resets and deletion of third-party branches require asking first.
- Secrets are never hardcoded; Kubernetes secret manifests use a placeholder; `.env*`, `*.pem`, `*.key`, `*.tfvars` and `*credentials*` files are never committed.
- Credentials are never reset, changed or rotated by the assistant; destructive infrastructure operations require explicit confirmation.

[AI Context Lint][ai-context-lint] guards these files against stale content, as listed in the previous section.

### Session hooks and restricted subagents

[.claude/settings.json][claude-settings] wires shell hooks that run inside an AI session before or after tool calls. At the inspected revision the pre-tool hooks include:

- [pre-edit-protect-infra.sh][hook-protect-infra]: blocks edits to protected infrastructure paths without explicit confirmation.
- [pre-edit-no-k8s-secrets.sh][hook-no-secrets]: blocks writing values that look like real credentials into Kubernetes Secret manifests or Docker configuration.
- [pre-push-quality-gate.sh][hook-pre-push]: before a `git push`, detects the changed components and runs their checks, including the OpSec scan; kill-switches are documented at the top of the file.

Subagent definitions in [.claude/agents/][claude-agents] declare allowed and disallowed tools: for example the [security reviewer][agent-security] cannot write or edit files, and the [documentation writer][agent-docs] has no shell access.

These hooks run only inside a local AI session that uses this configuration. They are a first line of defense for the operator, not a server-side control; the pull request workflows remain the enforced layer.

### AI-written user interface changes

[ADR-060](./adr/adr-060-ai-verified-ui-testing.md) decides a four-layer validation for user interface changes produced by AI agents: seeded test data, accessibility-tree assertions, visual regression baselines and an accessibility gate. The corresponding workflows are [e2e-a11y-gate.yml][e2e-a11y] and [e2e-visual-regression.yml][e2e-visual]; read their triggers at the revision being assessed, since they are not part of the CI Gate aggregation.

## Documentation repository checks

Changes to this documentation site go through their own checks in the `stoa-docs` repository:

- [ADR Lint][adr-lint] with [adr_lint.py][adr-lint-script]: unique ADR numbers, header matching the filename, and a set of blocking consistency rules; missing status or date lines are warnings.
- [Docs Audit][docs-audit]: a client-name audit over the documentation and a content-compliance scan of blog articles for unsourced comparative or regulatory claims, on pull requests and pushes to `main`.
- [docusaurus.config.ts][docusaurus-config]: broken links, broken anchors and broken markdown links fail the build.
- The same DCO sign-off and conventional commit rules as the main repository, stated in the docs [CONTRIBUTING.md][docs-contributing].

## Limits of the evidence

- Advisory controls (Guardian, stage 3 review) never approve and never block. Maintainer approval under [CODEOWNERS][codeowners] and [GOVERNANCE.md][governance] is the approval step.
- Warning-only controls at this revision: signed-commit verification, license compliance in the default mode, several dependency-audit steps. Read the job summary, not only the job status.
- Repository variables named in the workflows (`DISABLE_PR_GUARDIAN`, `COUNCIL_S3_ENABLED`, `DISABLE_L1_IMPLEMENT`, `LICENSES_MODE`) change behavior without a code change. Their values are not visible in the repository.
- Nothing on this page is a certification or an attestation. It is a map of where each control is defined so that a reviewer can verify it for a given commit.

## Verifying a given change

1. Record the pull request, its head commit and the merged commit.
2. Open the workflow files at that commit and list the jobs they define for a pull request event.
3. Compare that list with the checks reported on the pull request; note any job marked `continue-on-error` or skipped by a label or variable.
4. For AI-assisted changes, look for the Guardian summary comment and the stage 3 comment, and read the sign-off and signature status of each commit.
5. Keep the commit, the run links and the maintainer approval together in the review record.

## Source revisions

Links are pinned to the inspected revisions. For another revision, inspect the same paths at that commit.

[contributing]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CONTRIBUTING.md
[cla]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CLA.md
[dco]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/DCO
[commitlint]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/commitlint.config.js
[husky-commit-msg]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.husky/commit-msg
[husky-pre-commit]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.husky/pre-commit
[codeowners]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/CODEOWNERS
[governance]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/GOVERNANCE.md
[pr-template]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/PULL_REQUEST_TEMPLATE.md
[security-policy]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/SECURITY.md
[required-checks]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/required-checks.yml
[signed-commits-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/scripts/check-signed-commits.py
[ci-gate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/ci-gate.yml
[ci-gate-aggregate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/scripts/ci-gate-aggregate.sh
[image-pinning]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/check_image_pinning.py
[licences-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/check_licences_offline.py
[regression-guard]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/regression-guard.yml
[security-scan]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/security-scan.yml
[gitleaks-config]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.gitleaks.toml
[opsec-scan]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/opsec-scan.sh
[dependency-review]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/dependency-review.yml
[purged-paths]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/purged-paths-guard.yml
[purged-paths-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ci/purged-paths-guard.sh
[ai-context-lint]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/ai-context-lint.yml
[ai-context-lint-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/ai_context_lint.py
[scorecard]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/scorecard.yml
[dependabot]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/dependabot.yml
[pr-guardian]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/pr-guardian.yml
[pr-guardian-skill]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/skills/pr-guardian/SKILL.md
[pr-guardian-policy]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/docs/ai/pr-guardian-policy.md
[council-gate]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/council-gate.yml
[council-script]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/scripts/council-review.sh
[issue-to-pr]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/claude-issue-to-pr.yml
[claude-md]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/CLAUDE.md
[claude-settings]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/settings.json
[hook-protect-infra]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-edit-protect-infra.sh
[hook-no-secrets]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-edit-no-k8s-secrets.sh
[hook-pre-push]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/hooks/pre-push-quality-gate.sh
[claude-agents]: https://github.com/stoa-platform/stoa/tree/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents
[agent-security]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents/security-reviewer.md
[agent-docs]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.claude/agents/docs-writer.md
[e2e-a11y]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/e2e-a11y-gate.yml
[e2e-visual]: https://github.com/stoa-platform/stoa/blob/25917dfea8e8261f97d8f9d742469727e0557c29/.github/workflows/e2e-visual-regression.yml
[docs-contributing]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/CONTRIBUTING.md
[adr-lint]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/.github/workflows/adr-lint.yml
[adr-lint-script]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/scripts/adr_lint.py
[docs-audit]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/.github/workflows/docs-audit.yml
[docusaurus-config]: https://github.com/stoa-platform/stoa-docs/blob/45f3aaa0fb3e7c5050a93c73b9fd1295e7d8daa9/docusaurus.config.ts
