---
slug: convert-rest-api-to-mcp-tools
title: "How to Convert REST APIs to MCP Tools: A Step-by-Step Guide"
authors: [stoa-team]
tags: [tutorial, mcp, ai, api-gateway]
description: "Learn how to convert your existing REST APIs into MCP tools that AI agents can discover and invoke. Step-by-step guide with OpenAPI mapping examples."
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

# How to Convert REST APIs to MCP Tools: A Step-by-Step Guide

Every REST API endpoint can become an MCP tool that AI agents discover and invoke automatically. The conversion is a mapping exercise: your OpenAPI spec already contains the tool name, description, parameters, and endpoint URL that MCP needs. This guide walks through the process from a single endpoint to bulk automation using ToolSet CRDs.

<!-- truncate -->

:::info Part of the MCP Gateway Series
This article is part of our MCP gateway series. New to MCP? Start with [What is an MCP Gateway?](/blog/what-is-mcp-gateway) for the architecture overview, or try the [MCP Gateway Quickstart with Docker](/blog/mcp-gateway-quickstart-docker) for a hands-on deployment.
:::

## Why Convert REST APIs to MCP Tools?

AI agents like Claude, GPT, and custom LLM-based systems need a structured way to discover and call your APIs. Today, most enterprise APIs are documented with OpenAPI (Swagger) specs — designed for human developers who read documentation, write client code, and handle authentication manually.

MCP tools flip this model. Instead of the developer reading docs, the **agent reads tool definitions** at runtime. Each tool has:

- A **name** and **description** the agent uses to decide when to call it
- An **input schema** the agent uses to construct valid parameters
- An **endpoint** the gateway proxies to on the agent's behalf

The result: AI agents can use your existing REST APIs without custom integration code. You define the mapping once, and every MCP-compatible agent gains access.

## The Concept Mapping: OpenAPI to MCP

Before writing any configuration, understand how OpenAPI concepts map to MCP:

| OpenAPI Concept | MCP Equivalent | Example |
|---|---|---|
| Operation (`GET /users/{id}`) | Tool | `get-user` |
| `operationId` | Tool `name` | `get-user` |
| `summary` / `description` | Tool `description` | "Retrieve a user by ID" |
| `parameters` + `requestBody` | Tool `input_schema` | JSON Schema object |
| Server URL + path | Tool `endpoint` | `https://api.internal/users` |
| `responses.200.content` | Tool output format | JSON response body |
| Security schemes | Gateway auth policy | JWT, API key, mTLS |
| Tags | Tool namespace / tenant | `crm`, `billing` |

The key insight: **your OpenAPI spec is already 80% of the MCP tool definition.** The remaining 20% is gateway configuration — routing, auth, rate limiting — which STOA handles declaratively.

## Step 1: Identify the API Endpoints to Convert

Start with a focused inventory. Not every endpoint makes sense as an AI agent tool:

**Good candidates for MCP tools:**
- Read operations (`GET`) that return structured data — search, list, detail views
- Idempotent write operations (`PUT`, `PATCH`) with clear input schemas
- Stateless actions (`POST`) like "send email", "generate report", "translate text"

**Defer these for now:**
- File upload/download endpoints (binary payloads)
- Long-running async operations (need webhook/polling patterns)
- Admin/destructive endpoints (`DELETE`) — add these only with explicit approval policies

For this tutorial, we'll convert three endpoints from a typical CRM API:

