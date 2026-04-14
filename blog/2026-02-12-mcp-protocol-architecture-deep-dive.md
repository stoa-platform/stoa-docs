---
slug: mcp-protocol-architecture-deep-dive
title: "MCP Protocol Deep Dive: Message Flow and Transports"
authors: [stoa-team]
tags: [tutorial, mcp, architecture, ai]
description: "How MCP actually works under the hood. Protocol layers, JSON-RPC message flow, SSE vs stdio transport, and how it compares to gRPC and GraphQL."
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

# MCP Protocol Deep Dive: Architecture, Message Flow, and Transport Layers

The Model Context Protocol (MCP) is a JSON-RPC 2.0 based protocol that standardizes how AI agents discover, authenticate with, and invoke external tools. It defines four phases — initialization, discovery, invocation, and streaming — over pluggable transports including SSE, WebSocket, and stdio. This article covers the protocol internals that matter for production deployments.

<!-- truncate -->

:::info Part of the MCP Gateway Series
This is a technical deep dive for engineers building on MCP. For a higher-level introduction, start with [What is an MCP Gateway?](/blog/what-is-mcp-gateway). For a hands-on deployment, see [MCP Gateway Quickstart with Docker](/blog/mcp-gateway-quickstart-docker).
:::

## Protocol Architecture Overview

MCP is built on three architectural principles:

1. **Client-server model**: MCP clients (AI agents) connect to MCP servers (tool providers). A single client can connect to multiple servers.
2. **JSON-RPC 2.0 foundation**: All messages follow the JSON-RPC 2.0 specification — request/response pairs with `method`, `params`, and `result`/`error` fields.
3. **Pluggable transport**: The protocol is transport-agnostic. The same JSON-RPC messages can flow over HTTP+SSE, WebSocket, or stdio pipes.

### Protocol Stack

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

Each layer is independently replaceable. You can swap transports without changing tool definitions. You can add security layers without modifying the protocol messages. This separation is what makes MCP suitable for both local development (stdio) and production enterprise deployments (HTTP+SSE with mTLS).

## The Four Phases of an MCP Session

Every MCP client-server interaction follows four phases:

### Phase 1: Initialization

The client establishes a connection and negotiates capabilities:

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

**Key points:**
- `protocolVersion` ensures client and server agree on the MCP spec version
- `capabilities` negotiation tells each side what features the other supports
- The `initialized` notification signals that the client is ready to begin discovery
- If capabilities don't match, the client can downgrade or disconnect

### Phase 2: Discovery

The client enumerates available tools, resources, and prompts:

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

Discovery is dynamic — the agent calls `tools/list` at runtime, not at build time. This is fundamentally different from static API documentation. The server can return different tool lists based on the client's identity, tenant, or environment.

An MCP gateway adds a policy layer here: the `tools/list` response is filtered per-tenant. Tenant A sees only CRM tools. Tenant B sees only billing tools. Both connect to the same gateway endpoint.

### Phase 3: Invocation

The client calls a tool with typed parameters:

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

**Key points:**
- `arguments` are validated against the tool's `inputSchema` before execution
- Results are returned as `content` arrays, supporting multiple content types (text, image, resource)
- `isError: true` signals a tool execution error (not a protocol error — protocol errors use JSON-RPC error responses)
- The gateway proxies `tools/call` to the backend REST API, translating MCP format to HTTP and back

### Phase 4: Streaming (Server-Sent Events)

For long-running operations, MCP supports streaming responses via notifications:

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

Streaming is essential for enterprise workloads: batch data processing, report generation, and multi-step workflows all benefit from progress updates rather than blocking until completion.

## Transport Layer Options

MCP is transport-agnostic. The same JSON-RPC messages can flow over different transport mechanisms depending on the deployment context.

### HTTP + Server-Sent Events (SSE)

The most common transport for production MCP deployments:

```
Client ──HTTP POST──→ Server (request)
Client ←──SSE────── Server (response stream)
```

