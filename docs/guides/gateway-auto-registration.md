---
sidebar_label: Gateway Auto-Registration
title: "Gateway Auto-Registration"
description: "Configure STOA gateways to automatically register with the Control Plane at startup — zero manual configuration."
keywords: [gateway, auto-registration, control plane, deployment, ADR-036]
---

# Gateway Auto-Registration Guide

This guide explains how to configure and deploy STOA gateways with automatic registration to the Control Plane.

:::info ADR Reference
This feature is defined in [ADR-036: Gateway Auto-Registration](../architecture/adr/adr-036-gateway-auto-registration.md).
:::

## Overview

STOA gateways can automatically register with the Control Plane at startup, eliminating the need for manual registration via API calls. This provides an "Apple ecosystem" experience where gateways appear in the Console UI within seconds of deployment.

**Key benefits:**
- Zero-config deployment (2 environment variables)
- Automatic re-registration on restart
- Real-time health visibility via heartbeat
- Self-healing (gateway recovery is automatic)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Control Plane API                            │
│                                                                 │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Gateway Internal   │    │   Gateway Health Worker        │  │
│  │  /v1/internal/gateways   │   Marks stale gateways OFFLINE │  │
│  │  - /register        │    │   (90s timeout)                │  │
│  │  - /{id}/heartbeat  │    └────────────────────────────────┘  │
│  │  - /{id}/config     │                                        │
│  └─────────┬───────────┘                                        │
└────────────┼────────────────────────────────────────────────────┘
             │
             │ HTTPS (X-Gateway-Key header)
             │
    ┌────────┴────────┐              ┌────────────────┐
    │  STOA Gateway   │              │ STOA Sidecar   │
    │  (edge-mcp)     │              │ + Kong         │
    │                 │              │                │
    │  1. Register    │              │  ext_authz     │
    │  2. Heartbeat   │              │  ↓             │
    │     (30s)       │              │  Policy/Meter  │
    └─────────────────┘              └────────────────┘
```

## Quick Start

### Tier 1: STOA Native Gateway

Deploy a STOA gateway with automatic registration:

```bash
# Minimal registration configuration (not a complete Ready deployment)
export STOA_CONTROL_PLANE_URL="https://api.<YOUR_DOMAIN>"
export STOA_CONTROL_PLANE_API_KEY="<GATEWAY_API_KEY>"

# Start the gateway
./stoa-gateway
```

:::warning Registration is not readiness
The two variables above configure registration only. `STOA_POLICY_BOOT_TENANTS` defaults to an empty list, so this example leaves `/ready` returning HTTP 503 even if registration succeeds. Before starting a gateway that must become Ready, also set `STOA_POLICY_BOOT_TENANTS="<TENANT_ID>"` (comma-separated for multiple existing tenants) and configure policy-loading dependencies: reachable Control Plane and Keycloak services, a Keycloak service client using `private_key_jwt` with a mounted signing key, and authorization to read the tenants' tool permissions. The registration API key or a Keycloak client secret alone cannot authenticate these policy reads. A complete, fresh tool policy must load, and a configured policy trust set must load successfully. See [Startup Policy and Readiness](../admin/installation.md#startup-policy-and-readiness) for the Helm `extraEnv` setting and signing-key configuration. All other readiness checks must also pass.
:::

The gateway will:
1. Derive identity from hostname + mode + environment
2. Call `POST /v1/internal/gateways/register`
3. Start heartbeat loop (every 30 seconds)
4. Appear in Console UI at `/gateways`

### Tier 2: Sidecar mode

A same-pod companion is a second container that answers `POST /authz`. Registration uses the same Control Plane variables as any other STOA process. The repository does not ship a Kong, Envoy, or webMethods plugin, and `KONG_PLUGINS` / `KONG_EXT_AUTHZ_URL` are not a demonstrated Kong configuration. The host must send the JSON body in [Companion usage](./companion-usage.md).

```yaml
# Illustrative co-location only. The host container must call
# POST http://127.0.0.1:8081/authz itself. Pin the image digest
# your release uses; do not rely on a floating tag.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: host-with-stoa-sidecar
spec:
  selector:
    matchLabels:
      app: host-with-stoa-sidecar
  template:
    metadata:
      labels:
        app: host-with-stoa-sidecar
    spec:
      containers:
        - name: gateway
          image: <your-gateway-image>
        - name: stoa-sidecar
          image: ghcr.io/stoa-platform/stoa-gateway
          env:
            - name: STOA_GATEWAY_MODE
              value: "sidecar"
            - name: STOA_PORT
              value: "8081"
            - name: STOA_CONTROL_PLANE_URL
              value: "https://api.<YOUR_DOMAIN>"
            - name: STOA_CONTROL_PLANE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: stoa-sidecar-secrets
                  key: STOA_CONTROL_PLANE_API_KEY
          ports:
            - containerPort: 8081
