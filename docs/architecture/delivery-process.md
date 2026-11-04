---
title: Delivery process
sidebar_label: Delivery process
description: "How STOA plans changes, checks regressions, versions components, and traces releases to code and architecture decisions."
---

# Delivery process

This document describes the repository evidence for delivering STOA, a sovereign API and integration platform with an MCP module. The accepted [Envoy data-plane decision](./adr/adr-073-adopt-envoy-data-plane.md) defines the target: the data plane uses upstream Envoy, configuration comes through STOA Link over xDS, and the MCP module runs behind Envoy. The ADR also lists open implementation details; acceptance of the decision is not evidence that every part has shipped.

## Planning cycles and the delivery path

Work is planned in cycles with scoped items and completion tracking. Cycle capacity is evaluated from committed work and observed velocity; the cycle tooling reads the current cycle rather than assuming fixed dates. See the repository's [cycle process][cycles]. A planning cycle is distinct from a component release: the [release workflow][release] runs on changes to `main` and creates releases only when Release Please produces them.

The [contribution process][contributing] requires a defined objective, deliverables and verifiable completion criteria. Changes proceed through a branch and pull request, applicable tests, documentation updates and review. The published [contributor guide](../community/contributing.md) describes this path. The evidence chain is:

```text
Scoped change → pull request → checks on its revision → merged commit
             → component release/tag → release notes and code comparison
```

Release automation and the component changelogs provide the last steps of this chain; cycle planning provides context, not proof that a change was released. [Sources: release workflow][release], [component changelog][api-changelog].

## Non-regression and quality gates

[ADR-031](./adr/adr-031-ci-cd-reusable-workflow-architecture.md) records the reusable CI architecture: setup actions, shared workflows and component orchestrators. For the exact current checks, read the workflow at the revision being assessed; the ADR describes the decision, while executable workflow files determine what runs.

| Evidence | Checks performed |
| --- | --- |
| [Python CI][python-ci] and [API orchestrator][api-ci] | Ruff, mypy, pytest and coverage; the API also has integration tests using PostgreSQL. |
| [Node CI][node-ci] | Lint, formatting when present, tests (with coverage when requested), and build when enabled by the caller. |
| [Rust CI][rust-ci] | Formatting, Clippy and tests; coverage and its configured threshold run on main pushes and scheduled runs. These are evidence for the component tested, not proof of Envoy migration completion. |
| [Regression Guard][regression] | Detects fix pull requests and looks for regression-test changes. The workflow contains explicit exemptions, including documentation/configuration-only fixes and an override label. |
| [CI Gate][gate] and [aggregation script][aggregate] | Detect changed components, run their workflows and aggregate their results. Change detection and security must succeed; selected components must succeed, and unselected components must be skipped. Missing or inconsistent results fail. The gate also checks image pinning. |

A green aggregate is therefore conditional on change detection and the selected workflows; it does not mean every test in the repository ran. Python type checking can be advisory through `mypy-enforce`; the Node translation-key check is also advisory. Inspect these settings and the job logs when assessing a regression. [Sources: Python CI][python-ci], [Node CI][node-ci], [aggregation script][aggregate].

For a delivery review, retain the tested commit and its check results together. Distinguish applicable builds, tests and `ci-gate` from downstream deployment or synchronization jobs: they have different scopes in the [component orchestrators][api-ci] and [CI Gate][gate].

## Semantic versions and release cadence

The published [release notes](../reference/changelog.md) document independent semantic versions for `control-plane-api`, `control-plane-ui`, `portal`, `stoa-gateway` and `stoa-go`. There is no single shared version for this set of components. The [release configuration][release-config] selects a release strategy per component, separate release pull requests and component-prefixed tags; the [manifest][manifest] stores the tracked versions.

Versions use `MAJOR.MINOR.PATCH`, with component tags shaped as `component-vMAJOR.MINOR.PATCH`. The published [versioning policy](../reference/changelog.md#versioning-policy) assigns major increments to breaking API changes, minor increments to backward-compatible features, and patch increments to fixes and security patches. Do not infer compatibility from the number alone: review breaking changes and upgrade instructions in the [release notes](../reference/changelog.md). The configuration explicitly sets `bump-minor-pre-major` and `bump-patch-for-minor-pre-major`, so pre-1.0 changes must be interpreted using those settings. [Source: release configuration][release-config].

The same configuration maps conventional commit types into release-note sections: `feat` to Features, `fix` to Bug Fixes, `perf` to Performance and `security` to Security. Documentation, maintenance, refactoring, tests and CI sections are hidden. Release notes are consequently a curated view, not a complete commit inventory. [Source: release configuration][release-config].

No calendar release frequency follows from these files: [Release Please][release] reacts to `main`, whereas planning cycles scope work. A cycle ending does not itself prove that a new component version exists.

## Published changelog and architecture decisions

The [release notes](../reference/changelog.md) expose per-component versions, dates and release links. The documentation [synchronization workflow][changelog-sync] runs on a release event, a daily schedule or manual dispatch and proposes a documentation pull request. Its [script][changelog-script] updates the generated summaries in both English and French from GitHub releases. Publication of a release and merging its documentation update are separate steps.

The [ADR index](./adr/README.md) provides the published architectural record. Read each decision's status, amendments and supersession links: [ADR-073](./adr/adr-073-adopt-envoy-data-plane.md), for example, supersedes earlier data-plane decisions and amends others. Use an ADR to explain why a change was chosen, and release/commit evidence to establish when it became available.

## Tracing changes between two versions

Use the following review procedure, based on the [component changelog][api-changelog], [release configuration][release-config] and published [release notes](../reference/changelog.md):

1. Identify the component and the two release tags. For a platform installation, record each component version separately.
2. Open the corresponding release entries and the changelog comparison link. The API changelog contains concrete tag-to-tag comparisons and commit links.
3. Follow commits and pull requests to inspect the full diff, tests and check results for the relevant revision. Include commit types hidden from release notes.
4. Read linked ADRs and migration instructions for the changed behavior; distinguish accepted design, implemented code and released artifacts.
5. Record the two tags, comparison link, relevant pull requests/commits, CI evidence and ADR links in the review. This makes the conclusion reproducible without treating a cycle status or an ADR alone as release evidence.

## Source revisions

Repository links below are pinned to the inspected revisions. For another release, inspect the same paths at that release's commit.

[cycles]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.claude/skills/fill-cycle/SKILL.md
[contributing]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/CONTRIBUTING.md
[release]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/release-please.yml
[release-config]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/release-please-config.json
[manifest]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.release-please-manifest.json
[api-changelog]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/CHANGELOG.md
[python-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-python-ci.yml
[api-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/control-plane-api-ci.yml
[node-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-node-ci.yml
[rust-ci]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/reusable-rust-ci.yml
[regression]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/regression-guard.yml
[gate]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/ci-gate.yml
[aggregate]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/scripts/ci-gate-aggregate.sh
[changelog-sync]: https://github.com/stoa-platform/stoa-docs/blob/03012e0a0e23f9660b58bd96e7da347c4325078f/.github/workflows/sync-changelog.yml
[changelog-script]: https://github.com/stoa-platform/stoa-docs/blob/03012e0a0e23f9660b58bd96e7da347c4325078f/scripts/update-changelog.sh