```yaml
# Source OpenAPI spec (excerpt)
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

## Step 2: Create Tool CRD Definitions

Each API endpoint becomes a Tool custom resource. The Tool CRD is the Kubernetes-native way to register MCP tools with STOA.

### Tool 1: Search Contacts

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

### Tool 2: Get Contact by ID

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

### Tool 3: Create Contact

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

Apply the tools to your cluster:

```bash
kubectl apply -f tools/
```

Verify they are registered:

```bash
kubectl get tools -n tenant-acme
```

```
NAME              DISPLAY NAME          METHOD   AGE
search-contacts   Search Contacts       GET      5s
get-contact       Get Contact Details   GET      5s
create-contact    Create Contact        POST     5s
```

For more on the Tool CRD schema, see the [Tool CRD Reference](/docs/reference/crds/tool).

## Step 3: Write Effective Tool Descriptions

The tool description is the single most important field for AI agent usability. Agents use it to decide **when** to call a tool and **how** to construct parameters. A poor description leads to the agent choosing the wrong tool or passing bad parameters.

### Description Best Practices

| Practice | Bad Example | Good Example |
|---|---|---|
| Explain **when** to use | "Gets contacts" | "Search for contacts by name, email, or company. Use this when the user asks to find or look up a contact." |
| Describe **each parameter** | (no descriptions) | `query: "Search term: name, email, or company"` |
| Mention **return format** | (omitted) | "Returns a list of matching contacts with name, email, company, and ID" |
| State **preconditions** | (omitted) | "Use get-contact after search to get full details" |
| Avoid jargon | "Invokes CRM REST endpoint" | "Search for contacts in the customer database" |

### The Three-Sentence Pattern

For most tools, this structure works well:

1. **What it does** — "Search for contacts by name, email, or company."
2. **What it returns** — "Returns a list of matching contacts with their details."
3. **When to use it** — "Use this when the user asks to find or look up a contact."

AI agents process these descriptions at tool discovery time. Clear, actionable descriptions mean better tool selection and fewer failed invocations.

## Step 4: Test with an AI Agent

With tools registered, test them through the MCP gateway. First, verify the gateway can list tools:

```bash
curl -s "${STOA_GATEWAY_URL}/mcp/tools" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Tenant-ID: acme" | jq '.tools[].name'
```

Expected output:

```json
"search-contacts"
"get-contact"
"create-contact"
```

Now invoke a tool directly:

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/search-contacts/invoke" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/json" \
  -d '{"query": "Leanne", "limit": 5}' | jq .
```

The gateway:
1. Validates the request against the input schema
2. Evaluates OPA policies (auth, rate limit)
3. Proxies to `https://crm-api.internal/contacts?query=Leanne&limit=5`
4. Returns the response in MCP format

To test with Claude Desktop, add the gateway as an MCP server in your Claude Desktop configuration:

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

## Step 5: Automate with ToolSet CRDs

Converting endpoints one by one works for a handful of tools, but enterprise APIs can have dozens or hundreds of endpoints. The ToolSet CRD lets you bulk-register tools from an OpenAPI spec.

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

The ToolSet controller:
1. Fetches the OpenAPI spec from the source URL
2. Generates one Tool CRD per matching operation
3. Applies filters to exclude unsafe or irrelevant endpoints
4. Merges overrides for custom descriptions or configuration
5. Reconciles on spec changes (GitOps-friendly)

Apply the ToolSet:

```bash
kubectl apply -f toolset-crm.yaml
```

Check generated tools:

```bash
kubectl get tools -n tenant-acme -l stoa.dev/toolset=crm-api
```

For more on ToolSet CRDs, see the [ToolSet CRD Reference](/docs/reference/crds/toolset).

## Handling Common Patterns

### Path Parameters

REST APIs use path parameters (`/contacts/{id}`). Map them as regular input schema properties — the gateway substitutes them into the URL:

```yaml
endpoint: https://crm-api.internal/contacts/{id}
inputSchema:
  properties:
    id:
      type: string
      description: "Contact ID"
```

### Authentication Passthrough

If your backend API requires its own authentication (separate from the MCP gateway auth), configure credential forwarding in the Tool spec:

```yaml
spec:
  endpoint: https://crm-api.internal/contacts
  auth:
    type: bearer
    tokenSource: gateway  # Use the gateway's service account token
```

