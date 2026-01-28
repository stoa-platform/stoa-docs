---
sidebar_position: 2
---

# MCP Gateway API

Model Context Protocol (MCP) Gateway endpoints and integration.

## Overview

STOA provides native support for the Model Context Protocol (MCP), enabling:

- **Tool Discovery** - Browse available MCP tools
- **Tool Invocation** - Execute tools via MCP protocol
- **Resource Access** - Access MCP resources
- **Prompt Management** - Manage and execute prompts

## Base URL

```
https://mcp.gostoa.dev/v1/{tenant}
```

## Authentication

MCP Gateway uses JWT tokens from Keycloak:

```bash
Authorization: Bearer <access_token>
```

## MCP Protocol

STOA implements MCP specification: [modelcontextprotocol.io](https://modelcontextprotocol.io)

### Transport

Supports both HTTP and WebSocket transports:

- **HTTP**: Request/response for simple invocations
- **WebSocket**: Bidirectional for streaming and notifications

## Tools

### List Available Tools

```http
POST /mcp/tools/list
Content-Type: application/json

{
  "cursor": null
}
```

**Response:**

```json
{
  "tools": [
    {
      "name": "search_database",
      "description": "Search customer database",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          }
        },
        "required": ["query"]
      }
    }
  ],
  "nextCursor": null
}
```

### Invoke Tool

```http
POST /mcp/tools/call
Content-Type: application/json

{
  "name": "search_database",
  "arguments": {
    "query": "customer@example.com"
  }
}
```

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 1 customer matching query..."
    }
  ],
  "isError": false
}
```

## Resources

### List Resources

```http
POST /mcp/resources/list
Content-Type: application/json

{
  "cursor": null
}
```

**Response:**

```json
{
  "resources": [
    {
      "uri": "customer://db/customers/123",
      "name": "Customer Record #123",
      "mimeType": "application/json",
      "description": "Customer database record"
    }
  ]
}
```

### Read Resource

```http
POST /mcp/resources/read
Content-Type: application/json

{
  "uri": "customer://db/customers/123"
}
```

**Response:**

```json
{
  "contents": [
    {
      "uri": "customer://db/customers/123",
      "mimeType": "application/json",
      "text": "{\"id\": 123, \"name\": \"Acme Corp\", ...}"
    }
  ]
}
```

### Subscribe to Resource

```http
POST /mcp/resources/subscribe
Content-Type: application/json

{
  "uri": "customer://db/customers/123"
}
```

## Prompts

### List Prompts

```http
POST /mcp/prompts/list
Content-Type: application/json

{
  "cursor": null
}
```

**Response:**

```json
{
  "prompts": [
    {
      "name": "analyze_customer",
      "description": "Analyze customer behavior",
      "arguments": [
        {
          "name": "customer_id",
          "description": "Customer ID to analyze",
          "required": true
        }
      ]
    }
  ]
}
```

### Get Prompt

```http
POST /mcp/prompts/get
Content-Type: application/json

{
  "name": "analyze_customer",
  "arguments": {
    "customer_id": "123"
  }
}
```

**Response:**

```json
{
  "description": "Analyze customer behavior for customer #123",
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Analyze the behavior of customer #123..."
      }
    }
  ]
}
```

## Sampling (LLM Completion)

STOA can proxy LLM requests for MCP tools:

```http
POST /mcp/sampling/createMessage
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Summarize this customer data..."
      }
    }
  ],
  "maxTokens": 1000,
  "systemPrompt": "You are a helpful customer service assistant."
}
```

**Response:**

```json
{
  "role": "assistant",
  "content": {
    "type": "text",
    "text": "Based on the customer data provided..."
  },
  "model": "claude-3-5-sonnet-20241022",
  "stopReason": "end_turn"
}
```

## WebSocket Connection

For streaming and bidirectional communication:

```javascript
const ws = new WebSocket('wss://mcp.gostoa.dev/v1/acme/ws');

// Authenticate
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    clientInfo: {
      name: 'my-app',
      version: '1.0.0'
    }
  },
  id: 1
}));

// Invoke tool
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'search_database',
    arguments: {
      query: 'customer@example.com'
    }
  },
  id: 2
}));
```

## MCP Server Integration

Register your MCP server with STOA:

```bash
# Register MCP server
stoa mcp register \
  --tenant acme \
  --name customer-tools \
  --url https://tools.acme.com/mcp \
  --transport http
```

**Configuration:**

```json
{
  "name": "customer-tools",
  "url": "https://tools.acme.com/mcp",
  "transport": "http",
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": true
  },
  "auth": {
    "type": "bearer",
    "token": "..."
  }
}
```

## Security

### Tool Permissions

Control which users can invoke which tools:

```bash
stoa mcp permission grant \
  --tenant acme \
  --tool search_database \
  --role customer-service
```

### Resource Access Control

Restrict resource access:

```bash
stoa mcp acl add \
  --tenant acme \
  --resource "customer://db/*" \
  --allow-roles admin,customer-service
```

## Monitoring

### Tool Invocation Metrics

```http
GET /tenants/{tenant_id}/mcp/metrics
  ?start_date=2025-01-01
  &end_date=2025-01-31
```

**Response:**

```json
{
  "tool_invocations": 12453,
  "success_rate": 0.989,
  "avg_latency_ms": 234,
  "top_tools": [
    {
      "name": "search_database",
      "invocations": 8921
    }
  ]
}
```

## MCP Protocol Extensions

STOA extends MCP with:

### Batch Operations

```http
POST /mcp/tools/batch
Content-Type: application/json

{
  "calls": [
    {
      "name": "search_database",
      "arguments": {"query": "user1@example.com"}
    },
    {
      "name": "search_database",
      "arguments": {"query": "user2@example.com"}
    }
  ]
}
```

### Caching

```http
POST /mcp/tools/call
Content-Type: application/json
X-MCP-Cache: max-age=300

{
  "name": "expensive_operation",
  "arguments": {...}
}
```

## Examples

### Python Client

```python
import os
import requests

# Authenticate
auth_response = requests.post(
    'https://auth.gostoa.dev/realms/stoa/protocol/openid-connect/token',
    data={
        'client_id': 'my-app',
        'client_secret': os.environ.get('STOA_CLIENT_SECRET'),
        'grant_type': 'client_credentials'
    }
)
token = auth_response.json()['access_token']

# Invoke MCP tool
response = requests.post(
    'https://mcp.gostoa.dev/v1/acme/mcp/tools/call',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'name': 'search_database',
        'arguments': {'query': 'customer@example.com'}
    }
)

result = response.json()
print(result['content'][0]['text'])
```

### JavaScript Client

```javascript
const response = await fetch('https://mcp.gostoa.dev/v1/acme/mcp/tools/call', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'search_database',
    arguments: {
      query: 'customer@example.com'
    }
  })
});

const result = await response.json();
console.log(result.content[0].text);
```

---

🚧 **Coming Soon**: Server-sent events, progress notifications, and tool composition workflows.
