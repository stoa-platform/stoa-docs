---
title: "ADR-036 : Auto-Enregistrement du Gateway"
description: "Décide du mécanisme d'enregistrement automatique du gateway, où les gateways s'auto-enregistrent auprès du Control Plane au démarrage via heartbeat."
keywords: [enregistrement gateway, auto-découverte, heartbeat, Control Plane, opérations]
---

# ADR-036 : Auto-Enregistrement du Gateway

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Accepté |
| **Date** | 2026-02-06 |
| **Migré depuis** | ADR-028 du repo stoa (conflit de numéro) |

## Contexte

Le Control Plane STOA requiert actuellement un enregistrement manuel du gateway via `POST /v1/admin/gateways`. Cela génère des frictions opérationnelles :

- Les opérateurs doivent copier/coller des UUIDs et des URLs dans les requêtes d'enregistrement
- Les redémarrages du gateway ne préservent pas l'état d'enregistrement dans les déploiements sans état
- Les gateways tiers (Kong, Envoy, Apigee) nécessitent une intégration personnalisée par vendeur
- Pas de visibilité en temps réel sur la santé du gateway entre les vérifications de santé explicites

**Comparaison avec le marché :**

| Plateforme | Modèle d'enregistrement | Mécanisme |
|------------|------------------------|-----------|
| Apple iCloud | Automatique | Certificat d'appareil + Apple ID |
| Kubernetes | Auto-enregistrement | Bootstrap tokens, heartbeat kubelet |
| HashiCorp Consul | Auto-jointure | Protocole gossip, heartbeat agent |
| HashiCorp Vault | Manuel | Unsealing basé sur token |

L'expérience « écosystème Apple » — où les appareils s'associent de façon transparente — est l'UX cible pour les gateways STOA.

## Décision

Implémenter l'**Auto-Enregistrement du Gateway** : les gateways s'auto-enregistrent auprès du Control Plane au démarrage en utilisant une clé API partagée, puis maintiennent leur présence via heartbeat périodique.

### Architecture à Deux Niveaux

**Niveau 1 : Gateways Natifs STOA** (Intégration Complète)

- Zéro configuration : uniquement 2 variables d'environnement
  - `STOA_CONTROL_PLANE_URL` — Endpoint de l'API Control Plane
  - `STOA_CONTROL_PLANE_API_KEY` — Secret partagé pour l'authentification
- Le gateway dérive son identité depuis le hostname + mode + environnement
- Intégration bidirectionnelle complète :
  - Synchronisation des APIs (CP → Gateway via API admin)
  - Push de politiques (CP → Gateway)
  - Enregistrement des outils MCP
  - Métriques vers Kafka

**Niveau 2 : Gateways Tiers (Pattern Sidecar)**

- Déployer un sidecar STOA à côté du gateway existant (Kong, Envoy, Apigee, NGINX, AWS)
- Le sidecar s'auto-enregistre en tant que type `stoa_sidecar` avec un ensemble de capacités réduit
- Le gateway principal utilise le filtre `ext_authz` → sidecar pour les politiques/métriques
- Le sidecar fournit : application de politiques, rate limiting, métriques, observabilité

### Protocole d'Enregistrement

```
┌─────────────┐                    ┌─────────────────┐
│   Gateway   │                    │  Control Plane  │
└──────┬──────┘                    └────────┬────────┘
       │                                    │
       │  1. POST /v1/internal/gateways/register
       │     { hostname, mode, version,     │
       │       environment, capabilities,   │
       │       admin_url }                  │
       │  Header: X-Gateway-Key: gw_xxx    │
       ├───────────────────────────────────►│
       │                                    │
       │  2. 201 Created                    │
       │     { id, name, status: "online" } │
       │◄───────────────────────────────────┤
       │                                    │
       │  3. Toutes les 30s : POST /{id}/heartbeat
       │     { uptime, routes, policies,    │
       │       requests_total, error_rate } │
       ├───────────────────────────────────►│
       │                                    │
       │  4. 204 No Content                 │
       │◄───────────────────────────────────┤
       │                                    │
       │  [Si pas de heartbeat pendant 90s] │
       │                                    │
       │                    Gateway marqué  │
       │                    OFFLINE         │
       │                                    │
```

### Dérivation d'Identité

Le nom d'instance est déterministe : `{hostname}-{mode}-{environment}`

Exemples :
- `stoa-gateway-7f8b9c-edgemcp-prod` — Gateway edge-mcp de production
- `stoa-sidecar-kong-abc123-sidecar-staging` — Sidecar de staging aux côtés de Kong

Cela permet :
- Un enregistrement idempotent (le même gateway se ré-enregistre au redémarrage)
- Un nommage clair dans l'UI Console
- Un filtrage basé sur l'environnement

### Modèle de Sécurité

| Aspect | Conception | Justification |
|--------|-----------|--------------|
| Authentification | Clé API partagée par environnement | Simple, faible barrière d'adoption |
| Transmission de clé | Header `X-Gateway-Key` sur HTTPS | Pattern de header standard |
| Stockage de clé | K8s Secret, injecté comme variable d'environnement | Pas de secrets dans le code ou les fichiers de config |
| Rotation de clé | Liste séparée par virgules supportée | Mises à jour progressives sans interruption |
| Exposition d'endpoint | `/v1/internal/*` non exposé sur l'ingress public | Trafic interne uniquement |

### Déclaration de Capacités

Les gateways déclarent leurs capacités à l'enregistrement :

```json
{
  "capabilities": [
    "rest",
    "mcp",
    "sse",
    "oidc",
    "rate_limiting",
    "ext_authz",
    "metering"
  ]
}
```

Le Control Plane utilise les capacités pour :
- Filtrer quels gateways peuvent recevoir des déploiements spécifiques
- Afficher des badges de fonctionnalités précis dans l'UI Console
- Router les requêtes MCP vers les gateways capables

