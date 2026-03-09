---
title: "ADR-048 : Architecture de l'Agent Chat Intégré"
description: "Décide que STOA intègre un agent chat basé navigateur dans le Developer Portal, alimenté par l'API Messages d'Anthropic avec injection dynamique d'outils MCP, API keys par tenant et facturation des tokens."
keywords: [agent chat, Anthropic, Messages API, outils MCP, portal, facturation tokens, historique de conversation, injection d'outils]
---

# ADR-048 : Architecture de l'Agent Chat Intégré

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Brouillon |
| **Date** | 2026-02-17 |
| **Décideurs** | Équipe Plateforme |
| **Linear** | CAB-284 |
| **Council** | 8.00/10 Go |

### Décisions Liées

- **ADR-024** : Gateway Unified Modes — le mode edge-mcp sert les outils à l'agent chat
- **ADR-043** : Pont Kafka MCP — les événements de métering tokens transitent par Kafka
- **ADR-044** : Proxy OAuth 2.1 MCP Gateway — le backend chat s'authentifie à la gateway via OAuth
- **ADR-046** : Architecture de Fédération MCP — les appels d'outils issus du chat respectent les politiques de sous-compte
- **ADR-047** : Système MCP Skills — le contexte des skills est injecté dans l'exécution des outils chat

## Contexte

STOA fournit un accès aux outils MCP de niveau entreprise via la gateway, mais les utilisateurs doivent aujourd'hui configurer un client MCP externe (Claude Desktop, scripts Python personnalisés ou extensions IDE) pour interagir avec leurs outils. Cela crée trois problèmes :

1. **Friction d'onboarding** : Chaque utilisateur doit installer, configurer et authentifier un client MCP local avant de pouvoir utiliser un outil.
2. **Pas de gouvernance** : L'entreprise ne peut pas imposer quel fournisseur LLM est utilisé, ne peut pas suivre les coûts de tokens et ne peut pas auditer les conversations.
3. **Pas de contrôle centralisé des coûts** : Chaque utilisateur paie ses propres frais LLM indépendamment — pas de visibilité sur les dépenses IA de l'organisation.

### Ce dont Nous Avons Besoin

Un **agent chat basé navigateur** intégré dans le Developer Portal qui :
- Se connecte automatiquement aux outils MCP auxquels l'utilisateur est abonné (zéro config)
- Utilise les identifiants du fournisseur LLM de l'entreprise (pas les clés personnelles de l'utilisateur)
- Suit la consommation de tokens par tenant/utilisateur pour la facturation et l'application des quotas
- Stocke l'historique des conversations pour l'audit et la reprise de session
- Respecte toutes les politiques gateway existantes (fédération, skills, quotas)

## Décision

### 1. Vue d'Ensemble de l'Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Interface Portal  │     │   Backend Chat        │     │   Fournisseur LLM│
│   (React)           │     │   (router CP API)     │     │   (Anthropic)    │
│                     │     │                       │     │                  │
│  ChatWindow ───SSE──┼────►│  POST /chat/messages  ├────►│  messages.create │
│  MessageList        │     │  GET  /chat/stream    │◄────┤  (streaming)     │
│  ToolCallIndicator  │     │                       │     │                  │
└─────────────────────┘     └──────────┬────────────┘     └──────────────────┘
                                       │
                                       │ Transport SSE MCP
                                       ▼
                            ┌──────────────────────┐
                            │   MCP Gateway         │
                            │   (Rust, edge-mcp)    │
                            │                       │
                            │  tools/list           │
                            │  tools/call           │
                            │  (fédération + skills │
                            │   + quota appliqués)  │
                            └──────────────────────┘
