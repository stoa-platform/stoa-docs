---
slug: api-security-checklist-solo-dev
title: "Checklist de sécurité API : 10 indispensables pour les développeurs solo"
authors: [christophe]
tags: [security, education, tutorial, api-gateway]
description: "Pas de budget, pas d'équipe sécurité. 10 étapes pratiques que tout freelance et indie hacker doit suivre pour protéger ses APIs contre les attaques réelles."
keywords: [api security checklist, developer security, api authentication, rate limiting, OWASP API, freelancer security, api best practices, secure api development, api key management, solo developer]
---
<!-- last verified: 2026-02 -->

# Checklist de sécurité API : 10 indispensables pour chaque développeur solo

**10 étapes de sécurité pratiques qui prennent moins d'une journée et préviennent 95 % des incidents API.** Pas de budget enterprise, pas d'outillage complexe — juste de la rigueur d'ingénierie. Couvre les secrets, le rate limiting, CORS, l'authentification, TLS, les logs et la gestion des dépendances.

Vous êtes freelance. Vous avez livré une API pour un client. Elle fonctionne. Les tests passent. La facture est envoyée.

Six mois plus tard, le client vous appelle : quelqu'un a extrait toute leur base de données utilisateurs via votre API. Pas de rate limiting. Pas de validation des entrées. Headers CORS par défaut. La clé API était dans le JavaScript frontend.

