---
sidebar_position: 13
title: "API Key Rotation: Zero-Downtime Key Management"
description: "Rotate API keys with zero downtime using STOA's grace period mechanism — step-by-step guide, gateway caching, and monitoring."
keywords:
  - API key rotation
  - key management
  - grace period
  - zero downtime
  - API security
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# API Key Rotation

Rotate API keys with zero downtime using STOA's grace period mechanism — both old and new keys work during the transition window.

## How It Works

When you rotate a key, STOA doesn't immediately invalidate the old one. Instead, it creates a **grace period** where both keys are valid:

```mermaid
gantt
    title Key Rotation Timeline
    dateFormat HH:mm
    axisFormat %H:%M
    section Old Key
    Valid           :done, 00:00, 12:00
    Grace Period    :active, 12:00, 36:00
    Expired         :crit, 36:00, 48:00
    section New Key
    Valid           :done, 12:00, 48:00
```

| Phase | Old Key | New Key | Duration |
|-------|---------|---------|----------|
| Before rotation | Valid | N/A | — |
| Grace period | Valid | Valid | 1-168 hours (default: 24h) |
| After grace period | Invalid | Valid | Permanent |

## Step-by-Step Rotation

<EnvSetup />

### 1. Rotate the Key

```bash
curl -X POST "${STOA_API_URL}/v1/subscriptions/${SUB_ID}/rotate-key" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "grace_period_hours": 24
  }'
```

**Response:**

```json
{
  "subscription_id": "sub-uuid-123",
  "new_api_key": "stoa_sk_e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2",
  "new_api_key_prefix": "stoa_sk_e7f8",
  "old_key_expires_at": "2026-02-14T10:00:00Z",
  "grace_period_hours": 24,
  "rotation_count": 3
}
```

:::warning Save the New Key
The `new_api_key` is shown only once. Store it securely before proceeding.
:::

### 2. Update Your Applications

Deploy the new key to your applications. During the grace period, both keys work:

```bash
# Old key — still works during grace period
curl "${STOA_GATEWAY_URL}/apis/acme/billing/v1/invoices" \
  -H "X-API-Key: stoa_sk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

# New key — works immediately
curl "${STOA_GATEWAY_URL}/apis/acme/billing/v1/invoices" \
  -H "X-API-Key: stoa_sk_e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2"
```

### 3. Verify the Rotation

Check the rotation status:

```bash
curl "${STOA_API_URL}/v1/subscriptions/${SUB_ID}/rotation-info" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**

```json
{
  "subscription_id": "sub-uuid-123",
  "api_key_prefix": "stoa_sk_e7f8",
  "has_previous_key": true,
  "previous_key_expires_at": "2026-02-14T10:00:00Z",
  "rotation_count": 3,
  "last_rotated_at": "2026-02-13T10:00:00Z"
}
```

### 4. Wait for Grace Period to Expire

After the grace period expires, the old key is automatically invalidated. No action needed.

## Grace Period Guidelines

| Scenario | Recommended Grace Period |
|----------|------------------------|
| Single application, quick deploy | 1-4 hours |
| Multiple services, rolling deploy | 12-24 hours |
| Partner integrations, external consumers | 48-72 hours |
| Compliance rotation (scheduled) | 24 hours |
| Emergency rotation (key compromised) | 1 hour |

:::tip Emergency Rotation
If a key is compromised, use a 1-hour grace period. This gives your team just enough time to deploy the new key while minimizing the exposure window.
:::

## Gateway Caching

The gateway caches API key validation results to reduce latency:

| Setting | Value |
|---------|-------|
| Cache TTL | 5 minutes |
| Max entries | 10,000 |
| Invalidation | Automatic on rotation |

When you rotate a key:
1. The Control Plane notifies the gateway
2. The gateway invalidates the cache entry for the old key
3. The next request re-validates against the Control Plane
4. The new validation result is cached

**Worst case**: A rotated key may still be cached for up to 5 minutes after the grace period expires. For immediate invalidation, the admin can clear the gateway cache:

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/cache/clear" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

## Rotation via Console

1. Navigate to **Subscriptions** in the Console
2. Find the subscription to rotate
3. Click the **Rotate Key** button
4. Set the grace period (default: 24 hours)
5. Copy the new key from the confirmation dialog

## Monitoring Rotations

Track rotation health via the subscription's `rotation_count` and `last_rotated_at` fields:

```bash
# List all subscriptions with rotation info
curl "${STOA_API_URL}/v1/subscriptions/tenant/${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" | \
  jq '.subscriptions[] | {api_key_prefix, rotation_count, last_rotated_at}'
```

### Rotation Best Practices

- **Rotate regularly** — Every 90 days for production keys
- **Automate rotation** — Use CI/CD pipelines or scheduled scripts
- **Monitor rotation count** — Unusual spikes may indicate issues
- **Test with grace period** — Always use a grace period in production
- **Audit trail** — Every rotation is logged with timestamp and user

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Old key rejected during grace period | Grace period expired | Check `old_key_expires_at` timestamp |
| New key returns 401 | Subscription not active | Verify subscription status is `active` |
| Both keys rejected | Subscription suspended/revoked | Check subscription status |
| Key rotation returns 404 | Wrong subscription ID | Verify the subscription exists |

## Related

- [Subscription Lifecycle](/docs/guides/subscriptions-lifecycle) — Subscription states and transitions
- [Quota Enforcement](/docs/reference/quotas) — Rate limits and quotas
- [Gateway Admin API](/docs/api/gateway-admin-api) — Cache management endpoints
- [Security Configuration](/docs/reference/security-configuration) — Security best practices
