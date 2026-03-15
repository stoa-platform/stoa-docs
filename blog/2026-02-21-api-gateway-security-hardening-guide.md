---
slug: api-gateway-security-hardening-guide
title: "API Gateway Hardening: 10-Step Production Checklist"
description: "Going to production? TLS termination, CORS lockdown, rate limiting, SSRF protection, and audit logging in a battle-tested 10-step hardening guide."
authors: [stoa-team]
tags: [tutorial, security, api-gateway]
keywords:
  - open source api gateway security hardening
  - api gateway security checklist production
  - api gateway tls cors rate limiting
  - api gateway ssrf protection
  - secure api gateway deployment
---
<!-- last verified: 2026-02 -->

Running an API gateway in production requires more than deploying with default settings. An insecure gateway exposes every backend service to attack, leaks sensitive data, and creates compliance nightmares. This 10-step security hardening checklist covers the critical controls you need before production deployment. Each step includes concrete configuration examples and verification commands.

<!-- truncate -->

## Why Gateway Security Matters

Your API gateway is the single entry point for all external traffic. A misconfigured gateway can expose:
- Internal services to unauthorized access
- Customer data to cross-origin leaks
- Backend systems to denial-of-service attacks
- Metadata about your infrastructure architecture

The difference between a secure gateway and an exploitable one often comes down to 10 configuration decisions. Let's walk through each one.

## Step 1: Enforce TLS Everywhere

**Minimum TLS 1.2, prefer TLS 1.3.** TLS 1.0 and 1.1 have known vulnerabilities and are deprecated by major browsers.

### Configuration Example (nginx)

```nginx
server {
    listen 443 ssl http2;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # HSTS: force HTTPS for 1 year
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Redirect HTTP to HTTPS
    error_page 497 https://$host$request_uri;
}
```

### For Kubernetes Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-secret
```

### Verification

```bash
# Test TLS version enforcement
openssl s_client -connect api.example.com:443 -tls1_1 2>&1 | grep -i "handshake failure"

# Should show: handshake failure (TLS 1.1 rejected)

# Check HSTS header
curl -I https://api.example.com | grep -i "strict-transport-security"

# Should show: Strict-Transport-Security: max-age=31536000
```

## Step 2: Configure CORS Properly

**Never use `Access-Control-Allow-Origin: *` in production.** Wildcard CORS allows any website to make authenticated requests to your API, bypassing the browser's same-origin policy.

### Bad (insecure)

```yaml
cors:
  allowOrigins: ["*"]  # Allows ANY website to call your API
  allowCredentials: true  # Combined with *, this is a critical vulnerability
```

### Good (explicit allowlist)

```yaml
cors:
  allowOrigins:
    - https://app.example.com
    - https://admin.example.com
  allowMethods: ["GET", "POST", "PUT", "DELETE"]
  allowHeaders: ["Authorization", "Content-Type"]
  exposeHeaders: ["X-Request-ID"]
  allowCredentials: true
  maxAge: 3600
```

### STOA Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: customer-api
spec:
  endpoint: https://backend.example.com/api/customers
  cors:
    allowOrigins:
      - ${PORTAL_URL}
      - ${CONSOLE_URL}
    allowCredentials: true
```

### Verification

```bash
# Test CORS enforcement
curl -H "Origin: https://malicious.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://api.example.com/v1/users

# Should NOT include: Access-Control-Allow-Origin: https://malicious.com

# Test allowed origin
curl -H "Origin: https://app.example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://api.example.com/v1/users

# Should include: Access-Control-Allow-Origin: https://app.example.com
```

Learn more about secure authentication patterns in our [Authentication Guide](/docs/guides/authentication).

## Step 3: Set Rate Limits Per Consumer

**Rate limiting prevents abuse and DDoS attacks.** Always apply limits at both the global and per-consumer level.

### Three-Tier Rate Limiting Strategy

```yaml
# Global: protect infrastructure from total overload
global:
  requestsPerSecond: 1000

# Per-endpoint: protect expensive operations
endpoints:
  - path: /v1/search
    requestsPerMinute: 100
  - path: /v1/export
    requestsPerHour: 10

# Per-consumer: fair usage
consumers:
  - id: free-tier
    requestsPerMinute: 60
  - id: pro-tier
    requestsPerMinute: 600
  - id: enterprise-tier
    requestsPerMinute: 6000
```

### Kong Example

```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 60
      policy: local
      fault_tolerant: true
      hide_client_headers: false
```

### STOA Example

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Policy
metadata:
  name: customer-api-rate-limit
