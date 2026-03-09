---
sidebar_position: 10
title: Configuration de Sécurité
description: Guide de durcissement de sécurité pour STOA Platform — validation d'audience JWT, CORS, limites SSE, bonnes pratiques OWASP et Pod Security Standards Kubernetes
keywords: [security, configuration, JWT, CORS, hardening, Kubernetes]
---

# Configuration de Sécurité

Ce guide couvre les paramètres de sécurité introduits dans les **Correctifs de Sécurité P0 Team Coca** (ADR-018).

:::tip Résumé
Toutes les fonctionnalités de sécurité sont **activées par défaut** avec des paramètres sécurisés. Vous n'avez besoin de les configurer que si vous personnalisez votre environnement.
:::

## Référence Rapide

| Fonctionnalité | Paramètre | Défaut | Rollback |
|---------|---------|---------|----------|
| Audience JWT | `ALLOWED_AUDIENCES` | `stoa-mcp-gateway,account` | Définir à `""` |
| CORS | `CORS_ORIGINS` | Liste blanche | Définir à `"*"` |
| Limites SSE | `SSE_LIMITER_ENABLED` | `true` | Définir à `false` |
| Proxies de Confiance | `SSE_TRUSTED_PROXIES` | `""` (aucun) | Configurer les CIDRs |

---

## Validation de l'Audience JWT (CAB-938)

### Ce que ça Fait

Valide que les tokens JWT ont été émis spécifiquement pour le MCP Gateway, empêchant la réutilisation des tokens d'autres clients Keycloak.

### Configuration

