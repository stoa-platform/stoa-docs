---
slug: freelancer-api-security-part-1-vulnerabilities
title: "Vos APIs sont plus vulnérables que vous ne le pensez (Partie 1)"
description: "Patterns d'attaques réels ciblant les APIs de développeurs solo. Ce qui casse en premier, comment les attaquants vous trouvent, et la protection 80% sans complexité supplémentaire."
authors: [stoa-team]
tags: [security, tutorial, api-gateway, education]
unlisted: true
keywords:
  - api security freelancer
  - api vulnerabilities solo developer
  - protect api from attacks
  - api gateway security open source
  - api security checklist indie hacker
  - common api vulnerabilities
  - api security best practices 2026
---
<!-- last verified: 2026-02 -->

Vous avez déployé votre API. Peut-être que c'est un projet secondaire, peut-être un travail pour un client, peut-être le backend d'un SaaS que vous construisez le soir et les week-ends.

Voici ce qui se passe probablement dessus en ce moment — sans que vous le sachiez.

<!-- truncate -->

*Il s'agit de la Partie 1 de la Série Sécurité API pour Freelances. [Partie 2 : Stratégies de Rate Limiting qui fonctionnent vraiment](/blog/freelancer-api-security-part-2-rate-limiting) | [Partie 3 : Pistes d'audit quand les choses tournent mal](/blog/freelancer-api-security-part-3-audit-trails)*

---

## La surface d'attaque à laquelle vous ne pensez pas

Quand la plupart des développeurs pensent à la sécurité API, ils pensent à l'authentification : « ajouter des tokens JWT, c'est fait. » L'authentification est importante, mais ce n'est qu'une couche d'un problème multi-couches.

Voici le paysage réel des menaces pour une API de freelance typique :

| Type d'attaque | Fréquence | Impact | Fréquence réelle |
|-------------|-----------|--------|------------|
| Credential stuffing / vol de clé | Haute | Critique | Très courant |
| Exposition excessive de données | Moyenne | Haute | Extrêmement courant |
| Absence de rate limiting | Haute | Haute | Quasi-universel |
| Autorisation brisée au niveau objet | Moyenne | Critique | Très courant |
| Mauvaise configuration de sécurité | Moyenne | Moyenne | Courant |
| Injection (SQL, NoSQL, cmd) | Basse | Critique | Courant |

Remarquez ce qui est en tête : le rate limiting et l'exposition de données. Ces éléments sont ennuyeux, sans glamour, et ignorés par la plupart des tutoriels. Ce sont aussi ceux qui vous frappent en premier.

---

## Pattern d'attaque 1 : La récolte de clés API

**Ce qui se passe :** un bot découvre votre API, essaie quelques endpoints valides, puis commence à cycler à travers des clés API issues de bases de données de violations. Ou pire, le développeur de votre client commet accidentellement une clé API dans un dépôt GitHub public.

**La vitesse d'escalade :** les bots GitHub scannent les secrets committés en quelques minutes. Dans l'heure qui suit l'apparition d'une clé dans un dépôt public, elle a généralement été récoltée.

**Ce qu'un gateway fait :** gestion centralisée des clés. Vous pouvez révoquer une clé compromise en un seul appel API, sans toucher à votre code backend :

```bash
# Révoquer immédiatement une souscription compromise
curl -s -X POST "${STOA_API_URL}/v1/subscriptions/$SUBSCRIPTION_ID/revoke" \
  -H "Authorization: Bearer $TOKEN"
```

La clé cesse de fonctionner en quelques secondes. Votre code backend ne change pas. Vos autres clients ne sont pas affectés.

Sans gateway, vous auriez besoin de déployer un changement de code pour invalider une clé. Si votre pipeline de déploiement est lent, ou s'il est 2h du matin, c'est un problème.

---

## Pattern d'attaque 2 : Le scraping lent

**Ce qui se passe :** un concurrent, un courtier de données ou un acteur malveillant ne martèle pas votre API — il l'appelle lentement, méthodiquement, 24 heures sur 24, extrayant chaque donnée que vous avez. Aucun déclenchement de limite de rate. Aucune alerte. Juste une extraction silencieuse.

**Signes que vous avez été scrapé :** vous remarquez que la taille de votre sauvegarde de base de données a soudainement triplé. Vos coûts cloud augmentent progressivement. Votre fournisseur d'API en aval vous envoie une facture de dépassement.

**La partie insidieuse :** le scraping lent ressemble à un utilisateur légitime très actif. Sans suivi par consommateur, vous ne pouvez pas faire la différence.

**Ce qu'un gateway fait :** suivi des requêtes par consommateur. Chaque consommateur a un profil de consommation — appels par jour, appels par heure, octets transférés. Les anomalies sont visibles :

```bash
# Vérifier l'utilisation des 24 dernières heures d'un consommateur
curl -s "${STOA_API_URL}/v1/quotas/$TENANT_ID/$CONSUMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    requests_today: .daily_count,
    requests_this_hour: .hourly_count,
    bytes_transferred: .bytes_out
  }'
```

