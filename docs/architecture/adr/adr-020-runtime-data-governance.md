---
sidebar_position: 20
title: "ADR-020: Runtime Data Governance"
description: "Decides between Control Plane database and Git repositories for managing API metadata, choosing runtime-first with Git sync."
keywords: [data governance, Control Plane, Git, API metadata, runtime, synchronization]
---

# ADR-020: Runtime Data Governance — Control Plane vs Git

| Status | Accepted |
|--------|----------|
| **Date** | 2026-01-23 |
| **Decision Makers** | Christophe ABOULICAM |
| **Related Tickets** | CAB-850, CAB-849, CAB-848 |

## Context

STOA Platform uses GitOps for infrastructure and configuration management. However, a critical question arises: **where should API runtime metadata live?**

### Current State (Anti-Pattern)
Developer modifies category in stoa-catalog/*.yaml
→ Git push
→ GitLab CI
→ Deployment
→ Runtime updated

### Problems Identified

| Issue | Impact |
|-------|--------|
| No business validation | Invalid categories accepted |
| No audit log | Who changed what, when, why? |
| No RBAC | Anyone with Git access can modify |
| No approval workflow | Changes go live without review |
| No stakeholder notification | API owners not informed |
| Complex rollback | Git revert vs API call |

## Decision

**Split data governance by type:**

| Data Type | Source of Truth | Modification Method |
|-----------|-----------------|---------------------|
| **OpenAPI Spec** | Git (stoa-catalog) | PR + Code Review |
| **Infrastructure Config** | Git (stoa-gitops) | PR + Code Review |
| **Runtime Metadata** | PostgreSQL | Control Plane API |

### What is Runtime Metadata?

Data that changes **independently of the API contract**:

- `category` / `tags` — Classification
- `visibility` — Community, AD groups
- `status` — draft, published, deprecated
- `owner` / `team` — Ownership assignment
- `sla` / `rate_limits` — Custom policies

### What Stays in Git?

Data that defines the **API contract**:

- OpenAPI specification (endpoints, schemas)
- API name and base description
- Version (major.minor.patch)
- Protocol bindings (REST, GraphQL, gRPC)

## Architecture

### Data Model
```sql
-- Runtime metadata (editable via Control Plane)
CREATE TABLE api_metadata (
  api_id UUID PRIMARY KEY REFERENCES apis(id),
  category VARCHAR(100),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'draft',
  visibility JSONB,  -- {community_ids: [], ad_groups: []}
  owner_team_id UUID REFERENCES teams(id),
  custom_rate_limit INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Automatic audit log
CREATE TABLE api_metadata_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);
```

### API Endpoints

```
GET    /v1/apis/{api_id}/metadata       — Read metadata
PATCH  /v1/apis/{api_id}/metadata       — Update metadata (RBAC enforced)
GET    /v1/apis/{api_id}/metadata/audit — View change history
```

### Bootstrap Sync (Git → DB)
```python
async def sync_catalog_to_db():
    """
    Import initial metadata from Git.
    Does NOT overwrite if already present in DB.
    """
    for api_yaml in git_catalog.list_apis():
        if not await db.api_metadata_exists(api_yaml.id):
            await db.create_api_metadata(api_yaml)
        # else: DB is source of truth, Git ignored for metadata
```

## Consequences

### Positive

- **Audit trail** — Complete history of who changed what
- **RBAC** — Only authorized users can modify metadata
- **Validation** — Business rules enforced at API level
- **Notifications** — Stakeholders informed of changes
- **Simple rollback** — API call vs git revert

### Negative

- **Two sources** — Spec in Git, metadata in DB
- **Sync complexity** — Bootstrap logic needed
- **Migration** — Existing YAML metadata must migrate to DB

### Neutral

- **Console UI required** — Need UI for non-technical users
- **API versioning** — Metadata API needs versioning strategy

## Implementation

See [CAB-850](https://linear.app/hlfh-workspace/issue/CAB-850) for implementation details.

### Phases

1. **Phase 1** — Data model + Alembic migration
2. **Phase 2** — API endpoints + RBAC
3. **Phase 3** — Console UI
4. **Phase 4** — Sync + migration script

## References

- [Kong Declarative vs DB Mode](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
- [GitOps Principles](https://opengitops.dev/)
- Discussion: Claude Chat 2026-01-23
