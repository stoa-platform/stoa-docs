---
sidebar_position: 10
title: "Exemples de Politiques OPA"
description: "Templates de politiques Open Policy Agent (OPA) pour STOA — contrôle d'accès aux outils, isolation des tenants et limitation de débit."
keywords: [OPA, Open Policy Agent, policy, access control, Rego]
---

# Exemples de Politiques OPA

STOA utilise Open Policy Agent (OPA) pour un contrôle d'accès granulaire. Ce guide fournit des templates de politiques pour les scénarios courants.

## Vue d'Ensemble

Les politiques OPA dans STOA contrôlent :

- **Accès aux outils** — Quels outils un utilisateur peut invoquer
- **Isolation des tenants** — Garantir la sécurité inter-tenant
- **Limitation de débit** — Limites par tenant ou par utilisateur
- **Filtrage des données** — Masquage des PII et accès au niveau des champs
- **Application des scopes** — Validation des scopes OAuth2

## Structure des Politiques

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

# Refus par défaut
default allow := false

# Règle d'autorisation principale
allow if {
    valid_token
    valid_scope
    valid_tenant
}
```

## Schéma d'Entrée

Les politiques reçoivent cette structure d'entrée :

```json
{
  "token": {
    "sub": "user-id",
    "aud": "stoa-gateway",
    "iss": "https://auth.<YOUR_DOMAIN>",
    "exp": 1707234567,
    "stoa_realm": "tenant-acme",
    "scope": "tools:read tools:execute",
    "roles": ["api-consumer"]
  },
  "request": {
    "method": "POST",
    "path": "/tools/call",
    "tenant_id": "acme",
    "tool_name": "payment:create",
    "arguments": {
      "amount": 100,
      "currency": "EUR"
    }
  },
  "context": {
    "client_ip": "192.168.1.100",
    "user_agent": "claude-code/1.0"
  }
}
```

## Exemples de Politiques

### 1. Isolation des Tenants

S'assurer que les utilisateurs ne peuvent accéder qu'aux outils de leur propre tenant :

```rego
package stoa.gateway.authz

import future.keywords.if

default allow := false

# Autoriser si le realm du token correspond au tenant de la requête
allow if {
    input.token.stoa_realm == input.request.tenant_id
    token_not_expired
}

token_not_expired if {
    now := time.now_ns() / 1000000000
    now < input.token.exp
}
```

### 2. Accès Basé sur les Scopes

Contrôler l'accès en fonction des scopes OAuth2 :

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

default allow := false

# Scopes requis par action
required_scopes := {
    "tools/call": ["tools:execute"],
    "tools/list": ["tools:read"],
    "subscriptions/create": ["subscriptions:write"],
}

allow if {
    # Obtenir les scopes requis pour ce chemin
    required := required_scopes[input.request.path]

    # Vérifier que l'utilisateur a tous les scopes requis
    every scope in required {
        scope in split(input.token.scope, " ")
    }
}
```

### 3. Accès aux Outils Basé sur les Rôles

Restreindre les outils en fonction des rôles utilisateur :

```rego
package stoa.gateway.authz

import future.keywords.if
import future.keywords.in

default allow := false

# Outils autorisés par rôle
role_tools := {
    "admin": ["*"],  # Tous les outils
    "developer": ["catalog:*", "subscription:*"],
    "viewer": ["catalog:list", "catalog:get"],
}

allow if {
    # Obtenir les rôles de l'utilisateur
    some role in input.token.roles

    # Vérifier si l'outil est autorisé pour le rôle
    allowed := role_tools[role]
    tool_allowed(input.request.tool_name, allowed)
}

# Vérifier si l'outil correspond à un pattern autorisé
tool_allowed(tool, allowed) if {
    some pattern in allowed
    glob.match(pattern, [], tool)
}
```

### 4. Politique de Limitation de Débit

Implémenter des limites de débit par tenant :

```rego
package stoa.gateway.ratelimit

import future.keywords.if

# Limites par niveau
tier_limits := {
    "free": {"requests_per_minute": 60, "burst": 10},
    "pro": {"requests_per_minute": 600, "burst": 100},
    "enterprise": {"requests_per_minute": 6000, "burst": 1000},
}

# Obtenir le niveau du tenant depuis des données externes
tenant_tier := data.tenants[input.request.tenant_id].tier

# Retourner la configuration de limite de débit
rate_limit := tier_limits[tenant_tier]
```

### 5. Politique de Masquage des PII

Contrôler quels champs sont visibles :

