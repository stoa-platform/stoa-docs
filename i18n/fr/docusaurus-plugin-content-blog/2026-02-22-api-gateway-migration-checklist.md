---
slug: api-gateway-migration-checklist
title: "Checklist migration API Gateway : 15 étapes zéro downtime"
description: "Ne migrez pas à l'aveugle. 15 étapes éprouvées : inventaire API, translation de politiques, bascule progressive du trafic, rollback et validation post-migration."
authors: [stoa-team]
tags: [tutorial, migration, api-gateway]
keywords:
  - checklist migration api gateway 2026
  - étapes migration api gateway
  - migration zéro downtime api
  - planification migration gateway
  - remplacement api gateway guide
  - migration webMethods STOA
  - migration ESB open source
  - modernisation middleware enterprise
---
<!-- last verified: 2026-03 -->

Migrer un API gateway est l'un des changements d'infrastructure les plus critiques qu'une organisation puisse entreprendre. Mal exécutée, la migration provoque des coupures, des intégrations cassées et des failles de sécurité. Bien exécutée, elle est invisible pour les consommateurs tout en débloquant de nouvelles capacités.

Cette checklist en 15 étapes garantit zéro downtime et zéro perte de données pendant votre migration d'API gateway, que vous veniez de webMethods, Kong, Apigee, DataPower, MuleSoft, Oracle OAM, Axway, ou toute autre plateforme.

<!-- truncate -->

## Pourquoi une checklist est indispensable

Les migrations d'API gateway échouent pour des raisons prévisibles :

- **Inventaire incomplet** — Des API oubliées qui cassent après la bascule
- **Politiques non testées** — L'authentification fonctionne en staging, échoue en production
- **Surprises consommateurs** — Endpoints ou patterns d'auth modifiés découverts trop tard
- **Pas de plan de rollback** — Trafic basculé vers le nouveau gateway sans retour possible
- **Décommissionnement prématuré** — Ancien gateway supprimé avant la fin de la période de vérification

Une checklist systématique élimine ces modes de défaillance. Utilisez-la comme un document vivant : cochez les étapes au fur et à mesure, ajoutez des notes spécifiques à votre environnement, et suivez les blocages en temps réel.

:::info Contexte entreprises européennes

Dans les grandes banques et assureurs français, la migration de la passerelle d'intermédiation (webMethods, Axway, DataPower) est un projet à enjeux multiples : continuité de service réglementaire (**DORA** exige une résilience opérationnelle démontrée), gestion du changement CAB (Change Advisory Board), et coordination entre équipes infrastructure, sécurité et métier. Cette checklist intègre ces contraintes organisationnelles en plus des considérations techniques.

:::

---

## La checklist en 15 étapes

Cette checklist suit la **stratégie augmenter-d'abord** : déployer le nouveau gateway à côté de l'existant, valider en mode shadow, puis basculer le trafic progressivement. Pour la justification stratégique, voir le [Guide de migration API Gateway 2026](/blog/api-gateway-migration-guide-2026).

---

## Phase 1 : découverte et planification

La base d'une migration réussie est de savoir exactement ce que vous avez. Une découverte incomplète cause 60 % des échecs de migration.

### Étape 1 : créer un inventaire complet des API

**Objectif :** documenter chaque API, endpoint, consommateur et pattern de trafic de votre environnement de production.

**Livrables :**
- Tableur ou base avec colonnes : nom API, chemin de base, protocole (REST/SOAP/GraphQL/gRPC), méthode d'authentification, requêtes/seconde moyennes, requêtes/seconde en pic, nombre de consommateurs, équipe propriétaire, classification critique/non-critique
- Pour chaque API : liste des endpoints (chemins + méthodes HTTP)
- Analyse du volume de trafic des 30 derniers jours

**Comment collecter :**
- Logs ou tableau de bord analytique du gateway legacy (extraire les stats de trafic)
- Portail développeur ou catalogue d'API (si disponible)
- Analyse du dépôt de code source (`grep -r "api.example.com"`)
- Entretiens avec les équipes applicatives (connaissent souvent les API non documentées)

