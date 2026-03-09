---
slug: api-gateway-migration-checklist
title: "Checklist de Migration Gateway API : 15 Étapes Sans Interruption"
description: "Ne migrez pas à l'aveugle. 15 étapes éprouvées couvrant l'inventaire des APIs, la traduction des politiques, le basculement du trafic, le rollback et la validation post-migration."
authors: [stoa-team]
tags: [tutorial, migration, api-gateway]
keywords:
  - api gateway migration checklist 2026
  - api gateway migration steps
  - zero downtime api migration
  - api gateway migration planning
  - api gateway replacement guide
---
<!-- last verified: 2026-02 -->

Migrer un gateway API est l'une des modifications d'infrastructure les plus critiques qu'une organisation puisse effectuer. Mal réalisée, elle provoque des interruptions, des intégrations défaillantes et des failles de sécurité. Bien réalisée, elle est invisible pour les consommateurs tout en débloquant de nouvelles capacités.

Cette checklist en 15 étapes garantit zéro interruption et zéro perte de données lors de votre migration de gateway API, que vous partiez de webMethods, Kong, Apigee, DataPower, MuleSoft, Oracle OAM ou toute autre plateforme.

<!-- truncate -->

## Pourquoi une Checklist est Indispensable

Les migrations de gateways API échouent pour des raisons prévisibles :

- **Inventaire incomplet** — Des APIs oubliées qui cessent de fonctionner après la bascule
- **Politiques non testées** — L'authentification fonctionne en staging, échoue en production
- **Surprises pour les consommateurs** — Des endpoints ou patterns d'auth modifiés découverts trop tard
- **Pas de plan de rollback** — Le trafic basculé vers le nouveau gateway sans possibilité de retour en arrière
- **Décommissionnement prématuré** — L'ancien gateway supprimé avant la fin de la période de vérification

Une checklist systématique élimine ces modes d'échec. Utilisez-la comme document vivant : cochez les étapes au fur et à mesure, ajoutez des notes spécifiques à votre environnement et suivez les blocages en temps réel.

---

## La Checklist en 15 Étapes

Cette checklist suppose la **stratégie d'augmentation** : déployer le nouveau gateway aux côtés de l'existant, valider en mode shadow, puis basculer progressivement le trafic. Pour la justification stratégique de cette approche, consultez le [Guide de Migration Gateway API 2026](/blog/api-gateway-migration-guide-2026).

---

## Phase 1 : Découverte & Planification

La fondation d'une migration réussie est de savoir exactement ce que vous avez. Une découverte incomplète représente 60 % des échecs de migration.

### Étape 1 : Créer un Inventaire Complet des APIs

**Objectif :** Documenter chaque API, endpoint, consommateur et pattern de trafic dans votre environnement de production.

**Livrables :**
- Tableau ou base de données avec les colonnes : nom de l'API, chemin de base, protocole (REST/SOAP/GraphQL/gRPC), méthode d'authentification, requêtes/seconde en moyenne, requêtes/seconde au pic, nombre de consommateurs, équipe responsable, classification critique/non-critique
- Pour chaque API : liste des endpoints (chemins + méthodes HTTP)
- Analyse du volume de trafic des 30 derniers jours

**Comment recueillir :**
- Journaux ou tableau de bord analytique du gateway existant (extraire les statistiques de trafic)
- Portail développeur ou catalogue d'APIs (si disponible)
- Analyse du dépôt de code source (`grep -r "api.example.com"`)
- Interviews des équipes applicatives (connaissent souvent des APIs non documentées)

**Surveiller :**
- Les APIs shadow IT (APIs non enregistrées dans le gateway mais appelées directement)
- Les APIs dépréciées avec du trafic résiduel (0,01 % des appels peut être une intégration B2B critique)
- Les APIs du week-end ou de traitement par lots (n'apparaissent pas dans l'analyse du trafic en semaine)

**Statut :** ☐ Inventaire complet créé
**Notes :** _____________________________________________________

---

### Étape 2 : Créer un Inventaire des Politiques

**Objectif :** Documenter chaque politique de sécurité, limitation de débit, transformation et routage appliquée à vos APIs.

**Livrables :**
- Tableau avec les colonnes : nom de l'API, type de politique (auth/rate-limit/CORS/transformation/routage), configuration de la politique, dépendances (systèmes externes, secrets, certificats)
- Détails d'authentification : fournisseur OAuth2, stockage des clés API, autorité de certification mTLS, IdP SAML
- Niveaux de limitation de débit : quotas par consommateur, limites de burst, fenêtres temporelles
- Logique personnalisée : transformations requête/réponse, manipulation des en-têtes, règles de validation

