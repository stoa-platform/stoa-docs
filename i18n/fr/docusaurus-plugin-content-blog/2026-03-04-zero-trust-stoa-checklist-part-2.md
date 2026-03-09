---
slug: zero-trust-stoa-checklist-part-2
title: "Liste de Contrôle Zero Trust : 10 Étapes pour les API Gateways"
description: "Liste de contrôle actionnable en 10 étapes : mTLS, scopes OAuth, politiques OPA, guardrails, journalisation d'audit et réponse aux incidents pour les API gateways Zero Trust."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
keywords:
  - zero trust API gateway checklist
  - STOA zero trust configuration
  - API gateway mTLS configuration
  - OPA policy API gateway
  - OAuth 2.1 API gateway configuration
  - zero trust implementation guide API
  - API security checklist 2026
  - configure zero trust API gateway
  - mTLS zero trust step by step
  - least privilege API scopes
---
<!-- last verified: 2026-02 -->

Cette liste de contrôle implémente l'architecture Zero Trust avec STOA Platform en 10 étapes actionnables. Chaque étape est indépendamment déployable et vérifiable. Commencez par le début — les étapes 1 à 3 apportent l'amélioration de sécurité la plus immédiate et peuvent être implémentées en moins d'une heure.

<!-- truncate -->

:::info Il s'agit de la Partie 2 d'une série en 3 parties
- [Partie 1](/blog/zero-trust-api-gateways-part-1) : Ce que Zero Trust signifie pour les API gateways
- **Partie 2 (cet article)** : Liste de contrôle Zero Trust STOA en 10 étapes
- [Partie 3](/blog/detecting-attacks-stoa-part-3) : Détecter les attaques avec STOA

Pour le contexte architectural, consultez [Architecture de sécurité STOA](/blog/stoa-api-security-architecture).
:::

## Étape 1 : Attribuer une identité unique à chaque consommateur d'API

Zero Trust commence par l'identité. Chaque appelant — application mobile, pipeline CI/CD, intégration tierce, agent IA — doit avoir une identité unique et non partagée.

**Pourquoi** : les identifiants partagés rendent l'attribution impossible. Quand quelque chose tourne mal, vous ne pouvez pas savoir quel consommateur en est responsable.

**Avec STOA** : chaque consommateur obtient un enregistrement de consommateur unique dans le plan de contrôle STOA avec un identifiant client OAuth distinct.

```bash
# Créer un consommateur via l'API STOA
curl -X POST ${STOA_API_URL}/v1/consumers \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analytics-service",
    "description": "Pipeline analytique interne",
    "tenant_id": "acme-corp"
  }'
```

**Vérification** : chaque enregistrement de consommateur a un `consumer_id` unique. Pas d'identifiants partagés entre les services.

---

## Étape 2 : Imposer des tokens de courte durée

Les tokens de longue durée (jours, mois, années) constituent un risque majeur : un token volé confère un accès prolongé. Les tokens de courte durée limitent la fenêtre de dommage.

**Configuration STOA** : définissez le TTL du token d'accès dans Keycloak à 15 minutes avec un token de rafraîchissement de 8 heures :

```bash
# Paramètres du realm Keycloak (via API)
curl -X PUT ${STOA_AUTH_URL}/admin/realms/stoa \
  -H "Authorization: Bearer ${KC_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accessTokenLifespan": 900,
    "ssoSessionMaxLifespan": 28800,
    "ssoSessionIdleTimeout": 3600
  }'
```

**Pour les agents IA** : configurez le rafraîchissement automatique du token en utilisant le token de rafraîchissement avant l'expiration du token d'accès. Claude Desktop et la plupart des frameworks d'agents IA supportent cela nativement.

**Vérification** : `curl -s ${STOA_AUTH_URL}/realms/stoa/.well-known/openid-configuration | jq '.token_endpoint'` — confirmez que l'endpoint de token répond et que les tokens sont des JWTs que vous pouvez décoder pour vérifier la claim `exp`.

---

## Étape 3 : Appliquer des scopes à moindre privilège

