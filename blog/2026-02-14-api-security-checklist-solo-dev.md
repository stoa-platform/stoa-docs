---
slug: api-security-checklist-solo-dev
title: "API Security Checklist: 10 Things Every Solo Dev Must Do"
authors: [christophe]
tags: [security, education, tutorial, api-gateway]
description: "A practical, no-budget security checklist for freelancers, indie hackers, and small teams building APIs. No enterprise tools required."
keywords: [api security checklist, developer security, api authentication, rate limiting, OWASP API, freelancer security, api best practices, secure api development, api key management, solo developer]
---

# API Security Checklist: 10 Things Every Solo Dev Must Do

You're a freelancer. You shipped an API for a client. It works. Tests pass. Invoice sent.

Six months later, the client calls: someone scraped their entire user database through your API. No rate limiting. No input validation. Default CORS headers. The API key was in the frontend JavaScript.

This happens more often than anyone admits. And it's almost always preventable with a simple checklist.

<!-- truncate -->

Here are 10 things that take less than a day total and prevent 95% of API security incidents. No enterprise budget needed. No complex tooling. Just engineering discipline.

---

## 1. Never Expose Secrets in Client-Side Code

**The rule:** API keys, tokens, and credentials must never appear in frontend code, mobile apps, or public repositories.

**Why it matters:** Browser DevTools, APK decompilation, and `View Source` make every client-side secret instantly public.

**What to do:**

```javascript
// BAD: API key in frontend
const response = await fetch('https://api.stripe.com/v1/charges', {
  headers: { 'Authorization': 'Bearer sk_live_abc123' }
});

// GOOD: Call your own backend, which holds the key
const response = await fetch('/api/create-charge', {
  method: 'POST',
  body: JSON.stringify({ amount: 1000 })
});
```

Your backend acts as a proxy. The secret never leaves the server.

**Quick win:** Search your frontend codebase for `sk_`, `api_key`, `secret`, `password`, `token`. If you find any, move them server-side today.

---

## 2. Use Short-Lived Tokens, Not Static API Keys

**The rule:** Prefer OAuth 2.0 tokens (expire in minutes/hours) over static API keys (never expire).

**Why it matters:** A leaked static key works forever. A leaked OAuth token expires and becomes useless.

**What to do:**

```
Static key lifecycle:
  Created → Used → Leaked → Exploited (forever) → Panic → Rotate → Hope

OAuth token lifecycle:
  Created → Used → Leaked → Expired (1 hour) → Attacker gets nothing
```

If you must use static API keys (some third-party services require them):
- Rotate them on a schedule (every 90 days minimum)
- Store them in environment variables, never in code
- Use a secret manager if available (even free tiers of Vault, Infisical, or Doppler)

---

## 3. Rate Limit Everything

**The rule:** Every endpoint should have a rate limit. No exceptions.

**Why it matters:** Without rate limits, a single attacker can:
- Brute-force passwords (1000 attempts/second)
- Scrape your entire database (pagination abuse)
- Run up your cloud bill (DDoS-by-billing)
- Exhaust your third-party API quotas

**What to do:**

```nginx
# nginx: 10 requests per second per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

Or in your application code:

```python
# FastAPI with slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/users")
@limiter.limit("30/minute")
async def list_users(request: Request):
    ...
```

**Recommended limits:**
| Endpoint Type | Limit | Why |
|--------------|-------|-----|
| Login/Auth | 5/minute | Brute-force prevention |
| Public read | 60/minute | Scraping prevention |
| Write/Create | 10/minute | Abuse prevention |
| Admin | 30/minute | Safety net |

---

## 4. Validate Every Input (Yes, Every Single One)

**The rule:** Never trust data from the client. Validate type, length, format, and range on the server.

**Why it matters:** SQL injection, XSS, command injection, and path traversal all start with unvalidated input.

**What to do:**

```python
# BAD: Trust the client
@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    return db.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
    # user_id = "1' OR '1'='1" → returns ALL users