```

`/authz` trusts the JSON `user` and does not validate a token. The process binds `0.0.0.0` and `STOA_PORT`. Putting the containers in one pod does not, by itself, prove the host calls localhost. See [Companion usage](./companion-usage.md). GitOps sync to the gateway admin API is [stoa-connect](./stoa-connect-quickstart.md).

## Control Plane Configuration

### 1. Create Gateway API Keys

Configure the Control Plane to accept gateway registrations:

```bash
# Create Kubernetes secret with API keys
kubectl create secret generic stoa-gateway-api-keys \
  --namespace stoa-system \
  --from-literal=GATEWAY_API_KEYS="<GATEWAY_API_KEY>,<SECOND_GATEWAY_API_KEY>"
```

**Key format**: Any string, but we recommend the format `gw_{environment}_{random}`.

**Key rotation**: Multiple keys are supported (comma-separated). Add a new key before removing the old one.

### 2. Deploy Control Plane with Keys

Patch the Control Plane deployment:

```bash
kubectl patch deployment stoa-control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'
```

The `stoa-platform` chart does not deploy the Control Plane API or expose a `controlPlane.env` setting. Configure `GATEWAY_API_KEYS` in your existing Control Plane deployment.

## Gateway Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STOA_CONTROL_PLANE_URL` | Yes | - | Control Plane API URL |
| `STOA_CONTROL_PLANE_API_KEY` | Yes | - | Shared secret for authentication |
| `STOA_GATEWAY_MODE` | No | `edge-mcp` | Gateway mode: `edge-mcp`, `sidecar`, `proxy`, `shadow` |
| `STOA_ENVIRONMENT` | No | `dev` | Environment identifier for grouping |

The chart comment also lists `connect`, but the Rust runtime does not accept it for `STOA_GATEWAY_MODE`. Use `edge-mcp`, `sidecar`, `proxy`, or `shadow` for `stoaGateway.mode`.

The Rust gateway registers with `tenant_id: null` (platform-wide); `STOA_TENANT_ID` is not a supported runtime setting and does not provide tenant isolation.

### Registration Payload

The gateway sends this payload at startup:

```json
{
  "hostname": "<GATEWAY_HOSTNAME>",
  "mode": "edge-mcp",
  "version": "0.1.0",
  "environment": "prod",
  "capabilities": ["rest", "mcp", "sse", "oidc", "rate_limiting"],
  "admin_url": "http://<GATEWAY_HOSTNAME>:8080",
  "tenant_id": null
}
```

### Heartbeat Payload

Every 30 seconds:

```json
{
  "uptime_seconds": 3600,
  "routes_count": 15,
  "policies_count": 5,
  "requests_total": 10000,
  "error_rate": 0.01
}
```

## Identity Derivation

Gateway identity is deterministic: `{hostname}-{mode_normalized}-{environment}`

Mode normalization removes underscores only; the hyphen in `edge-mcp` is preserved.

| Hostname | Mode | Environment | Derived Name |
|----------|------|-------------|--------------|
| `stoa-gw-abc123` | `edge-mcp` | `prod` | `stoa-gw-abc123-edge-mcp-prod` |
| `kong-sidecar-xyz` | `sidecar` | `staging` | `kong-sidecar-xyz-sidecar-staging` |

This enables:
- **Idempotent registration**: Same gateway restarts update rather than duplicate
- **Clear naming**: Easy to identify in Console UI
- **Environment filtering**: Group gateways by environment

## Helm Chart Configuration

### STOA Gateway (Tier 1)

Set `stoaGateway.secretName` to an existing Kubernetes Secret. To populate it from Vault instead, enable the optional ExternalSecret as shown below; this requires External Secrets Operator and an existing `ClusterSecretStore` named `vault-backend`:

