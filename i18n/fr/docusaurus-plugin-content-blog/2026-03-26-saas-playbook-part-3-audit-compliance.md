---
unlisted: true
slug: saas-playbook-3-audit-compliance
title: "Journalisation d'Audit SaaS : GDPR, SOC 2 et Isolation par Tenant"
description: "Construire des APIs multi-tenant prêtes pour l'audit. Logs immuables, demandes DSAR GDPR, collecte de preuves SOC 2 et isolation des logs par tenant."
authors: [stoa-team]
tags: [tutorial, compliance, architecture]
keywords:
  - API audit logging SaaS
  - multi-tenant compliance API gateway
  - GDPR API audit trail
  - SOC 2 API logging
  - per-tenant audit logs
  - API compliance SaaS
  - STOA audit logging
---
<!-- last verified: 2026-02 -->

Chaque produit SaaS fait face tôt ou tard à une question de conformité. Un client enterprise demande un rapport SOC 2 Type II. Un client européen demande un log d'audit GDPR. Un client des services financiers a besoin de preuves que personne n'a accédé à ses données sans autorisation. La façon dont vous répondez à ces questions — et si vous pouvez y répondre — dépend entièrement des décisions que vous avez prises lors de la construction de votre infrastructure de logging.

Il s'agit de la Partie 3 de la série **SaaS Playbook**. La Partie 1 couvrait les [fondamentaux de la multi-tenancy](/blog/saas-playbook-1-multi-tenancy-101). La Partie 2 couvrait les [stratégies de rate limiting](/blog/saas-playbook-2-rate-limiting-saas). Ici, nous abordons la journalisation d'audit et la conformité.

<!-- truncate -->

## Pourquoi la Journalisation d'Audit est une Préoccupation de Premier Ordre

La journalisation n'est pas une fonctionnalité que vous ajoutez plus tard. Les décisions que vous prenez dans les six premiers mois de la vie de votre produit déterminent si vous pouvez répondre à des questions de conformité deux ans plus tard. Le mode d'échec le plus courant : une startup grandit jusqu'à l'échelle enterprise, gagne un grand client, se voit demander des preuves SOC 2, et découvre que sa piste d'audit a des lacunes parce qu'elle n'a jamais implémenté l'isolation des logs par tenant.

Les trois scénarios de conformité auxquels vous ferez face le plus souvent en tant qu'entreprise SaaS B2B :

**GDPR Article 30 (Registres des activités de traitement)** : Vous devez tenir des registres de toutes les activités de traitement incluant les finalités du traitement, les catégories de personnes concernées et les transferts vers des tiers. Pour la gestion d'API, cela signifie savoir exactement quelles APIs ont accédé à quelles données, au nom de qui et quand.

**SOC 2 Type II (Critère Commun 6 — Contrôles d'accès logiques et physiques)** : Les auditeurs veulent voir que vous pouvez démontrer qui a accédé à quoi, quand, et si cet accès était autorisé. Cela nécessite des logs d'audit inviolables qui ne peuvent pas être modifiés après coup.

**HIPAA (pour la santé US)** : La Security Rule exige des contrôles d'audit qui enregistrent et examinent l'activité dans les systèmes d'information contenant ou utilisant des informations de santé protégées. C'est une exigence stricte, pas une bonne pratique.

La bonne nouvelle : construire un système de journalisation d'audit approprié pour un API gateway multi-tenant n'est pas aussi complexe que les certifications de conformité le font paraître. Les fondamentaux sont simples.

## Les Quatre Propriétés d'un Log d'Audit Conforme

Avant d'implémenter quoi que ce soit, définissez ce qu'une entrée de log d'audit conforme doit contenir et garantir.

### Propriété 1 : Complétude

Chaque appel API doit produire une entrée de log d'audit. Pas d'échantillonnage. Pas de filtrage des requêtes « peu importantes ». Les auditeurs de conformité demanderont : « Comment savez-vous que ce log est complet ? » Votre réponse doit être : « Chaque requête à travers le gateway produit une entrée. Il n'y a pas de chemin de code qui saute la journalisation. »

### Propriété 2 : Preuve d'Inviolabilité

Une fois écrites, les entrées d'audit doivent être immuables. Un attaquant qui compromet votre application ne doit pas pouvoir supprimer les preuves de son accès. Au minimum, cela signifie un stockage en mode append-only. Pour une assurance plus élevée, cela signifie un chaînage cryptographique (chaque entrée inclut un hash de l'entrée précédente, comme une blockchain).

