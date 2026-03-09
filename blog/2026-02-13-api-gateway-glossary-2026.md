---
slug: api-gateway-glossary-2026
title: "API Gateway Glossary: 30 Terms Every Developer Should Know"
description: "From API key to zero trust, 30 essential gateway terms defined. Authentication, MCP, mTLS, rate limiting, and modern concepts explained clearly."
authors: [stoa-team]
tags: [education, architecture]
keywords: [API gateway glossary, API gateway terms, MCP glossary, API management terms, authentication glossary, authorization terms, circuit breaker, rate limiting, mTLS, API gateway vocabulary, gateway concepts, API security terms]
---

# API Gateway Glossary 2026: 30 Terms Every Developer Should Know

The API gateway landscape has evolved rapidly with the rise of AI agents, zero-trust architectures, and hybrid deployments. This glossary defines 30 essential terms every developer should know when working with modern API gateways in 2026.

<!-- truncate -->

<!-- last verified: 2026-02 -->

Whether you're migrating from a legacy gateway, evaluating new solutions, or building AI-native integrations, understanding these concepts is critical. We've included practical context on how modern platforms like STOA handle each capability.

For a comprehensive introduction to MCP-specific terminology and architecture, see our guide: [What is an MCP Gateway?](/blog/what-is-mcp-gateway)

---

### API Gateway

An API gateway is a server that sits between clients and backend services, acting as a reverse proxy to route requests, enforce policies, and provide cross-cutting capabilities like authentication, rate limiting, and observability. Modern gateways also support AI-specific protocols like MCP alongside traditional REST and gRPC. STOA Platform extends the traditional gateway model with a [Universal API Contract (UAC)](/docs/concepts/uac) that enables "define once, expose everywhere" across multiple gateway backends.

### API Key

An API key is a simple token-based authentication mechanism where clients include a pre-shared secret in request headers (typically `X-API-Key` or `Authorization: Bearer <key>`). While easy to implement, API keys lack expiration, revocation, and user context, making them suitable only for server-to-server scenarios with tight access controls. STOA supports API key authentication for gateway registration and internal service-to-service calls.

### Authentication

