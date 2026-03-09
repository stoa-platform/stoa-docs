---
slug: detecting-attacks-stoa-part-3
title: "Détecter les Attaques API : Logs d'Audit, Guardrails, Métriques"
description: "Abus d'identifiants, injection de prompt et patterns DDoS dans vos logs de gateway. Comment détecter les attaques via les pistes d'audit, les guardrails et Prometheus."
authors: [stoa-team]
tags: [security, tutorial, api-gateway]
keywords:
  - API attack detection gateway
  - API security monitoring
  - STOA audit log attack detection
  - credential abuse API detection
  - prompt injection detection API
  - API DDoS detection rate limiting
  - API security incident response
  - anomaly detection API gateway
  - API security monitoring 2026
  - detect API abuse open source
---
<!-- last verified: 2026-02 -->

L'architecture Zero Trust présuppose la compromission — si vous supposez que des attaquants sont déjà à l'intérieur, votre priorité passe de la pure prévention à la détection. STOA génère des événements d'audit structurés et des métriques Prometheus qui permettent de détecter les abus d'identifiants, les tentatives d'injection de prompt, les abus de rate et les patterns d'exfiltration de données. Cet article couvre ce que STOA détecte, comment interroger les signaux d'attaque et un playbook pratique de réponse aux incidents.

<!-- truncate -->

:::info Il s'agit de la Partie 3 d'une série en 3 parties
- [Partie 1](/blog/zero-trust-api-gateways-part-1) : Ce que Zero Trust signifie pour les API gateways
- [Partie 2](/blog/zero-trust-stoa-checklist-part-2) : Liste de contrôle Zero Trust STOA en 10 étapes
- **Partie 3 (cet article)** : Détecter les attaques avec STOA

Voir aussi : [Architecture de sécurité STOA](/blog/stoa-api-security-architecture) et [OWASP API Security Top 10 & couverture STOA](/blog/owasp-api-security-top-10-stoa).
:::

## Ce que STOA génère pour la détection

STOA produit trois sources de données de détection :

1. **Événements d'audit structurés** (Kafka/JSON) : un événement par appel API, pour chaque appel — y compris les réussis
2. **Métriques Prometheus** : compteurs et histogrammes pour les requêtes, refus, déclenchements de guardrails, échecs d'auth
3. **Événements de déclenchement de guardrails** : événements spécifiques quand des PII, une injection de prompt ou des violations de schéma sont détectés

Ces sources sont complémentaires. Les événements d'audit vous donnent l'enregistrement forensique détaillé. Les métriques Prometheus vous donnent l'agrégation en temps réel pour les alertes. Les événements de guardrails vous donnent des signaux immédiats sur des patterns de menaces spécifiques.

## Pattern d'attaque 1 : Abus d'identifiants

**À quoi ça ressemble** : un token valide utilisé depuis un endroit inattendu, à des heures inhabituelles, ou avec un changement soudain dans le volume de requêtes ou la distribution des endpoints.

### Détection via le log d'audit

Les événements d'audit incluent `agent_id`, `consumer_id`, `ip_address` et `session_id`. Interrogez votre SIEM :

```sql
-- Détecter un consommateur unique appelant depuis plusieurs IPs en 1 heure
SELECT consumer_id, COUNT(DISTINCT ip_address) AS unique_ips, COUNT(*) AS requests
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY consumer_id
HAVING COUNT(DISTINCT ip_address) > 3
ORDER BY unique_ips DESC;
```

```sql
-- Détecter un changement soudain de distribution d'endpoints
-- (consommateur appelle normalement /v1/analytics, maintenant appelle /v1/users/*)
SELECT consumer_id, path_prefix, COUNT(*) AS count
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND path LIKE '/v1/users/%'
  AND consumer_id NOT IN (SELECT consumer_id FROM known_user_api_consumers)
ORDER BY count DESC;
```

### Détection via Prometheus