Un utilisateur légitime appelant votre API pour un projet secondaire fait ~500 appels/jour. Un scraper en fait 50 000. Les chiffres racontent l'histoire.

---

## Pattern d'attaque 3 : Exposition excessive de données

Ce n'est pas une attaque externe — c'est votre propre code qui expose trop.

**L'erreur classique :**

```python
# Vous avez besoin de retourner le nom d'affichage de l'utilisateur
# Vous retournez l'objet utilisateur entier
@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    user = await db.get(User, user_id)
    return user  # inclut email, hash de mot de passe, flags internes, billing_id...
```

Le client n'utilise que `displayName`. Vous avez tout exposé. C'est l'un des patterns les plus courants de l'[OWASP API Top 10](https://owasp.org/www-project-api-security/).

**Ce qu'un gateway fait :** les politiques de transformation de requête/réponse vous permettent de supprimer les champs sensibles avant qu'ils n'atteignent le client, sans toucher à votre backend :

```bash
# Ajouter une politique de transformation de réponse pour supprimer les champs sensibles
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "strip-sensitive-user-fields",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "response": {
        "remove_fields": ["password_hash", "billing_id", "internal_flags", "keycloak_id"]
      }
    }
  }' | jq .
```

Il s'agit d'une protection au niveau du gateway, pas d'un remplacement d'une sérialisation correcte dans votre backend. Défense en profondeur : corrigez la cause racine ET ajoutez la couche gateway.

---

## Pattern d'attaque 4 : Autorisation brisée au niveau objet

**Ce qui se passe :** votre API a `GET /api/documents/{document_id}`. L'utilisateur A peut appeler `GET /api/documents/12345` et obtenir son document. Que se passe-t-il s'il appelle `GET /api/documents/12346` ? Si votre backend ne vérifie pas la propriété, il obtient le document de l'utilisateur B.

C'est BOLA (Broken Object Level Authorization) — OWASP API Security #1 depuis trois ans consécutifs.

**La vérité inconfortable :** c'est un problème de code backend. Un gateway ne peut pas corriger les erreurs de logique d'autorisation dans votre code métier. Il n'existe pas de configuration qui rende automatique « vérifier si cet utilisateur possède ce document ».

**Ce qu'un gateway PEUT faire :** ajouter une couche supplémentaire d'application de l'authentification (s'assurer que le token est valide, que le consommateur est actif, que le tenant est correct) afin que les requêtes non authentifiées n'atteignent jamais le backend. Réduire la surface d'attaque n'élimine pas la vulnérabilité mais signifie que seuls les utilisateurs authentifiés peuvent tenter l'exploit.

**Ce que vous devez faire :** filtrez toujours par `user_id` (ou `tenant_id`) lors de l'interrogation des ressources possédées :

```python
# Vulnérable
async def get_document(document_id: str):
    return await db.query(Document).filter(Document.id == document_id).first()

# Corrigé
async def get_document(document_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id  # toujours limiter au propriétaire
    ).first()
    if not doc:
        raise HTTPException(status_code=404)  # pas 403 — ne révélez pas l'existence
    return doc
```

---

## Pattern d'attaque 5 : L'attaque par amplification

**Ce qui se passe :** votre API a un endpoint comme `POST /api/process-batch` qui accepte 1 000 éléments. Un appel malveillant déclenche 1 000 opérations en aval. À 10 appels/seconde, c'est 10 000 opérations/seconde frappant votre base de données ou une API tierce payante.

**Exemple réel :** un proxy OpenAI sans limite de taille de lot. Un attaquant soumet des requêtes avec des lots de 1 000 éléments. Chaque appel coûte 0,10 € en crédits OpenAI. À 10 utilisateurs concurrents, c'est 1 €/seconde — 3 600 €/heure en charges avant que vous ne le remarquiez.

**Ce qu'un gateway fait :**

1. **Limites de taille de payload** — rejette les requêtes dépassant une taille configurée (par exemple, max 100 Ko)
2. **Rate limiting par consommateur** — même si chaque requête de lot est « une requête », limitez le total des requêtes par fenêtre temporelle

```bash
# Ajouter une politique de limite de taille de payload
curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payload-size-limit",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {
      "request": {
        "max_body_size_kb": 100
      }
    }
  }' | jq .
```

Combinées avec le rate limiting de la [Partie 2 de cette série](/blog/freelancer-api-security-part-2-rate-limiting), les attaques par amplification deviennent beaucoup plus difficiles à exécuter.

---

## Le 80/20 de la sécurité API

Vous ne pouvez pas tout corriger. Voici ce qui vous protège contre 80% des attaques du monde réel, par ordre d'impact :