### Propriété 3 : Isolation par Tenant

Les logs d'audit du tenant A ne doivent jamais être accessibles au tenant B, ni à un opérateur qui n'a pas d'autorisation explicite pour le tenant A. Ce n'est pas seulement une exigence de sécurité — c'est une exigence de conformité pour le GDPR (les registres de traitement doivent être tenus séparément) et une exigence contractuelle pour la plupart des MSAs enterprise.

### Propriété 4 : Structuré et Interrogeable

Les logs d'audit qui ne peuvent pas être interrogés efficacement sont de la mise en scène de conformité. Vous devez pouvoir répondre à des questions comme « montrez-moi toutes les requêtes de l'utilisateur X vers l'endpoint Y dans les 90 derniers jours » en quelques secondes, pas en heures.

## Architecture de Log d'Audit STOA

STOA implémente la journalisation d'audit par tenant comme fonctionnalité centrale, pas comme plugin. Chaque requête à travers le gateway produit une entrée de log d'audit structurée dans le flux de log isolé du tenant.

### Structure d'Entrée de Log d'Audit

```json
{
  "timestamp": "2026-03-17T14:23:41.123Z",
  "event_id": "01HXK4J8P2QRST3UV5WXY6Z7A",
  "tenant_id": "acme",
  "request_id": "req_7f3a2b1c",
  "session_id": "sess_abc123",
  "actor": {
    "type": "user",
    "id": "user-123",
    "email": "alice@acme.example.com",
    "ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0 ..."
  },
  "action": {
    "method": "POST",
    "path": "/billing-api/v1/invoices",
    "query": {},
    "response_status": 201,
    "latency_ms": 43
  },
  "authorization": {
    "token_type": "jwt",
    "scopes": ["billing-api:write"],
    "decision": "allowed",
    "policy_matched": "professional-tier-billing"
  },
  "data": {
    "request_size_bytes": 1024,
    "response_size_bytes": 512,
    "pii_detected": false,
    "guardrails_triggered": []
  },
  "chain_hash": "sha256:a3f2b1c4d5e6f7..."
}
```

Champs clés pour la conformité :
- `event_id` : format ULID — triable lexicographiquement, globalement unique
- `actor.email` : L'identité humaine derrière la requête (depuis les claims JWT)
- `authorization.decision` : La requête a-t-elle été autorisée ou refusée ? Les refus sont tout aussi importants à journaliser
- `chain_hash` : Hash de l'entrée précédente + le contenu de l'entrée actuelle — permet la détection d'altération
- `pii_detected` : Si la GuardrailPolicy a détecté des PII dans le payload de la requête

### Activer la Journalisation d'Audit dans STOA

La journalisation d'audit est activée par tenant dans l'UAC :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: UniversalAPIContract
metadata:
  name: acme-contract
  namespace: tenant-acme
spec:
  audit:
    enabled: true
    level: full              # full | summary | errors-only
    retention:
      days: 365              # GDPR: typically 90-365 days
      immutable: true        # Append-only storage
    destination:
      type: postgresql       # postgresql | s3 | elasticsearch | loki
      encryption: aes256     # Encrypt at rest
    pii:
      detection: enabled
      action: redact         # redact | flag | block
```

`level: full` journalise chaque requête incluant celles qui réussissent. Pour la conformité GDPR, vous avez typiquement besoin de `full`. Pour SOC 2, `full` ou `summary` est acceptable. `errors-only` n'est approprié que pour le débogage, jamais pour la conformité.

### Isolation des Logs par Tenant

Les entrées d'audit sont écrites dans un stockage scopé par tenant. Dans le backend PostgreSQL par défaut :

```sql
-- Each tenant has a dedicated schema
-- acme tenant entries go to: schema audit_acme
-- globex tenant entries go to: schema audit_globex
-- No cross-schema reads without explicit grant

