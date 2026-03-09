---
slug: api-gateway-security-hardening-guide
title: "Durcissement du Gateway API : Checklist de Production en 10 Étapes"
description: "Passage en production ? TLS, CORS, rate limiting, protection SSRF et journalisation d'audit dans un guide de durcissement éprouvé en 10 étapes."
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

Faire fonctionner un gateway API en production exige bien plus que de déployer avec des paramètres par défaut. Un gateway mal sécurisé expose chaque service backend aux attaques, laisse fuiter des données sensibles et crée des cauchemars de conformité. Cette checklist de durcissement en 10 étapes couvre les contrôles critiques à mettre en place avant tout déploiement en production. Chaque étape comprend des exemples de configuration concrets et des commandes de vérification.

<!-- truncate -->

## Pourquoi la sécurité du gateway est essentielle

Votre gateway API est le point d'entrée unique pour tout le trafic externe. Un gateway mal configuré peut exposer :
- Des services internes à des accès non autorisés
- Les données clients à des fuites cross-origin
- Les systèmes backend à des attaques par déni de service
- Des métadonnées sur votre architecture d'infrastructure

La différence entre un gateway sécurisé et un gateway exploitable se résume souvent à 10 décisions de configuration. Passons-les en revue une par une.

## Étape 1 : Appliquer TLS partout

**TLS 1.2 minimum, TLS 1.3 de préférence.** TLS 1.0 et 1.1 présentent des vulnérabilités connues et sont dépréciés par les principaux navigateurs.

### Exemple de configuration (nginx)

```nginx
server {
    listen 443 ssl http2;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # HSTS : forcer HTTPS pendant 1 an
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rediriger HTTP vers HTTPS
    error_page 497 https://$host$request_uri;
}
```

### Pour Kubernetes Ingress

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

### Vérification

```bash
# Tester l'application de la version TLS
openssl s_client -connect api.example.com:443 -tls1_1 2>&1 | grep -i "handshake failure"

# Attendu : handshake failure (TLS 1.1 rejeté)

# Vérifier l'en-tête HSTS
curl -I https://api.example.com | grep -i "strict-transport-security"

# Attendu : Strict-Transport-Security: max-age=31536000
```

## Étape 2 : Configurer CORS correctement

**N'utilisez jamais `Access-Control-Allow-Origin: *` en production.** Un CORS générique permet à n'importe quel site web d'effectuer des requêtes authentifiées vers votre API, contournant la politique same-origin du navigateur.

### Mauvais (non sécurisé)

```yaml
cors:
  allowOrigins: ["*"]  # Autorise N'IMPORTE QUEL site à appeler votre API
  allowCredentials: true  # Combiné avec *, c'est une vulnérabilité critique
```

### Bon (liste blanche explicite)

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

### Exemple STOA

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

### Vérification

```bash
# Tester l'application du CORS
curl -H "Origin: https://malicious.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://api.example.com/v1/users

# Ne doit PAS inclure : Access-Control-Allow-Origin: https://malicious.com

# Tester l'origine autorisée
curl -H "Origin: https://app.example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://api.example.com/v1/users

# Doit inclure : Access-Control-Allow-Origin: https://app.example.com
```

Pour en savoir plus sur les patterns d'authentification sécurisée, consultez notre [Guide d'authentification](/docs/guides/authentication).

## Étape 3 : Définir des limites de débit par consommateur

**Le rate limiting prévient les abus et les attaques DDoS.** Appliquez toujours des limites au niveau global et par consommateur.

### Stratégie de rate limiting à trois niveaux

```yaml
# Global : protéger l'infrastructure d'une surcharge totale
global:
  requestsPerSecond: 1000

# Par endpoint : protéger les opérations coûteuses
endpoints:
  - path: /v1/search
    requestsPerMinute: 100
  - path: /v1/export
    requestsPerHour: 10

# Par consommateur : usage équitable
consumers:
  - id: free-tier
    requestsPerMinute: 60
  - id: pro-tier
    requestsPerMinute: 600
  - id: enterprise-tier
    requestsPerMinute: 6000
```

### Exemple Kong

```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 60
      policy: local
      fault_tolerant: true
      hide_client_headers: false
```

### Exemple STOA

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
    scope: consumer  # Par clé API
```

### Vérification

```bash
# Tester l'application du rate limit
for i in {1..65}; do
  curl -H "X-API-Key: test-key" https://api.example.com/v1/users
