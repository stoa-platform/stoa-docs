---
slug: convert-rest-api-to-mcp-tools
title: "Convertir des APIs REST en outils MCP : guide étape par étape"
authors: [stoa-team]
tags: [tutorial, mcp, ai, api-gateway]
description: "Vos APIs REST existantes peuvent devenir des outils pour agents IA en quelques minutes. Mappez les specs OpenAPI vers des définitions d'outils MCP avec des exemples de code pratiques."
keywords:
  - convert REST API to MCP tool
  - REST to MCP migration
  - MCP tool definition
  - OpenAPI to MCP
  - AI agent tool registration
  - Model Context Protocol tools
  - API gateway MCP integration
  - MCP tool CRD
  - REST API AI agents
---

<!-- last verified: 2026-02 -->

# Comment convertir des APIs REST en outils MCP : guide étape par étape

Chaque endpoint d'API REST peut devenir un outil MCP que les agents IA découvrent et invoquent automatiquement. La conversion est un exercice de mapping : votre spec OpenAPI contient déjà le nom, la description, les paramètres et l'URL d'endpoint dont MCP a besoin. Ce guide vous accompagne depuis un seul endpoint jusqu'à l'automatisation en masse avec des ToolSet CRDs.

<!-- truncate -->

:::info Partie de la série MCP Gateway
Cet article fait partie de notre série sur le MCP gateway. Nouveau dans MCP ? Commencez par [Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway) pour la vue d'ensemble de l'architecture, ou essayez le [Quickstart MCP Gateway avec Docker](/blog/mcp-gateway-quickstart-docker) pour un déploiement pratique.
:::

## Pourquoi convertir des APIs REST en outils MCP ?

Les agents IA comme Claude, GPT et les systèmes basés sur LLM personnalisés ont besoin d'une façon structurée de découvrir et d'appeler vos APIs. Aujourd'hui, la plupart des APIs d'entreprise sont documentées avec des specs OpenAPI (Swagger) — conçues pour des développeurs humains qui lisent la documentation, écrivent du code client et gèrent l'authentification manuellement.

Les outils MCP inversent ce modèle. Au lieu que le développeur lise la documentation, **l'agent lit les définitions d'outils** au runtime. Chaque outil possède :

- Un **nom** et une **description** que l'agent utilise pour décider quand l'appeler
- Un **schéma d'entrée** que l'agent utilise pour construire des paramètres valides
- Un **endpoint** que le gateway proxifie pour le compte de l'agent

Le résultat : les agents IA peuvent utiliser vos APIs REST existantes sans code d'intégration personnalisé. Vous définissez le mapping une fois, et chaque agent compatible MCP obtient l'accès.

## Le mapping conceptuel : OpenAPI vers MCP

Avant d'écrire la moindre configuration, comprenez comment les concepts OpenAPI se mappent vers MCP :

| Concept OpenAPI | Équivalent MCP | Exemple |
|---|---|---|
| Opération (`GET /users/{id}`) | Outil | `get-user` |
| `operationId` | `name` de l'outil | `get-user` |
| `summary` / `description` | `description` de l'outil | "Récupérer un utilisateur par ID" |
| `parameters` + `requestBody` | `input_schema` de l'outil | Objet JSON Schema |
| URL serveur + chemin | `endpoint` de l'outil | `https://api.internal/users` |
| `responses.200.content` | Format de sortie de l'outil | Corps de réponse JSON |
| Schémas de sécurité | Politique d'auth du gateway | JWT, clé API, mTLS |
| Tags | Namespace d'outil / tenant | `crm`, `billing` |

L'insight clé : **votre spec OpenAPI est déjà à 80% de la définition d'outil MCP.** Les 20% restants concernent la configuration du gateway — routage, auth, rate limiting — que STOA gère de façon déclarative.

## Étape 1 : Identifier les endpoints API à convertir

Commencez par un inventaire ciblé. Tous les endpoints n'ont pas de sens en tant qu'outils pour agents IA :

**Bons candidats pour les outils MCP :**
- Opérations de lecture (`GET`) qui retournent des données structurées — recherche, listes, vues détaillées
- Opérations d'écriture idempotentes (`PUT`, `PATCH`) avec des schémas d'entrée clairs
- Actions sans état (`POST`) comme "envoyer un email", "générer un rapport", "traduire du texte"

**À reporter pour l'instant :**
- Endpoints d'upload/download de fichiers (payloads binaires)
- Opérations asynchrones longues (nécessitent des patterns webhook/polling)
- Endpoints admin/destructifs (`DELETE`) — à ajouter uniquement avec des politiques d'approbation explicites

