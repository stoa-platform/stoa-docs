---
sidebar_position: 23
title: "ADR-023 : Observabilité Zéro Angle Mort"
description: "Décide la stratégie d'observabilité zéro angle mort garantissant une visibilité complète sur toutes les interactions gateway et API, sans lacune de surveillance."
keywords: [observabilité, surveillance, zéro angle mort, métriques, logging, traçage]
---

# ADR-023 : Observabilité Zéro Angle Mort

**Statut :** Accepté
**Date :** 2026-01-26
**Décideurs :** Christophe ABOULICAM
**Tickets liés :** CAB-960, CAB-961, CAB-962, CAB-397

---

## Contexte

### Le Problème

Incident réel chez une grande institution financière :
- Erreurs 502 intermittentes affectant 5% des utilisateurs
- Cause racine : dégradation du proxy corporate (Cisco)
- **Zéro visibilité** car le proxy n'avait aucune instrumentation
- Diagnostic nécessaire : dump manuel + ticket éditeur + semaines d'analyse

C'est le problème de l'« angle mort » qui affecte la gestion d'API traditionnelle :
- Les erreurs surviennent hors du champ de visibilité du gateway
- L'impact est diffus (affecte un sous-ensemble d'utilisateurs)
- La corrélation nécessite un effort manuel sur plusieurs systèmes
- Le MTTR se mesure en heures ou en jours

### L'Anti-Pattern

```
┌──────────┐      ┌──────────────┐      ┌─────────┐
│  Client  │──▶──│  Proxy/LB    │──▶──│ Gateway │──▶── Backend
└──────────┘      └──────────────┘      └─────────┘
                        │
                   ❌ PAS DE MÉTRIQUES
                   ❌ PAS DE TRACES
                   ❌ PAS DE CORRÉLATION
```

De nombreux gateways traditionnels traitent l'observabilité comme une fonctionnalité **opt-in** :
- Les plugins doivent être activés
- La configuration est fragmentée (metrics ≠ traces ≠ logs)
- Peut être désactivée par une mauvaise configuration
- Aucune visibilité sur les sauts intermédiaires

---

## Décision

### Le Principe

> **"Si une requête passe par STOA, nous savons ce qui s'est passé — par conception."**

L'observabilité dans STOA n'est pas une fonctionnalité — c'est une **propriété du système**.

### Implémentation

#### 1. L'observabilité est NATIVE (pas opt-in)

Chaque requête transitant par STOA Gateway génère automatiquement :
- **Métriques** (Prometheus) — latence, codes de statut, débit
- **Traces** (OpenTelemetry) — traçage distribué avec contexte de span
- **Logs** (JSON structuré) — métadonnées requête/réponse
- **Error Snapshots** — capture du contexte complet en cas d'échec

```rust
// Pseudo-code: Every request handler
fn handle_request(req: Request) -> Response {
    // Trace ID is MANDATORY
    let trace_id = req.header("X-Trace-ID")
        .unwrap_or_else(|| generate_trace_id());

    let span = tracer.start_span("gateway.request")
        .with_trace_id(trace_id);

    // Metrics are AUTOMATIC
    let timer = metrics.request_duration.start_timer();

    // Processing...
    let response = process(req);

    // Error Snapshot on failure (AUTOMATIC)
    if response.status >= 400 {
        capture_error_snapshot(req, response, span);
    }

    timer.observe_duration();
    response
}
```

#### 2. Zéro Configuration Requise

| Approche Traditionnelle | Approche STOA |
|------------------------|---------------|
| Observabilité basée sur des plugins à activer | Native, active par défaut |
| Configuration séparée pour metrics/traces/logs | Unifiée par défaut |
| Peut être désactivée | Centrale, non désactivable |
| Nécessite un réglage | Fonctionne out-of-the-box |

#### 3. Le Trace ID est Obligatoire

- Si l'en-tête `X-Trace-ID` est présent → propagé
- Sinon → auto-généré (UUID v4)
- Par conception, chaque requête reçoit un identifiant de corrélation