Auditez les scopes actuels de vos consommateurs. La plupart ne devraient avoir que `stoa:read`. Les scopes write et admin doivent être des exceptions explicites avec une justification documentée.

**Vérifier l'état actuel** :
```bash
# Lister les consommateurs et leurs scopes
curl ${STOA_API_URL}/v1/consumers \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  | jq '.[] | {name: .name, scope: .oauth_scopes}'
```

**Corriger les scopes trop larges** : si vous trouvez des consommateurs avec `stoa:admin` qui n'en ont pas besoin, passez à `stoa:read` ou `stoa:write`.

**Définitions des scopes** :
- `stoa:read` — requêtes GET uniquement, pas de mutations
- `stoa:write` — lecture + écriture, pas d'opérations admin
- `stoa:admin` — accès complet au plan de contrôle (administrateurs STOA uniquement)

**Vérification** : décodez le JWT d'un consommateur et confirmez que la claim `scope` correspond au minimum requis.

---

## Étape 4 : Activer mTLS pour les consommateurs à haut risque

Le TLS mutuel (binding de certificat RFC 8705) lie les tokens d'accès aux certificats client. Un token volé est inutile sans la clé privée correspondante.

**Activer pour** : services internes, pipelines CI/CD, agents IA avec accès étendu.

**Configuration mTLS STOA** (`stoa-gateway/config.yaml`) :

```yaml
mtls:
  enabled: true
  client_cert_header: "X-Client-Cert"
  require_for_tenants:
    - acme-corp
    - finance-team
  exempt_paths:
    - "/.well-known/*"
    - "/oauth/*"
    - "/health"
```

**Émettre des certificats client** : utilisez votre CA interne ou un certificat de courte durée depuis Vault/cert-manager :

```bash
# Avec cert-manager (Kubernetes)
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: analytics-service-cert
  namespace: stoa-system
spec:
  secretName: analytics-service-tls
  duration: 720h  # 30 jours
  renewBefore: 168h  # Renouveler 7 jours avant expiration
  subject:
    organizations: ["acme-corp"]
  commonName: analytics-service
  issuerRef:
    name: internal-ca
    kind: ClusterIssuer
EOF
```

**Vérification** : faites une requête avec et sans le certificat client. Les requêtes sans le certificat devraient retourner `401 mTLS certificate required`.

---

## Étape 5 : Écrire des politiques OPA explicites

Remplacez l'implicite « autoriser toutes les requêtes authentifiées » par des politiques OPA explicites. Commencez simplement — bloquez les opérations d'écriture pour les consommateurs en lecture seule.

**Créer une politique de base** :

```rego
# policy/baseline.rego
package stoa.authz

default allow = false

# Autoriser GET/HEAD/OPTIONS pour tout consommateur authentifié
allow {
    input.consumer.authenticated == true
    input.method in ["GET", "HEAD", "OPTIONS"]
}

# Autoriser les mutations uniquement pour les consommateurs avec scope write
allow {
    input.consumer.authenticated == true
    input.consumer.scope in ["stoa:write", "stoa:admin"]
    input.method in ["POST", "PUT", "PATCH", "DELETE"]
}

# Bloquer les endpoints admin pour les non-admins
deny {
    startswith(input.path, "/admin/")
    input.consumer.scope != "stoa:admin"
}
```

Chargez via l'API STOA ou la Console. Les politiques OPA prennent effet immédiatement sur la prochaine requête.

**Vérification** : envoyez une requête DELETE avec un token `stoa:read` — attendez `403 Forbidden`. Envoyez avec un token `stoa:write` — attendez `200 OK` ou la réponse backend appropriée.

---

## Étape 6 : Définir des limites de rate par consommateur

Les limites de rate imposent la « moindre consommation de ressources » — aucun consommateur ne peut monopoliser le gateway. Elles fournissent également une détection précoce des consommateurs abusifs ou défaillants.

