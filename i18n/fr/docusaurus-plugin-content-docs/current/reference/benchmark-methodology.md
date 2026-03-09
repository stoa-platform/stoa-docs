---
sidebar_position: 8
title: "Méthodologie des Benchmarks"
description: "Méthodologie complète du Gateway Arena : formules de calcul, méthodes statistiques, définitions des scénarios, architecture et ajout d'un nouveau gateway."
keywords:
  - benchmark methodology
  - gateway arena
  - scoring formula
  - CI95 confidence intervals
  - k6 benchmark
  - api gateway comparison
  - enterprise ai readiness
  - mcp benchmark
---

<!-- last verified: 2026-02 -->

# Méthodologie des Benchmarks

Ce document décrit la méthodologie complète du **Gateway Arena**, le benchmark comparatif continu de STOA pour les API gateways. Pour les résultats, consultez [Performance Benchmarks](/docs/reference/performance-benchmarks). Pour la décision architecturale, voir [ADR-049](/docs/architecture/adr/adr-049-enterprise-ai-native-benchmark).

## Principes de Conception

Le Gateway Arena repose sur quatre principes :

1. **Comparaison équitable** — Tous les gateways interrogent le même backend echo local (nginx, JSON statique, &lt;1ms de réponse). Les benchmarks mesurent uniquement la surcharge du gateway, pas la latence du backend ou du réseau.
2. **Rigueur statistique** — Score médian sur N exécutions avec intervalles de confiance CI95 basés sur la loi de Student. Aucune sélection des meilleures exécutions.
3. **Reproductibilité** — Tous les scripts sont open source. N'importe qui peut exécuter le même benchmark sur sa propre infrastructure.
4. **Participation ouverte** — N'importe quel gateway peut être ajouté à l'Arena. Mêmes scénarios, même scoring, même méthodologie.

## Cadre en Deux Couches

L'Arena comporte deux couches indépendantes, chacune avec son propre CronJob, ses métriques et son tableau de bord Grafana.

| Propriété | Couche 0 : Proxy Baseline | Couche 1 : Enterprise AI Readiness |
|-----------|--------------------------|----------------------------------|
| **Mesure** | Débit HTTP brut | Capacités AI-native du gateway |
| **Scénarios** | 7 (warmup, health, sequential, burst, sustained, ramp) | 8 dimensions enterprise |
| **Exécutions** | 5 (1 rejeté) → 4 valides | 3 (1 rejeté) → 2 valides |
| **Planification** | Toutes les 30 minutes | Toutes les heures |
| **Plage de score** | 0–100 | 0–100 (Enterprise Readiness Index) |
| **CronJob** | `gateway-arena` | `gateway-arena-enterprise` |
| **Job Prometheus** | `gateway_arena` | `gateway_arena_enterprise` |

---

## Couche 0 : Proxy Baseline

### Scénarios

Chaque scénario est une invocation k6 distincte avec des profils de charge différents.

| # | Scénario | Exécuteur | VUs | Itérations/Durée | Objectif |
|---|----------|----------|-----|---------------------|---------|
| 0 | `warmup` | shared-iterations | 10 | 50 itérations, 15s max | Préchauffage JVM/runtime. **Exclu du scoring.** |
| 1 | `health` | shared-iterations | 1 | 1 itération, 10s max | Baseline health probe |
| 2 | `sequential` | shared-iterations | 1 | 20 itérations, 30s max | Latence P95 client unique |
| 3 | `burst_10` | shared-iterations | 10 | 10 itérations, 15s max | Rafale légère |
| 4 | `burst_50` | ramping-vus | 0→50 | 5s montée, 10s stable, 3s descente | Capacité rafale moyenne |
| 5 | `burst_100` | ramping-vus | 0→100 | 5s montée, 10s stable, 3s descente | Capacité rafale élevée |
| 6 | `sustained` | shared-iterations | 1 | 100 itérations, 60s max | Cohérence sous charge constante |
| 7 | `ramp_up` | ramping-arrival-rate | 10→100 req/s | 60s (6 étapes) | Montée en charge du débit |

