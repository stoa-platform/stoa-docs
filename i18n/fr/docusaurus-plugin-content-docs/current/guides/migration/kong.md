---
sidebar_position: 4
title: Kong OSS / Enterprise
description: "Migrez depuis Kong Gateway OSS ou Enterprise vers STOA Platform en préservant vos configurations, plugins et routes existants."
keywords: [migration, Kong, Kong Gateway, STOA, API gateway, alternative, Kong migration, Kong OSS, Kong Enterprise, declarative config]
---

# Migration depuis Kong OSS / Enterprise

Ce guide couvre la migration depuis Kong Gateway (OSS ou Enterprise) vers STOA Platform, en exploitant le modèle de configuration déclaratif de Kong pour une transition fluide.

## Ce que Vous Avez

Stack Kong typique :

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL                                  │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Kong Gateway (OSS ou Enterprise)         │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Services │  │ Routes   │  │ Plugins  │           │     │
│   │  │ & Upst.  │  │          │  │          │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              Kong Manager / Konnect (optionnel)       │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Dev      │  │ Analytics│  │ Runtime  │           │     │
│   │  │ Portal   │  │          │  │ Groups   │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Motivations courantes de migration :                           │
│  • Recherche d'un gateway unifié MCP + REST                   │
│  • Exigences de souveraineté des données européenne           │
│  • Isolation multi-tenant au niveau du namespace Kubernetes   │
│  • Gestion de configuration GitOps-first                      │
└─────────────────────────────────────────────────────────────────┘
```

## Ce que STOA Apporte

```
┌─────────────────────────────────────────────────────────────────┐
│                    AVEC STOA                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              STOA Control Plane (Cloud)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Portal   │  │ Console  │  │ API      │              │   │
│  │  │ Catalog  │  │ Admin    │  │ Metrics  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestre                                 │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           STOA Gateway (Rust, haute performance)         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ MCP      │  │ REST     │  │ Rate     │              │   │
│  │  │ Protocol │  │ Proxy    │  │ Limiting │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Avantages :                                                    │
│  • Support MCP natif pour les agents IA                        │
│  • Isolation tenant au niveau namespace                        │
│  • Configuration GitOps-first (ArgoCD)                        │
│  • Hébergement européen avec contrôles de résidence des données │
└─────────────────────────────────────────────────────────────────┘
```

---

## Correspondance de Configuration

Le modèle déclaratif de Kong se mappe naturellement vers les concepts STOA :

| Concept Kong | Équivalent STOA | Notes |
|--------------|-----------------|-------|
| Service | Définition API | Configuration upstream backend |
| Route | Route API | Correspondance chemin + méthode |
| Plugin | Politique STOA | Limitation de débit, auth, transformations |
| Consumer | Consommateur / Abonnement | Gestion des accès API |
| Consumer Group | Tenant | Isolation multi-tenant |
| Upstream | URL Backend | Vérifications de santé incluses |
| Certificate | Certificat TLS | Géré via Keycloak/cert-manager |
| Workspace (Enterprise) | Namespace Tenant | Isolation namespace K8s |

### Correspondance des Plugins

| Plugin Kong | Équivalent STOA |
|-------------|-----------------|
| `rate-limiting` | Limitation de débit native (quotas par consommateur) |
| `key-auth` | Clé API via Keycloak |
| `jwt` | OIDC/JWT via Keycloak |
| `oauth2` | OAuth 2.0 via Keycloak |
| `cors` | Politique CORS |
| `request-transformer` | Transformation des réponses (ADR-032) |
| `acl` | Politiques RBAC |
| `prometheus` | Métriques Prometheus natives |
| `opentelemetry` | Intégration OpenTelemetry |
| `ip-restriction` | Politique réseau (niveau K8s) |

---

## Chemin de Migration

### Phase 1 : Export et Import (1 semaine)

**Objectif :** Enregistrer les APIs Kong existantes dans le catalogue STOA.

1. **Exporter la Configuration Kong**
   ```bash
   # Mode DB-less Kong — déjà déclaratif
   kong config db_export kong-config.yaml

   # Ou via Admin API
   curl -s http://kong-admin:8001/ | jq '.' > kong-dump.json

   # Exporter des services spécifiques
   curl -s http://kong-admin:8001/services | jq '.data[]' > kong-services.json
   ```

2. **Mapper vers le Format STOA**
   ```bash
   # Utiliser le CLI STOA pour importer la config Kong
   stoa api import --file kong-config.yaml --format kong
   ```

3. **Vérifier dans la Console STOA**
   - Confirmer que toutes les APIs apparaissent dans le catalogue
   - Vérifier les correspondances de routes et les URLs upstream
   - Valider les traductions de politiques

### Phase 2 : Intégration des Identités (1 semaine)

**Objectif :** Connecter Keycloak STOA à l'authentification des consommateurs Kong.

Les consommateurs Kong utilisant `key-auth` ou `jwt` peuvent être fédérés :

```yaml
# keycloak-kong-migration.yaml
kind: IdentityProviderConfig
metadata:
  name: kong-consumer-migration