**Vigilance :**
- API shadow IT (API non enregistrées dans le gateway mais appelées directement)
- API dépréciées avec trafic résiduel (0,01 % des appels peut être une intégration B2B critique)
- API de traitement batch ou week-end uniquement (n'apparaissent pas dans l'analyse de trafic en semaine)

**Statut :** ☐ Inventaire complet créé
**Notes :** _____________________________________________________

---

### Étape 2 : créer un inventaire des politiques

**Objectif :** documenter chaque politique de sécurité, rate limiting, transformation et routage appliquée à vos API.

**Livrables :**
- Tableur avec colonnes : nom API, type de politique (auth/rate-limit/CORS/transformation/routage), configuration, dépendances (systèmes externes, secrets, certificats)
- Détails d'authentification : fournisseur OAuth2, stockage des clés API, autorité de certification mTLS, IdP SAML
- Tiers de rate limiting : quotas par consommateur, limites de burst, fenêtres temporelles
- Logique custom : transformations requête/réponse, manipulation d'en-têtes, règles de validation

**Comment collecter :**
- Export de la configuration du gateway (config déclarative Kong, définitions API webMethods, bundles proxy Apigee)
- Pour les formats propriétaires : capture d'écran des écrans de politiques et documentation manuelle
- Test de chaque API avec différentes identités consommateur pour valider le comportement des politiques

**Vigilance :**
- Politiques implicites (appliquées au niveau global, non visibles dans la config par API)
- Politiques chaînées (la politique A dépend de la sortie de la politique B)
- Dépendances externes (politique appelle un PDP, service de détection de fraude, LDAP legacy)

**Statut :** ☐ Inventaire complet des politiques créé
**Notes :** _____________________________________________________

---

### Étape 3 : cartographier les points d'intégration

**Objectif :** identifier chaque système qui s'intègre avec votre API gateway (upstream, downstream et services latéraux).

**Livrables :**
- Schéma réseau montrant : applications consommatrices → gateway → services upstream
- Enregistrements DNS des noms d'hôte du gateway
- Configuration du load balancer (si le gateway est derrière un LB)
- Détails des certificats (point de terminaison TLS, exigences mTLS)
- Intégrations monitoring et logging (où les métriques et logs sont envoyés)
- Intégration fournisseur d'identité (Keycloak, Okta, Azure AD, LDAP custom)

