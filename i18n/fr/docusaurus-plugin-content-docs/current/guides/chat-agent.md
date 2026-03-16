---
sidebar_position: 30
slug: /guides/chat-agent
title: "Agent de Chat Intégré — Flux de Données & Stratégie de Clés API"
description: "Comment l'agent de chat de la Console STOA traite les données, gère les clés API et satisfait les obligations RGPD — architecture, budgets de tokens et cycle de vie des données."
keywords:
  - agent de chat STOA
  - traitement de données IA
  - gestion des clés API
  - conformité RGPD IA
  - budgets de tokens
---

<!-- last verified: 2026-03 -->

# Agent de Chat Intégré — Flux de Données & Stratégie de Clés API

La Console STOA intègre un agent de chat qui aide les opérateurs à gérer leurs APIs en langage naturel. Ce guide explique comment les données transitent dans le système, comment les clés API sont gérées et comment les obligations RGPD sont respectées.

## Flux de Traitement des Données

```
Utilisateur (Console)
  │
  │  1. Message de chat (HTTPS, TLS 1.3)
  ▼
Control Plane API (FastAPI)
  │
  │  2. Vérification d'authentification (token OIDC Keycloak)
  │  3. Isolation du tenant (RBAC + filtre au niveau des lignes)
  │  4. Construction du prompt (contexte système + message utilisateur)
  │  5. Middleware de détection PII (analyse avant envoi)
  │
  │  6. Appel API (HTTPS, ANTHROPIC_API_KEY depuis Vault)
  ▼
Anthropic API (claude-sonnet-4-6)
  │
  │  7. Réponse en streaming
  ▼
Control Plane API
  │
  │  8. Réponse journalisée (sans secrets)
  │  9. Conversation stockée dans PostgreSQL (isolation par tenant)
  │
  │  10. Renvoyée en streaming (SSE)
  ▼
Utilisateur (Console)
```

### Propriétés Clés