spec:
  provider: oidc
  config:
    # Si Kong utilise un IdP externe
    issuerUri: https://your-idp/oauth
    clientId: stoa-federation
    scopes: openid,profile

  # Pour les consommateurs key-auth : import en masse vers Keycloak
  consumerImport:
    source: kong-consumers.json
    mapping:
      username: custom_id
      groups: acls
```

### Phase 3 : Exécution en Parallèle (1-2 semaines)

**Objectif :** Faire tourner STOA aux côtés de Kong avec du trafic shadow.

Kong et STOA pouvant coexister derrière un load balancer :

```yaml
# répartition du trafic au niveau ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: stoa-gateway
            port:
              number: 8080
```

Augmentez le poids canary de 10% à 50% à 100% au fur et à mesure que la confiance croît.

### Phase 4 : Bascule

**Objectif :** Trafic production complet via STOA.

1. Mettre le poids canary à 100%
2. Surveiller les taux d'erreur et la latence pendant 48 heures
3. Supprimer les règles d'ingress Kong
4. Décommissionner les pods Kong (garder la config dans Git pour rollback)

---

## Complexité de Migration

**Complexité estimée :** Faible à Moyenne
**Délai estimé :** 2-4 semaines

Le modèle de configuration déclaratif de Kong et l'écosystème de plugins standard se mappent bien avec l'approche GitOps de STOA. Les plugins Kong personnalisés nécessitent une évaluation individuelle.

### Facteurs de Complexité

| Facteur | Faible | Moyen | Élevé |
|---------|--------|-------|-------|
| Nombre d'APIs | < 20 | 20-100 | > 100 |
| Plugins personnalisés | Aucun | 1-3 | > 3 |
| Nombre de consommateurs | < 100 | 100-1000 | > 1000 |
| Mode DB-less | Oui | — | Non (nécessite export) |
| Fonctionnalités Enterprise | Non utilisées | Workspaces | Vitals, Dev Portal |

---

## Procédure de Rollback

À n'importe quelle phase, revenez au routage Kong :

```bash
# Rollback immédiat — revenir au canary ingress
kubectl annotate ingress api-canary \
  nginx.ingress.kubernetes.io/canary-weight="0" --overwrite

# Vérifier que Kong gère tout le trafic
curl -s http://kong-admin:8001/status
```

---

## Prochaines Étapes

- [IBM webMethods / DataPower](./ibm-webmethods) — Si vous migrez depuis la stack IBM
- [Google Apigee](./apigee) — Si vous migrez depuis Apigee
- [Déploiement Hybride](/docs/deployment/hybrid) — Options d'architecture
- [Sécurité & Conformité](/docs/enterprise/security-compliance) — Considérations DORA/NIS2

---

> Les comparaisons de fonctionnalités sont basées sur la documentation publique disponible en 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque éditeur. Toutes les marques appartiennent à leurs propriétaires respectifs. Voir [marques](/docs/legal/trademarks).

---

*Besoin d'aide pour la migration ? [Contactez-nous](mailto:contact@gostoa.dev) pour des services professionnels.*
