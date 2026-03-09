---
title: "ADR-050 : Guardrails V2 — Gestion d'État du Budget de Tokens"
description: "Décide comment la STOA Gateway suit les budgets de tokens par tenant pour les Guardrails V2 : compteurs en mémoire avec sync périodique vers CP API (Option A), évalué contre les compteurs atomiques Redis (Option B) et CP API comme seul magasin d'état (Option C)."
keywords: [guardrails, budget tokens, rate limiting, en mémoire, CP API, Redis, moteur de politique, OPA, filtrage de contenu]
---

# ADR-050 : Guardrails V2 — Gestion d'État du Budget de Tokens

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-22 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-1337 Phase 0 |
| **Council** | 7.25/10 Fix (ajustements appliqués) |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le comptage de tokens se produit en mode edge-mcp
- **ADR-041** : Plugin Architecture — les guardrails sont une fonctionnalité community, pas de restriction enterprise
- **ADR-043** : Pont Kafka MCP — les événements d'épuisement de budget transitent par Kafka
- **ADR-044** : MCP OAuth 2.1 — les budgets de tokens par tenant sont scopés par l'ID tenant Keycloak

## Contexte

Les Guardrails V2 (CAB-1337) étendent la détection PII/injection de V1 avec la gestion de budget de tokens par tenant. Les budgets de tokens appliquent un plafond sur les tokens consommés par tenant par période de temps (horaire, journalier ou mensuel), permettant la gouvernance des coûts pour les déploiements entreprise.

### Baseline Guardrails V1

V1 est implémenté dans `stoa-gateway/src/guardrails/` avec :
- `pii.rs` — détection PII par regex (email, SSN, téléphone, IBAN, carte bancaire)
- `injection.rs` — détection de patterns d'injection de prompt
- Position dans le pipeline : Auth → Rate Limit → **[GUARDRAILS]** → Politique OPA → Cache → Exécution Outil
- Désactivé par défaut (`STOA_GUARDRAILS_PII_ENABLED=false`, `STOA_GUARDRAILS_INJECTION_ENABLED=false`)
- Métriques : `stoa_guardrails_pii_detected_total`, `stoa_guardrails_injection_blocked_total`

### Pourquoi les Budgets de Tokens Nécessitent une Décision de Gestion d'État

Contrairement à la détection PII/injection (sans état par requête), les budgets de tokens sont **avec état** : chaque appel d'outil consomme des tokens, et le total cumulé doit être comparé à la limite du tenant. Cela soulève trois questions de conception :

1. **Où est stocké le total cumulé ?** (en mémoire, Redis ou CP API)
2. **Comment le total est-il récupéré après un redémarrage de la gateway ?**
3. **Que se passe-t-il quand le budget est épuisé ?** (rejeter ou mettre en file d'attente)

### Contraintes

| Contrainte | Détail |
|-----------|--------|
| Budget de latence | Le comptage de tokens ne doit pas ajouter plus de 1ms à la latence p99 des appels d'outils |
| Pas de Redis dans la stack actuelle | Ajouter Redis nécessite une surcharge opérationnelle (HA, TLS, auth, backup) |
| CP API est la source de vérité | Toute la configuration tenant vit dans CP API |
| Réplica gateway unique (actuel) | La synchronisation multi-réplica n'est pas nécessaire aujourd'hui |
| Enforcement approximatif acceptable | Les budgets de tokens sont de la gouvernance des coûts, pas un enforcement critique pour la facturation |
| Tolérance au redémarrage requise | Les redémarrages de la gateway ne doivent pas perdre entièrement le suivi du budget |

## Options Évaluées

### Option A — Compteurs En Mémoire + Sync Périodique vers CP API (Recommandée)

**Architecture** : Chaque instance de gateway maintient des compteurs atomiques en mémoire par tenant. Les compteurs sont périodiquement (toutes les 30s) persistés vers CP API sous forme de snapshots d'utilisation. Au démarrage, la gateway récupère l'utilisation de la période en cours depuis CP API pour restaurer l'état.

```
Appel d'Outil
   │
   ▼
[charger config budget depuis CP API (en cache, TTL=60s)]
   │
   ▼
[incrément atomique en mémoire : tenant_tokens_used += N]
   │
   ▼
[vérifier : utilisé > 80% ? → émettre métrique d'alerte]
[vérifier : utilisé >= 100% ? → rejeter ou mettre en file]
   │
   └── toutes les 30s : POST /v1/tenants/{id}/token-usage { period, tokens_used }

Démarrage Gateway :
   GET /v1/tenants/{id}/token-usage?period=current → restaurer les compteurs
```

**Avantages** :
- Zéro nouvelle infrastructure
- Comptage de tokens en sous-microseconde (opération atomique en mémoire)
- Tolérance au redémarrage via sync CP API au démarrage
- Implémentation simple : `AtomicU64` par tenant, `DashMap<TenantId, AtomicU64>`

**Inconvénients** :
- L'enforcement est approximatif : dans la fenêtre de sync de 30s, un tenant peut dépasser la limite
- Non adapté à un enforcement strict (facturation, conformité) — mais les budgets de tokens sont des limites souples

**Comportement au redémarrage** : au redémarrage, la gateway récupère l'utilisation persistée en dernier. Dérive maximale = 30s d'utilisation (bornée). Acceptable pour les cas d'usage de gouvernance des coûts.

**Estimation de précision** : à 1000 appels d'outils/minute (débit élevé), dépassement max par redémarrage = ~500 appels d'outils × tokens moyens. Pour un budget de 1M tokens/jour, c'est un dépassement inférieur à 0,05%.

---

### Option B — Compteurs Atomiques Redis

**Architecture** : `INCRBY tenant:{id}:tokens:{period} N` sur un cluster Redis. Enforcement exact sur tout nombre de réplicas de gateway.

**Avantages** :
- Enforcement exact (pas de fenêtre de dépassement)
- Fonctionne sur plusieurs réplicas de gateway sans coordination
- TTL natif Redis gère le renouvellement de période

**Inconvénients** :
- Nouvelle dépendance d'infrastructure (Redis 7, configuration HA, TLS, auth, politiques d'éviction)
- Aller-retour réseau par appel d'outil (+1-5ms de surcoût de latence)
- Complexité opérationnelle : monitoring, backup, dimensionnement mémoire
- L'architecture actuelle est mono-réplica — le bénéfice multi-réplica n'est pas réalisé aujourd'hui
- Une panne Redis = comptage de tokens indisponible (nécessite une logique de repli de toute façon)

