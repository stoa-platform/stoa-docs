---
slug: mcp-protocol-architecture-deep-dive
title: "Plongée dans l'architecture du protocole MCP : flux de messages et transports"
authors: [stoa-team]
tags: [tutorial, mcp, architecture, ai]
description: "Comment MCP fonctionne réellement sous le capot. Couches protocolaires, flux de messages JSON-RPC, transport SSE vs stdio, et comparaison avec gRPC et GraphQL."
keywords:
  - MCP protocol architecture
  - Model Context Protocol internals
  - MCP message flow
  - MCP transport SSE WebSocket
  - MCP vs gRPC
  - MCP security model
  - MCP protocol specification
  - AI agent protocol
  - MCP server architecture
  - MCP tool invocation flow
---

<!-- last verified: 2026-02 -->

# Plongée dans l'architecture MCP : flux de messages et couches de transport

Le Model Context Protocol (MCP) est un protocole basé sur JSON-RPC 2.0 qui standardise comment les agents IA découvrent, s'authentifient et invoquent des outils externes. Il définit quatre phases — initialisation, découverte, invocation et streaming — sur des transports branchables incluant SSE, WebSocket et stdio. Cet article couvre les mécanismes internes du protocole qui comptent pour les déploiements en production.

<!-- truncate -->

:::info Partie de la série MCP Gateway
Il s'agit d'une plongée technique pour les ingénieurs qui construisent sur MCP. Pour une introduction plus générale, commencez par [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway). Pour un déploiement pratique, voir le [Quickstart MCP Gateway avec Docker](/blog/mcp-gateway-quickstart-docker).
:::

## Vue d'ensemble de l'architecture protocolaire

MCP est construit sur trois principes architecturaux :

