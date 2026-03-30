---
title: "ADR-059 : Architecture de Déploiement Simplifiée — Chemin Unique via SSE"
description: "Décide de remplacer les 3 chemins de déploiement (SyncEngine + inline sync + polling Connect) par un chemin unique basé sur SSE : le CP écrit l'intention, le Link exécute."
keywords: [deployment, sse, sync-engine, stoa-link, stoa-connect, gateway, single-path, event-driven]
---

# ADR-059 — Architecture de Déploiement Simplifiée : Chemin Unique via SSE

**Statut :** Accepté
**Date :** 2026-03-30
**Auteur :** Christophe (CAB Ingénierie)
**Remplace :** Déploiement multi-chemin actuel (SyncEngine + inline sync + polling Connect)
**Council :** 8.00/10 (Go) — Impact 288 (CRITICAL)

---

## Contexte

Le déploiement d'une API vers une gateway emprunte aujourd'hui 3 chemins distincts :

1. **SyncEngine** — cron background qui push HTTP direct vers les gateways
2. **`_try_inline_sync`** — push HTTP synchrone appelé au moment du deploy Console
3. **STOA Connect polling** — l'agent poll `/pending-deployments` et applique localement

Ces 3 chemins ont des guards différents, des comportements différents, des bugs différents. Le SyncEngine avait un guard `self_register` (L278), mais `_try_inline_sync` ne l'avait pas. Des gateway instances fantômes en base provoquent des push vers des hostnames Docker non résolvables. Chaque fix sur un chemin révèle un bug sur un autre.

**Résultat : 4 jours bloqués sur le déploiement d'API, ratio fix/feat à 1:1, régressions en boucle.**

Le modèle multi-path est incompatible avec l'architecture hybride de STOA (CP cloud + gateway on-premise). Le CP cloud ne devrait JAMAIS initier une connexion vers l'on-premise — c'est l'agent on-premise qui initie.

---

## Décision

**Un seul chemin de déploiement. Le CP écrit l'intention, le Link exécute.**

### Chemin unique

```
Console → CP API → SSE push → STOA Link → Gateway → Callback → CP API
```

### Détail du flow

1. Dev clique "Deploy" dans la Console
2. CP API crée un `gateway_deployment` statut **PENDING** en base
3. CP API émet un event SSE sur la connexion du Link ciblé
4. STOA Link reçoit l'event instantanément (connexion SSE maintenue)
5. STOA Link applique le desired state sur la gateway locale
6. STOA Link callback HTTPS vers CP : **SYNCED** ou **FAILED**
7. CP met à jour le statut en base
8. Console affiche le résultat

### SSE — Endpoint CP

```
GET /api/v1/links/{link_id}/events
Headers: Authorization: Bearer <link_token>
Content-Type: text/event-stream
```

Events :
- `deployment.requested` — nouveau desired state à appliquer
- `deployment.cancelled` — annulation avant exécution

### Reconnexion

Si la connexion SSE tombe, le Link se reconnecte automatiquement (natif SSE). Au reconnect, il appelle :

```
GET /api/v1/links/{link_id}/pending-deployments
```

Un seul appel de rattrapage, pas du polling permanent. Cet endpoint retourne tous les deployments PENDING pour ce Link. Une fois rattrapé, le Link repasse en mode SSE.

### Git — Side-effect asynchrone

Après un deploy SYNCED, le CP commit le desired state (UAC YAML) dans le repo Git. Non-bloquant. Git est l'archive (audit trail, versioning, rollback via `git revert`), pas le bus de déploiement. Si Git est indisponible, le deploy fonctionne quand même.

---

## Ce qu'on supprime

| Composant | Raison de suppression |
|---|---|
| **SyncEngine** (cron background) | Push HTTP direct CP → gateway. Viole le modèle hybride. |
| **`_try_inline_sync`** | Push HTTP synchrone au deploy. Même problème. |
| **Polling `/pending-deployments`** en mode cron | Remplacé par SSE temps réel + rattrapage au reconnect. |
| **`gateway_instance.base_url`** utilisé pour push | Le CP n'appelle plus les gateways. Champ conservé pour info, jamais utilisé pour HTTP. |
| **Concept de gateway "push" côté CP** | N'existe plus. Toutes les gateways sont pull/SSE. |

## Ce qu'on conserve

| Composant | Rôle |
|---|---|
| **`gateway_deployments` table** | Source de vérité des déploiements (PENDING → SYNCED/FAILED) |
| **STOA Link / Connect** | Agent on-premise, maintient la connexion SSE, exécute les deploys |
| **Callback HTTPS Link → CP** | Report de statut après exécution |
| **Kafka events** | Side-effects non-bloquants : notifications, audit, observabilité |
| **Git commits** | Archive asynchrone : audit trail, versioning, rollback |