#### 4. Inférence de Timing pour les Angles Morts

Même lorsque les sauts intermédiaires (proxies, load balancers) n'ont pas d'instrumentation :

```
T_network = T_total - T_gateway - T_backend
```

Si `T_network > baseline + 3σ` → **Anomalie réseau détectée**

```yaml
# stoa.yaml
apis:
  - name: payment-api
    upstream: https://backend.internal

    networkPath:
      hops:
        - name: corporate-proxy
          address: proxy.corp.local:8080
      monitoring:
        enabled: true  # DEFAULT
        alertOnDegradation: true
```

---

## Conséquences

### Positives

1. **MTTR : Minutes, pas heures**
   - Contexte complet disponible immédiatement sur toute erreur
   - Plus besoin de rechercher sur plusieurs systèmes

2. **Capacité d'auto-diagnostic**
   - Le système peut identifier automatiquement la cause racine probable
   - Les alertes incluent un contexte actionnable

3. **Différenciation concurrentielle**
   - Observabilité native approfondie comme différenciateur central
   - Résonne fortement auprès des équipes ops enterprise

4. **Établissement de confiance**
   - Conçu pour que les opérateurs aient le contexte complet sur chaque requête
   - Réduit les conflits de responsabilité entre équipes

### Négatives

1. **Coûts de stockage**
   - Les Error Snapshots nécessitent un stockage S3/MinIO
   - Atténué par les politiques de rétention et la compression

2. **Surcharge de performance**
   - Conçu pour une surcharge minimale par requête pour l'instrumentation
   - Le traçage est échantillonné dans les scénarios à fort volume

3. **Complexité**
   - Plus de composants à maintenir (Prometheus, Loki, collecteur OpenTelemetry)
   - Atténué par les Helm charts avec des valeurs par défaut raisonnables

---

## Feuille de Route d'Implémentation

| Phase | Ticket | Composant | Priorité |
|-------|--------|-----------|----------|
| 1 | CAB-960 | Observabilité par défaut (Architecture) | P0 |
| 2 | CAB-397 | Error Snapshot / Flight Recorder | P1 ✅ Terminé |
| 3 | CAB-961 | Moteur d'auto-diagnostic | P1 |
| 4 | CAB-962 | Détection des sauts intermédiaires | P2 |

---

## Critères de Validation

### Métriques de Succès

1. **Toute erreur peut être diagnostiquée en `<5 minutes`** avec les données natives STOA
2. Par conception, toutes les requêtes ont un trace ID en production
3. Toutes les erreurs 5xx capturées dans les Error Snapshots par défaut
4. **Anomalies réseau détectées** dans les 30 secondes

### Scénarios de Test

1. Timeout backend → Error Snapshot capture le contexte complet
2. Dégradation proxy → L'inférence de timing détecte l'anomalie
3. Pannes intermittentes → L'analyse de pattern identifie le périmètre
4. Corrélation cross-tenant → L'auto-diagnostic identifie la cause racine

---

## Références

- [CAB-960 : Observabilité par défaut](https://linear.app/hlfh-workspace/issue/CAB-960)
- [CAB-961 : Moteur d'auto-diagnostic](https://linear.app/hlfh-workspace/issue/CAB-961)
- [CAB-962 : Détection des sauts intermédiaires](https://linear.app/hlfh-workspace/issue/CAB-962)
- [CAB-397 : Error Snapshot](https://linear.app/hlfh-workspace/issue/CAB-397)
- Inspiration : AWS X-Ray Insights, Datadog Watchdog, Honeycomb BubbleUp

---

## Citations

> *"L'observabilité n'est pas une feature, c'est une propriété du système."*

> *"Avec un gateway traditionnel, une erreur 502 peut nécessiter de chercher dans plusieurs dashboards. Avec STOA, le contexte complet est disponible en un clic."*

---

*Document généré à partir de l'analyse d'incident en production — Cas d'angle mort proxy (janvier 2026)*