```

**Choix architectural clé** : Le Backend Chat est un **client** MCP qui se connecte à la MCP Gateway via transport SSE (ajustement Council #4). Cela signifie :
- Les appels d'outils depuis le chat passent par le même pipeline gateway que les clients MCP externes
- Les politiques de fédération (ADR-046), le contexte des skills (ADR-047) et les quotas s'appliquent tous
- L'agent chat n'est pas un bypass privilégié — c'est un consommateur MCP de premier ordre

### 2. Abstraction du Fournisseur Chat (ajustement Council #1)

Le backend chat utilise une interface `ChatProvider` pour éviter le couplage fort à un seul éditeur LLM :

```python
class ChatProvider(Protocol):
    async def create_message(
        self,
        messages: list[Message],
        tools: list[Tool],
        model: str,
        max_tokens: int,
        stream: bool = True,
    ) -> AsyncIterator[StreamEvent]: ...

    def convert_mcp_tool(self, mcp_tool: MCPTool) -> Tool: ...

    def extract_tool_calls(self, event: StreamEvent) -> list[ToolCall]: ...

    def estimate_cost(
        self, input_tokens: int, output_tokens: int, model: str
    ) -> Decimal: ...
```

**Implémentations** :

| Fournisseur | SDK | Modèles | Statut |
|----------|-----|--------|--------|
| `AnthropicProvider` | `anthropic` | Claude Sonnet/Opus/Haiku | Phase 1 (principal) |
| `OpenAIProvider` | `openai` | GPT-4o, o3 | Phase 2 (planifié) |
| `OllamaProvider` | `httpx` | Llama, Mistral (local) | Phase 3 (community) |

La configuration du tenant spécifie quel fournisseur et quel modèle utiliser. Les clients entreprise peuvent restreindre les fournisseurs disponibles via les paramètres tenant.

### 3. Backend Chat comme Router avec Feature Flag (ajustement Council #3)

Le backend chat vit dans le Control Plane API comme un **router FastAPI séparé** avec un feature flag :

```python
# control-plane-api/src/routers/chat.py
router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

