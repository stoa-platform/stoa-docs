---
title: "ADR-021 : Observabilité pilotée par UAC"
sidebar_label: "ADR-021 : Observabilité pilotée par UAC"
sidebar_position: 21
description: "Décide le système d'observabilité piloté par le contrat UAC, permettant un débogage chirurgical avec traçage réseau dynamique sans polluer Prometheus."
keywords: [UAC, observabilité, débogage, traçage, Prometheus, diagnostics réseau]
---

# ADR-021 : Observabilité pilotée par UAC — Debug Chirurgical sans tcpdump

> **Décision :** Implémenter un système d'observabilité pilotée par le contrat UAC, avec activation dynamique du debug réseau bas niveau sans polluer Prometheus/Loki.
>
> **Statut :** Brouillon
>
> **Date :** 2026-01-23
>
> **Linear :** [CAB-892](https://linear.app/hlfh-workspace/issue/CAB-892/feature-uac-driven-observability-debug-chirurgical-sans-tcpdump)

---

## Contexte — La Douleur Réelle

**Situation actuelle chez les clients :**

1. Erreur aléatoire en prod sur un client spécifique
2. Ops planifie un tcpdump en HNO (3h du matin)
3. Capture 50 Go de trafic pendant 2h
4. Télécharge le pcap, ouvre Wireshark, cherche l'aiguille
5. Disque plein → incident secondaire
6. Au final : **3 paquets utiles sur 10 millions**

**Coût** : MTTR multiplié par 10, stress équipes, risque incident secondaire.

---

## Décision

Implémenter **"Observability as Contract"** dans le UAC avec :

1. **Niveaux déclaratifs** : metrics → traces → debug → full
2. **Activation dynamique** : via Console/API, ciblée par client/endpoint
3. **Auto-extinction** : sécurité anti-oubli après durée définie
4. **Export OTel** : données filtrées vers le backend approprié

---

## Architecture — Isolation Tenant via JWT

```
┌─────────────────────────────────────────────────────────────────┐
│                    Request entrant                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Authorization: Bearer eyJhbGc...                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ JWT Decode (no verify, juste peek pour tagging)           │  │
│  │ → tenant_id: "acme-corp"                                  │  │
│  │ → client_id: "app-payment-v2"                             │  │
│  │ → sub: "service-account-xyz"                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ OTel Span Tags (automatiques)                             │  │
│  │   tenant_id = "acme-corp"                                 │  │
│  │   client_id = "app-payment-v2"                            │  │
│  │   correlation_id = "req-abc-123"                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Grafana Query Filter                                      │  │
│  │   WHERE tenant_id = "acme-corp"                           │  │
│  │   → Isolation garantie, pas de leak cross-tenant          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Sources de corrélation tenant :**
- JWT claims : `tenant_id`, `azp` (authorized party), `client_id`
- mTLS : CN du certificat client
- API Key : lookup vers tenant associé

---

## Niveaux d'Observabilité

| Mode | Ce qui remonte | Backend | Coût | Rétention |
|------|----------------|---------|------|-----------|
| **metrics** | latency, status, count | Prometheus | ~0 | 15j |
| **traces** | Trace ID + spans | Tempo/Jaeger | Faible | 7j |
| **debug** | TCP timing, headers, TLS | OTel → Loki | Temporaire | 24h |
| **full** | Tout (équivalent tcpdump) | Export fichier | Ponctuel | Session |

---

## Extension du Schéma UAC

```yaml
# Dans le contrat UAC
observability:
  default_level: "metrics"      # Prometheus léger (toujours)
  on_error: "traces"            # OTel traces auto si 5xx

  debug_mode:
    enabled: false              # Activable via Console/API
    auto_disable_after: "10m"   # Sécurité anti-oubli
    max_duration: "1h"          # Hard limit

    filters:                    # Ciblage chirurgical
      - client_id: "client-xyz"
      - endpoint: "/payments/*"
      - status_code: [500, 502, 503]
      - header_match:
          X-Request-ID: "req-*"

    capture:                    # Ce qu'on capture
      - tcp_timing              # Connect, TTFB, total
      - tls_handshake           # Durée, cipher, cert info
      - headers                 # Request + Response
      - body_hash               # SHA-256, pas le body (RGPD)

    exclude:                    # Ce qu'on ne capture JAMAIS
      - headers: ["Authorization", "Cookie", "X-API-Key"]
      - body: true              # Jamais le body en clair
```

---

## API d'Activation Dynamique

```bash
# Activer debug pour un client spécifique
POST /v1/debug/sessions
&#123;
  "scope": &#123;
    "tenant_id": "acme-corp",
    "client_id": "payment-service",
    "endpoint": "/api/v1/payments/*"
  &#125;,
  "capture": ["tcp_timing", "headers", "tls_handshake"],
  "duration": "10m",
  "reason": "Investigating intermittent 502 errors"
&#125;

# Response
&#123;
  "session_id": "debug-session-abc123",
  "expires_at": "2026-01-23T22:10:00Z",
  "grafana_url": "https://grafana.stoa.internal/d/debug?session=abc123"
&#125;
```

```bash
# Lister sessions actives
GET /v1/debug/sessions?tenant_id=acme-corp

# Arrêter une session
DELETE /v1/debug/sessions/debug-session-abc123
```

---

## Format de Sortie — JSON Interprété

Pas de pcap brut. Un JSON lisible avec diagnostic automatique :

```json
&#123;
  "request_id": "req-abc-123",
  "tenant_id": "acme-corp",
  "timestamp": "2026-01-23T21:45:12.345Z",

  "timeline": [
    &#123;"event": "request_received", "time_us": 0&#125;,
    &#123;"event": "tcp_connect", "target": "backend:8080", "duration_us": 1200&#125;,
    &#123;"event": "tls_handshake", "duration_us": 45000, "cipher": "TLS_AES_256_GCM_SHA384"&#125;,
    &#123;"event": "request_sent", "bytes": 2048&#125;,
    &#123;"event": "first_byte", "wait_us": 230000&#125;,
    &#123;"event": "response_complete", "bytes": 15360, "status": 200&#125;
  ],

  "metrics": &#123;
    "total_duration_ms": 276.2,
    "tcp_connect_ms": 1.2,
    "tls_handshake_ms": 45.0,
    "ttfb_ms": 230.0,
    "transfer_ms": 0.0
  &#125;,

  "diagnosis": &#123;
    "verdict": "BACKEND_SLOW",
    "detail": "TTFB 230ms indicates slow backend processing",
    "recommendation": "Check backend /payments endpoint performance"
  &#125;
&#125;
```

---

## Sécurité & Conformité

| Aspect | Mesure |
|--------|--------|
| **RGPD** | Jamais de body en clair, hash SHA-256 uniquement |
| **Secrets** | Headers sensibles exclus (Auth, Cookie, API-Key) |
| **Multi-tenant** | Isolation par tenant_id, pas de leak possible |
| **Audit** | Toute activation loggée avec raison et utilisateur |
| **Auto-expiry** | Sessions debug auto-désactivées |
| **RBAC** | Seuls les tenant-admin+ peuvent activer le debug |

---

## Implémentation Rust (MCP Gateway)

```rust
use jsonwebtoken::&#123;decode, DecodingKey, Validation, Algorithm&#125;;
use opentelemetry::trace::Span;

// Extraire tenant_id du JWT (sans vérifier signature)
fn extract_tenant_from_jwt(token: &str) -> Option<String> &#123;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.insecure_disable_signature_validation();
    validation.validate_exp = false;

    let token_data = decode::<Claims>(token, &DecodingKey::from_secret(&[]), &validation).ok()?;
    token_data.claims.tenant_id.or(token_data.claims.azp)
&#125;

// Tagger le span OTel
fn tag_span_with_tenant(span: &mut impl Span, tenant_id: &str, client_id: &str) &#123;
    span.set_attribute(KeyValue::new("tenant_id", tenant_id.to_string()));
    span.set_attribute(KeyValue::new("client_id", client_id.to_string()));
&#125;
```

---

## Positionnement Marché

| Capacité | Gateways Traditionnels | STOA |
|----------|------------------------|------|
| Debug réseau | Outillage limité ou externe | TCP/TLS/HTTP natif |
| Activation dynamique | Généralement non disponible | Via contrat UAC |
| Multi-tenant sécurisé | Variable selon l'implémentation | Isolation JWT par conception |
| Auto-expiry | Nettoyage manuel requis | Auto-désactivation intégrée |

→ **Différenciateur clé** : Débogage en production sans tcpdump.

---

## Métriques

```prometheus
# Debug sessions
stoa_debug_sessions_active{tenant_id}
stoa_debug_sessions_total{tenant_id, outcome="completed|expired|cancelled"}
stoa_debug_capture_bytes_total{tenant_id, capture_type}

# Performance impact (doit rester ~0 quand debug off)
stoa_observability_overhead_us{level="metrics|traces|debug"}
```

---

## Phases d'Implémentation

| Phase | Scope | Cycle |
|-------|-------|-------|
| **1** | UAC Schema + Parser | Cycle 9 |
| **2** | Runtime capture (Rust) | Cycle 9-10 |
| **3** | API activation + Console UI | Cycle 10 |
| **4** | Dashboard Grafana | Cycle 10 |

---

## Liens

- **Linear :** [CAB-892](https://linear.app/hlfh-workspace/issue/CAB-892/feature-uac-driven-observability-debug-chirurgical-sans-tcpdump)
- **Lié :** [ADR-012 : Architecture RBAC MCP](./adr-012-mcp-rbac-architecture.md)
- **Lié :** ADR-017 : Kafka Internal-Only