### Protocole d'Exécution

Pour chaque gateway, l'orchestrateur (`run-arena.sh`) exécute :

```
Pour run = 1 à 5 :
  Pour scénario dans [warmup, health, sequential, burst_10, burst_50, burst_100, sustained, ramp_up] :
    k6 run benchmark.js --env SCENARIO={scenario} → résumé JSON
```

L'exécution 1 est le run de préchauffage et est **exclue** du scoring. Les exécutions 2 à 5 sont scorées.

### Formule de Scoring

Le score composite est une somme pondérée de 7 scores de dimensions :

```
Score = 0.10 × Base
      + 0.20 × Burst50
      + 0.20 × Burst100
      + 0.15 × Disponibilité
      + 0.10 × Erreur
      + 0.10 × Cohérence
      + 0.15 × RampUp
```

#### Dimension : Base (Latence Séquentielle)

Mesure la latence P95 d'un client unique avec un plafond de **400ms**.

```
Base = max(0, min(100, 100 × (1 − P95_sequential / 0.4)))
```

Un P95 de 0ms donne un score de 100. Un P95 de 400ms donne 0.

#### Dimension : Burst50 / Burst100

Même formule avec des plafonds différents :

```
Burst50  = max(0, min(100, 100 × (1 − P95_burst50  / 2.5)))
Burst100 = max(0, min(100, 100 × (1 − P95_burst100 / 4.0)))
```

| Dimension | Plafond de Latence | P95 = 0 | P95 = Plafond | P95 > Plafond |
|-----------|-------------|---------|-----------|-----------|
| Base | 400ms | 100 | 0 | 0 |
| Burst50 | 2.5s | 100 | 0 | 0 |
| Burst100 | 4.0s | 100 | 0 | 0 |

#### Dimension : Disponibilité et Erreur

Les deux utilisent la même formule, basée sur le total des vérifications réussies pour toutes les exécutions :

```
Disponibilité = Erreur = 100 × (total_ok / total_requests)
```

Où `total_ok` et `total_requests` sont cumulés sur tous les scénarios et toutes les exécutions valides. En l'absence de requêtes, la valeur par défaut est 50.

#### Dimension : Cohérence

Utilise le **coefficient de variation basé sur l'IQR** du scénario `sustained`. Cette mesure est robuste aux latences réseau bimodales (contrairement à l'écart-type standard).

```
IQR_CV = (P75 − P25) / P50
Cohérence = max(0, min(100, 100 × (1 − IQR_CV)))
```

Un gateway parfaitement cohérent (P75 = P25) obtient un score de 100. Une variance élevée donne un score plus bas.

#### Dimension : Ramp-Up

Mesure la montée en charge du débit sous une charge croissante. Le scénario `ramp_up` utilise un exécuteur `ramping-arrival-rate` qui passe de 10 à 100 requêtes/seconde sur 60 secondes.

```
effective_rate = observed_rate × success_rate
```

Si P99 dépasse 2 secondes, une pénalité est appliquée :

```
si P99 > 2s :
  effective_rate × max(0.5, 1.0 − (P99 − 2.0) / 8.0)
```

Le score est le taux effectif plafonné à 100 :

```
RampUp = min(100, effective_rate)
```

### Récapitulatif des Poids

| Poids | Dimension | Ce qu'il récompense |
|--------|-----------|-----------------|
| 0.20 | Burst50 | Gestion des rafales à moyenne échelle |
| 0.20 | Burst100 | Gestion des rafales à grande échelle |
| 0.15 | Disponibilité | Taux de succès des requêtes |
| 0.15 | RampUp | Montée en charge du débit |
| 0.10 | Base | Faible latence client unique |
| 0.10 | Erreur | Fonctionnement sans erreur |
| 0.10 | Cohérence | Temps de réponse prévisibles |

