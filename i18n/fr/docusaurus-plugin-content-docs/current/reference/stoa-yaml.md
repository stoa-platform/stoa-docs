---
sidebar_position: 3
title: "Référence stoa.yaml"
description: "Référence complète des champs de stoa.yaml — le spec de déploiement API déclaratif utilisé par stoactl, la Console UI et MCP Copilot."
keywords: [stoa.yaml, declarative, API deployment, CLI, GitOps, reference, spec]
---

# Référence stoa.yaml

`stoa.yaml` est le format de configuration API déclaratif de STOA Platform. Il est utilisé comme entrée pour :

- **`stoactl deploy ./stoa.yaml`** — Déploiement piloté par CLI
- **Console UI** — Import / Export via le formulaire API
- **MCP Copilot** — Déploiements générés et validés par AI

Consultez [ADR-045](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) pour la justification complète de la conception.

---

## Exemple Minimal

```yaml
name: customer-api
version: 1.2.0
```

Déploie avec les paramètres par défaut : rate limit `1000 req/min`, sans auth, sans filtrage d'endpoint.

---

## Exemple Complet

```yaml
name: customer-api
version: 2.0.0
tags:
  - payments
  - crm

endpoints:
  - path: /customers
    method: GET
    description: Lister tous les clients
    tags: [read]
  - path: /customers/{id}
    method: GET
    description: Obtenir un client par ID
  - path: /customers
    method: POST
    description: Créer un nouveau client
    tags: [write]

rate_limit:
  requests_per_minute: 1000
  burst: 50

auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/acme
  required: true
```

---

## Référence des Champs

### Champs de Niveau Supérieur

| Champ | Type | Obligatoire | Défaut | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Oui** | — | Identifiant unique de l'API. 255 caractères max. Utilisé comme nom de l'API dans le Control Plane. |
| `version` | string | Non | `1.0.0` | Version sémantique (ex : `1.2.0`, `2.0.0-beta`). Doit correspondre au pattern `MAJOR.MINOR.PATCH`. |
| `tags` | string[] | Non | `[]` | Tags optionnels attachés à l'API pour le filtrage et le regroupement. |
| `endpoints` | object[] | Non | `[]` | Définitions d'endpoints. Si vide, tout le trafic passe sans routage au niveau endpoint. |
| `rate_limit` | object | Non | `null` | Politique de rate limiting. Si absent, aucun rate limit n'est appliqué. |
| `auth` | object | Non | `null` | Politique d'authentification. Si absent, aucune authentification n'est requise. |

---

### `endpoints[]`

Chaque entrée définit un endpoint à exposer via le gateway.

| Champ | Type | Obligatoire | Défaut | Description |
|-------|------|----------|---------|-------------|
| `path` | string | **Oui** | — | Chemin URL (ex : `/customers`, `/users/{id}`). |
| `method` | string | Non | `GET` | Méthode HTTP : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. |
| `description` | string | Non | `""` | Description lisible par un humain affichée dans la Console et le Portal. |
| `tags` | string[] | Non | `[]` | Tags au niveau endpoint pour le filtrage dans le Portal. |

---

### `rate_limit`

| Champ | Type | Obligatoire | Défaut | Description |
|-------|------|----------|---------|-------------|
| `requests_per_minute` | int | **Oui** | — | Requêtes maximum par minute. Doit être > 0. |
| `burst` | int | Non | `0` | Tolérance de rafale au-dessus de `requests_per_minute` pour les pics brefs. |

**Exemple :**

```yaml
rate_limit:
  requests_per_minute: 500
  burst: 100
```

---

### `auth`

| Champ | Type | Obligatoire | Défaut | Description |
|-------|------|----------|---------|-------------|
| `type` | string | **Oui** | — | Mécanisme d'auth : `jwt`, `api_key`, `mtls`, `oauth2`, `none`. |
| `issuer` | string | Non | — | URL de l'émetteur JWT/OAuth2 (ex : `https://auth.acme.com/realms/prod`). |
| `header` | string | Non | — | Nom d'en-tête personnalisé pour l'auth par clé API (défaut : `Authorization`). |
| `required` | bool | Non | `false` | Si `true`, les requêtes non authentifiées sont rejetées avec `401`. Si `false`, l'auth est optionnelle. |

**Valeurs du type auth :**

| Valeur | Description |
|-------|-------------|
| `jwt` | Valider les tokens JWT Bearer. Utiliser `issuer` pour spécifier l'endpoint JWKS. |
| `api_key` | Valider les clés API via l'en-tête ou le paramètre de requête. |
| `oauth2` | Introspection de token OAuth 2.0. Utiliser `issuer` pour le serveur d'autorisation. |
| `mtls` | Validation de certificat client TLS mutuel. |
| `none` | Aucune authentification (passthrough). |

---

## Déploiement via CLI

### Déploiement basé sur fichier (recommandé)

```bash
stoactl deploy ./stoa.yaml --env production
stoactl deploy ./stoa.yaml --env dev --watch
```

La CLI lit et valide `stoa.yaml` localement avant de soumettre au Control Plane.

### Valider sans déployer

```bash
stoactl validate ./stoa.yaml   # (planifié — voir roadmap)
```

### Exporter la configuration d'une API existante

```bash
stoactl get apis customer-api -o yaml > stoa.yaml
```

---

## Variables d'Environnement

Utilisez des variables shell dans les valeurs de chaînes pour éviter de coder en dur les URLs spécifiques à l'environnement :

```yaml
auth:
  type: oauth2
  issuer: ${STOA_AUTH_URL}/realms/acme
```

La CLI développe les variables depuis l'environnement shell courant avant l'analyse.

---

## Récapitulatif des Valeurs par Défaut

| Champ | Défaut quand absent |
|-------|---------------------|
| `version` | `1.0.0` |
| `endpoints[].method` | `GET` |
| `auth.required` | `false` |
| `rate_limit` (bloc entier) | Aucun rate limiting appliqué |
| `auth` (bloc entier) | Aucune auth requise |

---

## Erreurs de Validation

La CLI valide `stoa.yaml` avant l'envoi à l'API et retourne des erreurs lisibles par un humain :

| Erreur | Cause |
|-------|-------|
| `'name' is required` | Le champ `name` est manquant ou vide |
| `'name' must be 255 characters or fewer` | Nom trop long |
| `'version' must be a semantic version` | Format invalide (ex : `v1.0` au lieu de `1.0.0`) |
| `endpoints[N].path is required` | Une entrée endpoint manque le champ `path` |
| `rate_limit.requests_per_minute must be > 0` | Rate limit nul ou négatif |
| `auth.type must be one of: jwt, api_key, mtls, oauth2, none` | Type d'auth inconnu |

---

## Voir Aussi

- [Référence CLI stoactl](/docs/reference/cli) — `stoactl deploy`, `stoactl logs`, `stoactl deploy list`
- [ADR-045 : Spec API Déclarative stoa.yaml](/docs/architecture/adr/adr-045-stoa-yaml-declarative-spec) — Justification de la conception et exemples
- [Guide de Déploiement](/docs/guides/environment-management) — Gestion des environnements