```yaml
# values.yaml
stoaGateway:
  enabled: true
  replicas: 2

  # Control Plane connection
  controlPlaneUrl: "http://stoa-control-plane-api.stoa-system.svc.cluster.local:80"

  # Secret keys: STOA_CONTROL_PLANE_API_KEY, STOA_KEYCLOAK_CLIENT_SECRET
  # STOA_CONTROL_PLANE_API_KEY is required for auto-registration.
  # Without it, the gateway skips registration and runs in standalone mode.
  secretName: stoa-gateway-secrets

  # ExternalSecret (Vault-backed) — syncs secrets from Vault into K8s Secret
  externalSecret:
    enabled: true
    refreshInterval: 1h
    secretStoreRef: vault-backend
    vaultPath: "<VAULT_GATEWAY_PATH>"  # Must contain both STOA_* properties listed above
```

The deployment template injects the secret as an environment variable:

```yaml
- name: STOA_CONTROL_PLANE_API_KEY
  valueFrom:
    secretKeyRef:
      name: stoa-gateway-secrets
      key: STOA_CONTROL_PLANE_API_KEY
      optional: true  # Gateway runs standalone if missing
```

:::caution Required Vault Key
Replace `<VAULT_GATEWAY_PATH>` with a Vault path containing `STOA_CONTROL_PLANE_API_KEY` and `STOA_KEYCLOAK_CLIENT_SECRET`. The ExternalSecret uses those exact names for both Vault properties and Kubernetes Secret keys. Missing properties prevent successful secret synchronization; without `STOA_CONTROL_PLANE_API_KEY`, the gateway skips auto-registration.
:::

### STOA sidecar (Tier 2)

The platform chart renders the same-pod pod only when both flags below are true. `stoaSidecar.enabled` defaults to `false`. The chart appends `EXT_AUTHZ_URL=http://localhost:8081/authz` on the target container. It reads secret key `STOA_CONTROL_PLANE_API_KEY` (`optional: true`). `stoaSidecar.image` is `ghcr.io/stoa-platform/stoa-gateway` pinned by digest in `values.yaml`, which is the published gateway image. The unpublished light build profile is not what the chart runs.

```yaml
stoaSidecar:
  enabled: true
  mainGateway:
    enabled: true
    image:
      repository: "<your-gateway-repository>"
      digest: "<your-gateway-digest>"
```

The chart also injects Keycloak variables and `policyEnabled`. `POST /authz` does not validate tokens and does not evaluate Control Plane or OPA policies. Supply the target image yourself. This documentation does not name a webMethods image. Details and limits: [Companion usage](./companion-usage.md) and [webMethods and the companion](./migration/webmethods-sidecar.md).

## Console UI

After registration, gateways appear at **Console > Gateways** with automatic 30-second polling (via TanStack React Query). No manual refresh needed.

| Column | Description |
|--------|-------------|
| Name | Derived instance name |
| Type | `stoa`, `stoa_sidecar`, `webmethods`, etc. |
| Status | `ONLINE`, `OFFLINE`, `DEGRADED` |
| Environment | `dev`, `staging`, `prod` |
| Live Indicator | Pulsing green dot if heartbeat received within 90s |
| Capabilities | Feature badges |

### Status Indicators

| Status | Meaning | Visual |
|--------|---------|--------|
| ONLINE | Heartbeat received within 90s | Pulsing green dot |
| OFFLINE | No heartbeat for > 90s | Gray dot |
| DEGRADED | Instance status reported as degraded by the Control Plane | Yellow status badge |

### Gateway Detail Panel

Click a gateway card to open the detail panel showing heartbeat metrics:

| Metric | Source | Example |
|--------|--------|---------|
| Uptime | `health_details.uptime_seconds` | `1h 30m` |
| Routes | `health_details.routes_count` | `15` |
| Policies | `health_details.policies_count` | `5` |
| Requests | `health_details.requests_total` | `10,000` |
| Error Rate | `health_details.error_rate` | `2.0%` |
| Registered At | `health_details.registered_at` | `2026-02-06` |

Each accepted heartbeat sets the instance status to `ONLINE`. An error rate above 5% highlights the Error Rate metric in the detail panel; it does not set the instance status to `DEGRADED`.

## Deep Readiness Probe

The gateway's `/ready` endpoint checks required policy state, Control Plane connectivity when configured, and OIDC provider reachability when authentication is enabled before reporting readiness.

If a check fails, the endpoint returns `503 SERVICE UNAVAILABLE` with a descriptive message:
- `NOT READY: Control Plane unreachable`
- `NOT READY: OIDC provider unreachable`

