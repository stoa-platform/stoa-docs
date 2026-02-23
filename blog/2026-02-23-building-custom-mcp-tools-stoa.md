---
slug: building-custom-mcp-tools-stoa
title: Building Custom MCP Tools with STOA — Step-by-Step Tutorial
description: Learn how to create, register, and expose custom MCP tools through STOA gateway with this hands-on tutorial featuring code examples and best practices.
authors: [stoa-team]
tags: [tutorial, mcp, ai, api-gateway]
keywords:
  - custom MCP tools
  - STOA gateway tutorial
  - MCP tool development
  - AI agent integration
  - Kubernetes CRD tutorial
  - API gateway for AI
---
<!-- last verified: 2026-02 -->

Custom MCP tools let you expose any API as an AI-native interface that Claude and other AI agents can discover and invoke automatically. This tutorial walks you through creating, registering, and testing a custom MCP tool using the STOA gateway, from initial YAML definition to live invocation by an AI agent.

<!-- truncate -->

## What Are Custom MCP Tools?

The [Model Context Protocol (MCP)](/blog/what-is-mcp-gateway) defines a standard way for AI agents to discover and invoke external tools. Instead of hardcoding API calls or building custom integrations for every service, you define tools as declarative resources that agents can query at runtime.

STOA implements MCP as a Kubernetes-native gateway, meaning your tools are defined as Custom Resource Definitions (CRDs) that live alongside your application manifests. Once registered, these tools become immediately available to any MCP-compatible AI agent [connected to your gateway](/blog/connecting-ai-agents-enterprise-apis).

By the end of this tutorial, you'll have:
- A working MCP tool that wraps a REST API
- Hands-on experience with STOA's Tool CRD
- A test flow showing an AI agent invoking your tool
- Understanding of tool discovery, registration, and execution patterns

## Prerequisites

Before you start, ensure you have:

- **STOA gateway running** — follow the [quickstart guide](/blog/mcp-gateway-quickstart-docker) if you haven't deployed yet
- **kubectl access** to your Kubernetes cluster (or Docker Compose for local dev)
- **Basic YAML knowledge** — tools are defined as Kubernetes manifests
- **A REST API to wrap** — we'll use a public weather API as an example, but you can substitute your own internal API
- **curl or httpie** for testing (optional but recommended)

If you're new to MCP concepts, review our [MCP gateway overview](/docs/concepts/mcp-gateway) first.

## Step 1: Design Your Tool Specification

Every MCP tool needs three things: a unique name, input parameters (the schema), and an endpoint to invoke. Let's design a simple weather lookup tool.

### Example API: OpenWeatherMap

We'll wrap the OpenWeatherMap current weather endpoint:
```
GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}
```

### Tool Design Decisions

