---
slug: saas-playbook-5-production-checklist
title: "Checklist de Production SaaS : 20 Portes Avant le Lancement"
description: "Pas prêt tant que vous n'avez pas passé les 20. Portes de sécurité, performance, conformité, observabilité et réponse aux incidents pour les APIs SaaS multi-tenant."
authors: [stoa-team]
tags: [tutorial, architecture, api-gateway]
keywords:
  - SaaS API production checklist
  - API gateway production readiness
  - go-live checklist SaaS
  - multi-tenant API production
  - SaaS launch checklist 2026
  - API security checklist production
  - STOA production deployment
---
<!-- last verified: 2026-02 -->

Vous l'avez construit. Vous l'avez testé. Votre équipe dit qu'il est prêt. Avant d'ouvrir les portes, passez cette checklist en revue. Chaque élément ici représente un mode d'échec que de vraies entreprises SaaS ont vécu en production. Pas des risques théoriques — de vrais incidents qui ont coûté à des entreprises des clients, une surveillance réglementaire ou des week-ends d'ingénierie.

Il s'agit de la Partie 5 (finale) de la série **SaaS Playbook**. Elle suppose que vous avez implémenté les fondations couvertes dans les Parties [1](/blog/saas-playbook-1-multi-tenancy-101), [2](/blog/saas-playbook-2-rate-limiting-saas), [3](/blog/saas-playbook-3-audit-compliance) et [4](/blog/saas-playbook-4-scaling-multi-tenant).

<!-- truncate -->

## Comment Utiliser Cette Checklist

Il s'agit d'une liste binaire go/no-go. Chaque élément est soit **PASS** soit **FAIL** — pas de crédit partiel. Si un élément est un FAIL, ne lancez pas avant qu'il soit résolu.

Certains éléments sont optionnels pour le lancement initial s'ils sont explicitement différés avec un calendrier documenté (marqués **[Différable]**). Les éléments différables doivent avoir un ticket Linear et une date cible dans les 30 jours suivant le lancement.

---

## Section 1 : Sécurité (8 Vérifications)

### ☐ 1. Tous les tokens de tenant expirent

**Test** : Émettez un token, attendez l'expiration, vérifiez qu'il est rejeté.

Les tokens JWT doivent expirer. Il ne doit exister aucun mécanisme pour émettre des tokens non expirants, même pour les comptes de service. Les comptes de service doivent utiliser des tokens à courte durée de vie (1 à 24 heures) avec rafraîchissement automatique.

```bash
# Verify token expiry is set on all client types
stoactl tenants list-oauth-clients --tenant acme | grep -E "accessTokenLifespan|refreshTokenLifespan"
# Expected: accessTokenLifespan < 3600 (1 hour), refreshTokenLifespan < 86400 (24 hours)
```

### ☐ 2. L'autorisation cross-tenant retourne 401, pas 404

**Test** : Demandez la ressource du tenant A avec le token du tenant B. Vérifiez que vous obtenez 401, pas 404.

C'est subtil mais important. Retourner 404 pour un accès cross-tenant non autorisé est de la « sécurité par l'obscurité » — cela divulgue que la ressource existe. Un 401 est la réponse correcte indépendamment du fait que la ressource existe.

```bash
TOKEN_B=$(stoactl auth token --tenant globex)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_B" \
  ${STOA_GATEWAY_URL}/acme/billing-api/invoices
# Expected: 401 (not 403, not 404)
```

### ☐ 3. Les rate limits sont appliquées par tenant

**Test** : Dépassez la limite de rate du tenant A. Vérifiez que les requêtes du tenant B ne sont pas affectées.

```bash
# Flood Tenant A's endpoint until 429
for i in $(seq 1 2000); do
  curl -s -o /dev/null ${STOA_GATEWAY_URL}/acme/api/resource \
    -H "Authorization: Bearer $TOKEN_A"
done

# Verify Tenant B still gets 200
curl -s -o /dev/null -w "%{http_code}" \
  ${STOA_GATEWAY_URL}/globex/api/resource \
  -H "Authorization: Bearer $TOKEN_B"
# Expected: 200 (Tenant B unaffected)
```

### ☐ 4. Les secrets ne sont pas dans des variables d'environnement ou des fichiers de configuration

**Test** : `grep -r "password\|secret\|key" k8s/ --include="*.yaml" | grep -v "secretRef\|secretKeyRef\|valueFrom"`

Tous les secrets doivent référencer des Secrets Kubernetes ou votre système de gestion des secrets (Infisical, Vault, AWS Secrets Manager). Pas de secrets en texte clair dans :
- Les fichiers de valeurs Helm (même `values-prod.yaml`)
- Les manifestes Kubernetes commités dans git
- Les images Docker (`docker inspect` ne doit révéler aucun secret)
- Les fichiers de configuration d'application

