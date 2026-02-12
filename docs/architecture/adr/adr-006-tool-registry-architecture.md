---
sidebar_position: 6
title: "ADR-006: Tool Registry Architecture"
description: "Decides the modular 7-module design for the MCP tool registry, covering discovery, validation, RBAC, and lifecycle management."
keywords: [tool registry, MCP, modular design, RBAC, discovery, lifecycle]
---

# ADR-006: Tool Registry Architecture — Modular 7-Module Design

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | CAB-841 (Refactoring), CAB-603 (Core vs Proxied), CAB-605 (Consolidation) |

## Context

The MCP Gateway's tool registry is the central component for managing AI-accessible tools. Initially implemented as a single 1984-line file, it became unmaintainable as features grew:

- Core platform tools (stoa_*)
- Proxied tenant API tools (`{tenant}:{api}:{operation}`)
- External MCP server tools (Linear, GitHub, etc.)
- Deprecation management for tool renaming
- K8s CRD-based tool discovery

### The Problem

> "The tool registry grew into a god object. Adding a feature means understanding 2000 lines of code."

The monolithic design caused:
- Merge conflicts on every PR
- Cognitive overload for contributors
- Difficulty testing individual concerns
- Slow iteration on new features

## Decision

Refactor the tool registry into a **modular mixin-based architecture** with single-responsibility modules.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ToolRegistry                                │
│        (Composition of 8 mixins via multiple inheritance)           │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Registration │  │   Lookup     │  │ Deprecation  │              │
│  │    Mixin     │  │   Mixin      │  │    Mixin     │              │
│  │              │  │              │  │              │              │
│  │ - register() │  │ - get()      │  │ - aliases    │              │
│  │ - unregister │  │ - list()     │  │ - resolve()  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Invocation  │  │ CoreRouting  │  │   Action     │              │
│  │    Mixin     │  │   Mixin      │  │  Handlers    │              │
│  │              │  │              │  │    Mixin     │              │
│  │ - invoke()   │  │ - route to   │  │ - handle_*   │              │
│  │              │  │   core tool  │  │   actions    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │   Proxied    │  │   External   │                                │
│  │    Mixin     │  │    Mixin     │                                │
│  │              │  │              │                                │
│  │ - invoke     │  │ - Linear,    │                                │
│  │   proxied    │  │   GitHub...  │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
mcp-gateway/src/services/tool_registry/
├── __init__.py           # ToolRegistry class (mixin composition)
├── models.py             # DeprecatedToolAlias dataclass
├── exceptions.py         # ToolNotFoundError
├── singleton.py          # Module-level get_tool_registry()
│
├── registration.py       # RegistrationMixin — register/unregister tools
├── lookup.py             # LookupMixin — get/list/search tools
├── deprecation.py        # DeprecationMixin — alias management
├── invocation.py         # InvocationMixin — main invoke() entry point
├── core_routing.py       # CoreRoutingMixin — route to core tools
├── action_handlers.py    # ActionHandlersMixin — handle_*_action methods
├── proxied.py            # ProxiedMixin — invoke proxied tenant tools
├── external.py           # ExternalMixin — external MCP servers
└── legacy.py             # LegacyMixin — backward compatibility
```

## Module Responsibilities

### RegistrationMixin (registration.py)

Handles tool lifecycle:

```python
class RegistrationMixin:
    async def register_tool(self, tool: Tool) -> None: ...
    async def unregister_tool(self, tool_name: str) -> None: ...
    async def _register_core_tools(self) -> None: ...
    async def _register_builtin_tools(self) -> None: ...
```

### LookupMixin (lookup.py)

Tool discovery and search:

```python
class LookupMixin:
    async def get_tool(self, name: str) -> Tool | None: ...
    async def list_tools(self, tenant_id: str = None) -> list[Tool]: ...
    async def search_tools(self, query: str) -> list[Tool]: ...
    def _resolve_deprecated_alias(self, name: str) -> str | None: ...
```

### DeprecationMixin (deprecation.py)

Manages tool renaming with backward compatibility:

```python
class DeprecationMixin:
    _deprecated_aliases: dict[str, DeprecatedToolAlias]

    async def _register_deprecation_aliases(self) -> None: ...
    def add_deprecated_alias(self, old_name: str, new_name: str) -> None: ...
```

Aliases provide 60-day backward compatibility:

```python
@dataclass
class DeprecatedToolAlias:
    old_name: str
    new_name: str
    deprecated_at: datetime
    expires_at: datetime  # deprecated_at + 60 days
```

### InvocationMixin (invocation.py)

Main entry point for tool execution:

```python
class InvocationMixin:
    async def invoke(
        self,
        tool_name: str,
        arguments: dict,
        context: InvocationContext
    ) -> ToolResult: ...
```

Routes to appropriate handler based on tool type.

### CoreRoutingMixin (core_routing.py)

Routes to platform tools:

```python
class CoreRoutingMixin:
    async def _invoke_core_tool(
        self,
        tool: CoreTool,
        action: str,
        arguments: dict,
        context: InvocationContext
    ) -> ToolResult: ...