Pour ce tutoriel, nous allons convertir trois endpoints d'une API CRM typique :

```yaml
# Spec OpenAPI source (extrait)
paths:
  /contacts:
    get:
      operationId: search-contacts
      summary: Search contacts by name, email, or company
      parameters:
        - name: query
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
  /contacts/{id}:
    get:
      operationId: get-contact
      summary: Get a contact by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
  /contacts:
    post:
      operationId: create-contact
      summary: Create a new contact
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, email]
              properties:
                name:
                  type: string
                email:
                  type: string
                  format: email
                company:
                  type: string
```

## Étape 2 : Créer des définitions Tool CRD

Chaque endpoint API devient une ressource personnalisée Tool. Le Tool CRD est la façon Kubernetes-native d'enregistrer des outils MCP avec STOA.

### Outil 1 : Rechercher des contacts

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: search-contacts
  namespace: tenant-acme
  labels:
    stoa.dev/tenant: acme
    stoa.dev/category: crm
spec:
  displayName: Search Contacts
  description: >
    Search for contacts by name, email, or company.
    Returns a list of matching contacts with their details.
    Use this when the user asks to find or look up a contact.
  endpoint: https://crm-api.internal/contacts
  method: GET
  inputSchema:
    type: object
    properties:
      query:
        type: string
        description: "Search term: name, email, or company"
      limit:
        type: integer
        description: "Maximum results to return (default: 10)"
        default: 10
    required:
      - query
```

### Outil 2 : Obtenir un contact par ID

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: get-contact
  namespace: tenant-acme
  labels:
    stoa.dev/tenant: acme
    stoa.dev/category: crm
spec:
  displayName: Get Contact Details
  description: >
    Retrieve full details for a specific contact by their ID.
    Use this after finding a contact via search to get complete information.
  endpoint: https://crm-api.internal/contacts/{id}
  method: GET
  inputSchema:
    type: object
    properties:
      id:
        type: string
        description: "The contact's unique identifier"
    required:
      - id
```

### Outil 3 : Créer un contact

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: create-contact
  namespace: tenant-acme
  labels:
    stoa.dev/tenant: acme
    stoa.dev/category: crm
spec:
  displayName: Create Contact
  description: >
    Create a new contact in the CRM.
    Requires at minimum a name and email address.
    Use this when the user asks to add or register a new contact.
  endpoint: https://crm-api.internal/contacts
  method: POST
  inputSchema:
    type: object
    properties:
      name:
        type: string
        description: "Contact's full name"
      email:
        type: string
        description: "Contact's email address"
      company:
        type: string
        description: "Company or organization name"
    required:
      - name
      - email
```

Appliquer les outils à votre cluster :

```bash
kubectl apply -f tools/
```

Vérifier qu'ils sont enregistrés :

```bash
kubectl get tools -n tenant-acme
```

```
NAME              DISPLAY NAME          METHOD   AGE
search-contacts   Search Contacts       GET      5s
get-contact       Get Contact Details   GET      5s
create-contact    Create Contact        POST     5s
```

Pour plus d'informations sur le schéma du Tool CRD, voir la [Référence Tool CRD](/docs/reference/crds/tool).

## Étape 3 : Écrire des descriptions d'outils efficaces

La description de l'outil est le champ le plus important pour l'utilisabilité par les agents IA. Les agents l'utilisent pour décider **quand** appeler un outil et **comment** construire les paramètres. Une mauvaise description amène l'agent à choisir le mauvais outil ou à passer de mauvais paramètres.

### Bonnes pratiques pour les descriptions

| Pratique | Mauvais exemple | Bon exemple |
|---|---|---|
| Expliquer **quand** utiliser | "Obtient des contacts" | "Rechercher des contacts par nom, email ou entreprise. Utiliser quand l'utilisateur demande à trouver un contact." |
| Décrire **chaque paramètre** | (pas de descriptions) | `query: "Terme de recherche : nom, email ou entreprise"` |
| Mentionner le **format de retour** | (omis) | "Retourne une liste de contacts correspondants avec nom, email, entreprise et ID" |
| Indiquer les **préconditions** | (omis) | "Utiliser get-contact après search pour obtenir les détails complets" |
| Éviter le jargon | "Invoque l'endpoint CRM REST" | "Rechercher des contacts dans la base de données clients" |

### Le pattern trois phrases

Pour la plupart des outils, cette structure fonctionne bien :

1. **Ce qu'il fait** — "Rechercher des contacts par nom, email ou entreprise."
2. **Ce qu'il retourne** — "Retourne une liste de contacts correspondants avec leurs détails."
3. **Quand l'utiliser** — "Utiliser quand l'utilisateur demande à trouver ou rechercher un contact."

Les agents IA traitent ces descriptions au moment de la découverte des outils. Des descriptions claires et actionnables signifient une meilleure sélection d'outils et moins d'invocations échouées.

## Étape 4 : Tester avec un agent IA

Les outils enregistrés, testez-les via le MCP gateway. D'abord, vérifiez que le gateway peut lister les outils :

```bash
curl -s "${STOA_GATEWAY_URL}/mcp/tools" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Tenant-ID: acme" | jq '.tools[].name'
```

Sortie attendue :

```json
"search-contacts"
"get-contact"
"create-contact"
```

Maintenant invoquez un outil directement :

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/search-contacts/invoke" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/json" \
  -d '{"query": "Leanne", "limit": 5}' | jq .
```