```rego
package stoa.gateway.masking

import future.keywords.if
import future.keywords.in

# Champs nécessitant un masquage
sensitive_fields := [
    "ssn",
    "credit_card",
    "password",
    "api_key",
    "email",
    "phone",
]

# Déterminer si un champ doit être masqué
mask_field(field_name) if {
    field_name in sensitive_fields
}

# Vérifier si l'utilisateur a un accès élevé
elevated_access if {
    "pii:read" in split(input.token.scope, " ")
}

# Décision finale de masquage
should_mask(field_name) if {
    mask_field(field_name)
    not elevated_access
}
```

### 6. Accès Basé sur le Temps

Restreindre l'accès aux heures ouvrables :

```rego
package stoa.gateway.authz

import future.keywords.if

default allow := false

# Heures ouvrables (UTC)
business_hours := {
    "start": 8,
    "end": 18,
}

allow if {
    # Vérifier si dans les heures ouvrables
    now := time.now_ns()
    hour := time.clock([now, "UTC"])[0]

    hour >= business_hours.start
    hour < business_hours.end

    # Et autres conditions...
    input.token.stoa_realm == input.request.tenant_id
}

# Les admins peuvent accéder à tout moment
allow if {
    "admin" in input.token.roles
}
```

### 7. Validation Spécifique aux Outils

Valider les arguments des outils :

```rego
package stoa.gateway.validation

import future.keywords.if

default valid := false

# Valider les arguments de l'outil de paiement
valid if {
    input.request.tool_name == "payment:create"
    validate_payment_args(input.request.arguments)
}

validate_payment_args(args) if {
    # Le montant doit être positif
    args.amount > 0

    # La devise doit être supportée
    args.currency in ["EUR", "USD", "GBP"]

    # Le destinataire doit être fourni
    count(args.recipient) > 0
}
```

### 8. Politique de Journalisation d'Audit

Déterminer ce qui doit être audité :

```rego
package stoa.gateway.audit

import future.keywords.if
import future.keywords.in

# Toujours auditer ces outils
always_audit := [
    "payment:*",
    "subscription:*",
    "admin:*",
]

# Déterminer le niveau d'audit
audit_level := "full" if {
    some pattern in always_audit
    glob.match(pattern, [], input.request.tool_name)
} else := "minimal" if {
    input.token.roles[_] == "admin"
} else := "none"
```

## Déployer les Politiques

### Mode Embarqué (Par Défaut)

Les politiques sont intégrées avec le MCP Gateway :

```yaml
# values.yaml
gateway:
  opa:
    embedded: true
    policyPath: /policies
```

### Mode Sidecar

OPA s'exécute comme un conteneur séparé :

```yaml
# values.yaml
gateway:
  opa:
    embedded: false
    endpoint: http://localhost:8181
```

### Bundle de Politiques

Packager les politiques comme bundle OPA :

```bash
# Créer le bundle
opa build -b policies/ -o bundle.tar.gz

# Déployer sur S3/GCS
aws s3 cp bundle.tar.gz s3://stoa-policies/bundles/
```

## Tester les Politiques

### Tests Unitaires

```rego
# authz_test.rego
package stoa.gateway.authz

test_allow_same_tenant {
    allow with input as {
        "token": {"stoa_realm": "acme", "exp": 9999999999},
        "request": {"tenant_id": "acme"}
    }
}

test_deny_different_tenant {
    not allow with input as {
        "token": {"stoa_realm": "acme", "exp": 9999999999},
        "request": {"tenant_id": "beta"}
    }
}
```

Exécuter les tests :

```bash
opa test policies/ -v
```

### Tests d'Intégration

```bash
# Tester avec l'interface CLI OPA
opa eval -i input.json -d policies/ "data.stoa.gateway.authz.allow"
```

## Débogage

### Activer les Journaux de Débogage

```yaml
gateway:
  opa:
    logLevel: debug
```

### Journaux de Décision

Interroger les journaux de décision OPA :

```bash
kubectl logs -l app=mcp-gateway -n stoa-system | grep "opa_decision"
```

### Traçage des Politiques

Activer le traçage pour des requêtes spécifiques :

```bash
curl -X POST ${STOA_GATEWAY_URL}/tools/call \
  -H "X-OPA-Trace: true" \
  -d '...'
```

## Références

- [Documentation OPA](https://www.openpolicyagent.org/docs/)
- [Référence du Langage Rego](https://www.openpolicyagent.org/docs/latest/policy-reference/)
- [ADR-012 — Architecture RBAC MCP](/docs/architecture/adr/adr-012-mcp-rbac-architecture)