---

## Détection de Drift — Post-SyncEngine

Le SyncEngine actuel exécute `_detect_drift()` en comparant `spec_hash` sur les deployments SYNCED. Avec sa suppression, la détection de drift migre côté Link :

**Mécanisme :** Le Link reporte périodiquement (toutes les 5 min) l'état réel de la gateway via un callback `state.report` vers le CP. Le CP compare l'état reporté avec le desired state en base. En cas de divergence → event `drift.detected` émis sur SSE → le Link ré-applique le desired state.

**Pour la démo :** Drift detection désactivée. Le flow est linéaire (deploy → sync → done). La détection de drift est post-démo P1.

---

## Kafka — Sort des Topics

| Topic | Décision | Raison |
|---|---|---|
| `gateway-sync-requests` | **Supprimé** | Était consommé par SyncEngine pour déclencher des push. Plus de push. |
| `gateway-events` | **Conservé** | Utilisé pour les side-effects : notifications, audit trail, observabilité. Le CP émet `deployment.synced` / `deployment.failed` après le callback du Link. |
| `api-catalog-events` | **Inchangé** | Pas lié au deploy. |

---

## Scope — Les 5 Boucles stoa-connect

Le client Go `stoa-connect` a 5 boucles indépendantes. Cette ADR n'en affecte qu'une :

| Boucle | Impact ADR-059 | Détail |
|---|---|---|
| **Deployment sync** | **SSE remplace le polling** | Polling cron → SSE listener + catch-up au reconnect |
| Heartbeat | Inchangé | Ping périodique CP → Link alive |
| Route sync | Inchangé | Synchronisation des routes gateway → CP |
| Discovery | Inchangé | Auto-découverte des APIs sur la gateway |
| Credential sync | Inchangé | Synchronisation des credentials Vault → gateway |

---

## Naming — Link vs Connect

**"STOA Link"** est le concept produit (branding validé Feb 2026, voir ADR-057). Ex: "STOA Link for webMethods."

**`stoa-connect`** est le binaire Go (`stoa-go/cmd/stoa-connect/`). Pas de rename du binaire dans cette ADR — c'est un sujet cosmétique post-démo.

Dans cette ADR, "Link" = le concept et l'agent. Le code reste `stoa-connect` pour l'instant.

---

## Limitations Connues

### EventBus Multi-replica (P1 post-démo)

L'EventBus actuel est **in-memory** (CAB-1420). Avec un seul replica CP API, ça fonctionne. Avec N replicas derrière un load balancer, un event émis sur le replica A ne sera pas vu par la connexion SSE sur le replica B.

**Pour la démo :** 1 seul replica CP API. Pas de problème.

**Post-démo :** Migrer l'EventBus vers PostgreSQL `LISTEN/NOTIFY` (déjà dans le stack, zéro dépendance nouvelle). Alternative : Redis PubSub si les volumes d'events justifient la séparation.

### Auth SSE vs Auth Console

Deux endpoints SSE coexistent avec des modèles d'auth différents :

| Endpoint | Audience | Auth |
|---|---|---|
| `/v1/events/stream/{tenant_id}` (existant) | Console frontend | JWT Keycloak |
| `/api/v1/links/{link_id}/events` (nouveau) | STOA Link agent | `X-Gateway-Key` (existant) |

Bonne séparation des concerns. Pas de confusion possible.

### Taille du Payload de Rattrapage (P2 post-démo)

L'endpoint `/pending-deployments` retourne tous les deployments PENDING pour un Link en un seul appel. Si le Link a été déconnecté longtemps (heures/jours), la réponse peut contenir des dizaines de deployments.

**Pour la démo :** Volume négligeable (1-5 deployments max). Pas de problème.

**Post-démo :** Ajouter `?limit=50&offset=0` sur l'endpoint. Le Link pagine jusqu'à épuisement du backlog, puis repasse en mode SSE. Priorité P2 — ne bloque que si un Link est déconnecté pendant des jours avec un volume de deploy élevé.

### Rollback & Déploiement Progressif

**Feature flag** : `DEPLOY_MODE` (env var CP API)

