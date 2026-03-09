---
sidebar_position: 20
title: "Glossaire technique"
description: "Glossaire bilingue des termes clés utilisés dans la documentation STOA — définitions en français avec les termes anglais d'origine."
keywords: [glossaire, terminologie, passerelle API, MCP, UAC, Kubernetes, traduction]
---

# Glossaire technique

Référence bilingue des termes clés utilisés dans la documentation STOA. Chaque entrée fournit le terme français, son équivalent anglais, et une définition concise.

:::tip Pour les traducteurs
Lors de la traduction de la documentation STOA en français, utilisez toujours la colonne **Terme FR** comme traduction canonique. N'inventez pas de nouvelles traductions pour les termes établis.
:::

## A

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Abonnement** | Subscription | Lien entre une application consommatrice et une API, accordant l'accès avec des quotas spécifiques. |
| **Adaptateur** | Adapter | Composant qui traduit les définitions UAC dans le format natif d'une passerelle spécifique (Kong YAML, Apigee proxy, etc.). Voir [Adaptateurs de passerelle](/docs/guides/console#adaptateurs-de-gateway). |
| **Agent (IA)** | Agent | Système d'IA (ex. Claude, GPT) qui invoque des outils via MCP pour effectuer des tâches de manière autonome. |
| **Application** | Application | Entité consommatrice enregistrée sur la plateforme qui détient des identifiants et des abonnements. |
| **ArgoCD** | ArgoCD | Outil de livraison continue GitOps. Synchronise les manifestes Kubernetes depuis Git vers le cluster. |

## C

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Claim (JWT)** | Claim | Paire clé-valeur intégrée dans un jeton JWT (ex. `tenant_id`, `roles`, `scope`). |
| **Clé d'API** | API Key | Identifiant statique utilisé par les consommateurs pour authentifier les appels API. Géré via les abonnements. |
| **Consommateur** | Consumer | Entité (personne, équipe ou application) qui s'abonne et consomme des API via la plateforme. |
| **Contrat d'API** | API Contract | Voir **UAC (Contrat d'API universel)**. |
| **CRD (Définition de ressource personnalisée)** | CRD (Custom Resource Definition) | Mécanisme d'extension Kubernetes. STOA utilise des CRD pour les ressources `Tool` et `ToolSet`. |

## E

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Edge-MCP** | Edge-MCP | Mode de passerelle principal pour l'intégration des agents IA via le protocole MCP. En production. |
| **Espace de noms (namespace)** | Namespace | Frontière d'isolation Kubernetes. Chaque tenant STOA obtient un namespace dédié (`tenant-{id}`). |

## F

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Fournisseur d'identité** | IdP (Identity Provider) | Source d'authentification externe (Google, GitHub, SAML) fédérée dans Keycloak. |

## G

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **GitOps** | GitOps | Modèle opérationnel où Git est la source de vérité unique. STOA utilise ArgoCD pour la livraison GitOps. |

## I

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Identifiants client** | Client Credentials | Type de flux OAuth 2.0 pour l'authentification machine-à-machine (pas d'interaction utilisateur). |
| **Isolation** | Isolation | Séparation entre les tenants aux niveaux réseau, namespace, identité, données et passerelle. Voir [Multi-Tenant](/docs/concepts/multi-tenant). |

## J

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Jeton d'accès** | Access Token | Identifiant à durée de vie courte (JWT) émis par Keycloak après authentification. Utilisé dans les en-têtes `Authorization: Bearer`. |
| **Jeton Web JSON (JWT)** | JWT (JSON Web Token) | Format de jeton signé utilisé pour l'authentification stateless. Validé par la passerelle. |
| **JSON-RPC** | JSON-RPC | Protocole utilisé par MCP pour la découverte d'outils (`tools/list`) et l'invocation (`tools/call`). |

## K

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Keycloak** | Keycloak | Serveur open-source de gestion des identités et des accès. STOA utilise un realm par tenant. |

## L

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Limitation de débit** | Rate Limit | Politique qui restreint le nombre d'appels API par fenêtre de temps (ex. 600 requêtes/minute). |

## M

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **MCP (Protocole de contexte de modèle)** | MCP (Model Context Protocol) | Protocole ouvert permettant aux agents IA de découvrir et d'invoquer des outils. STOA implémente MCP via les transports SSE et REST. |
| **Métrologie** | Metering | Pipeline de suivi d'utilisation (basé sur Kafka) qui enregistre les appels API pour la facturation et l'analyse. |
| **Mode de déploiement** | Deployment Mode | L'un des 4 modes de passerelle : edge-mcp, sidecar, proxy, shadow. Voir [Modes de passerelle](/docs/concepts/gateway). |
| **Mode shadow** | Shadow Mode | Mode de capture passive du trafic pour la découverte d'API legacy. Reporté en attente de revue sécurité. |
| **Mode sidecar** | Sidecar Mode | Mode de passerelle déployé aux côtés de passerelles existantes (Kong, Envoy) pour l'injection d'observabilité. |
| **mTLS (TLS mutuel)** | mTLS (Mutual TLS) | Authentification TLS bidirectionnelle où le client et le serveur présentent des certificats. |
| **Multi-tenant** | Multi-Tenant | Architecture où une seule instance de plateforme sert plusieurs organisations isolées. |