SELECT * FROM audit_acme.events
WHERE actor_email = 'alice@acme.example.com'
AND timestamp >= NOW() - INTERVAL '90 days'
ORDER BY timestamp DESC;
```

Le compte de service du gateway pour le tenant A dispose de INSERT sur `audit_acme.events` — il ne peut pas lire ou écrire dans `audit_globex.events`. Cela est appliqué au niveau de la base de données, pas seulement au niveau de l'application.

## Conformité GDPR : Demandes de Droits des Personnes Concernées

Le GDPR accorde aux personnes concernées le droit d'accéder à toutes les données traitées à leur sujet (Article 15), le droit à l'effacement (Article 17) et le droit à la portabilité (Article 20). Pour vos logs d'audit API, cela a des implications spécifiques.

### Droit d'Accès (Article 15)

Quand un utilisateur soumet une demande d'accès des personnes concernées (DSAR), il a droit à recevoir tous les enregistrements de traitement qui le concernent. Pour les logs d'audit, cela signifie que vous devez pouvoir interroger « tous les événements API où actor.email = 'user@example.com' » et exporter les résultats dans un format lisible.

```bash
# STOA CLI: export DSAR for a user
stoactl tenants dsar export \
  --tenant acme \
  --email alice@acme.example.com \
  --from 2024-01-01 \
  --to 2026-01-01 \
  --format json
```

L'export inclut tous les événements d'audit où l'utilisateur était l'acteur, incluant les requêtes refusées (qui sont souvent les plus pertinentes d'un point de vue DSAR — elles révèlent ce que l'utilisateur a essayé de faire et dont il a été empêché).

### Droit à l'Effacement (Article 17)

L'effacement pour les logs d'audit est plus nuancé que pour les données applicatives. Les logs d'audit servent un intérêt légitime (sécurité, conformité, défense juridique) qui supplante souvent le droit à l'effacement. Cependant, vous devriez :

1. **Pseudonymiser** plutôt que supprimer quand c'est possible : remplacer `actor.email` par un hash de l'email pour les événements plus anciens que votre période de rétention
2. **Avoir une politique documentée** : indiquer clairement votre période de rétention des logs d'audit et la base juridique dans votre politique de confidentialité
3. **Séparer les PII des événements** : stocker l'identité de l'acteur dans une table utilisateur séparée, liée par ID utilisateur. Si un utilisateur est supprimé, son identité peut être retirée tandis que les événements (avec des ID d'acteur pseudonymisés) restent à des fins de conformité

### Détection et Rédaction des PII

Si votre API accepte ou retourne des PII dans les corps de requête/réponse (noms, emails, numéros de compte, etc.), vous devez contrôler comment ces données apparaissent dans les logs d'audit.

La `GuardrailPolicy` de STOA supporte la détection de PII via la correspondance de patterns :

```yaml
spec:
  contentFilter:
    piiDetection: enabled
    patterns:
      - type: email
        action: redact       # Replace with [REDACTED:EMAIL]
      - type: credit-card
        action: block        # Reject the request entirely
      - type: ssn
        action: redact
    auditPiiEvents: true     # Log that PII was detected, but not the PII itself
```

Le log d'audit enregistre que des PII ont été détectées (`pii_detected: true`) et quel pattern a été déclenché, sans inclure la valeur PII réelle. Cela vous permet de satisfaire les exigences de conformité (« nous avons détecté et bloqué/rédigé des PII dans N requêtes ce mois-ci ») sans créer un pot de miel de données sensibles dans vos logs d'audit.

## SOC 2 Type II : Construire Votre Piste de Preuves

Les audits SOC 2 Type II couvrent une période d'observation de 6 à 12 mois. L'auditeur demandera des preuves que vos contrôles fonctionnaient efficacement tout au long de la période. Pour les contrôles d'accès API, vos preuves sont votre log d'audit.

### Ce que les Auditeurs Recherchent

| CC | Contrôle | Preuve | Source |
|---|---|---|---|
| CC6.1 | L'accès logique est restreint aux personnes autorisées | Événements de validation de clé API / token JWT | Log d'audit STOA |
| CC6.2 | Le nouvel accès est provisionné sur la base d'une autorisation | Événements de création de tenant + enregistrement d'API | Audit admin STOA |
| CC6.3 | L'accès est modifié quand les rôles changent | Événements de révocation de token | STOA + Keycloak |
| CC6.7 | Les données restreintes sont transmises via des canaux chiffrés | Application TLS, événements de certificat | Log d'accès STOA |
| CC7.2 | L'activité anormale est détectée | Événements de violation de rate limit | Métriques STOA |

### Générer des Rapports de Preuves SOC 2

```bash
# Export SOC 2 evidence for a time period
stoactl compliance soc2-report \
  --tenant acme \
  --from 2025-04-01 \
  --to 2026-03-31 \
  --output soc2-evidence-2025-2026.pdf