done

# La requête 61+ doit retourner : 429 Too Many Requests
```

## Étape 4 : Bloquer les vecteurs SSRF

**Le Server-Side Request Forgery (SSRF) permet aux attaquants de sonder les réseaux internes.** Bloquez les plages IP privées dans les cibles de proxy.

### Plages IP bloquées (RFC 1918 + usage spécial)

```
10.0.0.0/8          # Réseau privé
172.16.0.0/12       # Réseau privé
192.168.0.0/16      # Réseau privé
127.0.0.0/8         # Loopback
169.254.0.0/16      # Link-local
::1/128             # Loopback IPv6
fc00::/7            # Adresses locales uniques IPv6
fe80::/10           # Link-local IPv6
```

### Implémentation (exemple Rust depuis STOA Gateway)

```rust
fn is_blocked_url(url: &str) -> bool {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?;

    // Bloquer les adresses IP
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

    // Bloquer les variantes de localhost
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}
```

### Exemple Nginx

```nginx
# Utiliser un résolveur qui ne résout pas les IP privées
resolver 1.1.1.1 8.8.8.8 valid=300s;

# Refuser le proxy vers les plages privées
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

### Vérification

```bash
# Tester la protection SSRF
curl -X POST https://api.example.com/v1/proxy \
     -H "Content-Type: application/json" \
     -d '{"target": "http://169.254.169.254/latest/meta-data/"}'

# Doit retourner : 403 Forbidden ou 400 Bad Request
```

Pour en savoir plus sur le SSRF et la sécurité des API, consultez [API Security Checklist for Solo Developers](/blog/api-security-checklist-solo-dev).

## Étape 5 : Ajouter des en-têtes de sécurité

**Les en-têtes de sécurité protègent contre les attaques XSS, le clickjacking et le MIME sniffing.** Appliquez ces en-têtes à chaque réponse.

### En-têtes requis

```nginx
# Empêcher le MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# Empêcher le clickjacking
add_header X-Frame-Options "DENY" always;

# Content Security Policy (à adapter selon vos besoins)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'" always;

# Referrer policy (masquer les URLs sensibles)
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Permissions policy (désactiver les fonctionnalités inutiles)
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### STOA Gateway (middleware Rust)

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

### Vérification

```bash
curl -I https://api.example.com | grep -E "X-Content-Type-Options|X-Frame-Options|Content-Security-Policy"

# Doit afficher les trois en-têtes
```

## Étape 6 : Activer mTLS pour les communications inter-services

**Le Mutual TLS (mTLS) assure que client et serveur s'authentifient mutuellement.** Indispensable pour les architectures zero trust.

### Mise en place des certificats

```bash
# Générer le certificat CA (une seule fois)
openssl req -x509 -newkey rsa:4096 -keyout ca-key.pem -out ca-cert.pem -days 3650 -nodes

# Générer le certificat client
openssl req -newkey rsa:4096 -keyout client-key.pem -out client-csr.pem -nodes
openssl x509 -req -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem -days 365
```

### Configuration mTLS Nginx

```nginx
server {
    listen 443 ssl;

    ssl_certificate /etc/nginx/certs/server-cert.pem;
    ssl_certificate_key /etc/nginx/certs/server-key.pem;

    # Exiger le certificat client
    ssl_client_certificate /etc/nginx/certs/ca-cert.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location /internal/ {
        # Accessible uniquement avec un certificat client valide
        proxy_pass http://backend;
    }
}
```

### Service Mesh Kubernetes (exemple Istio)

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: mtls-strict
spec:
  mtls:
    mode: STRICT  # Rejeter le trafic non-mTLS
```

Pour en savoir plus sur la configuration mTLS, consultez notre [Guide de configuration mTLS](/docs/guides/mtls-configuration).

## Étape 7 : Mettre en place la rotation des clés API

**Les clés API finissent toujours par fuiter.** Une rotation planifiée avec période de grâce évite les interruptions de service.

### Stratégie de rotation

```yaml
# Pattern dual-key avec période de grâce
apiKeys:
  - key: key_v2_abc123...
    status: active
    createdAt: 2026-02-01
    expiresAt: 2026-03-01
  - key: key_v1_def456...
    status: deprecated  # Fonctionne encore mais marqué pour suppression
    createdAt: 2026-01-01
    expiresAt: 2026-02-15  # Période de grâce
```