La gestion des rafales est pondérée le plus fortement (40% combinés) car les API gateways en production font face à des patterns de trafic en rafale plus souvent qu'à une charge soutenue.

---

## Couche 1 : Enterprise AI Readiness

### 8 Dimensions

| # | Dimension | Poids | Scénario | Plafond de Latence |
|---|-----------|--------|----------|-------------|
| 1 | MCP Discovery | 0.15 | `ent_mcp_discovery` | 500ms |
| 2 | MCP Tool Execution | 0.20 | `ent_mcp_toolcall` | 500ms |
| 3 | Auth Chain | 0.15 | `ent_auth_chain` | 1s |
| 4 | Policy Engine | 0.15 | `ent_policy_eval` | 200ms |
| 5 | AI Guardrails | 0.10 | `ent_guardrails` | 1s |
| 6 | Rate Limiting | 0.10 | `ent_quota_burst` | 1s |
| 7 | Resilience | 0.10 | `ent_resilience` | 1s |
| 8 | Agent Governance | 0.05 | `ent_governance` | 2s |

### Scoring par Dimension

Le score de chaque dimension est une combinaison pondérée de la disponibilité et de la latence :

```
availability_score = passes / (passes + fails) × 100
latency_score     = max(0, min(100, 100 × (1 − P95 / cap)))
dimension_score   = 0.6 × availability_score + 0.4 × latency_score
```

La disponibilité est pondérée plus fortement (60%) car un AI gateway qui ne prend pas en charge une fonctionnalité obtient un score de 0 indépendamment de la latence.

### Enterprise Readiness Index (ERI)

Le score composite est la somme pondérée de toutes les dimensions :

```
ERI = Σ (poids_i × score_dimension_i)
```

**Les gateways sans support MCP obtiennent un score de 0** — et non N/A. C'est intentionnel : l'absence d'une capacité est une mesure concrète et honnête. N'importe quel gateway peut implémenter MCP et relancer le benchmark.

### Support du Protocole MCP

Le benchmark prend en charge deux variantes du protocole MCP :

| Protocole | Valeur Config | Pattern d'Endpoint | Utilisé Par |
|----------|-------------|-----------------|---------|
| STOA REST | `"stoa"` | `GET /mcp/capabilities`, `POST /mcp/tools/list`, `POST /mcp/tools/call` | STOA Gateway |
| Streamable HTTP | `"streamable-http"` | `POST /mcp` avec enveloppe JSON-RPC 2.0 | Gravitee 4.8+ |

Le script k6 lit `MCP_PROTOCOL` pour basculer entre les formats de requêtes. Les deux protocoles sont testés avec la même formule de scoring.

---

## Méthodes Statistiques

### Sélection de la Médiane

Toutes les métriques par scénario (P50, P95, P99, comptages pass/fail) sont calculées comme la **médiane** des exécutions valides. La médiane est préférée à la moyenne car elle est robuste à une seule exécution aberrante causée par des pauses GC, des voisins bruyants ou des problèmes réseau transitoires.

```python
def median(values):
    s = sorted(values)
    return s[len(s) // 2]
```

Pour la Couche 0 : 5 exécutions, 1 rejetée → 4 valides → médiane de 4.
Pour la Couche 1 : 3 exécutions, 1 rejetée → 2 valides → médiane de 2.

### Intervalles de Confiance CI95

Les intervalles de confiance utilisent la **loi de Student** (et non les scores z) car les tailles d'échantillons sont petites (n=2–4). La loi de Student a des queues plus lourdes, produisant des intervalles plus larges (et plus honnêtes) pour les petits échantillons.

```
CI95 = mean ± t(α/2, df) × (stddev / √n)

où :
  df = n − 1               (degrés de liberté)
  t(α/2, df)               (valeur critique t pour 95% de confiance)
  stddev = √(Σ(xi − mean)² / (n − 1))  (écart-type de l'échantillon)
```

