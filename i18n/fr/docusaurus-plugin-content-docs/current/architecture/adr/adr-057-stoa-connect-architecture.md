---
title: "ADR-057 : Architecture STOA Connect — Agent Gateway VPS"
description: "Décide de l'architecture de stoa-connect, l'agent léger qui connecte les gateways tiers hébergés sur VPS au Control Plane STOA. Couvre le protocole d'enregistrement CP, l'interface adaptateur, l'instrumentation OpenTelemetry et le modèle de déploiement systemd."
keywords: [stoa-connect, vps, agent, gateway, otel, otlp, systemd, adaptateur, kong, gravitee, observabilité]
---

# ADR-057 : Architecture STOA Connect — Agent Gateway VPS

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-18 |
| **Tickets** | CAB-1870, CAB-1871 |
| **Auteur** | Christophe Aboulicam |
| **PRs** | stoa #1851 (migration monorepo), #1853 (OTel core), #1855 (connectivité VPS), #1856 (fix ingress) |

## Contexte

La plateforme STOA gère plusieurs gateways API (Kong, Gravitee, webMethods, Apigee, Azure APIM) via le **pattern Adaptateur** dans l'API Control Plane. Ces adaptateurs fonctionnent bien lorsque l'API d'administration de la gateway est accessible depuis le cluster K8s. Cependant, les gateways hébergées on-premise ou sur VPS sont derrière des pare-feux où les connexions entrantes depuis le Control Plane sont impossibles.

**stoa-connect** résout ce problème en s'exécutant comme agent léger _à côté_ de la gateway sur le VPS. Il initie des connexions sortantes vers le Control Plane, inversant la direction de communication. Aucun port entrant, aucun VPN, aucune modification de pare-feu nécessaire.

### Exigences

1. Connecter les gateways hébergées sur VPS au Control Plane sans connectivité entrante
2. Découvrir automatiquement les APIs sur la gateway locale et les rapporter au CP
3. Synchroniser les politiques du CP vers la gateway locale (rate limits, CORS, auth)
4. Fournir une visibilité de traçage distribué des agents VPS depuis Grafana
5. S'exécuter comme un binaire statique unique sans dépendances (systemd, pas Docker)

## Décision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ VPS (Contabo / OVH / On-Premise)                                │
│                                                                  │
│  ┌──────────────┐    API admin     ┌──────────────────────────┐ │
│  │  Kong /       │ ◄──────────────  │  stoa-connect            │ │
│  │  Gravitee /   │                  │  (binaire Go, systemd)   │ │
│  │  webMethods   │                  │                          │ │
│  └──────────────┘                  │  - Enregistrement        │ │
│                                     │  - Heartbeat (30s)       │ │
│                                     │  - Boucle découverte(60s)│ │
│                                     │  - Boucle sync politiques│ │
│                                     │  - Traces OTel           │ │
│                                     └──────────┬───────────────┘ │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │ HTTPS sortant
                                    ┌──────────────▼──────────────┐
                                    │  API Control Plane           │
                                    │  api.gostoa.dev              │
                                    │                              │
                                    │  POST /v1/internal/gateways/ │
                                    │    register                  │
                                    │    {id}/heartbeat            │
                                    │    {id}/discovery            │
                                    │    {id}/config               │
                                    │    {id}/sync-ack             │
                                    └──────────────────────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  otlp.gostoa.dev             │
                                    │  (ingress nginx → Alloy)     │
                                    │  OTLP/HTTP, auth basique     │
                                    └──────────────────────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  Grafana (Tempo)             │
                                    │  console.gostoa.dev          │
                                    └──────────────────────────────┘
