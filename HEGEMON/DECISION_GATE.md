# Decision Challenge Gate — HLFH

> One-page governance. If this doc grows past one page / 5 min read, the gate has fired on itself. Refactor.

**Purpose.** Before executing any heavy plan, run contradiction through a **non-aligned external challenger**. Council (8 personas) = convergent robustness. Challenger = divergent reframe. Complementary, not redundant.

## Trigger

Gate fires if **≥ 1** of:

- **(a)** Claude time > 5 h (≈ 2 Linear pts).
- **(b)** Direct business impact: GTM, pricing, positioning, strategic content, partnership, heavy roadmap.
- **(c)** Irreversible: data, contracts, branding, trademark, public commitments.

Does **not** fire on code-only, reversible, sub-5 h tasks.

## Cognitive Roles

| Role | Source | Owns |
|------|--------|------|
| Internal Council | Claude, 8 personas (HEG-PAT-003) | Architecture, security, governance, robustness |
| External Challenger | GPT (or another non-Claude LLM) | ROI, traction, simplicity, reframe, bullshit detector |

**Hard rule.** The challenger must **not** receive personas or Council rubric. A persona-fed challenger is a digital twin, not a challenger.

## Challenger Prompt (template)

```
Plan: <paste plan>.
Context: <1–3 bullets>.
You are NOT a persona and NOT a consultant. You are a non-aligned challenger.
Challenge the FRAMING, not the execution. Return:
1. Is the problem correctly formulated? If not, reformulate.
2. Which biases or assumptions are baked in?
3. Where is this over-engineered? What would a 20% version achieve?
4. What missing context would break this plan?
Refuse to score. Prose only.
```

## Arbitrage

| Verdict | Criterion | Action |
|---------|-----------|--------|
| VALID | Claude missed context | Patch the plan |
| INVALID | Challenger missed context | Reject, with a written reason |
| PARTIAL | Right on form, wrong on substance | Extract signal, drop the rest |

## "Erreur évitée" (binary)

Both required:

1. The plan would have been executed **as-is**, AND
2. Challenger input **changed a significant decision**.

"Interesting but not actioned" = **NO**.

## Log Format

`date | plan | challenger | utility (1–5) | final decision | erreur évitée (Y/N + one-line why)`

## Seed Logs (2026-04-16)