# GOOD: Validate + parameterize
@app.get("/api/users/{user_id}")
async def get_user(user_id: int = Path(..., gt=0)):
    return db.execute("SELECT * FROM users WHERE id = :id", {"id": user_id})
```

**Minimum validation per field:**

| Field Type | Validate |
|-----------|----------|
| String | Max length, allowed characters, no HTML/script tags |
| Number | Range (min/max), integer vs float |
| Email | Format + domain existence |
| URL | Protocol whitelist (https only), no internal IPs |
| File upload | Extension, MIME type, max size, virus scan |

---

## 5. Lock Down CORS

**The rule:** Only allow origins you explicitly control. Never use `*` in production.

**Why it matters:** Permissive CORS lets any website make authenticated requests to your API using your users' cookies.

**What to do:**

```python
# BAD: Allow everything
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# GOOD: Explicit allowlist
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://myapp.com",
        "https://admin.myapp.com",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)
```

**Test it:** Open your browser console on a random website and try:
```javascript
fetch('https://your-api.com/api/users', { credentials: 'include' })
```
If it works, your CORS is too permissive.

---

## 6. Return Minimal Error Messages

**The rule:** Never expose stack traces, SQL errors, or internal paths in API responses.

**Why it matters:** Error messages are reconnaissance gold for attackers.

**What to do:**

```json
// BAD: Information goldmine for attackers
{
  "error": "ProgrammingError: relation \"users\" has column \"password_hash\" of type varchar(60), query: SELECT * FROM users WHERE email='admin@...' AND password='...'",
  "traceback": "File /app/src/auth/login.py, line 42, in authenticate..."
}

// GOOD: Useful for debugging, safe for production
{
  "error": "Invalid credentials",
  "code": "AUTH_001",
  "request_id": "req_7f3a2b1c"
}
```

Log the full error server-side (with the `request_id` for correlation). Return only what the user needs.

---

## 7. Use HTTPS Everywhere (Yes, Even Internal APIs)

**The rule:** TLS on every connection. No exceptions for "internal" services.

**Why it matters:** Without TLS:
- Credentials travel in plaintext
- Man-in-the-middle attacks can modify responses
- Cookie hijacking is trivial on shared networks

**What to do:**

- Use Let's Encrypt (free TLS certificates, auto-renewal)
- Set HSTS headers: `Strict-Transport-Security: max-age=31536000`
- Redirect HTTP to HTTPS at the infrastructure level
- For internal services: use mTLS (mutual TLS) where both client and server verify each other

```bash
# Test your TLS configuration
curl -I https://your-api.com
# Look for:
# Strict-Transport-Security: max-age=31536000
# No mixed content warnings
```

---

## 8. Implement Proper Authentication Flows

**The rule:** Use proven auth libraries. Never roll your own JWT verification or password hashing.

**Why it matters:** Custom auth code is the #1 source of critical vulnerabilities in indie projects.

**What to do:**

```python
# BAD: DIY password hashing
import hashlib
hashed = hashlib.md5(password.encode()).hexdigest()  # MD5 is broken

# BAD: DIY JWT
token = base64.b64encode(json.dumps({"user": "admin"}).encode())  # Not signed!

# GOOD: Use proven libraries
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash(password)

# GOOD: Use a proper auth provider
# Keycloak, Auth0, Supabase Auth, or Clerk — all have free tiers
```

**Auth checklist:**
- [ ] Passwords hashed with bcrypt/argon2 (never MD5/SHA1)
- [ ] JWT tokens signed with RS256 (not HS256 with a weak secret)
- [ ] Refresh tokens stored in httpOnly cookies (not localStorage)
- [ ] Token expiry < 1 hour for access tokens
- [ ] Failed login attempt limiting (see item #3)

---

## 9. Log Security Events (Not Just Errors)

**The rule:** Log authentication attempts, authorization failures, and data access patterns. Not just exceptions.

**Why it matters:** When a breach happens, logs are your forensic evidence. Without them, you can't answer "what was accessed?" or "when did it start?"

**What to do:**

```python
import structlog

logger = structlog.get_logger()