**Vigilance :**
- Adresses IP codées en dur dans les applications consommatrices (casseront après migration)
- Certificats TLS épinglés (consommateurs qui valident l'empreinte du certificat, pas seulement la chaîne)
- Rate limiting ou allowlisting basé sur IP (cassera si l'IP du gateway change)

**Statut :** ☐ Cartographie complète des intégrations créée
**Notes :** _____________________________________________________

---

### Étape 4 : définir les critères de succès

**Objectif :** établir des cibles mesurables pour la latence, les taux d'erreur et la continuité métier pendant et après la migration.

**Livrables :**
- Métriques de référence du gateway existant (niveaux de performance actuels)
- Métriques cibles pour le nouveau gateway (plages acceptables)
- Déclencheurs de rollback (conditions forçant un retour immédiat à l'ancien gateway)
- Exigences de continuité d'activité (durée d'indisponibilité maximale acceptable, tolérance de perte de données)

**Métriques de référence à capturer :**
- Latence P50, P95, P99 (millisecondes)
- Taux d'erreur par code HTTP (4xx vs 5xx)
- Débit (requêtes/seconde soutenu et pic)
- Time to first byte (TTFB) pour les API représentatives
- Taux de succès d'authentification des consommateurs

**Exemples de critères de succès :**
| Métrique | Actuel (Référence) | Cible (Nouveau Gateway) | Déclencheur Rollback |
|--------|------------------|---------------------|----------------|
| Latence P95 | 85ms | &lt;100ms | &gt;200ms soutenu 5 min |
| Taux d'erreur 5xx | 0,02 % | &lt;0,05 % | &gt;0,2 % soutenu 5 min |
| Taux succès auth | 99,97 % | &gt;99,95 % | &lt;99,5 % |
| Débit | 12 000 req/s | ≥12 000 req/s | &lt;10 000 req/s |

:::tip Exigences DORA pour les critères de succès

Pour les établissements financiers soumis à DORA, les critères de succès doivent inclure des métriques spécifiques à la résilience opérationnelle :
- **Temps de reprise (RTO)** : le rollback vers l'ancien gateway doit s'exécuter en moins de 5 minutes
- **Objectif de perte de données (RPO)** : zéro transaction perdue pendant la bascule
- **Piste d'audit continue** : aucune interruption de la journalisation d'audit pendant la migration (exigence article 12)

Ces métriques doivent être documentées dans le plan de test de résilience numérique que les régulateurs (ACPR, BaFin) peuvent demander à tout moment.

:::

**Statut :** ☐ Critères de succès définis et approuvés
**Notes :** _____________________________________________________

---

## Phase 2 : mise en place parallèle

Cette phase déploie le nouveau gateway à côté de l'existant. Le nouveau gateway ne reçoit aucun trafic de production — uniquement du trafic synthétique et du trafic shadow (copies de requêtes).

### Étape 5 : déployer le gateway cible en mode shadow

**Objectif :** installer et configurer le nouveau API gateway dans votre environnement de production sans y router de trafic live.

**Livrables :**
- Nouveau gateway déployé dans le cluster/VMs de production
- Connectivité réseau vérifiée (peut atteindre les services upstream)
- Observabilité configurée (métriques Prometheus, transfert de logs)
- Réplication de trafic shadow activée (dupliquer les requêtes de production vers le nouveau gateway, ignorer les réponses)

**Comment déployer :**
- Utiliser l'infrastructure-as-code (Terraform, charts Helm, Ansible)
- Déployer dans le même cluster Kubernetes ou zone réseau que le gateway legacy
- Configurer le DNS pour le nouveau hostname (ex. `api-v2.example.com`) sans le publier encore
- Configurer le mirroring : load balancer ou service mesh pour dupliquer les requêtes vers le nouveau gateway

**Vérification :**
```bash
# Vérifier que le nouveau gateway tourne
kubectl get pods -n gateway-system -l app=stoa-gateway

# Envoyer du trafic synthétique
curl -H "Authorization: Bearer test-token" https://api-v2.example.com/health

# Vérifier que le trafic shadow est reçu (logs du nouveau gateway)
kubectl logs -n gateway-system deployment/stoa-gateway --tail=100 | grep "GET /api/v1"
```

**Statut :** ☐ Nouveau gateway déployé et recevant le trafic shadow
**Notes :** _____________________________________________________

---

### Étape 6 : importer les configurations API

**Objectif :** recréer toutes les API de votre gateway legacy dans le nouveau gateway, en utilisant la configuration déclarative quand c'est possible.

**Livrables :**
- Toutes les API de l'inventaire Étape 1 configurées dans le nouveau gateway
- Définitions OpenAPI/Swagger importées (si supporté)
- Routes, cibles upstream et health checks configurés

**Comment importer :**
- **Option 1 (meilleure) :** exporter les specs OpenAPI du gateway legacy, importer dans le nouveau gateway
- **Option 2 :** utiliser des scripts de migration pour convertir la config propriétaire (ex. YAML déclaratif Kong → UAC STOA)
- **Option 3 :** recréation manuelle (fastidieux mais garantit une config propre)

**Guides spécifiques par plateforme :**
- [Migration webMethods](/blog/webmethods-migration-guide) — export depuis Integration Server, conversion Flow vers REST
- [Migration Kong](/docs/guides/migration/kong) — `deck dump` pour exporter la config déclarative
- [Migration Apigee](/blog/apigee-alternative-open-source) — export des bundles proxy, translation des politiques JavaScript
- [Migration DataPower/TIBCO](/blog/datapower-tibco-migration-guide) — export manuel, bridging SOAP-vers-REST

**Statut :** ☐ Toutes les API configurées dans le nouveau gateway
**Notes :** _____________________________________________________

---

### Étape 7 : répliquer les politiques de sécurité

**Objectif :** appliquer les politiques d'authentification, rate limiting, CORS et autres de l'inventaire Étape 2 au nouveau gateway.

**Livrables :**
- Toutes les politiques de l'Étape 2 configurées dans le nouveau gateway
- Intégration d'authentification testée (OAuth2, clés API, mTLS)
- Tiers de rate limiting répliqués (mêmes quotas que le gateway legacy)
- Politiques CORS appliquées (mêmes origines et en-têtes autorisés)

**Vérification :**
```bash
# Tester l'authentification (doit retourner 401 sans token valide)
curl https://api-v2.example.com/api/v1/protected

# Tester l'authentification (doit retourner 200 avec token valide)
curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/protected

# Tester le rate limiting (envoyer 100 requêtes rapidement)
for i in {1..100}; do curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/test; done

# Vérifier les en-têtes CORS
curl -X OPTIONS -H "Origin: https://app.example.com" https://api-v2.example.com/api/v1/test -i
```

**Statut :** ☐ Toutes les politiques de sécurité répliquées et testées
**Notes :** _____________________________________________________

---

### Étape 8 : exécuter les tests de trafic synthétique

**Objectif :** valider le nouveau gateway sous charge réaliste avant de router du trafic de production.

**Livrables :**
- Suite de tests synthétiques couvrant toutes les API de l'inventaire Étape 1
- Résultats de test de charge montrant que le nouveau gateway gère le débit attendu
- Rapport comparatif : nouveau gateway vs. gateway legacy

**Exemple de test k6 :**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Montée à 100 utilisateurs
    { duration: '5m', target: 100 },  // Maintien à 100 utilisateurs
    { duration: '2m', target: 0 },    // Descente
  ],
};