### Response Transformation

Some REST APIs return verbose responses that waste agent context window. Use response mappings to trim the output:

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

For endpoints that return paginated results, configure the pagination strategy so agents can request specific pages:

```yaml
spec:
  pagination:
    type: offset
    limitParam: limit
    offsetParam: offset
    defaultLimit: 10
    maxLimit: 100
```

## Security Considerations

Converting REST APIs to MCP tools introduces a new access path — AI agents calling your internal services. Apply defense-in-depth:

1. **Gateway-level auth**: Every tool invocation goes through the MCP gateway's authentication (JWT, API key, or mTLS). See the [authentication guide](/docs/guides/authentication).

2. **OPA policies per tool**: Restrict which tenants can call which tools. A billing tenant should not access CRM tools.

3. **Input validation**: The gateway validates all parameters against the input schema before proxying. Malformed requests never reach your backend.

4. **Rate limiting**: Set per-tenant, per-tool quotas to prevent runaway agents from overwhelming backends.

5. **Audit logging**: Every tool invocation is logged with tenant ID, tool name, parameters, and response status. Essential for compliance (NIS2, DORA, SOC 2).

## Frequently Asked Questions

### Can I convert any REST API to an MCP tool?

Yes, any REST API with a well-defined input/output schema can become an MCP tool. The best candidates are endpoints with clear, typed parameters and structured JSON responses. Endpoints that return binary data (file downloads), require multipart uploads, or use non-standard authentication may need adapter logic. Start with read-only `GET` endpoints and expand to write operations once you've validated the pattern.

### How do I handle APIs that require complex authentication?

The MCP gateway handles agent-facing authentication (validating the agent's JWT or API key). For backend APIs that require their own credentials, configure credential forwarding in the Tool CRD's `auth` section. The gateway can inject bearer tokens, API keys, or mTLS certificates when proxying to your backend. This way, agents never see backend credentials — the gateway manages them securely.

### What's the difference between a Tool CRD and a ToolSet CRD?

A [Tool CRD](/docs/reference/crds/tool) defines a single MCP tool with its endpoint, description, and input schema. A [ToolSet CRD](/docs/reference/crds/toolset) bulk-generates Tool CRDs from an OpenAPI spec. Use Tool CRDs for fine-grained control over individual tools. Use ToolSet CRDs when you want to expose many endpoints from the same API with consistent defaults. ToolSets support filters and overrides to customize the generated tools.

### Do I need to modify my existing REST API?

No. The MCP gateway acts as a reverse proxy — your REST API does not know or care that AI agents are calling it through MCP. The gateway handles protocol translation, authentication, rate limiting, and observability. Your API continues serving its existing clients unchanged while also becoming available to AI agents.

### How does this compare to writing custom MCP servers?

Writing a custom MCP server means implementing the MCP protocol, handling tool discovery, managing authentication, and building observability from scratch — per API. Converting REST APIs to MCP tools via the gateway gives you all of this out of the box. The gateway approach is especially advantageous when you have dozens of APIs to expose, because each one is just a YAML definition rather than a custom server implementation.

## Next Steps

You've learned how to convert REST APIs to MCP tools. Here's where to go next:

- **[MCP Gateway Quickstart](/blog/mcp-gateway-quickstart-docker)** — Deploy a working gateway to test your tools
- **[What is an MCP Gateway?](/blog/what-is-mcp-gateway)** — Understand the architecture and security model
- **[Tool CRD Reference](/docs/reference/crds/tool)** — Full schema documentation for Tool definitions
- **[ToolSet CRD Reference](/docs/reference/crds/toolset)** — Bulk tool generation from OpenAPI specs
- **[Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis)** — Broader patterns for AI agent integration

---

*Ready to expose your APIs to AI agents? [Start with the quickstart guide](/docs/guides/quickstart) or explore the [MCP gateway documentation](/docs/concepts/mcp-gateway).*
