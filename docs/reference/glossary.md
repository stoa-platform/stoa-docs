---
sidebar_position: 20
title: "Glossary / Glossaire"
description: "Bilingual glossary of key terms used across STOA Platform documentation — English definitions with official French translations."
keywords: [glossary, glossaire, terminology, API gateway, MCP, UAC, Kubernetes]
---

# Glossary / Glossaire

Bilingual reference for key terms used throughout STOA documentation. Each entry provides the English term, its French translation, and a concise definition.

:::tip For translators
When translating STOA documentation to French, always use the **FR Term** column as the canonical translation. Do not invent new translations for established terms.
:::

## A

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Access Token** | Jeton d'accès | Short-lived credential (JWT) issued by Keycloak after authentication. Used in `Authorization: Bearer` headers. |
| **Adapter** | Adaptateur | Component that translates UAC definitions into a specific gateway's native format (Kong YAML, Apigee proxy, etc.). See [Gateway Adapters](/docs/guides/console#gateway-adapters). |
| **Agent** | Agent (IA) | An AI system (e.g., Claude, GPT) that invokes tools via MCP to perform tasks autonomously. |
| **API Contract** | Contrat d'API | See **UAC (Universal API Contract)**. |
| **API Key** | Clé d'API | Static credential used by consumers to authenticate API calls. Managed via subscriptions. |
| **Application** | Application | A consumer entity registered on the platform that holds credentials and subscriptions. |
| **ArgoCD** | ArgoCD | GitOps continuous delivery tool. Syncs Kubernetes manifests from Git to the cluster. |

## C

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Claim** | Claim (JWT) | A key-value pair embedded in a JWT token (e.g., `tenant_id`, `roles`, `scope`). |
| **Client Credentials** | Identifiants client | OAuth 2.0 grant type for machine-to-machine authentication (no user interaction). |
| **Consumer** | Consommateur | An entity (person, team, or application) that subscribes to and consumes APIs through the platform. |
| **Control Plane** | Plan de contrôle | The centralized management layer of STOA — API, Console UI, and Portal. Runs in the cloud or on-premise. |
| **CRD (Custom Resource Definition)** | CRD (Définition de ressource personnalisée) | Kubernetes extension mechanism. STOA uses CRDs for `Tool` and `ToolSet` resources. |

## D

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Data Plane** | Plan de données | The runtime layer where API traffic flows — gateways, proxies, sidecars. Typically on-premise. |
| **Deployment Mode** | Mode de déploiement | One of 4 gateway modes: edge-mcp, sidecar, proxy, shadow. See [Gateway Modes](/docs/concepts/gateway). |

## E

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Edge-MCP** | Edge-MCP | Primary gateway mode for AI agent integration via MCP protocol. Production-ready. |
| **Endpoint** | Point d'entrée | A URL where an API or tool is accessible (e.g., `https://api.example.com/v1/users`). |

## G

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Gateway** | Passerelle | The runtime component that routes, authenticates, and applies policies to API/MCP traffic. |
| **Gateway Adapter** | Adaptateur de passerelle | See **Adapter**. |
| **GitOps** | GitOps | Operational model where Git is the single source of truth. STOA uses ArgoCD for GitOps delivery. |

## I

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **IdP (Identity Provider)** | Fournisseur d'identité | External authentication source (Google, GitHub, SAML) federated into Keycloak. |
| **Isolation** | Isolation | Separation between tenants at network, namespace, identity, data, and gateway levels. See [Multi-Tenant](/docs/concepts/multi-tenant). |

## J

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **JSON-RPC** | JSON-RPC | Protocol used by MCP for tool discovery (`tools/list`) and invocation (`tools/call`). |
| **JWT (JSON Web Token)** | JWT (Jeton Web JSON) | Signed token format used for stateless authentication. Validated by the gateway. |

## K

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Keycloak** | Keycloak | Open-source identity and access management server. STOA uses one realm per tenant. |

