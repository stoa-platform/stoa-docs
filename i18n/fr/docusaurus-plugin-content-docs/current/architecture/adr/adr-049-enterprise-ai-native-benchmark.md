---
title: "ADR-049 : Benchmark Enterprise AI-Native Gateway"
description: "Introduit un framework de benchmark à deux couches : la couche 0 mesure le débit proxy brut (existant), la couche 1 mesure la maturité IA entreprise sur 8 dimensions incluant le support MCP, les chaînes d'auth, les guardrails et la gouvernance."
keywords: [benchmark, arena, enterprise, MCP, maturité IA, comparaison gateway, k6, Prometheus]
---

# ADR-049 : Benchmark Enterprise AI-Native Gateway

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-22 |
| **Décideurs** | Équipe Plateforme |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le mode edge-mcp fournit les endpoints MCP benchmarkés ici
- **ADR-012** : MCP RBAC — la chaîne d'évaluation de politique testée par la dimension politique
- **ADR-039** : mTLS Cert-Bound Tokens — la chaîne auth inclut la validation du stage mTLS

## Contexte

Gateway Arena v1 mesure le débit proxy HTTP brut : latence séquentielle, capacité en rafale, montée en charge et disponibilité. Dans ce benchmark, Kong score régulièrement ~87 et STOA ~73 — parce que Kong est un proxy nginx optimisé avec des années de tuning en production, et c'est exactement ce que v1 mesure.

Le problème : **le débit proxy est la mauvaise métrique pour les gateways AI-native**. Arena v1 ne teste aucune capacité spécifique à l'IA. Elle ne mesure pas si un gateway peut servir des outils MCP, appliquer des guardrails IA, évaluer des politiques OPA sur les appels d'outils, détecter des PII dans les payloads d'agents, ou fournir une gouvernance de session pour les agents autonomes. Kong et Gravitee scorent bien parce que le test est conçu pour leurs points forts.

STOA est en compétition sur un axe différent : la maturité IA entreprise. La gateway supporte la découverte de protocole MCP, l'exécution d'outils JSON-RPC, OAuth 2.1 avec PKCE, l'évaluation de politique OPA, la détection/rédaction PII, le rate limiting par consommateur, les circuit breakers et la gouvernance de session d'agent. Aucune de ces capacités n'est testée par Arena v1.

### Énoncé du Problème

Comment benchmarker ce qui compte réellement pour les gateways API AI-native, sans invalider le baseline proxy existant ?

## Décision

Introduire un **framework de benchmark à deux couches** :

```
Couche 0 — Baseline Proxy (existant, inchangé)
  Score : Mesure le débit proxy HTTP brut
  Méthodologie : 7 scénarios, médiane-sur-5, IC95
  Planification : Toutes les 30 min (CronJob existant)

Couche 1 — Maturité IA Entreprise (NOUVEAU)
  Score : Mesure 8 dimensions entreprise
  Méthodologie : 8 scénarios, médiane-sur-3, IC95
  Planification : Toutes les heures (nouveau CronJob)
```

La couche 0 reste intacte. La couche 1 est additive — un CronJob séparé, des métriques Prometheus séparées, un tableau de bord Grafana séparé.

### 8 Dimensions Entreprise

| # | Dimension | Poids | Ce qu'elle Teste | Endpoint | Plafond Latence |
|---|-----------|--------|---------------|----------|-------------|
| 1 | Découverte MCP | 0.15 | `GET /mcp/capabilities` retourne du JSON valide avec listage de capacités | `/mcp/capabilities` | 500ms |
| 2 | Exécution d'Outil MCP | 0.20 | `POST /mcp/tools/list` via JSON-RPC, réponse dans le plafond p95 | `/mcp/tools/list` | 500ms |
| 3 | Chaîne Auth | 0.15 | Token Bearer JWT + appel d'outil MCP, pipeline auth complet | `/mcp/tools/list` + JWT | 1s |
| 4 | Moteur de Politique | 0.15 | Surcoût d'évaluation OPA sur les endpoints MCP | `/mcp/capabilities` | 200ms |
| 5 | Guardrails IA | 0.10 | PII dans le payload d'appel d'outil bloqué ou rédigé | `/mcp/tools/call` + PII | 1s |
| 6 | Rate Limiting | 0.10 | Application du 429 lors des rafales, les requêtes valides passent | `/mcp/capabilities` | 1s |
| 7 | Résilience | 0.10 | Un mauvais appel d'outil retourne une erreur 4xx élégante, pas un crash 500 | `/mcp/tools/call` + input erroné | 1s |
| 8 | Gouvernance Agent | 0.05 | Les endpoints de session et gouvernance existent et répondent | `/admin/sessions/stats` | 2s |

### Formule de Score

Score de chaque dimension (0-100) :

```
availability_score = passes / (passes + fails) * 100
latency_score = max(0, 100 * (1 - p95 / cap))
dimension_score = 0.6 * availability_score + 0.4 * latency_score
```

Indice Composite de Maturité Entreprise :

```
ERI = sum(weight_i * dimension_score_i)
```

**Si un gateway n'implémente pas une fonctionnalité, il score 0 — pas N/A.** Le 0 est honnête et factuel : la capacité est absente. C'est aussi une invitation : implémentez MCP et votre score monte.

