---
sidebar_position: 18
title: "Webhooks"
description: "Configure tenant webhooks in STOA Platform — subscription event notifications, HMAC-SHA256 signatures, delivery tracking, and retry policies."
keywords:
  - webhooks
  - event notifications
  - HMAC signatures
  - subscription events
  - delivery tracking
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Webhooks

STOA Platform can notify external systems when subscription lifecycle events occur. Webhooks deliver HTTP POST requests to your endpoints with signed payloads.

## Event Types

| Event | Trigger | Payload Includes |
|-------|---------|-----------------|
| `subscription.created` | New subscription request | Subscription ID, API, consumer, plan |
| `subscription.approved` | Subscription approved by admin | Subscription ID, API key (if generated) |
| `subscription.revoked` | Subscription revoked | Subscription ID, reason |
| `subscription.key_rotated` | API key rotated | Subscription ID, new key prefix |
| `subscription.expired` | Subscription TTL expired | Subscription ID, expiry date |

Use `["*"]` to subscribe to all event types.

## Creating a Webhook

### Via API

<EnvSetup />

```bash
curl -X POST "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-system.example.com/stoa-events",
    "events": ["subscription.created", "subscription.approved"],
    "secret": "your-hmac-secret-min-32-chars-long",
    "enabled": true,
    "custom_headers": {
      "X-Source": "stoa-platform"
    }
  }'
```

### Via Portal

1. Navigate to **Webhooks** in the Portal sidebar
2. Click **Create Webhook**
3. Enter the target URL and select event types
4. Set a signing secret (min 32 characters)
5. Optionally add custom headers
6. Click **Save**

## Payload Format

Every webhook delivery sends a JSON payload:

```json
{
  "event": "subscription.approved",
  "timestamp": "2026-02-13T10:30:00Z",
  "webhook_id": "wh_abc123",
  "data": {
    "subscription_id": "sub_xyz789",
    "api_id": "api_456",
    "api_name": "Payment API",
    "consumer_id": "consumer_012",
    "plan": "standard",
    "status": "approved"
  }
}
```

## HMAC-SHA256 Signature Verification

Every delivery includes a signature header for payload verification:

```
X-STOA-Signature: sha256=<hex-encoded-hmac>
```

### Verification Example (Python)

```python
import hmac
import hashlib

def verify_signature(payload: bytes, secret: str, signature_header: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
```

### Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function verifySignature(payload, secret, signatureHeader) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received)
  );
}
```

Always use timing-safe comparison to prevent timing attacks.

## Retry Policy

Failed deliveries (non-2xx response or timeout) are retried with exponential backoff:

| Attempt | Delay | Cumulative Wait |
|---------|-------|-----------------|
| 1 | Immediate | 0 |
| 2 | 1 minute | 1 min |
| 3 | 5 minutes | 6 min |
| 4 | 15 minutes | 21 min |
| 5 | 1 hour | 1h 21min |

After 5 failed attempts, the delivery is marked as `failed`. No further retries are attempted automatically.

## Delivery Tracking

### View Delivery History

```bash
curl "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/deliveries" \
  -H "Authorization: Bearer $TOKEN"
```

Each delivery record includes:

| Field | Description |
|-------|-------------|
| `status` | `success`, `failed`, `pending` |
| `status_code` | HTTP response code from your endpoint |
| `response_body` | First 1KB of response (for debugging) |
| `attempt` | Attempt number (1-5) |
| `created_at` | Delivery timestamp |

### Retry a Failed Delivery

```bash
curl -X POST "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/deliveries/{delivery_id}/retry" \
  -H "Authorization: Bearer $TOKEN"
```

## Testing Webhooks

Send a test event to verify your endpoint before going live:

```bash
curl -X POST "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "subscription.created"}'
```

The test delivery uses synthetic data and is marked as `test: true` in the payload.

## Managing Webhooks

### List Webhooks

```bash
curl "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks" \
  -H "Authorization: Bearer $TOKEN"
```

### Disable a Webhook

```bash
curl -X PATCH "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Delete a Webhook

```bash
curl -X DELETE "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}" \
  -H "Authorization: Bearer $TOKEN"
```

## Best Practices

1. **Always verify signatures** — reject unsigned or incorrectly signed payloads
2. **Respond quickly** — return 200 within 5 seconds; process asynchronously
3. **Handle duplicates** — use `webhook_id` + `timestamp` for idempotency
4. **Use HTTPS** — webhook URLs must use TLS in production
5. **Rotate secrets** — update the webhook secret periodically via PATCH
6. **Monitor deliveries** — check the Portal delivery history for failures

## Related

- [Subscriptions Lifecycle](/docs/guides/subscriptions-lifecycle) -- Subscription events
- [Consumer Onboarding](/docs/guides/consumer-onboarding) -- API key management
- [Developer Portal](/docs/guides/portal) -- Portal webhook UI