```bash
# Variables d'environnement
ALLOWED_AUDIENCES=stoa-mcp-gateway,account

# Ou dans settings.py
allowed_audiences: str = "stoa-mcp-gateway,account"
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|---------|------|---------|-------------|
| `ALLOWED_AUDIENCES` | string | `stoa-mcp-gateway,account` | Liste d'audiences JWT valides séparées par des virgules |

### Configuration Keycloak

Assurez-vous que votre client Keycloak est configuré pour inclure l'audience :

```json
{
  "clientId": "stoa-mcp-gateway",
  "protocolMappers": [
    {
      "name": "audience-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "config": {
        "included.client.audience": "stoa-mcp-gateway",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### Test

```bash
# Décoder un token et vérifier l'audience
echo $TOKEN | cut -d. -f2 | base64 -d | jq '.aud'
# Doit inclure : "stoa-mcp-gateway"
```

### Rollback

Si la validation JWT casse l'authentification :

```bash
# Désactiver la validation de l'audience (temporaire !)
export ALLOWED_AUDIENCES=""
```

:::warning
Désactiver la validation de l'audience est un risque de sécurité. À utiliser uniquement pour le débogage.
:::

---

## Configuration CORS (CAB-950)

### Ce que ça Fait

Restreint les origines pouvant effectuer des requêtes cross-origin vers l'API, empêchant les attaques CSRF et d'exfiltration de données.

### Configuration

```bash
# Variables d'environnement
CORS_ORIGINS=https://console.stoa.dev,https://portal.stoa.dev
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Authorization,Content-Type,X-Request-ID,X-Tenant-ID
CORS_EXPOSE_HEADERS=X-Request-ID,X-Trace-ID
CORS_MAX_AGE=600
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|---------|------|---------|-------------|
| `CORS_ORIGINS` | string | Voir ci-dessous | Origines autorisées séparées par des virgules |
| `CORS_ALLOW_METHODS` | string | `GET,POST,PUT,DELETE,OPTIONS` | Méthodes HTTP autorisées |
| `CORS_ALLOW_HEADERS` | string | `Authorization,Content-Type,...` | En-têtes de requête autorisés |
| `CORS_EXPOSE_HEADERS` | string | `X-Request-ID,X-Trace-ID` | En-têtes exposés au navigateur |
| `CORS_MAX_AGE` | int | `600` | Durée du cache preflight (secondes) |

### Origines par Défaut

```
https://console.stoa.dev
https://portal.stoa.dev
https://console.gostoa.dev
https://portal.gostoa.dev
```

### Développement Local

Pour le développement local, ajoutez des origines localhost :

```bash
CORS_ORIGINS=https://console.stoa.dev,http://localhost:3000,http://localhost:5173
```

### Test

```bash
# Tester le preflight CORS
curl -X OPTIONS ${STOA_API_URL}/v1/tools \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Doit retourner 403 ou Access-Control-Allow-Origin manquant
```

### Rollback

```bash
# Autoriser toutes les origines (NON RECOMMANDÉ !)
export CORS_ORIGINS="*"
```

:::danger
N'utilisez jamais `CORS_ORIGINS="*"` en production. Cela permet à n'importe quel site web d'effectuer des requêtes authentifiées vers votre API.
:::

---

## Limites de Connexions SSE (CAB-939)

### Ce que ça Fait

Prévient les attaques d'épuisement de connexions (Slowloris) en limitant les connexions SSE par IP, par tenant et globalement.

### Configuration

```bash
# Variables d'environnement
SSE_LIMITER_ENABLED=true
SSE_TRUSTED_PROXIES=10.100.0.0/16  # CIDR de votre cluster
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|---------|------|---------|-------------|
| `SSE_LIMITER_ENABLED` | bool | `true` | Activer/désactiver le rate limiting |
| `SSE_TRUSTED_PROXIES` | string | `""` | CIDRs des proxies de confiance pour X-Forwarded-For |

### Limites Intégrées

Ces limites sont codées en dur mais peuvent être ajustées dans le code :

| Limite | Valeur | Description |
|-------|-------|-------------|
| `MAX_PER_IP` | 10 | Connexions max depuis une seule IP |
| `MAX_PER_TENANT` | 100 | Connexions max par tenant |
| `MAX_TOTAL` | 5000 | Limite de connexions globale |
| `IDLE_TIMEOUT` | 30s | Fermer les connexions inactives après |
| `MAX_DURATION` | 1h | Durée maximale de connexion |
| `RATE_LIMIT_PER_MIN` | 5 | Nouvelles connexions par IP par minute |

### Proxies de Confiance

:::important
Si vous êtes derrière un load balancer ou un contrôleur ingress, vous **devez** configurer les proxies de confiance pour obtenir les IPs client exactes.
:::

```bash
# Exemple EKS
SSE_TRUSTED_PROXIES=10.100.0.0/16

# Exemple GKE
SSE_TRUSTED_PROXIES=10.0.0.0/8

# Plusieurs CIDRs
SSE_TRUSTED_PROXIES=10.100.0.0/16,172.16.0.0/12
```

Si non configuré, le limiteur utilisera l'IP de connexion directe (qui peut être votre load balancer).

### Test

```bash
# Tester le rate limit (doit obtenir 429 à la 11ème connexion)
for i in {1..15}; do
  curl -N "${STOA_API_URL}/mcp/sse" \
    -H "Authorization: Bearer $TOKEN" &
done

# Vérifier les connexions actives (si vous avez accès)
curl ${STOA_API_URL}/metrics | grep stoa_sse
```

### Codes de Réponse

| Code | Signification | En-tête |
|------|---------|--------|
| 429 | Too Many Requests | `Retry-After: 60` |

### Rollback

```bash
# Désactiver le rate limiting SSE
export SSE_LIMITER_ENABLED=false
```

---

## Sécurité des Conteneurs (CAB-945)

### Pod Security Standards

STOA applique le Pod Security Standard **restricted** sur le namespace `stoa-system` :

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: stoa-system
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Contexte de Sécurité des Deployments

Tous les deployments STOA utilisent ce contexte de sécurité :

```yaml
spec:
  automountServiceAccountToken: false  # Sauf si nécessaire
  securityContext:
    runAsNonRoot: true
    fsGroup: 1000

  containers:
    - securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
        seccompProfile:
          type: RuntimeDefault
```

### Network Policies

Le control plane est isolé avec NetworkPolicy :

```yaml
# Ingress : Uniquement depuis MCP Gateway et Ingress
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: stoa-mcp-gateway
  - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx

# Egress : Uniquement vers les services connus
egress:
  - to:
      - podSelector:
          matchLabels:
            app: postgresql
  - to:
      - podSelector:
          matchLabels:
            app: redis
  # ... et DNS
```

### Vérification

```bash
# Vérifier l'application PSS
kubectl get ns stoa-system -o jsonpath='{.metadata.labels}' | jq

# Vérifier le contexte de sécurité
kubectl get pod -n stoa-system -o jsonpath='{.items[0].spec.securityContext}'

# Tester NetworkPolicy (doit échouer depuis un pod aléatoire)
kubectl run test --rm -it --image=alpine -- wget -O- http://stoa-control-plane:8080
```

---

## Monitoring

### Métriques Prometheus (P1)

Ces métriques seront ajoutées dans une release de suivi :

```promql
# Connexions SSE actives
stoa_sse_connections_total{tenant="acme"}

# Connexions SSE rejetées
stoa_sse_rejected_total{reason="ip_limit"}

# Échecs de validation JWT
stoa_jwt_validation_failures_total{reason="invalid_audience"}
```

### Alertes

Alertes recommandées :

```yaml
- alert: STOAHighSSERejectionRate
  expr: rate(stoa_sse_rejected_total[5m]) > 10
  labels:
    severity: warning
  annotations:
    summary: Taux de rejet SSE élevé (possible attaque)

- alert: STOAJWTValidationFailures
  expr: rate(stoa_jwt_validation_failures_total[5m]) > 5
  labels:
    severity: warning
  annotations:
    summary: Échecs de validation JWT détectés
```

---

## Dépannage

### Erreurs de Validation JWT

**Symptôme :** `401 Unauthorized` avec le message "Invalid audience"

**Solution :**
1. Vérifier l'audience du token : `echo $TOKEN | cut -d. -f2 | base64 -d | jq '.aud'`
2. Vérifier la configuration du mapper client Keycloak
3. Désactiver temporairement : `ALLOWED_AUDIENCES=""`

### Erreurs CORS

**Symptôme :** La console du navigateur affiche des erreurs "CORS policy"

**Solution :**
1. Vérifier que l'origine est dans la liste blanche : `echo $CORS_ORIGINS`
2. Ajouter l'origine : `CORS_ORIGINS="...,https://your-domain.com"`
3. Vérifier les fautes de frappe (http vs https)

### Rate Limiting SSE

**Symptôme :** `429 Too Many Requests` avec `Retry-After: 60`

**Solution :**
1. Vérifier s'il s'agit de trafic légitime ou d'une attaque
2. Vérifier la détection de l'IP client : `curl -v ... | grep X-Forwarded-For`
3. Configurer les proxies de confiance : `SSE_TRUSTED_PROXIES=...`
4. Désactiver temporairement : `SSE_LIMITER_ENABLED=false`

### Sécurité des Conteneurs

**Symptôme :** Le pod ne démarre pas avec "container has runAsNonRoot and image will run as root"

**Solution :**
1. Utiliser une image de base non-root
2. Ajouter `USER 1000` au Dockerfile
3. Définir `runAsUser` dans le deployment

---

## Références

- [ADR-018 : Durcissement de Sécurité P0](/docs/architecture/adr/adr-018-security-hardening-p0)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Bonnes Pratiques JWT (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)

---

*Dernière mise à jour : 2026-01-25 — Audit de Sécurité Team Coca*
