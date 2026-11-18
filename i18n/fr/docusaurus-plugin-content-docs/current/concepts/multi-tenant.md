---
sidebar_position: 3
title: "Isolation multi-tenant"
description: "Le modèle de multi-tenancy strict de STOA — cycle de vie des tenants, 5 couches d'isolation, RBAC par scope, quotas de ressources et observabilité par tenant."
keywords: [multi-tenant, isolation, Kubernetes, Keycloak, sécurité, RBAC, tenant]
---

# Isolation multi-tenant

STOA implémente un modèle d'**isolation multi-tenant multicouche** combinant le cloisonnement logique des identités et des données dans le Control Plane et la Gateway ([ADR-074](/docs/architecture/adr/adr-074-tenant-model), [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) avec des frontières optionnelles de namespace Kubernetes et de réseau CNI pour les charges de travail des tenants. Cela permet à un seul déploiement STOA de servir plusieurs organisations sans fuite de données inter-tenant.

## Modèle de données du tenant

Chaque tenant dans STOA possède les propriétés suivantes :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant slug (ex. `oasis`, `acme-corp`) — immuable |
| `name` | string | Nom d'affichage (ex. « OASIS Gunters ») |
| `description` | string | Description optionnelle |
| `status` | enum | `active`, `suspended`, `archived` |
| `settings` | JSON | Quotas, feature flags, configuration personnalisée |
| `created_at` | timestamp | Date de création |

### Cycle de vie du statut du tenant

```mermaid
stateDiagram-v2
    [*] --> active: Créer le tenant
    active --> suspended: Suspendre (facturation, conformité)
    suspended --> active: Réactiver
    active --> archived: Désactiver
    suspended --> archived: Désactiver
    archived --> [*]: Supprimer les données
```

- **Active** — Accès complet à toutes les fonctionnalités de la plateforme
- **Suspended** — Accès en lecture seule, pas d'appels API, pas de déploiements. Utilisé pour les problèmes de facturation ou les blocages de conformité.
- **Archived** — Données conservées pour l'audit, aucun accès. En attente de suppression selon la politique de rétention.

## Cinq couches d'isolation {#five-isolation-layers}

### 1. Isolation par namespace Kubernetes

Dans les déploiements Kubernetes multi-tenant, les opérateurs peuvent placer les charges de travail des tenants et les CRD `Tool` / `ToolSet` dans des namespaces dédiés avec des labels pour l'application des politiques (modèle de référence opérateur ; le chart `charts/stoa-platform`, centré sur la passerelle, ne provisionne pas automatiquement les namespaces tenants) :

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-acme
  labels:
    stoa.io/tenant-id: acme
    stoa.io/tier: enterprise
    pod-security.kubernetes.io/enforce: restricted
```

Les quotas de ressources empêchent un tenant unique de consommer les ressources du cluster :

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota
  namespace: tenant-acme
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    persistentvolumeclaims: "5"
    services.loadbalancers: "2"
```

### 2. Isolation réseau

Les politiques réseau empêchent la communication inter-tenant au niveau du CNI :

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-acme
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            stoa.io/tenant-id: acme
  egress:
    - to:
      - namespaceSelector:
          matchLabels:
            stoa.io/tenant-id: acme
    - to:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: stoa-system
```

Les tenants peuvent communiquer avec leur propre namespace et le namespace partagé `stoa-system` (pour l'API Control Plane et la passerelle), mais jamais avec d'autres tenants.

### 3. Isolation au niveau de la passerelle

La passerelle STOA applique les frontières des tenants aux couches API et MCP :

- **Politiques tenant fail-closed** — Les artefacts de politiques d'outils signés Ed25519 par tenant (`STOA_POLICY_BOOT_TENANTS`, [ADR-070](/docs/architecture/adr/adr-070-gateway-fail-closed-posture)) refusent toute invocation si l'état de politique est absent ou invalide
- **Routage et visibilité filtrés par tenant** — Chaque API et outil MCP (`stoa://tools/{name}`) est rattaché à un `tenant_id` vérifié
- **Limites de débit séparées** — Application des quotas par tenant
- **Politiques indépendantes** — Les politiques OPA évaluent le contexte du tenant

Dans les déploiements multi-passerelles, les 6 adaptateurs du Control Plane ([ADR-035](/docs/architecture/adr/adr-035-gateway-adapter-pattern)) et l'agent sur site `stoa-connect` (STOA Link : Kong, Gravitee, webMethods et Envoy xDS sur option explicite) propagent le périmètre tenant vers chaque passerelle cible.

### 4. Isolation de l'authentification

Conformément à [ADR-074](/docs/architecture/adr/adr-074-tenant-model) (qui remplace l'ancienne ébauche d'un realm par tenant d'ADR-026), STOA utilise un **unique realm Keycloak partagé `stoa`** (`KEYCLOAK_REALM=stoa`) avec appartenance par groupe :

- **Un groupe Keycloak racine par tenant** — Provisionné sous `/<tenant_id>` par `setup_tenant_group` (`TenantProvisioningService`) lors de la création du tenant (`POST /v1/tenants`), tandis que `add_user_to_tenant` renseigne l'attribut utilisateur `tenant_id` projeté dans le JWT
- **Claim JWT `tenant_id` vérifié** — Lu depuis les claims du JWT après vérification de la signature RS256 JWKS et de l'émetteur (`Claims::tenant_id()` / `require_tenant` dans `stoa-gateway`, `get_current_user` dans `control-plane-api`), jamais accepté depuis un en-tête ou paramètre non vérifié
- **Contrôle strict de frontière tenant** — Le RBAC du Control Plane (`require_tenant_access`, ainsi que `RbacEnforcer` côté Rust lorsque le champ de configuration RBAC `enforce_tenant_isolation` est activé) rejette les accès inter-tenant (`403`) hors rôle plateforme `cpi-admin` ; en revanche, MCP `tools/list`, `ext_authz` gRPC Envoy et les routes REST UAC publiées exigent un `tenant_id` vérifié correspondant au tenant/route cible, sans présumer ce bypass `cpi-admin`
- **Courtage multi-IdP** — La fédération d'identités externes est démontrée uniquement dans les realms de démonstration dédiés (profil `federation` de `deploy/docker-compose/`, non attestée dans l'import du realm produit `stoa`) plutôt que via un realm par tenant