spec:
  type: rate_limit
  config:
    maxRequests: 100
    windowSeconds: 60
    scope: consumer  # Per API key
```

### Verification

```bash
# Test rate limit enforcement
for i in {1..65}; do
  curl -H "X-API-Key: test-key" https://api.example.com/v1/users
done

# Request 61+ should return: 429 Too Many Requests
```

## Step 4: Block SSRF Vectors

**Server-Side Request Forgery (SSRF) allows attackers to probe internal networks.** Block private IP ranges in proxy targets.

### Blocked IP Ranges (RFC 1918 + special-use)

```
10.0.0.0/8          # Private network
172.16.0.0/12       # Private network
192.168.0.0/16      # Private network
127.0.0.0/8         # Loopback
169.254.0.0/16      # Link-local
::1/128             # IPv6 loopback
fc00::/7            # IPv6 unique local addresses
fe80::/10           # IPv6 link-local
```

### Implementation (Rust example from STOA Gateway)

```rust
fn is_blocked_url(url: &str) -> bool {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?;

    // Block IP addresses
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ipv4) => {
                ipv4.is_private() ||
                ipv4.is_loopback() ||
                ipv4.is_link_local() ||
                ipv4.octets()[0] == 169 && ipv4.octets()[1] == 254
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback() ||
                ipv6.is_unicast_link_local() ||
                (ipv6.segments()[0] & 0xfe00) == 0xfc00  // ULA
            }
        };
    }

    // Block localhost variations
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}
```

### Nginx Example

```nginx
# Use a resolver that doesn't resolve private IPs
resolver 1.1.1.1 8.8.8.8 valid=300s;

# Deny proxy to private ranges
geo $blocked_backend {
    default 0;
    10.0.0.0/8 1;
    172.16.0.0/12 1;
    192.168.0.0/16 1;
    127.0.0.0/8 1;
}

if ($blocked_backend) {
    return 403 "Blocked: internal IP range";
}
```

### Verification

```bash
# Test SSRF protection
curl -X POST https://api.example.com/v1/proxy \
     -H "Content-Type: application/json" \
     -d '{"target": "http://169.254.169.254/latest/meta-data/"}'

# Should return: 403 Forbidden or 400 Bad Request
```

Read more about SSRF and API security in [API Security Checklist for Solo Developers](/blog/api-security-checklist-solo-dev).

## Step 5: Add Security Headers

**Security headers protect against XSS, clickjacking, and MIME sniffing attacks.** Apply these headers to every response.

### Required Headers

```nginx
# Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# Content Security Policy (adjust for your needs)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'" always;

# Referrer policy (hide sensitive URLs)
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Permissions policy (disable unnecessary features)
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### STOA Gateway (Rust middleware)

```rust
pub fn security_headers_layer() -> ServiceBuilder<Stack<MapResponseLayer<impl Fn(Response) -> Response + Clone>>> {
    ServiceBuilder::new().map_response(|mut response: Response| {
        let headers = response.headers_mut();
        headers.insert("X-Content-Type-Options", HeaderValue::from_static("nosniff"));
        headers.insert("X-Frame-Options", HeaderValue::from_static("DENY"));
        headers.insert("Referrer-Policy", HeaderValue::from_static("strict-origin-when-cross-origin"));
        response
    })
}
```

### Verification

```bash
curl -I https://api.example.com | grep -E "X-Content-Type-Options|X-Frame-Options|Content-Security-Policy"

# Should show all three headers
```

## Step 6: Enable mTLS for Service-to-Service

**Mutual TLS (mTLS) ensures both client and server authenticate each other.** Critical for zero-trust architectures.

### Certificate Setup

```bash
# Generate CA certificate (one-time)
openssl req -x509 -newkey rsa:4096 -keyout ca-key.pem -out ca-cert.pem -days 3650 -nodes

# Generate client certificate
openssl req -newkey rsa:4096 -keyout client-key.pem -out client-csr.pem -nodes
openssl x509 -req -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem -days 365
```

### Nginx mTLS Configuration

```nginx
server {
    listen 443 ssl;

    ssl_certificate /etc/nginx/certs/server-cert.pem;
    ssl_certificate_key /etc/nginx/certs/server-key.pem;

    # Require client certificate
    ssl_client_certificate /etc/nginx/certs/ca-cert.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location /internal/ {
        # Only reachable with valid client cert
        proxy_pass http://backend;
    }
}
```

### Kubernetes Service Mesh (Istio example)

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: mtls-strict
spec:
  mtls:
    mode: STRICT  # Reject non-mTLS traffic