```

### Protocole d'Enregistrement CP

stoa-connect s'enregistre avec `gateway_mode="connect"` au démarrage :

| Étape | Endpoint | Méthode | Payload |
|-------|----------|---------|---------|
| Enregistrement | `/v1/internal/gateways/register` | POST | hostname, mode, version, capabilities |
| Heartbeat | `/v1/internal/gateways/{id}/heartbeat` | POST | uptime, routes_count, discovered_apis |
| Découverte | `/v1/internal/gateways/{id}/discovery` | POST | liste des APIs découvertes |
| Récupérer Config | `/v1/internal/gateways/{id}/config` | GET | — |
| Sync Ack | `/v1/internal/gateways/{id}/sync-ack` | POST | résultats des politiques synchronisées |

Auth : header `X-Gateway-Key` (secret partagé par instance de gateway).

### Interface Adaptateur Gateway (Locale)

stoa-connect utilise une interface adaptateur locale (`adapters.GatewayAdapter`) pour interagir avec l'API d'administration de la gateway co-localisée :

```go
type GatewayAdapter interface {
    DiscoverAPIs(ctx context.Context, adminURL string) ([]DiscoveredAPI, error)
    ApplyPolicy(ctx context.Context, adminURL, name string, action PolicyAction) error
    RemovePolicy(ctx context.Context, adminURL, name string, policyType string) error
}
```

Implémentations : `KongAdapter` (DB-less `/config`), `GraviteeAdapter` (Management API v2). Les nouveaux adaptateurs suivent la même interface — un fichier, trois méthodes.

### Instrumentation OpenTelemetry

Chaque opération de l'agent crée des spans OTel avec des attributs sémantiques :

| Span | Attributs Clés |
|------|---------------|
| `stoa-connect.register` | `stoa.instance_name`, `stoa.environment`, `stoa.gateway_id` |
| `stoa-connect.heartbeat` | `stoa.gateway_id`, `stoa.uptime_seconds`, `stoa.discovered_apis` |
| `stoa-connect.discovery` | `stoa.gateway_id`, `stoa.discovered_apis` |
| `stoa-connect.sync` | `stoa.gateway_id`, `stoa.pending_policies` |
| `stoa-connect.sync.fetch-config` | `stoa.gateway_id`, `stoa.pending_policies` |
| `stoa-connect.sync.ack` | `stoa.policies_applied`, `stoa.policies_removed`, `stoa.policies_failed` |

Le client HTTP est enveloppé avec `otelhttp.NewTransport` pour la propagation automatique W3C `traceparent` vers l'API Control Plane.

#### Dégradation Gracieuse

Si `OTEL_EXPORTER_OTLP_ENDPOINT` n'est pas défini, un traceur no-op est utilisé (surcharge zéro). Le même binaire fonctionne avec ou sans collecteur.

#### Chemin d'Export OTLP (VPS → K8s)

```
stoa-connect → OTLP/HTTP (port 4318) → otlp.gostoa.dev (ingress nginx, auth basique)
             → Alloy (collecteur, namespace monitoring)
             → Tempo (stockage des traces)
             → Grafana (visualisation)
```

- **Protocole** : OTLP/HTTP (pas gRPC) — HTTP/1.1 fonctionne nativement à travers l'ingress nginx sans configuration supplémentaire
- **Auth** : Auth basique via la variable d'environnement `OTEL_EXPORTER_OTLP_HEADERS` (ingress nginx `auth-type: basic`)
- **TLS** : Let's Encrypt via cert-manager (ClusterIssuer `letsencrypt-prod`)
- **Détection du endpoint** : les URLs commençant par `http://` ou `https://` utilisent OTLP/HTTP ; le format `host:port` utilise OTLP/gRPC (pour l'usage interne K8s)

### Modèle de Déploiement

| Aspect | Choix | Justification |
|--------|-------|---------------|
| Binaire | Binaire Go statique unique | Zéro dépendance, déploiement facile via SCP |
| Gestionnaire de processus | systemd | Standard sur tous les VPS Linux, redémarrage en cas d'échec |
| Configuration | `EnvironmentFile=/opt/secrets/stoa-connect.env` | Vault Agent génère les secrets dans le fichier env |
| Sécurité | `NoNewPrivileges`, `ProtectSystem=strict`, `ReadOnlyPaths=/` | Durcissement systemd |
| Repo source | `stoa/stoa-go/` (monorepo) | Modules Go partagés avec stoactl (CAB-1871) |

