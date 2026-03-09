---
title: "ADR-041 : Architecture Plugin — Core Communautaire vs Extensions Entreprise"
description: "Décision d'architecture pour la livraison de fonctionnalités à plusieurs niveaux : un Core Communautaire sécurisé et batteries incluses pour les freelances et développeurs indépendants, avec des Extensions Entreprise opt-in pour les grandes organisations. MCP-vers-tout comme différenciateur central."
keywords: [ADR, plugin, communauté, entreprise, MCP, feature-flags, keychain, sécurité, OpenAPI, bridge, stoactl]
---

# ADR-041 : Architecture Plugin — Core Communautaire vs Extensions Entreprise

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-12 |
| **Décideurs** | Christophe ABOULICAM, Platform Team |
| **Linear** | CAB-1136 |

### Décisions Associées

- **ADR-024** : Modes Unifiés du Gateway — 4 modes de déploiement (edge-mcp, sidecar, proxy, shadow)
- **ADR-037** : Modes de Déploiement Souveraineté d'Abord — niveaux Souverain, Hybride, SaaS
- **ADR-039** : Authentification Mutuelle mTLS — authentification par certificat de niveau entreprise
- **ADR-040** : Born GitOps — Architecture de promotion multi-environnement

## Contexte

### Le Problème

STOA dispose de 559 tests de gateway, mTLS, circuit breakers, RBAC multi-tenant, fédération OIDC et métriques Kafka. Tout cela est invisible pour un freelance qui veut simplement exposer son API REST aux agents IA via MCP.

Aujourd'hui, il n'existe pas de `stoa init`. Pas de chemin de 30 secondes de zéro au premier appel MCP. La plateforme est prête pour l'entreprise mais hostile à la communauté.

Pendant ce temps, le paysage concurrentiel a évolué de façon spectaculaire :

<!-- last verified: 2026-02 -->

| Plateforme | Support MCP | Open Source | Niveau Communautaire | « MCP vers Tout » |
|------------|-------------|-------------|---------------------|-------------------|
| **Kong** | Enterprise MCP Gateway + Context Mesh (fév. 2026) | Community Edition (BSL pour les fonctionnalités enterprise) | Limité — pas de MCP dans OSS | APIs gérées par Kong uniquement |
| **Gravitee** | 4.10 MCP Proxy + AI Agent Management (jan. 2026) | OSS (fonctionnalités enterprise limitées) | Limité — MCP est enterprise | APIs gérées par Gravitee uniquement |
| **STOA** | MCP Gateway (Rust, production) | Apache 2.0 (pas de BSL, pas de limitation de fonctionnalités) | **Manquant** | **N'importe quelle API, n'importe quel protocole** |

### L'Insight : MCP vers Tout, Pas MCP vers MCP

Kong transforme les APIs **déjà gérées par Kong** en outils MCP. Gravitee proxyfie le trafic MCP **entre des composants compatibles MCP**. Aucun ne fait le pont entre les backends non-MCP et MCP.

Le différenciateur de STOA est **MCP vers Tout** :

```
REST API      ──→ UAC ──→ MCP Tools
SOAP Service  ──→ UAC ──→ MCP Tools
GraphQL API   ──→ UAC ──→ MCP Tools
gRPC Service  ──→ UAC ──→ MCP Tools
Legacy HTTP   ──→ UAC ──→ MCP Tools
```

L'UAC (Universal API Contract) est la couche de traduction. « Define Once, Expose Everywhere » — y compris aux agents IA.

### La Question Stratégique

> Comment rendre STOA accessible aux freelances en 30 secondes tout en gardant les fonctionnalités enterprise disponibles pour les grandes organisations ?

## Décision

### Principe #1 : La Sécurité n'est pas un Niveau

Les fonctionnalités de sécurité sont **toujours incluses**, même dans le Core Communautaire gratuit. Le stockage des identifiants utilise le keychain du système d'exploitation par défaut — jamais des fichiers en clair. C'est un principe de conception fondamental, pas une fonctionnalité premium.

Cela positionne STOA contre chaque concurrent :
- Kong : tokens admin dans les en-têtes, pas de keychain natif
- kubectl : tokens en clair dans `~/.kube/config`
- AWS CLI : identifiants en clair dans `~/.aws/credentials`
- Docker : tokens en base64 (pas chiffrés) dans `~/.docker/config.json`

### Principe #2 : Core Communautaire = Produit Complet

Le Core Communautaire n'est pas un essai bridé. C'est un gateway API-vers-MCP entièrement fonctionnel qu'un freelance peut utiliser en production, pour toujours, gratuitement.

### Principe #3 : Extensions Entreprise = Activation Opt-In

