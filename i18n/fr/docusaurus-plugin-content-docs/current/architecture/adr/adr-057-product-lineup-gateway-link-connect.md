---
title: "ADR-057 : Gamme Produit — STOA Gateway, STOA Link, STOA Connect"
description: "Formalise la gamme de trois produits runtime de STOA : Gateway (K8s full MCP), Link (sidecar K8s) et Connect (agent Go léger pour environnements sans K8s). Définit les frontières, la matrice de choix et le protocole d'enregistrement partagé."
keywords: [gateway, link, connect, sidecar, go, rust, produit, déploiement, on-prem, bare-metal, mcp]
---

# ADR-057 : Gamme Produit — STOA Gateway, STOA Link, STOA Connect

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-14 |
| **Décideurs** | Christophe Aboulicam |
| **Liens** | ADR-024 (Modes Gateway), CAB-1817 (STOA Connect MEGA), CAB-1783 (déploiement STOA Link) |

## Contexte

STOA Platform connecte les APIs à l'écosystème MCP selon le principe « Define Once, Expose Everywhere ». À mesure que l'adoption progresse sur des profils d'infrastructure variés (K8s cloud-native, hybride, bare-metal on-prem), un modèle de déploiement unique ne peut servir tous les clients.

Nous disposons désormais de trois produits runtime distincts, chacun ciblant un contexte de déploiement différent. Cet ADR formalise la gamme produit, leurs frontières respectives et les critères de choix entre eux.

## Décision

### Gamme Produit

| Produit | Runtime | Technologie | Distribution | Cas d'usage principal |
|---------|---------|-------------|-------------|----------------------|
| **STOA Gateway** | Full MCP gateway | Rust (Tokio, axum) | Helm chart, K8s | Gateway AI-native autonome — service MCP, découverte d'outils, chaîne d'auth, politiques |
| **STOA Link** | Sidecar | Rust (même binaire, mode sidecar) | Sidecar pod K8s (ArgoCD) | Enforcement de politiques aux côtés de gateways tierces en K8s (Kong, Gravitee, webMethods, agentGateway) |
| **STOA Connect** | Agent léger | Go | `brew install` / apt / binaire | Connecter des gateways tierces au Control Plane STOA sans Docker ni K8s |

### Frontières Architecturales

```
                    ┌─────────────────────────────────────────┐
                    │          STOA Control Plane              │
                    │   (API, Console, Auth, Portal)           │
                    └────┬──────────┬──────────┬──────────────┘
                         │          │          │
              Registration + Heartbeat Protocol (shared)
                         │          │          │
                ┌────────┴───┐ ┌────┴────┐ ┌───┴──────────┐
                │   Gateway  │ │  Link   │ │   Connect    │
                │   (Rust)   │ │ (Rust)  │ │   (Go)       │
                │            │ │         │ │              │
                │ MCP Serve  │ │ MCP Srv │ │ NO MCP       │
                │ Tool Disc  │ │ Tool Ds │ │ GW Discovery │
                │ Auth Chain │ │ Policy  │ │ Policy Sync  │
                │ Rate Limit │ │ Enforce │ │ Health Mon   │
                │ Metering   │ │ Meter   │ │              │
                └────────────┘ └─────────┘ └──────────────┘
                   K8s only      K8s only    Anywhere
                  (Helm/Argo)  (sidecar pod) (brew/apt/bin)
```

**Frontière critique** : STOA Connect ne sert **pas** le protocole MCP. Il s'agit d'un agent de gestion qui synchronise la configuration et les politiques entre le Control Plane et l'API d'administration d'une gateway tierce. Le service MCP reste exclusif au runtime Rust (Gateway et Link).

### Matrice de Décision — Quel Produit Choisir

```
Dispose d'un cluster K8s ?
├── OUI
│   ├── Remplacer la gateway existante par une full MCP gateway ?
│   │   └── OUI → STOA Gateway
│   │   └── NON → Conserver la gateway existante
│   │       ├── Besoin du MCP + enforcement complet de politiques ?
│   │       │   └── OUI → STOA Link (sidecar)
│   │       └── Besoin uniquement d'une synchronisation légère de politiques ?
│   │           └── OUI → STOA Connect (peut également tourner dans K8s)
│   │           └── NON → STOA Link (sidecar)
└── NON (VPS, bare metal, VM)
    └── STOA Connect (seule option sans K8s)
```