Cela arrive plus souvent qu'on ne l'admet. Et c'est presque toujours évitable avec une simple checklist. C'est une partie de notre philosophie de [gestion d'API open source](/blog/open-source-api-gateway-2026) : la sécurité doit être accessible à tous, pas seulement aux entreprises.

<!-- truncate -->

Voici 10 choses qui prennent moins d'une journée au total et préviennent 95 % des incidents de sécurité API. Pas de budget enterprise. Pas d'outillage complexe. Juste de la rigueur d'ingénierie.

---

## 1. Ne jamais exposer de secrets dans le code côté client

**La règle :** les API keys, tokens et identifiants ne doivent jamais apparaître dans le code frontend, les applications mobiles ou les dépôts publics.

**Pourquoi c'est important :** les DevTools du navigateur, la décompilation d'APK et le "View Source" rendent tout secret côté client instantanément public.

**Que faire :**

```javascript
// MAUVAIS : API key dans le frontend
const response = await fetch('https://api.stripe.com/v1/charges', {
  headers: { 'Authorization': 'Bearer sk_live_abc123' }
});

// BON : Appeler votre propre backend, qui détient la clé
const response = await fetch('/api/create-charge', {
  method: 'POST',
  body: JSON.stringify({ amount: 1000 })
});
```

Votre backend joue le rôle de proxy. Le secret ne quitte jamais le serveur.

**Gain rapide :** recherchez dans votre codebase frontend les termes `sk_`, `api_key`, `secret`, `password`, `token`. Si vous en trouvez, déplacez-les côté serveur aujourd'hui.

---

## 2. Utiliser des tokens à durée de vie courte, pas des API keys statiques

**La règle :** préférez les tokens OAuth 2.0 (qui expirent en minutes/heures) aux API keys statiques (qui n'expirent jamais).

**Pourquoi c'est important :** une clé statique compromise fonctionne indéfiniment. Un token OAuth compromis expire et devient inutile.

**Que faire :**

```
Cycle de vie d'une clé statique :
  Créée → Utilisée → Compromise → Exploitée (indéfiniment) → Panique → Rotation → Espoir

Cycle de vie d'un token OAuth :
  Créé → Utilisé → Compromis → Expiré (1 heure) → L'attaquant n'obtient rien
```

Si vous devez utiliser des API keys statiques (certains services tiers l'exigent) :
- Faites-les tourner selon un calendrier (tous les 90 jours minimum)
- Stockez-les dans des variables d'environnement, jamais dans le code
- Utilisez un gestionnaire de secrets si disponible (même les niveaux gratuits de Vault, Infisical ou Doppler)

---

## 3. Mettre en place le rate limiting partout

**La règle :** chaque endpoint doit avoir un rate limit. Sans exception.

**Pourquoi c'est important :** sans rate limiting, un seul attaquant peut :
- Bruteforcer des mots de passe (1 000 tentatives/seconde)
- Extraire toute votre base de données (abus de pagination)
- Faire exploser votre facture cloud (DDoS-par-facturation)
- Épuiser vos quotas d'APIs tierces

**Que faire :**

```nginx
# nginx : 10 requêtes par seconde par IP
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

Ou dans le code de votre application :

```python
# FastAPI avec slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/users")
@limiter.limit("30/minute")
async def list_users(request: Request):
    ...
```

**Limites recommandées :**
| Type d'endpoint | Limite | Pourquoi |
|----------------|-------|---------|
| Login/Auth | 5/minute | Prévention du bruteforce |
| Lecture publique | 60/minute | Prévention du scraping |
| Écriture/Création | 10/minute | Prévention des abus |
| Admin | 30/minute | Filet de sécurité |

---

## 4. Valider chaque entrée (oui, chacune)

**La règle :** ne jamais faire confiance aux données du client. Validez le type, la longueur, le format et la plage côté serveur.

**Pourquoi c'est important :** les injections SQL, XSS, injections de commandes et path traversal commencent tous par des entrées non validées.

**Que faire :**

```python
# MAUVAIS : faire confiance au client
@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    return db.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
    # user_id = "1' OR '1'='1" → retourne TOUS les utilisateurs

# BON : valider + paramétrer
@app.get("/api/users/{user_id}")
async def get_user(user_id: int = Path(..., gt=0)):
    return db.execute("SELECT * FROM users WHERE id = :id", {"id": user_id})
```

**Validation minimale par champ :**

| Type de champ | Valider |
|--------------|---------|
| Chaîne | Longueur max, caractères autorisés, pas de balises HTML/script |
| Nombre | Plage (min/max), entier vs flottant |
| E-mail | Format + existence du domaine |
| URL | Liste blanche de protocoles (https uniquement), pas d'IPs internes |
| Upload de fichier | Extension, type MIME, taille max, analyse antivirus |

---

## 5. Restreindre CORS

**La règle :** n'autorisez que les origines que vous contrôlez explicitement. N'utilisez jamais `*` en production.

**Pourquoi c'est important :** un CORS permissif permet à n'importe quel site web de faire des requêtes authentifiées vers votre API en utilisant les cookies de vos utilisateurs.

**Que faire :**

```python
# MAUVAIS : tout autoriser
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# BON : liste d'autorisation explicite
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

**Testez-le :** ouvrez la console de votre navigateur sur un site quelconque et essayez :
```javascript
fetch('https://your-api.com/api/users', { credentials: 'include' })
```
Si cela fonctionne, votre CORS est trop permissif.

---

## 6. Retourner des messages d'erreur minimaux

**La règle :** n'exposez jamais les stack traces, erreurs SQL ou chemins internes dans les réponses API.

**Pourquoi c'est important :** les messages d'erreur sont une mine d'or pour la reconnaissance des attaquants.

**Que faire :**

```json
// MAUVAIS : mine d'informations pour les attaquants
{
  "error": "ProgrammingError: relation \"users\" has column \"password_hash\" of type varchar(60), query: SELECT * FROM users WHERE email='admin@...' AND password='...'",
  "traceback": "File /app/src/auth/login.py, line 42, in authenticate..."
}

// BON : utile pour le débogage, sûr pour la production
{
  "error": "Invalid credentials",
  "code": "AUTH_001",
  "request_id": "req_7f3a2b1c"
}
```

Journalisez l'erreur complète côté serveur (avec le `request_id` pour la corrélation). Ne retournez que ce dont l'utilisateur a besoin.

---

## 7. Utiliser HTTPS partout (oui, même pour les APIs internes)

**La règle :** TLS sur chaque connexion. Pas d'exception pour les services "internes".

**Pourquoi c'est important :** sans TLS :
- Les identifiants circulent en clair
- Les attaques man-in-the-middle peuvent modifier les réponses
- Le détournement de cookies est trivial sur les réseaux partagés

**Que faire :**

- Utilisez Let's Encrypt (certificats TLS gratuits, renouvellement automatique)
- Définissez les headers HSTS : `Strict-Transport-Security: max-age=31536000`
- Redirigez HTTP vers HTTPS au niveau de l'infrastructure
- Pour les services internes : utilisez mTLS (TLS mutuel) où client et serveur se vérifient mutuellement

```bash
# Tester votre configuration TLS
curl -I https://your-api.com
# Cherchez :
# Strict-Transport-Security: max-age=31536000
# Pas d'avertissements de contenu mixte
```

---

## 8. Implémenter des flux d'authentification appropriés

**La règle :** utilisez des bibliothèques d'authentification éprouvées. Ne développez jamais votre propre vérification JWT ou hachage de mots de passe.

**Pourquoi c'est important :** le code d'authentification maison est la première source de vulnérabilités critiques dans les projets indépendants.

**Que faire :**

```python
# MAUVAIS : hachage de mot de passe maison
import hashlib
hashed = hashlib.md5(password.encode()).hexdigest()  # MD5 est compromis

# MAUVAIS : JWT maison
token = base64.b64encode(json.dumps({"user": "admin"}).encode())  # Non signé !

# BON : utiliser des bibliothèques éprouvées
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash(password)

# BON : utiliser un fournisseur d'authentification approprié
# Keycloak, Auth0, Supabase Auth, ou Clerk — tous ont des niveaux gratuits
```

**Checklist d'authentification :**
- [ ] Mots de passe hachés avec bcrypt/argon2 (jamais MD5/SHA1)
- [ ] Tokens JWT signés avec RS256 (pas HS256 avec un secret faible)
- [ ] Refresh tokens stockés dans des cookies httpOnly (pas localStorage)
- [ ] Expiration des tokens < 1 heure pour les access tokens
- [ ] Limitation des tentatives de connexion échouées (voir point #3)

---

## 9. Journaliser les événements de sécurité (pas seulement les erreurs)

**La règle :** journalisez les tentatives d'authentification, les échecs d'autorisation et les patterns d'accès aux données. Pas seulement les exceptions.

**Pourquoi c'est important :** en cas de violation, les logs sont vos preuves forensiques. Sans eux, vous ne pouvez pas répondre à "qu'est-ce qui a été accédé ?" ou "quand cela a-t-il commencé ?"

**Que faire :**

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

**Que journaliser :**

| Événement | Champs | Pourquoi |
|----------|--------|---------|
| Connexion réussie | user_id, IP, timestamp | Base de référence pour la détection d'anomalies |
| Échec de connexion | email tenté, IP, timestamp | Détection de bruteforce |
| Accès refusé | user_id, ressource, action | Tentatives d'escalade de privilèges |
| Export de données | user_id, nombre d'enregistrements, filtres | Détection de scraping massif |
| Création/rotation de clé API | user_id, préfixe de clé | Cycle de vie des identifiants |

---

## 10. Maintenir les dépendances à jour

**La règle :** auditez et mettez à jour les dépendances mensuellement. Automatisez-le.

**Pourquoi c'est important :** 84 % des codebases contiennent au moins une vulnérabilité connue dans leurs dépendances (Synopsys OSSRA 2024). La plupart sont corrigeables avec une simple mise à jour de version.

**Que faire :**

```bash
# Python
pip-audit
safety check

# Node.js
npm audit
npx audit-ci --moderate

# Rust
cargo audit

# Tous : activer Dependabot sur GitHub (gratuit)
# Settings > Code security > Dependabot alerts + security updates
```

Configurez des PRs automatisées pour les mises à jour de dépendances :

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

## Bonus : l'audit de sécurité en 5 minutes

Exécutez ceci maintenant sur n'importe quel projet :

```bash
# 1. Vérifier les secrets dans l'historique git
gitleaks detect --source . --verbose

# 2. Vérifier les dépendances vulnérables
npm audit     # ou pip-audit, cargo audit

# 3. Vérifier vos headers CORS
curl -I -H "Origin: https://evil.com" https://your-api.com/api/health
# Si vous voyez "Access-Control-Allow-Origin: *" → à corriger

# 4. Vérifier les endpoints de debug exposés
curl https://your-api.com/debug
curl https://your-api.com/docs    # Swagger UI en production ?
curl https://your-api.com/admin

# 5. Vérifier TLS
curl -I https://your-api.com | grep Strict-Transport
```

---

## Comment STOA automatise tout cela

Chaque élément de cette checklist est quelque chose que **vous** devez mémoriser, configurer et maintenir. Pour un développeur solo qui jongle avec 5 projets clients, c'est beaucoup de rigueur à soutenir.

STOA Platform a été construit pour rendre ces pratiques **la règle par défaut**, pas l'exception — même sur le niveau gratuit et open source :

| Cette checklist | Sans STOA | Avec STOA |
|----------------|----------|---------|
| Gestion des secrets | .env manuel + rotation | Rotation automatique, pas de clés statiques |
| Rate limiting | Configuration par endpoint | Intégré, par tenant, configurable |
| Validation des entrées | Écrire des validateurs par champ | Piloté par le schéma (contrat UAC) |
| CORS | Configuration par service | Policy-as-code, centralisé |
| Flux d'authentification | Intégrer Keycloak/Auth0 | OIDC + mTLS intégrés |
| Logs d'audit | Ajouter des logs structurés | Piste d'audit automatique, chaque appel |
| TLS | Let's Encrypt + renouvellement | mTLS par défaut, rotation automatique des certificats |
| Analyse des dépendances | Manuel + Dependabot | Pipeline CI avec gitleaks + trivy |

La philosophie est simple : **la sécurité ne devrait pas être une fonctionnalité premium**. Si votre gateway ne sécurise pas vos APIs par défaut dans le niveau gratuit, il ne sécurise réellement rien — il vend juste de la peur.

---

## La checklist (à copier)

```markdown
## Checklist de sécurité API

- [ ] Pas de secrets dans le code côté client ni dans l'historique git
- [ ] Tokens à durée de vie courte plutôt que des API keys statiques
- [ ] Rate limiting sur chaque endpoint
- [ ] Validation des entrées côté serveur sur chaque champ
- [ ] CORS verrouillé sur des origines explicites (pas de wildcards)
- [ ] Messages d'erreur minimaux (pas de stack traces dans les réponses)
- [ ] HTTPS partout (y compris les services internes)
- [ ] Bibliothèques d'authentification éprouvées (jamais de crypto maison)
- [ ] Journalisation des événements de sécurité (pas seulement les erreurs)
- [ ] Dépendances auditées et mises à jour mensuellement
```

Imprimez-la. Affichez-la au-dessus de votre écran. Vérifiez-la avant chaque déploiement.

---

## Foire aux questions

### Quel est l'élément le plus important de cette liste ?

**Point #1 : ne jamais exposer de secrets dans le code côté client.** C'est l'erreur la plus courante et la plus dommageable. Si vous ne faites qu'une chose, déplacez toutes les API keys côté serveur aujourd'hui. Pour approfondir la gestion des secrets, consultez [Vos API keys sont dans votre historique Git](/blog/api-keys-in-git-history).

### Cette checklist s'applique-t-elle aussi aux APIs internes ?

Oui. Les APIs internes sont souvent moins sécurisées que les APIs publiques, ce qui en fait des cibles attractives pour les déplacements latéraux une fois qu'un attaquant est dans votre réseau. Les points 3 (rate limiting), 7 (HTTPS) et 9 (logs) sont particulièrement importants pour les services internes.

### Comment STOA gère-t-il ces points automatiquement ?

STOA Platform implémente les 10 points comme paramètres par défaut dans le niveau gratuit — consultez le [tableau de comparaison ci-dessus](#comment-stoa-automatise-tout-cela). La différence clé : vous ne configurez pas la sécurité par endpoint, vous la définissez une fois en policy-as-code et elle s'applique partout. Pour en savoir plus, consultez le [guide de démarrage rapide](/docs/guides/quickstart).

### Qu'en est-il des APIs GraphQL ?

Les mêmes principes s'appliquent : limitez par complexité de requête (pas seulement par requêtes/seconde), validez les schémas d'entrée, et n'exposez jamais l'introspection en production. Les points 4, 6 et 9 nécessitent une implémentation spécifique à GraphQL.

---

**À lire aussi** : [Guide des API gateways open source](/blog/open-source-api-gateway-2026) | [Vos API keys dans l'historique Git](/blog/api-keys-in-git-history) | [GitOps en 10 minutes](/blog/gitops-in-10-minutes)

*Vous développez des APIs pour des clients ? Rejoignez une communauté de développeurs qui prennent la sécurité au sérieux — [Discord](https://discord.gostoa.dev) | [GitHub](https://github.com/stoa-platform/stoa)*
