---
sidebar_position: 18
title: "Webhooks"
description: "Configurez les webhooks tenant dans STOA Platform — notifications d'événements d'abonnement, signatures HMAC-SHA256, suivi des livraisons et politiques de nouvelle tentative."
keywords:
  - webhooks
  - event notifications
  - HMAC signatures
  - subscription events
  - delivery tracking
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Webhooks

STOA Platform peut notifier des systèmes externes lorsque des événements du cycle de vie des abonnements se produisent. Les webhooks délivrent des requêtes HTTP POST à vos endpoints avec des payloads signés.

## Types d'Événements

| Événement | Déclencheur | Payload Inclus |
|-------|---------|-----------------|
| `subscription.created` | Nouvelle demande d'abonnement | ID d'abonnement, API, consommateur, plan |
| `subscription.approved` | Abonnement approuvé par un admin | ID d'abonnement, clé API (si générée) |
| `subscription.revoked` | Abonnement révoqué | ID d'abonnement, raison |
| `subscription.key_rotated` | Clé API renouvelée | ID d'abonnement, nouveau préfixe de clé |
| `subscription.expired` | TTL d'abonnement expiré | ID d'abonnement, date d'expiration |

Utilisez `["*"]` pour vous abonner à tous les types d'événements.

## Créer un Webhook

### Via l'API

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

### Via le Portail

1. Accédez à **Webhooks** dans la barre latérale du Portail
2. Cliquez sur **Créer un Webhook**
3. Saisissez l'URL cible et sélectionnez les types d'événements
4. Définissez un secret de signature (minimum 32 caractères)
5. Ajoutez optionnellement des en-têtes personnalisés
6. Cliquez sur **Enregistrer**

## Format du Payload

Chaque livraison webhook envoie un payload JSON :

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

## Vérification de Signature HMAC-SHA256

Chaque livraison inclut un en-tête de signature pour la vérification du payload :

```
X-STOA-Signature: sha256=<hex-encoded-hmac>
```

### Exemple de Vérification (Python)

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

### Exemple de Vérification (Node.js)

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

Utilisez toujours une comparaison à temps constant pour prévenir les attaques temporelles.

## Politique de Nouvelle Tentative

Les livraisons échouées (réponse non-2xx ou timeout) sont réessayées avec un backoff exponentiel :

| Tentative | Délai | Attente Cumulée |
|---------|-------|-----------------|
| 1 | Immédiat | 0 |
| 2 | 1 minute | 1 min |
| 3 | 5 minutes | 6 min |
| 4 | 15 minutes | 21 min |
| 5 | 1 heure | 1h 21min |

Après 5 tentatives échouées, la livraison est marquée comme `failed`. Aucune nouvelle tentative automatique n'est effectuée.

## Suivi des Livraisons

### Consulter l'Historique des Livraisons

```bash
curl "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/deliveries" \
  -H "Authorization: Bearer $TOKEN"
```

Chaque enregistrement de livraison inclut :

| Champ | Description |
|-------|-------------|
| `status` | `success`, `failed`, `pending` |
| `status_code` | Code de réponse HTTP de votre endpoint |
| `response_body` | Premier Ko de la réponse (pour débogage) |
| `attempt` | Numéro de tentative (1-5) |
| `created_at` | Horodatage de livraison |

### Réessayer une Livraison Échouée

```bash
curl -X POST "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/deliveries/{delivery_id}/retry" \
  -H "Authorization: Bearer $TOKEN"
```

## Tester les Webhooks

Envoyez un événement de test pour vérifier votre endpoint avant la mise en production :

```bash
curl -X POST "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "subscription.created"}'
```

La livraison de test utilise des données synthétiques et est marquée `test: true` dans le payload.

## Gérer les Webhooks

### Lister les Webhooks

```bash
curl "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks" \
  -H "Authorization: Bearer $TOKEN"
```

### Désactiver un Webhook

```bash
curl -X PATCH "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Supprimer un Webhook

```bash
curl -X DELETE "${STOA_API_URL}/v1/tenants/{tenant_id}/webhooks/{webhook_id}" \
  -H "Authorization: Bearer $TOKEN"
```

## Bonnes Pratiques

1. **Vérifiez toujours les signatures** — rejetez les payloads non signés ou incorrectement signés
2. **Répondez rapidement** — retournez un 200 dans les 5 secondes ; traitez de manière asynchrone
3. **Gérez les doublons** — utilisez `webhook_id` + `timestamp` pour l'idempotence
4. **Utilisez HTTPS** — les URLs de webhook doivent utiliser TLS en production
5. **Renouvelez les secrets** — mettez à jour le secret webhook périodiquement via PATCH
6. **Surveillez les livraisons** — vérifiez l'historique des livraisons dans le Portail pour les échecs

## Voir Aussi

- [Cycle de Vie des Abonnements](/docs/guides/subscriptions-lifecycle) -- Événements d'abonnement
- [Intégration des Consommateurs](/docs/guides/consumer-onboarding) -- Gestion des clés API
- [Portail Développeur](/docs/guides/portal) -- Interface webhook du Portail
