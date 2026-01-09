---
sidebar_position: 1
---

# Configuration Reference

Complete configuration reference for STOA Platform.

## Control Plane Configuration

### Environment Variables

```bash
# Server
STOA_HOST=0.0.0.0
STOA_PORT=8080
STOA_BASE_URL=https://api.gostoa.dev

# Database
STOA_DB_HOST=postgres
STOA_DB_PORT=5432
STOA_DB_NAME=stoa
STOA_DB_USER=stoa
STOA_DB_PASSWORD=secret

# Keycloak
STOA_KEYCLOAK_URL=https://auth.gostoa.dev
STOA_KEYCLOAK_ADMIN_USER=admin
STOA_KEYCLOAK_ADMIN_PASSWORD=secret
STOA_KEYCLOAK_REALM=master

# ArgoCD
STOA_ARGOCD_URL=https://argocd.gostoa.dev
STOA_ARGOCD_TOKEN=secret
STOA_ARGOCD_NAMESPACE=argocd

# AWX
STOA_AWX_URL=https://awx.gostoa.dev
STOA_AWX_TOKEN=secret
STOA_AWX_ORGANIZATION=stoa

# Kong
STOA_KONG_ADMIN_URL=http://kong-admin:8001
STOA_KONG_ADMIN_TOKEN=secret
STOA_KONG_GATEWAY_URL=https://gateway.gostoa.dev

# Redis
STOA_REDIS_HOST=redis
STOA_REDIS_PORT=6379
STOA_REDIS_PASSWORD=secret

# Logging
STOA_LOG_LEVEL=info
STOA_LOG_FORMAT=json

# Metrics
STOA_METRICS_ENABLED=true
STOA_METRICS_PORT=9090
```

### Helm Values

```yaml
# values.yaml for Control Plane
controlPlane:
  replicas: 3

  image:
    repository: stoaplatform/control-plane
    tag: v0.1.0
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
      - host: api.gostoa.dev
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-tls
        hosts:
          - api.gostoa.dev

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
    hostname: auth.gostoa.dev

argocd:
  enabled: true
  server:
    ingress:
      enabled: true
      hostname: argocd.gostoa.dev

awx:
  enabled: true
  replicas: 2

  postgres:
    enabled: true
    persistence:
      size: 20Gi

  ingress:
    enabled: true
    hostname: awx.gostoa.dev

redis:
  enabled: true
  auth:
    enabled: true
    password: changeme

  master:
    persistence:
      enabled: true
      size: 10Gi
```

## Tenant Configuration

### Tenant Spec

```yaml
apiVersion: stoa.io/v1
kind: Tenant
metadata:
  name: acme
spec:
  tier: starter

  adminEmail: admin@acme.com

  region: us-east-1

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
      domain: acme.gostoa.dev
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
      issuerUrl: https://auth.gostoa.dev/realms/acme

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
apiVersion: stoa.io/v1
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
      issuer: https://auth.gostoa.dev/realms/acme
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

  caching:
    enabled: true
    ttl: 300
    methods: [GET]

  plugins:
    - name: request-transformer
      config:
        add:
          headers:
            - X-Tenant-ID:acme

    - name: response-transformer
      config:
        remove:
          headers:
            - X-Internal-Secret
```

## Kong Configuration

### Kong Gateway Settings

```yaml
# Kong Helm values per tenant
kong:
  replicas: 2

  image:
    repository: kong
    tag: "3.5"

  env:
    database: "off"
    declarative_config: /kong/declarative/kong.yaml
    plugins: bundled,oidc,rate-limiting

    # Proxy
    proxy_listen: 0.0.0.0:8000
    proxy_access_log: /dev/stdout
    proxy_error_log: /dev/stderr

    # Admin API
    admin_listen: 127.0.0.1:8001
    admin_access_log: /dev/stdout
    admin_error_log: /dev/stderr

  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
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
          stoa.io/tenant-id: acme
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx

  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: TCP
      port: 53
  - to:
    - podSelector: {}
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-acme
  labels:
    stoa.io/tenant-id: acme
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
            "expr": "rate(stoa_api_requests_total{tenant=\"acme\"}[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(stoa_api_errors_total{tenant=\"acme\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Logging Configuration

### Fluentd Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: stoa-system
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/tenant-*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      format json
    </source>

    <filter kubernetes.**>
      @type record_transformer
      <record>
        tenant ${record["kubernetes"]["namespace_name"].split("-")[1]}
      </record>
    </filter>

    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      index_name stoa-logs
    </match>
```

---

🚧 **Coming Soon**: Backup configuration, disaster recovery setup, and performance tuning guides.