```promql
# Échecs d'auth par IP (5 dernières minutes)
sum(rate(stoa_auth_failures_total[5m])) by (ip_address) > 10

# Consommateur accédant à des endpoints hors de son pattern historique
(stoa_consumer_endpoint_calls_total offset 24h) - stoa_consumer_endpoint_calls_total > 1000
```

**Réponse** : révoquez immédiatement les tokens du consommateur (Étape 9 de la [liste de contrôle Zero Trust](/blog/zero-trust-stoa-checklist-part-2)), suspendez l'enregistrement du consommateur, enquêtez sur le cycle de vie du token.

---

## Pattern d'attaque 2 : Injection de prompt

**À quoi ça ressemble** : payloads de requête contenant des instructions conçues pour contourner le comportement d'un agent IA et provoquer des appels API non autorisés.

### Comment les guardrails de STOA le détectent

Le guardrail d'injection de prompt de STOA compare des patterns configurables avant de transmettre les requêtes au backend. Quand une correspondance est trouvée :

1. La requête est bloquée (configurable : bloquer ou journaliser uniquement)
2. Un événement de déclenchement de guardrail est émis vers le flux d'audit
3. Le compteur Prometheus `stoa_guardrail_triggers_total{type="prompt_injection"}` est incrémenté

**Exemple d'événement de guardrail** :
```json
{
  "event_type": "guardrail_trigger",
  "timestamp": "2026-02-22T14:23:01.234Z",
  "session_id": "sess_abc123",
  "consumer_id": "claude-desktop-prod",
  "trigger_type": "prompt_injection",
  "matched_pattern": "ignore previous instructions",
  "action_taken": "blocked",
  "request_path": "/v1/tools/invoke",
  "tool_name": "delete_user"
}
```

### Interroger pour détecter des campagnes d'injection

Des injections isolées peuvent être des sondes de test. Une série de tentatives d'injection sur une courte fenêtre indique une attaque ciblée :

```sql
-- Détecter des campagnes d'injection (3+ tentatives en 10 minutes depuis la même session)
SELECT session_id, consumer_id, COUNT(*) AS attempts, MIN(timestamp) AS first_attempt
FROM stoa_audit_events
WHERE event_type = 'guardrail_trigger'
  AND trigger_type = 'prompt_injection'
  AND timestamp > NOW() - INTERVAL '10 minutes'
GROUP BY session_id, consumer_id
HAVING COUNT(*) >= 3
ORDER BY attempts DESC;
```

**Réponse** : terminez la session affectée, enquêtez sur la source du prompt (application backend ou entrée externe), vérifiez quel outil l'injection ciblait.

---

## Pattern d'attaque 3 : Abus de rate / DDoS

**À quoi ça ressemble** : pic soudain de volume de requêtes provenant d'un ou plusieurs consommateurs, visant généralement à épuiser le quota ou à dégrader le service pour les autres consommateurs.

### Détection via Prometheus

```promql
# Consommateur dépassant sa baseline historique de 5×
(rate(stoa_consumer_requests_total[5m]) / on(consumer_id) avg_over_time(rate(stoa_consumer_requests_total[5m])[24h:])) > 5

# Pic du taux de refus de politique (consommateur atteignant la limite de rate à répétition)
rate(stoa_policy_denies_total{deny_reason="rate_limit"}[5m]) > 10
```

### Détection via le log d'audit

```sql
-- Top consommateurs par volume dans les 5 dernières minutes vs leur moyenne sur 24h
SELECT
  consumer_id,
  COUNT(*) AS requests_last_5min,
  AVG(daily_avg) AS daily_avg_per_5min
FROM stoa_audit_events
LEFT JOIN (
  SELECT consumer_id, COUNT(*) / 288.0 AS daily_avg
  FROM stoa_audit_events
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY consumer_id
) baseline USING (consumer_id)
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY consumer_id
HAVING COUNT(*) > 3 * COALESCE(daily_avg, 0)
ORDER BY requests_last_5min DESC;
```