```

### ActionHandlersMixin (action_handlers.py)

Domain-specific action handlers:

```python
class ActionHandlersMixin:
    async def _handle_catalog_action(self, action: str, args: dict) -> ToolResult: ...
    async def _handle_subscription_action(self, action: str, args: dict) -> ToolResult: ...
    async def _handle_observability_action(self, action: str, args: dict) -> ToolResult: ...
    async def _handle_platform_action(self, action: str, args: dict) -> ToolResult: ...
    async def _handle_uac_action(self, action: str, args: dict) -> ToolResult: ...
    async def _handle_security_action(self, action: str, args: dict) -> ToolResult: ...
```

### ProxiedMixin (proxied.py)

Invokes tenant API tools:

```python
class ProxiedMixin:
    async def _invoke_proxied_tool(
        self,
        tool: ProxiedTool,
        arguments: dict,
        context: InvocationContext
    ) -> ToolResult: ...
```

### ExternalMixin (external.py)

Manages external MCP servers (Linear, GitHub, etc.):

```python
class ExternalMixin:
    async def register_external_server(self, server: ExternalMCPServer) -> None: ...
    async def invoke_external_tool(self, tool_name: str, args: dict) -> ToolResult: ...
```

## Tool Types

### Core Tools (stoa_*)

Platform-provided tools with action-based design:

| Tool | Domain | Actions |
|------|--------|---------|
| `stoa_catalog` | CATALOG | list_apis, get_api, search |
| `stoa_subscription` | SUBSCRIPTION | list, create, revoke |
| `stoa_observability` | OBSERVABILITY | get_metrics, get_logs |
| `stoa_platform` | PLATFORM | get_status, list_tenants |
| `stoa_uac` | UAC | validate, generate |
| `stoa_security` | SECURITY | check_policy, audit |

### Proxied Tools (`{tenant}:{api}:{operation}`)

Dynamically registered from tenant APIs:

```python
# Example: acme:payment-api:create_payment
ProxiedTool(
    name="acme:payment-api:create_payment",
    tenant_id="acme",
    api_id="payment-api",
    operation="create_payment",
    endpoint="https://api.<YOUR_DOMAIN>/acme/payment-api/v1/payments",
    method="POST"
)
```

### External Tools

Tools from external MCP servers:

```python
ExternalTool(
    name="linear:create_issue",
    server_id="linear-mcp",
    original_name="create_issue"
)
```

## Class Composition

The main `ToolRegistry` class composes all mixins:

```python
class ToolRegistry(
    DeprecationMixin,
    RegistrationMixin,
    LookupMixin,
    InvocationMixin,
    CoreRoutingMixin,
    ActionHandlersMixin,
    ProxiedMixin,
    ExternalMixin,
    LegacyMixin,
):
    def __init__(self) -> None:
        self._core_tools: dict[str, CoreTool] = {}
        self._proxied_tools: dict[str, ProxiedTool] = {}
        self._external_tools: dict[str, ExternalTool] = {}
        self._deprecated_aliases: dict[str, DeprecatedToolAlias] = {}
        self._http_client: httpx.AsyncClient | None = None
```

## Storage Strategy

Different tool types use separate dictionaries:

| Storage | Key Format | Tool Type |
|---------|------------|-----------|
| `_core_tools` | `stoa_DOMAIN` | CoreTool |
| `_proxied_tools` | `TENANT:API:OPERATION` | ProxiedTool |
| `_external_tools` | `SERVER:TOOL_NAME` | ExternalTool |
| `_deprecated_aliases` | `OLD_NAME` | DeprecatedToolAlias |

## Consequences

### Positive

- **Single Responsibility** — Each mixin handles one concern
- **Testability** — Mixins can be tested in isolation
- **Readability** — Files are 200-400 lines instead of 2000
- **Parallelism** — Multiple developers can work on different mixins
- **Extensibility** — New tool types add new mixins

### Negative

- **Mixin Complexity** — Multiple inheritance requires careful ordering
- **Discoverability** — Code spread across files
- **Circular Dependencies** — Mixins must avoid importing each other

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Mixin ordering | Documented in `__init__.py`, CI enforces |
| Discoverability | Clear file naming, docstrings |
| Circular deps | Pass dependencies via `__init__`, not imports |

## Performance

Tool lookup is O(1) via dictionary:

```python
async def get_tool(self, name: str) -> Tool | None:
    # Check core tools first (most common)
    if name in self._core_tools:
        return self._core_tools[name]

    # Check deprecated aliases
    resolved = self._resolve_deprecated_alias(name)
    if resolved:
        return await self.get_tool(resolved)

    # Check proxied tools
    if name in self._proxied_tools:
        return self._proxied_tools[name]

    # Check external tools
    return self._external_tools.get(name)
```

## References

- [mcp-gateway/src/services/tool_registry/](https://github.com/stoa-platform/stoa/tree/main/mcp-gateway/src/services/tool_registry/)
- [ADR-012 — MCP RBAC Architecture](./adr-012-mcp-rbac-architecture.md)
- [CAB-841 — Tool Registry Refactoring](https://linear.app/stoa/issue/CAB-841)
- [CAB-603 — Core vs Proxied Separation](https://linear.app/stoa/issue/CAB-603)
- [CAB-605 — Tool Consolidation](https://linear.app/stoa/issue/CAB-605)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