### 5. Isolation des données

- **Schéma PostgreSQL partagé filtré par `tenant_id`** — Tous les enregistrements appartenant à un tenant (`apis`, `subscriptions`, `consumers`, `mcp_servers`, journaux d'audit) portent une colonne `tenant_id` indexée filtrée par les requêtes SQLAlchemy (pas de schéma par tenant)
- **Chiffrement des secrets** — Les identifiants sensibles sont stockés via l'API HTTP Vault (OpenBao par défaut, [ADR-075](/docs/architecture/adr/adr-075-secrets-backend-openbao)) ou chiffrés au repos
- **Journalisation d'audit** — Chaque accès Control Plane et Gateway est journalisé avec le contexte `tenant_id` vérifié

## RBAC et scope par tenant {#rbac-and-tenant-scoping}

Le modèle RBAC de STOA combine des rôles à l'échelle de la plateforme et des rôles scopés par tenant :

| Rôle | Scope | Permissions |
|------|-------|-------------|
| `cpi-admin` | **Plateforme (RBAC Control Plane)** | Administration inter-tenant dans l'API Control Plane (et contrôles `RbacEnforcer` Rust) |
| `tenant-admin` | **Tenant** | Accès complet à son propre tenant uniquement |
| `devops` | **Tenant** | Déployer et promouvoir au sein de son propre tenant |
| `viewer` | **Tenant** | Accès en lecture seule à son propre tenant |

Comportements clés :
- Un `tenant-admin` pour le tenant `acme` **ne peut pas** voir les ressources du tenant `globex`
- Un `viewer` peut parcourir les API et outils mais ne peut pas invoquer, créer ou modifier
- Un `cpi-admin` voit tous les tenants et peut effectuer des opérations inter-tenant dans le RBAC du Control Plane (`require_tenant_access`) ; côté plan de données, MCP `tools/list`, `ext_authz` gRPC Envoy et les routes REST UAC exigent toujours un `tenant_id` vérifié correspondant au tenant/route cible
- Le mode d'environnement (dev/staging/prod) restreint davantage les opérations — la production est en lecture seule par défaut

## Paramètres du tenant {#tenant-settings}

Le champ JSON `settings` sur chaque tenant permet une configuration par tenant :

```json
{
  "quotas": {
    "max_apis": 50,
    "max_subscriptions": 200,
    "max_rate_limit": 10000
  },
  "features": {
    "mcp_enabled": true,
    "shadow_mode": false,
    "advanced_analytics": true
  },
  "notifications": {
    "webhook_url": "https://hooks.acme.com/stoa",
    "email_alerts": true
  }
}
```

## Niveaux de tenant {#tenant-tiers}

| Niveau | Ressources | Fonctionnalités | SLA |
|--------|-----------|-----------------|-----|
| **Community** | Limitées | API de base, MCP basique | Best effort |
| **Starter** | Modérées | API + outils MCP, portail | 99% |
| **Business** | Élevées | Plateforme complète, multi-passerelle | Sur accord |
| **Enterprise** | Personnalisées | White-label, support dédié | SLA personnalisé |

## Observabilité par tenant {#per-tenant-observability}

Chaque métrique dans STOA est labellisée avec l'identifiant du tenant, permettant des tableaux de bord par tenant :

- **Taux de requêtes API** — `stoa_api_requests_total{tenant="acme"}`
- **Taux d'erreur** — `stoa_api_errors_total{tenant="acme"}`
- **Percentiles de latence** — `stoa_api_duration_seconds{tenant="acme"}`
- **Utilisation des ressources** — CPU, mémoire, stockage par namespace
- **Attribution des coûts** — Consommation de ressources par tenant pour la facturation

Les tableaux de bord Grafana peuvent être filtrés par tenant pour les tenant-admins, ou visualisés à travers tous les tenants pour les administrateurs plateforme.

## Liens connexes

- [Vue d'ensemble de l'architecture](/docs/concepts/architecture) — Architecture du système
- [Passerelle MCP](/docs/concepts/mcp-gateway) — Concepts de la passerelle
- [Guide des abonnements](/docs/guides/subscriptions) — Gestion des abonnements API
- [ADR-074 : Realm Keycloak unique et groupes par tenant](/docs/architecture/adr/adr-074-tenant-model) — Identité tenant et filtrage PostgreSQL
- [ADR-070 : Posture fail-closed de la passerelle](/docs/architecture/adr/adr-070-gateway-fail-closed-posture) — Application de politiques d'outils signées par tenant
- [ADR-022 : Architecture tenant UAC](/docs/architecture/adr/adr-022-uac-tenant-architecture) — Décision d'architecture
