---
sidebar_position: 13
title: "Rotation des Clés API : Gestion des Clés sans Interruption"
description: "Renouvelez les clés API sans interruption grâce au mécanisme de période de grâce de STOA — guide étape par étape, cache gateway et surveillance."
keywords:
  - API key rotation
  - key management
  - grace period
  - zero downtime
  - API security
---

import EnvSetup from '@site/docs/_partials/_env-setup.mdx';

# Rotation des Clés API

Renouvelez les clés API sans interruption grâce au mécanisme de période de grâce de STOA — l'ancienne et la nouvelle clé fonctionnent toutes les deux pendant la fenêtre de transition.

## Fonctionnement

Lorsque vous renouvelez une clé, STOA n'invalide pas immédiatement l'ancienne. Au lieu de cela, il crée une **période de grâce** pendant laquelle les deux clés sont valides :

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

| Phase | Ancienne Clé | Nouvelle Clé | Durée |
|-------|---------|---------|----------|
| Avant la rotation | Valide | N/A | — |
| Période de grâce | Valide | Valide | 1-168 heures (par défaut : 24h) |
| Après la période de grâce | Invalide | Valide | Permanent |

## Rotation Étape par Étape

<EnvSetup />

### 1. Renouveler la Clé

```bash
curl -X POST "${STOA_API_URL}/v1/subscriptions/${SUB_ID}/rotate-key" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "grace_period_hours": 24
  }'
```

**Réponse :**

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

:::warning Sauvegardez la Nouvelle Clé
La `new_api_key` n'est affichée qu'une seule fois. Stockez-la en lieu sûr avant de continuer.
:::

### 2. Mettre à Jour Vos Applications

Déployez la nouvelle clé dans vos applications. Pendant la période de grâce, les deux clés fonctionnent :

```bash
# Ancienne clé — fonctionne toujours pendant la période de grâce
curl "${STOA_GATEWAY_URL}/apis/acme/billing/v1/invoices" \
  -H "X-API-Key: stoa_sk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

# Nouvelle clé — fonctionne immédiatement
curl "${STOA_GATEWAY_URL}/apis/acme/billing/v1/invoices" \
  -H "X-API-Key: stoa_sk_e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2"
```

### 3. Vérifier la Rotation

Vérifiez le statut de la rotation :

```bash
curl "${STOA_API_URL}/v1/subscriptions/${SUB_ID}/rotation-info" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Réponse :**

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

### 4. Attendre l'Expiration de la Période de Grâce

Après l'expiration de la période de grâce, l'ancienne clé est automatiquement invalidée. Aucune action n'est nécessaire.

## Recommandations pour la Période de Grâce

| Scénario | Période de Grâce Recommandée |
|----------|------------------------|
| Application unique, déploiement rapide | 1-4 heures |
| Services multiples, déploiement progressif | 12-24 heures |
| Intégrations partenaires, consommateurs externes | 48-72 heures |
| Rotation de conformité (planifiée) | 24 heures |
| Rotation d'urgence (clé compromise) | 1 heure |

:::tip Rotation d'Urgence
Si une clé est compromise, utilisez une période de grâce d'1 heure. Cela donne à votre équipe juste assez de temps pour déployer la nouvelle clé tout en minimisant la fenêtre d'exposition.
:::

## Cache Gateway

Le gateway met en cache les résultats de validation des clés API pour réduire la latence :

| Paramètre | Valeur |
|---------|-------|
| TTL du cache | 5 minutes |
| Entrées maximum | 10 000 |
| Invalidation | Automatique à la rotation |

Lorsque vous renouvelez une clé :
1. Le Plan de Contrôle notifie le gateway
2. Le gateway invalide l'entrée de cache pour l'ancienne clé
3. La prochaine requête revalide contre le Plan de Contrôle
4. Le nouveau résultat de validation est mis en cache

**Cas le plus défavorable** : Une clé renouvelée peut encore être en cache jusqu'à 5 minutes après l'expiration de la période de grâce. Pour une invalidation immédiate, l'administrateur peut vider le cache gateway :

```bash
curl -X POST "${STOA_GATEWAY_URL}/admin/cache/clear" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

## Rotation via la Console

1. Accédez à **Abonnements** dans la Console
2. Trouvez l'abonnement à renouveler
3. Cliquez sur le bouton **Renouveler la Clé**
4. Définissez la période de grâce (par défaut : 24 heures)
5. Copiez la nouvelle clé depuis la boîte de dialogue de confirmation

## Surveillance des Rotations

Suivez l'état des rotations via les champs `rotation_count` et `last_rotated_at` de l'abonnement :

```bash
# Lister tous les abonnements avec les informations de rotation
curl "${STOA_API_URL}/v1/subscriptions/tenant/${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" | \
  jq '.subscriptions[] | {api_key_prefix, rotation_count, last_rotated_at}'
```

### Bonnes Pratiques de Rotation

- **Renouvelez régulièrement** — Tous les 90 jours pour les clés de production
- **Automatisez la rotation** — Utilisez des pipelines CI/CD ou des scripts planifiés
- **Surveillez le compteur de rotation** — Des pics inhabituels peuvent indiquer des problèmes
- **Testez avec une période de grâce** — Utilisez toujours une période de grâce en production
- **Piste d'audit** — Chaque rotation est journalisée avec horodatage et utilisateur

## Dépannage

| Problème | Cause | Solution |
|---------|-------|-----|
| Ancienne clé rejetée pendant la période de grâce | Période de grâce expirée | Vérifiez l'horodatage `old_key_expires_at` |
| Nouvelle clé retourne 401 | Abonnement inactif | Vérifiez que le statut de l'abonnement est `active` |
| Les deux clés rejetées | Abonnement suspendu/révoqué | Vérifiez le statut de l'abonnement |
| La rotation retourne 404 | Mauvais ID d'abonnement | Vérifiez que l'abonnement existe |

## Voir Aussi

- [Cycle de Vie des Abonnements](/docs/guides/subscriptions-lifecycle) — États et transitions des abonnements
- [Application des Quotas](/docs/reference/quotas) — Limites de débit et quotas
- [API Admin Gateway](/docs/api/gateway-admin-api) — Endpoints de gestion du cache
- [Configuration de Sécurité](/docs/reference/security-configuration) — Bonnes pratiques de sécurité
