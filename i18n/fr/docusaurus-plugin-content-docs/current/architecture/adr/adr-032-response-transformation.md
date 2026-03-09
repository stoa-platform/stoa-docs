---
sidebar_position: 32
title: "ADR-032 : Transformation des Réponses"
description: "Décide du pattern d'adapter pluggable pour la transformation des réponses, permettant la conversion de format entre les APIs legacy et les sorties d'outils MCP."
keywords: [transformation des réponses, pattern adapter, conversion de format, MCP, APIs legacy]
---

# ADR-032 : Transformation des Réponses — Pattern d'Adapter Pluggable

## Metadata

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-02-06 |
| **Linear** | N/A |

## Contexte

Les réponses API des backends sont souvent :
- Trop verbeuses pour les fenêtres de contexte des LLM
- Structurées pour les machines, pas pour les agents IA
- Incohérentes entre différents fournisseurs d'API

Le MCP Gateway doit transformer les réponses en formats adaptés aux LLM tout en respectant les budgets de tokens.

### Le Problème

> « Comment rendre les réponses API arbitraires consommables par l'IA sans coder en dur les transformations par API ? »

## Décision

Implémenter un **Moteur de Transformation de Réponses** avec des adapters pluggables pour différents formats de réponse.

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

## Opérations de Transformation

### Sélection de Champs

Extraire uniquement les champs pertinents :

```python
config = TransformConfig(
    include_fields=["id", "title", "status", "created_at"],
    exclude_fields=["internal_id", "raw_data"],
)
```

### Troncature

Limiter la taille de la réponse :

```python
config = TransformConfig(
    max_chars=4000,
    truncation_marker="... [truncated]",
)
```

### Capper (Budget de Tokens)

Appliquer des limites de tokens pour le contexte LLM :

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

### Adapter Notion

Transforme les réponses de blocs Notion :

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

### Adapter Linear

Transforme les réponses d'issues Linear :

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

## Schéma de Configuration

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

## Conséquences

### Positives

- **Adapté aux LLM** — Les réponses s'intègrent dans les fenêtres de contexte
- **Extensible** — Nouveaux adapters sans modification du moteur
- **Configurable** — Règles de transformation par outil
- **Cohérent** — Format de sortie uniforme

### Négatives

- **Perte d'information** — La troncature supprime des données
- **Maintenance des adapters** — Chaque API nécessite un adapter
- **Comptage de tokens** — Nécessite une logique spécifique au modèle

## Références

- [mcp-gateway/src/transformer/](https://github.com/stoa-platform/stoa/tree/main/mcp-gateway/src/transformer/)
- [ADR-006 — Architecture du Registre d'Outils](./adr-006-tool-registry-architecture.md)