```

Learn more about mTLS configuration in our [mTLS Configuration Guide](/docs/guides/mtls-configuration).

## Step 7: Implement API Key Rotation

**API keys eventually leak.** Scheduled rotation with grace periods prevents service disruption.

### Rotation Strategy

```yaml
# Dual-key grace period pattern
apiKeys:
  - key: key_v2_abc123...
    status: active
    createdAt: 2026-02-01
    expiresAt: 2026-03-01
  - key: key_v1_def456...
    status: deprecated  # Still works but marked for removal
    createdAt: 2026-01-01
    expiresAt: 2026-02-15  # Grace period
```

### Automated Rotation Script

```bash
#!/bin/bash
# rotate-api-keys.sh — run monthly via cron

# Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Store in secrets manager
kubectl create secret generic api-keys \
  --from-literal=current="$NEW_KEY" \
  --from-literal=previous="$OLD_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# Notify consumers (14-day grace period)
send-rotation-notice "$NEW_KEY" --grace-period=14d
```

### Consumer Migration

```bash
# Test new key before old one expires
curl -H "X-API-Key: key_v2_abc123..." https://api.example.com/v1/health

# Update application config
kubectl set env deployment/app API_KEY=key_v2_abc123...
```

Read our [API Key Rotation Guide](/docs/guides/api-key-rotation) for detailed procedures.

## Step 8: Set Up Audit Logging

**Every request must be logged with an immutable audit trail.** Essential for incident response and compliance.

### Minimum Log Fields

```json
{
  "timestamp": "2026-02-15T14:23:45Z",
  "request_id": "req_abc123",
  "method": "POST",
  "path": "/v1/users",
  "consumer_id": "app_xyz789",
  "source_ip": "203.0.113.42",
  "status_code": 201,
  "response_time_ms": 145,
  "user_agent": "MyApp/1.2.3",
  "bytes_sent": 1024,
  "bytes_received": 256
}
```

### Fluent Bit Pipeline (Kubernetes)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
data:
  fluent-bit.conf: |
    [INPUT]
        Name tail
        Path /var/log/gateway/*.log
        Parser json
        Tag gateway.access

    [FILTER]
        Name kubernetes
        Match gateway.*
        Merge_Log On

    [OUTPUT]
        Name opensearch
        Match gateway.*
        Host opensearch.logging.svc
        Port 9200
        Index gateway-logs
        Type _doc
```

### STOA Gateway Audit Middleware

```rust
pub async fn audit_middleware(
    State(audit_svc): State<Arc<AuditService>>,
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    audit_svc.log(AuditEvent {
        timestamp: Utc::now(),
        method: method.to_string(),
        path,
        status: response.status().as_u16(),
        duration_ms: start.elapsed().as_millis() as u64,
    }).await;

    response
}
```

### Verification

```bash
# Trigger a request
curl -H "X-API-Key: test" https://api.example.com/v1/users

# Check logs (OpenSearch example)
curl -u admin:password https://opensearch.example.com/gateway-logs/_search?q=path:/v1/users

# Should return the logged request
```

Learn more about observability setup in our [Observability Guide](/docs/guides/observability).

## Step 9: Run Container Security

**Non-root users, read-only filesystems, and dropped capabilities reduce attack surface.**

### Secure Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: gateway
          image: ghcr.io/example/api-gateway:v1.2.3
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /var/cache
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
```

### Dockerfile Best Practices

```dockerfile
# Multi-stage build
FROM rust:1.85 AS builder
WORKDIR /build
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /build/target/release/gateway /gateway

# Non-root user (distroless default UID 65532)
USER nonroot:nonroot

ENTRYPOINT ["/gateway"]
```

### Verification

```bash
# Check pod security context
kubectl get pod api-gateway-xyz -o jsonpath='{.spec.securityContext}'

# Should show: runAsNonRoot: true, runAsUser: 1000

# Check container capabilities
kubectl get pod api-gateway-xyz -o jsonpath='{.spec.containers[0].securityContext.capabilities}'

# Should show: drop: [ALL]
```

## Step 10: Automate Security Scanning

**Security is continuous, not one-time.** Automate SAST, dependency audits, and container scanning in CI.

### GitHub Actions Security Pipeline

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Secret scanning
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      # SAST for Python
      - name: Bandit
        run: |
          pip install bandit
          bandit -r src/ -ll -f json -o bandit-report.json

      # Dependency audit
      - name: pip-audit
        run: |
          pip install pip-audit
          pip-audit --require-hashes --desc

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Build image
      - name: Build
        run: docker build -t gateway:test .

      # Scan for vulnerabilities
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: gateway:test
          severity: CRITICAL,HIGH
          exit-code: 1  # Fail CI on findings
```

