# Contributing to STOA Platform

Thank you for your interest in contributing to STOA!

## Our Standards

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Governance

For information about project roles, decision-making, and how to become a maintainer,
see our [Governance document](GOVERNANCE.md).

## Creating Issues

We follow the **Marchemalo Standard** for issue quality.

### The 30-Second Test

> *"Would a senior architect with 40 years of experience understand this issue in 30 seconds and know exactly what to deliver?"*

If not, rewrite it.

### Required Elements

Every issue MUST have:

| Element | Question | Example |
|---------|----------|---------|
| **Objective** | What are we delivering? | "Add CODE_OF_CONDUCT.md with Contributor Covenant 2.1" |
| **Why Now** | Why is this important? | "Community launch requires clear behavioral guidelines" |
| **Deliverables** | What files/changes? | "CODE_OF_CONDUCT.md, README.md update, CONTRIBUTING.md update" |
| **Definition of Done** | How do we know it's complete? | "File exists, email configured, links added, CI passes" |
| **Estimate** | How long? | "~30min" or "2 points" |

### Anti-Patterns

| ❌ Bad | ✅ Good |
|--------|---------|
| "Improve the docs" | "Add 3 architecture diagrams to /docs/architecture/" |
| "Fix the bug" | "POST /v1/users returns 500 when email=null → return 400 with validation message" |
| "Documentation" | "Create ADR-005 for multi-tenant isolation decision" |
| No DoD | "Done when: tests pass + docs updated + review approved" |

### Real Examples

**CAB-851 — CODE_OF_CONDUCT** (Good ✅)
- Objective: Add Contributor Covenant 2.1
- Why: First step for open-source community readiness
- DoD: File exists, email=conduct@gostoa.dev, links in README+CONTRIBUTING
- Estimate: ~30min

**CAB-852 — GOVERNANCE** (Good ✅)
- Objective: Document BDFL governance model
- Why: Contributors need to know who decides what
- DoD: GOVERNANCE.md with roles, decision process, maintainer path
- Estimate: ~1h

## Submitting Pull Requests

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
docs: add Contributor Covenant 2.1 Code of Conduct (CAB-851)
docs: add BDFL governance model (CAB-852)
feat(gateway): add rate limiting per tenant
fix(auth): handle null email in JWT validation
```

### PR Checklist

Before submitting:

- [ ] Issue linked (closes #XXX or refs CAB-XXX)
- [ ] Commit messages follow convention
- [ ] Tests pass locally
- [ ] Documentation updated (if applicable)
- [ ] Self-review completed

## How to Contribute

See the [Contributing Documentation](README.md#-contributing-documentation) section in our README.