### Script de rotation automatique

```bash
#!/bin/bash
# rotate-api-keys.sh — à exécuter mensuellement via cron

# Générer une nouvelle clé
NEW_KEY=$(openssl rand -hex 32)

# Stocker dans le gestionnaire de secrets
kubectl create secret generic api-keys \
  --from-literal=current="$NEW_KEY" \
  --from-literal=previous="$OLD_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# Notifier les consommateurs (période de grâce de 14 jours)
send-rotation-notice "$NEW_KEY" --grace-period=14d
```

### Migration des consommateurs

```bash
# Tester la nouvelle clé avant l'expiration de l'ancienne
curl -H "X-API-Key: key_v2_abc123..." https://api.example.com/v1/health

# Mettre à jour la configuration applicative
kubectl set env deployment/app API_KEY=key_v2_abc123...
```

Consultez notre [Guide de rotation des clés API](/docs/guides/api-key-rotation) pour les procédures détaillées.

## Étape 8 : Configurer la journalisation d'audit

**Chaque requête doit être journalisée avec une piste d'audit immuable.** Indispensable pour la réponse aux incidents et la conformité.

### Champs minimum à journaliser

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

### Pipeline Fluent Bit (Kubernetes)

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

### Middleware d'audit STOA Gateway

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

### Vérification

```bash
# Déclencher une requête
curl -H "X-API-Key: test" https://api.example.com/v1/users

# Vérifier les logs (exemple OpenSearch)
curl -u admin:password https://opensearch.example.com/gateway-logs/_search?q=path:/v1/users

# Doit retourner la requête journalisée
```

Pour en savoir plus sur la configuration de l'observabilité, consultez notre [Guide d'observabilité](/docs/guides/observability).

## Étape 9 : Appliquer la sécurité des containers

**Utilisateurs non-root, systèmes de fichiers en lecture seule et capabilities supprimées réduisent la surface d'attaque.**

### Déploiement Kubernetes sécurisé

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

### Bonnes pratiques Dockerfile

```dockerfile
# Build multi-étapes
FROM rust:1.85 AS builder
WORKDIR /build
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /build/target/release/gateway /gateway

# Utilisateur non-root (UID 65532 par défaut dans distroless)
USER nonroot:nonroot

ENTRYPOINT ["/gateway"]
```

### Vérification

```bash
# Vérifier le contexte de sécurité du pod
kubectl get pod api-gateway-xyz -o jsonpath='{.spec.securityContext}'

# Doit afficher : runAsNonRoot: true, runAsUser: 1000

# Vérifier les capabilities du container
kubectl get pod api-gateway-xyz -o jsonpath='{.spec.containers[0].securityContext.capabilities}'

# Doit afficher : drop: [ALL]
```

## Étape 10 : Automatiser le scanning de sécurité

**La sécurité est continue, pas ponctuelle.** Automatisez le SAST, les audits de dépendances et le scanning des containers dans votre CI.

### Pipeline GitHub Actions de sécurité

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Scanning de secrets
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      # SAST Python
      - name: Bandit
        run: |
          pip install bandit
          bandit -r src/ -ll -f json -o bandit-report.json

      # Audit des dépendances
      - name: pip-audit
        run: |
          pip install pip-audit
          pip-audit --require-hashes --desc

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Construire l'image
      - name: Build
        run: docker build -t gateway:test .

      # Scanner les vulnérabilités
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: gateway:test
          severity: CRITICAL,HIGH
          exit-code: 1  # Faire échouer le CI en cas de résultats
```

### Hooks pre-commit

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

### Audit hebdomadaire des dépendances (alternative à Dependabot)

```yaml
# .github/workflows/dependency-audit.yml
name: Weekly Dependency Audit

on:
  schedule:
    - cron: '0 2 * * 1'  # Lundi 2h du matin

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

## Checklist de vérification

Exécutez cette checklist avant tout déploiement en production :