## M

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **MCP (Model Context Protocol)** | MCP (Protocole de contexte de modèle) | Open protocol for AI agents to discover and invoke tools. STOA implements MCP via SSE and REST transports. |
| **Metering** | Métrologie | Usage tracking pipeline (Kafka-based) that records API calls for billing and analytics. |
| **mTLS (Mutual TLS)** | mTLS (TLS mutuel) | Two-way TLS authentication where both client and server present certificates. |
| **Multi-Tenant** | Multi-tenant | Architecture where a single platform instance serves multiple isolated organizations. |

## N

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Namespace** | Namespace (espace de noms) | Kubernetes isolation boundary. Each STOA tenant gets a dedicated namespace (`tenant-{id}`). |

## O

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **OAuth 2.0** | OAuth 2.0 | Industry-standard authorization framework. STOA supports authorization code, client credentials, and ROPC flows. |
| **OIDC (OpenID Connect)** | OIDC (OpenID Connect) | Identity layer on top of OAuth 2.0. Used by Keycloak for SSO and user authentication. |
| **OPA (Open Policy Agent)** | OPA (Open Policy Agent) | Policy engine used by the gateway for fine-grained authorization (Rego policies). |

## P

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Policy** | Politique | A rule applied to API traffic: rate limiting, CORS, JWT validation, IP filtering, etc. |
| **Portal** | Portail (développeur) | Self-service developer portal where consumers discover APIs, manage subscriptions, and view usage. |

## R

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Rate Limit** | Limitation de débit | Policy that restricts the number of API calls per time window (e.g., 600 requests/minute). |
| **RBAC (Role-Based Access Control)** | RBAC (Contrôle d'accès basé sur les rôles) | Authorization model with 4 roles: `cpi-admin`, `tenant-admin`, `devops`, `viewer`. |
| **Realm** | Realm (domaine) | A Keycloak isolation unit. STOA creates one realm per tenant with independent users, clients, and roles. |

## S

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Scope** | Scope (portée) | OAuth 2.0 permission granularity (e.g., `stoa:read`, `stoa:write`, `stoa:admin`). |
| **Shadow Mode** | Mode shadow (observation) | Passive traffic capture mode for legacy API discovery. Deferred pending security review. |
| **Sidecar Mode** | Mode sidecar | Gateway mode deployed alongside existing gateways (Kong, Envoy) for observability injection. |
| **SSE (Server-Sent Events)** | SSE (Événements envoyés par le serveur) | Unidirectional streaming protocol used for MCP agent connections. |
| **Subscription** | Abonnement | A link between a consumer application and an API, granting access with specific quotas. |

## T

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Tenant** | Tenant (locataire) | An isolated organization on the platform. Each tenant has its own namespace, realm, APIs, and users. |
| **Tool** | Outil (MCP) | A function exposed via MCP that AI agents can discover and invoke. Defined as a Kubernetes CRD. |
| **ToolSet** | Ensemble d'outils | A CRD that connects an external MCP server and exposes its tools through the STOA gateway. |
| **Token Optimization** | Optimisation de jetons | Gateway feature that reduces LLM token consumption by compressing tool descriptions. |

## U

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **UAC (Universal API Contract)** | UAC (Contrat d'API universel) | STOA's gateway-agnostic API definition format. "Define once, expose everywhere." See [UAC Concept](/docs/concepts/uac). |

## W

| EN Term | FR Term | Definition |
|---------|---------|------------|
| **Webhook** | Webhook | HTTP callback triggered by platform events (API deployed, subscription created, etc.). |

---

## Translation Conventions

When translating STOA documentation to French:

1. **Keep in English** (never translate): MCP, UAC, SSE, JWT, OIDC, OAuth, OPA, CRD, RBAC, ArgoCD, Keycloak, Kubernetes, namespace, scope, webhook, JSON-RPC
2. **Translate with original in parentheses** (first occurrence only): "passerelle (gateway)", "abonnement (subscription)", "locataire (tenant)"
3. **Use established French IT terms**: "jeton" (token), "point d'entrée" (endpoint), "limitation de débit" (rate limit)
4. **Code stays in English**: variable names, CLI commands, API paths, YAML keys
5. **Mermaid diagrams**: translate labels but keep node IDs in English