### Variables d'Environnement

| Variable | Source | Requis | Description |
|----------|--------|--------|-------------|
| `STOA_CONTROL_PLANE_URL` | Vault | Oui | URL de base de l'API CP |
| `STOA_GATEWAY_API_KEY` | Vault | Oui | `X-Gateway-Key` pour les endpoints internes |
| `STOA_INSTANCE_NAME` | systemd | Non | Identifiant d'instance (défaut : hostname) |
| `STOA_ENVIRONMENT` | systemd | Non | Nom d'environnement (défaut : `production`) |
| `STOA_HEARTBEAT_INTERVAL` | systemd | Non | Intervalle heartbeat (défaut `30s`) |
| `STOA_CONNECT_PORT` | systemd | Non | Port du endpoint health (défaut `8090`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | systemd | Non | URL du collecteur OTLP (no-op si absent) |
| `OTEL_EXPORTER_OTLP_HEADERS` | Vault | Non | Header d'auth basique pour l'ingress OTLP |
| `OTEL_SAMPLE_RATE` | systemd | Non | Taux d'échantillonnage 0.0-1.0 (défaut `1.0`) |
| `STOA_DISCOVERY_GATEWAY_ADMIN_URL` | Vault | Non | URL de l'API admin de la gateway locale |
| `STOA_DISCOVERY_GATEWAY_TYPE` | env | Non | Type de gateway : `kong`, `gravitee` |
| `STOA_DISCOVERY_INTERVAL` | env | Non | Intervalle de la boucle de découverte (défaut `60s`) |

## Conséquences

### Positives

- **Aucune règle pare-feu entrante** : les agents VPS initient toutes les connexions en sortie
- **Binaire zéro-dépendance** : pas de Docker, pas de runtime, pas de gestionnaire de paquets — juste SCP et systemd
- **Observabilité complète** : traces distribuées des VPS visibles dans Grafana aux côtés des services K8s
- **Dégradation gracieuse** : le binaire fonctionne de manière identique avec ou sans collecteur OTel
- **Extensibilité des adaptateurs** : ajouter un nouveau type de gateway = un fichier avec trois méthodes

### Négatives

- **Synchronisation pull** : les politiques se synchronisent sur intervalle (60s), pas en push. Acceptable pour les changements de configuration mais pas pour l'enforcement en temps réel
- **Un seul binaire par VPS** : pas de HA — si l'agent plante, systemd le redémarre mais il y a un bref intervalle
- **Auth basique pour OTLP** : pas de mTLS. Acceptable car les traces ne contiennent pas de données personnelles et le canal est chiffré TLS

### Risques

| Risque | Atténuation |
|--------|------------|
| L'agent VPS envoie des heartbeats obsolètes | Le CP marque la gateway "unhealthy" après 3 heartbeats manqués (90s) |
| L'ingress OTLP devient un goulot d'étranglement | Processeur batch Alloy + limite payload 4 Mo + timeout lecture 30s |
| API admin de la gateway indisponible | L'adaptateur retourne une erreur, sync-ack rapporte "failed", nouvelle tentative au cycle suivant |
| Vault Agent pas encore déployé sur les workers | Fichier env statique comme solution intérimaire (CAB-1799 pour Vault Agent) |

## Liens

- [ADR-024 : Modes Gateway](/architecture/adr/adr-024-gateway-modes) — edge-mcp, sidecar, proxy, shadow + connect
- [Adaptateurs Gateway](/concepts/gateway) — pattern adaptateur pour l'orchestration multi-gateway
- CAB-1799 : Vault Agent sur les services VPS (Phase 3 du MEGA secrets)