| Priorité | Contrôle | Ce qu'il arrête | Effort |
|----------|---------|---------------|--------|
| 1 | Rate limiting par consommateur | Force brute, scraping, amplification | Faible (politique gateway) |
| 2 | Gestion centralisée des clés | Compromission de clé, accès non autorisé | Faible (gateway) |
| 3 | Journalisation des requêtes/réponses | Tous les patterns d'attaque (a posteriori) | Faible (gateway) |
| 4 | Autorisation au niveau objet | BOLA | Moyen (correction de code) |
| 5 | Validation des entrées | Injection | Moyen (correction de code) |
| 6 | Limites de taille de payload | Amplification | Faible (politique gateway) |
| 7 | Scan des dépendances | Chaîne d'approvisionnement | Faible (outil CI) |

Les éléments 1, 2, 3 et 6 sont gérés par un API gateway. Les éléments 4 et 5 nécessitent des changements dans le code backend. L'élément 7 nécessite des outils CI.

**Le gateway couvre 4 des 7.** C'est pourquoi mettre en place un gateway — même pour un projet secondaire — n'est pas de l'over-engineering. C'est la posture de sécurité minimale viable.

---

## Mettre en place la baseline de sécurité

Si vous avez suivi le [tutoriel Hello World](/blog/hello-world-api-gateway-freelancer), vous avez déjà le gateway qui tourne. Voici la baseline de sécurité à ajouter :

```bash
# 1. Rate limiting (100 req/min, burst 10)
RATE_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "security-baseline-rate-limit",
    "policy_type": "rate_limit",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {"requests_per_minute": 100, "burst": 10}
  }' | jq -r .id)

# 2. Limite de taille de payload (max 100 Ko)
SIZE_POLICY_ID=$(curl -s -X POST "${STOA_API_URL}/v1/admin/policies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "security-baseline-size-limit",
    "policy_type": "transform",
    "tenant_id": "'$TENANT_ID'",
    "scope": "api",
    "config": {"request": {"max_body_size_kb": 100}}
  }' | jq -r .id)

# 3. Lier les deux à votre API
for POLICY_ID in $RATE_POLICY_ID $SIZE_POLICY_ID; do
  curl -s -X POST "${STOA_API_URL}/v1/admin/policies/bindings" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"policy_id": "'$POLICY_ID'", "api_catalog_id": "'$API_ID'", "tenant_id": "'$TENANT_ID'"}' \
    | jq .id
done
```

Ces trois contrôles — rate limiting, limites de taille et la gestion des clés que vous avez configurée dans Hello World — vous donnent la baseline de sécurité à 80%.

---

## Ce qui vient ensuite

Cet article a couvert le paysage des menaces. Les deux articles suivants deviennent pratiques :

- **[Partie 2 : Stratégies de rate limiting qui fonctionnent vraiment](/blog/freelancer-api-security-part-2-rate-limiting)** — fenêtres glissantes, allocations de burst, limites par endpoint, et comment affiner sans casser les utilisateurs légitimes
- **[Partie 3 : Pistes d'audit quand les choses tournent mal](/blog/freelancer-api-security-part-3-audit-trails)** — journalisation structurée, quoi capturer, comment l'interroger, et réponse aux incidents minimale viable

Si vous n'avez pas encore configuré STOA, commencez par le [tutoriel Hello World](/blog/hello-world-api-gateway-freelancer).

---

## FAQ

### Mon API est petite — ai-je vraiment besoin de cela ?

La taille n'a pas d'importance pour les attaquants. Les bots scannent l'intégralité d'Internet en continu. Un nouvel endpoint est trouvé dans les heures qui suivent sa mise en ligne, qu'il s'agisse d'un projet secondaire ou d'un service d'une grande entreprise.

### HTTPS n'est-il pas suffisant ?

HTTPS chiffre le trafic en transit. Il ne prévient pas les abus de rate, la compromission de clé, l'exposition excessive de données ou les défaillances d'autorisation. Menace différente, contrôle différent.

### J'utilise une API managée (AWS API Gateway, Cloudflare Workers). Ai-je encore besoin de cela ?

Les gateways managés fournissent certains de ces contrôles, mais souvent à un coût par requête qui s'accumule rapidement. STOA est open source et auto-hébergé — pas de frais par requête, contrôle total sur vos données.

### Qu'en est-il du WAF (Web Application Firewall) ?

Un WAF ajoute une autre couche (signatures d'injection SQL, règles de détection de bots). C'est un complément à, et non un remplacement de, les contrôles décrits ici. Pour la plupart des APIs de freelances, un WAF est prématuré — commencez par les contrôles du gateway d'abord.

### Comment savoir si mon API est déjà en cours d'abus ?

Vérifiez vos logs d'audit : `GET /v1/audit/$TENANT_ID`. Cherchez des patterns inhabituels — beaucoup de requêtes d'un seul consommateur, requêtes vers des endpoints qui n'existent pas (inondation de 404), ou requêtes à des heures inhabituelles. La [Partie 3](/blog/freelancer-api-security-part-3-audit-trails) de cette série couvre exactement cela.