This prevents Kubernetes from routing traffic to gateways that cannot enforce policies or validate tokens.

## Config Fetch

The Control Plane exposes a configuration endpoint for registered gateways:

```
GET /v1/internal/gateways/{id}/config
Header: X-Gateway-Key: <GATEWAY_API_KEY>
```

The response includes:
- **pending_deployments** — API deployments targeted at this gateway
- **pending_policies** — Rate limiting, access control, and governance policies

The Rust gateway registration lifecycle registers the instance and sends heartbeats. It does not automatically poll this endpoint or apply its pending deployments and policies.

## Troubleshooting

### Gateway Not Appearing in Console

1. **Check gateway logs for registration errors:**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-gateway | grep -i register
   ```

2. **Verify Control Plane has API keys configured:**
   ```bash
   kubectl describe secret stoa-gateway-api-keys -n stoa-system
   ```

3. **Check Control Plane logs:**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-control-plane-api | grep -i gateway
   ```

4. **Test registration endpoint manually:**
   ```bash
   curl -X POST "${STOA_CONTROL_PLANE_URL}/v1/internal/gateways/register" \
     -H "X-Gateway-Key: <GATEWAY_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{
       "hostname": "<GATEWAY_HOSTNAME>",
       "mode": "edge-mcp",
       "version": "0.1.0",
       "environment": "dev",
       "capabilities": ["rest"],
       "admin_url": "http://<GATEWAY_HOSTNAME>:8080"
     }'
   ```

### Gateway Shows OFFLINE

1. **Check heartbeat is being sent:**
   ```bash
   kubectl logs -n stoa-system deployment/stoa-gateway | grep heartbeat
   ```

2. **Verify network connectivity to Control Plane:**
   ```bash
   kubectl exec -n stoa-system deployment/stoa-gateway -- \
     curl --fail --silent --show-error http://stoa-control-plane-api.stoa-system.svc.cluster.local:80/health/live
   ```

### Registration Returns 503

**Cause**: `GATEWAY_API_KEYS` not configured in Control Plane.

**Fix**:
```bash
kubectl create secret generic stoa-gateway-api-keys \
  --namespace stoa-system \
  --from-literal=GATEWAY_API_KEYS="<GATEWAY_API_KEY>"

kubectl patch deployment stoa-control-plane-api -n stoa-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "GATEWAY_API_KEYS", "valueFrom": {"secretKeyRef": {"name": "stoa-gateway-api-keys", "key": "GATEWAY_API_KEYS"}}}}]'

kubectl rollout status deployment/stoa-control-plane-api -n stoa-system
```

### Registration Returns 401

**Cause**: Gateway API key doesn't match any key in `GATEWAY_API_KEYS`.

**Fix**: Check that the Secret contains `GATEWAY_API_KEYS`, then compare its value with the gateway credential through your secret manager without printing either value:
```bash
kubectl describe secret stoa-gateway-api-keys -n stoa-system
```

## Security Considerations

### API Key Management

- **Never commit keys to Git**: Use Kubernetes Secrets or external secrets manager
- **Use environment-specific keys**: Different keys for dev, staging, prod
- **Rotate keys periodically**: Add new key → update gateways → remove old key
- **Audit registrations**: Check Control Plane logs for unexpected registrations

### Network Security

- Internal endpoints (`/v1/internal/*`) should NOT be exposed via public ingress
- Use Kubernetes NetworkPolicies to restrict which pods can call the internal API
- Consider mTLS for high-security deployments (future enhancement)

### Key Rotation Procedure

1. Add new key to Control Plane (comma-separated)
2. Restart Control Plane to pick up new key
3. Update gateways to use new key
4. Remove old key after all gateways updated

## Related Documentation

- [ADR-036: Gateway Auto-Registration](../architecture/adr/adr-036-gateway-auto-registration.md) — Architecture decision record
- [ADR-024: Unified Gateway Architecture](../architecture/adr/adr-024-gateway-unified-modes.md) — Gateway modes
- [ADR-035: Gateway Adapter Pattern](../architecture/adr/adr-035-gateway-adapter-pattern.md) — How CP orchestrates gateways
- [Companion usage](./companion-usage.md) — Allow/deny companion, application callout, and mesh limits
- [webMethods and the companion](./migration/webmethods-sidecar.md) — Why a live webMethods sidecar is not demonstrated
