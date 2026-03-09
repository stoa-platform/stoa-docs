---
sidebar_position: 25
title: "ADR-025 : Résilience Gateway — Pattern Anti-Nœud Zombie"
description: "Décide le pattern anti-nœud zombie avec des probes de disponibilité approfondies, le logging last-gasp et la détection d'anomalies pour la résilience du gateway."
keywords: [résilience gateway, nœuds zombies, probes de disponibilité, détection d'anomalies, fiabilité]
---

# ADR-025 : Résilience Gateway — Pattern Anti-Nœud Zombie

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | 📋 Proposé |
| **Date** | 2026-01-26 |
| **Linear** | [CAB-957](https://linear.app/hlfh-workspace/issue/CAB-957) |
| **ADRs liés** | [ADR-023](./adr-023-zero-blind-spot-observability.md), [ADR-024](./adr-024-gateway-unified-modes.md) |

## Contexte

### Le Problème du Nœud Zombie

Un **Nœud Zombie** est une instance gateway qui :
- Le processus est vivant (PID existe)
- Le health check (`/health`) retourne 200 OK
- **Mais les requêtes échouent silencieusement** (erreurs 500, timeouts ou réponses incorrectes)

Le load balancer continue de router le trafic vers le zombie, provoquant une **dégradation silencieuse** de l'ensemble du cluster.

### Incident Réel : Gateway API Enterprise

> Lors d'une mise à jour progressive chez un grand client bancaire, un nœud gateway webMethods rapportait un statut healthy, mais ses activations d'API avaient échoué. Le nœud retournait des erreurs 500 pour toutes les requêtes métier tout en passant les probes de santé.
>
> **Impact :** 15 minutes de panne partielle, 23% des requêtes en échec, violation de SLA déclenchant une clause pénale.
>
> **Cause racine :** L'endpoint de santé vérifiait "le processus est vivant" mais pas "les APIs sont réellement routables."

### Pourquoi les Health Checks Standard Échouent

| Type de Vérification | Ce qu'elle valide | Détection Zombie |
|----------------------|------------------|------------------|
| Probe TCP | Port ouvert | ❌ Non |
| HTTP `/health` | Le processus répond | ❌ Non |
| Probe de disponibilité | Config chargée | ⚠️ Partiel |
| **Disponibilité approfondie** | Routabilité réelle | ✅ Oui |

## Décision

Implémenter un **pattern Anti-Zombie à 5 composants** couvrant les déploiements Natifs (STOA Gateway) et Hybrides (gateways tiers).

### Vue d'Ensemble de l'Architecture

```
                    ┌─────────────────────────────────────────────────────┐
                    │              Pattern Anti-Zombie                     │
                    └─────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Probe de       │             │   Logging       │             │  Circuit        │
│  Disponibilité  │             │   Last-Gasp     │             │  Breaker K8s    │
│  Approfondie    │             │                 │             │                 │
│  /ready teste   │             │  503 + headers  │             │ maxUnavailable  │
│  routabilité    │             │  + métriques    │             │ minReadySeconds │
└─────────────────┘             └─────────────────┘             └─────────────────┘
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Intégration    │             │ Agrégateur de   │            │ Détection       │
│  Error Snapshot │             │ Santé (Hybride) │            │ d'Anomalies     │
│                 │             │                  │            │                 │
│  Auto-capture   │             │  Poll APIs       │            │ Trafic vs       │
│  sur not_ready  │             │  gateway tiers   │            │ taux de succès  │
└─────────────────┘             └──────────────────┘            └─────────────────┘
```

---

## Composant 1 : Probe de Disponibilité Approfondie (Natif)

### Principe

L'endpoint `/ready` doit valider la **routabilité réelle**, pas seulement "la config est chargée."

### Implémentation

```yaml
# stoa-gateway.yaml
gateway:
  probes:
    readiness:
      enabled: true
      path: /ready
      port: 3001
      interval: 5s
      timeout: 3s
      failure_threshold: 2

      # Vérifications approfondies (toutes doivent passer)
      checks:
        database:
          enabled: true
          query: "SELECT 1"
          timeout: 1s

        keycloak:
          enabled: true
          endpoint: /realms/stoa/.well-known/openid-configuration
          timeout: 2s

        internal_route:
          enabled: true
          # Tester le routage réel, pas seulement la config
          method: GET
          path: /__internal/ping
          expected_status: 200
          timeout: 1s

        upstream_sample:
          enabled: true
          # Vérifier qu'au moins un upstream est joignable
          sample_size: 1
          timeout: 2s
```

### Implémentation Rust

```rust
// src/probes/readiness.rs

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

#[derive(Serialize)]
pub struct ReadinessResponse {
    ready: bool,
    checks: ReadinessChecks,
    timestamp: String,
}

#[derive(Serialize)]
pub struct ReadinessChecks {
    database: CheckResult,
    keycloak: CheckResult,
    internal_route: CheckResult,
    upstream_sample: CheckResult,
}

#[derive(Serialize)]
pub struct CheckResult {
    status: &'static str,  // "ok" | "fail" | "degraded"
    latency_ms: u64,
    message: Option<String>,
}

pub async fn readiness_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let checks = ReadinessChecks {
        database: check_database(&state.db_pool).await,
        keycloak: check_keycloak(&state.keycloak_client).await,
        internal_route: check_internal_route(&state.router).await,
        upstream_sample: check_upstream_sample(&state.upstreams).await,
    };

    let all_ok = checks.database.status == "ok"
        && checks.keycloak.status == "ok"
        && checks.internal_route.status == "ok"
        && checks.upstream_sample.status == "ok";

    let response = ReadinessResponse {
        ready: all_ok,
        checks,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    if all_ok {
        (StatusCode::OK, Json(response))
    } else {
        // Retourner 503 pour que K8s retire le pod du service
        (StatusCode::SERVICE_UNAVAILABLE, Json(response))
    }
}
```

### Différence : Liveness vs Readiness

| Probe | Objectif | Action en cas d'échec | Vérifications |
|-------|---------|----------------------|---------------|
| `/health` (liveness) | Le processus est-il vivant ? | Tuer et redémarrer le pod | Processus, mémoire |
| `/ready` (readiness) | Peut-il servir du trafic ? | Retirer du LB | DB, auth, routes |

---

## Composant 2 : Logging Last-Gasp (Natif)

### Principe

Un nœud en état **not-ready** qui reçoit encore des requêtes DOIT :
1. **Logger la requête** (pour le débogage)
2. **Retourner 503** (pas 500)
3. **Inclure des headers de diagnostic**
4. **Émettre des métriques**

### Format de Réponse

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
X-STOA-Node-Status: degraded
X-STOA-Node-ID: gateway-7f8b9c-2xk4m
X-STOA-Readiness-Failed: keycloak,upstream_sample
Retry-After: 30

{
  "error": "service_unavailable",
  "code": "GATEWAY_NOT_READY",
  "message": "This gateway node is not ready to serve requests",
  "node_id": "gateway-7f8b9c-2xk4m",
  "failed_checks": ["keycloak", "upstream_sample"],
  "retry_after_seconds": 30,
  "timestamp": "2026-01-26T14:32:00Z"
}
```

### Implémentation Rust

```rust
// src/middleware/last_gasp.rs

use axum::{
    middleware::Next,
    http::{Request, Response, StatusCode, HeaderValue},
    body::Body,
};
use prometheus::{IntCounterVec, labels};

lazy_static! {
    static ref REJECTED_REQUESTS: IntCounterVec = register_int_counter_vec!(
        "gateway_requests_rejected_total",
        "Requests rejected by not-ready node",
        &["reason", "node_id", "path"]
    ).unwrap();
}

pub async fn last_gasp_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    // Vérifier si le nœud est prêt
    if !state.readiness.load(Ordering::SeqCst) {
        // Logger la requête qu'on ne peut pas servir
        tracing::warn!(
            path = %request.uri().path(),
            method = %request.method(),
            node_id = %state.node_id,
            "Last gasp: received request while not ready"
        );

        // Incrémenter la métrique
        REJECTED_REQUESTS
            .with_label_values(&[
                "not_ready",
                &state.node_id,
                request.uri().path(),
            ])
            .inc();

        // Retourner 503 avec headers de diagnostic
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .header("X-STOA-Node-Status", "degraded")
            .header("X-STOA-Node-ID", &state.node_id)
            .header("X-STOA-Readiness-Failed", state.failed_checks())
            .header("Retry-After", "30")
            .body(last_gasp_body(&state))
            .unwrap();
    }

    next.run(request).await
}
```

### Métriques Prometheus

```prometheus
# HELP gateway_requests_rejected_total Requests rejected by not-ready node
# TYPE gateway_requests_rejected_total counter
gateway_requests_rejected_total{reason="not_ready",node_id="gateway-7f8b9c-2xk4m",path="/api/v1/accounts"} 47
gateway_requests_rejected_total{reason="not_ready",node_id="gateway-7f8b9c-2xk4m",path="/api/v1/transfers"} 23

# HELP gateway_readiness_check_duration_seconds Duration of readiness checks
# TYPE gateway_readiness_check_duration_seconds histogram
gateway_readiness_check_duration_seconds_bucket{check="database",le="0.1"} 9823
gateway_readiness_check_duration_seconds_bucket{check="keycloak",le="0.5"} 9801

# HELP gateway_readiness_status Current readiness status (1=ready, 0=not ready)
# TYPE gateway_readiness_status gauge
gateway_readiness_status{node_id="gateway-7f8b9c-2xk4m"} 0
```

### Règle AlertManager

```yaml
# alertmanager/rules/zombie.yaml
groups:
  - name: zombie_detection
    rules:
      - alert: GatewayZombieNode
        expr: |
          increase(gateway_requests_rejected_total{reason="not_ready"}[5m]) > 10
          AND
          gateway_readiness_status == 0
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Nœud zombie détecté : {{ $labels.node_id }}"
          description: "Le nœud {{ $labels.node_id }} n'est pas prêt mais reçoit du trafic. {{ $value }} requêtes rejetées en 5 minutes."
          runbook: https://docs.gostoa.dev/runbooks/zombie-node
```

---

## Composant 3 : Configuration Circuit Breaker K8s

### Stratégie de Déploiement

```yaml
# k8s/gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stoa-gateway
  namespace: stoa-system
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # CRITIQUE : Ne jamais avoir 0 pods prêts pendant la mise à jour
      maxUnavailable: 0
      maxSurge: 1

  # Attendre la stabilité avant de marquer comme prêt
  minReadySeconds: 30

  template:
    spec:
      containers:
        - name: gateway
          image: ghcr.io/hlfh/stoa-gateway:latest

          # Liveness : le processus est-il vivant ?
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3

          # Readiness : peut-il servir du trafic ?
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 2
            # Timeout agressif pour détecter les zombies lents
            timeoutSeconds: 3

          # Startup : laisser le temps pour l'initialisation
          startupProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30  # 150s de démarrage max
```

### PodDisruptionBudget

```yaml
# k8s/gateway/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: stoa-gateway-pdb
  namespace: stoa-system
spec:
  # Toujours garder au moins 2 pods disponibles
  minAvailable: 2
  selector:
    matchLabels:
      app: stoa-gateway
```

### Arrêt Gracieux

```yaml
# Dans deployment.yaml spec.template.spec
terminationGracePeriodSeconds: 60

lifecycle:
  preStop:
    exec:
      command:
        - /bin/sh
        - -c
        - |
          # Marquer not-ready immédiatement
          touch /tmp/shutdown
          # Attendre que le load balancer drain
          sleep 15
          # Signal d'arrêt gracieux
          kill -SIGTERM 1
```

---

## Composant 4 : Intégration Error Snapshot

### Principe

Quand un nœud passe à l'état **not-ready**, capturer automatiquement le contexte pour le débogage.

### Événement Kafka

```json
{
  "event_type": "gateway.readiness.changed",
  "timestamp": "2026-01-26T14:32:00.123Z",
  "node_id": "gateway-7f8b9c-2xk4m",
  "namespace": "stoa-system",
  "cluster": "prod-eu-west-1",

  "transition": {
    "from": "ready",
    "to": "not_ready",
    "duration_ready_ms": 3600000
  },

  "failed_checks": [
    {
      "name": "keycloak",
      "error": "connection timeout after 2000ms",
      "latency_ms": 2001
    },
    {
      "name": "upstream_sample",
      "error": "0/5 upstreams reachable",
      "details": {
        "upstream_count": 5,
        "reachable": 0,
        "unreachable": ["svc-a:8080", "svc-b:8080", "svc-c:8080", "svc-d:8080", "svc-e:8080"]
      }
    }
  ],

  "snapshot": {
    "active_connections": 142,
    "requests_in_flight": 23,
    "memory_mb": 512,
    "cpu_percent": 45,
    "goroutines": 1247,
    "last_successful_request": "2026-01-26T14:31:55.000Z",
    "config_version": "v2.3.1-abc123",
    "uptime_seconds": 86400
  },

  "recent_errors": [
    {
      "timestamp": "2026-01-26T14:31:58.000Z",
      "path": "/api/v1/accounts",
      "status": 502,
      "error": "upstream connection refused"
    }
  ]
}
```

### Intégration avec ADR-023 (Zéro Angle Mort)

```rust
// src/observability/snapshot.rs

pub async fn capture_error_snapshot(
    state: &AppState,
    reason: ReadinessFailure,
) -> ErrorSnapshot {
    let snapshot = ErrorSnapshot {
        node_id: state.node_id.clone(),
        timestamp: Utc::now(),
        failed_checks: reason.checks,
        active_connections: state.connection_pool.active_count(),
        requests_in_flight: state.inflight_requests.load(Ordering::SeqCst),
        recent_errors: state.error_buffer.drain().collect(),
        // ... champs supplémentaires
    };

    // Émettre vers Kafka pour analyse centralisée
    state.kafka_producer
        .send("stoa.gateway.snapshots", &snapshot)
        .await;

    // Logger aussi localement pour accès immédiat
    tracing::error!(
        snapshot = ?snapshot,
        "Error snapshot captured on readiness failure"
    );

    snapshot
}
```

---

## Composant 5 : Mode Hybride (Gateways Tiers)

Pour les déploiements où STOA opère comme sidecar derrière Kong, IBM webMethods ou Apigee.

### Agrégateur de Santé

```yaml
# stoa-gateway.yaml (mode sidecar)
gateway:
  mode: sidecar

  health_aggregator:
    enabled: true
    poll_interval: 5s

    adapters:
      kong:
        type: kong
        admin_url: http://kong-admin:8001
        endpoints:
          status: /status
          health: /health
        metrics_path: /metrics  # Plugin Prometheus

      webmethods:
        type: webmethods
        admin_url: https://webmethods-is:5555
        auth:
          type: basic
          secret_ref: webmethods-admin-credentials
        endpoints:
          server_status: /invoke/wm.server/getServerStatistics
          package_status: /invoke/wm.server.packages/packageList

      apigee:
        type: apigee
        management_url: https://api.enterprise.apigee.com
        auth:
          type: oauth2
          secret_ref: apigee-service-account
        organization: my-org
        environment: prod

      generic:
        type: openmetrics
        scrape_url: http://custom-gateway:9090/metrics
        metrics:
          - name: gateway_requests_total
          - name: gateway_errors_total
          - name: gateway_upstream_health
```

### Implémentations des Adaptateurs

#### Adaptateur Kong

```rust
// src/adapters/kong.rs

pub struct KongAdapter {
    admin_client: reqwest::Client,
    admin_url: String,
}

impl GatewayAdapter for KongAdapter {
    async fn check_health(&self) -> AdapterHealthResult {
        // Vérifier le statut du nœud Kong
        let status: KongStatus = self.admin_client
            .get(format!("{}/status", self.admin_url))
            .send()
            .await?
            .json()
            .await?;

        // Vérifier la connectivité base de données
        let db_reachable = status.database.reachable;

        // Vérifier les cibles upstream
        let upstreams = self.get_upstream_health().await?;
        let healthy_targets = upstreams.iter()
            .filter(|u| u.health == "HEALTHY")
            .count();

        AdapterHealthResult {
            gateway_type: "kong",
            healthy: db_reachable && healthy_targets > 0,
            checks: vec![
                Check::new("database", db_reachable),
                Check::new("upstreams", healthy_targets > 0),
            ],
            metrics: KongMetrics {
                connections_active: status.server.connections_active,
                connections_accepted: status.server.connections_accepted,
                total_requests: status.server.total_requests,
            },
        }
    }
}
```

#### Adaptateur webMethods

```rust
// src/adapters/webmethods.rs

pub struct WebMethodsAdapter {
    is_client: reqwest::Client,
    is_url: String,
}

impl GatewayAdapter for WebMethodsAdapter {
    async fn check_health(&self) -> AdapterHealthResult {
        // Obtenir les statistiques du serveur
        let stats: WmServerStats = self.is_client
            .get(format!("{}/invoke/wm.server/getServerStatistics", self.is_url))
            .send()
            .await?
            .json()
            .await?;

        // CRITIQUE : Vérifier si les APIs sont réellement activées
        // C'était la cause racine de l'incident zombie
        let packages: WmPackageList = self.is_client
            .get(format!("{}/invoke/wm.server.packages/packageList", self.is_url))
            .send()
            .await?
            .json()
            .await?;

        let api_packages_enabled = packages.packages.iter()
            .filter(|p| p.name.starts_with("API_"))
            .all(|p| p.enabled);

        AdapterHealthResult {
            gateway_type: "webmethods",
            healthy: stats.server_running && api_packages_enabled,
            checks: vec![
                Check::new("server_running", stats.server_running),
                Check::new("api_packages_enabled", api_packages_enabled),  // Le tueur de zombies
                Check::new("license_valid", stats.license_days_remaining > 0),
            ],
            warnings: if !api_packages_enabled {
                vec!["API packages not enabled - potential zombie state".to_string()]
            } else {
                vec![]
            },
        }
    }
}
```

### Détection d'Anomalies

Détecter les zombies même quand les endpoints de santé mentent :

```rust
// src/detection/anomaly.rs

pub struct AnomalyDetector {
    window: Duration,
    threshold: f64,
}

impl AnomalyDetector {
    /// Détecter un zombie en comparant le trafic reçu vs le taux de succès
    ///
    /// Pattern zombie : trafic > 0 ET success_rate ≈ 0
    pub fn detect_zombie(&self, metrics: &GatewayMetrics) -> Option<ZombieAlert> {
        let traffic_received = metrics.requests_total_last_window(self.window);
        let success_count = metrics.requests_success_last_window(self.window);

        if traffic_received == 0 {
            return None;  // Pas de trafic, impossible de déterminer
        }

        let success_rate = success_count as f64 / traffic_received as f64;

        if success_rate < self.threshold {
            return Some(ZombieAlert {
                node_id: metrics.node_id.clone(),
                traffic_received,
                success_count,
                success_rate,
                detection_method: "anomaly_traffic_vs_success",
                confidence: 1.0 - success_rate,
                timestamp: Utc::now(),
            });
        }

        None
    }
}
```

### Règles Prometheus pour Détection Hybride

```yaml
# prometheus/rules/hybrid-zombie.yaml
groups:
  - name: hybrid_zombie_detection
    rules:
      # Détection zombie Kong
      - alert: KongZombieNode
        expr: |
          increase(kong_http_requests_total[5m]) > 100
          AND
          increase(kong_http_requests_total{code=~"5.."}[5m])
            / increase(kong_http_requests_total[5m]) > 0.9
        for: 2m
        labels:
          severity: critical
          gateway: kong
        annotations:
          summary: "Nœud zombie Kong détecté"

      # Détection zombie webMethods (le vrai de l'incident)
      - alert: WebMethodsZombieNode
        expr: |
          webmethods_package_enabled{package=~"API_.*"} == 0
          AND
          webmethods_server_running == 1
        for: 1m
        labels:
          severity: critical
          gateway: webmethods
        annotations:
          summary: "Zombie webMethods : serveur en cours mais packages API désactivés"

      # Détection d'anomalie générique
      - alert: GatewayZombieAnomaly
        expr: |
          (
            increase(gateway_requests_total[5m]) > 50
            AND
            increase(gateway_requests_success_total[5m])
              / increase(gateway_requests_total[5m]) < 0.1
          )
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Zombie potentiel : trafic élevé, taux de succès très faible"
```

---

## Comparaison des Capacités

| Capacité | STOA Gateway Natif | Hybride (Kong/wM/Apigee) |
|----------|---------------------|--------------------------|
| **Probe de disponibilité approfondie** | ✅ Contrôle total sur les vérifications | ⚠️ Dépend de l'API admin du gateway |
| **Logging Last-Gasp** | ✅ Complet avec headers | ❌ Non disponible (le gateway gère les réponses) |
| **Réponse 503 personnalisée** | ✅ Contrôle total | ❌ Le gateway retourne ses propres erreurs |
| **Détection d'anomalies** | ✅ Temps réel in-process | ⚠️ Intervalle de polling (5-30s) |
| **Error Snapshot** | ✅ Complet avec contexte requête | ⚠️ Partiel (métriques externes uniquement) |
| **Granularité des métriques** | ✅ Par requête, par vérification | ⚠️ Métriques agrégées uniquement |
| **Vitesse de remédiation** | ✅ Immédiate (même processus) | ⚠️ Détection + alerte + action |

---

## Conséquences

### Positives

- **Élimination des pannes silencieuses** — Les nœuds zombies sont détectés et retirés de la rotation
- **Détection d'incidents plus rapide** — De 15 minutes (incident) à < 2 minutes (cible)
- **Signaux de dégradation clairs** — 503 + headers vs 500 cryptiques
- **Débogage accéléré** — Les Error Snapshots capturent le contexte automatiquement
- **Compatible avec l'infrastructure existante** — Pas de changements sur les load balancers requis
- **Support hybride** — Surveille les gateways tiers via des adaptateurs

### Négatives

- **Complexité accrue des probes** — Plus de vérifications = plus de faux positifs potentiels
- **Surcharge de surveillance supplémentaire** — Plus de métriques, plus d'alertes à régler
- **Limitations du mode hybride** — Ne peut pas égaler les capacités natives
- **Maintenance des adaptateurs** — Chaque type de gateway nécessite un code d'adaptateur spécifique

### Atténuations

| Risque | Atténuation |
|--------|-------------|
| Faux positifs | Seuils configurables, `failureThreshold: 2` |
| Cascades de timeout de probe | Timeouts indépendants par vérification, circuit breaker |
| Dérive des adaptateurs | Épinglage de version, auto-vérification de santé de l'adaptateur |
| Fatigue d'alerte | Niveaux de sévérité, groupement intelligent, liens vers runbooks |

---

## Phases d'Implémentation

| Phase | Scope | Calendrier |
|-------|-------|-----------|
| **Phase 1** | Probe de disponibilité approfondie dans stoa-gateway | T1 2026 |
| **Phase 2** | Logging last-gasp + réponses 503 | T1 2026 |
| **Phase 3** | Config déploiement K8s + PDB | T1 2026 |
| **Phase 4** | Intégration Error Snapshot (lien ADR-023) | T2 2026 |
| **Phase 5** | Adaptateur Kong | T2 2026 |
| **Phase 6** | Adaptateur webMethods | T2 2026 |
| **Phase 7** | Adaptateurs Apigee + OpenMetrics générique | T3 2026 |

---

## Références

- [Envoy Outlier Detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier) — Patterns de health checking passif
- [Kubernetes Probes Best Practices](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) — Documentation officielle K8s
- [ADR-023 : Observabilité Zéro Angle Mort](./adr-023-zero-blind-spot-observability.md) — Framework Error Snapshot
- [ADR-024 : Architecture Gateway Unifiée](./adr-024-gateway-unified-modes.md) — Modes gateway (sidecar, proxy, etc.)
- [Kong Admin API Reference](https://docs.konghq.com/gateway/latest/admin-api/) — Endpoints de santé Kong
- [webMethods Integration Server Built-In Services](https://documentation.softwareag.com/) — Services d'administration IS

---

## Journal des Décisions

| Date | Décision | Auteur |
|------|----------|--------|
| 2026-01-26 | ADR créé sur la base d'une analyse d'incident réel | CAB-957 |