## Conséquences

### Positives

- **Onboarding sans friction** : Démarrer le gateway avec 2 variables d'env → apparaît dans la Console en 5 secondes
- **Statut en temps réel** : Le heartbeat fournit une visibilité sub-minute sur la santé du gateway
- **Expérience unifiée** : Même pattern d'enregistrement pour les gateways natifs et sidecar
- **Auto-guérison** : Le redémarrage du gateway se ré-enregistre automatiquement, sans intervention manuelle
- **Routing conscient des capacités** : Le CP sait ce que chaque gateway peut gérer
- **Idempotent** : Plusieurs enregistrements avec la même identité mettent à jour plutôt que de dupliquer

### Négatives

- **Modèle à secret partagé** : Une clé compromise permet l'enregistrement d'un gateway malveillant
- **Dépendance réseau** : Le gateway nécessite la connectivité au CP au démarrage
- **Trafic heartbeat** : N gateways x 2 requêtes/min (négligeable mais non nul)
- **Délai de démarrage** : Le gateway attend la réponse d'enregistrement avant de servir le trafic

### Atténuations

| Risque | Atténuation |
|--------|-------------|
| Enregistrement non autorisé | Limiter le débit de l'endpoint, journaliser tous les enregistrements avec l'IP source |
| CP indisponible au démarrage | Dégradation gracieuse : le gateway fonctionne en mode autonome |
| Trafic heartbeat | Payload léger, backoff exponentiel sur les erreurs |
| Compromission de clé | Rotation de clé sans redémarrage, journalisation d'audit |

## Alternatives Considérées

### 1. mTLS avec Certificats par Gateway

**Avantages** : Identité cryptographiquement forte, pas de secrets partagés
**Inconvénients** : Configuration PKI complexe, surcharge de rotation de certificats
**Verdict** : Différé à la Phase 2 pour les déploiements haute sécurité

### 2. Découverte Push (CP → Gateways)

**Avantages** : Le CP contrôle le timing, pas d'endpoint d'enregistrement nécessaire
**Inconvénients** : Nécessite un chemin réseau du CP vers tous les gateways, bloqué par NAT/firewalls
**Verdict** : Rejeté — le modèle pull fonctionne pour toutes les topologies réseau

### 3. Découverte de Services Kubernetes Uniquement

**Avantages** : Intégration K8s native, pas d'enregistrement personnalisé
**Inconvénients** : K8s uniquement, ne fonctionne pas pour les déploiements VM/bare-metal
**Verdict** : Rejeté — STOA doit supporter les environnements non-K8s

### 4. Enregistrement Manuel (Statu Quo)

**Avantages** : Contrôle explicite, pas de nouveau code
**Inconvénients** : Frictions opérationnelles, ne passe pas à l'échelle
**Verdict** : Reste disponible pour les intégrations brownfield

## Notes d'Implémentation

### Control Plane (Python)

1. Nouveau router : `src/routers/gateway_internal.py`
   - `POST /v1/internal/gateways/register` — Auto-enregistrement
   - `POST /v1/internal/gateways/{id}/heartbeat` — Heartbeat

2. Nouveau worker : `src/workers/gateway_health_worker.py`
   - S'exécute toutes les 30s
   - Marque les gateways OFFLINE si `last_health_check < now() - 90s`

3. Config : `STOA_GATEWAY_API_KEYS` — Liste de clés valides séparées par virgules

### STOA Gateway (Rust)

1. Nouveau module : `src/control_plane/registration.rs`
   - `GatewayRegistrar::register()` — Appelé au démarrage
   - `GatewayRegistrar::start_heartbeat()` — Tâche tokio en arrière-plan

2. Ajouts de configuration :
   - `environment` — Pour la dérivation d'identité (défaut : "dev")

### Nouveau Type de Gateway

Ajouter `STOA_SIDECAR` à l'enum `GatewayType` pour les sidecars avec capacités réduites.

## Statut d'Implémentation

| Composant | Statut | PR |
|-----------|--------|-----|
| Control Plane API — enregistrement, heartbeat, health worker | ✅ Terminé | — |
| Control Plane API — récupération de config (déploiements/politiques réels) | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| STOA Gateway (Rust) — enregistrement, heartbeat avec métriques réelles | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| STOA Gateway (Rust) — sonde de readiness approfondie (vérifications CP + OIDC) | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Console UI — auto-refresh, panneau de détails, indicateur en direct | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Chart Helm — `control-plane-api-key` dans le déploiement + ExternalSecret | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| deployment.yaml K8s — documentation des secrets | ✅ Terminé | [#170](https://github.com/stoa-platform/stoa/pull/170) |
| Mode sidecar (Niveau 2) | Planifié | T2 2026 |
| Certificats mTLS par gateway | Planifié | Phase 2 |

## ADRs Associés

- [ADR-035 : Pattern d'Adapter pour Gateway](./adr-035-gateway-adapter-pattern.md) — Définit l'interface utilisée par le CP pour orchestrer les gateways
- [ADR-024 : Architecture Gateway Unifiée](./adr-024-gateway-unified-modes.md) — Définit les modes edge-mcp, sidecar, proxy, shadow
- [ADR-037 : Modes de Déploiement — Souveraineté d'Abord](./adr-037-deployment-modes-sovereign-first.md) — Stratégie de déploiement

## Références

- [Kubernetes Node Heartbeats](https://kubernetes.io/docs/concepts/architecture/nodes/#heartbeats)
- [HashiCorp Consul Agent Registration](https://developer.hashicorp.com/consul/docs/services/usage/register-services-checks)
- [Apple Device Enrollment](https://developer.apple.com/documentation/devicemanagement)
