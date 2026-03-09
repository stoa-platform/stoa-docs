---
title: Sécurité & Conformité
description: Comment la Plateforme STOA répond aux exigences de sécurité enterprise et à la conformité réglementaire (DORA, NIS2, RGPD)
sidebar_position: 2
keywords: [security, compliance, DORA, NIS2, RGPD, GDPR, enterprise, regulation]
---

# Sécurité & Conformité

La Plateforme STOA est conçue avec les **exigences de sécurité des entreprises européennes** au cœur de son architecture. Cette page explique comment STOA aide les organisations à respecter leurs obligations réglementaires tout en maintenant l'efficacité opérationnelle.

## Conformité Réglementaire

### DORA (Digital Operational Resilience Act)

Le Digital Operational Resilience Act impose aux entités financières de renforcer la gestion des risques liés aux TIC. STOA répond aux principales exigences DORA :

| Exigence DORA | Comment STOA Aide |
|---------------|-------------------|
| **Gestion des risques TIC** | Control Plane centralisé avec piste d'audit complète de toutes les opérations API |
| **Notification des incidents** | Alertes en temps réel via Grafana + logs structurés dans OpenSearch pour la reconstruction des incidents |
| **Tests de résilience opérationnelle** | Contrôles de santé et circuit breakers intégrés |
| **Risques liés aux tiers** | Gouvernance des abonnements API avec workflows d'approbation et surveillance de l'utilisation |

**Flux de Conformité DORA :**

```mermaid
sequenceDiagram
    participant C as 👤 Consommateur
    participant GW as ⚡ Gateway
    participant KC as 🔐 Keycloak
    participant CP as ⚙️ Control Plane
    participant LOG as 📋 Journal d'Audit

    C->>GW: Requête API (JWT)
    GW->>KC: Valider le Token
    KC-->>GW: ✓ Valide + RBAC
    GW->>LOG: Log : QUI, QUOI, QUAND
    GW->>CP: Traiter la Requête
    CP->>LOG: Log : Événement Métier
    CP-->>GW: Réponse
    GW->>LOG: Log : Résultat + Trace ID
    GW-->>C: Réponse

    Note over LOG: 📋 Conformité DORA<br/>• Piste d'audit complète<br/>• Notification d'incident 24h<br/>• Précision à la microseconde
```

:::info Avertissement de Conformité
STOA fournit des outils et fonctionnalités pour soutenir vos démarches de conformité. La certification, l'audit et la responsabilité finale de conformité incombent à l'organisation implémentant la solution. Consultez des conseillers qualifiés pour vos exigences réglementaires spécifiques.
:::

### NIS2 (Directive sur la Sécurité des Réseaux et des Systèmes d'Information)

NIS2 étend les exigences de cybersécurité à travers les secteurs essentiels. STOA soutient la conformité grâce à :

- **Sécurité de la Chaîne d'Approvisionnement** — Traçabilité complète des dépendances API et des intégrations tierces
- **Souveraineté** — Option de Control Plane hébergé en Europe avec contrôles de résidence des données
- **Gestion des Incidents** — Alertes automatisées et journaux d'audit répondant aux exigences de notification en 24 heures
- **Contrôle d'Accès** — Contrôle d'accès basé sur les rôles avec intégration Keycloak et isolation multi-tenant

:::info Avertissement de Conformité
STOA fournit des outils et fonctionnalités pour soutenir vos démarches de conformité NIS2. La certification et la responsabilité d'audit incombent à l'organisation implémentant la solution.
:::

### RGPD (Règlement Général sur la Protection des Données)

STOA implémente les principes de privacy by design :

| Capacité | Implémentation |
|----------|----------------|
| **Minimisation des Données** | Anonymisation configurable des logs — masquage des données personnelles dans les logs de requêtes/réponses |
| **Résidence des Données** | Options de déploiement : Control Plane Cloud EU ou Entièrement Sur Site |
| **Droit d'Accès** | Journaux d'utilisation API par consommateur avec capacités d'export |
| **Portabilité des Données** | Contrats OpenAPI standards, sans verrouillage propriétaire |

:::info Avertissement de Conformité
STOA fournit des fonctionnalités de privacy by design pour soutenir la conformité RGPD. La responsabilité de la protection des données incombe au responsable du traitement.
:::

## Architecture de Résidence des Données

Comprendre où circulent les données est essentiel pour la conformité. L'architecture hybride de STOA fournit des périmètres clairs :

```mermaid
flowchart TB
    subgraph Cloud["☁️ CLOUD (Région UE)"]
        Portal["📱 Portail<br/>(Catalogue)"]
        CP["⚙️ Control<br/>Plane"]
        KC["🔐 Keycloak<br/>(fédéré)"]

        CD["📄 Données : métadonnées API,<br/>abonnements, métriques"]
    end

    subgraph OnPrem["🏢 SUR SITE"]
        OAM["Oracle<br/>OAM/OIM"]
        WM["Gateway<br/>webMethods"]
        API["APIs<br/>Backend"]

        OD["🔒 Données : identités utilisateurs,<br/>payloads, identifiants"]
    end

    Cloud <-->|"HTTPS/mTLS<br/>(sortant uniquement)"| OnPrem

    style Cloud fill:#dbeafe,stroke:#3b82f6
    style OnPrem fill:#d1fae5,stroke:#10b981
    style CD fill:#eff6ff,stroke:#3b82f6,stroke-dasharray: 5 5
    style OD fill:#f0fdf4,stroke:#10b981,stroke-dasharray: 5 5
```

### Ce Qui Reste Sur Site