1. **Name**: `get_current_weather` — follows MCP naming convention (verb + noun, snake_case)
2. **Input schema**: single required parameter `city` (string)
3. **Output schema**: JSON with `temp`, `description`, `humidity` fields
4. **Authentication**: API key passed via query parameter (handled by STOA's secret injection)

This design maps cleanly to the Tool CRD structure. For complex APIs with multiple operations, consider creating separate tools for each endpoint (see [MCP tools development guide](/docs/guides/mcp-tools-development) for patterns).

## Step 2: Create the Tool CRD Manifest

STOA uses Kubernetes Custom Resource Definitions to manage tools. Here's the complete manifest for our weather tool:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-current
  namespace: default
  labels:
    app: weather-service
    category: external-api
spec:
  displayName: "Get Current Weather"
  description: "Fetch current weather conditions for a city using OpenWeatherMap API"

  # Input schema (JSON Schema format)
  inputSchema:
    type: object
    required:
      - city
    properties:
      city:
        type: string
        description: "City name (e.g., 'Paris', 'New York')"
        minLength: 2
        maxLength: 100

  # Backend API configuration
  endpoint: "https://api.openweathermap.org/data/2.5/weather"
  method: POST

  # Authentication and secrets
  auth:
    type: apiKey
    apiKey:
      location: query
      name: appid
      secretRef:
        name: openweathermap-creds
        key: api-key

  # Request transformation
  requestTransform:
    queryParams:
      - name: q
        valueFrom: "{{.input.city}}"
      - name: units
        value: "metric"

  # Response transformation
  responseTransform:
    template: |
      {
        "temperature": {{.response.main.temp}},
        "description": "{{.response.weather[0].description}}",
        "humidity": {{.response.main.humidity}},
        "city": "{{.response.name}}"
      }
```

### Understanding the Manifest

| Section | Purpose |
|---------|---------|
| `metadata` | Kubernetes identification (name, namespace, labels) |
| `spec.displayName` | Human-readable name shown in MCP tool listings |
| `spec.description` | Helps AI agents understand when to use this tool |
| `spec.inputSchema` | JSON Schema defining required/optional parameters |
| `spec.endpoint` | Backend API URL to invoke |
| `spec.auth` | How to authenticate (apiKey, bearer, oauth2, mtls) |
| `spec.requestTransform` | Map MCP input to API query params, headers, or body |
| `spec.responseTransform` | Extract relevant fields from API response for agent consumption |

The `responseTransform` template uses Go template syntax to shape the API's verbose JSON response into a clean structure the AI agent can easily parse.

## Step 3: Store Secrets and Apply the Manifest

Before applying the Tool CRD, create a Kubernetes Secret for the API key:

```bash
kubectl create secret generic openweathermap-creds \
  --from-literal=api-key=YOUR_API_KEY_HERE \
  -n default
```

Now apply the tool manifest:

```bash
kubectl apply -f weather-tool.yaml
```

Verify the tool was registered:

```bash
kubectl get tools -n default

# Expected output:
# NAME              DISPLAY NAME           ENDPOINT
# weather-current   Get Current Weather    https://api.openweathermap.org/...
```

Check the tool's status:

```bash
kubectl describe tool weather-current -n default
```

The `Status` section shows:
- **Registered**: tool is active and discoverable
- **Endpoint health**: STOA validates the backend is reachable
- **Last invocation**: timestamp of most recent use (initially empty)

If the status shows `Pending` or errors, check STOA gateway logs:

```bash
kubectl logs -n stoa-system deployment/stoa-gateway --tail=50 | grep weather-current
```

## Step 4: Test Tool Discovery

MCP agents discover tools via the `GET /mcp/v1/tools` endpoint. Let's verify your tool appears in the listing:

```bash
curl -s https://mcp.gostoa.dev/mcp/v1/tools | jq '.tools[] | select(.name == "get_current_weather")'
```

Expected response:

```json
{
  "name": "get_current_weather",
  "description": "Fetch current weather conditions for a city using OpenWeatherMap API",
  "inputSchema": {
    "type": "object",
    "required": ["city"],
    "properties": {
      "city": {
        "type": "string",
        "description": "City name (e.g., 'Paris', 'New York')"
      }
    }
  }
}
```

This is the exact payload an MCP client (like Claude) receives when it queries available tools. Notice how the CRD fields map directly to the MCP tool schema.

For more details on the discovery protocol, see our [MCP protocol architecture deep dive](/blog/mcp-protocol-architecture-deep-dive).

## Step 5: Invoke the Tool

Now test the tool invocation flow. MCP tools are invoked via `POST /mcp/v1/tools/{name}/invoke`:

```bash
curl -X POST https://mcp.gostoa.dev/mcp/v1/tools/get_current_weather/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "city": "Paris"
    }
  }' | jq
```

Expected response:

```json
{
  "result": {
    "temperature": 12.5,
    "description": "scattered clouds",
    "humidity": 67,
    "city": "Paris"
  },
  "isError": false
}
```

### What Just Happened?

1. **Agent sent**: `{"city": "Paris"}` to STOA's MCP endpoint
2. **STOA transformed**: input to `GET https://api.openweathermap.org/data/2.5/weather?q=Paris&units=metric&appid=SECRET`
3. **Backend responded**: with verbose JSON including dozens of fields
4. **STOA transformed**: response using the `responseTransform` template, extracting only the 4 fields defined
5. **Agent received**: clean, schema-validated JSON ready for natural language generation

