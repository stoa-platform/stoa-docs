---
sidebar_position: 24
title: "ADR-024 : Modes Unifiés du Gateway"
description: "Décide l'architecture gateway unifiée avec une configuration basée sur les modes supportant les déploiements edge-MCP, sidecar, proxy et shadow."
keywords: [modes gateway, architecture unifiée, edge-MCP, sidecar, proxy, configuration]
---

import GatewayModesArchitecture from '@site/src/components/GatewayModesArchitecture';

# ADR-024 : Architecture Gateway Unifiée avec Configuration Basée sur les Modes

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-01-26 |
| **Mis à jour** | 2026-01-26 |
| **Linear** | [CAB-958](https://linear.app/stoa/issue/CAB-958) |

## Contexte

La plateforme STOA souffre d'une confusion de nommage entre deux composants gateway :

- `mcp-gateway/` (Python/FastAPI) — production, support du protocole MCP
- `stoa-gateway/` (Rust/Axum) — émergent, recherche

Cela génère une charge cognitive pour les contributeurs et les utilisateurs. Même le créateur du projet oublie la distinction. C'est une dette technique dès le jour 0, avant d'avoir un seul client.

### Le Problème

> "Est-ce mcp-gateway ou stoa-gateway ? Quelle est la différence ?"
> — Chaque nouveau contributeur

## Décision

Adopter une **architecture gateway unifiée** avec 4 modes de déploiement, configurés via le flag `--mode`.

### Convention de Nommage

| Artefact | Nom |
|----------|-----|
| Nom du composant | `stoa-gateway` |
| Binaire | `stoa-gateway` |
| Helm Chart | `stoa-gateway` |
| Image Docker | `ghcr.io/hlfh/stoa-gateway` |
| Fichier de config | `stoa-gateway.yaml` |
| Ressources K8s | `stoa-gateway` |

**SUPPRESSION** : `mcp-gateway` comme nom de composant. C'est simplement `--mode=edge-mcp`.

### Quatre Modes de Déploiement

<GatewayModesArchitecture />

#### Vue d'Ensemble des Modes

| Mode | Position | Fonction | Cas d'Usage |
|------|----------|----------|-------------|
| **edge-mcp** | Front agents IA | Protocole MCP, tools/call, SSE | Claude, GPT, agents LLM personnalisés |
| **sidecar** | Derrière gateway tiers | Observabilité, enrichissement | Kong, webMethods, Apigee existants |
| **proxy** | Inline actif | Application de policies, rate limit, transformation | Gestion d'API classique |
| **shadow** | MITM passif | Observer, logger, auto-générer UAC | APIs legacy, progiciels non documentés |

## Détails des Modes

### Mode Edge-MCP

**Statut** : ✅ Production (Python) → Rust T2 2026

Gateway API AI-native implémentant le Model Context Protocol :

- Transport SSE pour le streaming temps réel
- Traitement des messages JSON-RPC 2.0
- Registre dynamique d'outils depuis les CRDs K8s
- Authentification OAuth2/OIDC via Keycloak

```bash
stoa-gateway --mode=edge-mcp --port=3001
```

#### Configuration

```yaml
gateway:
  mode: edge-mcp
  mcp:
    protocol_version: "2024-11-05"
    transports:
      - http
      - websocket
      - sse
    tool_discovery:
      enabled: true
      cache_ttl: 300s
    rate_limiting:
      requests_per_minute: 1000
    authentication:
      type: jwt
      issuer: https://auth.<YOUR_DOMAIN>
```

### Mode Proxy

**Statut** : 📋 Planifié T3 2026

Gateway API classique avec application de policies :

- Évaluation de policies OPA
- Rate limiting par tenant/consommateur
- Transformation requête/réponse
- Patterns circuit breaker

```bash
stoa-gateway --mode=proxy --upstream=http://backend:8080
```

#### Configuration

```yaml
gateway:
  mode: proxy
  proxy:
    routing:
      strip_path: true
      preserve_host: false
    rate_limiting:
      enabled: true
      requests_per_second: 100
    authentication:
      type: jwt
      issuer: https://auth.<YOUR_DOMAIN>
    transforms:
      request:
        add_headers:
          X-Tenant-ID: "{{ .tenant }}"
      response:
        remove_headers:
          - X-Internal-Secret
```

### Mode Sidecar

**Statut** : 📋 Planifié T2 2026

Déploiement derrière des gateways API existants pour ajouter les capacités STOA :

- Injection d'observabilité (OpenTelemetry)
- Événements de métering vers Kafka
- Validation de conformité UAC
- Capture d'Error Snapshot

```bash
stoa-gateway --mode=sidecar --primary-gateway=kong
```

#### Configuration

```yaml
gateway:
  mode: sidecar
  sidecar:
    upstream_gateway: kong  # ou : webmethods, apigee, custom
    features:
      error_snapshot: true      # Débogage time-travel
      observability: true       # Prometheus, traces
      uac_validation: true      # Conformité au contrat
      pii_masking: true         # Conformité RGPD
    passthrough:
      preserve_headers: true
      preserve_body: true
```

### Mode Shadow (💎 Fonctionnalité Différenciante)

**Statut** : 🔬 Expérimental — Un middleware shadow Python existe dans `mcp-gateway/src/middleware/shadow.py` (capture passive uniquement, sans modification). L'implémentation Rust est reportée à T4 2026.

Observation passive du trafic pour la découverte d'APIs legacy :

- Zéro modification des requêtes/réponses
- Capture des patterns de trafic
- Auto-génération de contrats UAC (sans ML, uniquement parsing HTTP + heuristiques)
- Validation humaine avant promotion

```bash
stoa-gateway --mode=shadow --target=http://legacy-erp:8080
```

#### Configuration

```yaml
gateway:
  mode: shadow
  shadow:
    capture:
      requests: true
      responses: true
      headers: true
      bodies: true  # Masquage PII appliqué
    uac_generation:
      enabled: true
      confidence_threshold: 0.8
      export_to_control_plane: true
      require_human_review: true
    target:
      backend: http://legacy-erp:8080
```

#### Checklist de Report Sécurité

Le mode Shadow capture un trafic potentiellement sensible. L'implémentation est reportée jusqu'à :

- [ ] Détection/masquage PII **avant** émission Kafka
- [ ] Opt-in explicite par API/tenant (pas de capture silencieuse)
- [ ] Politique de rétention &lt; 30 jours avec purge automatique
- [ ] Journal d'audit : qui a accédé aux observations, quand, pourquoi
- [ ] Documentation de conformité RGPD Article 25 (Privacy by Design)
- [ ] Validation par Team Coca (revue sécurité)

## Stratégie de Transition : Shadow → Proxy

Pour les organisations qui passent de l'observation à l'application :

```yaml
gateway:
  mode: proxy
  shadow:
    keep_observing: true  # Double mode : appliquer ET observer
  canary:
    enabled: true
    proxy_percentage: 10  # 10% via proxy, 90% direct
    observation_percentage: 100  # Tout le trafic observé
```

### Chemin de Migration

1. **Semaines 1-2** : Mode Shadow — observer, générer des brouillons UAC
2. **Semaine 3** : Revue humaine — valider les contrats, ajuster
3. **Semaine 4** : Canary — 10% via Proxy avec application
4. **Semaines 5-6** : Montée en charge — 50%, 80%, 100%
5. **Semaine 7+** : Proxy complet — désactiver Shadow ou conserver pour l'audit

## État Actuel

```
mcp-gateway/           # Python/FastAPI — PRODUCTION
├── src/
│   ├── handlers/mcp_sse.py      # Transport SSE
│   ├── services/tool_registry/  # Gestion des outils
│   └── k8s/watcher.py           # Watcher CRD
└── Dockerfile

stoa-gateway/          # Rust/Axum — ÉMERGENT/RECHERCHE
├── src/
│   ├── uac/enforcer.rs          # Application UAC
│   ├── mcp/handlers.rs          # Handlers MCP
│   └── router/shadow.rs         # Router shadow
└── Cargo.toml
```

## État Cible (T4 2026)

Binaire Rust `stoa-gateway` unique avec flag `--mode` :

```
stoa-gateway/          # Rust/Tokio/Hyper — CIBLE
├── src/
│   ├── main.rs                  # Point d'entrée, flag --mode
│   ├── modes/
│   │   ├── mod.rs               # Trait Mode
│   │   ├── edge_mcp.rs          # Protocole MCP (port depuis Python)
│   │   ├── sidecar.rs           # Derrière gateway tiers
│   │   ├── proxy.rs             # Application inline de policies
│   │   └── shadow.rs            # Capture trafic, génération UAC
│   ├── auth/
│   │   └── oidc.rs              # Validation JWT Keycloak
│   └── observability/
│       └── metrics.rs           # Prometheus
├── Cargo.toml
└── Dockerfile
```

`mcp-gateway/` Python déprécié après que Rust atteint la parité fonctionnelle.

## Stratégie de Migration

1. **Maintenir Python mcp-gateway en production** pendant la transition
2. **Porter mode par mode** vers Rust (edge-mcp en premier, shadow en dernier)
3. **Miroir shadow** Python vs Rust pour la validation
4. **Basculement** quand Rust atteint >99,9% de compatibilité des requêtes

### Phases de Migration

| Phase | Calendrier | Livrable |
|-------|-----------|----------|
| Phase 16 | Maintenant | ADR + documentation (ce document) |
| Phase 17 | T2 2026 | Fondation gateway Rust + port edge-mcp |
| Phase 18 | T3 2026 | Modes proxy + sidecar |
| Phase 19 | T4 2026 | Mode shadow (après revue sécurité) |

## Référence de Configuration

### Variables d'Environnement

```bash
# Sélection du mode
GATEWAY_MODE=edge-mcp  # edge-mcp | sidecar | proxy | shadow

# Paramètres communs
GATEWAY_PORT=3001
GATEWAY_LOG_LEVEL=info

# Keycloak (tous les modes)
KEYCLOAK_URL=https://auth.<YOUR_DOMAIN>
KEYCLOAK_REALM=stoa
KEYCLOAK_CLIENT_ID=stoa-gateway

# Spécifiques au mode
SHADOW_TARGET_BACKEND=http://legacy:8080
SIDECAR_PRIMARY_GATEWAY=kong
PROXY_OPA_ENDPOINT=http://opa:8181
```

### Valeurs Helm

```yaml
gateway:
  mode: edge-mcp
  image:
    repository: ghcr.io/hlfh/stoa-gateway
    tag: latest

  edgeMcp:
    enabled: true
    port: 3001

  sidecar:
    enabled: false
    primaryGateway: ""

  proxy:
    enabled: false
    opaEndpoint: ""

  shadow:
    enabled: false  # Expérimental — middleware Python existe, Rust reporté T4 2026
```

## Conséquences

### Positives

- **Nommage clair** : un composant, plusieurs modes
- **Langage unique** (Rust) pour tout nouveau code gateway
- **Migration incrémentale** réduit les risques
- **Pas de changements cassants** pendant la transition
- **Différenciation mode Shadow** : auto-génération UAC depuis le trafic observé

### Négatives

- **Deux bases de code** pendant la période de transition
- **Surcharge documentaire** : doit clarifier "actuel (Python)" vs "cible (Rust)"
- **Taille du binaire** : quatre modes dans un binaire peut augmenter la taille (atténué par les feature flags)

## Validation

### Persona Contributeur Open Source

> *"Encore un projet qui veut tout faire ? Shadow + Proxy + MCP + Sidecar dans le même binaire ? Ça va être un monstre inmaintenable."*

**Réponse :**
- Cœur commun minimal (gestion HTTP, auth, métriques)
- Modes = feature flags, pas des branches de code séparées
- Shadow est le plus simple (lecture seule)
- La complexité augmente progressivement : Shadow &lt; Proxy &lt; Sidecar &lt; Edge-MCP

### Persona Architecte Enterprise

> *"Le mode Shadow c'est exactement ce qu'il nous faut pour les progiciels. On a 50 APIs non documentées, les éditeurs ne répondent plus, les devs d'origine sont partis."*

**Validé :**
- ✅ Shadow = risque minimal (passif, lecture seule)
- ✅ Génération UAC = documentation automatique
- ✅ Progression naturelle : Shadow → Proxy → Gouvernance complète
- ✅ Compatible avec les gateways existants (mode sidecar)

> *"Par contre, comment on gère la transition Shadow → Proxy sans coupure ?"*

**Réponse :**
- Double mode : Shadow continue d'observer pendant que Proxy applique
- Canary : 10% via Proxy, 90% direct, 100% observé
- Feature flag : `shadow.keep_observing=true` même en mode Proxy

## Pitch Commercial (30 secondes)

> "Vous avez des APIs legacy sans documentation ? Déployez STOA en mode Shadow pendant 2 semaines. Il observe le trafic et auto-génère des contrats d'interface avec un impact minimal sur l'infrastructure existante. Ensuite, vous décidez : garder uniquement les docs, ou activer la gouvernance."

## Références

- [Spécification MCP](https://modelcontextprotocol.io/)
- [Schéma UAC STOA](https://github.com/stoa-platform/stoa/blob/main/stoa-catalog/schemas/uac.schema.json)
- [Audit Sécurité P0 Team Coca](./adr-018-security-hardening-p0.md)

## Journal des Décisions

| Date | Décision | Auteur |
|------|----------|--------|
| 2026-01-26 | ADR créé, architecture unifiée adoptée | CAB-958 |
| 2026-01-26 | Mode Shadow reporté pour revue sécurité | Team Coca |
| 2026-01-26 | Ajout configs YAML, stratégie de transition, personas de validation | CAB-958 |

---

*Standard Marchemalo : Un architecte vétéran de 40 ans comprend en 30 secondes ✅*
