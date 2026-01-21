# ADR-011: API Security Mode Selection — mTLS / OAuth2 / Hybrid

## Metadata

| Field | Value |
|-------|-------|
| **Status** | ✅ Accepted |
| **Date** | 11 January 2026 |
| **Linear** | [CAB-410](https://linear.app/hlfh-workspace/issue/CAB-410) |

## Context

STOA Gateway doit supporter plusieurs modes de sécurité API selon les contextes d'usage. Plutôt que de laisser les équipes deviner, nous formalisons un **Decision Tree** qui recommande automatiquement le bon mode.

## Options considérées

| Option | Description | Verdict |
|--------|-------------|---------|
| **mTLS seul** | Authentification par certificat client | ✅ Pour CORE APIs internes |
| **OAuth2 seul** | Tokens JWT avec scopes | ✅ Pour SELF-SERVICE APIs |
| **mTLS + OAuth2** | Double authentification | ✅ Pour APIs critiques exposées |
| **API Key seul** | Secret statique | ⚠️ Community tier uniquement |

## Decision

Implémenter un Decision Tree automatisé pour recommander le mode de sécurité API optimal.

### Decision Tree

```
                    ┌─────────────────────┐
                    │  Type consommateur? │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
         [Interne]                         [Externe]
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐               ┌─────────────────┐
    │  Nature flux?   │               │  OAuth2 requis  │
    └────────┬────────┘               └────────┬────────┘
             │                                  │
    ┌────────┴────────┐                        │
    │                 │                        ▼
  [A2A]           [User]              ┌─────────────────┐
    │                 │               │ Domaine critique?│
    │                 ▼               └────────┬────────┘
    │         OAuth2 requis                    │
    ▼                                 ┌────────┴────────┐
┌─────────────────┐                   │                 │
│Domaine critique?│                 [Oui]            [Non]
└────────┬────────┘                   │                 │
         │                            ▼                 ▼
    ┌────┴────┐              ┌──────────────┐  ┌──────────────┐
    │         │              │ mTLS + OAuth2│  │  OAuth2 seul │
  [Oui]    [Non]             │   (HYBRID)   │  │(SELF-SERVICE)│
    │         │              └──────────────┘  └──────────────┘
    ▼         ▼
┌────────┐ ┌────────────┐
│ mTLS   │ │ OAuth2 ou  │
│ (CORE) │ │ mTLS selon │
└────────┘ │ gouvernance│
           └────────────┘
```

### Règles de décision

| Cas | Conditions | Mode recommandé |
|-----|------------|-----------------|
| **🟢 CORE** | Interne + A2A + Critique + Droits stables | `mTLS` |
| **🔵 SELF-SERVICE** | Externe + User/BFF + DX prioritaire | `OAuth2` |
| **🟣 HYBRID** | Critique + Externe + Gouvernance forte | `mTLS + OAuth2` |

## Consequences

### Positive

- Recommandation automatique et cohérente
- Réduction des erreurs de configuration sécurité
- Documentation des décisions pour audit

### Negative

- Complexité supplémentaire dans le tooling
- Courbe d'apprentissage pour les équipes

### Neutral

- Les équipes peuvent dévier avec justification documentée

## MCP Tool: `security-advisor`

```json
// Input
{
  "consumer_type": "internal | external",
  "flow_type": "a2a | user",
  "rights_variability": "static | dynamic",
  "domain_criticality": "low | high",
  "governance_level": "basic | strong"
}

// Output
{
  "recommended_security_mode": "mTLS | OAuth2 | mTLS+OAuth2",
  "justification": ["Domaine critique", "Flux A2A interne"],
  "risk_level": "low | medium | high",
  "implementation_notes": ["Client cert short-lived", "ABAC policy"]
}
```

## References

- [CAB-410: Decision Tree Implementation](https://linear.app/hlfh-workspace/issue/CAB-410)
- [CAB-361: OAuth2/OIDC Enterprise](https://linear.app/hlfh-workspace/issue/CAB-361)
- ADR-015: Sender-Constrained Tokens (planned)