### ☐ 5. TLS est appliqué sur tous les endpoints publics

**Test** : Tentez une connexion HTTP vers chaque endpoint public. Vérifiez la redirection vers HTTPS ou le rejet pur et simple.

```bash
# Test HTTP rejection
curl -v http://${STOA_GATEWAY_URL}/mcp/health
# Expected: 301 redirect to HTTPS or connection refused
```

Tous les endpoints orientés tenant doivent être HTTPS uniquement. La communication service-à-service interne dans le cluster devrait également utiliser TLS (mTLS pour les déploiements zero-trust).

### ☐ 6. La détection de PII est activée et testée

**Test** : Envoyez une requête contenant un numéro de carte bancaire vers une API non financière. Vérifiez que la requête est bloquée ou rédigée.

```bash
curl -X POST ${STOA_GATEWAY_URL}/acme/api/notes \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"content": "My card is 4111111111111111, expiry 01/28"}'
# Expected: 400 (blocked) or 200 with PII redacted in audit log
```

### ☐ 7. L'audit des dépendances est propre

**Test** : Exécutez `npm audit --audit-level=high` et `cargo audit` (ou équivalent pour votre stack). Zéro CVE critique/haute dans les dépendances de production.

```bash
# For Node.js dependencies
cd control-plane-ui && npm audit --audit-level=high

# For Rust dependencies
cd stoa-gateway && cargo audit --deny warnings
```

**Non différable** : Les vulnérabilités connues critiques/hautes en production doivent être résolues avant le lancement.

### ☐ 8. Les clés API sont rotables sans interruption de service

**Test** : Émettez une clé API, utilisez-la pour faire une requête réussie, faites tourner la clé, vérifiez que l'ancienne clé est rejetée, vérifiez que la nouvelle clé fonctionne, vérifiez que la rotation s'est produite sans interruption de service.

```bash
stoactl apikeys rotate --tenant acme --key-name production-integration
# Should return new key without invalidating mid-flight requests
```

---

## Section 2 : Fiabilité (4 Vérifications)

### ☐ 9. Les health checks sont configurés et testés

**Test** : Supprimez un pod gateway. Vérifiez que Kubernetes le contourne dans les 30 secondes.

```bash
# Delete one of N gateway pods
kubectl delete pod -n stoa-system -l app=stoa-gateway --field-selector=metadata.name=stoa-gateway-0

# Verify service continues responding within 30 seconds
watch -n 1 'curl -s -o /dev/null -w "%{http_code}" ${STOA_GATEWAY_URL}/health'
# Expected: 200 continuously, brief 503 (< 10 seconds) during pod restart
```

Les probes readiness et liveness doivent être configurées. La probe readiness empêche le trafic d'être routé vers des pods qui ne sont pas prêts (ex. encore en train de charger la configuration des tenants). La probe liveness tue et redémarre les pods bloqués.

### ☐ 10. L'arrêt gracieux est implémenté

**Test** : Envoyez SIGTERM au processus gateway. Vérifiez que les requêtes en cours se terminent avant que le processus se ferme.