export default function () {
  let response = http.get('https://api-v2.example.com/api/v1/users', {
    headers: { 'Authorization': 'Bearer test-token' },
  });
  check(response, {
    'statut 200': (r) => r.status === 200,
    'temps réponse < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Critères de vérification :**
- Latence P95 dans la cible de l'Étape 4
- Taux d'erreur en dessous du seuil
- Aucun épuisement de ressources (CPU/RAM/descripteurs de fichiers sous 80 %)

**Statut :** ☐ Tests synthétiques passants, performance dans les cibles
**Notes :** _____________________________________________________

---

## Phase 3 : migration du trafic

C'est la phase à haut risque. Vous routez maintenant du trafic de production via le nouveau gateway. Commencez petit (1 %), validez soigneusement, puis augmentez progressivement.

### Étape 9 : routage canary (1 % → 10 % → 50 % → 100 %)

**Objectif :** basculer le trafic de production vers le nouveau gateway de manière incrémentale, en validant à chaque palier.

**Planning de progression canary :**
| Palier | % trafic nouveau gateway | Durée de stabilisation | Critères de validation |
|------|------------------------|----------|-------------------|
| 1 | 1 % | 30 min | Taux d'erreur &lt; 0,1 %, latence P95 dans la cible |
| 2 | 5 % | 2 heures | Pas d'augmentation des erreurs rapportées |
| 3 | 10 % | 4 heures | Validation charge soutenue |
| 4 | 25 % | 8 heures | Inclure une période de pic de trafic |
| 5 | 50 % | 24 heures | Validation trafic majoritaire |
| 6 | 75 % | 24 heures | Le legacy devient backup |
| 7 | 100 % | 1 semaine | Bascule complète, legacy en veille |

**Options de routage :**
- **DNS pondéré :** deux enregistrements A avec poids différents (limité, cache client agressif)
- **Split load balancer :** routage X % ancien / (100-X) % nouveau — meilleur contrôle fin
- **Canary service mesh :** Istio, Linkerd ou Consul pour le split de trafic L7 — le plus flexible
- **Orchestration multi-gateway :** adaptateur [multi-gateway STOA](/docs/guides/multi-gateway-setup)

**Procédure de rollback :**
```bash
# Rollback load balancer (exemple nginx)
# Remettre le poids à 100 % ancien gateway
kubectl edit configmap nginx-config -n ingress-nginx
# Set: old_gateway weight=100, new_gateway weight=0
kubectl rollout restart deployment nginx-ingress-controller -n ingress-nginx
```

**Statut :** ☐ Routage canary en cours (actuellement à ___%)
**Notes :** _____________________________________________________

---

### Étape 10 : monitorer taux d'erreur et latence à chaque palier

**Objectif :** détecter les régressions immédiatement pendant le déploiement canary, avant qu'elles n'impactent tous les utilisateurs.

**Livrables :**
- Dashboard temps réel montrant : taux d'erreur (4xx, 5xx), latence P50/P95/P99, débit, taux de succès d'authentification
- Alertes configurées : seuil de taux d'erreur dépassé, seuil de latence dépassé, déséquilibre de trafic détecté
- Runbook pour l'ingénieur d'astreinte : quoi vérifier, comment rollback

**Exemples de requêtes Prometheus :**
```promql
# Taux d'erreur (par gateway)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Latence P95 (par gateway)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Débit (requêtes par seconde)
rate(http_requests_total[1m])
```

**Statut :** ☐ Monitoring configuré et alertes validées
**Notes :** _____________________________________________________

---

### Étape 11 : notification des consommateurs et fenêtre de test

**Objectif :** donner aux consommateurs d'API un préavis de la migration et une fenêtre dédiée pour tester contre le nouveau gateway.

**Comment notifier :**
- Envoyer un email 2 semaines avant le début du canary
- Publier une entrée de changelog avec le planning de migration
- Mettre à jour le portail développeur avec une bannière de notification
- Fournir des credentials de test ou un environnement bac à sable

**Vigilance :**
- Consommateurs utilisant des fonctionnalités dépréciées (découvrir pendant la fenêtre de test, pas après la bascule)
- Consommateurs avec des URL codées en dur (rappeler d'utiliser les noms DNS, pas les adresses IP)
- Consommateurs avec du cache agressif (rappeler que les changements de TTL peuvent affecter le comportement)

**Statut :** ☐ Consommateurs notifiés et fenêtre de test fournie
**Notes :** _____________________________________________________

---

### Étape 12 : bascule DNS

**Objectif :** pointer le hostname DNS de production (`api.example.com`) vers le nouveau gateway.

**Comment exécuter :**
```bash
# Étape 1 : baisser le TTL (24-48h avant la bascule)
api.example.com   A   300s   192.0.2.100   # IP ancien gateway
# Changer le TTL à 60s
api.example.com   A   60s   192.0.2.100

# Étape 2 : attendre l'expiration de l'ancien TTL (au moins 300 secondes)

# Étape 3 : mettre à jour l'enregistrement A vers la nouvelle IP
api.example.com   A   60s   192.0.2.200   # IP nouveau gateway

# Étape 4 : vérifier la propagation
dig api.example.com @8.8.8.8
dig api.example.com @1.1.1.1
```

**Vigilance :**
- Cache DNS par les applications consommatrices (les apps Java cachent souvent le DNS indéfiniment — nécessite un redémarrage JVM)
- DNS split-brain (certains résolveurs retournent encore l'ancienne IP après la bascule)
- Incohérence de certificat TLS (le nouveau gateway doit présenter le cert pour `api.example.com`)

**Statut :** ☐ Bascule DNS complétée avec succès
**Notes :** _____________________________________________________

---

## Phase 4 : validation et nettoyage

Le nouveau gateway gère maintenant 100 % du trafic de production. Cette phase assure la stabilité avant le décommissionnement de l'ancien gateway.

### Étape 13 : validation post-migration

**Objectif :** vérifier que toutes les API, consommateurs et intégrations fonctionnent correctement sur le nouveau gateway.

**Checklist de validation :**
- ☐ Toutes les API de l'inventaire Étape 1 retournent des réponses 200/201
- ☐ L'authentification réussit pour toutes les méthodes supportées (OAuth2, clés API, mTLS)
- ☐ Le rate limiting se déclenche correctement (test avec trafic burst)
- ☐ Les requêtes preflight CORS retournent les bons en-têtes
- ☐ Les services upstream reçoivent les requêtes comme attendu
- ☐ Les métriques alimentent Prometheus
- ☐ Les logs alimentent le système de journalisation centralisé
- ☐ Zéro augmentation des erreurs rapportées par les consommateurs

**Statut :** ☐ Validation post-migration complétée, tous les contrôles passés
**Notes :** _____________________________________________________

---

### Étape 14 : stabilisation monitoring (fenêtre d'observation 24h)

**Objectif :** confirmer que le nouveau gateway performe dans les cibles sur une période soutenue, incluant les heures de pic.

**Exemple de rapport d'observation :**
| Métrique | Référence (Ancien Gateway) | Réel (Nouveau Gateway) | Statut |
|--------|----------------------|-------------------|--------|
| Latence P95 | 85ms | 72ms | Amélioré |
| Taux erreur 5xx | 0,02 % | 0,01 % | Amélioré |
| Succès auth | 99,97 % | 99,98 % | Maintenu |
| Débit | 12 000 req/s | 12 500 req/s | Maintenu |

**Vigilance :**
- Dégradation de performance dans le temps (fuite mémoire, croissance du pool de connexions)
- Patterns de trafic journaliers ou hebdomadaires absents pendant le canary (ex. pic du lundi matin)
- Changements de dépendances externes (déploiements de services upstream, variations de performance base de données)

**Statut :** ☐ Observation 24h complète, validation des parties prenantes obtenue
**Notes :** _____________________________________________________

---

### Étape 15 : décommissionner l'ancien gateway

**Objectif :** retirer le gateway legacy de la production en toute sécurité, en préservant la configuration pour audit et rollback.

**Comment décommissionner :**
```bash
# Étape 1 : archiver la configuration
kubectl get deployment legacy-gateway -n gateway-system -o yaml > legacy-gateway-backup.yaml

# Étape 2 : réduire à zéro réplicas (garder les ressources, juste stopper les pods)
kubectl scale deployment legacy-gateway -n gateway-system --replicas=0

# Étape 3 : attendre 2 semaines (période de veille froide)

# Étape 4 : supprimer les ressources
kubectl delete deployment legacy-gateway -n gateway-system
kubectl delete service legacy-gateway -n gateway-system

# Étape 5 : restaurer le TTL DNS normal
api.example.com   A   3600s   192.0.2.200
```

**Ce qu'il faut conserver :**
- Sauvegardes de configuration (YAML, JSON, config déclarative)
- Scripts de migration et runbooks (pour futures migrations ou rollbacks)
- Métriques de performance de référence (pour comparaison future)
- Documentation des leçons apprises (ce qui a bien fonctionné, ce qui n'a pas fonctionné)

**Statut :** ☐ Ancien gateway décommissionné, ressources récupérées
**Notes :** _____________________________________________________

---

## Checklist imprimable

| Étape | Phase | Tâche | Statut | Notes |
|------|-------|------|--------|-------|
| 1 | Découverte | Inventaire complet des API | ☐ | |
| 2 | Découverte | Inventaire des politiques | ☐ | |
| 3 | Découverte | Cartographie des intégrations | ☐ | |
| 4 | Découverte | Définition des critères de succès | ☐ | |
| 5 | Mise en place | Déployer nouveau gateway (mode shadow) | ☐ | |
| 6 | Mise en place | Importer les configurations API | ☐ | |
| 7 | Mise en place | Répliquer les politiques de sécurité | ☐ | |
| 8 | Mise en place | Tests de trafic synthétique | ☐ | |
| 9 | Migration | Routage canary (1 % → 100 %) | ☐ | Actuellement : ___% |
| 10 | Migration | Monitoring taux d'erreur et latence | ☐ | |
| 11 | Migration | Notification des consommateurs | ☐ | |
| 12 | Migration | Bascule DNS | ☐ | |
| 13 | Validation | Validation post-migration | ☐ | |
| 14 | Validation | Fenêtre d'observation 24h | ☐ | |
| 15 | Nettoyage | Décommissionnement ancien gateway | ☐ | |

---

## Guides de migration spécifiques par plateforme

Cette checklist est agnostique au fournisseur, mais chaque plateforme legacy a ses défis de migration propres :

- [Migration webMethods](/blog/webmethods-migration-guide) — Software AG Integration Server, médiation Flow, patterns ESB
- [Migration Kong](/docs/guides/migration/kong) — Kong OSS/Enterprise, export config déclarative, translation de plugins
- [Migration Apigee](/blog/apigee-alternative-open-source) — Google Apigee, bundles proxy, politiques JavaScript
- [Migration DataPower & TIBCO](/blog/datapower-tibco-migration-guide) — IBM DataPower, TIBCO Gateway, bridging SOAP-vers-REST
- [Migration Oracle OAM](/docs/guides/migration/oracle-oam) — Oracle Access Manager, remplacement WebGate, fédération d'identité
- [Migration MuleSoft](/blog/mulesoft-migration-open-source-gateway) — MuleSoft Anypoint, transformations DataWeave, découplage Salesforce
- [Migration Axway](/blog/axway-api-gateway-migration-open-source) — Axway API Gateway, export Policy Studio
- [Migration WSO2](/blog/wso2-api-manager-open-source-alternative) — WSO2 API Manager, migration médiation Synapse

Pour une vue stratégique sur pourquoi les organisations migrent et comment choisir une plateforme cible, voir le [Guide de migration API Gateway 2026](/blog/api-gateway-migration-guide-2026).

---

## Questions fréquentes

### Combien de temps chaque palier canary doit-il durer avant d'augmenter le trafic ?

La durée de stabilisation dépend du volume de trafic et de la criticité des API. Pour les API à fort trafic (&gt;1000 req/s), 30 minutes à 1 % suffisent pour détecter les problèmes. Pour les API à trafic moyen (100-1000 req/s), attendre 2-4 heures. Pour les API à faible trafic (&lt;100 req/s), 24 heures peuvent être nécessaires pour accumuler assez de données. Toujours inclure au moins une période de pic de trafic (ex. heures ouvrées) avant de passer à 100 %.

### Que faire si le nouveau gateway performe moins bien que l'ancien ?

D'abord, vérifier que ce n'est pas un problème de configuration : tailles de pools de connexions, timeouts, configuration keepalive. Ensuite, exécuter le test de charge de l'Étape 8 en isolation pour éliminer les effets de voisinage. Si la performance est fondamentalement inférieure, envisager : (a) scale up du nouveau gateway, (b) report des fonctionnalités non-critiques vers les services upstream, ou (c) réévaluation du choix de plateforme cible. Le [pattern adaptateur multi-gateway](/docs/guides/multi-gateway-setup) de STOA permet de router différentes API vers différents gateways selon les profils de performance.

### Peut-on sauter le mode shadow et aller directement au canary ?

Techniquement oui, mais c'est risqué. Le mode shadow (Étape 5) valide que le nouveau gateway gère les patterns de trafic de production sans impacter les consommateurs. Il détecte les mauvaises configurations avant qu'elles ne causent de vraies pannes. Ne sauter que si : (a) le nouveau gateway est très similaire à l'ancien (ex. Kong OSS → Kong Enterprise), et (b) vous avez une couverture de tests synthétiques extensive. Même dans ce cas, exécuter au moins 24h de trafic shadow avant le canary.

---

## Et après ?

Une fois la migration d'API gateway terminée, envisagez ces améliorations :

1. **Gestion de configuration GitOps** — Stocker toute la config gateway dans Git, utiliser ArgoCD ou Flux pour la réconciliation continue. Voir [GitOps en 10 minutes](/blog/gitops-in-10-minutes).

2. **Orchestration multi-gateway** — Opérer plusieurs gateways côte à côte, router les API vers le gateway le plus adapté. Voir le [Guide multi-gateway](/docs/guides/multi-gateway-setup).

3. **Support agents IA** — Activer le protocole MCP pour vos API afin que les agents IA les découvrent et les appellent automatiquement. Voir le [Guide de démarrage](/docs/guides/quickstart).

4. **Benchmarking de performance** — Comparer votre nouveau gateway aux alternatives via le [benchmark Gateway Arena](/blog/stoa-gateway-performance-benchmarks).

5. **Déploiement hybride** — Opérer des gateways dans plusieurs clouds ou on-premises pour la souveraineté et la redondance. Voir le [Guide de déploiement hybride](/docs/deployment/hybrid).

---

> Ce guide décrit des étapes techniques de migration et n'implique aucune déficience de la plateforme source. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques appartiennent à leurs propriétaires respectifs.

> STOA Platform fournit des capacités techniques qui supportent les efforts de conformité réglementaire. Ceci ne constitue pas un avis juridique ni une garantie de conformité. Les organisations doivent consulter des conseillers juridiques qualifiés pour les exigences de conformité.