Authentication is the process of verifying the identity of a user or service making an API request. Common methods include API keys, OAuth 2.0, JWT tokens, and mTLS. Modern gateways often delegate authentication to identity providers like Keycloak or Auth0 via OpenID Connect. [STOA's authentication model](/docs/guides/authentication) supports multi-tenant identity federation with role-based access control.

### Authorization

Authorization determines what actions an authenticated user or service is permitted to perform. This is typically enforced through role-based access control (RBAC), attribute-based access control (ABAC), or policy engines like OPA. Authorization happens after authentication and is critical for implementing zero-trust architectures. STOA uses Keycloak-based RBAC with four persona roles: `cpi-admin`, `tenant-admin`, `devops`, and `viewer`.

### Circuit Breaker

A circuit breaker is a resilience pattern that prevents cascading failures by temporarily blocking requests to unhealthy upstream services. When error rates exceed a threshold, the circuit "opens" and requests fail fast instead of timing out. After a cooldown period, the circuit enters a "half-open" state to test recovery. STOA Gateway implements [per-upstream circuit breakers](/docs/architecture/adr/adr-032-response-transformation) with configurable thresholds and automatic zombie reaping.

### CORS

Cross-Origin Resource Sharing (CORS) is a browser security mechanism that controls which web origins can access an API. Gateways handle CORS preflight requests (`OPTIONS`) and inject appropriate headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`). Misconfigured CORS is a common source of production issues. STOA's Control Plane UI includes CORS headers configured for browser-based access from the Portal and Console.

### DORA

The Digital Operational Resilience Act (DORA) is an EU regulation (in force January 2025) requiring financial entities to implement ICT risk management, incident reporting, and third-party risk controls. API gateways play a role in DORA compliance through observability, audit logging, and operational resilience features like circuit breakers. STOA provides [technical capabilities that support DORA alignment](/blog/dora-nis2-api-gateway-compliance), including error snapshot logging and multi-region deployment options.

### gRPC

gRPC is a high-performance RPC framework using Protocol Buffers for serialization and HTTP/2 for transport. Modern gateways support gRPC-to-REST transcoding, allowing HTTP/JSON clients to call gRPC backends. gRPC is popular for microservices communication but requires schema coordination. STOA's gateway architecture supports gRPC endpoints alongside REST and MCP.

### JSON-RPC

JSON-RPC is a lightweight remote procedure call protocol encoded in JSON, commonly used by AI agent frameworks and blockchain APIs. Unlike REST, JSON-RPC uses a single endpoint with a `method` field to identify operations. The Model Context Protocol (MCP) uses JSON-RPC 2.0 over stdio, HTTP, and SSE transports. STOA's MCP Gateway translates RESTful APIs into JSON-RPC for agent consumption.

### JWT

JSON Web Tokens (JWT) are signed, self-contained tokens that carry user identity and claims. Gateways validate JWT signatures and extract claims for authorization decisions. JWTs are stateless, enabling horizontal scaling, but require careful key management and expiration handling. STOA uses Keycloak-issued JWTs for both Control Plane API and Portal access, with realm-scoped validation.

### Keycloak

Keycloak is an open-source identity and access management (IAM) solution supporting OIDC, SAML, and LDAP federation. It's widely used as the authentication layer for API gateways. STOA Platform uses [Keycloak for multi-tenant authentication](/docs/guides/authentication) with tenant-scoped realms and federation to external identity providers.

### MCP (Model Context Protocol)

The Model Context Protocol (MCP) is an open standard created by Anthropic for connecting AI agents to external tools and data sources. MCP uses JSON-RPC 2.0 and defines three primitives: tools (actions), resources (data), and prompts (templates). STOA's [MCP Gateway](/docs/concepts/mcp-gateway) exposes RESTful APIs as MCP tools, enabling AI agents to call legacy systems without custom integration code.

### mTLS

Mutual TLS (mTLS) is a security pattern where both client and server authenticate each other using X.509 certificates. Unlike traditional TLS (server-only authentication), mTLS provides strong client identity, making it ideal for zero-trust architectures and service mesh communication. STOA supports [mTLS for gateway-to-backend connections](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) with certificate lifecycle management.

### Multi-Tenancy

Multi-tenancy is the ability to serve multiple independent customers (tenants) from a single platform instance while maintaining data isolation. Gateways enforce tenant boundaries through namespaces, RBAC, and quota controls. STOA's [multi-tenant architecture](/docs/concepts/multi-tenant) uses Kubernetes namespaces and Keycloak realms to isolate tenant resources.

### NIS2

The Network and Information Security Directive 2 (NIS2) is an EU cybersecurity law (in force October 2024) requiring essential and important entities to implement risk management, incident reporting, and supply chain security. API gateways contribute to NIS2 compliance through security logging, access controls, and SBOM generation. STOA generates CycloneDX and SPDX SBOMs for all components.

### OPA (Open Policy Agent)

Open Policy Agent (OPA) is a policy engine that enables declarative, fine-grained authorization using the Rego language. Gateways use OPA to enforce complex policies based on request attributes, user roles, and external data. STOA's MCP Gateway includes OPA integration for policy-driven tool access control.

### OpenAPI

OpenAPI (formerly Swagger) is a standard for describing RESTful APIs using YAML or JSON. Gateways use OpenAPI specs for validation, documentation generation, and automated onboarding. STOA's [Universal API Contract (UAC)](/docs/concepts/uac) extends OpenAPI with gateway-specific metadata for quota, caching, and transformation rules.

### Rate Limiting

Rate limiting controls the number of requests a client can make within a time window, protecting backends from overload and enforcing fair usage. Common strategies include token bucket, leaky bucket, and sliding window. STOA implements [per-consumer quota enforcement](/docs/guides/subscriptions) with limits stored in the Control Plane database and enforced at the gateway.

### RBAC

Role-Based Access Control (RBAC) assigns permissions to roles (e.g., `admin`, `developer`, `viewer`) rather than individual users. Gateways enforce RBAC by validating JWT claims or querying identity providers. STOA uses a [four-role RBAC model](/docs/guides/authentication) aligned with typical enterprise personas.

### REST

Representational State Transfer (REST) is an architectural style for APIs using HTTP methods (GET, POST, PUT, DELETE) and resource-based URLs. REST APIs are stateless, cacheable, and use standard HTTP status codes. Despite the rise of GraphQL and gRPC, REST remains the dominant API paradigm. STOA's gateway supports RESTful backends with OpenAPI-driven onboarding.

### Reverse Proxy

A reverse proxy sits in front of backend services, forwarding client requests and returning responses. Unlike a forward proxy (which serves clients), a reverse proxy serves servers. API gateways are specialized reverse proxies with additional capabilities like authentication, rate limiting, and protocol translation. STOA Gateway uses axum and Tokio for high-performance reverse proxying.

### SBOM

A Software Bill of Materials (SBOM) is a formal list of components, libraries, and dependencies in a software artifact. SBOMs are critical for supply chain security and vulnerability management. STOA generates CycloneDX and SPDX SBOMs for all container images and publishes them to GitHub release artifacts.

### Service Mesh

A service mesh is an infrastructure layer that handles service-to-service communication, observability, and security in microservices architectures. Popular meshes like Istio and Linkerd use sidecar proxies. Service meshes overlap with API gateways but focus on east-west (internal) traffic rather than north-south (external) traffic. STOA supports [sidecar deployment mode](/docs/architecture/adr/adr-024-gateway-unified-modes) for service mesh integration.

### SSE (Server-Sent Events)

Server-Sent Events (SSE) is an HTTP-based protocol for server-to-client streaming over a single long-lived connection. Unlike WebSockets (bidirectional), SSE is unidirectional and uses text/event-stream content type. The MCP protocol supports SSE as a transport option for real-time tool updates. STOA's MCP Gateway implements SSE for streaming tool responses.

### TLS

Transport Layer Security (TLS) is the cryptographic protocol that secures HTTP traffic (HTTPS). Gateways terminate TLS connections, offloading encryption from backend services. Modern deployments use TLS 1.3 with automated certificate management via Let's Encrypt or cert-manager. STOA uses cert-manager with ClusterIssuers for automated TLS certificate lifecycle.

### Token Metering

Token metering tracks API usage for AI models, which charge per token (input + output) rather than per request. Gateways intercept responses, extract token counts, and emit metering events to billing systems. STOA's metering pipeline (future roadmap) will support token-based pricing for MCP tool calls.

### Tool Discovery

Tool discovery is the MCP mechanism for clients to enumerate available tools at runtime. Gateways expose a `tools/list` endpoint that returns JSON-RPC tool definitions, enabling AI agents to adapt to changing backend capabilities without code changes. STOA's [MCP Gateway](/docs/concepts/mcp-gateway) dynamically generates tool lists from UAC-defined APIs.

### UAC (Universal API Contract)

The Universal API Contract (UAC) is STOA's core concept: a single YAML definition that describes an API and its gateway policies. UAC extends OpenAPI with quota, caching, transformation, and observability rules. One UAC can deploy to Kong, Gravitee, Envoy, or STOA Gateway, eliminating vendor lock-in. See [UAC documentation](/docs/concepts/uac) for details.

### WebSocket

WebSocket is a bidirectional, full-duplex protocol over TCP, commonly used for real-time applications like chat and live dashboards. Unlike HTTP (request-response), WebSocket maintains an open connection. Gateways handle WebSocket upgrades and proxy messages between clients and backends. MCP supports WebSocket as a transport option (future spec). STOA Gateway's architecture supports WebSocket proxying via axum's upgrade handling.

### Zero Trust

Zero Trust is a security model that assumes no network boundary is trustworthy. Every request must be authenticated, authorized, and encrypted, regardless of origin. API gateways are central to zero-trust architectures, enforcing mTLS, JWT validation, and policy-based access control. STOA's [mTLS module](/docs/architecture/adr/adr-039-mtls-cert-bound-tokens) and OPA integration support zero-trust deployments.

---

## Frequently Asked Questions

### What scope does this glossary cover?

This glossary focuses on modern API gateway concepts essential for 2026 deployments, including traditional patterns (REST, authentication, rate limiting) and emerging technologies (MCP, AI agents, zero-trust architectures). It intentionally excludes deprecated patterns (SOAP, WS-Security) and vendor-specific terminology. For migration from legacy platforms, see the [API Gateway Migration Guide](/blog/api-gateway-migration-guide-2026).

### Where can I learn more about MCP-specific terminology?

For deeper coverage of Model Context Protocol concepts like tool discovery, JSON-RPC transport, and AI agent authentication, see our comprehensive guide: [What is an MCP Gateway?](/blog/what-is-mcp-gateway). That article covers MCP architecture, use cases, and how STOA implements MCP natively.

### What other resources complement this glossary?

After understanding the terminology, explore practical implementation patterns in our [Open Source API Gateway Comparison 2026](/blog/open-source-api-gateway-2026), which compares Kong, Tyk, Gravitee, APISIX, and STOA across features, performance, and deployment models. For hands-on learning, follow the [MCP Gateway Quickstart](/blog/mcp-gateway-quickstart-docker) to deploy a working gateway in 10 minutes.

---

## Further Reading

- [API Gateway Migration Guide 2026](/blog/api-gateway-migration-guide-2026) — comprehensive migration hub
- [API Gateway Patterns](https://docs.gostoa.dev/docs/guides/fiches/api-gateway-patterns) — technical implementation patterns
- [MCP Gateway Concepts](/blog/what-is-mcp-gateway) — how STOA bridges legacy APIs and AI agents
- [Open Source API Gateway Comparison 2026](/blog/open-source-api-gateway-2026) — Kong, Tyk, Gravitee, APISIX, and STOA

---

*Christophe Aboulicam is the Founder & CTO at HLFH, building STOA Platform to bring AI-native API management to European enterprises.*