Le rate limiting intégré de STOA va déjà throttler le consommateur (retourner `429`), mais cette requête identifie le consommateur pour une investigation manuelle.

**Réponse** : si le rate limiting est en place et fonctionne, le risque immédiat est contenu. Enquêtez pour savoir s'il s'agit d'un pic de trafic légitime (lancement de nouvelle fonctionnalité, migration de données) ou d'une activité malveillante. En cas d'abus confirmé, suspendez l'enregistrement du consommateur.

---

## Pattern d'attaque 4 : Signaux d'exfiltration de données

**À quoi ça ressemble** : payloads de réponse inhabituellement volumineux, appels répétés à des endpoints très sensibles, ou patterns d'heure inhabituels sur les endpoints de récupération de données.

### La contribution de STOA

STOA journalise `backend_status` et `duration_ms` par requête. Bien que STOA ne journalise pas le contenu des réponses par défaut (pour la confidentialité et les performances), il journalise des métadonnées qui révèlent des patterns d'accès aux données anormaux.

Les guardrails peuvent optionnellement journaliser la taille des réponses et déclencher des alertes sur les réponses surdimensionnées :

```yaml
guardrails:
  response_size_limit_kb: 512
  response_size_action: "truncate_and_alert"  # ne pas bloquer, mais alerter
```

### Requêtes de détection

```sql
-- Accès aux données inhabituel en dehors des heures de travail
SELECT consumer_id, DATE_TRUNC('hour', timestamp) AS hour, COUNT(*) AS calls
FROM stoa_audit_events
WHERE path LIKE '/v1/customers/%'
  AND timestamp > NOW() - INTERVAL '7 days'
  AND EXTRACT(HOUR FROM timestamp AT TIME ZONE 'UTC') NOT BETWEEN 7 AND 19
GROUP BY consumer_id, hour
HAVING COUNT(*) > 100
ORDER BY calls DESC;

-- Même consommateur lisant le même endpoint liste à répétition (scraping par pagination)
SELECT consumer_id, path, COUNT(*) AS calls, MIN(timestamp), MAX(timestamp)
FROM stoa_audit_events
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND method = 'GET'
GROUP BY consumer_id, path
HAVING COUNT(*) > 500
ORDER BY calls DESC;
```

---

## Playbook de réponse aux incidents

Quand une règle de détection se déclenche, suivez ce playbook :

### Étape 1 : Contenir (< 5 minutes)

```bash
# Révoquer immédiatement les tokens du consommateur
curl -X POST ${STOA_AUTH_URL}/realms/stoa/protocol/openid-connect/revoke \
  -d "token=${CONSUMER_REFRESH_TOKEN}" \
  -d "token_type_hint=refresh_token" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}"

# Suspendre le consommateur dans STOA
curl -X PATCH ${STOA_API_URL}/v1/consumers/${CONSUMER_ID} \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"status": "suspended"}'
```

### Étape 2 : Enquêter (< 30 minutes)

Récupérez la piste d'audit du consommateur pour les dernières 24 heures :

```bash
# Exporter les événements d'audit du consommateur (requête Kibana/SIEM)
# Filtre : consumer_id = ${CONSUMER_ID} AND timestamp > (NOW - 24h)
# Exporter en CSV pour analyse
```

Questions clés :
- Quand l'activité inhabituelle a-t-elle commencé ?
- Quels endpoints ont été accédés ?
- Des guardrails ont-ils été déclenchés ?
- L'activité provient-elle d'une plage d'IP connue ou de localisations inattendues ?
- Le volume de requêtes correspond-il au cas d'usage déclaré du consommateur ?

### Étape 3 : Remédier