### Pre-Commit Hooks

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ['-ll']
```

### Weekly Dependency Audit (Dependabot alternative)

```yaml
# .github/workflows/dependency-audit.yml
name: Weekly Dependency Audit

on:
  schedule:
    - cron: '0 2 * * 1'  # Monday 2 AM

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Rust audit
        run: cargo audit

      - name: Python audit
        run: |
          pip install pip-audit safety
          pip-audit
          safety check

      - name: NPM audit
        run: npm audit --audit-level=moderate
```

## Verification Checklist

Run this checklist before production deployment:

| Step | Verification Command | Expected Result |
|------|---------------------|-----------------|
| 1. TLS | `openssl s_client -connect api.example.com:443 -tls1_1` | Handshake failure |
| 2. CORS | `curl -H "Origin: https://evil.com" -I https://api.example.com` | No CORS headers for evil.com |
| 3. Rate Limit | 61 requests in 60s with same key | 429 Too Many Requests |
| 4. SSRF | `curl -d '{"target":"http://169.254.169.254"}' https://api.example.com/proxy` | 403 Forbidden |
| 5. Headers | `curl -I https://api.example.com` | X-Content-Type-Options, X-Frame-Options present |
| 6. mTLS | `curl https://api.example.com/internal/` without client cert | Connection rejected |
| 7. Key Rotation | Use deprecated key after expiry | 401 Unauthorized |
| 8. Audit Logs | Trigger request, check logs | Request logged with all fields |
| 9. Container | `kubectl get pod -o yaml` | runAsNonRoot: true, capabilities dropped |
| 10. Scanning | Push to main | CI security checks pass |

## Next Steps

After completing this checklist:

1. **Document your threat model**: What assets are you protecting? What are the likely attack vectors?
2. **Set up monitoring**: Alert on 429 responses (rate limit hits), 403s (SSRF blocks), and missing audit logs
3. **Schedule penetration testing**: Hire external security researchers or run bug bounty programs
4. **Review access logs weekly**: Look for anomalies (geographic, timing, API usage patterns)
5. **Automate compliance checks**: Use tools like [Open Policy Agent](https://www.openpolicyagent.org/) to enforce security policies

For European regulatory requirements (DORA, NIS2), see our [DORA & NIS2 API Gateway Compliance Guide](/blog/dora-nis2-api-gateway-compliance).

For multi-tenant security patterns, read [Multi-Tenant API Gateway on Kubernetes](/blog/multi-tenant-api-gateway-kubernetes).

For detailed security configuration in STOA Platform, consult the [Security Configuration Reference](/docs/reference/security-configuration) and [Admin Security Hardening Guide](/docs/admin/security-hardening).

## FAQ

### How often should I rotate API keys?

**Every 90 days for production systems.** Critical services (payments, healthcare) should rotate monthly. Always use a 14-day grace period where both old and new keys work to allow consumers to migrate.

### Can I use self-signed certificates for mTLS?

**Yes, for internal service-to-service traffic.** Self-signed certs are fine as long as you control the CA and all services trust it. For external-facing APIs, use certificates from a trusted public CA (Let's Encrypt, DigiCert).

### What's the difference between global and per-consumer rate limits?

**Global limits protect infrastructure; per-consumer limits ensure fair usage.** Set global limits based on your server capacity (e.g., 10,000 req/s). Set per-consumer limits based on your pricing tiers (e.g., 60 req/min for free tier, 6,000 req/min for enterprise).

## Conclusion

Security hardening is not a one-time task. Threats evolve, dependencies get vulnerabilities, and configurations drift. This 10-step checklist provides a strong foundation, but you must continuously monitor, audit, and update your gateway.

The most secure gateway is one that follows the principle of least privilege: only the features you need, only the access you require, and everything else denied by default.

For a comprehensive overview of open-source API gateway options and their security features, read our [Open Source API Gateway Guide 2026](/blog/open-source-api-gateway-2026).

Want to see these security controls in action? STOA Platform implements all 10 steps out of the box. Learn more in our [Security Compliance documentation](/docs/enterprise/security-compliance) or explore the [Gateway Concepts](/docs/concepts/gateway).


---

## Ready to bridge your legacy APIs to AI agents?

STOA is open-source (Apache 2.0) and free to try.

- **[Quick Start Guide →](/docs/guides/quickstart)** — Get STOA running locally in 5 minutes
- **[GitHub →](https://github.com/stoa-platform/stoa)** — Star us, fork us, contribute
- **[Discord →](https://discord.gostoa.dev)** — Join the community
