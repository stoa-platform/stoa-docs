---
sidebar_position: 13
title: "Exit Strategy"
description: "STOA Platform exit strategy — data export, migration procedures, vendor independence, and reversibility guarantees."
keywords:
  - exit strategy
  - data export
  - vendor lock-in
  - migration
  - portability
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Exit Strategy

STOA Platform is designed for zero vendor lock-in. All data is exportable, all configurations are portable, and the platform uses open standards throughout.

## Principles

| Principle | Implementation |
|-----------|---------------|
| **Open standards** | OpenAPI 3.x, OAuth2/OIDC, MCP protocol, Prometheus metrics |
| **Open source** | Apache 2.0 license — fork freely |
| **Standard storage** | PostgreSQL (no proprietary extensions) |
| **Standard identity** | Keycloak (standard OIDC provider) |
| **Portable configs** | Helm charts, Kubernetes manifests, CRDs |
| **No proprietary formats** | API specs in OpenAPI, policies in standard JSON |

## Data Export Procedures

### API Specifications

All API specifications are stored as standard OpenAPI documents:

<EnvSetup />

```bash
# Export all APIs as OpenAPI specs
for api_id in $(curl -s "${STOA_API_URL}/v1/apis" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[].id'); do
  curl -s "${STOA_API_URL}/v1/apis/$api_id" \
    -H "Authorization: Bearer $TOKEN" \
    | jq '.spec' > "api-${api_id}.json"
done
```

### Subscriptions and Consumers

```bash
# Export subscriptions
curl -s "${STOA_API_URL}/v1/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.' > subscriptions-export.json

# Export consumers
curl -s "${STOA_API_URL}/v1/consumers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.' > consumers-export.json
```

### Database Full Export

```bash
# PostgreSQL dump (all STOA data)
kubectl exec -n stoa-system deploy/postgres -- \
  pg_dump -U stoa -d stoa --format=custom --compress=9 \
  > stoa-full-export.dump

# Verify export
pg_restore --list stoa-full-export.dump | head -20
```

### Keycloak Realm

```bash
# Export realm with users
kubectl exec -n stoa-system deploy/keycloak -- \
  /opt/keycloak/bin/kc.sh export \
  --dir /tmp/export \
  --realm stoa \
  --users realm_file

kubectl cp stoa-system/keycloak-0:/tmp/export/ ./keycloak-export/
```

### Custom Resource Definitions

```bash
# Export all STOA CRDs
for crd in tools toolsets gatewayinstances gatewaybindings; do
  kubectl get ${crd}.gostoa.dev -A -o yaml > ${crd}-export.yaml
done
```

### Grafana Dashboards

```bash
# Export dashboards via API
for uid in $(curl -s "${GRAFANA_URL}/api/search?type=dash-db" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" | jq -r '.[].uid'); do
  curl -s "${GRAFANA_URL}/api/dashboards/uid/$uid" \
    -H "Authorization: Bearer $GRAFANA_TOKEN" \
    | jq '.dashboard' > "dashboard-${uid}.json"
done
```

## Migration to Another Platform

### To Kong

1. Export API specs from STOA (OpenAPI format)
2. Import into Kong using `deck sync` with the exported specs
3. Recreate consumers and API keys via Kong Admin API
4. Update DNS to point to Kong gateway

### To Gravitee

1. Export API specs from STOA
2. Import via Gravitee Management API (`POST /apis/import/swagger`)
3. Recreate plans and subscriptions
4. Update DNS

### To AWS API Gateway

1. Export OpenAPI specs
2. Import via AWS Console or CLI (`aws apigateway import-rest-api`)
3. Recreate usage plans and API keys
4. Update DNS to API Gateway endpoint

### General Migration Checklist

- [ ] Export all API specifications (OpenAPI)
- [ ] Export subscriptions and consumer data
- [ ] Export Keycloak realm (users + clients)
- [ ] Export CRD instances
- [ ] Export Grafana dashboards
- [ ] Full PostgreSQL dump as backup
- [ ] Import into target platform
- [ ] Verify API routing works
- [ ] Update DNS records
- [ ] Decommission STOA components

## What Stays Standard

| Component | Standard | Portable To |
|-----------|----------|-------------|
| API specs | OpenAPI 3.x | Any API gateway |
| Auth | OAuth2 / OIDC | Any OIDC provider |
| Users | Keycloak export | Any Keycloak instance, or LDAP |
| Metrics | Prometheus | Any Prometheus-compatible system |
| Logs | JSON structured | Any log aggregator |
| K8s resources | Standard manifests | Any Kubernetes cluster |
| Database | PostgreSQL | Any PostgreSQL instance |

## What Is STOA-Specific

| Component | Portability |
|-----------|------------|
| STOA CRDs (Tool, ToolSet) | Export as YAML, re-create manually |
| Gateway adapter config | Stored in PostgreSQL, exportable as JSON |
| Webhook configurations | Exportable via API, re-create in target |
| Audit trail (OpenSearch) | Standard OpenSearch indices, exportable |
| MCP tool definitions | Export as JSON, adapt to target format |

## Related

- [Backup & Recovery](/docs/admin/backup-recovery) -- Backup procedures
- [Installation Guide](/docs/admin/installation) -- Deployment reference
- [Configuration Reference](/docs/reference/configuration) -- Environment variables
