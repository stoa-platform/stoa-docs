---
sidebar_position: 1
title: "Configuration Reference"
description: "Complete configuration reference for STOA Platform — environment variables, Helm values, and runtime settings for all components."
keywords: [configuration, reference, environment variables, Helm, settings]
---

# Configuration Reference

Complete configuration reference for STOA Platform.

## Control Plane API

### Environment Variables

```bash
# Server
STOA_HOST=0.0.0.0
STOA_PORT=8080
STOA_BASE_URL=https://api.<YOUR_DOMAIN>

# Database
STOA_DB_HOST=postgres
STOA_DB_PORT=5432
STOA_DB_NAME=stoa
STOA_DB_USER=stoa
STOA_DB_PASSWORD=secret

# Keycloak
STOA_KEYCLOAK_URL=https://auth.<YOUR_DOMAIN>
STOA_KEYCLOAK_ADMIN_USER=admin
STOA_KEYCLOAK_ADMIN_PASSWORD=secret
STOA_KEYCLOAK_REALM=master

# ArgoCD (optional — for GitOps integration)
STOA_ARGOCD_URL=https://argocd.<YOUR_DOMAIN>
STOA_ARGOCD_TOKEN=secret
STOA_ARGOCD_NAMESPACE=argocd

# Logging
STOA_LOG_LEVEL=info
STOA_LOG_FORMAT=json

# Metrics
STOA_METRICS_ENABLED=true
STOA_METRICS_PORT=9090

# OpenSearch (audit trail)
OPENSEARCH_URL=https://opensearch:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=secret
OPENSEARCH_VERIFY_CERTS=false
```

### Helm Values

```yaml
# values.yaml for Control Plane
controlPlane:
  replicas: 3

  image:
    repository: ghcr.io/stoa-platform/control-plane-api
    tag: latest
    pullPolicy: IfNotPresent

  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi

  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: api.<YOUR_DOMAIN>
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-tls
        hosts:
          - api.<YOUR_DOMAIN>

database:
  enabled: true
  image:
    repository: postgres
    tag: "15"

  persistence:
    enabled: true
    size: 20Gi
    storageClass: standard

keycloak:
  enabled: true
  replicas: 2

  database:
    vendor: postgres
    hostname: postgres
    database: keycloak

  ingress:
    enabled: true
    hostname: auth.<YOUR_DOMAIN>

argocd:
  enabled: true
  server:
    ingress:
      enabled: true
      hostname: argocd.<YOUR_DOMAIN>
```

## STOA Gateway (Rust)

### Environment Variables

```bash
# Server
STOA_GATEWAY_HOST=0.0.0.0
STOA_GATEWAY_PORT=8080
STOA_GATEWAY_MODE=edge-mcp     # edge-mcp | sidecar | proxy | shadow

# Control Plane connection
CONTROL_PLANE_URL=https://api.<YOUR_DOMAIN>
CONTROL_PLANE_API_KEY=secret

# Authentication
STOA_AUTH_ISSUER=https://auth.<YOUR_DOMAIN>/realms/stoa
STOA_AUTH_AUDIENCE=stoa-mcp-gateway

# Admin API
STOA_ADMIN_ENABLED=true
STOA_ADMIN_API_TOKEN=secret

# Rate limiting
STOA_RATE_LIMIT_DEFAULT=100     # Requests per minute per consumer
STOA_QUOTA_ENABLED=true

# mTLS (RFC 8705)
STOA_MTLS_ENABLED=false
STOA_MTLS_REQUIRE_BINDING=true
STOA_MTLS_TRUSTED_PROXIES=      # Comma-separated CIDRs
STOA_MTLS_ALLOWED_ISSUERS=      # Comma-separated issuer DNs

# Circuit breaker
STOA_CB_FAILURE_THRESHOLD=5
STOA_CB_RECOVERY_TIMEOUT=30     # Seconds

# Logging
RUST_LOG=info                    # trace | debug | info | warn | error
STOA_ACCESS_LOG_ENABLED=true

# Kafka (optional — for metering)
KAFKA_BROKERS=redpanda:9092
KAFKA_TOPIC=stoa-events
```

### Helm Values