- **Données Métier** — Tous les payloads de requêtes/réponses API contenant des informations métier
- **Identités Utilisateurs** — Oracle OAM/OIM reste le fournisseur d'identité maître
- **Identifiants** — Secrets, certificats et configuration sensible
- **Logs Bruts** — Journaux de transactions détaillés (seules les métriques agrégées sont envoyées vers le cloud)

### Ce Qui Va dans le Cloud

- **Métadonnées API** — Informations du catalogue, spécifications OpenAPI
- **Métriques Agrégées** — Compteurs de requêtes, percentiles de latence, taux d'erreur
- **Données d'Abonnement** — Qui a accès à quelles APIs
- **Tokens Fédérés** — Tokens de courte durée via la fédération Keycloak (pas des identifiants)

## Architecture de Sécurité

### Authentification & Autorisation

```mermaid
sequenceDiagram
    participant C as 👤 Consommateur
    participant KC as 🔐 Keycloak<br/>(Fédéré)
    participant OAM as 🏢 Oracle OAM<br/>(Maître)
    participant GW as ⚡ Gateway<br/>webMethods

    C->>KC: 1. S'authentifier
    KC->>OAM: 2. Fédérer l'identité
    OAM-->>KC: 3. Utilisateur validé
    KC-->>C: 4. Token JWT
    C->>GW: 5. Requête API + JWT
    KC->>GW: 6. Échange de Token (RFC 8693)
    GW-->>C: 7. Réponse API

    Note over KC,OAM: Fédération OIDC<br/>Aucune migration requise
```

- **Fédération OIDC** — Keycloak se fédère avec Oracle OAM existant, aucune migration requise
- **Échange de Token** — Échange de token conforme RFC 8693 pour les appels service-à-service
- **mTLS** — Mutual TLS entre les composants Control Plane et Gateway
- **RBAC** — Contrôle d'accès basé sur les rôles avec isolation par tenant

### Gestion des Secrets

STOA s'intègre avec **HashiCorp Vault** pour la gestion des secrets :

- Génération de secrets dynamiques pour les identifiants de bases de données
- Rotation automatique des identifiants
- Journalisation d'audit de tous les accès aux secrets
- Intégration native Kubernetes via le driver CSI

### Sécurité Réseau

| Couche | Protection |
|--------|------------|
| **Périphérie** | Intégration WAF, protection DDoS via Cloudflare |
| **Transport** | TLS 1.3, mTLS pour la communication interne |
| **Application** | Validation des entrées, rate limiting, circuit breakers |
| **Données** | Chiffrement au repos (AES-256), chiffrement au niveau des champs pour les données personnelles |

### Architecture des Zones de Confiance

STOA implémente une architecture Zero Trust avec des zones de sécurité clairement définies :

```mermaid
flowchart LR
    subgraph External["🔴 EXTERNE<br/>(Non Fiable)"]
        CL["Clients"]
        ATK["Attaquants"]
    end

    subgraph DMZ["🟡 DMZ"]
        ING["Nginx<br/>Ingress"]
        GW["API<br/>Gateway"]
        MCP["MCP<br/>Gateway"]
    end

    subgraph Internal["🟢 INTERNE<br/>(Fiable)"]
        CP["Control<br/>Plane"]
        KC["Keycloak"]
        DB["PostgreSQL"]
        KF["Kafka<br/>🔒 Interne Uniquement"]
    end

    CL --> ING
    ATK -.->|"❌ BLOQUÉ"| KF
    ING --> GW & MCP
    GW & MCP --> CP
    CP --> KC & DB & KF

    style External fill:#fee2e2,stroke:#ef4444
    style DMZ fill:#fef3c7,stroke:#f59e0b
    style Internal fill:#d1fae5,stroke:#10b981
```

**Définitions des Zones :**
- **Externe (Rouge)** — Trafic internet non fiable, attaquants potentiels
- **DMZ (Ambre)** — Zone semi-fiable avec contrôleurs d'entrée et gateways
- **Interne (Vert)** — Zone fiable avec services core, bases de données et files de messages

## Audit & Observabilité

### Piste d'Audit

Chaque action dans STOA est enregistrée avec :

- **Qui** — Identité utilisateur, tenant, rôle
- **Quoi** — Type d'action, ressources affectées
- **Quand** — Horodatage avec précision à la microseconde
- **Où** — IP source, localisation géographique
- **Résultat** — Succès/échec, détails des erreurs

### Rétention des Logs

| Type de Log | Rétention par Défaut | Configurable |
|-------------|---------------------|--------------|
| Logs d'Accès | 90 jours | Oui |
| Logs d'Audit | 1 an | Oui |
| Métriques | 13 mois | Oui |
| Événements de Sécurité | 2 ans | Oui |

### Rapports de Conformité

Tableaux de bord intégrés pour :

- Utilisation des APIs par consommateur/équipe
- Échecs d'authentification et anomalies
- Patterns d'accès aux données
- Métriques de conformité SLA

## Certifications de Sécurité (Feuille de Route)

| Certification | Statut | Cible |
|---------------|--------|-------|
| SOC 2 Type II | Planifié | T4 2026 |
| ISO 27001 | Planifié | 2027 |
| ISAE 3402 | Planifié | 2027 |

---

## Étapes Suivantes

- [Options de Déploiement Hybride](/docs/deployment/hybrid) — Choisissez votre modèle de déploiement
- [Cas d'Usage Enterprise](/docs/enterprise/use-cases) — Implémentations spécifiques par secteur
- [Guides de Migration](/docs/guides/migration) — Migrer depuis des plateformes legacy