Selon les conclusions :
- **Vol d'identifiants** : émettez de nouveaux identifiants, faites pivoter le certificat client affecté, examinez comment l'identifiant a été exposé
- **Injection de prompt** : corrigez la couche applicative qui accepte les entrées utilisateur, examinez l'outil qui était ciblé
- **Abus de rate** : déterminez s'il s'agit d'un bug dans l'application consommatrice ou d'une action intentionnelle ; ajustez les limites de rate si justifié
- **Exfiltration** : déterminez quelles données ont été accédées, évaluez les obligations de notification (le RGPD Article 33 exige une notification de violation dans les 72 heures si c'est à haut risque)

### Étape 4 : Documenter et mettre à jour

- Enregistrez l'incident dans votre outil de suivi des incidents de sécurité
- Ajoutez le pattern d'attaque à vos politiques OPA ou règles de guardrails s'il n'est pas déjà couvert
- Mettez à jour les seuils d'alerte en fonction de l'aspect de la baseline avant l'attaque

## Configuration du dashboard Grafana

Un dashboard Grafana complet pour la surveillance de sécurité STOA devrait inclure :

| Panel | Métrique | Visualisation |
|-------|--------|--------------|
| Taux de requêtes par consommateur | `rate(stoa_requests_total[5m])` | Série temporelle |
| Taux de refus de politique | `rate(stoa_policy_denies_total[5m])` | Série temporelle |
| Échecs d'auth | `rate(stoa_auth_failures_total[5m])` | Série temporelle + alerte |
| Déclenchements de guardrails par type | `stoa_guardrail_triggers_total` | Diagramme en barres |
| Top consommateurs par volume | `topk(10, sum by(consumer_id))` | Tableau |
| Latence P99 | `histogram_quantile(0.99, stoa_request_duration_seconds)` | Série temporelle |

## Questions fréquentes

### Combien de temps dois-je conserver les logs d'audit ?

L'Article 5 du RGPD exige la minimisation des données — ne conservez pas plus longtemps que nécessaire. Pour des raisons de sécurité, 90 jours est une période de rétention typique pour les logs opérationnels. Cependant, l'investigation d'incidents nécessite souvent de regarder 30 à 60 jours en arrière. Si votre organisation a des exigences réglementaires spécifiques (PCI DSS : 12 mois, DORA : selon la classification des risques TIC), ces exigences sont prioritaires. Les événements d'audit de STOA hashent les paramètres de requête par défaut pour réduire l'exposition aux données personnelles dans la rétention à long terme.

### STOA peut-il détecter les attaques zero-day ?

Les guardrails de STOA sont basés sur des patterns — ils détectent des patterns d'attaque connus, pas des patterns nouveaux. Pour la détection des anomalies comportementales (identification des attaques qui ne correspondent pas à des patterns connus), vous avez besoin d'une baseline comportementale et d'un scoring d'anomalie, ce qui est généralement fait dans votre SIEM en utilisant les données du log d'audit. STOA fournit les données ; le scoring des anomalies nécessite des outils supplémentaires.

### Quel est l'impact sur les performances de la journalisation d'audit ?

Les événements du log d'audit sont écrits de manière asynchrone vers Kafka. La surcharge synchrone par requête est minimale (< 1 ms pour la sérialisation de l'événement). Si Kafka est indisponible, STOA met en buffer les événements en mémoire (taille de buffer configurable) et écrit quand la connectivité est restaurée. Dans le pire cas, une utilisation très élevée du buffer peut causer une perte de logs — dimensionnez votre topic Kafka pour votre taux de requêtes de pointe.

---

*Cela conclut la série Zero Trust pour les API gateways.*
*[Partie 1 : Ce que signifie Zero Trust](/blog/zero-trust-api-gateways-part-1) | [Partie 2 : Liste de contrôle en 10 étapes](/blog/zero-trust-stoa-checklist-part-2)*

*STOA Platform est open source (Apache 2.0). [Démarrez](https://docs.gostoa.dev/docs/guides/quickstart) ou ajoutez une étoile au projet sur [GitHub](https://github.com/stoa-platform/stoa).*