**Verdict** : surcoût non justifié à l'échelle actuelle. Réévaluer quand la mise à l'échelle horizontale nécessite plus de 3 réplicas et qu'un enforcement strict est une exigence contractuelle.

---

### Option C — CP API comme Seul Magasin d'État

**Architecture** : Chaque appel d'outil effectue un POST synchrone vers CP API pour incrémenter et vérifier le compteur de tokens.

**Avantages** :
- Enforcement exact
- Pas de nouvelle infrastructure
- Persistant par défaut

**Inconvénients** :
- Aller-retour réseau par appel d'outil (+10-50ms — inacceptable)
- Crée un endpoint chaud sur CP API (N appels d'outils/s → N écritures/s)
- CP API devient une dépendance synchrone du chemin critique de la gateway
- Non viable pour tout débit non trivial

**Verdict** : Rejeté. La pénalité de latence est incompatible avec la contrainte de latence sous 1ms.

## Décision

**Option A — Compteurs En Mémoire + Sync Périodique vers CP API.**

Les budgets de tokens sont des **limites souples pour la gouvernance des coûts**, pas un enforcement critique pour la facturation. La fenêtre d'approximation de ~30s est acceptable, et la simplicité du zéro nouvelle infrastructure l'emporte sur la légère imprécision d'enforcement.

### Conception de l'Implémentation

```rust
// stoa-gateway/src/guardrails/token_budget.rs

pub struct TokenBudgetTracker {
    /// Compteurs en mémoire par tenant : tenant_id → tokens utilisés cette période
    counters: DashMap<String, AtomicU64>,
    /// Config budget récupérée depuis CP API (en cache TTL, 60s)
    config_cache: Arc<RwLock<HashMap<String, TenantBudgetConfig>>>,
    /// Intervalle de sync vers CP API
    sync_interval: Duration,
}

pub struct TenantBudgetConfig {
    pub max_tokens_per_period: u64,
    pub period: BudgetPeriod,       // Hourly | Daily | Monthly
    pub alert_threshold_pct: u8,    // défaut 80
    pub exhaustion_policy: ExhaustionPolicy,
}

pub enum ExhaustionPolicy {
    /// Rejeter les appels d'outils quand le budget est épuisé (HTTP 429)
    Reject,
    /// Mettre en file d'attente les appels d'outils (non implémenté en Phase 2, futur)
    Queue,
}

pub enum BudgetCheckResult {
    Allowed,
    AlertThreshold(u8),    // pourcentage utilisé
    Exhausted,
}
```

### Endpoints CP API (nouveaux, Phase 2)

```
GET  /v1/tenants/{id}/token-budget       → TenantBudgetConfig
POST /v1/tenants/{id}/token-usage        → { period, tokens_used } → persisté
GET  /v1/tenants/{id}/token-usage?period=current → { period, tokens_used, last_updated }
```

### Protocole de Sync

```
1. Tâche en arrière-plan s'exécute toutes les 30s par tenant actif
2. Lire la valeur du compteur actuel (AtomicU64::load(Ordering::Relaxed))
3. POST /v1/tenants/{id}/token-usage avec la valeur actuelle
4. Sur réponse : si la période a été renouvelée, remettre le compteur à 0

Au démarrage :
1. Récupérer toutes les configs de budget tenant (batch, un appel)
2. Récupérer l'utilisation de la période en cours pour chaque tenant avec un budget configuré
3. Initialiser les compteurs depuis les valeurs récupérées
4. Démarrer la tâche de sync en arrière-plan
```

### Métriques

| Métrique | Type | Labels | Description |
|--------|------|--------|-------------|
| `stoa_token_budget_used_total` | counter | `tenant_id`, `period` | Total de tokens consommés |
| `stoa_token_budget_exhausted_total` | counter | `tenant_id` | Événements d'épuisement de budget |
| `stoa_token_budget_alert_total` | counter | `tenant_id`, `threshold_pct` | Franchissements de seuil d'alerte |
| `stoa_token_budget_sync_errors_total` | counter | `tenant_id` | Échecs de sync vers CP API |
| `stoa_token_budget_utilization_ratio` | gauge | `tenant_id` | Ratio utilisation/limite actuel (0.0-1.0+) |

## Évaluation du Moteur de Politique Phase 3 — Réutilisation OPA

Le ticket nécessite d'évaluer si réutiliser OPA pour la Phase 3 (moteur de politique pour règles personnalisées) ou construire un nouveau DSL YAML.

### Résultat de l'Évaluation : **Réutiliser OPA** (`regorus`)

La gateway dispose déjà d'un moteur OPA basé sur `regorus` en production (`src/policy/opa.rs`) avec :
- Évaluation pure Rust (pas de sidecar, pas d'appel réseau)
- Latence d'évaluation de politique sous 1ms
- `Arc<RwLock<Engine>>` pour l'accès concurrent et le rechargement à chaud
- Politiques chargées depuis le filesystem ou Rego inline

**Périmètre de la Phase 3** (avec réutilisation OPA) :
1. Ajouter le schéma CRD `GuardrailPolicy` (scopé tenant, isolé par namespace)
2. Étendre le watcher CRD K8s (`src/k8s/`) pour surveiller les ressources `GuardrailPolicy`
3. Sur événement CRD : générer une politique Rego depuis la spec CRD → `engine.write().add_policy()`
4. `check_request()` dans `guardrails/mod.rs` appelle `PolicyEngine.evaluate()` pour l'application des règles personnalisées

Cela remplace le besoin d'un DSL YAML séparé, réutilise ~400 LOC de code existant, et maintient le chemin unique d'évaluation de politique dans le pipeline d'appel d'outil.

**Template Rego pour les règles de filtrage de contenu** :

```rego
package stoa.guardrails.content

default allow = true

# Bloquer si la requête correspond à un pattern bloqué défini par le tenant
deny[reason] {
    pattern := data.rules[_]
    pattern.action == "block"
    regex.match(pattern.pattern, input.content)
    reason := sprintf("Content blocked by rule: %s", [pattern.name])
}

# Rédiger si la requête correspond à un pattern sensible
redact[field] {
    pattern := data.rules[_]
    pattern.action == "redact"
    regex.match(pattern.pattern, input.content)
    field := pattern.field
}
```

**Conclusion** : la Phase 3 est CRD + génération Rego + extension de rechargement à chaud. Aucun nouveau DSL nécessaire.

## Conséquences

### Positives

- Zéro nouvelle infrastructure pour le suivi du budget de tokens
- Tolérant aux redémarrages avec dérive bornée (fenêtre sous 30s)
- Séparation nette : la gateway gère le comptage en temps réel, CP API gère la persistance
- La réutilisation OPA simplifie significativement la Phase 3 (réutilise la base de code existante)
- Les seuils d'alerte (80%/90%/100%) permettent une gouvernance proactive des coûts

### Négatives

- L'enforcement du budget de tokens est approximatif (fenêtre 30s). Les tenants peuvent brièvement dépasser les limites.
- Si CP API est inaccessible au démarrage, la gateway démarre avec des compteurs à zéro (conservateur : pas d'historique = budget complet disponible, dépassement possible jusqu'à la première sync)
- Le cache de config budget (TTL 60s) signifie que les changements de limite prennent jusqu'à 60s pour se propager

### Atténuations

| Risque | Atténuation |
|------|-----------|
| CP API inaccessible au démarrage | Démarrer avec des compteurs à zéro + log d'avertissement ; dépassement conservateur borné par le budget de période |
| Échec de sync 30s | Loguer la métrique `stoa_token_budget_sync_errors_total` ; utiliser la valeur de la dernière sync réussie |
| Transition Phase 2→3 | La vérification de politique OPA s'exécute après la vérification du comptage de tokens ; même position dans le pipeline |

## Déclencheurs de Réévaluation

Réévaluer vers l'Option B (Redis) quand :
- La gateway passe à plus de 3 réplicas ET
- Un tenant exige contractuellement un enforcement strict (précision de facturation, conformité SLA)

À cette échelle, Redis Cluster avec `INCRBY` + `EXPIRE` par période est la bonne réponse.
