---
sidebar_position: 5
title: Google Apigee
description: "Migrez de Google Apigee vers STOA Platform — guide étape par étape pour la conversion des proxies API, la traduction des politiques et la souveraineté des données européenne."
keywords: [migration, Apigee, Google Cloud, STOA, API gateway, alternative, Apigee migration, API proxy, data sovereignty]
---

# Migration depuis Google Apigee

Ce guide couvre la migration depuis Google Apigee (X ou hybrid) vers STOA Platform, avec un focus sur la souveraineté des données européenne et la flexibilité multi-cloud.

## Ce que Vous Avez

Stack Apigee typique :

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL                                  │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Apigee (X ou Hybrid)                     │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ Policies │  │ Analytics│           │     │
│   │  │ Proxies  │  │ & Flows  │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Apigee Management Plane                  │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Developer│  │ API      │  │ Monetize │           │     │
│   │  │ Portal   │  │ Products │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Motivations courantes de migration :                           │
│  • Souveraineté des données européenne (RGPD, DORA, NIS2)     │
│  • Stratégie multi-cloud (éviter la dépendance mono-cloud)    │
│  • Contrôle auto-hébergé de l'infrastructure gateway          │
│  • Support MCP AI-native pour les workflows d'agents          │
└─────────────────────────────────────────────────────────────────┘
```

## Ce que STOA Apporte

```
┌─────────────────────────────────────────────────────────────────┐
│                    AVEC STOA                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STOA Control Plane (auto-hébergé)           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Portal   │  │ Console  │  │ Grafana  │              │   │
│  │  │ Catalog  │  │ Admin    │  │ Metrics  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestre                                 │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           STOA Gateway (Rust, hébergé EU)                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ MCP      │  │ REST     │  │ mTLS     │              │   │
│  │  │ Protocol │  │ Proxy    │  │ + OIDC   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Avantages :                                                    │
│  • Contrôle total sur l'infrastructure et la résidence des données │
│  • Support MCP natif pour les agents IA                        │
│  • Open-source (Apache 2.0) — pas de vendor lock-in           │
│  • Déploiement Kubernetes-native                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Correspondance de Configuration

Les concepts Apigee correspondent à STOA comme suit :

| Concept Apigee | Équivalent STOA | Notes |
|----------------|-----------------|-------|
| API Proxy | Définition API + Routes | Basé sur OpenAPI |
| Target Endpoint | URL Backend | Configuration upstream |
| ProxyEndpoint | Route API | Correspondance chemin + méthode |
| API Product | Groupe API | Regroupement pour l'abonnement |
| Developer App | Abonnement Consommateur | Gestion des accès |
| Environment | Tenant / Namespace | Isolation au niveau K8s |
| Organization | Instance Plateforme | Scope multi-tenant |
| Key Value Map | ConfigMap / Vault | Config spécifique à l'environnement |
| Custom Report | Tableau de Bord Grafana | Alimenté par Prometheus |

### Traduction des Politiques

| Politique Apigee | Équivalent STOA |
|------------------|-----------------|
| `VerifyAPIKey` | Validation de clé API (Keycloak) |
| `OAuthV2` | OIDC/OAuth 2.0 (Keycloak) |
| `SpikeArrest` | Limitation de débit (par consommateur) |
| `Quota` | Gestion des quotas (par abonnement) |
| `AssignMessage` | Transformation des réponses |
| `RaiseFault` | Politique d'erreur |
| `XMLToJSON` / `JSONToXML` | Transformation du type de média |
| `ServiceCallout` | Chaîne de proxy upstream |
| `JavaScript` | Politique personnalisée (Lua ou WASM prévu) |
| `StatisticsCollector` | Métriques Prometheus (natif) |
| `MessageLogging` | OpenSearch / logs structurés |

---

## Chemin de Migration

### Phase 1 : Inventaire et Export des APIs (1-2 semaines)

**Objectif :** Cataloguer tous les proxies Apigee et exporter les configurations.

1. **Exporter les Proxies API**
   ```bash
   # Lister tous les proxies dans une organisation
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apis" \
     | jq '.proxies[].name'

   # Exporter chaque bundle de proxy
   for proxy in $(curl -s -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apis" \
     | jq -r '.proxies[].name'); do
     curl -H "Authorization: Bearer $TOKEN" \
       "https://apigee.googleapis.com/v1/organizations/$ORG/apis/$proxy/revisions/latest?format=bundle" \
       -o "${proxy}.zip"
   done
   ```

2. **Exporter les Produits API et Applications**
   ```bash
   # Produits
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apiproducts" \
     -o apigee-products.json

   # Applications développeur
   curl -H "Authorization: Bearer $TOKEN" \
     "https://apigee.googleapis.com/v1/organizations/$ORG/apps" \
     -o apigee-apps.json
   ```

