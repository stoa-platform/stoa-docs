---
sidebar_position: 2
title: IBM webMethods / DataPower
description: "Migrez depuis IBM webMethods et DataPower vers STOA Platform avec une approche progressive sans interruption de service."
keywords: [migration, webMethods, DataPower, IBM, Software AG, STOA, API gateway, webMethods migration]
---

# Migration depuis IBM webMethods / DataPower

Ce guide couvre la migration depuis les API gateways Software AG webMethods et IBM DataPower vers STOA Platform.

## Ce que Vous Avez

Stack IBM/Software AG typique :

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL                                  │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              webMethods Integration Server            │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ API      │  │ ESB      │  │  B2B     │           │     │
│   │  │ Gateway  │  │ Mediator │  │ Gateway  │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                              │                                  │
│                  OU           │                                  │
│                              │                                  │
│   ┌──────────────────────────────────────────────────────┐     │
│   │              IBM DataPower Gateway                    │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│   │  │ Multi-   │  │ Security │  │  API     │           │     │
│   │  │ Protocol │  │  Token   │  │ Firewall │           │     │
│   │  └──────────┘  └──────────┘  └──────────┘           │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  Points de douleur :                                            │
│  • Visibilité limitée sur le trafic API                       │
│  • Difficultés de disponibilité d'expertise spécialisée       │
│  • Intégration manuelle des APIs (semaines, pas minutes)      │
│  • Prolifération des configurations entre environnements      │
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
│  │  │ Portal   │  │ Config   │  │ Metrics  │              │   │
│  │  │ Catalog  │  │ API      │  │ Grafana  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                       orchestre                                 │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            webMethods / DataPower (On-Prem)              │   │
│  │                   (inchangé)                             │   │
│  │            Avec observabilité unifiée maintenant         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Avantages :                                                    │
│  • Visibilité en temps réel via tableaux de bord Grafana      │
│  • Intégration API en libre-service (minutes)                 │
│  • Conserver l'investissement gateway existant                │
│  • Chemin de migration progressif                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Chemin de Migration

### Phase 1 : Découverte et Import

**Objectif :** Enregistrer les APIs existantes dans le catalogue STOA

1. **Exporter les Définitions d'APIs**
   ```bash
   # webMethods : Exporter depuis le API Portal
   curl -X GET "https://webmethods-portal/apis/export" \
     -H "Authorization: Bearer $TOKEN" \
     -o webmethods-apis.json

   # DataPower : Exporter depuis l'interface Web GUI ou CLI
   dp-export --domain api-gateway --format openapi
   ```

2. **Importer dans STOA**
   ```bash
   # Utiliser le CLI STOA pour l'import
   stoa api import --file webmethods-apis.json --format webmethods
   stoa api import --file datapower-apis.json --format openapi
   ```

3. **Vérifier le Catalogue**
   - Ouvrir le Portail STOA
   - Confirmer que toutes les APIs apparaissent avec les métadonnées correctes
   - Vérifier les mappings d'endpoints

### Phase 2 : Fédération des Identités

**Objectif :** Connecter STOA à l'infrastructure d'identité existante

Pour webMethods Integration Server :

```yaml
# keycloak-federation.yaml
kind: IdentityProviderConfig
metadata:
  name: webmethods-federation
spec:
  provider: oidc
  config:
    issuerUri: https://webmethods-oauth/oauth
    clientId: stoa-federation
    clientSecret: ${WEBMETHODS_CLIENT_SECRET}
    scopes: openid,profile,api_access
```

Pour DataPower avec LDAP/AD :

```yaml
# keycloak-ldap.yaml
kind: UserFederation
metadata:
  name: corporate-ldap
spec:
  provider: ldap
  config:
    connectionUrl: ldaps://ldap.corp.local:636
    usersDn: ou=users,dc=corp,dc=local
    bindDn: cn=stoa-service,ou=services,dc=corp,dc=local
    bindCredential: ${LDAP_PASSWORD}
```

### Phase 3 : Intégration de l'Observabilité

**Objectif :** Métriques et logging unifiés