```bash
# Créer une politique de rate limit pour le service analytique
curl -X POST ${STOA_API_URL}/v1/policies \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analytics-rate-limit",
    "type": "rate_limit",
    "consumer_id": "analytics-service-id",
    "config": {
      "requests_per_minute": 1000,
      "requests_per_hour": 20000,
      "burst_multiplier": 1.5
    }
  }'
```

**Définissez des niveaux** par type de consommateur :
- Agents IA : plus bas par minute, plus élevé par heure (charges de travail en rafales)
- Services internes : plus élevé par minute (haute fréquence, prévisible)
- Partenaires externes : selon leur SLA

**Vérification** : exécutez une simple boucle faisant 1001 requêtes/minute et confirmez que la 1001e retourne `429 Too Many Requests` avec l'en-tête `Retry-After`.

---

## Étape 7 : Activer les guardrails IA

Les guardrails inspectent les payloads de requête et de réponse pour détecter les patterns liés à la sécurité. Essentiels pour le trafic des agents IA où les payloads peuvent contenir des données sensibles ou des tentatives d'injection.

**Activer dans la configuration STOA** :

```yaml
guardrails:
  enabled: true
  pii_detection:
    enabled: true
    action: redact  # ou "block"
    patterns:
      - type: credit_card
      - type: ssn
      - type: email
        action: log_only  # Ne pas bloquer les emails, juste journaliser
  prompt_injection:
    enabled: true
    action: block
    patterns:
      - "ignore previous instructions"
      - "override system prompt"
      - "you are now"
  response_size_limit_kb: 512
```

**Vérification** : envoyez une requête avec `4242424242424242` (numéro de carte de test) dans le corps. Confirmez qu'il est masqué dans la réponse et qu'un événement de guardrail apparaît dans le journal d'audit.

---

## Étape 8 : Configurer une journalisation d'audit immuable

Vous ne pouvez pas pratiquer le Zero Trust sans observabilité. Chaque appel doit être journalisé — y compris les réussis. Les appels réussis représentent votre baseline normale ; les déviations de cette baseline constituent votre signal d'anomalie.

**Envoi des logs d'audit STOA** (Kafka/SIEM) :

```yaml
audit:
  enabled: true
  kafka:
    brokers: ["kafka.internal:9092"]
    topic: "stoa.audit.events"
    include_request_hash: true
    include_response_status: true
    include_guardrail_triggers: true
  retention_days: 90
```

**Champs minimum à capturer** :
- `timestamp`, `session_id`, `agent_id`, `consumer_id`
- `tool_name`, `http_method`, `path`
- `outcome` (autorisé/refusé), `policy_result`
- `backend_status`, `duration_ms`
- `guardrail_triggers[]`

**Vérification** : faites un appel de test et confirmez que l'événement d'audit apparaît dans votre SIEM/agrégateur de logs dans les 30 secondes. Vérifiez que `consumer_id` et `agent_id` sont renseignés.

---

## Étape 9 : Implémenter la validation continue des tokens

La validation des tokens doit se produire à chaque requête, pas seulement au début de session. Cela détecte rapidement les tokens révoqués.

**STOA valide à chaque requête par défaut**. Confirmez que l'introspection est activée :

```yaml
auth:
  jwt:
    issuer: "${STOA_AUTH_URL}/realms/stoa"
    audience: "stoa-gateway"
    validation_mode: "strict"  # valide exp, iss, aud à chaque requête
  introspection:
    enabled: true
    endpoint: "${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/token/introspect"
    cache_ttl_seconds: 60  # Mettre en cache le résultat 1 minute pour réduire la charge
```

**Révocation de token** : quand un consommateur est déprovisionné, révoquez immédiatement ses tokens :

```bash
# Révoquer tous les tokens d'un consommateur
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/revoke \
  -d "token=${CONSUMER_REFRESH_TOKEN}" \
  -d "token_type_hint=refresh_token" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}"
```

**Vérification** : émettez un token, révoquez-le via Keycloak, puis faites une requête avec le token révoqué — attendez `401 Token revoked`.

---

## Étape 10 : Configurer des alertes d'anomalie