| Valeur | Comportement | Quand |
|---|---|---|
| `sse_only` (défaut post-ADR) | Seul le chemin SSE est actif. SyncEngine et inline sync supprimés. | Cible finale |
| `dual` | SSE actif + SyncEngine conservé en fallback read-only (drift detection uniquement, pas de push). | Transition post-démo si problème SSE |
| `legacy` | Ancien comportement (SyncEngine + inline sync). SSE désactivé. | Rollback d'urgence |

**Stratégie de migration :**
1. Merge avec `DEPLOY_MODE=dual` — SSE actif, SyncEngine réduit au drift detection
2. Valider en staging pendant 48h (métriques : events SSE émis vs callbacks reçus)
3. Basculer `DEPLOY_MODE=sse_only` — supprimer le code SyncEngine dans un PR de cleanup séparé
4. Si incident en production → rollback `DEPLOY_MODE=legacy` via Helm values, redéploiement < 5 min

**Pour la démo :** `sse_only` directement (pas de legacy gateways à gérer).

---

## Auth, Monitoring, Rate Limiting — Post-démo

Ces concerns sont réels mais ne nécessitent PAS un nouveau composant. Ce sont des features incrémentales sur le CP :

### Auth des Links
- Chaque Link s'authentifie avec un token (existant) ou mTLS (post-démo, CAB-1873)
- Le token est provisionné à l'installation du Link
- Le CP identifie chaque connexion SSE

### Monitoring
- Prometheus métrique `stoa_link_connections_active{link_id, environment}`
- Grafana dashboard "Links Health" : connexions, latence callback, events pending
- Déjà dans le stack (Prometheus + Grafana déployés)

### Rate Limiting
- Middleware FastAPI sur l'endpoint SSE : max reconnexions/minute par Link
- Middleware sur le callback : max requests/seconde par Link
- Fallback : Cloudflare rate limiting en frontal

### Priorité
| Feature | Quand |
|---|---|
| Token auth (existant) | Démo (déjà en place) |
| Rate limiting middleware | Post-démo P1 |
| Monitoring dashboard Links | Post-démo P1 |
| mTLS par Link | Post-démo P2 |

---

## Conséquences

### Positives
- **1 seul chemin** de déploiement au lieu de 3 → 3x moins de surface de bugs
- **Latence quasi nulle** — SSE push instantané vs polling 30s
- **Firewall-friendly** — c'est le Link on-premise qui initie la connexion sortante HTTPS
- **Moins de code** — suppression de SyncEngine + inline sync = soustraction nette
- **Cohérent avec le positionnement** — "Define Once, Expose Everywhere" = CP définit, Links exposent
- **Le CP ne connaît plus les gateways** — il connaît les Links, qui eux connaissent leurs gateways

### Négatives
- **Latence perçue en Console** — le deploy n'est plus "instantané" (l'ancien push donnait un faux positif de succès immédiat). Le statut passe par PENDING → SYNCED. L'UX doit refléter ça (spinner, puis confirmation).
- **Dépendance à la connexion SSE** — si le Link perd la connexion, les deploys s'accumulent en PENDING jusqu'au reconnect. Le mécanisme de rattrapage couvre ce cas.

### Risques
- **Migration des données** — les gateway_instances existantes avec `source != self_register` doivent être migrées ou supprimées
- **STOA Connect Go** — le client Go doit implémenter le SSE listener (bibliothèque standard `net/http` ou `r3labs/sse`)

---

## Implémentation — MEGA "Deploy Single Path"

### Sous-tâche 1 — CP : Endpoint SSE + simplification deploy
- Créer `GET /api/v1/links/{link_id}/events` (SSE endpoint)
- Simplifier `deploy_api_to_env` : écrire PENDING + émettre SSE event. Rien d'autre.
- Supprimer `_try_inline_sync`
- Supprimer `SyncEngine`
- Conserver `GET /api/v1/links/{link_id}/pending-deployments` pour le rattrapage reconnect

### Sous-tâche 2 — Link : SSE client + exécution
- Remplacer le polling cron par un SSE listener sur `/events`
- Au reconnect : appeler `/pending-deployments` une fois, traiter le backlog, repasser en SSE
- Le reste (apply sur gateway + callback) ne change pas

### Sous-tâche 3 — Nettoyage données
- Supprimer les gateway instances fantômes en base
- Migrer les instances `source != self_register` ou les supprimer
- Vérifier : 1 Link = 1 gateway instance par environnement

### Sous-tâche 4 — Test E2E
- Script qui déroule le parcours démo complet :
  1. Créer API dans Console
  2. Deploy sur dev
  3. Vérifier SSE event reçu par Link
  4. Vérifier callback SYNCED
  5. Vérifier statut dans Console
- Ce script = critère de DONE du MEGA