This transformation layer is crucial — it lets you expose complex enterprise APIs with messy schemas as clean, AI-friendly tools. See our guide on [converting REST APIs to MCP tools](/blog/convert-rest-api-to-mcp-tools) for more transformation patterns.

## What You've Built

You now have a production-ready custom MCP tool that:

- **Lives in version control** — the Tool CRD is a YAML file you can commit, review, and track alongside your app code
- **Integrates with Kubernetes RBAC** — use namespaces and role bindings to control which teams can register tools
- **Handles secrets securely** — API keys never appear in manifests or logs
- **Transforms data automatically** — agents get clean responses without knowing the backend API's quirks
- **Scales with your infrastructure** — STOA handles rate limiting, retries, and observability (metrics for every tool invocation)

To connect an AI agent like Claude to your tool, configure the MCP client with your gateway URL (`https://mcp.gostoa.dev`). The agent will automatically discover `get_current_weather` and can invoke it whenever a user asks about weather conditions.

## Advanced Patterns

### Multi-Step Tools

For complex workflows (e.g., "create user, then send email"), use ToolSets to group related tools:

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: user-onboarding
spec:
  tools:
    - toolRef:
        name: create-user
    - toolRef:
        name: send-welcome-email
  executionOrder: sequential
```

### Dynamic Parameters

Use templates in `requestTransform` to derive parameters from context:

```yaml
requestTransform:
  headers:
    - name: X-Tenant-ID
      valueFrom: "{{.context.tenant}}"
    - name: X-Request-ID
      valueFrom: "{{.context.requestId}}"
```

### Response Validation

Add JSON Schema validation to catch malformed backend responses:

```yaml
spec:
  responseSchema:
    type: object
    required: [temperature, city]
    properties:
      temperature:
        type: number
        minimum: -100
        maximum: 100
```

For more advanced patterns, see the [MCP tools reference documentation](/docs/reference/mcp-tools).

## Troubleshooting Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool not appearing in listings | Namespace mismatch or RBAC issue | Check `kubectl get tools -A` and namespace in curl |
| `401 Unauthorized` on invoke | Secret not mounted or wrong key name | Verify secret exists: `kubectl get secret openweathermap-creds -o yaml` |
| Invocation times out | Backend unreachable or slow | Add `spec.timeout: 30s` to Tool manifest |
| Empty or malformed response | Transform template error | Check gateway logs for template parse errors |
| Tool registered but not invokable | Backend API changed | Update `endpoint` or `responseTransform` |

## FAQ

### Can I wrap internal APIs behind firewalls?

Yes. STOA runs inside your Kubernetes cluster, so tools can reference internal service names (e.g., `http://user-service.prod.svc.cluster.local`). For APIs outside the cluster, ensure the STOA gateway pod has network access. Use mTLS authentication for secure internal communication.

### How do I version tools when APIs change?

Use the tool name as a version identifier (e.g., `weather-v1`, `weather-v2`). Agents can specify which version to invoke. Alternatively, update the existing tool and rely on STOA's schema validation to catch breaking changes. For production systems, consider blue/green deployments where both versions run simultaneously during migration.

### What authentication methods are supported?

STOA supports API key (query, header, or cookie), Bearer token, OAuth 2.0 client credentials, and mutual TLS (mTLS). For OAuth, STOA can handle token refresh automatically using a `TokenSource` CRD. See the [MCP getting started guide](/docs/guides/mcp-getting-started) for authentication examples.

## Next Steps

Now that you've built your first custom MCP tool, explore these resources:

- **[What is an MCP Gateway?](/blog/what-is-mcp-gateway)** — understand the architecture and design principles
- **[Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis)** — production deployment patterns and security best practices
- **[MCP Gateway Quickstart with Docker](/blog/mcp-gateway-quickstart-docker)** — local development setup for rapid iteration
- **[MCP Tools Development Guide](/docs/guides/mcp-tools-development)** — comprehensive reference covering all CRD fields and transformation patterns

For questions or to share what you've built, join the discussion on [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions) or open an issue if you hit a snag. The STOA community is here to help you bridge the gap between traditional APIs and the AI-native future.