3. **Importer dans STOA**
   ```bash
   stoa api import --file proxies/ --format apigee
   ```

### Phase 2 : Fédération des Identités (1 semaine)

**Objectif :** Fédérer les identités des développeurs Apigee vers Keycloak.

```yaml
# keycloak-apigee-federation.yaml
kind: IdentityProviderConfig
metadata:
  name: apigee-developer-federation
spec:
  provider: oidc
  config:
    # Si vous utilisez Google Identity
    issuerUri: https://accounts.google.com
    clientId: stoa-federation
    scopes: openid,email,profile

  # Import en masse des développeurs Apigee
  developerImport:
    source: apigee-developers.json
    mapping:
      email: email
      firstName: firstName
      lastName: lastName
```

### Phase 3 : Exécution en Parallèle (2-3 semaines)

**Objectif :** Faire tourner STOA aux côtés d'Apigee avec une migration progressive du trafic.

Pour les déploiements Apigee hybrid, les deux peuvent coexister dans le même cluster Kubernetes :

1. **Mode shadow** — STOA reçoit le trafic mis en miroir (lecture seule)
2. **Canary** — 5% du trafic via STOA
3. **Progressif** — Augmenter à 25%, 50%, 75%, 100%
4. **Bascule** — Trafic production complet

### Phase 4 : Décommission (1 semaine)

1. Confirmer 100% du trafic via STOA pendant 48h+
2. Supprimer les déploiements de proxies Apigee
3. Archiver la configuration Apigee dans Git (pour référence)
4. Mettre à jour le DNS si applicable

---

## Pourquoi Migrer depuis Apigee ?

### Souveraineté des Données

STOA se déploie entièrement dans votre infrastructure — les clusters Kubernetes hébergés en EU garantissent un contrôle total de la résidence des données. Aucun trafic API ni métadonnée ne quitte la juridiction choisie.

### Flexibilité Multi-Cloud

STOA fonctionne sur n'importe quelle distribution Kubernetes (EKS, GKE, AKS, K3s, bare metal). Évitez la dépendance à la stack de gestion API d'un seul fournisseur cloud.

### Gateway AI-Native

STOA fournit un support MCP (Model Context Protocol) natif, permettant aux agents IA de découvrir et d'appeler vos APIs automatiquement — une capacité non disponible dans les plateformes de gestion API traditionnelles.

### Open Source

Licencié Apache 2.0. Accès complet au code source, pas de frais de licence, pas de tarification à l'appel. Fork, personnalisation ou auto-hébergement libres.

---

## Complexité de Migration

**Complexité estimée :** Moyenne
**Délai estimé :** 4-6 semaines (selon le nombre d'APIs et de politiques personnalisées)

### Facteurs de Complexité

| Facteur | Faible | Moyen | Élevé |
|---------|--------|-------|-------|
| Nombre de proxies | < 20 | 20-100 | > 100 |
| Politiques JavaScript personnalisées | Aucune | 1-5 | > 5 |
| Shared flows | Aucun | 1-3 | > 3 |
| Monetization | Non utilisé | — | Actif |
| Apigee Hybrid | Non utilisé | — | Actif (plus facile) |

---

## Procédure de Rollback

À n'importe quelle phase, revenez au routage Apigee :

```bash
# Revenir à la répartition du trafic
kubectl annotate ingress api-canary \
  nginx.ingress.kubernetes.io/canary-weight="0" --overwrite

# Ou remettre le DNS sur les endpoints Apigee
# (gardez les proxies Apigee déployés jusqu'à validation complète)
```

---

## Critères de Succès

| Métrique | Cible |
|----------|-------|
| Import des APIs | 100% enregistrées dans STOA |
| Fédération des identités | SSO fonctionnel pour tous les développeurs |
| Observabilité | Tableaux de bord Grafana affichant des données équivalentes |
| Migration du trafic | 100% via STOA |
| Latence | Dans les 5ms de la baseline Apigee |

---

## Prochaines Étapes

- [IBM webMethods / DataPower](./ibm-webmethods) — Si vous migrez également depuis la stack IBM
- [Kong OSS / Enterprise](./kong) — Si vous migrez depuis Kong
- [Déploiement Hybride](/docs/deployment/hybrid) — Options d'architecture
- [Sécurité & Conformité](/docs/enterprise/security-compliance) — Considérations DORA/NIS2

---

> Les comparaisons de fonctionnalités sont basées sur la documentation publique disponible en 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque éditeur. Toutes les marques appartiennent à leurs propriétaires respectifs. Voir [marques](/docs/legal/trademarks).

---

*Besoin d'aide pour la migration ? [Contactez-nous](mailto:contact@gostoa.dev) pour des services professionnels.*