#### Valeurs Critiques t

| df | t-critique | n typique |
|----|-----------|-----------|
| 1 | 12.706 | 2 exécutions (Couche 1) |
| 2 | 4.303 | 3 exécutions |
| 3 | 3.182 | 4 exécutions (Couche 0) |
| 4 | 2.776 | 5 exécutions |
| ≥120 | 1.96 | Grands échantillons (≈ score z) |

Les bornes CI95 sont contraintes à `[0, 100]` pour les scores composites.

### Pourquoi Pas les Scores z ?

Avec n=4 exécutions, utiliser z=1.96 au lieu de t=3.182 produirait des intervalles de confiance **50% trop étroits**, donnant une fausse impression de précision. La loi de Student tient correctement compte de l'incertitude inhérente aux petits échantillons.

---

## Architecture

### Infrastructure

```
K8s CronJob (OVH MKS, co-localisé) :
  run-arena.sh (orchestrateur)
    └── Pour chaque gateway (3 K8s + N VPS) :
        └── Pour chaque exécution (5) :
            ├── k6 run (warmup) → rejeté
            └── k6 run (7 scénarios) → résumés JSON
  run-arena.py (scoring)
    └── Lit JSON → médiane → score composite → CI95 → texte Prometheus
    └── curl POST → Pushgateway

VPS Sidecar (host cron, co-localisé) :
  Même image Docker + scripts
  Benchmark 1 gateway local → push vers Pushgateway
```

### Backend Echo

Tous les gateways proxifient vers un serveur echo partagé — un conteneur nginx retournant un payload JSON statique en &lt;1ms :

```json
{"status": "ok", "server": "echo-k8s"}
```

Cela garantit que les benchmarks mesurent **uniquement la surcharge du gateway**, et non les performances du backend ou la latence réseau. Le serveur echo s'exécute sur le même cluster/hôte que le gateway testé.

### Participants Actuels

#### In-Cluster (K8s — OVH MKS)

| Gateway | Port Proxy | Endpoint de Santé | Backend |
|---------|-----------|----------------|---------|
| STOA | 8080 | `/health` | echo-backend:8888 |
| Kong DB-less | 8000 | `:8001/status` | echo-backend:8888 |
| Gravitee APIM | 8082 | `:18082/_node/health` | echo-backend:8888 |

#### VPS (Sidecars Co-localisés)

| Gateway | Hôte | Port Proxy | Backend |
|---------|------|-----------|---------|
| STOA | 51.83.45.13 | 8080 | echo-local:8888 |
| Kong | 51.83.45.13 | 8000 | echo-local:8888 |
| Gravitee | 54.36.209.237 | 8082 | echo-local:8888 |

### Métriques Prometheus

#### Couche 0