Les fonctionnalités enterprise sont déjà implémentées dans la codebase. Elles sont activées via des feature flags Cargo, de la configuration, ou la configuration Keycloak — pas via des clés de licence ou des paywalls.

### Architecture à Deux Niveaux

#### Niveau 1 — Core Communautaire (Apache 2.0, gratuit pour toujours)

| Catégorie | Fonctionnalité | Statut |
|----------|---------------|--------|
| **Gateway** | Proxy + routage | ✅ Implémenté |
| **Gateway** | Rate limiting | ✅ Implémenté |
| **Gateway** | Authentification API key | ✅ Implémenté |
| **Gateway** | Protection SSRF | ✅ Implémenté |
| **Gateway** | En-têtes de sécurité | ✅ Implémenté |
| **Gateway** | Métriques Prometheus | ✅ Implémenté |
| **Bridge** | Auto-bridge OpenAPI → MCP | **À construire** |
| **Bridge** | Bridge SOAP (WSDL) → MCP | Planifié (T3) |
| **Bridge** | Bridge GraphQL → MCP | Planifié (T3) |
| **CLI** | `stoactl init` (scaffold de projet) | **À construire** |
| **CLI** | `stoactl bridge` (import + exposition) | **À construire** |
| **CLI** | `stoactl doctor` (diagnostic) | **À construire** |
| **Sécurité** | Stockage d'identifiants OS Keychain | **À construire** |
| **Sécurité** | Rotation de clé (`stoactl auth rotate-key`) | **À construire** |
| **Sécurité** | Journal d'audit d'accès aux identifiants | **À construire** |
| **Packaging** | Image Docker `stoa:community` | **À construire** |
| **Docs** | Guide « Démarrer en 5 Minutes » | **À construire** |

#### Niveau 2 — Extensions Entreprise (opt-in, même licence Apache 2.0)