@app.post("/api/login")
async def login(credentials: LoginRequest, request: Request):
    user = await authenticate(credentials)
    if not user:
        logger.warning("auth.failed",
            email=credentials.email,
            ip=request.client.host,
            user_agent=request.headers.get("user-agent"))
        raise HTTPException(status_code=401)

    logger.info("auth.success",
        user_id=user.id,
        ip=request.client.host)
    return create_token(user)
```

**What to log:**

| Event | Fields | Why |
|-------|--------|-----|
| Login success | user_id, IP, timestamp | Baseline for anomaly detection |
| Login failure | email attempted, IP, timestamp | Brute-force detection |
| Permission denied | user_id, resource, action | Privilege escalation attempts |
| Data export | user_id, record count, filters | Mass scraping detection |
| API key created/rotated | user_id, key_prefix | Credential lifecycle |

---

## 10. Keep Dependencies Updated

**The rule:** Audit and update dependencies monthly. Automate it.

**Why it matters:** 84% of codebases contain at least one known vulnerability in their dependencies (Synopsys OSSRA 2024). Most are fixable with a version bump.

**What to do:**

```bash
# Python
pip-audit
safety check

# Node.js
npm audit
npx audit-ci --moderate

# Rust
cargo audit

# All: enable Dependabot on GitHub (free)
# Settings > Code security > Dependabot alerts + security updates
```

Set up automated PRs for dependency updates:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Bonus: The 5-Minute Security Audit

Run this right now on any project:

```bash
# 1. Check for secrets in git history
gitleaks detect --source . --verbose

# 2. Check for vulnerable dependencies
npm audit     # or pip-audit, cargo audit

# 3. Check your CORS headers
curl -I -H "Origin: https://evil.com" https://your-api.com/api/health
# If you see "Access-Control-Allow-Origin: *" → fix it

# 4. Check for exposed debug endpoints
curl https://your-api.com/debug
curl https://your-api.com/docs    # Swagger UI in production?
curl https://your-api.com/admin

# 5. Check TLS
curl -I https://your-api.com | grep Strict-Transport
```

---

## How STOA Makes This Automatic

Every item on this checklist is something **you** have to remember, configure, and maintain. For a solo dev juggling 5 client projects, that's a lot of discipline to sustain.

STOA Platform was built to make these practices **the default**, not the exception — even on the free, open-source tier:

| This Checklist | Without STOA | With STOA |
|----------------|-------------|-----------|
| Secret management | Manual .env + rotation | Automatic rotation, no static keys |
| Rate limiting | Configure per-endpoint | Built-in, per-tenant, configurable |
| Input validation | Write validators per field | Schema-driven (UAC contract) |
| CORS | Configure per-service | Policy-as-code, centralized |
| Auth flows | Integrate Keycloak/Auth0 | Built-in OIDC + mTLS |
| Audit logging | Add structured logging | Automatic audit trail, every call |
| TLS | Let's Encrypt + renewal | mTLS by default, cert auto-rotation |
| Dependency scanning | Manual + Dependabot | CI pipeline with gitleaks + trivy |

The philosophy is simple: **security shouldn't be a premium feature**. If your gateway doesn't secure your APIs by default in the free tier, it's not really securing anything — it's just selling fear.

---

## The Checklist (Copy This)

```markdown
## API Security Checklist

- [ ] No secrets in client-side code or git history
- [ ] Short-lived tokens instead of static API keys
- [ ] Rate limiting on every endpoint
- [ ] Server-side input validation on every field
- [ ] CORS locked to explicit origins (no wildcards)
- [ ] Minimal error messages (no stack traces in responses)
- [ ] HTTPS everywhere (including internal services)
- [ ] Proven auth libraries (never DIY crypto)
- [ ] Security event logging (not just errors)
- [ ] Dependencies audited and updated monthly
```

Print it. Pin it above your monitor. Check it before every deployment.

---

*Building APIs for clients? Join a community of developers who take security seriously — [Discord](https://discord.gg/j8tHSSes) | [GitHub](https://github.com/stoa-platform/stoa)*