1. **Déployer le Prometheus Exporter pour webMethods**
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: webmethods-exporter
   spec:
     template:
       spec:
         containers:
         - name: exporter
           image: stoa/webmethods-exporter:latest
           env:
           - name: WEBMETHODS_URL
             value: "https://webmethods-is:5555"
   ```

2. **Configurer la Source de Données Grafana**
   ```yaml
   datasources:
   - name: webMethods
     type: prometheus
     url: http://webmethods-exporter:9090
     access: proxy
   ```

3. **Importer les Tableaux de Bord STOA**
   - Trafic API webMethods
   - Performance DataPower
   - Comparaison Inter-Plateformes

### Phase 4 : Migration du Trafic

**Objectif :** Déplacer progressivement le trafic via STOA

#### Mode Shadow

STOA reçoit une copie du trafic pour validation :

```yaml
# shadow-routing.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficShadow
metadata:
  name: webmethods-shadow
spec:
  source:
    gateway: webmethods
  target:
    gateway: stoa
  percentage: 100
  mode: readonly  # Aucun impact sur la production
```

#### Déploiement Canary

Commencez avec 5% du trafic :

```yaml
# canary-routing.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficSplit
metadata:
  name: webmethods-canary
spec:
  routes:
  - destination: webmethods
    weight: 95
  - destination: stoa
    weight: 5
```

#### Migration Complète

Quand vous êtes prêt, basculez tout le trafic :

```yaml
# full-migration.yaml
apiVersion: networking.stoa.io/v1
kind: TrafficSplit
metadata:
  name: webmethods-migrated
spec:
  routes:
  - destination: stoa
    weight: 100
```

---

## Considérations Spécifiques webMethods

### Optimisation des Licences

| Licence webMethods | Stratégie STOA |
|--------------------|----------------|
| API Gateway | Remplacer par STOA Gateway (optionnel) |
| Mediator | Conserver pour les transformations complexes |
| Integration Server | Conserver pour les intégrations backend |
| API Portal | Remplacer par STOA Portal |

### Correspondance de Configuration

| Concept webMethods | Équivalent STOA |
|--------------------|-----------------|
| Application | Abonnement |
| API Package | Groupe API |
| Policy | Politique (format STOA) |
| OAuth Scope | Scope Keycloak |
| Transaction Log | Piste d'Audit |

### Migration des Transformations

Les médiations webMethods complexes peuvent être :

1. **Conservées telles quelles** — STOA route vers webMethods pour la transformation
2. **Simplifiées** — Déplacer les transformations simples vers STOA
3. **Modernisées** — Réécrire dans le langage de politiques STOA

---

## Considérations Spécifiques DataPower

### Support Multi-Protocole

La force de DataPower est la gestion multi-protocole :

| Protocole | Support STOA |
|-----------|--------------|
| HTTP/REST | Natif |
| SOAP/XML | Natif |
| MQ/JMS | Via adaptateur |
| FTP | Prévu |

### Security Token Service

Les fonctions DataPower STS mappées vers STOA :

| DataPower STS | Équivalent STOA |
|---------------|-----------------|
| Validation de token | Validation Keycloak |
| Transformation de token | Token Exchange (RFC 8693) |
| Assertions SAML | Broker SAML Keycloak |
| WS-Security | Non supporté (utiliser OIDC) |

---

## Procédure de Rollback

À n'importe quel moment, revenez au routage d'origine :

```bash
# Rollback immédiat
kubectl apply -f original-routing.yaml

# Vérifier
stoa traffic status --gateway webmethods
```

---

## Critères de Succès

| Métrique | Cible |
|----------|-------|
| Import des APIs | 100% enregistrées dans STOA |
| Fédération des identités | SSO fonctionnel |
| Observabilité | Tableaux de bord affichant des données |
| Migration du trafic | ≥95% via STOA |
| Latence | ≤ baseline webMethods + 5ms |

---

## Prochaines Étapes

- [Migration Oracle OAM](./oracle-oam) — Si vous avez également Oracle Identity
- [Déploiement Hybride](/docs/deployment/hybrid) — Options d'architecture
- [Sécurité & Conformité](/docs/enterprise/security-compliance) — Considérations DORA/NIS2

---

*Besoin d'aide pour la migration ? [Contactez-nous](mailto:contact@gostoa.dev) pour des services professionnels.*