| Critère | Gateway | Link | Connect |
|---------|---------|------|---------|
| **K8s requis** | Oui | Oui | Non |
| **Docker requis** | Oui | Oui | Non |
| **Service du protocole MCP** | Oui | Oui | **Non** |
| **Découverte d'outils** | Oui | Oui | Non |
| **Enforcement de politiques** | Complet (inline) | Complet (sidecar) | Sync (push vers admin API de la GW) |
| **Chaîne d'auth (mTLS, OIDC)** | Oui | Oui | Délégué à la GW |
| **Métering / télémétrie** | Oui | Oui | Reporting de santé uniquement |
| **Surcoût de latence** | ~1-3ms (inline) | ~2-5ms (saut sidecar) | 0ms (sync hors-bande) |
| **Taille du binaire** | ~15 Mo | ~15 Mo (même binaire) | ~8 Mo |
| **Temps d'installation** | Déploiement Helm (~2min) | Sync ArgoCD (~1min) | `brew install` (~10s) |
| **Gateways supportées** | Autonome (sans GW) | Kong, Gravitee, wM, agentGW | Kong, Gravitee, wM |

### Protocole d'Enregistrement CP (Contrat Stable)

Les trois produits partagent le même protocole d'enregistrement avec le Control Plane :

```
POST /v1/internal/gateways/register
{
  "instance_name": "kong-prod-01",
  "gateway_mode": "edge_mcp" | "sidecar" | "connect",
  "version": "0.12.0",
  "features": ["mcp", "policies", "metering"],
  "environment": "production"
}
→ 200 { "gateway_id": "uuid", "heartbeat_interval_s": 30 }

POST /v1/internal/gateways/{gateway_id}/heartbeat
{
  "status": "healthy",
  "uptime_s": 3600,
  "metrics": { "requests_total": 1234 }
}
→ 200 OK
```

**Garanties du contrat** :
- Les chemins d'endpoints sont stables (pas de changement cassant sans ADR)
- Enum `gateway_mode` : `edge_mcp`, `sidecar`, `connect` (les nouveaux modes nécessitent un ADR)
- Intervalle de heartbeat : défini par le serveur (actuellement 30s), le client doit le respecter
- Toutes les instances apparaissent sur la page Console `/gateways/modes` avec leur mode

### Code Partagé (monorepo Go)

STOA Connect et stoactl partagent du code via `github.com/stoa-platform/stoa-go` :

```
stoa-go/
├── cmd/stoactl/          # CLI tool
├── cmd/stoa-connect/     # Connect agent
├── pkg/auth/             # OIDC/PKCE + keyring (shared)
├── pkg/config/           # Multi-context YAML config (shared)
├── pkg/client/           # CP API HTTP client (shared)
└── internal/connect/     # Connect-specific runtime
```

## Conséquences

### Positives
- Adéquation produit-marché claire pour chaque segment (cloud-native, hybride, on-prem)
- « Define Once, Expose Everywhere » devient concret avec 3 chemins de déploiement
- Le protocole d'enregistrement partagé garantit une expérience Console cohérente
- L'agent Go abaisse le seuil d'entrée (sans dépendance K8s/Docker)
- Les packages Go partagés réduisent la maintenance (stoactl + Connect)

### Négatives
- Trois runtimes à maintenir (Rust x2 modes + Go)
- Risque de divergence de protocole entre les implémentations Rust et Go
- Connect ne peut pas offrir le service MCP — les clients souhaitant MCP doivent utiliser Gateway ou Link
- La parité fonctionnelle de l'agent Go sera en retard sur le runtime Rust

### Atténuations
- Le protocole d'enregistrement CP est le contrat d'intégration — testé par les deux runtimes
- La portée de Connect est délibérément limitée (sans MCP) — prévient l'extension de périmètre
- Les packages Go partagés garantissent la cohérence auth/config avec stoactl
- La vérification de plateforme Arena L2 couvre les trois produits

## Alternatives Considérées

1. **Binaire Rust unique pour tous les modes** — Rejeté : le binaire Rust nécessite la chaîne d'outils Docker/K8s. Les clients sans K8s ne peuvent pas l'utiliser. Go fournit une installation native via `brew`/`apt`.

2. **Agent Python (réutiliser la base de code CP API)** — Rejeté : Python nécessite un runtime. Go produit des binaires statiques. De plus, stoactl est déjà en Go — le partage de code est naturel.

3. **Pas d'agent léger (Link uniquement)** — Rejeté : exclut entièrement le marché des VPS on-prem. De nombreuses entreprises européennes font tourner leurs gateways sur bare metal.