| Étape | Commande de vérification | Résultat attendu |
|-------|------------------------|-----------------|
| 1. TLS | `openssl s_client -connect api.example.com:443 -tls1_1` | Handshake failure |
| 2. CORS | `curl -H "Origin: https://evil.com" -I https://api.example.com` | Pas d'en-têtes CORS pour evil.com |
| 3. Rate Limit | 61 requêtes en 60s avec la même clé | 429 Too Many Requests |
| 4. SSRF | `curl -d '{"target":"http://169.254.169.254"}' https://api.example.com/proxy` | 403 Forbidden |
| 5. En-têtes | `curl -I https://api.example.com` | X-Content-Type-Options, X-Frame-Options présents |
| 6. mTLS | `curl https://api.example.com/internal/` sans certificat client | Connexion refusée |
| 7. Rotation de clé | Utiliser une clé dépréciée après expiration | 401 Unauthorized |
| 8. Logs d'audit | Déclencher une requête, vérifier les logs | Requête journalisée avec tous les champs |
| 9. Container | `kubectl get pod -o yaml` | runAsNonRoot: true, capabilities supprimées |
| 10. Scanning | Pousser sur main | Les vérifications de sécurité CI passent |

## Prochaines étapes

Après avoir complété cette checklist :

1. **Documentez votre modèle de menaces** : quels actifs protégez-vous ? Quels sont les vecteurs d'attaque probables ?
2. **Mettez en place du monitoring** : alertez sur les réponses 429 (dépassements de rate limit), les 403 (blocages SSRF) et l'absence de logs d'audit
3. **Planifiez des tests de pénétration** : faites appel à des chercheurs en sécurité externes ou lancez des programmes de bug bounty
4. **Reviewez les logs d'accès chaque semaine** : cherchez des anomalies (géographiques, temporelles, patterns d'usage API)
5. **Automatisez les vérifications de conformité** : utilisez des outils comme [Open Policy Agent](https://www.openpolicyagent.org/) pour appliquer les politiques de sécurité

Pour les exigences réglementaires européennes (DORA, NIS2), consultez notre [Guide de conformité DORA & NIS2 pour les gateways API](/blog/dora-nis2-api-gateway-compliance).

Pour les patterns de sécurité multi-tenant, lisez [Multi-Tenant API Gateway on Kubernetes](/blog/multi-tenant-api-gateway-kubernetes).

Pour la configuration détaillée de la sécurité dans STOA Platform, consultez la [Référence de configuration de sécurité](/docs/reference/security-configuration) et le [Guide de durcissement de sécurité](/docs/admin/security-hardening).

## FAQ

### À quelle fréquence faut-il faire la rotation des clés API ?

**Tous les 90 jours pour les systèmes en production.** Les services critiques (paiements, santé) doivent effectuer la rotation mensuellement. Utilisez toujours une période de grâce de 14 jours pendant laquelle l'ancienne et la nouvelle clé fonctionnent, pour permettre aux consommateurs de migrer.

### Peut-on utiliser des certificats auto-signés pour mTLS ?

**Oui, pour le trafic service-à-service interne.** Les certificats auto-signés conviennent tant que vous contrôlez le CA et que tous les services lui font confiance. Pour les API exposées en externe, utilisez des certificats d'une CA publique de confiance (Let's Encrypt, DigiCert).

### Quelle est la différence entre les rate limits globaux et par consommateur ?

**Les limites globales protègent l'infrastructure ; les limites par consommateur garantissent un usage équitable.** Définissez les limites globales en fonction de la capacité de vos serveurs (ex. 10 000 req/s). Définissez les limites par consommateur en fonction de vos niveaux tarifaires (ex. 60 req/min pour le tier gratuit, 6 000 req/min pour l'entreprise).

## Conclusion

Le durcissement de la sécurité n'est pas une tâche ponctuelle. Les menaces évoluent, les dépendances acquièrent des vulnérabilités et les configurations dérivent. Cette checklist en 10 étapes fournit une base solide, mais vous devez surveiller, auditer et mettre à jour votre gateway en continu.

Le gateway le plus sécurisé est celui qui suit le principe du moindre privilège : uniquement les fonctionnalités dont vous avez besoin, uniquement les accès requis, et tout le reste refusé par défaut.

Pour un aperçu complet des options de gateway API open source et de leurs fonctionnalités de sécurité, lisez notre [Guide Open Source API Gateway 2026](/blog/open-source-api-gateway-2026).

Vous souhaitez voir ces contrôles de sécurité en action ? STOA Platform les implémente tous les 10 par défaut. En savoir plus dans notre [documentation de conformité de sécurité](/docs/enterprise/security-compliance) ou explorer les [concepts du Gateway](/docs/concepts/gateway).
