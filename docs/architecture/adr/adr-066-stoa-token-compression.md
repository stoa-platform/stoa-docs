# ADR-066 — STOA Token Compression (STC): Lossless Response Compression for LLM Agents

**Status:** Accepted
**Date:** 2026-04-01
**Author:** Christophe (CAB Ingénierie)
**Council:** S1 6.00/10 (Fix → adjusted), S2 7.25/10 (Fix) — Impact 68 (CRITICAL)
**Ticket:** CAB-1936

---

## Context

LLM token budgets are the #1 cost driver for AI agent users. Every tool call response passes through the gateway as JSON — a format designed for human readability, not token efficiency. JSON structural characters (`"`, `{`, `}`, `,`, `:`) consume tokens without carrying semantic value.

IBM's MCP Context Forge introduced "TOON" compression (3,500+ stars, Apache 2.0) — a proprietary lossless format that strips JSON punctuation to reduce token consumption. Benchmarks show 15-30% token reduction on typical tool responses.

STOA's gateway processes all MCP tool responses in the PostUpstream phase. Adding compression here means every federated tool call benefits automatically — no client code changes required (opt-in via content negotiation).

### Competitive Landscape

| Gateway | Token Compression | Approach |
|---------|------------------|----------|
| IBM Context Forge | TOON (proprietary) | Python plugin, lossless |
| STOA Gateway | **STC (this ADR)** | Rust builtin plugin, lossless, opt-in |
| AgentGateway | None | — |
| Kong / Gravitee | None (gzip only) | Transport-level, not token-aware |

---

## Decision

Implement **STOA Token Compression (STC)** as a builtin gateway plugin using the existing Plugin SDK (CAB-1759). STC is:

1. **Lossless** — roundtrip fidelity is 100% (encode → decode = identical JSON)
2. **Opt-in** — activated only when client sends `Accept-Encoding: stc`
3. **Zero overhead when disabled** — no processing when header is absent
4. **Independent of IBM** — original Rust implementation, no code derived from TOON

### STC Format Specification

Three compression techniques applied in order:

#### Technique 1: Unquoted Keys

Strip quotes from object keys that are valid identifiers (ASCII alphanumeric + underscore, not starting with digit).

```
// JSON
{"name": "foo", "api_version": "v2", "count": 42}

// STC
{name: "foo", api_version: "v2", count: 42}
```

**Rule**: Key is unquoted if it matches `^[a-zA-Z_][a-zA-Z0-9_]*$`. Values are never unquoted (preserves type information).

#### Technique 2: Compact Arrays

Homogeneous arrays of primitives (all strings, all numbers, all bools) use bracket-count notation.

```
// JSON
{"tags": ["api", "gateway", "mcp"], "scores": [95, 87, 91]}

// STC
{tags[3]: "api","gateway","mcp", scores[3]: 95,87,91}
```

**Rule**: Array elements separated by `,` without spaces. Mixed-type arrays are not compacted. Nested arrays/objects inside arrays are not compacted.

#### Technique 3: Columnar Objects

Arrays of homogeneous objects (same keys in same order) use columnar notation.

```
// JSON
[{"id": 1, "name": "users", "method": "GET"}, {"id": 2, "name": "orders", "method": "POST"}]

// STC
[2]{id,name,method}: 1,"users","GET" / 2,"orders","POST"
```

**Rule**: `[count]{key1,key2,...}: row1_val1,row1_val2,... / row2_val1,row2_val2,...`. All objects must have identical key sets. Row separator is ` / `. Only applied to arrays of flat objects (no nested objects/arrays in values).

### Content Negotiation Protocol

```
Client → Gateway:
  Accept-Encoding: stc

Gateway → Client (if STC plugin enabled):
  Content-Encoding: stc
  Content-Type: application/stc+json
  X-STC-Ratio: 0.73        (compression ratio: compressed/original)
  X-STC-Version: 1

Gateway → Client (if STC plugin disabled or not installed):
  Content-Type: application/json   (unchanged, no STC headers)
```

Clients that don't send `Accept-Encoding: stc` receive standard JSON — full backward compatibility.

### Plugin SDK Extension Required

The current `PluginContext` (CAB-1759) exposes `response_headers` and `response_status` but **not the response body**. STC requires body access in the PostUpstream phase.

**Required SDK change** (Phase 2 prerequisite):

```rust
pub struct PluginContext {
    // ... existing fields ...

    /// Mutable response body (available in PostUpstream/OnError phases).
    /// None in PreAuth/PostAuth/PreUpstream phases.
    pub response_body: Option<Vec<u8>>,

    /// Mutable request body (available in PreUpstream phase).
    /// None in PreAuth/PostAuth/PostUpstream/OnError phases.
    pub request_body: Option<Vec<u8>>,
}
```

This extension also unblocks PII filter and secrets detection plugins (CAB-1936 Phase 3).

---

## Alternatives Considered

### 1. Transport-level gzip compression

**Rejected.** gzip reduces wire bytes but not LLM tokens. LLMs consume the decompressed text — gzip provides zero token savings.

### 2. Response summarization (lossy)

**Rejected.** Lossy compression changes semantics. Tool responses contain structured data (IDs, URLs, counts) where any change breaks downstream processing. Lossless is the only viable approach.

### 3. Custom binary format (MessagePack, CBOR)

**Rejected.** LLMs operate on text tokens. Binary formats require base64 encoding for LLM consumption, which increases token count. Text-based compression is the right layer.