**Comment recueillir :**
- Exporter la configuration du gateway (config déclarative Kong, définitions d'API webMethods, bundles proxy Apigee)
- Pour les formats propriétaires : capturer les écrans de politique et documenter manuellement
- Tester chaque API avec différentes identités de consommateurs pour valider le comportement des politiques

**Surveiller :**
- Les politiques implicites (appliquées au niveau global, non visibles dans la config par API)
- Les politiques chaînées (la politique A dépend du résultat de la politique B)
- Les dépendances externes (la politique appelle un PDP, un service de détection de fraude, un LDAP hérité)

**Statut :** ☐ Inventaire complet des politiques créé
**Notes :** _____________________________________________________

---

### Étape 3 : Cartographier les Points d'Intégration

**Objectif :** Identifier chaque système qui s'intègre à votre gateway API (services amont, aval et sidecar).

**Livrables :**
- Diagramme réseau montrant : applications consommatrices → gateway → services amont
- Enregistrements DNS pour les noms d'hôte du gateway
- Configuration du load balancer (si le gateway est derrière un)
- Détails des certificats (point de terminaison TLS, exigences mTLS)
- Intégrations de monitoring et de journalisation (où les métriques et journaux sont acheminés)
- Intégration du fournisseur d'identité (Keycloak, Okta, Azure AD, LDAP personnalisé)

**Comment recueillir :**
- Consulter les règles de pare-feu (quelles IPs peuvent atteindre le gateway)
- Vérifier les enregistrements DNS (`dig api.example.com`)
- Interviewer les équipes réseau et sécurité
- Examiner la configuration du tableau de bord de monitoring (cibles de scraping Prometheus, règles de transfert des journaux)

**Surveiller :**
- Les adresses IP codées en dur dans les applications consommatrices (cela casse après la migration)
- Les certificats TLS épinglés (consommateurs qui valident l'empreinte du certificat, pas seulement la chaîne)
- La limitation de débit ou le filtrage basés sur l'IP (cassera si l'IP du gateway change)

**Statut :** ☐ Carte d'intégration complète créée
**Notes :** _____________________________________________________

---

### Étape 4 : Définir les Critères de Succès

**Objectif :** Établir des cibles mesurables pour la latence, les taux d'erreur et la continuité d'activité pendant et après la migration.

**Livrables :**
- Métriques de référence du gateway existant (niveaux de performance actuels)
- Métriques cibles pour le nouveau gateway (plages acceptables)
- Déclencheurs de rollback (conditions qui forcent un retour immédiat à l'ancien gateway)
- Exigences de continuité d'activité (interruption maximale acceptable, tolérance à la perte de données)

**Métriques de référence à capturer :**
- Latence P50, P95, P99 (millisecondes)
- Taux d'erreur par code de statut HTTP (4xx vs 5xx)
- Débit (requêtes/seconde soutenu et au pic)
- Time to first byte (TTFB) pour les APIs représentatives
- Taux de succès d'authentification des consommateurs

**Exemples de critères de succès :**
| Métrique | Actuel (Référence) | Cible (Nouveau Gateway) | Déclencheur de Rollback |
|--------|------------------|---------------------|----------------|
| Latence P95 | 85ms | &lt;100ms | &gt;200ms soutenu pendant 5 min |
| Taux d'erreur 5xx | 0,02 % | &lt;0,05 % | &gt;0,2 % soutenu pendant 5 min |
| Taux de succès auth | 99,97 % | &gt;99,95 % | &lt;99,5 % |
| Débit | 12 000 req/s | ≥12 000 req/s | &lt;10 000 req/s |

**Statut :** ☐ Critères de succès définis et approuvés
**Notes :** _____________________________________________________

---

## Phase 2 : Déploiement en Parallèle

Cette phase déploie le nouveau gateway aux côtés de l'existant. Le nouveau gateway ne reçoit pas encore de trafic de production — uniquement du trafic de test synthétique et du trafic shadow (copies de requêtes).

### Étape 5 : Déployer le Gateway Cible en Mode Shadow

**Objectif :** Installer et configurer le nouveau gateway API dans votre environnement de production sans router de trafic réel vers lui.

**Livrables :**
- Nouveau gateway déployé dans le cluster/les VMs de production
- Connectivité réseau vérifiée (peut atteindre les services amont)
- Observabilité configurée (métriques Prometheus, transfert des journaux)
- Réplication du trafic shadow activée (miroir des requêtes de production vers le nouveau gateway, réponses ignorées)

**Comment déployer :**
- Utiliser l'infrastructure-as-code (Terraform, charts Helm, Ansible)
- Déployer dans le même cluster Kubernetes ou la même zone réseau que le gateway existant
- Configurer le DNS pour le nom d'hôte du nouveau gateway (ex. `api-v2.example.com`) sans le publier encore
- Configurer le mirroring : configurer votre load balancer ou service mesh pour dupliquer les requêtes vers le nouveau gateway

**Surveiller :**
- La contention de ressources (nouveau gateway en concurrence pour le CPU/RAM avec le gateway existant)
- Les règles de pare-feu bloquant la communication nouveau gateway → service amont
- Les échecs de validation de certificat (le nouveau gateway présente un certificat TLS différent)

**Vérification :**
```bash
# Vérifier que le nouveau gateway fonctionne
kubectl get pods -n gateway-system -l app=stoa-gateway

# Envoyer du trafic synthétique
curl -H "Authorization: Bearer test-token" https://api-v2.example.com/health

# Vérifier que le trafic shadow est reçu (vérifier les journaux du nouveau gateway)
kubectl logs -n gateway-system deployment/stoa-gateway --tail=100 | grep "GET /api/v1"
```

**Statut :** ☐ Nouveau gateway déployé et recevant le trafic shadow
**Notes :** _____________________________________________________

---

### Étape 6 : Importer les Configurations d'API

**Objectif :** Recréer toutes les APIs de votre gateway existant dans le nouveau gateway, en utilisant une configuration déclarative autant que possible.

**Livrables :**
- Toutes les APIs de l'inventaire de l'étape 1 configurées dans le nouveau gateway
- Définitions OpenAPI/Swagger importées (si supportées)
- Routes, cibles amont et health checks configurés

**Comment importer :**
- **Option 1 (meilleure) :** Exporter les specs OpenAPI du gateway existant, importer dans le nouveau gateway
- **Option 2 :** Utiliser des scripts de migration pour convertir la config propriétaire (ex. YAML déclaratif Kong → UAC STOA)
- **Option 3 :** Recréation manuelle (fastidieux mais assure une configuration propre)

**Conseils par plateforme :**
- [Migration webMethods](/blog/webmethods-migration-guide) — export depuis Integration Server, conversion Flow vers REST
- [Migration Kong](/docs/guides/migration/kong) — `deck dump` pour exporter la config déclarative
- [Migration Apigee](/blog/apigee-alternative-open-source) — export des bundles proxy, traduction des politiques JavaScript
- [Migration DataPower/TIBCO](/blog/datapower-tibco-migration-guide) — export manuel, bridge SOAP-vers-REST

**Surveiller :**
- Les paramètres de chemin ou de requête manquants ou la validation des paramètres
- Les différences de correspondance de chemin sensibles à la casse (Kong vs nginx)
- La gestion du slash final (`/api/users` vs `/api/users/`)

**Vérification :**
```bash
# Lister les APIs dans le nouveau gateway
curl https://api-v2.example.com/v1/apis -H "Authorization: Bearer admin-token"

# Comparer les totaux
echo "Gateway existant : $(wc -l < legacy_api_list.txt) APIs"
echo "Nouveau gateway : $(wc -l < new_api_list.txt) APIs"
```

**Statut :** ☐ Toutes les APIs configurées dans le nouveau gateway
**Notes :** _____________________________________________________

---

### Étape 7 : Répliquer les Politiques de Sécurité

**Objectif :** Appliquer les politiques d'authentification, de limitation de débit, CORS et autres politiques de sécurité de l'inventaire de l'étape 2 au nouveau gateway.

**Livrables :**
- Toutes les politiques de l'inventaire de l'étape 2 configurées dans le nouveau gateway
- Intégration d'authentification testée (OAuth2, clés API, mTLS)
- Niveaux de limitation de débit répliqués (mêmes quotas que le gateway existant)
- Politiques CORS appliquées (mêmes origines et en-têtes autorisés)

**Comment répliquer :**
- Pour les politiques standard (OAuth2, clés API), utiliser les fonctionnalités intégrées du nouveau gateway
- Pour la logique personnalisée (validation de requête, transformation), réimplémenter avec le langage de politique ou les plugins du nouveau gateway
- Connecter le nouveau gateway au même fournisseur d'identité que le gateway existant (Keycloak, Okta, Azure AD)

**Surveiller :**
- Les différences dans l'endpoint de validation des tokens OAuth2 (certains gateways mettent en cache les résultats d'introspection, d'autres non)
- Les différences de clé de limitation de débit (ID consommateur vs adresse IP vs clé API)
- La gestion du preflight CORS (comportement des requêtes OPTIONS)

**Vérification :**
```bash
# Tester l'authentification (doit retourner 401 sans token valide)
curl https://api-v2.example.com/api/v1/protected

# Tester l'authentification (doit retourner 200 avec token valide)
curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/protected

# Tester la limitation de débit (envoyer 100 requêtes rapidement)
for i in {1..100}; do curl -H "Authorization: Bearer $VALID_TOKEN" https://api-v2.example.com/api/v1/test; done

# Vérifier les en-têtes CORS
curl -X OPTIONS -H "Origin: https://app.example.com" https://api-v2.example.com/api/v1/test -i
```

**Statut :** ☐ Toutes les politiques de sécurité répliquées et testées
**Notes :** _____________________________________________________

---

### Étape 8 : Exécuter des Tests de Trafic Synthétique

**Objectif :** Valider le nouveau gateway sous charge réaliste avant de router du trafic de production vers lui.

**Livrables :**
- Suite de tests synthétiques couvrant toutes les APIs de l'inventaire de l'étape 1
- Résultats de test de charge montrant que le nouveau gateway gère le débit attendu
- Rapport de comparaison : performance du nouveau gateway vs gateway existant

**Comment tester :**
- Créer des scripts de test avec des outils comme k6, Locust, JMeter ou des collections Postman
- Rejouer les patterns de trafic de production (taux de requêtes, distribution des endpoints, méthodes d'authentification)
- Exécuter des tests contre les deux gateways simultanément pour comparaison

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
    'statut est 200': (r) => r.status === 200,
    'temps de réponse < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Surveiller :**
- Les fuites mémoire (l'utilisation mémoire croît sous charge soutenue)
- L'épuisement du pool de connexions (le nouveau gateway ne suit pas le taux de connexion)
- L'impact sur les services amont (le comportement de connexion du nouveau gateway diffère de l'existant)

**Critères de vérification :**
- Latence P95 dans la cible définie à l'étape 4
- Taux d'erreur sous le seuil
- Pas d'épuisement des ressources (CPU/RAM/descripteurs de fichiers restent sous 80 %)

**Statut :** ☐ Tests synthétiques réussis, performances dans les cibles
**Notes :** _____________________________________________________

---

## Phase 3 : Migration du Trafic

C'est la phase à haut risque. Vous routez maintenant du trafic de production à travers le nouveau gateway. Commencez petit (1 %), validez soigneusement, puis montez progressivement.

### Étape 9 : Routage Canary (1 % → 10 % → 50 % → 100 %)

**Objectif :** Basculer le trafic de production vers le nouveau gateway de façon incrémentale, en validant à chaque étape.

**Livrables :**
- Règle de routage du trafic configurée (DNS, load balancer ou service mesh)
- Plan de progression canary avec temps de stabilisation et critères de validation
- Tableau de bord de monitoring en temps réel montrant les métriques ancien vs nouveau gateway

**Comment router :**
- **Option 1 (routage DNS pondéré) :** Créer deux enregistrements A DNS avec différentes pondérations (99 % vers l'ancienne IP, 1 % vers la nouvelle). Pas tous les fournisseurs DNS supportent les pondérations ; les clients peuvent aggressivement mettre en cache.
- **Option 2 (split au load balancer) :** Configurer votre load balancer pour router X % vers l'ancien gateway, (100-X) % vers le nouveau. Meilleure option pour un contrôle fin.
- **Option 3 (canary service mesh) :** Utiliser Istio, Linkerd ou Consul pour diviser le trafic au niveau L7. Plus flexible mais nécessite une infrastructure service mesh.
- **Option 4 (orchestration multi-gateway) :** Utiliser l'[adaptateur multi-gateway](/docs/guides/multi-gateway-setup) de STOA pour router le trafic à travers les deux gateways depuis un seul control plane.

**Planning de progression canary :**
| Étape | Trafic % vers Nouveau Gateway | Temps de Stabilisation | Critères de Validation |
|------|------------------------|----------|-------------------|
| 1    | 1 %                    | 30 min   | Taux d'erreur < 0,1 %, latence P95 dans la cible |
| 2    | 5 %                    | 2 heures | Pas d'augmentation des erreurs signalées par les consommateurs |
| 3    | 10 %                   | 4 heures | Validation sous charge soutenue |
| 4    | 25 %                   | 8 heures | Inclure une période de trafic de pointe |
| 5    | 50 %                   | 24 heures | Validation du trafic majoritaire |
| 6    | 75 %                   | 24 heures | L'ancien devient la sauvegarde |
| 7    | 100 %                  | 1 semaine | Bascule complète, ancien en veille |

**Surveiller :**
- Les pics soudains du taux d'erreur à chaque étape canary (rollback immédiat)
- Les problèmes signalés par les consommateurs qui n'apparaissent pas dans les métriques du gateway (vérifier les journaux d'erreurs des applications)
- La dérive de distribution du trafic (vérifier que le % canary correspond au trafic réel observé)

**Procédure de rollback :**
```bash
# Rollback load balancer (exemple avec nginx)
# Changer le poids de l'upstream pour revenir à 100 % ancien gateway
kubectl edit configmap nginx-config -n ingress-nginx
# Définir : old_gateway weight=100, new_gateway weight=0
# Recharger nginx
kubectl rollout restart deployment nginx-ingress-controller -n ingress-nginx
```

**Statut :** ☐ Routage canary en cours (actuellement à ___%)
**Notes :** _____________________________________________________

---

### Étape 10 : Surveiller les Taux d'Erreur et la Latence à Chaque Étape

**Objectif :** Détecter les régressions immédiatement lors du déploiement canary, avant qu'elles n'impactent tous les utilisateurs.

**Livrables :**
- Tableau de bord en temps réel montrant : taux d'erreur (4xx, 5xx), latence P50/P95/P99, débit, taux de succès d'authentification
- Alertes configurées pour : seuil de taux d'erreur dépassé, seuil de latence dépassé, déséquilibre de trafic détecté
- Runbook pour l'ingénieur d'astreinte : quoi vérifier, comment faire un rollback

**Comment surveiller :**
- Utiliser Prometheus + Grafana (recommandé) ou votre stack d'observabilité existante
- Créer un tableau de bord dédié "Statut de Migration" avec comparaison côte à côte (ancien gateway vs nouveau gateway)
- Configurer des alertes qui se déclenchent dans les 60 secondes après détection d'anomalie

**Exemples de requêtes Prometheus :**
```promql
# Taux d'erreur (par gateway)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Latence P95 (par gateway)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Débit (requêtes par seconde)
rate(http_requests_total[1m])
```

**Exemples de règles d'alerte :**
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5..",gateway="new"}[5m]) > 0.01
  for: 2m
  annotations:
    summary: "Taux d'erreur du nouveau gateway dépassé 1 %"

- alert: LatencyRegression
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{gateway="new"}[5m])) > 0.2
  for: 5m
  annotations:
    summary: "Latence P95 du nouveau gateway dépassé 200ms"
```

**Surveiller :**
- La distribution bimodale de latence (certaines requêtes rapides, d'autres très lentes — indique des problèmes de pool de connexions amont)
- Les changements du taux d'erreur 4xx (peut indiquer des différences de politiques d'authentification ou d'autorisation)
- Les erreurs non-HTTP (connexion refusée, échecs de résolution DNS)

**Statut :** ☐ Monitoring configuré et alertes validées
**Notes :** _____________________________________________________

---

### Étape 11 : Notification des Consommateurs et Fenêtre de Test

**Objectif :** Prévenir à l'avance les consommateurs d'API de la migration et leur fournir une fenêtre dédiée pour tester contre le nouveau gateway.

**Livrables :**
- Email ou annonce portail envoyé à tous les consommateurs de l'inventaire de l'étape 1
- Endpoint de test publié (`api-v2.example.com`) pour que les consommateurs valident leurs intégrations
- Canal de support (Slack, système de tickets) pour les signalements de problèmes
- Document FAQ de migration répondant aux questions courantes

**Comment notifier :**
- Envoyer un email 2 semaines avant le début du déploiement canary
- Publier un billet de blog ou une entrée de changelog avec le calendrier de migration
- Mettre à jour le portail développeur avec une bannière de notification
- Fournir des identifiants de test ou un environnement sandbox pour que les consommateurs valident

**Exemple de contenu de notification :**
```
Objet : Action requise : Fenêtre de test de migration du gateway API

Nous mettons à niveau notre infrastructure de gateway API pour améliorer les performances,
la sécurité et le support des agents IA. Cette migration est transparente pour la plupart
des consommateurs, mais nous recommandons de tester votre intégration.

Calendrier :
- 10-17 fév. : Endpoint de test disponible (api-v2.example.com)
- 18 fév. : Début du déploiement canary (1 % → 100 % sur 7 jours)
- 25 fév. : Bascule complète (100 % du trafic sur le nouveau gateway)

Ce que vous devez faire :
1. Tester votre application contre https://api-v2.example.com
2. Signaler tout problème à api-support@example.com

Pas de changement sur :
- Authentification (même fournisseur OAuth2 et mêmes clés API)
- Limites de débit (mêmes quotas et niveaux)
- Schémas de réponse (même structure JSON)

FAQ : https://docs.example.com/migration-faq
```

**Surveiller :**
- Les consommateurs utilisant des fonctionnalités dépréciées (à découvrir lors de la fenêtre de test, pas après la bascule)
- Les consommateurs avec des URLs codées en dur (les inviter à utiliser des noms DNS, pas des adresses IP)
- Les consommateurs avec une mise en cache agressive (les prévenir que les changements de TTL peuvent affecter le comportement)

**Statut :** ☐ Consommateurs notifiés et fenêtre de test fournie
**Notes :** _____________________________________________________

---

### Étape 12 : Bascule DNS

**Objectif :** Faire pointer le nom d'hôte DNS de production (`api.example.com`) vers le nouveau gateway.

**Livrables :**
- TTL DNS réduit à 60 secondes (au moins 24 heures avant la bascule)
- Enregistrement A DNS mis à jour vers l'adresse IP du nouveau gateway
- Vérification que tous les résolveurs DNS globaux propagent en moins de 5 minutes

**Comment exécuter :**
```bash
# Étape 1 : Réduire le TTL (faire cela 24-48 heures avant la bascule)
# Dans votre fournisseur DNS (Cloudflare, Route 53, etc.)
api.example.com   A   300s   192.0.2.100   # Ancienne IP gateway

# Changer le TTL à 60s
api.example.com   A   60s   192.0.2.100

# Étape 2 : Attendre l'expiration de l'ancien TTL (au moins 300 secondes)

# Étape 3 : Mettre à jour l'enregistrement A vers la nouvelle IP gateway
api.example.com   A   60s   192.0.2.200   # Nouvelle IP gateway

# Étape 4 : Vérifier la propagation
dig api.example.com @8.8.8.8
dig api.example.com @1.1.1.1
```

**Surveiller :**
- La mise en cache DNS par les applications consommatrices (les apps Java mettent souvent le DNS en cache indéfiniment — nécessite un redémarrage de la JVM)
- Le split-brain DNS (certains résolveurs retournant encore l'ancienne IP après la bascule)
- La non-correspondance de certificat TLS (le nouveau gateway doit présenter un certificat pour `api.example.com`)

**Procédure de rollback :**
```bash
# Mettre à jour l'enregistrement A vers l'ancienne IP gateway
api.example.com   A   60s   192.0.2.100

# Attendre 60 secondes pour la propagation
# Vérifier que le trafic retourne vers l'ancien gateway
```

**Statut :** ☐ Bascule DNS effectuée avec succès
**Notes :** _____________________________________________________

---

## Phase 4 : Validation & Nettoyage

Le nouveau gateway gère maintenant 100 % du trafic de production. Cette phase assure la stabilité avant de décommissionner l'ancien gateway.

### Étape 13 : Validation Post-Migration

**Objectif :** Vérifier que toutes les APIs, les consommateurs et les intégrations fonctionnent correctement sur le nouveau gateway.

**Livrables :**
- Rapport de validation couvrant : toutes les APIs répondent, l'authentification fonctionne, les limites de débit sont appliquées, les politiques CORS sont actives
- Retours des consommateurs collectés (via tickets de support, Slack ou contact direct)
- Analyse des journaux d'erreurs (vérifier les nouveaux patterns d'erreur non vus pendant le canary)

**Comment valider :**
- Exécuter la même suite de tests synthétiques de l'étape 8 contre le nom d'hôte de production
- Vérifier les métriques de succès des consommateurs (journaux d'erreurs des applications, volume de tickets de support)
- Tester manuellement les APIs critiques avec différentes méthodes d'authentification
- Vérifier que les intégrations de monitoring et de journalisation fonctionnent toujours

**Checklist de validation :**
- ☐ Toutes les APIs de l'inventaire de l'étape 1 retournent des réponses 200/201
- ☐ L'authentification réussit pour toutes les méthodes supportées (OAuth2, clés API, mTLS)
- ☐ La limitation de débit se déclenche correctement (test avec trafic en burst)
- ☐ Les requêtes CORS preflight retournent les en-têtes corrects
- ☐ Les services amont reçoivent les requêtes comme attendu
- ☐ Les métriques affluent vers Prometheus
- ☐ Les journaux affluent vers le système de journalisation centralisé
- ☐ Aucune augmentation des erreurs signalées par les consommateurs

**Surveiller :**
- Les problèmes de long tail (cas limites rares qui n'apparaissent qu'après 24-48 heures)
- Les intégrations partenaires B2B (testent souvent moins fréquemment, peuvent ne pas découvrir les problèmes pendant des jours)
- Les traitements par lots (peuvent s'exécuter hebdomadairement ou mensuellement)

**Statut :** ☐ Validation post-migration terminée, toutes les vérifications passées
**Notes :** _____________________________________________________

---

### Étape 14 : Stabilisation du Monitoring (Fenêtre d'Observation de 24 Heures)

**Objectif :** Confirmer que le nouveau gateway performe dans les cibles sur une période soutenue, y compris les heures de pointe.

**Livrables :**
- Rapport de performance de 24 heures comparant le nouveau gateway à la référence de l'étape 4
- Journal des incidents (alertes déclenchées, problèmes découverts, atténuations appliquées)
- Validation des parties prenantes que la migration est considérée comme réussie

**Comment observer :**
- Surveiller le tableau de bord de l'étape 10 en continu pendant 24 heures
- S'assurer que la fenêtre d'observation inclut la période de trafic de pointe (ex. heures ouvrées, traitement de fin de mois)
- Documenter tout écart par rapport à la référence et confirmer qu'il est acceptable

**Exemple de rapport d'observation :**
| Métrique | Référence (Ancien Gateway) | Réel (Nouveau Gateway) | Statut |
|--------|----------------------|-------------------|--------|
| Latence P95 | 85ms | 72ms | ✅ Amélioré |
| Taux d'erreur 5xx | 0,02 % | 0,01 % | ✅ Amélioré |
| Succès auth | 99,97 % | 99,98 % | ✅ Maintenu |
| Débit | 12 000 req/s | 12 500 req/s | ✅ Maintenu |

**Surveiller :**
- La dégradation des performances dans le temps (fuite mémoire, croissance du pool de connexions)
- Les patterns de trafic quotidiens ou hebdomadaires absents pendant le canary (ex. pic du lundi matin)
- Les changements de dépendances externes (déploiements de services amont, variations de performance de base de données)

**Statut :** ☐ Observation de 24 heures terminée, validation des parties prenantes obtenue
**Notes :** _____________________________________________________

---

### Étape 15 : Décommissionner l'Ancien Gateway

**Objectif :** Supprimer de façon sécurisée le gateway existant de la production, en préservant la configuration pour l'audit et le rollback.

**Livrables :**
- Configuration du gateway existant exportée et archivée dans Git
- Pods/VMs du gateway existant arrêtés (pas encore supprimés)
- TTL DNS restauré à la valeur normale (ex. 300s ou 3600s)
- Monitoring et alerting pour l'ancien gateway désactivés
- Documentation mise à jour (runbooks, diagrammes d'architecture)

**Comment décommissionner :**
```bash
# Étape 1 : Archiver la configuration
kubectl get deployment legacy-gateway -n gateway-system -o yaml > legacy-gateway-backup.yaml
# Pour webMethods, DataPower, etc. : exporter depuis la console de gestion

# Étape 2 : Réduire à zéro répliques (garder les ressources, juste arrêter les pods)
kubectl scale deployment legacy-gateway -n gateway-system --replicas=0

# Étape 3 : Attendre 2 semaines (période de veille froide)

# Étape 4 : Supprimer les ressources
kubectl delete deployment legacy-gateway -n gateway-system
kubectl delete service legacy-gateway -n gateway-system

# Étape 5 : Restaurer le TTL DNS normal
# Dans votre fournisseur DNS
api.example.com   A   3600s   192.0.2.200
```

**Surveiller :**
- Les dépendances cachées (certaine intégration obscure pointant encore vers l'ancien gateway)
- Les exigences de conformité (conserver les journaux de l'ancien gateway pendant N mois)
- Le déprovisionnement des licences (annuler les licences commerciales, récupérer les ressources)

**Ce qu'il faut conserver :**
- Sauvegardes de configuration (YAML, JSON, config déclarative)
- Scripts de migration et runbooks (pour de futures migrations ou rollbacks)
- Métriques de performance de référence (pour de futures comparaisons)
- Documentation des leçons apprises (ce qui a bien fonctionné, ce qui n'a pas fonctionné)

**Statut :** ☐ Ancien gateway décommissionné, ressources récupérées
**Notes :** _____________________________________________________

---

## Checklist Imprimable

Utilisez cette version condensée pour le suivi de l'avancement :

| Étape | Phase | Tâche | Statut | Notes |
|------|-------|------|--------|-------|
| 1 | Découverte | Créer l'inventaire complet des APIs | ☐ | |
| 2 | Découverte | Créer l'inventaire des politiques | ☐ | |
| 3 | Découverte | Cartographier les points d'intégration | ☐ | |
| 4 | Découverte | Définir les critères de succès | ☐ | |
| 5 | Setup | Déployer le nouveau gateway (mode shadow) | ☐ | |
| 6 | Setup | Importer les configurations d'API | ☐ | |
| 7 | Setup | Répliquer les politiques de sécurité | ☐ | |
| 8 | Setup | Exécuter les tests de trafic synthétique | ☐ | |
| 9 | Migration | Routage canary (1 % → 100 %) | ☐ | Actuellement : ___% |
| 10 | Migration | Surveiller les taux d'erreur et la latence | ☐ | |
| 11 | Migration | Notification des consommateurs | ☐ | |
| 12 | Migration | Bascule DNS | ☐ | |
| 13 | Validation | Validation post-migration | ☐ | |
| 14 | Validation | Fenêtre d'observation de 24 heures | ☐ | |
| 15 | Nettoyage | Décommissionner l'ancien gateway | ☐ | |

---

## Guides de Migration Spécifiques aux Plateformes

Cette checklist est agnostique aux fournisseurs, mais chaque plateforme existante présente des défis de migration uniques. Pour des conseils détaillés et pratiques :

- [Guide de Migration webMethods](/blog/webmethods-migration-guide) — IBM Integration Server, médiation Flow, patterns ESB
- [Guide de Migration Kong](/docs/guides/migration/kong) — Kong OSS/Enterprise, export de config déclarative, traduction de plugins
- [Guide de Migration Apigee](/blog/apigee-alternative-open-source) — Google Apigee, bundles proxy, politiques JavaScript
- [Guide de Migration DataPower & TIBCO](/blog/datapower-tibco-migration-guide) — IBM DataPower, TIBCO Gateway, bridge SOAP-vers-REST
- [Guide de Migration Oracle OAM](/docs/guides/migration/oracle-oam) — Oracle Access Manager, remplacement WebGate, fédération d'identité
- [Guide de Migration MuleSoft](/blog/mulesoft-migration-open-source-gateway) — MuleSoft Anypoint, transformations DataWeave, découplage Salesforce
- [Guide de Migration Axway](/blog/axway-api-gateway-migration-open-source) — Axway API Gateway, export Policy Studio
- [Guide de Migration WSO2](/blog/wso2-api-manager-open-source-alternative) — WSO2 API Manager, migration de médiation Synapse

Pour un aperçu stratégique des raisons pour lesquelles les organisations migrent et comment choisir une plateforme cible, consultez le [Guide de Migration Gateway API 2026](/blog/api-gateway-migration-guide-2026).

---

## Questions Fréquentes

### Quelle durée de stabilisation prévoir à chaque étape canary avant d'augmenter le trafic ?

Le temps de stabilisation dépend du volume de trafic et de la criticité des APIs. Pour les APIs à fort trafic (>1 000 req/s), 30 minutes à 1 % suffisent pour détecter les problèmes. Pour les APIs à trafic moyen (100-1 000 req/s), attendre 2-4 heures. Pour les APIs à faible trafic (&lt;100 req/s), vous pourriez avoir besoin de 24 heures pour accumuler suffisamment de données. Incluez toujours au moins une période de trafic de pointe (ex. heures ouvrées) avant de passer à 100 %. Le planning canary de l'étape 9 fournit une base conservatrice.

### Que faire si le nouveau gateway performe moins bien que l'ancien ?

Vérifiez d'abord s'il ne s'agit pas d'un problème de configuration : tailles des pools de connexions, paramètres de timeout, configuration du keepalive. Ensuite, exécutez le test de charge de l'étape 8 de façon isolée (sans autre trafic) pour éliminer les effets du voisin bruyant. Enfin, profilez le nouveau gateway sous charge (flamegraphs CPU, allocation mémoire). Si les performances sont fondamentalement moins bonnes, envisagez : (a) mettre à l'échelle le nouveau gateway (plus de pods/VMs), (b) reporter les fonctionnalités non critiques (transformations, politiques complexes) vers les services amont, ou (c) réévaluer le choix de plateforme cible.

### Puis-je passer directement au routage canary sans le mode shadow ?

Techniquement oui, mais c'est risqué. Le mode shadow (étape 5) valide que le nouveau gateway peut gérer les patterns de trafic de production sans impacter les consommateurs. Il détecte les mauvaises configurations (URLs amont incorrectes, politiques manquantes, problèmes de certificat) avant qu'elles ne causent de vraies interruptions. Sauter le mode shadow augmente le rayon d'impact des défaillances lors du canary. Ne l'ignorez que si : (a) le nouveau gateway est très similaire à l'ancien (ex. Kong OSS → Kong Enterprise), et (b) vous avez une couverture de tests synthétiques étendue de l'étape 8. Même dans ce cas, exécutez au moins 24 heures de trafic shadow avant de démarrer le canary.

---

## Et Ensuite ?

Une fois votre migration de gateway API terminée, envisagez ces améliorations :

1. **Gestion de configuration GitOps** — Stocker toute la configuration du gateway dans Git, utiliser ArgoCD ou Flux pour la réconciliation continue. Voir [GitOps en 10 Minutes](/blog/gitops-in-10-minutes).

2. **Orchestration multi-gateway** — Faire fonctionner plusieurs fournisseurs de gateways côte à côte, router les APIs vers le gateway le mieux adapté. Voir le [Guide de Configuration Multi-Gateway](/docs/guides/multi-gateway-setup).

3. **Support des agents IA** — Activer le protocole MCP pour vos APIs afin que les agents IA puissent les découvrir et les appeler automatiquement. Voir le [Guide de Démarrage Rapide](/docs/guides/quickstart).

4. **Benchmarking des performances** — Comparer votre nouveau gateway aux alternatives avec le [benchmark Gateway Arena](/blog/stoa-gateway-performance-benchmarks).

5. **Déploiement hybride** — Exécuter des gateways dans plusieurs clouds ou sur site pour la souveraineté et la redondance. Voir le [Guide de Déploiement Hybride](/docs/deployment/hybrid).

---

> Ce guide décrit les étapes techniques de migration et n'implique aucune défaillance de la plateforme source. Les décisions de migration dépendent des exigences organisationnelles spécifiques. Toutes les marques appartiennent à leurs propriétaires respectifs.

> STOA Platform fournit des capacités techniques qui soutiennent les efforts de conformité réglementaire. Cela ne constitue pas un avis juridique ni une garantie de conformité. Les organisations doivent consulter des juristes qualifiés pour leurs exigences de conformité.