Le gateway :
1. Valide la requête par rapport au schéma d'entrée
2. Évalue les politiques OPA (auth, rate limit)
3. Proxifie vers `https://crm-api.internal/contacts?query=Leanne&limit=5`
4. Retourne la réponse au format MCP

Pour tester avec Claude Desktop, ajoutez le gateway comme serveur MCP dans votre configuration Claude Desktop :

```json
{
  "mcpServers": {
    "stoa-crm": {
      "url": "http://localhost:3000/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY",
        "X-Tenant-ID": "acme"
      }
    }
  }
}
```

## Étape 5 : Automatiser avec les ToolSet CRDs

Convertir les endpoints un par un fonctionne pour quelques outils, mais les APIs d'entreprise peuvent en avoir des dizaines ou des centaines. Le ToolSet CRD vous permet d'enregistrer en masse des outils depuis une spec OpenAPI.

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: crm-api
  namespace: tenant-acme
spec:
  displayName: CRM API Tools
  description: Customer Relationship Management tools
  source:
    type: openapi
    url: https://crm-api.internal/openapi.json
  defaults:
    tenant: acme
    category: crm
  filters:
    includePaths:
      - /contacts/**
      - /companies/**
    excludeMethods:
      - DELETE
    excludePaths:
      - /contacts/*/archive
  overrides:
    - operationId: search-contacts
      description: >
        Search for contacts by name, email, or company.
        Returns a list of matching contacts with their details.
```

Le contrôleur ToolSet :
1. Récupère la spec OpenAPI depuis l'URL source
2. Génère un Tool CRD par opération correspondante
3. Applique les filtres pour exclure les endpoints non sûrs ou non pertinents
4. Fusionne les overrides pour des descriptions ou configurations personnalisées
5. Réconcilie lors des changements de spec (compatible GitOps)

Appliquer le ToolSet :

```bash
kubectl apply -f toolset-crm.yaml
```

Vérifier les outils générés :

```bash
kubectl get tools -n tenant-acme -l stoa.dev/toolset=crm-api
```

Pour plus d'informations sur les ToolSet CRDs, voir la [Référence ToolSet CRD](/docs/reference/crds/toolset).

## Gestion des patterns courants

### Paramètres de chemin

Les APIs REST utilisent des paramètres de chemin (`/contacts/{id}`). Mappez-les comme des propriétés de schéma d'entrée ordinaires — le gateway les substitue dans l'URL :

```yaml
endpoint: https://crm-api.internal/contacts/{id}
inputSchema:
  properties:
    id:
      type: string
      description: "Contact ID"
```

### Passthrough d'authentification

Si votre API backend nécessite sa propre authentification (séparée de l'auth du MCP gateway), configurez le transfert de credentials dans la spec Tool :

```yaml
spec:
  endpoint: https://crm-api.internal/contacts
  auth:
    type: bearer
    tokenSource: gateway  # Utiliser le token du compte de service du gateway
```

### Transformation de réponse

Certaines APIs REST retournent des réponses verboses qui gaspillent la fenêtre de contexte de l'agent. Utilisez les mappings de réponse pour réduire la sortie :

```yaml
spec:
  responseMapping:
    include:
      - id
      - name
      - email
      - company
    exclude:
      - _links
      - _embedded
      - metadata
```

### Pagination

Pour les endpoints qui retournent des résultats paginés, configurez la stratégie de pagination pour que les agents puissent demander des pages spécifiques :

```yaml
spec:
  pagination:
    type: offset
    limitParam: limit
    offsetParam: offset
    defaultLimit: 10
    maxLimit: 100