| Métrique | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_arena_score` | gauge | `gateway` | Score composite (0–100) |
| `gateway_arena_score_stddev` | gauge | `gateway` | Écart-type entre exécutions |
| `gateway_arena_score_ci_lower` | gauge | `gateway` | Borne inférieure CI95 |
| `gateway_arena_score_ci_upper` | gauge | `gateway` | Borne supérieure CI95 |
| `gateway_arena_runs` | gauge | `gateway` | Nombre d'exécutions valides |
| `gateway_arena_availability` | gauge | `gateway` | Taux de succès health check (0–1) |
| `gateway_arena_p50_seconds` | gauge | `gateway`, `scenario` | Latence médiane par scénario |
| `gateway_arena_p95_seconds` | gauge | `gateway`, `scenario` | Latence P95 par scénario |
| `gateway_arena_p99_seconds` | gauge | `gateway`, `scenario` | Latence P99 par scénario |
| `gateway_arena_ramp_rate` | gauge | `gateway` | Débit soutenu maximal (req/s) |
| `gateway_arena_requests_total` | gauge | `gateway`, `scenario`, `status` | Comptages de requêtes |

Chaque métrique de latence dispose également de variantes `_ci_lower_seconds` et `_ci_upper_seconds` avec les mêmes labels.

#### Couche 1

| Métrique | Type | Labels | Description |
|--------|------|--------|-------------|
| `gateway_arena_enterprise_score` | gauge | `gateway` | Enterprise Readiness Index (0–100) |
| `gateway_arena_enterprise_dimension` | gauge | `gateway`, `dimension` | Score par dimension (0–100) |
| `gateway_arena_enterprise_score_ci_lower` | gauge | `gateway` | Borne inférieure CI95 |
| `gateway_arena_enterprise_score_ci_upper` | gauge | `gateway` | Borne supérieure CI95 |
| `gateway_arena_enterprise_score_stddev` | gauge | `gateway` | Écart-type entre exécutions |
| `gateway_arena_enterprise_runs` | gauge | `gateway` | Nombre d'exécutions enterprise valides |
| `gateway_arena_enterprise_latency_p95` | gauge | `gateway`, `dimension` | Latence P95 par dimension |

---

## Ajout d'un Nouveau Gateway

### K8s (In-Cluster)

1. Déployez le gateway dans le namespace `stoa-system` avec un Service
2. Configurez une route vers le backend echo : `http://echo-backend.stoa-system.svc:8888`
3. Ajoutez une entrée dans le JSON `GATEWAYS` de `k8s/arena/cronjob-prod.yaml` :

```json
{
  "name": "my-gateway",
  "health": "http://my-gw-svc.stoa-system.svc:PORT/health",
  "proxy": "http://my-gw-svc.stoa-system.svc:PORT/echo/get"
}
```

4. Pour la Couche 1, ajoutez les champs MCP :

```json
{
  "name": "my-gateway",
  "target": "http://my-gw-svc:PORT",
  "health": "http://my-gw-svc:PORT/health",
  "mcp_base": "http://my-gw-svc:PORT/mcp",
  "mcp_protocol": "stoa"
}
```

5. Mettez à jour le ConfigMap et lancez un benchmark manuel :

```bash
kubectl create configmap gateway-arena-scripts \
  --from-file=scripts/traffic/arena/benchmark.js \
  --from-file=scripts/traffic/arena/run-arena.sh \
  --from-file=scripts/traffic/arena/run-arena.py \
  -n stoa-system --dry-run=client -o yaml | kubectl apply -f -

kubectl create job --from=cronjob/gateway-arena arena-test-$(date +%s) -n stoa-system
```

### VPS (Sidecar Co-localisé)

1. Déployez le gateway sur le VPS
2. Déployez le conteneur echo sur le même réseau Docker
3. Ajoutez la configuration VPS dans `deploy/vps/bench/deploy.sh`
4. Exécutez : `./deploy/vps/bench/deploy.sh`

### Vérification

Après l'ajout d'un gateway, vérifiez que les métriques apparaissent dans Pushgateway :

```bash
curl -s https://pushgateway.gostoa.dev/metrics | grep 'gateway="my-gateway"'
```

---

## Interprétation des Scores

| Score | Évaluation | Cause Typique |
|-------|--------|---------------|
| > 95 | Excellent | Gateway co-localisé avec surcharge minimale (Rust, C, nginx optimisé) |
| 80–95 | Bien | Gateway bien configuré, normal pour les déploiements en production |
| 60–80 | Acceptable | Vérifiez les contraintes de ressources, les sauts réseau ou le tuning JVM |
| < 60 | À investiguer | Échecs de connexion, taux d'erreur élevé ou mauvaise configuration |

### Lecture des Bornes CI95

