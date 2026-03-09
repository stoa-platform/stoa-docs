---
sidebar_position: 10
title: "MCP pour les Développeurs : De Zéro à un Appel d'Outil en 2 Minutes"
description: "Connectez-vous au MCP Gateway hébergé de STOA depuis Claude.ai, Python ou TypeScript — pas de kubectl, pas de cluster, juste une URL et un token."
keywords:
  - MCP developer guide
  - connect Claude to MCP
  - STOA MCP tutorial
  - Python MCP client
  - TypeScript MCP client
  - hosted MCP gateway
---

# MCP pour les Développeurs

Connectez-vous au MCP Gateway de STOA et appelez votre premier outil — depuis Claude.ai, Python ou TypeScript. Pas de kubectl. Pas de cluster. Juste une URL et un token.

:::info Cloud Hébergé
Ce guide utilise le gateway hébergé de STOA à `mcp.gostoa.dev`. Tout fonctionne immédiatement — aucune configuration d'infrastructure n'est nécessaire.
:::

## Option A : Claude.ai (Le Plus Rapide)

Le chemin le plus rapide. Claude gère l'authentification automatiquement via OAuth 2.1.

### 1. Ajouter le Serveur MCP

Dans [claude.ai](https://claude.ai) : **Paramètres** → **Intégrations** → **Ajouter un serveur MCP**

| Champ | Valeur |
|-------|--------|
| URL | `https://mcp.gostoa.dev/mcp/sse` |
| Nom | `STOA Platform` |

Connectez-vous avec vos identifiants STOA lorsque vous y êtes invité.

### 2. Découvrir et Appeler des Outils

Demandez à Claude :

> "Liste les outils disponibles dans STOA, puis appelle l'outil echo avec le message 'hello world'"

Claude découvre vos outils via `tools/list`, appelle `tools/call` et retourne le résultat. C'est tout.

---

## Option B : Python

Utilisez le SDK Python MCP ou du HTTP natif.

### Avec `httpx` (Sans SDK)

```python
import httpx

GATEWAY = "https://mcp.gostoa.dev"
TOKEN = "your-access-token"  # Voir "Obtenir un Token" ci-dessous

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Lister les outils
resp = httpx.post(f"{GATEWAY}/mcp/tools/list", headers=headers, json={})
tools = resp.json()["tools"]
for tool in tools:
    print(f"  {tool['name']}: {tool.get('description', '')}")

# Appeler un outil
resp = httpx.post(
    f"{GATEWAY}/mcp/tools/call",
    headers=headers,
    json={"name": "echo", "arguments": {"message": "hello from Python"}},
)
print(resp.json())
```

### Avec le SDK MCP

```python
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    async with sse_client("https://mcp.gostoa.dev/mcp/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Lister les outils
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"  {tool.name}: {tool.description}")

            # Appeler un outil
            result = await session.call_tool("echo", {"message": "hello"})
            print(result)

import asyncio
asyncio.run(main())
```

> **Installation** : `pip install mcp httpx`

---

## Option C : TypeScript

### Avec `fetch` (Sans SDK)

```typescript
const GATEWAY = "https://mcp.gostoa.dev";
const TOKEN = "your-access-token"; // Voir "Obtenir un Token" ci-dessous

// Lister les outils
const toolsResp = await fetch(`${GATEWAY}/mcp/tools/list`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});
const { tools } = await toolsResp.json();
console.log("Available tools:", tools.map((t: any) => t.name));

// Appeler un outil
const callResp = await fetch(`${GATEWAY}/mcp/tools/call`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "echo",
    arguments: { message: "hello from TypeScript" },
  }),
});
console.log(await callResp.json());
```

### Avec le SDK MCP

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("https://mcp.gostoa.dev/mcp/sse")
);
const client = new Client(
  { name: "my-app", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

await client.connect(transport);

// Lister les outils
const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name));

// Appeler un outil
const result = await client.callTool({
  name: "echo",
  arguments: { message: "hello" },
});
console.log(result);

await client.close();
```

> **Installation** : `npm install @modelcontextprotocol/sdk`

---

## Obtenir un Token

Pour Python/TypeScript (Options B et C), vous avez besoin d'un token d'accès OAuth.

### Rapide : Client Credentials

```bash
TOKEN=$(curl -s -X POST "https://auth.gostoa.dev/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

echo $TOKEN
```

Obtenez votre `CLIENT_ID` et `CLIENT_SECRET` depuis la Console sous **Clés API**.

### Rapide : Clé API SaaS

Si vous avez créé une clé API scopée dans la Console (sous **Clés API**), utilisez-la directement :

```bash
curl -s "https://mcp.gostoa.dev/mcp/tools/list" \
  -H "X-API-Key: stoa_saas_xxxx_your_key_here" | jq
```

Aucun flux OAuth n'est nécessaire — la clé API s'authentifie directement.

---

## Configuration Claude Desktop

Pour utiliser STOA depuis **Claude Desktop** (application locale), ajoutez ceci à votre `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "stoa": {
      "url": "https://mcp.gostoa.dev/mcp/sse"
    }
  }
}
```

Emplacement du fichier de configuration :
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

Redémarrez Claude Desktop après avoir sauvegardé. Vous serez invité à vous authentifier lors de la première utilisation.

---

## Prochaines Étapes

| Objectif | Guide |
|----------|-------|
| Enregistrer votre propre API backend | [Démarrage Rapide](/docs/guides/quickstart#register-your-own-api) |
| Créer des outils MCP personnalisés avec les CRDs | [Développement d'Outils MCP](/docs/guides/mcp-tools-development) |
| Comprendre les détails internes du protocole MCP | [Fiche Protocole MCP](/docs/guides/fiches/mcp-protocol) |
| Auto-héberger STOA sur votre infrastructure | [Déploiement Hybride](/docs/deployment/hybrid) |
| Référence complète de l'API MCP | [API MCP Gateway](/docs/api/mcp-gateway) |

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `401 Unauthorized` | Token expiré (5 min par défaut). Ré-exécutez la commande de token |
| `403 Forbidden` | Votre tenant n'a pas accès à cet outil. Vérifiez les scopes de la clé API |
| La connexion SSE se coupe | Timeout réseau. Le gateway ferme les connexions SSE inactives après 5 min |
| "Aucun outil trouvé" | Aucune API enregistrée dans votre tenant. Enregistrez-en une dans la Console |
| Claude dit "Serveur MCP indisponible" | Vérifiez que l'URL se termine par `/mcp/sse`. Déconnectez et reconnectez dans les Paramètres |
| `ConnectionError` Python | Vérifiez que `httpx` est installé et que l'URL est accessible : `curl https://mcp.gostoa.dev/health` |