- **Isolation par tenant** : chaque conversation est cloisonnée à l'espace du tenant de l'utilisateur authentifié. Aucune fuite de données inter-tenant n'est possible — les requêtes sont filtrées par `tenant_id` au niveau de la couche repository.
- **Absence d'entraînement** : l'utilisation de l'API Anthropic est configurée en rétention zéro par défaut. Les données de chat ne sont pas utilisées pour entraîner des modèles. Voir la [politique de données d'Anthropic](https://www.anthropic.com/policies/privacy).
- **Pré-analyse PII** : le middleware PII de la passerelle analyse les prompts sortants à la recherche de patterns sensibles (e-mails, numéros de téléphone, numéros de carte bancaire) avant qu'ils n'atteignent le fournisseur LLM.

## Stratégie de Clés API

### Clé au Niveau de la Plateforme

STOA utilise une **clé Anthropic unique au niveau de la plateforme**, stockée dans HashiCorp Vault et synchronisée vers Kubernetes via l'External Secrets Operator (ESO).

```
HashiCorp Vault
  └── stoa/k8s/anthropic
        └── ANTHROPIC_API_KEY
              │
              │  Synchronisation ESO (rafraîchissement toutes les 1h)
              ▼
        K8s Secret: anthropic-api-key
              │
              │  envFrom: secretRef
              ▼
        Pod control-plane-api
```

**Pourquoi une clé de plateforme (et non par tenant) ?**

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| Clé de plateforme | Rotation simplifiée, facturation centralisée, contrôle unifié | La plateforme supporte le coût, limites de débit partagées |
| Clé par tenant | Le tenant paye directement, limites de débit isolées | Complexité de gestion des clés, friction à l'onboarding |

STOA utilise la clé de plateforme pour les raisons suivantes :
1. L'agent de chat est une fonctionnalité de la plateforme, non un service fourni par le tenant
2. Les budgets de tokens assurent le contrôle des coûts par tenant (voir ci-dessous)
3. La rotation de la clé est une opération unique dans Vault, et non N opérations par tenant

### Budgets de Tokens par Tenant

Chaque tenant dispose de limites de tokens configurables qui empêchent un tenant unique d'épuiser la clé API partagée :

| Budget | Valeur par défaut | Configurable | Application |
|--------|-------------------|--------------|-------------|
| Limite quotidienne de tokens | 100 000 tokens | Par tenant | L'API retourne 429 si dépassée |
| Limite mensuelle de tokens | 2 000 000 tokens | Par tenant | L'API retourne 429 si dépassée |
| Longueur maximale d'une conversation | 50 messages | Paramètre global | Les messages les plus anciens sont supprimés du contexte |
| Tokens d'entrée maximum par requête | 4 096 tokens | Paramètre global | La requête est rejetée si dépassée |

L'utilisation des tokens est suivie par tenant dans PostgreSQL et exposée dans la Console sous **Paramètres > Utilisation**.

## Conformité RGPD

### Cycle de Vie des Données

```
Message envoyé ──► Stocké dans PostgreSQL (isolation par tenant)
                    │
                    ├── Actif : disponible dans l'historique de conversation
                    │
                    ├── 90 jours : purge automatique (worker en arrière-plan)
                    │
                    └── Suppression du tenant : suppression en cascade (toutes les conversations)
```

### Droit à l'Effacement

| Déclencheur | Périmètre | Mécanisme |
|-------------|-----------|-----------|
| L'utilisateur demande la suppression | Une seule conversation | `DELETE /v1/conversations/{id}` — suppression définitive |
| L'utilisateur demande l'effacement total | Toutes les conversations | `DELETE /v1/users/{id}/conversations` — suppression en cascade |
| Suppression du tenant | Toutes les données du tenant | PostgreSQL `ON DELETE CASCADE` sur la FK `tenant_id` |
| Rétention de 90 jours | Conversations expirées | Worker en arrière-plan (`ConversationPurgeWorker`) |

### Minimisation des Données

- **Les prompts système** ne contiennent pas de secrets, de credentials ni de PII appartenant au tenant
- **Le contexte de conversation** est limité à la session courante (pas de mémoire inter-sessions)
- **Anthropic reçoit** uniquement les messages de la conversation — aucune métadonnée du tenant, aucune identité utilisateur
- **Les journaux** enregistrent les identifiants de conversation et les compteurs de tokens, jamais le contenu des messages

### Piste d'Audit

Chaque interaction de chat est journalisée avec :
- Horodatage, identifiant du tenant, identifiant utilisateur (pseudonymisé)
- Nombre de tokens (entrée + sortie)
- Modèle utilisé, latence
- Aucun contenu de message dans les journaux (stocké séparément dans PostgreSQL avec politique de rétention)

## Considérations de Sécurité

| Couche | Contrôle |
|--------|----------|
| Authentification | Token OIDC Keycloak requis pour chaque requête |
| Autorisation | RBAC : `cpi-admin` et `tenant-admin` peuvent utiliser le chat ; `viewer` en lecture seule |
| Transport | TLS 1.3 de bout en bout (Console → CP API → Anthropic) |
| Stockage des secrets | Clé API dans Vault, synchronisée via ESO, jamais dans des fichiers env ou dans le code |
| Limitation du débit | Budgets de tokens par tenant + middleware de rate limiting global |
| Protection PII | Analyse avant envoi bloquant les patterns sensibles |

## Configuration

L'agent de chat est contrôlé par des variables d'environnement sur le déploiement control-plane-api :

| Variable | Source | Description |
|----------|--------|-------------|
| `ANTHROPIC_API_KEY` | Vault (`k8s/anthropic`) | Clé API pour Anthropic |
| `CHAT_AGENT_ENABLED` | ConfigMap | Activer/désactiver la fonctionnalité de chat (`true`/`false`) |
| `CHAT_AGENT_MODEL` | ConfigMap | Modèle à utiliser (défaut : `claude-sonnet-4-6`) |
| `CHAT_DEFAULT_DAILY_LIMIT` | ConfigMap | Limite quotidienne de tokens par défaut par tenant |
| `CHAT_RETENTION_DAYS` | ConfigMap | Nombre de jours avant purge automatique (défaut : 90) |

## Voir Aussi

- [Guide d'Authentification](/docs/guides/authentication) — configuration OIDC pour la Console
- [Référence des Permissions RBAC](/docs/reference/rbac-permissions) — contrôle d'accès basé sur les rôles
- [Configuration de la Sécurité](/docs/reference/security-configuration) — TLS, mTLS et durcissement de la sécurité
- [Souveraineté des Données & RGPD](/docs/guides/fiches/data-sovereignty-gdpr) — guide complet de conformité RGPD