```

Le rapport inclut :
- Total des appels API par mois (montre le volume d'activité auditée)
- Taux de succès/échec d'autorisation
- Nombre de tentatives d'accès refusées (démontre que les contrôles d'accès sont actifs)
- Événements de provisionnement et de révocation de clé API
- Violations de rate limit (démontre la détection des abus)

### Assurer l'Intégrité des Logs

Pour SOC 2, vous devez démontrer que les logs d'audit ne peuvent pas être modifiés après coup. STOA utilise deux mécanismes :

**Chaînage cryptographique** : Chaque entrée d'audit inclut un `chain_hash` qui est le SHA-256 du hash de l'entrée précédente + le contenu de l'entrée actuelle. Toute modification d'une entrée passée brise la chaîne — détectable en réexécutant la validation du hash.

**Stockage append-only** : Le rôle de base de données utilisé par l'auteur d'audit dispose d'un accès INSERT mais pas UPDATE ou DELETE. Même si un attaquant compromet le processus applicatif, il ne peut pas modifier les entrées passées.

```bash
# Verify audit log integrity (run periodically or before audits)
stoactl tenants audit verify \
  --tenant acme \
  --from 2025-01-01 \
  --to 2026-01-01
# Output: "Audit chain verified: 3,241,891 entries, 0 integrity violations"
```

## Rétention et Stockage des Logs

### Politique de Rétention

| Réglementation | Rétention Minimale | Recommandée |
|---|---|---|
| GDPR | Pas de minimum spécifique ; doit être « pas plus longtemps que nécessaire » | 90 jours pour les logs API, 1 an pour les événements de sécurité |
| SOC 2 | 1 an pour la période de preuves + tampon | 2 ans |
| HIPAA | 6 ans | 7 ans |
| PCI-DSS | 1 an (3 mois immédiatement disponibles) | 2 ans |
| Pas d'exigence spécifique | 90 jours | 1 an |

STOA supporte la rétention par niveaux : stockage chaud (PostgreSQL, 90 derniers jours, requête rapide), stockage tiède (S3/stockage objet, 90 jours à 2 ans, requête lente), stockage froid (Glacier/archive, au-delà de 2 ans, récupération sur demande).

```yaml
spec:
  audit:
    retention:
      hot:
        days: 90
        storage: postgresql
      warm:
        days: 730           # 2 years
        storage: s3
        bucket: stoa-audit-${tenant_id}
      cold:
        days: 2190          # 6 years (HIPAA)
        storage: glacier
```

### Chiffrement au Repos

Les logs d'audit doivent être chiffrés au repos. STOA utilise AES-256 pour PostgreSQL (via le chiffrement transparent des données ou le chiffrement de colonne pgcrypto) et le chiffrement côté serveur pour le stockage S3.

Pour les tenants ayant des exigences de résidence des données, STOA supporte les clés de chiffrement par tenant — la compromission de la clé d'un tenant n'expose pas les données d'audit d'un autre tenant.

## Pratique : Interroger Votre Piste d'Audit

Les requêtes d'audit les plus courantes que vous effectuerez :

```bash
# Who accessed the billing API in the last 7 days?
stoactl tenants audit query \
  --tenant acme \
  --api billing-api \
  --from -7d