Le gateway doit :
1. Arrêter d'accepter de nouvelles connexions sur SIGTERM
2. Attendre que les requêtes en cours se terminent (jusqu'à 30 secondes)
3. Puis sortir avec le code 0

```yaml
# Kubernetes lifecycle hook for graceful shutdown
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]  # Allow time for k8s to update endpoints
terminationGracePeriodSeconds: 35            # 5s preStop + 30s for in-flight requests
```

### ☐ 11. Les timeouts upstream sont configurés

**Test** : Retardez artificiellement une réponse d'API backend au-delà du seuil de timeout. Vérifiez que le gateway retourne 504, pas une connexion bloquée.

```yaml
spec:
  apis:
    - name: billing-api
      upstream: https://billing.acme.internal/v1
      timeouts:
        connect: 5s
        request: 30s       # Gateway returns 504 if backend doesn't respond in 30s
        idle: 60s
```

Ne laissez jamais les timeouts à leurs valeurs par défaut (souvent illimitées). Un upstream lent fera que les ressources du gateway seront conservées indéfiniment, provoquant finalement une défaillance en cascade.

### ☐ 12. Le circuit breaker est configuré pour les défaillances upstream **[Différable]**

**Test** : Mettez un backend hors ligne. Vérifiez que le gateway arrête de lui envoyer du trafic après N défaillances, retourne 503 avec un header `Retry-After`, et reprend l'envoi de trafic quand le backend récupère.

```yaml
spec:
  apis:
    - name: billing-api
      circuitBreaker:
        enabled: true
        failureThreshold: 5      # Open after 5 failures in 60 seconds
        timeout: 30s             # Try again after 30 seconds
        halfOpenRequests: 2      # Send 2 test requests in half-open state
```

---

## Section 3 : Observabilité (4 Vérifications)

### ☐ 13. Les alertes de taux d'erreur sont configurées

**Test** : Déclenchez des erreurs HTTP 500. Vérifiez qu'une alerte se déclenche dans les 5 minutes.

```yaml
# Prometheus alerting rule
groups:
  - name: api-gateway
    rules:
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(stoa_http_requests_total{status=~"5.."}[5m])) /
            sum(rate(stoa_http_requests_total[5m]))
          ) > 0.01
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "API Gateway error rate > 1% for 2 minutes"
```

Alertez sur le taux d'erreur, pas seulement le compte d'erreurs. Un pic d'erreurs est significatif même si le volume total est faible.

### ☐ 14. Les dashboards par tenant sont disponibles

**Test** : Ouvrez le dashboard Grafana. Vérifiez que vous pouvez voir le volume de requêtes, le taux d'erreur, la latence P50/P99 et l'utilisation du rate limit pour n'importe quel tenant individuel en 2 minutes.

Quand un tenant contacte le support en affirmant que son API est lente, vous devez voir ses métriques en 2 minutes, pas en 2 heures. Construisez les dashboards scopés par tenant avant le lancement, pas après le premier ticket de support.

### ☐ 15. Les logs d'audit sont vérifiés et interrogeables

**Test** : Effectuez 10 appels API en tant qu'utilisateur spécifique. Interrogez le log d'audit pour ces événements. Vérifiez que les 10 apparaissent dans les 30 secondes.

```bash
# Make test calls
for i in $(seq 1 10); do
  curl -s ${STOA_GATEWAY_URL}/acme/api/resource \
    -H "Authorization: Bearer $TOKEN_A"
done

# Query audit log
stoactl tenants audit query --tenant acme --actor alice@acme.example.com --from -5m
# Expected: 10 entries, all within last 5 minutes
```

Si les événements d'audit sont retardés de plus de 30 secondes, investigez le pipeline d'audit avant le lancement.

### ☐ 16. Le runbook d'astreinte est écrit et accessible

**Test** : Demandez à un ingénieur non-auteur de trouver le runbook et de décrire les étapes pour redémarrer le gateway sans interruption de service.

Votre runbook doit être accessible depuis votre plateforme d'astreinte (PagerDuty, OpsGenie, etc.) et doit couvrir :
- Comment redémarrer le gateway sans interruption de service
- Comment annuler un changement de configuration défectueux
- Comment investiguer un incident rapporté par un tenant
- Que faire quand la base de données est inaccessible
- Les contacts d'escalade et leurs fuseaux horaires

---

## Section 4 : Conformité (2 Vérifications)

### ☐ 17. La politique de rétention des logs d'audit est documentée et appliquée

**Test** : Vérifiez que la configuration de rétention dans votre UAC correspond à votre politique documentée. Interrogez un événement vieux de 91 jours — vérifiez qu'il existe (ou est dans le stockage tiède) si votre politique est de 90+ jours.

Votre politique de confidentialité doit indiquer la période de rétention. Votre implémentation technique doit l'appliquer. Ils doivent correspondre.

### ☐ 18. Le processus de demande DSAR GDPR est documenté et testé

**Test** : Soumettez une DSAR de test pour un utilisateur de test. Exécutez la procédure d'export DSAR. Vérifiez que l'export se complète dans les 72 heures (l'exigence réglementaire est 30 jours, mais testez que votre processus est plus rapide que cela).

```bash
stoactl tenants dsar export \
  --tenant test-tenant \
  --email test-user@test.example.com \
  --from 2025-01-01 \
  --to 2026-01-01 \
  --output dsar-test-export.json

# Verify the export is complete and human-readable
wc -l dsar-test-export.json
jq '.events | length' dsar-test-export.json
```

---

## Section 5 : Opérations (2 Vérifications)

### ☐ 19. La procédure de rollback est documentée et testée

**Test** : Déployez un changement de configuration cassant. Exécutez la procédure de rollback. Vérifiez que le service est restauré dans les 10 minutes.

Pour les déploiements Kubernetes, le rollback est :
```bash
kubectl rollout undo deployment/stoa-gateway -n stoa-system
kubectl rollout status deployment/stoa-gateway -n stoa-system
```

Pour les changements de configuration (mises à jour UAC, changements de politiques), vérifiez que revenir sur le YAML UAC et l'appliquer restaure le comportement précédent.

### ☐ 20. La checklist du jour de lancement est préparée

Avant le go-live, ayez une vue de monitoring en temps réel prête qui montre :
- Taux de requêtes (attendu vs réel)
- Taux d'erreur (cible < 0,1 %)
- Latence P99 (cible < 500ms pour vos APIs principales)
- Taux d'atteinte des rate limits (devrait être < 1 % pour un lancement sain)
- Nombre de tenants actifs

Désignez un « capitaine de lancement » qui possède le dashboard pendant les 4 premières heures. Définissez à l'avance un critère de décision de rollback : « Si le taux d'erreur dépasse 5 % pendant 5 minutes consécutives, nous effectuons un rollback. »

---

## La Porte Finale

Avant de marquer un élément comme PASS, testez-le. N'acceptez pas « nous pensons que ça fonctionne » — vérifiez-le.

| Section | Éléments | Requis pour Passer |
|---|---|---|
| Sécurité | 8 | Les 8 (pas de déférence) |
| Fiabilité | 4 | 3 sur 4 (le circuit breaker est différable) |
| Observabilité | 4 | Les 4 (pas de déférence) |
| Conformité | 2 | Les 2 (requis pour GDPR) |
| Opérations | 2 | Les 2 (pas de déférence) |

Si vous avez 20/20, lancez.

Si vous avez une déférence, documentez-la :
- Qu'est-ce qui est différé ?
- Quand sera-t-il fait ? (doit être dans les 30 jours)
- Qui en est responsable ? (doit être un ingénieur nommé)
- Quel est le risque si la déférence dure plus de 30 jours ?

Une déférence est une décision de risque informée, pas une dérobade. Prenez la décision consciemment, avec un responsable nommé et une date.

---

## Finaliser la Série

Félicitations pour avoir suivi le SaaS Playbook jusqu'au bout :

1. [Partie 1 : Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isoler vos tenants
2. [Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas) — Quotas par tenant et gestion des bursts
3. [Partie 3 : Audit et Conformité](/blog/saas-playbook-3-audit-compliance) — Logs immuables et préparation GDPR
4. [Partie 4 : Mise à l'Échelle des APIs Multi-Tenant](/blog/saas-playbook-4-scaling-multi-tenant) — De 50 à 5000 tenants
5. **Partie 5 : Checklist de Production** — Cet article
6. [Build vs Buy : Analyse des Coûts d'API Gateway](/blog/saas-playbook-build-vs-buy-api-gateway) — Analyse TCO pour votre décision

Pour un support à la décision sur quel API gateway utiliser pour votre SaaS : [Guide d'Achat API Gateway PME 2026](/blog/smb-api-gateway-buying-guide-2026).

Pour démarrer immédiatement : [Quickstart STOA Docker Compose](/blog/mcp-gateway-quickstart-docker).

## FAQ

### À quelle fréquence devrais-je exécuter cette checklist après le lancement ?

Exécutez la section sécurité (vérifications 1 à 8) trimestriellement ou après tout changement d'infrastructure significatif. Exécutez la checklist complète avant tout lancement majeur de fonctionnalité qui change l'authentification, l'autorisation ou le routage API. Les vérifications de sécurité 1, 2, 3 et 5 devraient faire partie de votre suite de tests d'intégration continue — pas seulement une porte de pré-lancement.

### Et si nous échouons une vérification non différable près du lancement ?

Retardez le lancement. C'est la bonne décision. Chaque élément de cette liste représente un mode d'échec connu. Lancer avec une lacune de sécurité connue ou un trou d'observabilité n'accélérera pas le succès de votre produit — cela créera une crise au pire moment possible.

### Cette checklist est-elle suffisante pour la préparation SOC 2 ?

Non. SOC 2 Type II nécessite une période d'observation de 6 à 12 mois et couvre un périmètre bien plus large que cette checklist (contrôles RH, sécurité physique, gestion des fournisseurs, etc.). Cette checklist garantit que votre infrastructure API est une base solide pour SOC 2. Utilisez une évaluation de préparation SOC 2 dédiée (il existe des outils comme Vanta, Drata ou Tugboat Logic) pour une vue d'ensemble complète.

### Ai-je besoin des 4 articles de la série avant d'exécuter cette checklist ?

Pas nécessairement. Si vous utilisez un autre gateway (pas STOA), la plupart des détails d'implémentation sont différents, mais les éléments de la checklist sont universels. La checklist est conçue pour être agnostique du gateway — elle couvre ce qui doit être vrai, pas comment y parvenir avec un produit spécifique.

### Combien de temps faut-il pour compléter cette checklist ?

Allouez 1 à 2 journées complètes d'ingénierie pour la première exécution. Les vérifications de sécurité nécessitent souvent des changements d'infrastructure qui prennent des heures à implémenter et vérifier. Après la première exécution, les vérifications suivantes (avant les grandes versions) prennent généralement 2 à 4 heures si aucune régression n'est trouvée.
