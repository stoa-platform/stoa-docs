# ADR-001: Third-Party API Exposure Strategy — Public API Façade

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 18 January 2026 |
| **Linear** | [CAB-669](https://linear.app/hlfh-workspace/issue/CAB-669) (Epic) |

## Context

STOA Platform évolue avec plusieurs composants en parallèle : Control-Plane API (FastAPI), MCP Gateway, Developer Portal (React), Console (React), et webMethods Gateway.

### Problèmes identifiés

| Problème | Impact | Gravité |
|----------|--------|---------|
| **Dépendances croisées** | Chaque composant accède directement à PostgreSQL, GitLab, Keycloak | 🔴 Élevé |
| **Rôle flou de webMethods** | Utilisé pour admin ET runtime, difficile à scaler | 🔴 Élevé |
| **Duplication de logique** | Validation, auth, tenant isolation répétée partout | 🟡 Moyen |
| **Déploiement couplé** | Impossible de déployer Portal sans MCP Gateway | 🟡 Moyen |

### Question architecturale

> **Comment structurer les composants STOA pour qu'ils soient déployables indépendamment, tout en maintenant GitLab comme source de vérité et en clarifiant le rôle de chaque élément ?**

## Decision

Adopter une architecture **Control Plane / Data Plane** avec Core API comme hub central.

### Options considérées

| Option | Description | Verdict |
|--------|-------------|---------|
| **A. Monolithe modulaire** | Tout dans un artifact | ❌ Contre open-core, scaling tout-ou-rien |
| **B. Microservices purs** | Un service par domaine | ❌ Overkill pour la taille de l'équipe |
| **C. Control Plane / Data Plane** | Séparation claire des responsabilités | ✅ **Retenu** |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CONTROL PLANE                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐                                   │
│  │ Portal │ │Console │ │  MCP   │   ← UI Layer (optionnels)        │
│  │  (SPA) │ │  (SPA) │ │ Server │                                   │
│  └───┬────┘ └───┬────┘ └───┬────┘                                   │
│      │          │          │                                         │
│      └──────────┼──────────┘                                         │
│                 │                                                    │
│          ┌──────▼──────┐                                             │
│          │  STOA Core  │   ← Hub central (obligatoire)              │
│          │     API     │                                             │
│          └──────┬──────┘                                             │
│                 │                                                    │
│    ┌────────────┼────────────┐                                       │
│    │            │            │                                       │
│ PostgreSQL    GitLab     Keycloak                                    │
│ (runtime)   (source)      (IAM)                                      │
└─────────────────────────────────────────────────────────────────────┘
                  │
                  │ GitOps Sync
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA PLANE                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              webMethods Gateway                                │  │
│  │   Routing │ Rate Limit │ Auth │ Transform                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Composants

| Composant | Type | Rôle | Dépendances |
|-----------|------|------|-------------|
| **STOA Core API** | Backend (FastAPI) | Hub central, toute la logique métier | PostgreSQL, GitLab, Keycloak |
| **STOA Portal** | Frontend (React) | Self-service développeurs | Core API uniquement |
| **STOA Console** | Frontend (React) | Administration plateforme | Core API uniquement |
| **STOA MCP Server** | Backend (Python) | Interface AI/LLM | Core API uniquement |
| **webMethods Gateway** | Data Plane | Exécution trafic API runtime | Config sync depuis Core API |

### Règles d'architecture

#### Règle 1 : Dépendances unidirectionnelles

```
Portal ──────┐
Console ─────┼──► Core API ──► PostgreSQL
MCP Server ──┘              ──► GitLab
                            ──► Keycloak
```

**Interdit :** Portal → PostgreSQL (direct), MCP Server → GitLab (direct)

#### Règle 2 : GitLab = Source de vérité pour les définitions

```yaml
# Ce qui vit dans GitLab (stoa-catalog)
stoa-catalog/
  tenants/{tenant}/
    apis/{api}/
      api.yaml       # Définition API
      openapi.yaml   # Spec OpenAPI
      
# Ce qui vit dans PostgreSQL
- subscriptions, api_keys, audit_logs, rate_limit_usage, mcp_sessions
```

#### Règle 3 : webMethods = Data Plane uniquement

✅ **DO:** Routing, Rate limiting, JWT validation, Transformation, Caching  
❌ **DON'T:** Servir les UI, Gérer les souscriptions, Stocker des données

## Public API Façade

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CONTROL PLANE                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      INTERNAL                                   │ │
│  │  Portal ─────┐                                                  │ │
│  │  Console ────┼──► Core API ──► PostgreSQL / GitLab / Keycloak  │ │
│  │  MCP Server ─┘       ▲                                          │ │
│  └──────────────────────┼─────────────────────────────────────────┘ │
│                         │                                            │
│  ┌──────────────────────┼─────────────────────────────────────────┐ │
│  │                 EXTERNAL (tiers)                                │ │
│  │  Tiers ──► webMethods ──► Public API ──┘                       │ │
│  │            (rate limit)   (façade)                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Endpoints exposés aux tiers

```yaml
/public/v1/:
  catalog:           # Public ou API key
    GET /apis, GET /apis/{id}, GET /apis/{id}/spec
  subscriptions:     # OAuth2 requis
    GET/POST/DELETE /subscriptions
  me:                # OAuth2 requis
    GET /me, GET /me/usage
```

**JAMAIS exposé :** `/v1/admin/*`, `/v1/tenants/*/members`, `/v1/gateway/*`

## Consequences

### Positive

- ✅ Déploiement indépendant des composants
- ✅ GitLab reste source de vérité
- ✅ Séparation claire Control Plane / Data Plane
- ✅ Exposition sécurisée aux tiers

### Negative

- ⚠️ Latence additionnelle (MCP → Core API vs direct DB)
- ⚠️ Migration effort

## References

- Kubernetes Control Plane / Data Plane separation
- Istio Pilot (control) vs Envoy (data)
- Kong Konnect architecture
- [ADR-012: MCP Tools Architecture](./adr-012-mcp-rbac-architecture.md)
