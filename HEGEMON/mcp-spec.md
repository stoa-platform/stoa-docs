# HEGEMON MCP — Phase 0 Spec

> Spec only. Zero code. Phase 1 execution gated by Phase 0.5 empirical backtest (Decision Gate log #4, 2026-04-17).

## 1. Purpose

Expose HEGEMON Council as an MCP service so that:
- LLM routing becomes an infrastructure decision, not code.
- Each persona runs on the model best suited to its cognitive role.
- Disagreement between models becomes a first-class, measurable artifact.

Not a goal: replacing Claude as the primary LLM. Multi-LLM augments the Council; it does not substitute it.

## 2. Phase Model

| Phase | Scope | Gate to next |
|-------|-------|--------------|
| **0** (now) | This spec. Docs only. CIR R&D. | Merged on `main` of `stoa-docs`. |
| **0.5** | Manual dual-Council backtest, 3 personas, N runs. | `≥10 logs AND (score_divergence >1.5 on ≥30% OR decision_delta=YES on ≥20%)`. |
| **1** | MCP server (Python or Go — TBD), 4 tools, n8n orchestrator, routing config-driven. | Phase 6 HEGEMON complete + Decision Gate re-fires on Phase 1 design. |
| **2** | Symmetric multi-LLM Council, auto-rerouting. | Conditional on Phase 1 metrics. |
| **3+** | Self-improvement loop, persona fine-tuning. | Out of scope here. |

## 3. MCP Tool Contracts

Server namespace: `hegemon`. Transport: stdio for Claude Code integration, HTTP for n8n orchestration.

### 3.1 `council_score`

Orchestrates N personas across N LLMs on a given ticket/stage.

**Request**
```json
{
  "ticket_id": "CAB-2075",
  "stage": "S1|S2|S3",
  "context": {
    "summary": "string",
    "plan_md": "string | null",
    "diff_url": "string | null",
    "contracts": ["string"]
  },
  "personas": ["oss_killer", "gekko", "better_call_saul"],
  "override_routing": null
}
```

**Response**
```json
{
  "run_id": "uuid",
  "ticket_id": "CAB-2075",
  "stage": "S1",
  "majority_verdict": "GO|NO_GO|REWORK",
  "majority_score": 8.2,
  "personas": [
    {
      "persona": "oss_killer",
      "llm": "gpt-4",
      "score": 5.1,
      "verdict": "REWORK",
      "arguments": "string"
    }
  ],
  "dissent_log": {
    "has_dissent": true,
    "dissenting_personas": [
      {"persona": "oss_killer", "llm": "gpt-4", "score": 5.1, "reason": "string"}
    ],
    "decision_delta": true
  },
  "metrics": {
    "tokens_in": 0,
    "tokens_out": 0,
    "latency_ms": 0,
    "cost_usd": 0.0
  }
}
```

### 3.2 `council_review`

S3 automated review — security, supply chain, compliance axes on a diff or plan.

**Request**
```json
{
  "diff_url": "string | null",
  "plan_md": "string | null",
  "contracts": ["uac-contract-id"],
  "axes": ["security", "supply_chain", "compliance"]
}
```

**Response** — same shape as `council_score` but `stage: "S3_automated"`.

### 3.3 `hegemon_metrics`

Observability read. No side effects.

**Response**
```json
{
  "workers": {"total": 5, "healthy": 5},
  "tokens_today": {"claude": 0, "gpt": 0, "gemini": 0},
  "cost_today_usd": 0.0,
  "runs_today": 0,
  "avg_decision_delta_rate_7d": 0.0
}
```

### 3.4 `hegemon_workers_status`

Fleet health on 5 Contabo VPS (w1–w5).

**Response**
```json
{
  "workers": [
    {"id": "w1", "role": "backend", "status": "ready|busy|down", "last_seen": "ISO8601"}
  ]
}
```

## 4. Persona → LLM Routing Matrix

Config-driven (`hegemon-routing.yaml`, hot-reloadable). Defaults below; override per-run via `override_routing`.

| Persona | Role | Primary LLM | Fallback | Rationale |
|---------|------|-------------|----------|-----------|
| Chucky | Pentest / OWASP | `claude-opus-4-6` | `claude-sonnet-4-6` | Security depth, tool-use reasoning. |
| Archi 50x50 | Architecture | `claude-opus-4-6` | `gpt-4` | Long-horizon reasoning, trade-off matrix. |
| OSS Killer | Business skeptic | `gpt-4` | `gemini-1.5-pro` | Non-Claude challenger bias, pre-validated on logs #1–#3. |
| Gekk0 | GTM / positioning | `gemini-1.5-pro` | `gpt-4` | Market exposure, non-aligned reframe. |
| Better Call Saul | Legal / contrarian | `gpt-4` | `claude-opus-4-6` | Jurisprudential angle, non-Claude preferred. |
| (3 others) | TBD post Phase 0.5 | — | — | Reserved; Phase 0.5 validates only first 5. |

**Hard rule** (inherited from Decision Gate §Cognitive Roles): a challenger LLM **must not** receive the persona rubric of another LLM. Each persona stands on its own cognitive base.

## 5. Dissent Log — First-Class Artifact

Every Council run writes a dissent log, regardless of verdict convergence.

**Schema** (persisted in `dual-council-logs/<YYYY-MM-DD>-<ticket>.json` Phase 0.5; DB table Phase 1+):
```json
{
  "run_id": "uuid",
  "ticket_id": "CAB-XXXX",
  "stage": "S1|S2|S3",
  "timestamp": "ISO8601",
  "majority_verdict": "GO|NO_GO|REWORK",
  "majority_score": 0.0,
  "score_divergence": 0.0,
  "decision_delta": true,
  "dissenting_personas": [
    {
      "persona": "string",
      "llm": "string",
      "score": 0.0,
      "verdict": "string",
      "reason": "string (verbatim argument)"
    }
  ],
  "retained_decision": "string (what the human actually chose)",
  "notes": "string | null"
}
```

**Invariant**: `decision_delta = true` iff at least one LLM would have flipped GO/NO-GO, priority, or a material design choice. Score-only divergence without verdict flip = `false`.

**Value principle**: in expert environments, signal is in dissent, not in averaged scores. The dissent log is the load-bearing artifact; the majority verdict is secondary.

## 6. Decision Delta — Operational Definition

Binary, human-tagged Phase 0.5; heuristic + human-confirmed Phase 1+.

**`decision_delta = YES` requires all of**:
1. At least one persona-LLM pair produced a verdict divergent from the majority.
2. That divergence, if acted on, would have changed one of:
   - GO / NO-GO / REWORK decision.
   - Priority ordering (P0/P1/P2 shift).
   - Material design choice (architectural fork, vendor switch, scope expansion/reduction ≥20%).
3. The dissenting argument is traceable to a concrete claim (not "gut feeling").

**`decision_delta = NO`**: score spread only, same conclusion, no actionable dissent.

## 7. Phase 0.5 Backtest Protocol

**Scope**: 3 personas — OSS Killer, Gekk0, Better Call Saul.

**Method** (manual, ~2–3h total over 60 days):
1. On each real Council S1/S2/S3 run, duplicate the prompt to a non-Claude LLM for each of the 3 personas.
2. Log result in `stoa-strategy/HEGEMON/dual-council-logs/<date>-<ticket>.md` (private repo — contains client context).
3. Required fields per log: schema §5 above.
4. Target: ≥10 logs over 60 days.

**No automation, no MCP server, no code**. Pure methodology validation.

## 8. Phase 1 Entry Gate

```
Phase 1 GO iff:
  n_logs ≥ 10
  AND (
    (count(score_divergence > 1.5) / n_logs) ≥ 0.30
    OR
    (count(decision_delta == YES) / n_logs) ≥ 0.20
  )
  AND n_days_elapsed ≥ 30  # discipline lock from Decision Gate framework
```

If gate fails: either extend sampling (if data trending toward threshold) or kill the initiative (multi-LLM adds no decision-shaping value).

## 9. Metrics & Budget

**Per-run cap**: hard budget enforced at Phase 1.
- Tokens: 50k total across all LLMs for `council_score`, 100k for `council_review`.
- Latency: 60s p95 per Council run.
- Cost: $0.50 per run ceiling.

**Dashboards (Phase 1)**:
- Decision delta rate (7d / 30d).
- Cost per Council run by LLM.
- Per-persona divergence heatmap.
- Worker fleet utilization.

## 10. Kill-Switch & Rollback

**Kill-switch** (Phase 1+): env var `HEGEMON_DISABLE_MULTI_LLM=true` → all personas fallback to `claude-sonnet-4-6`. No restart required (hot-reload).

**Partial disable** (per-persona): `hegemon-routing.yaml` entry `enabled: false` → that persona reverts to Claude.

**Rollback** (Phase 1 → Phase 0.5): delete MCP server deployment; `dual-council-logs/` preserved; zero state loss since Council source of truth is the log.

## 11. Out of Scope (Phase 0)

- Implementation of the MCP server.
- Automated cross-LLM arbitration (beyond majority vote).
- Fine-tuned personas.
- Real-time persona rerouting based on confidence.
- Replacement of Claude Code as primary IDE integration.

## 12. Open Questions (to resolve before Phase 1)

1. Stack choice: Python (ecosystem) vs Go (deployment footprint)?
2. Persistence: Postgres (reuse cp-api DB) vs dedicated store?
3. n8n orchestration: workflow-per-persona vs single orchestrator workflow?
4. Cost allocation: per-tenant chargeback or shared R&D overhead?
5. Prompt versioning: git-pinned vs DB-stored with migrations?

---

**Owner**: HLFH / stoa-platform
**Status**: Phase 0 — spec only
**Next gate**: Phase 0.5 backtest (≥10 logs over 60 days)
**Related**: [Decision Challenge Gate](./DECISION_GATE.md), log #4 (2026-04-17)