1. **Modèle client-serveur** : Les clients MCP (agents IA) se connectent aux serveurs MCP (fournisseurs d'outils). Un seul client peut se connecter à plusieurs serveurs.
2. **Fondation JSON-RPC 2.0** : Tous les messages suivent la spécification JSON-RPC 2.0 — paires requête/réponse avec des champs `method`, `params` et `result`/`error`.
3. **Transport branchable** : Le protocole est agnostique au transport. Les mêmes messages JSON-RPC peuvent circuler sur HTTP+SSE, WebSocket ou des pipes stdio.

### Stack protocolaire

```
┌─────────────────────────────────────────────┐
│               Application Layer              │
│  (Tool definitions, Resources, Prompts)      │
├─────────────────────────────────────────────┤
│               Protocol Layer                 │
│  (JSON-RPC 2.0: methods, params, results)    │
├─────────────────────────────────────────────┤
│               Transport Layer                │
│  (HTTP+SSE | WebSocket | stdio | Streamable) │
├─────────────────────────────────────────────┤
│               Security Layer                 │
│  (TLS, OAuth2, API keys, mTLS)              │
└─────────────────────────────────────────────┘
```

Chaque couche est indépendamment remplaçable. Vous pouvez changer les transports sans modifier les définitions d'outils. Vous pouvez ajouter des couches de sécurité sans modifier les messages du protocole. Cette séparation est ce qui rend MCP adapté aussi bien au développement local (stdio) qu'aux déploiements enterprise en production (HTTP+SSE avec mTLS).

## Les quatre phases d'une session MCP

Chaque interaction client-serveur MCP suit quatre phases :

### Phase 1 : Initialisation

Le client établit une connexion et négocie les capacités :

```
Client                              Server
  │                                    │
  │── initialize ─────────────────────→│
  │   {                                │
  │     "method": "initialize",        │
  │     "params": {                    │
  │       "protocolVersion": "2025-03",│
  │       "capabilities": {            │
  │         "tools": {},               │
  │         "resources": {},           │
  │         "prompts": {}              │
  │       },                           │
  │       "clientInfo": {              │
  │         "name": "claude-desktop",  │
  │         "version": "1.0.0"        │
  │       }                            │
  │     }                              │
  │   }                                │
  │                                    │
  │←── initialize result ─────────────│
  │   {                                │
  │     "protocolVersion": "2025-03",  │
  │     "capabilities": {              │
  │       "tools": {"listChanged":true}│
  │     },                             │
  │     "serverInfo": {                │
  │       "name": "stoa-gateway",      │
  │       "version": "0.6.0"          │
  │     }                              │
  │   }                                │
  │                                    │
  │── initialized (notification) ─────→│
  │                                    │
```

**Points clés :**
- `protocolVersion` assure que le client et le serveur s'accordent sur la version de la spec MCP
- La négociation de `capabilities` indique à chaque côté quelles fonctionnalités l'autre supporte
- La notification `initialized` signale que le client est prêt à commencer la découverte
- Si les capacités ne correspondent pas, le client peut rétrograder ou se déconnecter

### Phase 2 : Découverte

Le client énumère les outils, ressources et prompts disponibles :

```
Client                              Server
  │                                    │
  │── tools/list ─────────────────────→│
  │   {"method": "tools/list"}         │
  │                                    │
  │←── tools/list result ─────────────│
  │   {                                │
  │     "tools": [                     │
  │       {                            │
  │         "name": "search-contacts", │
  │         "description": "Search...",│
  │         "inputSchema": {           │
  │           "type": "object",        │
  │           "properties": {          │
  │             "query": {             │
  │               "type": "string"     │
  │             }                      │
  │           },                       │
  │           "required": ["query"]    │
  │         }                          │
  │       }                            │
  │     ]                              │
  │   }                                │
  │                                    │
```

La découverte est dynamique — l'agent appelle `tools/list` au runtime, pas au moment de la compilation. C'est fondamentalement différent de la documentation API statique. Le serveur peut retourner différentes listes d'outils selon l'identité du client, le tenant ou l'environnement.

Un MCP gateway ajoute une couche de politique ici : les réponses `tools/list` sont filtrées par tenant. Le tenant A ne voit que les outils CRM. Le tenant B ne voit que les outils de facturation. Les deux se connectent au même endpoint gateway.

### Phase 3 : Invocation

Le client appelle un outil avec des paramètres typés :

```
Client                              Server
  │                                    │
  │── tools/call ─────────────────────→│
  │   {                                │
  │     "method": "tools/call",        │
  │     "params": {                    │
  │       "name": "search-contacts",   │
  │       "arguments": {               │
  │         "query": "Leanne"          │
  │       }                            │
  │     }                              │
  │   }                                │
  │                                    │
  │←── tools/call result ─────────────│
  │   {                                │
  │     "content": [                   │
  │       {                            │
  │         "type": "text",            │
  │         "text": "{\"contacts\":..}"│
  │       }                            │
  │     ],                             │
  │     "isError": false               │
  │   }                                │
  │                                    │
```

**Points clés :**
- Les `arguments` sont validés par rapport à l'`inputSchema` de l'outil avant l'exécution
- Les résultats sont retournés sous forme de tableaux `content`, supportant plusieurs types de contenu (texte, image, ressource)
- `isError: true` signale une erreur d'exécution d'outil (pas une erreur de protocole — les erreurs de protocole utilisent des réponses d'erreur JSON-RPC)
- Le gateway proxifie `tools/call` vers l'API REST backend, traduisant le format MCP en HTTP et inversement

### Phase 4 : Streaming (Server-Sent Events)

Pour les opérations longues, MCP supporte les réponses en streaming via des notifications :

```
Client                              Server
  │                                    │
  │── tools/call ─────────────────────→│
  │   (long-running operation)         │
  │                                    │
  │←── progress notification ─────────│
  │   {"method":"notifications/progress",
  │    "params":{"progressToken":"abc",│
  │     "progress":0.25,               │
  │     "total":1.0}}                  │
  │                                    │
  │←── progress notification ─────────│
  │   {..., "progress": 0.75}          │
  │                                    │
  │←── tools/call result ─────────────│
  │   {"content": [...]}              │
  │                                    │
```

Le streaming est essentiel pour les workloads enterprise : le traitement de données en lot, la génération de rapports et les workflows multi-étapes bénéficient tous de mises à jour de progression plutôt que d'un blocage jusqu'à la complétion.

## Options de la couche transport

MCP est agnostique au transport. Les mêmes messages JSON-RPC peuvent circuler sur différents mécanismes de transport selon le contexte de déploiement.

### HTTP + Server-Sent Events (SSE)

Le transport le plus courant pour les déploiements MCP en production :

```
Client ──HTTP POST──→ Server (request)
Client ←──SSE────── Server (response stream)
```

**Comment ça fonctionne :**
1. Le client envoie des requêtes JSON-RPC comme HTTP POST vers l'endpoint de messages du serveur
2. Le serveur diffuse les réponses sur une connexion SSE persistante
3. Plusieurs requêtes peuvent être en cours simultanément sur la même connexion SSE

**Avantages :**
- Fonctionne à travers des proxies HTTP, load balancers, CDNs et firewalls
- Le streaming unidirectionnel (serveur vers client) est bien supporté par toute l'infrastructure
- Facile d'ajouter des headers d'authentification (tokens Bearer, clés API)
- Compatible avec les outils de monitoring et de journalisation HTTP existants

**Limitations :**
- Streaming serveur-vers-client uniquement (le client utilise POST pour les requêtes)
- Les connexions SSE peuvent être coupées par des proxies agressifs (configurer les timeouts)
- Pas de support de trames binaires (tout est du texte UTF-8)

**Meilleur pour :** Déploiements en production derrière des API gateways, environnements cloud, réseaux d'entreprise.

### Streamable HTTP (spec 2025-03)

La dernière spécification MCP introduit le Streamable HTTP comme transport simplifié :

```
Client ──HTTP POST──→ Server
  (request in body, response streamed back on same connection)
```

**Comment ça fonctionne :**
1. Le client envoie une requête JSON-RPC comme HTTP POST
2. Le serveur répond avec `Content-Type: text/event-stream` pour le streaming, ou `application/json` pour les réponses simples
3. Le serveur peut optionnellement inclure un header `Mcp-Session-Id` pour l'affinité de session

**Avantages :**
- Plus simple que SSE (pas d'endpoint de flux d'événements séparé)
- Gestion de session via des headers (pas des chemins d'URL)
- Supporte les réponses streaming et non-streaming
- Meilleur alignement avec la sémantique HTTP standard

**Meilleur pour :** Nouvelles implémentations ciblant la spec 2025-03.

### WebSocket

Communication bidirectionnelle, full-duplex :

```
Client ←──WebSocket──→ Server (bidirectionnel)
```

**Comment ça fonctionne :**
1. Le client établit une connexion WebSocket (upgrade HTTP)
2. Les deux côtés peuvent envoyer des messages JSON-RPC à tout moment
3. Le serveur peut pousser des notifications sans polling du client

**Avantages :**
- Vraie communication bidirectionnelle
- Latence plus faible pour les interactions à haute fréquence
- Notifications initiées par le serveur sans polling

**Limitations :**
- Les connexions WebSocket sont plus difficiles à load-balancer (sessions sticky nécessaires)
- Certains firewalls et proxies d'entreprise bloquent les upgrades WebSocket
- Plus complexe à déboguer que HTTP (pas de journalisation requête/réponse standard)

**Meilleur pour :** Applications temps réel, invocations d'outils à faible latence, patterns de notification bidirectionnels.

### stdio (Entrée/Sortie standard)

Communication au niveau processus via des pipes stdin/stdout :

```
Client ──stdin──→ Server Process
Client ←──stdout── Server Process
```

**Comment ça fonctionne :**
1. Le client lance le serveur MCP comme processus enfant
2. Les messages JSON-RPC sont écrits dans le stdin du processus
3. Les réponses sont lues depuis le stdout du processus
4. Un message par ligne (JSON délimité par des nouvelles lignes)

**Avantages :**
- Zéro configuration réseau — fonctionne hors ligne
- Isolation et gestion du cycle de vie au niveau processus
- Transport le plus simple à implémenter

**Limitations :**
- Machine locale uniquement (pas d'accès réseau)
- Un client par processus serveur
- Pas d'authentification intégrée (confiance au niveau processus)

**Meilleur pour :** Développement local, intégrations IDE (VS Code, Claude Desktop), outils CLI.

### Comparaison des transports

| Fonctionnalité | HTTP+SSE | Streamable HTTP | WebSocket | stdio |
|---|---|---|---|---|
| Direction | Client→POST, Server→SSE | Bidirectionnel via HTTP | Full duplex | Bidirectionnel via pipes |
| Infrastructure | Stack HTTP standard | Stack HTTP standard | LB WebSocket-aware | Processus local |
| Auth | Headers HTTP | Headers HTTP | Handshake initial | Confiance niveau processus |
| Streaming | Serveur→Client | Les deux | Les deux | Les deux |
| Firewall-friendly | Oui | Oui | Parfois bloqué | N/A (local) |
| Load balancing | HTTP standard | HTTP standard | Sessions sticky | N/A |
| Meilleur pour | APIs production | Nouvelles implémentations | Apps temps réel | Dev local/IDEs |

## Modèle de sécurité

Le modèle de sécurité MCP opère à plusieurs couches :

### Sécurité du transport

Tous les déploiements MCP en production devraient utiliser TLS. Le protocole lui-même ne mandate pas TLS, mais sans lui, les messages JSON-RPC (incluant les arguments d'outils et les résultats) voyagent en clair.

```
Client ──TLS 1.3──→ MCP Gateway ──mTLS──→ Backend Service
```

### Authentification

MCP ne définit pas son propre mécanisme d'authentification. Il s'appuie plutôt sur la couche transport :

- **Transports HTTP** : Tokens Bearer (JWT), clés API ou certificats clients dans les headers HTTP
- **WebSocket** : Authentification lors du handshake d'upgrade HTTP
- **stdio** : Confiance au niveau processus (le client contrôle quel serveur il lance)

Un MCP gateway centralise l'authentification. Au lieu que chaque serveur MCP implémente sa propre auth, le gateway valide les credentials une fois et transfère les requêtes authentifiées aux serveurs backend.

### Autorisation

La négociation de `capabilities` MCP fournit un contrôle de fonctionnalités à gros grain, mais l'autorisation fine-grained (quels outils ce tenant peut-il appeler ?) est la responsabilité du gateway.

STOA implémente cela avec des politiques OPA évaluées à deux points :

1. **Au moment de la découverte** : Les réponses `tools/list` sont filtrées par tenant. Les outils non autorisés ne sont jamais montrés.
2. **Au moment de l'invocation** : Les requêtes `tools/call` sont évaluées par rapport aux politiques par tenant et par outil avant le proxying.

Cela prévient à la fois l'accès direct aux outils et les attaques d'énumération (où un agent découvre des outils qu'il ne devrait pas connaître).

### Audit

Chaque interaction MCP devrait être journalisée pour la conformité :

| Événement | Quoi journaliser | Pourquoi |
|---|---|---|
| `initialize` | Identité du client, version du protocole | Tracer quels agents se connectent |
| `tools/list` | ID tenant, outils retournés | Auditer la découverte d'outils |
| `tools/call` | Tenant, outil, arguments, statut du résultat | Audit trail complet des invocations |
| Erreur | Type d'erreur, tenant, contexte | Investigation d'incidents |

Les MCP gateways produisent ces événements d'audit automatiquement. Les serveurs MCP bruts nécessitent une instrumentation personnalisée.

## MCP comparé à d'autres protocoles

### MCP vs gRPC

| Aspect | MCP | gRPC |
|---|---|---|
| Objectif | Communication agent IA ↔ outil | RPC service-à-service |
| Schéma | JSON Schema (découverte au runtime) | Protobuf (génération de code à la compilation) |
| Découverte | Dynamique (`tools/list` au runtime) | Statique (fichiers proto, réflexion de service) |
| Transport | HTTP+SSE, WebSocket, stdio | HTTP/2 |
| Streaming | SSE ou WebSocket | Flux HTTP/2 bidirectionnels |
| Écosystème | Agents IA, frameworks LLM | Microservices, infrastructure cloud |
| Support binaire | Basé sur le texte (JSON) | Binaire natif (Protobuf) |

**Quand utiliser MCP** : Intégration d'agents IA, découverte dynamique d'outils, accès multi-tenant aux outils.
**Quand utiliser gRPC** : Communication service-à-service haute performance, schémas stricts, payloads binaires.

MCP et gRPC sont complémentaires. Un MCP gateway peut proxifier les invocations d'outils vers des backends gRPC — l'agent voit des outils MCP, le backend sert du gRPC.

### MCP vs GraphQL

| Aspect | MCP | GraphQL |
|---|---|---|
| Objectif | Invocation d'outils par agent IA | Requête de données par le client |
| Schéma | JSON Schema par outil | Système de types unifié |
| Modèle de requête | Appel d'outil (invocation de fonction) | Requête déclarative (demander des champs) |
| Découverte | Énumération `tools/list` | Introspection de schéma |
| Streaming | Notifications de progression | Subscriptions |
| Modèle d'auth | Politiques par outil | Résolveurs par champ |

**Quand utiliser MCP** : Agents IA qui ont besoin d'appeler des fonctions (rechercher, créer, mettre à jour).
**Quand utiliser GraphQL** : Clients qui ont besoin de requêtes de données flexibles avec contrôle au niveau champ.

Encore une fois, ces protocoles sont complémentaires. Un outil MCP peut exécuter en interne une requête GraphQL vers un backend.

### MCP vs OpenAI Function Calling

| Aspect | MCP | OpenAI Function Calling |
|---|---|---|
| Standard | Ouvert (Anthropic + communauté) | Propriétaire (OpenAI) |
| Découverte | Runtime (`tools/list`) | Compilation (schémas de fonction dans l'appel API) |
| Transport | Multiple (SSE, WS, stdio) | API OpenAI uniquement |
| Multi-tenant | Intégré au protocole | Au niveau applicatif |
| Vendor lock-in | Aucun | Écosystème OpenAI |

Pour une comparaison détaillée, voir [MCP vs OpenAI Function Calling vs LangChain Tools](/blog/mcp-vs-openai-function-calling-vs-langchain).

## Construire un serveur MCP : exemple minimal

Pour comprendre le protocole concrètement, voici un serveur MCP minimal en Python (transport stdio) :

```python
import json
import sys

def handle_request(request):
    method = request.get("method")

    if method == "initialize":
        return {
            "protocolVersion": "2025-03",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "demo-server", "version": "1.0.0"}
        }

    elif method == "tools/list":
        return {
            "tools": [{
                "name": "greet",
                "description": "Generate a greeting message",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Name to greet"}
                    },
                    "required": ["name"]
                }
            }]
        }

    elif method == "tools/call":
        tool_name = request["params"]["name"]
        args = request["params"]["arguments"]
        if tool_name == "greet":
            return {
                "content": [{"type": "text", "text": f"Hello, {args['name']}!"}],
                "isError": False
            }

    return {"error": {"code": -32601, "message": f"Unknown method: {method}"}}

# transport stdio : lire le JSON-RPC depuis stdin, écrire dans stdout
for line in sys.stdin:
    request = json.loads(line.strip())
    result = handle_request(request)
    response = {"jsonrpc": "2.0", "id": request.get("id"), "result": result}
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()
```

Ce serveur de 40 lignes implémente le cycle de vie MCP complet : initialisation, découverte et invocation d'outils. En production, vous utiliseriez un SDK MCP et déploieriez derrière un gateway — mais le protocole est suffisamment simple pour être implémenté depuis zéro.

## Considérations pour la production

### Cycle de vie de la connexion

Les sessions MCP sont à longue durée de vie. Un agent IA peut maintenir une connexion pendant des heures ou des jours. Prévoyez :

- **Reconnexion** : Les clients devraient gérer les connexions coupées gracieusement et se réinitialiser
- **État de session** : Évitez l'état de session côté serveur si possible (les invocations d'outils sans état scalent mieux)
- **Heartbeats** : Utilisez des commentaires SSE (`:ping`) ou des trames ping WebSocket pour détecter les connexions mortes

### Scalabilité

Les MCP gateways gèrent les invocations d'outils comme des requêtes HTTP proxifiées — ils scalent de la même façon que tout reverse proxy :

- Scaling horizontal avec des réplicas Kubernetes
- Connection pooling vers les services backend
- Gestion des requêtes sans état (pas d'affinité de session nécessaire pour HTTP+SSE)

### Gestion des erreurs

MCP distingue entre les erreurs de protocole et les erreurs d'outils :

- **Erreurs de protocole** : JSON-RPC invalide, méthode inconnue, params malformés → réponse d'erreur JSON-RPC
- **Erreurs d'outils** : Le backend a retourné 500, timeout, échec de validation → résultat `tools/call` avec `isError: true`

Le gateway ne devrait jamais exposer les détails d'erreur du backend (stack traces, URLs internes) au client. Journalisez-les côté serveur et retournez des messages d'erreur épurés.

## Foire aux questions

### Quelle version de MCP devrais-je cibler ?

Ciblez la version de protocole `2025-03`, qui inclut le transport Streamable HTTP et une meilleure négociation de capacités. Le protocole est rétrocompatible — un serveur supportant `2025-03` peut négocier vers le bas jusqu'à `2024-11` avec des clients plus anciens. Consultez la [spécification officielle MCP](https://modelcontextprotocol.io) pour la dernière version.

### MCP peut-il gérer des données binaires (fichiers, images) ?

Les types de contenu MCP incluent `text` et `image` (encodé en base64). Pour les payloads binaires volumineux, le pattern recommandé est de retourner une URL ou une référence de ressource que le client peut récupérer séparément, plutôt que d'intégrer des données binaires dans la réponse JSON-RPC. La méthode `resources/read` supporte ce pattern nativement.

### Comment MCP gère-t-il l'authentification sur plusieurs serveurs ?

Chaque serveur MCP (ou gateway) gère sa propre authentification de façon indépendante. Un client se connectant à plusieurs serveurs MCP gère des credentials séparées par connexion. Un MCP gateway simplifie cela en fournissant un seul endpoint authentifié qui route vers plusieurs serveurs backend — le client s'authentifie une fois avec le gateway.

### MCP est-il adapté aux workloads à haut débit ?

MCP ajoute un overhead minimal aux invocations d'outils — l'enveloppe JSON-RPC fait quelques centaines d'octets. La latence de proxying du gateway dépend du transport et du backend. Le gateway Rust de STOA ajoute une latence inférieure à la milliseconde par invocation. Pour les opérations en masse, envisagez des invocations d'outils en lot ou des réponses streaming plutôt que des appels individuels à haute fréquence. Voir nos [benchmarks de performance du gateway](/blog/stoa-gateway-performance-benchmarks) pour les latences mesurées.

## Lectures complémentaires

- [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway) — Pourquoi les agents IA ont besoin d'une couche gateway
- [OAuth 2.1 + PKCE pour les MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Flux OAuth complet pour les clients MCP
- [Convertir des APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools) — Guide pratique pour exposer vos APIs
- [Connecter des agents IA aux APIs d'entreprise](/blog/connecting-ai-agents-enterprise-apis) — Patterns d'intégration enterprise
- [L'ESB est mort, vive MCP](/blog/esb-is-dead-long-live-mcp) — Comment MCP remplace le middleware d'intégration traditionnel
- [Concepts MCP Gateway](/docs/concepts/mcp-gateway) — Architecture gateway de STOA
- [Spécification officielle MCP](https://modelcontextprotocol.io) — La source de vérité du protocole

---

*Vous construisez sur MCP ? [Commencez par le guide de démarrage rapide](/docs/guides/quickstart) pour déployer un gateway fonctionnel, ou explorez la [documentation du MCP gateway](/docs/concepts/mcp-gateway) pour les détails d'architecture.*