### Modèle de Participation Ouverte

La spécification du benchmark est publique (cet ADR). Tout gateway peut participer :

1. Implémenter les endpoints MCP (soit REST STOA soit Streamable HTTP JSON-RPC 2.0)
2. Ajouter une entrée gateway au JSON GATEWAYS :
   ```json
   {
     "name": "my-gw",
     "target": "http://my-gateway:8080",
     "mcp_base": "http://my-gateway:8080/mcp",
     "mcp_protocol": "streamable-http",
     "health": "http://my-gateway:8080/health"
   }
   ```
   Valeurs `mcp_protocol` : `"stoa"` (chemins REST) ou `"streamable-http"` (JSON-RPC 2.0 sur endpoint unique). Défaut : `"stoa"`.
3. Exécuter le benchmark
4. Soumettre les résultats (ou l'exécuter vous-même — les scripts k6 sont open source)

Nous définissons la catégorie, mais nous ne fermons pas la porte.

## Alternatives Considérées

### A. Modifier Arena v1 pour inclure des scénarios entreprise

**Rejeté.** Mélanger scénarios proxy et entreprise dans un seul CronJob confond deux axes de mesure différents. Un gateway scorant 90 (est-il rapide ? prêt pour l'IA ? les deux ?) n'a pas de sens. Deux scores séparés apportent de la clarté.

### B. Pondérer les dimensions entreprise dans le score composite existant

**Rejeté.** Cela abaisserait rétroactivement les scores de Kong/Gravitee, ce qui est injuste. Ils n'ont jamais prétendu être des gateways AI-native. Qu'ils concourent sur la couche 0 où ils sont forts. La couche 1 est un nouveau jeu.

### C. Utiliser N/A au lieu de 0 pour les fonctionnalités non supportées

**Rejeté.** N/A rend la comparaison impossible (on ne peut pas faire la moyenne de N/A). Le score 0 est mathématiquement propre et stratégiquement honnête : « vous n'avez pas cette capacité. » Le blog et l'ADR expliquent clairement le scoring — pas d'agenda caché.

### D. Benchmarker uniquement STOA (test entreprise à gateway unique)

**Rejeté.** Un benchmark avec un seul participant n'est pas un benchmark — c'est une métrique de vanité. Inclure Kong et Gravitee (même à score 0) en fait une vraie comparaison que d'autres peuvent rejoindre.

## Conséquences

### Positives

- **Création de catégorie** : STOA définit la « Maturité IA Entreprise » comme catégorie de benchmark. Aucun benchmark existant ne mesure cela.
- **Comparaison honnête** : la couche 0 montre où Kong est meilleur (débit proxy). La couche 1 montre où STOA est meilleur (capacités IA). Les lecteurs ont une image complète.
- **Invitation ouverte** : tout éditeur de gateway peut exécuter le même benchmark. Le scoring est transparent, le code est open source.
- **Levier marketing** : l'Indice de Maturité Entreprise est un nombre concret et reproductible — pas une affirmation subjective.

### Négatives

- **Coût de maintenance** : deux CronJobs, deux tableaux de bord, deux ensembles de scripts à maintenir.
- **Risque de perception** : les sceptiques pourraient voir un benchmark conçu pour faire gagner STOA. Atténuation : la couche 0 est conservée inchangée (montrant le score proxy plus bas de STOA), et la spécification est ouverte.
- **Les scénarios entreprise sont plus lourds** : 3 runs au lieu de 5, toutes les heures au lieu de toutes les 30 min. Compromis acceptable pour le surcoût de calcul supplémentaire.

### Neutre

- Le support MCP de Kong (plugin `ai-mcp-proxy`, depuis 3.12) nécessite une licence Enterprise ; l'édition OSS testée dans l'arena n'inclut pas MCP. Les utilisateurs de Kong Enterprise peuvent ajouter leur gateway à la config.
- L'édition community de Gravitee 4.8 inclut un entrypoint MCP (Apache 2.0). L'arena teste Gravitee via le protocole Streamable HTTP (JSON-RPC 2.0) en utilisant le champ de config `mcp_protocol: "streamable-http"`.

## Implémentation

| Livrable | Repo | Fichiers Clés |
|-------------|------|-----------|
| Scénarios k6 entreprise | stoa | `scripts/traffic/arena/benchmark-enterprise.js` |
| Orchestrateur shell | stoa | `scripts/traffic/arena/run-arena-enterprise.sh` |
| Scoreur Python | stoa | `scripts/traffic/arena/run-arena-enterprise.py` |
| CronJob K8s | stoa | `k8s/arena/cronjob-enterprise.yaml` |
| Scripts de déploiement | stoa | `k8s/arena/deploy-enterprise.sh`, `deploy.sh` (mis à jour) |
| Tableau de bord Grafana | stoa | `docker/observability/grafana/dashboards/gateway-arena-enterprise.json` |
| Documentation des règles | stoa | `.claude/rules/gateway-arena.md` (mis à jour) |
| Cet ADR | stoa-docs | `docs/architecture/adr/adr-049-*` |
| Article de blog | stoa-docs | `blog/2026-02-22-*` |
