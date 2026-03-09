---
sidebar_position: 5
title: Observabilité
description: "Mettez en place la surveillance de STOA Platform avec les métriques Prometheus, les tableaux de bord Grafana et l'agrégation de logs Loki — stack d'observabilité complète pour le gateway MCP et le plan de contrôle"
keywords: [STOA, observability, Prometheus, Grafana, Loki, monitoring, guide]
---

# Observabilité

STOA inclut une stack d'observabilité intégrée avec Prometheus pour les métriques, Grafana pour les tableaux de bord et Loki pour l'agrégation des logs.

## Vue d'Ensemble de la Stack

| Composant | Objectif | Accès |
|-----------|---------|--------|
| **Prometheus** | Collecte de métriques et alertes | Interne (en cluster) |
| **Grafana** | Tableaux de bord et visualisation | `https://grafana.<YOUR_DOMAIN>` |
| **Loki** | Agrégation et recherche de logs | Via Grafana |

## Métriques

### API du Plan de Contrôle

Le backend FastAPI expose les métriques Prometheus à `/metrics` :

| Métrique | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total des requêtes HTTP par méthode, chemin, statut |
| `http_request_duration_seconds` | Histogram | Distribution de la latence des requêtes |
| `db_query_duration_seconds` | Histogram | Latence des requêtes base de données |
| `kafka_events_published_total` | Counter | Événements publiés sur Kafka |

### MCP Gateway

| Métrique | Type | Description |
|--------|------|-------------|
| `mcp_tool_calls_total` | Counter | Invocations d'outils par nom, tenant, statut |
| `mcp_tool_call_duration_seconds` | Histogram | Latence des appels d'outils |
| `opa_policy_evaluations_total` | Counter | Vérifications de politiques OPA par résultat |
| `mcp_active_connections` | Gauge | Connexions SSE actives |

### Kafka / Redpanda

| Métrique | Type | Description |
|--------|------|-------------|
| `kafka_consumer_lag` | Gauge | Lag du consommateur par topic/partition |
| `kafka_messages_in_total` | Counter | Messages produits par topic |

## Tableaux de Bord Grafana

### Vue d'Ensemble de la Plateforme

Le tableau de bord principal affiche :

- Taux de requêtes et taux d'erreur sur tous les services
- Percentiles de latence (p50, p95, p99)
- Utilisateurs actifs et sessions
- Utilisation du pool de connexions base de données

### Tableau de Bord MCP Gateway

- Taux d'appels d'outils par tenant et nom d'outil
- Ratio d'autorisation/refus des politiques OPA
- Nombre de connexions SSE
- Débit du pipeline de métering

### Tableau de Bord Tenant

Vue par tenant montrant :

- Volume d'appels API
- Activité des abonnements
- Répartition des erreurs par API
- Utilisation des limites de débit

## Agrégation des Logs

### Interroger les Logs

Accédez aux logs via la vue Explore de Grafana avec Loki :

```logql
# Tous les logs d'erreur des 5 dernières minutes
{job=~".+"} |= "level=error"

# Logs de l'API du Plan de Contrôle pour un tenant spécifique
{app="control-plane-api"} |= "tenant=acme"

# Appels d'outils MCP Gateway
{app="mcp-gateway"} |= "tool.call"

# Requêtes lentes (>1s)
{app="control-plane-api"} | json | duration > 1s
```

### Format des Logs

Tous les services STOA journalisent en format JSON structuré :

```json
{
  "timestamp": "2026-02-04T10:30:00Z",
  "level": "INFO",
  "service": "control-plane-api",
  "message": "API published",
  "tenant": "acme",
  "api": "petstore",
  "version": "1.0.0",
  "trace_id": "abc123"
}
```

Définissez `LOG_FORMAT=text` pour une sortie lisible par l'humain en développement local.

## Alertes

### Règles d'Alerte Prometheus

STOA est livré avec des règles d'alerte par défaut :

| Alerte | Condition | Sévérité |
|-------|-----------|----------|
| `HighErrorRate` | Taux d'erreur > 5% pendant 5 minutes | Critique |
| `HighLatency` | Latence p99 > 2s pendant 5 minutes | Avertissement |
| `DatabaseConnectionExhausted` | Pool de connexions > 90% | Critique |
| `KafkaConsumerLag` | Lag > 10000 pendant 10 minutes | Avertissement |
| `MCPGatewayDown` | Aucun pod sain pendant 1 minute | Critique |
| `VaultSealed` | Statut scellé de Vault détecté | Critique |

### Destinations des Alertes

Configurez le routage des alertes dans `alertmanager.yaml` :

- **Slack** : Notifications dans le canal pour les alertes d'équipe
- **PagerDuty** : Escalade d'astreinte pour les alertes critiques
- **Email** : Résumés périodiques pour les alertes non critiques

## Runbooks

STOA inclut des runbooks opérationnels organisés par sévérité :

### Critique

- Gateway Hors Service — Gateway inaccessible
- Connexion Base de Données — Problèmes de connectivité PostgreSQL
- Vault Scellé — Vault nécessite un déverrouillage
- Restauration Vault — Reprise après sinistre Vault

### Haute Priorité

- Expiration de Certificat — Certificat TLS approchant l'expiration
- Latence Élevée Gateway — Dégradation du temps de réponse
- Lag Kafka — Consommateur prenant du retard

### Priorité Moyenne

- Rollback d'API — Revenir à un déploiement d'API défectueux
- Échec Adaptateur Gateway — Instance gateway inaccessible ou dégradée

## Endpoints de Santé

Tous les services exposent des endpoints de contrôle de santé :

| Endpoint | Objectif |
|----------|---------|
| `/health/ready` | Sonde de préparation — toutes les dépendances accessibles |
| `/health/live` | Sonde de vivacité — processus actif |
| `/health/startup` | Sonde de démarrage — initialisation complète |

```bash
curl ${STOA_API_URL}/health/ready
# {"status": "ok"}
```