**How it works:**
1. Client sends JSON-RPC requests as HTTP POST to the server's message endpoint
2. Server streams responses back over a persistent SSE connection
3. Multiple requests can be in-flight simultaneously on the same SSE connection

**Advantages:**
- Works through HTTP proxies, load balancers, CDNs, and firewalls
- Uni-directional streaming (server to client) is well-supported by all infrastructure
- Easy to add authentication headers (Bearer tokens, API keys)
- Compatible with existing HTTP monitoring and logging tools

**Limitations:**
- Server-to-client streaming only (client uses POST for requests)
- SSE connections can be dropped by aggressive proxies (configure timeouts)
- No binary frame support (everything is UTF-8 text)

**Recommended for:** Production deployments behind API gateways, cloud environments, enterprise networks.

### Streamable HTTP (2025-03 spec)

The latest MCP specification introduces Streamable HTTP as a simplified transport:

```
Client ──HTTP POST──→ Server
  (request in body, response streamed back on same connection)
```

**How it works:**
1. Client sends a JSON-RPC request as HTTP POST
2. Server responds with `Content-Type: text/event-stream` for streaming, or `application/json` for single responses
3. The server can optionally include a `Mcp-Session-Id` header for session affinity

**Advantages:**
- Simpler than SSE (no separate event stream endpoint)
- Session management via headers (not URL paths)
- Supports both streaming and non-streaming responses
- Better alignment with standard HTTP semantics

**Best for:** New implementations targeting the 2025-03 spec.

### WebSocket

Bi-directional, full-duplex communication:

```
Client ←──WebSocket──→ Server (bidirectional)
```

**How it works:**
1. Client establishes a WebSocket connection (HTTP upgrade)
2. Both sides can send JSON-RPC messages at any time
3. Server can push notifications without client polling

**Advantages:**
- True bi-directional communication
- Lower latency for high-frequency interactions
- Server-initiated notifications without polling

**Limitations:**
- WebSocket connections are harder to load-balance (sticky sessions needed)
- Some enterprise firewalls and proxies block WebSocket upgrades
- More complex to debug than HTTP (no standard request/response logging)

**Best for:** Real-time applications, low-latency tool invocations, bi-directional notification patterns.

### stdio (Standard I/O)

Process-level communication via stdin/stdout pipes:

```
Client ──stdin──→ Server Process
Client ←──stdout── Server Process
```

**How it works:**
1. Client spawns the MCP server as a child process
2. JSON-RPC messages are written to the process's stdin
3. Responses are read from the process's stdout
4. One message per line (newline-delimited JSON)

**Advantages:**
- Zero network configuration — works offline
- Process-level isolation and lifecycle management
- Simplest transport to implement

**Limitations:**
- Single-machine only (no network access)
- One client per server process
- No built-in authentication (process-level trust)

**Best for:** Local development, IDE integrations (VS Code, Claude Desktop), CLI tools.

### Transport Comparison

| Feature | HTTP+SSE | Streamable HTTP | WebSocket | stdio |
|---|---|---|---|---|
| Direction | Client→POST, Server→SSE | Bidirectional via HTTP | Full duplex | Bidirectional via pipes |
| Infrastructure | Standard HTTP stack | Standard HTTP stack | WebSocket-aware LB | Local process |
| Auth | HTTP headers | HTTP headers | Initial handshake | Process-level trust |
| Streaming | Server→Client | Both | Both | Both |
| Firewall-friendly | Yes | Yes | Sometimes blocked | N/A (local) |
| Load balancing | Standard HTTP | Standard HTTP | Sticky sessions | N/A |
| Best for | Production APIs | New implementations | Real-time apps | Local dev/IDEs |

## Security Model

MCP's security model operates at multiple layers:

### Transport Security

All production MCP deployments should use TLS. The protocol itself does not mandate TLS, but without it, JSON-RPC messages (including tool arguments and results) travel in plaintext.

```
Client ──TLS 1.3──→ MCP Gateway ──mTLS──→ Backend Service
```

### Authentication