## O

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **OAuth 2.0** | OAuth 2.0 | Framework d'autorisation standard de l'industrie. STOA supporte les flux authorization code, client credentials et ROPC. |
| **OIDC (OpenID Connect)** | OIDC (OpenID Connect) | Couche d'identité au-dessus d'OAuth 2.0. Utilisée par Keycloak pour le SSO et l'authentification utilisateur. |
| **OPA (Open Policy Agent)** | OPA (Open Policy Agent) | Moteur de politiques utilisé par la passerelle pour l'autorisation fine (politiques Rego). |
| **Optimisation de jetons** | Token Optimization | Fonctionnalité de la passerelle qui réduit la consommation de jetons LLM en compressant les descriptions d'outils. |
| **Outil (MCP)** | Tool | Fonction exposée via MCP que les agents IA peuvent découvrir et invoquer. Défini comme CRD Kubernetes. |

## P

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Passerelle** | Gateway | Composant d'exécution qui route, authentifie et applique les politiques au trafic API/MCP. |
| **Plan de contrôle** | Control Plane | Couche de gestion centralisée de STOA — API, Console UI et Portail. Fonctionne dans le cloud ou on-premise. |
| **Plan de données** | Data Plane | Couche d'exécution où circule le trafic API — passerelles, proxies, sidecars. Généralement on-premise. |
| **Point d'entrée** | Endpoint | URL où une API ou un outil est accessible (ex. `https://api.example.com/v1/users`). |
| **Politique** | Policy | Règle appliquée au trafic API : limitation de débit, CORS, validation JWT, filtrage IP, etc. |
| **Portail développeur** | Portal | Portail en libre-service où les consommateurs découvrent les API, gèrent les abonnements et consultent l'utilisation. |

## R

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **RBAC (Contrôle d'accès basé sur les rôles)** | RBAC (Role-Based Access Control) | Modèle d'autorisation avec 4 rôles : `cpi-admin`, `tenant-admin`, `devops`, `viewer`. |
| **Realm (domaine)** | Realm | Unité d'isolation Keycloak. STOA crée un realm par tenant avec des utilisateurs, clients et rôles indépendants. |

## S

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Scope (portée)** | Scope | Granularité de permission OAuth 2.0 (ex. `stoa:read`, `stoa:write`, `stoa:admin`). |
| **SSE (Événements envoyés par le serveur)** | SSE (Server-Sent Events) | Protocole de streaming unidirectionnel utilisé pour les connexions d'agents MCP. |

## T

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Tenant (locataire)** | Tenant | Organisation isolée sur la plateforme. Chaque tenant possède son propre namespace, realm, API et utilisateurs. |

## U

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **UAC (Contrat d'API universel)** | UAC (Universal API Contract) | Format de définition d'API agnostique de STOA. « Définir une fois, exposer partout. » Voir [Concept UAC](/docs/concepts/uac). |

## W

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Webhook** | Webhook | Rappel HTTP déclenché par des événements de la plateforme (API déployée, abonnement créé, etc.). |

---

## Conventions de traduction {#translation-conventions}

Lors de la traduction de la documentation STOA en français :

1. **Garder en anglais** (ne jamais traduire) : MCP, UAC, SSE, JWT, OIDC, OAuth, OPA, CRD, RBAC, ArgoCD, Keycloak, Kubernetes, namespace, scope, webhook, JSON-RPC
2. **Traduire avec l'original entre parenthèses** (première occurrence uniquement) : « passerelle (gateway) », « abonnement (subscription) », « locataire (tenant) »
3. **Utiliser les termes informatiques français établis** : « jeton » (token), « point d'entrée » (endpoint), « limitation de débit » (rate limit)
4. **Le code reste en anglais** : noms de variables, commandes CLI, chemins d'API, clés YAML
5. **Diagrammes Mermaid** : traduire les libellés mais garder les identifiants de nœuds en anglais

### Ensemble d'outils {#toolset}

| Terme FR | Terme EN | Définition |
|----------|----------|------------|
| **Ensemble d'outils** | ToolSet | CRD qui connecte un serveur MCP externe et expose ses outils via la passerelle STOA. |