| Catégorie | Fonctionnalité | Activation | Statut |
|----------|---------------|------------|--------|
| **Auth** | Authentification mutuelle mTLS | Config + `--features mtls` | ✅ Implémenté (PR #224) |
| **Auth** | Fédération OIDC (multi-realm) | Config Keycloak | ✅ Implémenté |
| **Auth** | RBAC multi-tenant | Config Keycloak | ✅ Implémenté |
| **Résilience** | Circuit breaker | Config gateway | ✅ Implémenté (PR #218) |
| **Observabilité** | Métriques Kafka | `--features kafka` | ✅ Implémenté |
| **Observabilité** | Traçage OpenTelemetry | `--features otel` | Planifié |
| **Déploiement** | Mode sidecar (Kong/Envoy/NGINX) | `STOA_MODE=sidecar` | Stub (T2) |
| **Déploiement** | Mode shadow (trafic → auto-gen UAC) | `STOA_MODE=shadow` | Partiel |
| **Déploiement** | Watcher CRD K8s + fédération | `--features k8s` | Planifié |
| **Déploiement** | Promotion multi-environnement | GitOps (ADR-040) | ✅ Implémenté |
| **Packaging** | Image Docker `stoa:enterprise` | Toutes les fonctionnalités compilées | **À construire** |
| **Support** | SLA + consulting | Contrat commercial | — |

### Architecture de Stockage des Identifiants

Les clés API et tokens DOIVENT être stockés dans le keychain du système d'exploitation. Jamais dans des fichiers en clair.

#### Hiérarchie de Résolution (ordre de priorité)

```
1. flag --api-key          (usage unique, jamais persisté)
2. variable d'env STOA_API_KEY    (CI/CD et conteneurs uniquement)
3. OS Keychain             (macOS Keychain / Linux secret-service / Windows Credential Manager)
4. ❌ JAMAIS un fichier en clair
```

#### Implémentation

| OS | Backend | Bibliothèque |
|----|---------|-------------|
| macOS | Security.framework (Keychain) | Go : `go-keyring`, Rust : crate `keyring` |
| Linux | D-Bus Secret Service (GNOME Keyring / KWallet) | Go : `go-keyring`, Rust : crate `keyring` |
| Windows | Credential Manager (WinCred) | Go : `go-keyring`, Rust : crate `keyring` |
| CI/headless | Fallback variable d'env (`STOA_API_KEY`) | Natif |
| Conteneur | Fichier monté (`/run/secrets/stoa`) | Natif |

#### Exigences de Sécurité

- **Auto-rotation** : `stoactl auth rotate-key --auto --interval 90d` planifie la rotation des clés
- **Journal d'audit** : chaque lecture/écriture dans le keychain est journalisée dans `~/.stoa/audit.log` (local, non envoyé)
- **`stoactl auth status`** : affiche « Clé stockée dans : macOS Keychain » (n'affiche jamais la clé elle-même)
- **Pas de `~/.stoa/credentials`** : le fichier ne doit pas exister. Si détecté, `stoactl doctor` avertit et propose une migration

### Le Chemin en 30 Secondes : `stoactl init` → `stoactl bridge`

```bash
# Freelance : de zéro à MCP en 30 secondes
$ stoactl init my-project
✓ Created docker-compose.yml (gateway + echo backend)
✓ Created stoa.yaml (minimal config)
✓ Run: cd my-project && docker compose up -d

$ stoactl bridge ./openapi.yaml
✓ Parsed OpenAPI 3.x spec
✓ Generated 8 MCP tools from 8 endpoints
✓ Registered tools on gateway
✓ MCP endpoint: http://localhost:8080/mcp/sse

# Terminé. N'importe quel client MCP (Claude, GPT, etc.) peut appeler votre API.
```

#### `stoactl doctor`

Commande de diagnostic qui vérifie la pile complète :

```bash
$ stoactl doctor
✓ Docker: running (v27.5.1)
✓ Gateway: healthy (http://localhost:8080/health)
✓ Keychain: accessible (macOS Keychain)
✓ API key: valid (expires in 87 days)
✓ Port 8080: available
✓ MCP endpoint: responding (3 tools registered)
✗ OpenAPI spec: 2 warnings (circular ref in #/components/schemas/Node)
```

### Chemin de Croissance

Le même utilisateur, la même codebase, évolue du freelance à l'entreprise :

| Étape | Ce qu'ils utilisent | Coût |
|-------|---------------------|------|
| **Jour 1** — Freelance | `stoactl init` + `bridge` → REST vers MCP | 0€ |
| **Jour 30** — En croissance | + API keys pour clients + rate limiting + monitoring | 0€ |
| **Jour 90** — Scale-up | + domaines personnalisés + catalogue multi-API | 0€ |
| **Jour 180** — Entreprise | + mTLS + RBAC + fédération + mode sidecar + SLA | Contrat de support |

### Packaging Docker

Deux images, même Dockerfile avec des build args :

| Image | Fonctionnalités Compilées | Taille Cible | Cas d'Usage |
|-------|--------------------------|--------------|-------------|
| `ghcr.io/stoa-platform/gateway:community` | Par défaut (sans fonctionnalités optionnelles) | < 30 Mo | Freelance, indie, petites équipes |
| `ghcr.io/stoa-platform/gateway:enterprise` | `--all-features` (kafka, k8s, otel, mtls) | < 50 Mo | Grandes organisations |
| `ghcr.io/stoa-platform/gateway:latest` | Alias pour `community` | < 30 Mo | Pull par défaut |

Les deux images sont Apache 2.0. L'image enterprise n'est pas « payante » — elle inclut simplement des dépendances plus lourdes (rdkafka, client k8s, etc.) dont la plupart des freelances n'ont pas besoin.

## Conséquences

### Positives

- **Adoption communautaire** : L'onboarding en 30 secondes supprime la friction n°1
- **Positionnement MCP-vers-tout** : unique vs Kong (MCP-pour-Kong) et Gravitee (proxy MCP-vers-MCP)
- **Sécurité par défaut** : keychain-first est un vrai différenciateur contre chaque concurrent
- **Pas de piège BSL** : Apache 2.0 pour tout, y compris les fonctionnalités enterprise — signal de confiance pour la communauté OSS
- **Upsell enterprise naturel** : même plateforme, même code, il suffit d'activer plus de fonctionnalités + acheter le support

### Négatives

- **Complexité du bridge OpenAPI** : références circulaires, `allOf`/`oneOf`/`anyOf`, discriminateurs, schémas polymorphiques nécessitent un parser robuste — pas un simple mapping
- **Tests keychain multi-OS** : macOS Keychain, GNOME Keyring, KWallet, Windows Credential Manager se comportent tous différemment
- **Deux images Docker = deux pipelines CI** : build matrix, testing matrix, coordination des releases
- **Pas de gate de revenus** : les fonctionnalités enterprise sont gratuites — les revenus viennent uniquement du support/consulting

### Atténuations

- Bridge OpenAPI : utiliser un parser éprouvé (`utoipa` pour Rust, `libopenapi` pour Go) — ne pas le construire à la main
- Keychain : le crate/bibliothèque `keyring` abstrait tous les backends OS derrière une API unique
- Docker : Dockerfile unique avec `ARG FEATURES=""`, `cargo build` conditionnel
- Revenus : le mode shadow est l'argument décisif — « nous analysons gratuitement votre patrimoine de trafic, vous payez pour le consulting de migration »

## Alternatives Considérées

### Alternative A : Licence BSL/SSPL pour les Fonctionnalités Enterprise

Kong et Elastic utilisent BSL (Business Source License) pour limiter les fonctionnalités. Protecteur des revenus mais hostile à la communauté.

**Rejeté** : Le positionnement de STOA est explicitement anti-BSL. Apache 2.0 est un signal de confiance. Changer de licence détruirait la crédibilité avant de la construire.

### Alternative B : Feature Flags via Clé de Licence

Modèle SaaS traditionnel — les fonctionnalités enterprise nécessitent un fichier de clé de licence.

**Rejeté** : ajoute de la complexité, crée une charge de support, ne s'aligne pas avec le principe « la sécurité n'est pas un niveau ». Les feature flags Cargo au moment de la compilation sont plus simples et plus transparents.

### Alternative C : Codebase Enterprise Séparée (Fork)

Maintenir un fork privé avec du code enterprise uniquement.

**Rejeté** : cauchemar de maintenance, conflits de merge, les contributions de la communauté ne peuvent pas bénéficier du durcissement enterprise. Une seule codebase avec des feature flags est strictement meilleure.

## Plan d'Implémentation

### Phase 1 — CLI Communautaire (`stoactl`) — CAB-1136-P1

| Étape | Livrable |
|-------|---------|
| 1 | `stoactl init` — scaffold de projet (docker-compose + config) |
| 2 | `stoactl doctor` — commande de diagnostic |
| 3 | Intégration Keychain (`go-keyring`) — stocker/récupérer/rotation des clés API |
| 4 | `stoactl auth` — login, status, rotate-key avec backend keychain |
| 5 | Journal d'audit pour l'accès aux identifiants |

### Phase 2 — Bridge OpenAPI-vers-MCP — CAB-1136-P2

| Étape | Livrable |
|-------|---------|
| 1 | Parser OpenAPI 3.x (gérer les refs, allOf/oneOf/anyOf, refs circulaires) |
| 2 | Générateur d'outils MCP (endpoint → mapping d'outil, extraction de paramètres) |
| 3 | Commande `stoactl bridge` (parser + générer + enregistrer sur gateway) |
| 4 | Hot-reload : file watcher sur le fichier spec, mise à jour automatique des outils lors de changements |

### Phase 3 — Packaging Docker + Documentation — CAB-1136-P3

| Étape | Livrable |
|-------|---------|
| 1 | Dockerfile avec `ARG FEATURES` pour les builds community/enterprise |
| 2 | Pipeline CI pour build + push de double image |
| 3 | Guide « Démarrer en 5 Minutes » sur docs.gostoa.dev |
| 4 | Documentation de référence sur les toggles de fonctionnalités |

### Phase 4 — Bridges de Protocoles Étendus — CAB-1136-P4

| Étape | Livrable |
|-------|---------|
| 1 | Bridge SOAP (WSDL) → UAC → MCP |
| 2 | Bridge GraphQL (introspection) → UAC → MCP |
| 3 | Bridge gRPC (proto) → UAC → MCP |

## Résumé du Positionnement Concurrentiel

```
Kong:      "MCP pour les APIs gérées par Kong"     → Lock-in vendeur
Gravitee:  "Proxy MCP pour le trafic MCP"          → MCP-vers-MCP uniquement
STOA:      "MCP pour tout"                          → N'importe quelle API, n'importe quel protocole, gratuit pour toujours

Kong:      Enterprise MCP Gateway                   → $$$$
Gravitee:  Enterprise AI Agent Management           → $$$
STOA:      Community Core + stoactl bridge          → 0€, Apache 2.0

Kong:      Identifiants dans les en-têtes           → Pas sécurisé par défaut
Gravitee:  Fichiers de config standard              → Pas sécurisé par défaut
STOA:      OS Keychain par défaut                   → Sécurisé par conception, même niveau gratuit
```

> **« Kong fait MCP pour Kong. Gravitee fait MCP pour Gravitee. STOA fait MCP pour tout le monde. »**

## Références

- [Kong Enterprise MCP Gateway](https://konghq.com/blog/product-releases/enterprise-mcp-gateway) — fév. 2026
- [Annonce Kong Context Mesh](https://konghq.com/company/press-room/press-release/kong-launches-context-mesh-to-connect-enterprise-data-to-ai-agents) — 10 fév. 2026
- [Gravitee 4.10 — IA, MCP, LLMs](https://www.gravitee.io/blog/gravitee-4.10-one-control-point-to-secure-govern-ai-agents-mcp-and-llms) — 22 jan. 2026
- [Spécification du Protocole MCP](https://spec.modelcontextprotocol.io/)
- [Bibliothèque Go Keyring](https://github.com/zalando/go-keyring)
- [Crate Rust keyring](https://crates.io/crates/keyring)