MCP does not define its own authentication mechanism. Instead, it relies on the transport layer:

- **HTTP transports**: Bearer tokens (JWT), API keys, or client certificates in HTTP headers
- **WebSocket**: Authentication during the HTTP upgrade handshake
- **stdio**: Process-level trust (the client controls which server it spawns)

An MCP gateway centralizes authentication. Instead of each MCP server implementing its own auth, the gateway validates credentials once and forwards authenticated requests to backend servers.

### Authorization

MCP's `capabilities` negotiation provides coarse-grained feature control, but fine-grained authorization (which tools can this tenant call?) is the gateway's responsibility.

STOA implements this with OPA policies evaluated at two points:

1. **Discovery time**: `tools/list` responses are filtered per-tenant. Unauthorized tools are never shown.
2. **Invocation time**: `tools/call` requests are evaluated against per-tenant, per-tool policies before proxying.

This prevents both direct tool access and enumeration attacks (where an agent discovers tools it shouldn't know about).

### Audit

Every MCP interaction should be logged for compliance:

| Event | What to Log | Why |
|---|---|---|
| `initialize` | Client identity, protocol version | Track which agents connect |
| `tools/list` | Tenant ID, tools returned | Audit tool discovery |
| `tools/call` | Tenant, tool, arguments, result status | Full invocation audit trail |
| Error | Error type, tenant, context | Incident investigation |

MCP gateways produce these audit events automatically. Raw MCP servers require custom instrumentation.

## MCP Compared to Other Protocols

### MCP vs gRPC

| Aspect | MCP | gRPC |
|---|---|---|
| Purpose | AI agent ↔ tool communication | Service-to-service RPC |
| Schema | JSON Schema (runtime discovery) | Protobuf (compile-time code generation) |
| Discovery | Dynamic (`tools/list` at runtime) | Static (proto files, service reflection) |
| Transport | HTTP+SSE, WebSocket, stdio | HTTP/2 |
| Streaming | SSE or WebSocket | Bidirectional HTTP/2 streams |
| Ecosystem | AI agents, LLM frameworks | Microservices, cloud infrastructure |
| Binary support | Text-based (JSON) | Native binary (Protobuf) |

**When to use MCP**: AI agent integration, dynamic tool discovery, multi-tenant tool access.
**When to use gRPC**: High-performance service-to-service communication, strict schemas, binary payloads.

MCP and gRPC are complementary. An MCP gateway can proxy tool invocations to gRPC backends — the agent sees MCP tools, the backend serves gRPC.

### MCP vs GraphQL

| Aspect | MCP | GraphQL |
|---|---|---|
| Purpose | AI agent tool invocation | Client-driven data querying |
| Schema | Per-tool JSON Schema | Unified type system |
| Query model | Tool call (function invocation) | Declarative query (ask for fields) |
| Discovery | `tools/list` enumeration | Schema introspection |
| Streaming | Progress notifications | Subscriptions |
| Auth model | Per-tool policies | Per-field resolvers |

**When to use MCP**: AI agents that need to call functions (search, create, update).
**When to use GraphQL**: Clients that need flexible data querying with field-level control.

Again, these are complementary. An MCP tool can internally execute a GraphQL query against a backend.

### MCP vs OpenAI Function Calling

| Aspect | MCP | OpenAI Function Calling |
|---|---|---|
| Standard | Open (Anthropic + community) | Proprietary (OpenAI) |
| Discovery | Runtime (`tools/list`) | Compile-time (function schemas in API call) |
| Transport | Multiple (SSE, WS, stdio) | OpenAI API only |
| Multi-tenant | Built into protocol | Application-level |
| Vendor lock-in | None | OpenAI ecosystem |

For a detailed comparison, see [MCP vs OpenAI Function Calling vs LangChain Tools](/blog/mcp-vs-openai-function-calling-vs-langchain).

## Building an MCP Server: Minimal Example

To understand the protocol concretely, here's a minimal MCP server in Python (stdio transport):

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

# stdio transport: read JSON-RPC from stdin, write to stdout
for line in sys.stdin:
    request = json.loads(line.strip())
    result = handle_request(request)
    response = {"jsonrpc": "2.0", "id": request.get("id"), "result": result}
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()
```

This 40-line server implements the full MCP lifecycle: initialization, discovery, and tool invocation. In production, you would use an MCP SDK and deploy behind a gateway — but the protocol is simple enough to implement from scratch.

## Production Considerations

### Connection Lifecycle

MCP sessions are long-lived. An AI agent may maintain a connection for hours or days. Plan for:

- **Reconnection**: Clients should handle dropped connections gracefully and re-initialize
- **Session state**: Avoid server-side session state if possible (stateless tool invocations scale better)
- **Heartbeats**: Use SSE comments (`:ping`) or WebSocket ping frames to detect dead connections

### Scalability

MCP gateways handle tool invocations as proxied HTTP requests — they scale the same way any reverse proxy scales:

- Horizontal scaling with Kubernetes replicas
- Connection pooling to backend services
- Stateless request handling (no session affinity needed for HTTP+SSE)

### Error Handling

MCP distinguishes between protocol errors and tool errors:

- **Protocol errors**: Invalid JSON-RPC, unknown method, malformed params → JSON-RPC error response
- **Tool errors**: Backend returned 500, timeout, validation failure → `tools/call` result with `isError: true`

The gateway should never expose backend error details (stack traces, internal URLs) to the client. Log them server-side and return sanitized error messages.

## Frequently Asked Questions

### What version of MCP should I target?

Target the `2025-03` protocol version, which includes Streamable HTTP transport and improved capability negotiation. The protocol is backward-compatible — a server supporting `2025-03` can negotiate down to `2024-11` with older clients. Check the [official MCP specification](https://modelcontextprotocol.io) for the latest version.

### Can MCP handle binary data (files, images)?

MCP content types include `text` and `image` (base64-encoded). For large binary payloads, the recommended pattern is to return a URL or resource reference that the client can fetch separately, rather than embedding binary data in the JSON-RPC response. The `resources/read` method supports this pattern natively.

### How does MCP handle authentication across multiple servers?

Each MCP server (or gateway) handles its own authentication independently. A client connecting to multiple MCP servers manages separate credentials per connection. An MCP gateway simplifies this by providing a single authenticated endpoint that routes to multiple backend servers — the client authenticates once with the gateway.

### Is MCP suitable for high-throughput workloads?

MCP adds minimal overhead to tool invocations — the JSON-RPC envelope is a few hundred bytes. The gateway's proxying latency depends on the transport and backend. STOA's Rust-based gateway adds sub-millisecond latency per invocation. For bulk operations, consider batch tool invocations or streaming responses rather than high-frequency individual calls. See our [gateway performance benchmarks](/blog/stoa-gateway-performance-benchmarks) for measured latencies.

## Further Reading

- [What is an MCP Gateway?](/blog/what-is-mcp-gateway) — Why AI agents need a gateway layer
- [OAuth 2.1 + PKCE for MCP Gateways](/blog/oauth-pkce-mcp-gateway) — Complete OAuth flow for MCP clients
- [Convert REST APIs to MCP Tools](/blog/convert-rest-api-to-mcp-tools) — Practical guide to exposing your APIs
- [Connecting AI Agents to Enterprise APIs](/blog/connecting-ai-agents-enterprise-apis) — Enterprise integration patterns
- [ESB is Dead, Long Live MCP](/blog/esb-is-dead-long-live-mcp) — How MCP replaces traditional integration middleware
- [MCP Gateway Concepts](/docs/concepts/mcp-gateway) — STOA's gateway architecture
- [Official MCP Specification](https://modelcontextprotocol.io) — The protocol source of truth

---

*Building on MCP? [Start with the quickstart guide](/docs/guides/quickstart) to deploy a working gateway, or explore the [MCP gateway documentation](/docs/concepts/mcp-gateway) for architecture details.*