# Activé via CHAT_ENABLED=true (défaut: false)
# Quand désactivé, tous les endpoints retournent 404
```

**Pourquoi dans CP API (pas un service séparé)** :
- Réutilise l'auth existante (validation JWT, contexte tenant, RBAC)
- Réutilise la base de données existante (stockage de conversations aux côtés des tenants/abonnements)
- Réutilise le producteur Kafka existant (événements de métering des tokens)
- Le SDK Anthropic ajoute ~2 Mo — surcoût acceptable
- Le feature flag isole la fonctionnalité sans complexité de déploiement

**Quand extraire** : Si le trafic chat dépasse 20% des requêtes CP API, ou si le backend chat nécessite une mise à l'échelle indépendante, extraire vers un service `chat-api` dédié. L'abstraction `ChatProvider` rend cette coupure propre.

### 4. Injection d'Outils via MCP Gateway

Le backend chat découvre et invoque les outils en se connectant à la MCP Gateway comme client SSE — pas en appelant directement les backends d'outils :

```
Backend Chat                    MCP Gateway
     │                               │
     │ 1. Connexion SSE (token OAuth)│
     ├──────────────────────────────►│
     │                               │
     │ 2. tools/list                 │
     ├──────────────────────────────►│
     │ 3. [définitions d'outils]     │
     │◄──────────────────────────────┤
     │                               │
     │ 4. Conversion au format       │
     │    fournisseur (MCPTool →     │
     │    Anthropic Tool)            │
     │                               │
     │ 5. messages.create(tools=[...])│
     │    → LLM décide d'appeler outil│
     │                               │
     │ 6. tools/call (tool_name, args)│
     ├──────────────────────────────►│
     │ 7. [résultat outil]           │  ← fédération + skills + quota appliqués ici
     │◄──────────────────────────────┤
     │                               │
     │ 8. Retour résultat au LLM     │
     │    → LLM génère la réponse    │
```

**Pourquoi MCP Gateway, pas des appels directs** :
- Toutes les politiques gateway s'appliquent : limites sous-compte fédération, injection de contexte skills, rate limiting
- La découverte d'outils est dynamique — quand les abonnements d'un utilisateur changent, tools/list le reflète
- Le métering et l'audit se produisent au niveau de la gateway (cohérent avec l'accès aux outils hors chat)
- Le backend chat n'a pas besoin de connaître les backends d'outils — la gateway gère le routage

**Implémentation client MCP** : le backend chat maintient une connexion SSE longue durée par conversation active. Le pooling de connexions avec un timeout d'inactivité (5 min) prévient l'épuisement des ressources.

### 5. API Keys par Tenant (ajustement Council #5 — Conformité CGU Anthropic)

**Les Conditions d'Utilisation d'Anthropic (Section 2.4)** interdisent le partage de clés API entre organisations. STOA applique cette règle :

| Approche | Description | Conformité |
|----------|-------------|------------|
| **Clé fournie par le tenant** (recommandé) | Chaque tenant enregistre sa propre clé API Anthropic dans la Console STOA | Entièrement conforme |
| **Clé gérée par STOA** (SaaS uniquement) | La Plateforme STOA opère comme revendeur Anthropic avec des sous-comptes séparés | Nécessite un accord de partenariat Anthropic |

**Implémentation** : les clés API tenant sont stockées chiffrées dans la base de données CP API (même chiffrement que les clés API SaaS — AES-256-GCM, clé dans Infisical). Le `ChatProvider` reçoit la clé déchiffrée par requête, ne la met jamais en cache en mémoire au-delà du cycle de vie de la requête.

```python
# Paramètres tenant (Interface Console : Paramètres → Chat IA)
{
    "chat_provider": "anthropic",
    "chat_model": "claude-sonnet-4-20250514",
    "chat_api_key": "<chiffré>",          # Clé Anthropic propre au tenant
    "chat_max_tokens_per_request": 4096,
    "chat_monthly_budget_usd": 500.00,      # Plafond de dépenses optionnel
    "chat_enabled": true
}
```

**Rotation de clé** : les tenants peuvent faire pivoter leur clé API dans l'interface Console à tout moment. L'ancienne clé est immédiatement invalidée (pas de période de grâce — les clés Anthropic sont révocables instantanément).

### 6. Métering des Tokens et Budgets

Chaque appel à l'API LLM émet un événement de métering Kafka (extension d'ADR-043) :

```json
{
    "event_type": "chat.tokens_used",
    "tenant_id": "acme",
    "user_id": "alice",
    "conversation_id": "conv-123",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "input_tokens": 1250,
    "output_tokens": 380,
    "tool_calls": 2,
    "estimated_cost_usd": 0.0095,
    "timestamp": "2026-02-17T14:30:00Z"
}
```

**Application des budgets** :
- Budget mensuel par tenant (optionnel, défini dans la Console)
- Limite de tokens journalière par utilisateur (optionnel, définie par l'admin tenant)
- Quand le budget est consommé à 80% : événement d'avertissement → notification Console
- Quand le budget est consommé à 100% : le chat retourne 429 avec "Budget mensuel de tokens dépassé"
- Utilisation agrégée visible dans le tableau de bord Console (par tenant, par utilisateur, par modèle)

### 7. Historique des Conversations et RGPD (ajustements Council #2, #6)

**Stockage** : Conversations et messages stockés dans la base de données CP API (PostgreSQL), scopés au tenant.

**Politique de rétention des données** :
- Défaut : 90 jours (configurable par tenant : 30, 60, 90, 180 jours, ou illimité)
- Purge automatique : tâche cron journalière supprimant les conversations plus anciennes que la période de rétention
- Droit à l'effacement : `DELETE /api/v1/chat/conversations/{id}` supprime immédiatement tous les messages
- Suppression cascade tenant : supprimer un tenant supprime TOUTES les conversations, messages et enregistrements d'utilisation de tokens
- Pas d'accès cross-tenant : les requêtes incluent toujours un filtre `tenant_id` (appliqué au niveau du repository)

**Ce qui est stocké** :

| Stocké | Non Stocké |
|--------|------------|
| Messages utilisateur (texte) | Clés API Anthropic (seulement référence chiffrée) |
| Réponses de l'assistant (texte) | Corps bruts requête/réponse API LLM |
| Noms + arguments d'appels d'outils | Payloads de résultats d'outils (seulement résumé) |
| Comptages de tokens par message | Logs complets d'événements streaming |
| Métadonnées de conversation | Adresses IP utilisateur |

**Gestion des résultats d'outils** : les résultats d'outils de la MCP Gateway peuvent contenir des données sensibles. Le backend chat ne stocke qu'un **résumé** (nom de l'outil, succès/échec, taille du résultat) — pas le payload complet du résultat. Le résultat complet est visible dans l'interface chat pendant la session mais n'est pas persisté.

### 8. Endpoints API

| Méthode | Chemin | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/chat/messages` | Envoyer un message + réponse en streaming | JWT (tout rôle) |
| `GET` | `/api/v1/chat/conversations` | Lister les conversations de l'utilisateur | JWT (tout rôle) |
| `GET` | `/api/v1/chat/conversations/{id}` | Récupérer une conversation avec ses messages | JWT (propriétaire ou admin) |
| `PATCH` | `/api/v1/chat/conversations/{id}` | Renommer une conversation | JWT (propriétaire) |
| `DELETE` | `/api/v1/chat/conversations/{id}` | Supprimer une conversation + messages | JWT (propriétaire ou admin) |
| `GET` | `/api/v1/chat/usage` | Utilisation de tokens de l'utilisateur actuel | JWT (tout rôle) |
| `GET` | `/api/v1/chat/usage/tenant` | Utilisation de tokens du tenant | JWT (tenant-admin+) |

**Protocole de streaming** : `POST /chat/messages` retourne `text/event-stream` (SSE) avec des événements :

```
event: message_start
data: {"conversation_id": "conv-123", "model": "claude-sonnet-4-20250514"}

event: content_delta
data: {"type": "text", "text": "Let me look up "}

event: tool_use_start
data: {"tool_name": "crm_search", "tool_id": "call_1"}

event: tool_use_result
data: {"tool_id": "call_1", "status": "success", "summary": "Found 3 records"}

event: content_delta
data: {"type": "text", "text": "I found 3 matching records..."}

event: message_end
data: {"input_tokens": 1250, "output_tokens": 380, "tool_calls": 1}
```

### 9. RBAC

| Rôle | Permissions |
|------|------------|
| `viewer` | Chat avec ses outils abonnés, voir ses propres conversations |
| `devops` | Pareil que viewer + voir les stats d'utilisation de l'équipe |
| `tenant-admin` | Pareil que devops + gérer les paramètres chat, voir toutes les conversations tenant, définir les budgets |
| `cpi-admin` | Pareil que tenant-admin + voir tous les tenants, gérer la config chat globale |

## Alternatives Considérées

### A. Appels LLM Proxifiés par la Gateway

Router tous les appels API LLM via la MCP Gateway (Rust) au lieu d'appeler Anthropic directement depuis CP API.

**Rejeté car** : la gateway est un serveur d'outils, pas un proxy LLM. Ajouter le SDK Anthropic à Rust augmente la complexité de build (bindings C pour le tokenizer). CP API dispose déjà du contexte auth, de l'accès base de données et de l'écosystème Python nécessaires pour l'intégration LLM. La gateway doit rester focalisée sur le protocole MCP + routage d'outils.

### B. Microservice Chat Autonome

Déployer un service `chat-api` séparé avec sa propre base de données.

**Rejeté pour la Phase 1 car** : ajoute de la complexité de déploiement (nouvelle image Docker, chart Helm, ressources Kubernetes) pour une fonctionnalité qui sert initialement un faible trafic. CP API gère déjà l'auth, la BDD et Kafka. L'approche router avec feature flag (Décision #3) permet l'extraction ultérieure si nécessaire.

### C. Appels LLM Côté Client (Navigateur → Anthropic)

L'interface Portal appelle Anthropic directement depuis le navigateur, CP API gérant uniquement les résultats d'outils.

**Rejeté car** : expose la clé API du tenant au navigateur (risque de sécurité). Pas de métering ni d'application de budget côté serveur. Impossible d'injecter le contexte des skills MCP. L'historique des conversations est perdu au rechargement de la page.

### D. Clé API STOA Partagée entre les Tenants

STOA utilise une seule clé API Anthropic pour tous les tenants, avec métering interne.

**Rejeté car** : viole les Conditions d'Utilisation d'Anthropic Section 2.4 (pas de partage de clé entre organisations). Crée un point de défaillance unique pour la facturation. Une clé partagée compromise affecte tous les tenants.

## Conséquences

### Positives

- **UX zéro-config** : les utilisateurs chattent avec leurs outils sans installer de client externe
- **Gouvernance entreprise** : contrôle centralisé des coûts, audit trail, application RBAC
- **Multi-fournisseur prêt** : l'abstraction `ChatProvider` supporte Anthropic, OpenAI, modèles locaux
- **Appels d'outils conformes aux politiques** : le chat utilise le même pipeline MCP Gateway que les clients externes
- **Avantage compétitif** : aucun gateway API open source n'offre un chat IA intégré avec injection d'outils entreprise

### Négatives

- **Dépendance Anthropic** : la Phase 1 nécessite un accès à l'API Anthropic (atténué par l'abstraction fournisseur)
- **Coût des tokens** : les appels API LLM sont coûteux — nécessite une UX de budget claire pour éviter les mauvaises surprises
- **Stockage des conversations** : nouvelle surface RGPD (atténué par les politiques de rétention + suppression cascade)
- **Croissance du périmètre CP API** : ajouter le chat à CP API augmente ses responsabilités (atténué par feature flag + extractabilité)

### Risques

| Risque | Atténuation |
|------|------------|
| Panne de l'API Anthropic | ChatProvider retourne une erreur claire ; les appels d'outils via MCP continuent de fonctionner sans chat |
| Épuisement du budget tokens en cours de conversation | 429 élégant avec info sur le budget restant ; la conversation est préservée pour reprise ultérieure |
| Violation de données de conversation | Requêtes scopées au tenant (toujours filtrées par tenant_id), clés API chiffrées, pas de PII dans les événements de métering |
| Résultat d'outil contenant des données PII | Seul le résumé de l'appel d'outil est persisté, pas le payload complet |
| Changements de tarification fournisseur | Estimation de coût mise à jour par fournisseur ; les alertes de budget avertissent les tenants de manière proactive |
| Coupure de connexion SSE MCP Gateway | Reconnexion automatique avec backoff exponentiel ; les appels d'outils en attente sont réessayés une fois |

## Phases d'Implémentation

### Phase 1 : Backend Chat + Fournisseur Anthropic (~13 pts)

- Protocole `ChatProvider` + implémentation `AnthropicProvider`
- Router chat dans CP API (`/api/v1/chat/`) avec feature flag
- Modèles `Conversation` et `Message` + migration Alembic
- Client SSE MCP Gateway pour la découverte et l'exécution d'outils
- Métering de tokens via événements Kafka
- Stockage de clés API tenant (chiffré, même pattern que les clés API SaaS)
- Tests unitaires : 25+ tests (fournisseur, router, injection d'outils, métering)

### Phase 2 : Interface Chat Portal (~8 pts)

- Composants `ChatWindow`, `MessageList`, `MessageBubble`, `ToolCallIndicator`, `ChatInput`
- Intégration streaming SSE (EventSource)
- Barre latérale de conversations (liste, recherche, suppression)
- Rendu Markdown + coloration syntaxique du code
- Tests RBAC 4 personas
- Tests unitaires : 20+ tests

### Phase 3 : Tableau de Bord d'Utilisation + Multi-Fournisseur (~8 pts)

- Tableau de bord d'utilisation des tokens dans la Console (par tenant, par utilisateur, par modèle, par période)
- Interface de configuration des budgets (plafond mensuel, limite journalière par utilisateur, alertes)
- Implémentation `OpenAIProvider`
- Export de conversations (JSON/Markdown)
- Tests E2E : 5+ scénarios
- Documentation : Guide de l'agent chat dans stoa-docs

## Références

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Conditions d'Utilisation Anthropic](https://www.anthropic.com/policies/terms-of-service)
- [Spécification MCP 2025-03-26](https://spec.modelcontextprotocol.io/)
- [ADR-024 : Gateway Unified Modes](/docs/architecture/adr/adr-024-gateway-unified-modes)
- [ADR-043 : Pont Kafka MCP](/docs/architecture/adr/adr-043-kafka-mcp-event-bridge)
- [ADR-046 : Architecture de Fédération MCP](/docs/architecture/adr/adr-046-mcp-federation-architecture)
- [ADR-047 : Système MCP Skills](/docs/architecture/adr/adr-047-mcp-skills-system)