- **#1 · Editorial plan "EU régulé"** · GPT-5 · 5/5 · **VALID** · **Y** — flagged over-engineering (Lychee CI cutoff, 5× peer review, 3× legal review, industrialised retrofit of 63 articles). Plan cut to v1 with a human gate.
- **#2 · Dual-council LLM (Claude Code proposal ≈ 12 h dev)** · GPT-5 · 5/5 · **VALID** · **Y** — flagged premature automation. Refocused on manual MVP Phase 0 (10 logs / 60 d gate before Phase 1).
- **#3 · Gateway benchmark public CAB-2043 (≈ 10–20 h setup)** · GPT-5 (3 rounds) · 4.5/5 · **VALID** · **Y** — reframed "5-gateway public shootout" → "C-asymmetric 80/20" (main act = démo 3-actes OTEL/Tempo + dossier archi 5 piliers régulé EU ; bench = annexe sobre STOA vs Gravitee, framing "within expected range"). R1 insight : p999 ≠ critère de décision comité régulé. R2 insight : sans chiffres = doute silencieux différé, bench-annexe = désactivateur. R3 insight : sequencing démo→dossier (pas l'inverse) pour éviter biais projection. Dropped : 5 gateways × 3 scénarios × publication centrale.
- **#4 · HEGEMON MCP Phase 0 spec (methodology design)** · GPT-5 · 5/5 · **VALID** · **Y** — initial Phase 0.5 gate relied on score-divergence only, risking variance-as-signal false positives. Added mandatory `decision_delta` binary per run log (would any LLM have flipped GO/NO-GO, priority, or design choice). Restructured Phase 1 entry gate: `≥10 logs AND (score_divergence >1.5 on ≥30% OR decision_delta=YES on ≥20%)`. Formalized dissent log as first-class artifact (structured JSON with `majority_verdict` + `dissenting_personas[]`). Scope cut 8→3 personas for Phase 0.5 (OSS Killer, Gekk0, Better Call Saul). Rationale: multi-LLM Council value lies in decision-shaping disagreement, not averaged scores.
- **#5 · CAB-2113 catalog granular Tool CRDs (Option B, weeks of dev)** · GPT-5 · 5/5 · **VALID** · **Y** — reframed "structural deficiency (catalog model)" → "behavioral uncertainty (LLM interaction quality)". Plan B would have frozen an unvalidated 1-tool-per-operation mapping into catalog CRDs + sync + gateway registry before any measurement. Patched plan: Phase 0 = runtime overlay (CLI expands OpenAPI → N ephemeral MCP descriptors at subscription/discovery, zero catalog change, days of work); Phase 0.5 = LLM behavioral harness comparing (i) coarse `action/params`, (ii) N per-operation tools, (iii) enriched single tool with hints — gate B only if (ii) materially beats (i) AND (iii). Option A remains the demo unblocker. Sub-risks surfaced as follow-up tickets: tool-count scalability (50/200 ops), operationId quality, security surface multiplication, cross-operation workflows.
- **#6 · CAB-2116 P2 corpus ratification (substitute specs)** · GPT-5 (Codex) · 4/5 · **VALID** · **N** — reframed the question from "are these the exact canonical specs?" to "are these specs sufficient to rank the tool-selection architectures without p-hacking?". Conclusion: yes, P2 can run on the frozen substitute corpus now, provided the claim is scoped to architecture ranking only, not certification against the eventual CP-served specs. If the MCP audience bug (CAB-2094/2103) is later fixed, fetch canonical specs via `stoa_api_spec action=openapi`, diff against the pinned snapshots, and re-ratify only if the delta is material enough to change disambiguation difficulty or operation-shape coverage. **Decision: P2 is authorized on the frozen substitute corpus for comparative ranking, not for canonical-spec certification.** Erreur évitée = N: clarifies claim boundaries and unblock condition, but does not materially change the frozen P1 plan.
- **#7 · "3 tools dev via gateway STOA locale" (`dev-plan`/`dev-review`/`dev-status` MCP)** · GPT-5 (Codex, background exec) · 5/5 · **VALID** · **Y** — plan proposed 6 phases to expose dev workflow as MCP tools on the local gateway, consumable by Claude Code + Codex. Challenger surfaced the unstated assumption: this is framed as a transport/MCP tooling problem when it's actually a **workflow discipline + artefact format** problem. Claude and Codex already perform plan/review/status natively in the repo; the gateway would interpose a layer between two tools that already work. Under-priced costs: schema matrix (3 tools × I/O × 2 clients), "minimal" auth is a lie (CAB-2121 not even committed), latency on high-frequency low-friction actions, operational debt when k3d/Tilt/gateway/Keycloak break, and frontal collision with active cycle priorities (CAB-2088 demo J-6, CAB-2121 auth gate, CAB-2116 cost fallout). Proposed 3 alternatives: (1) `stoactl dev plan\|review\|status` CLI invoked via Bash (2-4d, 80% value), (2) shared prompt contract + repo script (1-2d, tests real demand), (3) observe native usage first (<1d, establishes baseline). Missing metrics: no baseline, no quantified thresholds, no token/latency cost tracking, no quality metrics (false findings, stale statuses), no stop-loss. **Decision: NO-GO.** Reopen only if CAB-2088 shipped + CAB-2121 merged stable + CAB-2116 fallout absorbed AND a no-gateway pilot proves real demand on 10+ tickets AND gateway locale demonstrates auth/discovery stability on a less fragile use case. Live meta-signal: Claude→Codex challenge was executed via `codex exec` + `run_in_background:true` during this very gate — proving the intended use case is already feasible without building any new MCP surface.

## Phase Gates

- **Phase 0 (now).** Manual challenger. Logs appended in this file.
- **Exit to Phase 1** (n8n semi-automated): ≥ 10 logs over 60 days **AND** ≥ 30 % erreur-évitée rate **AND** avg utility ≥ 3/5. Otherwise: recalibrate prompt or kill.
- **Phase 2** (symmetric dual-council): conditional on Phase 1 gate.

## Discipline

- 30 days without editing this framework. Use it, don't optimise it.
- If this file exceeds one page, the gate fires on itself. Refactor.