### 4. Adopt IBM TOON format directly

**Rejected.** TOON is undocumented outside IBM's codebase. Adopting it creates a dependency on IBM's format evolution. STC uses similar principles but with a documented spec and independent implementation.

---

## Consequences

### Positive

- 15-30% token reduction on typical tool responses (based on IBM's published benchmarks for similar techniques)
- Zero overhead for non-STC clients
- Leverages existing Plugin SDK — no new middleware layer
- Opens the door for future compression techniques (append to STC version)
- Enterprise-visible feature for sales demos

### Negative

- Clients need a decoder to consume STC responses — reference implementations required
- New content type (`application/stc+json`) needs documentation
- Plugin SDK extension (response_body) increases PluginContext memory footprint

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| No client adopts STC | Medium | Ship reference decoders (Python + TS), integrate into stoactl |
| Compression ratio disappointing on real data | Low | Benchmark with production tool responses before GA |
| Format ambiguity causes parsing bugs | Low | Formal grammar + extensive roundtrip tests |

---

## Reference Decoder Snippets

### Python (50 lines)

```python
"""STOA Token Compression (STC) decoder — reference implementation."""
import re
import json

def decode_stc(stc: str) -> str:
    """Decode an STC-encoded string back to standard JSON."""
    # Phase 1: Restore columnar objects
    # Pattern: [N]{key1,key2,...}: val1,val2 / val3,val4
    def expand_columnar(m: re.Match) -> str:
        count = int(m.group(1))
        keys = m.group(2).split(",")
        rows_str = m.group(3)
        rows = rows_str.split(" / ")
        objects = []
        for row in rows[:count]:
            values = _split_values(row, len(keys))
            obj = dict(zip(keys, values))
            objects.append(json.dumps(obj))
        return "[" + ",".join(objects) + "]"

    # Phase 2: Restore compact arrays
    # Pattern: key[N]: val1,val2,val3
    def expand_compact_array(m: re.Match) -> str:
        key = m.group(1)
        count = int(m.group(2))
        values_str = m.group(3)
        values = _split_values(values_str, count)
        return f'"{key}": [{",".join(values)}]'

    # Phase 3: Re-quote unquoted keys
    def quote_keys(s: str) -> str:
        return re.sub(r'(?<=[{,])\s*([a-zA-Z_]\w*)\s*:', r' "\1":', s)

    result = re.sub(r'\[(\d+)\]\{([^}]+)\}:\s*(.+?)(?=\s*[}\]]|$)',
                     expand_columnar, stc, flags=re.DOTALL)
    result = re.sub(r'([a-zA-Z_]\w*)\[(\d+)\]:\s*(.+?)(?=,\s*[a-zA-Z_]|\s*[}])',
                     expand_compact_array, result)
    result = quote_keys(result)
    return result

def _split_values(s: str, expected: int) -> list[str]:
    """Split comma-separated values respecting quoted strings."""
    values, current, in_quote = [], [], False
    for ch in s:
        if ch == '"':
            in_quote = not in_quote
            current.append(ch)
        elif ch == ',' and not in_quote and len(values) < expected - 1:
            values.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    values.append("".join(current).strip())
    return values
```

### TypeScript (50 lines)

```typescript
/** STOA Token Compression (STC) decoder — reference implementation. */

export function decodeStc(stc: string): string {
  let result = stc;

  // Phase 1: Restore columnar objects [N]{key1,key2,...}: vals / vals
  result = result.replace(
    /\[(\d+)\]\{([^}]+)\}:\s*(.+?)(?=\s*[}\]]|$)/gs,
    (_match, countStr, keysStr, rowsStr) => {
      const count = parseInt(countStr, 10);
      const keys = keysStr.split(',');
      const rows = rowsStr.split(' / ').slice(0, count);
      const objects = rows.map((row: string) => {
        const values = splitValues(row, keys.length);
        const obj = Object.fromEntries(keys.map((k: string, i: number) => [k, values[i]]));
        return JSON.stringify(obj);
      });
      return '[' + objects.join(',') + ']';
    }
  );

  // Phase 2: Restore compact arrays key[N]: val1,val2
  result = result.replace(
    /([a-zA-Z_]\w*)\[(\d+)\]:\s*(.+?)(?=,\s*[a-zA-Z_]|\s*[}])/g,
    (_match, key, countStr, valsStr) => {
      const count = parseInt(countStr, 10);
      const values = splitValues(valsStr, count);
      return `"${key}": [${values.join(',')}]`;
    }
  );

  // Phase 3: Re-quote unquoted keys
  result = result.replace(/(?<=[{,])\s*([a-zA-Z_]\w*)\s*:/g, ' "$1":');

  return result;
}

function splitValues(s: string, expected: number): string[] {
  const values: string[] = [];
  let current = '';
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') { inQuote = !inQuote; current += ch; }
    else if (ch === ',' && !inQuote && values.length < expected - 1) {
      values.push(current.trim());
      current = '';
    } else { current += ch; }
  }
  values.push(current.trim());
  return values;
}
```

---

## References

- [CAB-1936](https://linear.app/hlfh-workspace/issue/CAB-1936) — Implementation ticket
- [CAB-1759](https://linear.app/hlfh-workspace/issue/CAB-1759) — Plugin SDK
- [IBM MCP Context Forge](https://github.com/IBM/mcp-context-forge) — Competitive reference (Apache 2.0)
- [MCP Specification](https://spec.modelcontextprotocol.io/) — Protocol reference