```yaml
stoaGateway:
  replicas: 2

  image:
    repository: ghcr.io/stoa-platform/stoa-gateway
    tag: latest
    pullPolicy: Always

  mode: edge-mcp

  resources:
    requests:
      cpu: 250m
      memory: 128Mi
    limits:
      cpu: 1000m
      memory: 512Mi

  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: mcp.<YOUR_DOMAIN>
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: gateway-tls
        hosts:
          - mcp.<YOUR_DOMAIN>

  serviceMonitor:
    enabled: true
    interval: 15s

  admin:
    enabled: true

  sidecar:
    enabled: false
    mode: log-only
    decisionFormat: opa-v1
```

## Tenant Configuration

### Tenant Spec

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tenant
metadata:
  name: acme
spec:
  tier: starter

  adminEmail: admin@acme.com

  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 4000m
      memory: 8Gi

  networking:
    gateway:
      replicas: 2
      domain: acme.<YOUR_DOMAIN>
      tls:
        enabled: true
        issuer: letsencrypt-prod

    allowedCIDRs:
      - 0.0.0.0/0

    rateLimits:
      requestsPerSecond: 100
      requestsPerMinute: 5000

  authentication:
    keycloak:
      realm: acme
      clientId: acme-gateway
      issuerUrl: https://auth.<YOUR_DOMAIN>/realms/acme

  storage:
    persistence:
      enabled: true
      size: 50Gi
      storageClass: fast-ssd

  monitoring:
    enabled: true
    retention: 30d

  backup:
    enabled: true
    schedule: "0 2 * * *"
    retention: 30
```

## API Configuration

### API Spec

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: API
metadata:
  name: payment-api
  namespace: tenant-acme
spec:
  displayName: Payment API
  description: Payment processing API
  version: v1

  upstream:
    url: https://api.payments.example.com
    scheme: https
    connectTimeout: 5000
    readTimeout: 30000
    retries: 3

  paths:
    - path: /payments
      methods: [GET, POST]
    - path: /payments/{id}
      methods: [GET, PATCH, DELETE]

  authentication:
    enabled: true
    type: oidc
    config:
      issuer: https://auth.<YOUR_DOMAIN>/realms/acme
      scopes: [openid, api:read, api:write]

  rateLimiting:
    enabled: true
    requestsPerHour: 1000
    burstSize: 50

  cors:
    enabled: true
    allowOrigins: ["*"]
    allowMethods: [GET, POST, PATCH, DELETE]
    allowHeaders: [Authorization, Content-Type]
```

## Security Configuration

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-acme
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: stoa-system
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx

  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  - to:
    - podSelector: {}
```

### Pod Security Standards

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

## Monitoring Configuration

### Prometheus ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: stoa-control-plane
  namespace: stoa-system
spec:
  selector:
    matchLabels:
      app: stoa-control-plane
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "STOA Tenant Metrics",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(stoa_http_requests_total{tenant=\"acme\"}[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(stoa_http_requests_total{status=~\"5..\",tenant=\"acme\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Logging Configuration

### Fluent Bit DaemonSet

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    spec:
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.2
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

### Fluent Bit Configuration

```ini
[INPUT]
    Name              tail
    Path              /var/log/containers/stoa-*.log
    Parser            cri
    Tag               kube.*
    Refresh_Interval  5

[FILTER]
    Name              kubernetes
    Match             kube.*
    Merge_Log         On

[OUTPUT]
    Name              opensearch
    Match             kube.*
    Host              opensearch
    Port              9200
    Index             stoa-logs
    HTTP_User         admin
    HTTP_Passwd       ${OPENSEARCH_PASSWORD}
    tls               Off
    Suppress_Type_Name On
```

## Related

- [Installation Guide](/docs/admin/installation) -- Helm chart deployment
- [Security Configuration](/docs/reference/security-configuration) -- JWT, CORS, SSE limits
- [Monitoring & Alerting](/docs/admin/monitoring) -- Prometheus setup
- [mTLS Configuration](/docs/guides/mtls-configuration) -- Certificate-bound tokens
- [Backup & Recovery](/docs/admin/backup-recovery) -- Backup procedures