La dernière étape boucle la boucle Zero Trust : passer de la détection à l'alerte. Définissez à quoi ressemble un comportement « normal » et alertez quand le comportement s'en écarte.

**Métriques clés sur lesquelles alerter** :

| Métrique | Condition d'alerte | Seuil suggéré |
|--------|----------------|-------------------|
| `stoa_consumer_requests_total` (taux) | Pic soudain | > 3× la moyenne glissante sur 5 minutes |
| `stoa_policy_deny_rate` (par consommateur) | Taux de refus élevé | > 10% de taux de refus sur 5 minutes |
| `stoa_guardrail_triggers_total` | Guardrail déclenché | Tout déclenchement (commencer par log, escalader vers alerte) |
| `stoa_auth_failures_total` | Échecs d'auth | > 50 échecs en 1 minute depuis une seule IP |
| `stoa_response_time_p99` | Pic de latence | > 2× la baseline |

**Exemple d'alerte Prometheus** (alerting Grafana) :

```yaml
- alert: StoaHighDenyRate
  expr: rate(stoa_policy_denies_total[5m]) / rate(stoa_requests_total[5m]) > 0.1
  for: 2m
  annotations:
    summary: "Taux de refus de politiques élevé pour le consommateur {{ $labels.consumer_id }}"
    description: "{{ $value | humanizePercentage }} des requêtes refusées dans les 5 dernières minutes"
```

**Vérification** : déclenchez un refus de politique (envoyez une requête qui viole une politique) et confirmez que l'alerte se déclenche dans la fenêtre configurée.

---

## Récapitulatif de la liste de contrôle

| Étape | Action | Priorité | Temps estimé |
|------|--------|---------|---------------|
| 1 | Identité unique par consommateur | Critique | 30 min |
| 2 | Tokens de courte durée (TTL 15 min) | Critique | 15 min |
| 3 | Audit des scopes à moindre privilège | Critique | 1 heure |
| 4 | mTLS pour les consommateurs à haut risque | Haute | 2 heures |
| 5 | Politiques OPA explicites | Haute | 2 heures |
| 6 | Rate limits par consommateur | Haute | 30 min |
| 7 | Guardrails IA | Moyenne | 30 min |
| 8 | Journalisation d'audit immuable | Moyenne | 1 heure |
| 9 | Validation continue des tokens | Moyenne | 30 min |
| 10 | Alertes d'anomalie | Moyenne | 2 heures |

## Questions fréquentes

### Dois-je implémenter les 10 étapes ?

Les étapes 1 à 3 apportent l'amélioration la plus immédiate et constituent la fondation sur laquelle tout le reste repose. Les étapes 4 à 6 ajoutent une défense en profondeur significative pour les charges de travail en production. Les étapes 7 à 10 permettent la détection et la réponse. Pour une configuration Zero Trust minimale viable, les étapes 1 à 6 constituent la baseline.

### Combien de temps prend une implémentation Zero Trust complète ?

Les étapes 1 à 6 peuvent réalistement être complétées en une journée pour un petit déploiement. Les étapes 7 à 10 nécessitent une intégration avec votre stack de surveillance et prennent 1 à 2 jours supplémentaires. Le travail continu est la maintenance des politiques, la rotation des certificats et l'ajustement des alertes — prévoyez un cycle de révision mensuel.

### Puis-je utiliser cette liste de contrôle pour la documentation de conformité ?

Oui. Chaque étape correspond à des contrôles spécifiques dans le NIST SP 800-207, l'OWASP API Security Top 10, et soutient les exigences NIS2/DORA. Pour une documentation de conformité formelle, mappez chaque étape complétée au contrôle de cadre pertinent et capturez les preuves (captures d'écran, exports de configuration, résultats de tests).

---

*Poursuivez la série : [Partie 3 — Détecter les attaques avec STOA](/blog/detecting-attacks-stoa-part-3)*

*STOA Platform est open source (Apache 2.0). [Déployez STOA](https://docs.gostoa.dev/docs/guides/quickstart) ou explorez la [référence de sécurité](https://docs.gostoa.dev/docs/reference/security).*
