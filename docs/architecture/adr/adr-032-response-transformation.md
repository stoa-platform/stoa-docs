---
sidebar_position: 32
title: "ADR-032: Response Transformation"
description: "Decides the pluggable adapter pattern for response transformation enabling format conversion between legacy APIs and MCP tool outputs."
keywords: [response transformation, adapter pattern, format conversion, MCP, legacy APIs]
---

# ADR-032: Response Transformation — Pluggable Adapter Pattern

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-06 |
| **Linear** | N/A |

## Context

API responses from backends are often:
- Too verbose for LLM context windows
- Structured for machines, not AI agents
- Inconsistent across different API providers

MCP Gateway needs to transform responses into LLM-friendly formats while respecting token budgets.

### The Problem

> "How do we make arbitrary API responses AI-consumable without hardcoding transformations per API?"

## Decision

Implement a **Response Transformation Engine** with pluggable adapters for different response formats.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    TransformEngine                              │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │ Field        │   │ Truncation   │   │ Pagination   │       │
│  │ Selection    │   │              │   │              │       │
│  │              │   │ - Max chars  │   │ - Page size  │       │
│  │ - Include    │   │ - Ellipsis   │   │ - Cursor     │       │
│  │ - Exclude    │   │              │   │              │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│                                                                  │
│  Adapters:                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   Notion   │  │   Linear   │  │   Capper   │               │
│  │  Adapter   │  │  Adapter   │  │  Adapter   │               │
│  │            │  │            │  │            │               │
│  │ Blocks →   │  │ Issues →   │  │ Token      │               │
│  │ Markdown   │  │ Summary    │  │ Budget     │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└────────────────────────────────────────────────────────────────┘
```

## Transform Operations

### Field Selection

Extract only relevant fields:

```python
config = TransformConfig(
    include_fields=["id", "title", "status", "created_at"],
    exclude_fields=["internal_id", "raw_data"],
)
```

### Truncation

Limit response size:

```python
config = TransformConfig(
    max_chars=4000,
    truncation_marker="... [truncated]",
)
```

### Capper (Token Budget)

Enforce token limits for LLM context:

```python
class CapperAdapter:
    def transform(self, response: dict, max_tokens: int) -> dict:
        """Cap response to fit token budget."""
        current_tokens = count_tokens(response)
        if current_tokens <= max_tokens:
            return response

        # Progressive summarization
        return self._summarize_to_budget(response, max_tokens)
```

## Adapters

### Notion Adapter

Transforms Notion block responses:

```python
class NotionAdapter:
    def transform(self, blocks: list[dict]) -> str:
        """Convert Notion blocks to Markdown."""
        markdown = []
        for block in blocks:
            if block["type"] == "paragraph":
                markdown.append(block["paragraph"]["rich_text"][0]["plain_text"])
            elif block["type"] == "heading_1":
                markdown.append(f"# {block['heading_1']['rich_text'][0]['plain_text']}")
        return "\n\n".join(markdown)
```

### Linear Adapter

Transforms Linear issue responses:

```python
class LinearAdapter:
    def transform(self, issue: dict) -> dict:
        """Extract key issue fields."""
        return {
            "id": issue["identifier"],
            "title": issue["title"],
            "status": issue["state"]["name"],
            "assignee": issue.get("assignee", {}).get("name"),
            "priority": issue["priority"],
        }
```

## Configuration Schema

```yaml
transform:
  enabled: true
  default_max_tokens: 4000
  adapters:
    notion:
      enabled: true
      output_format: markdown
    linear:
      enabled: true
      include_comments: false
    capper:
      enabled: true
      model: gpt-4  # For token counting
```

## Consequences

### Positive

- **LLM-Friendly** — Responses fit context windows
- **Extensible** — New adapters without engine changes
- **Configurable** — Per-tool transformation rules
- **Consistent** — Uniform output format

### Negative

- **Information Loss** — Truncation removes data
- **Adapter Maintenance** — Each API needs an adapter
- **Token Counting** — Requires model-specific logic

## References

- [mcp-gateway/src/transformer/](https://github.com/stoa-platform/stoa/tree/main/mcp-gateway/src/transformer/)
- [ADR-006 — Tool Registry Architecture](./adr-006-tool-registry-architecture.md)

---

*Standard Marchemalo: A 40-year veteran architect understands in 30 seconds*