```

## Considérations de sécurité

La conversion des APIs REST en outils MCP introduit un nouveau chemin d'accès — des agents IA qui appellent vos services internes. Appliquez une défense en profondeur :

1. **Auth au niveau gateway** : Chaque invocation d'outil passe par l'authentification du MCP gateway (JWT, clé API ou mTLS). Voir le [guide d'authentification](/docs/guides/authentication).

2. **Politiques OPA par outil** : Restreindre quels tenants peuvent appeler quels outils. Un tenant billing ne devrait pas accéder aux outils CRM.

3. **Validation des entrées** : Le gateway valide tous les paramètres par rapport au schéma d'entrée avant de proxifier. Les requêtes malformées n'atteignent jamais votre backend.

4. **Rate limiting** : Définir des quotas par tenant et par outil pour éviter que des agents incontrôlés ne saturent les backends.

5. **Journalisation d'audit** : Chaque invocation d'outil est journalisée avec l'ID tenant, le nom de l'outil, les paramètres et le statut de réponse. Essentiel pour la conformité (NIS2, DORA, SOC 2).

## Foire aux questions

### Puis-je convertir n'importe quelle API REST en outil MCP ?

Oui, toute API REST avec un schéma d'entrée/sortie bien défini peut devenir un outil MCP. Les meilleurs candidats sont les endpoints avec des paramètres clairs et typés et des réponses JSON structurées. Les endpoints qui retournent des données binaires (téléchargements de fichiers), nécessitent des uploads multipart ou utilisent une authentification non standard peuvent nécessiter une logique d'adaptateur. Commencez avec des endpoints `GET` en lecture seule et étendez aux opérations d'écriture une fois le pattern validé.

### Comment gérer les APIs qui nécessitent une authentification complexe ?

Le MCP gateway gère l'authentification côté agent (validation du JWT ou de la clé API de l'agent). Pour les APIs backend qui nécessitent leurs propres credentials, configurez le transfert de credentials dans la section `auth` du Tool CRD. Le gateway peut injecter des tokens bearer, des clés API ou des certificats mTLS lors du proxying vers votre backend. De cette façon, les agents ne voient jamais les credentials backend — le gateway les gère de façon sécurisée.

### Quelle est la différence entre un Tool CRD et un ToolSet CRD ?

Un [Tool CRD](/docs/reference/crds/tool) définit un seul outil MCP avec son endpoint, sa description et son schéma d'entrée. Un [ToolSet CRD](/docs/reference/crds/toolset) génère en masse des Tool CRDs depuis une spec OpenAPI. Utilisez les Tool CRDs pour un contrôle fin sur des outils individuels. Utilisez les ToolSet CRDs quand vous voulez exposer de nombreux endpoints de la même API avec des valeurs par défaut cohérentes. Les ToolSets supportent les filtres et les overrides pour personnaliser les outils générés.

### Dois-je modifier mon API REST existante ?

Non. Le MCP gateway agit comme un reverse proxy — votre API REST ne sait pas et ne se soucie pas que des agents IA l'appellent via MCP. Le gateway gère la translation de protocole, l'authentification, le rate limiting et l'observabilité. Votre API continue de servir ses clients existants de façon inchangée tout en devenant également disponible pour les agents IA.

### Comment cela se compare-t-il à l'écriture de serveurs MCP personnalisés ?

Écrire un serveur MCP personnalisé signifie implémenter le protocole MCP, gérer la découverte d'outils, gérer l'authentification et construire l'observabilité depuis zéro — par API. Convertir des APIs REST en outils MCP via le gateway vous donne tout cela prêt à l'emploi. L'approche gateway est particulièrement avantageuse quand vous avez des dizaines d'APIs à exposer, car chacune n'est qu'une définition YAML plutôt qu'une implémentation de serveur personnalisée.

## Prochaines étapes

Vous avez appris comment convertir des APIs REST en outils MCP. Voici où aller ensuite :

- **[Quickstart MCP Gateway](/blog/mcp-gateway-quickstart-docker)** — Déployer un gateway fonctionnel pour tester vos outils
- **[Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway)** — Comprendre l'architecture et le modèle de sécurité
- **[Référence Tool CRD](/docs/reference/crds/tool)** — Documentation complète du schéma des définitions Tool
- **[Référence ToolSet CRD](/docs/reference/crds/toolset)** — Génération d'outils en masse depuis des specs OpenAPI
- **[Connecter des agents IA aux APIs d'entreprise](/blog/connecting-ai-agents-enterprise-apis)** — Patterns plus larges pour l'intégration d'agents IA

---

*Prêt à exposer vos APIs aux agents IA ? [Commencez par le guide de démarrage rapide](/docs/guides/quickstart) ou explorez la [documentation du MCP gateway](/docs/concepts/mcp-gateway).*