- **Bornes étroites** (ex : `[82, 88]`) : résultats stables et reproductibles
- **Bornes larges** (ex : `[60, 95]`) : variance élevée entre exécutions — investiguez les voisins bruyants, les pauses GC ou les effets de cold-start
- **Bornes croisant un seuil** (ex : `[78, 92]` croisant 80) : la vraie performance du gateway est ambiguë à ce seuil — plus d'exécutions resserreraient l'intervalle

---

## Reproductibilité

Tous les scripts de l'Arena se trouvent dans le répertoire [`scripts/traffic/arena/`](https://github.com/stoa-platform/stoa/tree/main/scripts/traffic/arena) du dépôt stoa.

| Fichier | Objectif |
|------|---------|
| `benchmark.js` | Définitions des scénarios k6 (Couche 0) |
| `benchmark-enterprise.js` | Scénarios enterprise k6 (Couche 1) |
| `run-arena.sh` | Orchestrateur shell (Couche 0) |
| `run-arena-enterprise.sh` | Orchestrateur shell (Couche 1) |
| `run-arena.py` | Scoring Python avec CI95 (Couche 0) |
| `run-arena-enterprise.py` | Scoring Python avec CI95 (Couche 1) |
| `Dockerfile` | Image Arena : k6 0.54.0 + jq + curl + bash + python3 |

### Exécution en Local

```bash
# Construire l'image arena
docker build -t arena-bench scripts/traffic/arena/

# Lancer la Couche 0 contre un gateway local
docker run --rm \
  -e GATEWAYS='[{"name":"local","health":"http://host.docker.internal:8080/health","proxy":"http://host.docker.internal:8080/echo/get"}]' \
  -e RUNS=3 \
  -e DISCARD_FIRST=1 \
  arena-bench /scripts/run-arena.sh
```

### Exécution sur Kubernetes

```bash
# Couche 0 — exécution ponctuelle
kubectl create job --from=cronjob/gateway-arena arena-manual -n stoa-system
kubectl logs -n stoa-system -l job-name=arena-manual --follow

# Couche 1 — exécution ponctuelle
kubectl create job --from=cronjob/gateway-arena-enterprise arena-ent-manual -n stoa-system
kubectl logs -n stoa-system -l job-name=arena-ent-manual --follow

# Nettoyage
kubectl delete job arena-manual arena-ent-manual -n stoa-system
```

---

## Limites et Biais Connus

- **Proximité réseau** — Les gateways K8s s'exécutent sur le même cluster que k6 (co-localisés). Les gateways VPS s'exécutent sur le même hôte. Les benchmarks inter-réseaux ne sont pas comparables en raison de la latence variable.
- **Préchauffage JVM** — L'exécution de préchauffage atténue le biais de cold-start pour les gateways basés sur la JVM (Kong/OpenResty, Gravitee), mais 50 itérations peuvent ne pas réchauffer entièrement tous les chemins de code.
- **Petite taille d'échantillon** — La Couche 1 utilise seulement 2 exécutions valides (3 au total, 1 rejetée). Les bornes CI95 avec df=1 utilisent t=12.706, produisant des intervalles très larges. C'est statistiquement correct mais limite la précision.
- **Biais de scoring MCP** — La Couche 1 favorise intrinsèquement les gateways avec support MCP. C'est intentionnel : le benchmark mesure les capacités AI-native. La Couche 0 fournit la baseline proxy complémentaire.
- **Backend echo suppose GET** — Tous les scénarios proxy utilisent HTTP GET contre le backend echo. Les patterns POST/PUT avec parsing du corps de requête ne sont pas benchmarkés.

> Les comparaisons de fonctionnalités sont basées sur des tests exécutés dans des conditions identiques à la date indiquée ci-dessus. Les capacités des gateways évoluent fréquemment. Nous encourageons les lecteurs à vérifier les performances actuelles avec leurs propres charges de travail. Toutes les marques appartiennent à leurs propriétaires respectifs. Voir [marques](/docs/legal/trademarks).