# All denied access attempts (security review)
stoactl tenants audit query \
  --tenant acme \
  --decision denied \
  --from -30d \
  --format csv

# All events for a specific user (DSAR or incident investigation)
stoactl tenants audit query \
  --tenant acme \
  --actor alice@acme.example.com \
  --from -365d \
  --format json | jq '.events | length'

# PII events summary
stoactl tenants audit query \
  --tenant acme \
  --filter pii_detected=true \
  --from -30d \
  --group-by day
```

## Ce Qui Vient Ensuite

Avec la multi-tenancy (Partie 1), le rate limiting (Partie 2) et la journalisation d'audit (Partie 3) en place, votre API SaaS dispose des trois piliers de la préparation enterprise. Le prochain défi : maintenir tout cela fonctionnel à mesure que vous passez de 50 à 5000 tenants.

**SaaS Playbook Complet :**
1. [Partie 1 : Multi-Tenancy 101](/blog/saas-playbook-1-multi-tenancy-101) — Isoler vos tenants
2. [Partie 2 : Stratégies de Rate Limiting](/blog/saas-playbook-2-rate-limiting-saas) — Quotas par tenant et gestion des bursts
3. **Partie 3 : Audit et Conformité** — Cet article
4. [Partie 4 : Mise à l'Échelle des APIs Multi-Tenant](/blog/saas-playbook-4-scaling-multi-tenant) — De 50 à 5000 tenants
5. [Partie 5 : Checklist de Production](/blog/saas-playbook-5-production-checklist) — Porte de mise en production en 20 points
6. [Build vs Buy : Analyse des Coûts d'API Gateway](/blog/saas-playbook-build-vs-buy-api-gateway) — Analyse TCO pour votre décision

## FAQ

### Dois-je journaliser les requêtes refusées, pas seulement les réussies ?

Oui, absolument. Les requêtes refusées sont souvent les entrées forensiquement les plus précieuses de votre log d'audit. Elles révèlent qui a essayé d'accéder à ce qu'il ne devrait pas, ce qui est critique pour les investigations d'incidents de sécurité et les démonstrations de conformité. STOA journalise toutes les décisions d'autorisation — autorisées et refusées — au niveau `summary` et au-dessus.

### Combien de temps dois-je conserver les logs d'audit API ?

Pour la plupart des entreprises SaaS B2B sans exigences réglementaires spécifiques, 1 an de stockage chaud est un bon point de départ. Si vous servez des industries réglementées (santé, finance), vérifiez le minimum réglementaire applicable et ajoutez un tampon. La rétention par niveaux de STOA (chaud/tiède/froid) vous permet de conserver des données pendant des années tout en contrôlant les coûts de stockage.

### Quelle est la différence entre un log d'accès et un log d'audit ?

Un **log d'accès** enregistre qu'une requête s'est produite : IP, méthode, chemin, code de statut, latence. Il est principalement utilisé pour le débogage et l'analyse des performances. Un **log d'audit** enregistre qui a fait quoi et si c'était autorisé : identité de l'acteur, décision d'autorisation, quelles données ont été accédées. Les logs d'accès servent les opérations ; les logs d'audit servent la conformité et la sécurité.

### Puis-je désactiver la journalisation d'audit pour les APIs non sensibles afin de réduire les coûts de stockage ?

STOA permet de configurer `level: errors-only` ou `level: summary` pour des APIs spécifiques via des overrides d'audit par API dans l'UAC. Cependant, à des fins de conformité, vous ne devriez généralement pas désactiver entièrement la journalisation d'audit pour toute API qui touche des données de tenant. Consultez votre cadre de conformité avant de désactiver.

### Comment démontrer à un auditeur que mon log d'audit est inviolable ?

Montrez-lui la commande de vérification de la chaîne cryptographique et son résultat : « Chaîne d'audit vérifiée : N entrées, 0 violation d'intégrité. » Démontrez également que le rôle de base de données utilisé pour l'écriture d'audit n'a pas les privilèges UPDATE et DELETE. Pour les environnements à haute assurance, envisagez de streamer les événements d'audit vers un puits externe immuable (AWS CloudTrail, Azure Monitor) comme enregistrement secondaire.
