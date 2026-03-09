---
sidebar_position: 2
slug: /tutorials/expose-rest-as-mcp
title: "Exposer une API REST comme outil MCP en 10 minutes"
description: "Transformez n'importe quelle API REST en outil MCP que les agents IA peuvent découvrir et appeler — sans modifier votre code."
keywords:
  - REST vers MCP
  - tutoriel outil MCP
  - passerelle API MCP
  - agent IA API
  - tutoriel STOA
---

# Exposer une API REST comme outil MCP

Transformez n'importe quelle API REST en outil MCP que les agents IA peuvent découvrir et appeler — sans aucune modification de votre API.

## Ce que vous allez accomplir

À la fin de ce tutoriel :
- Votre API REST est enregistrée dans STOA
- Elle est découvrable via la découverte d'outils MCP
- Un agent IA peut l'appeler à travers la passerelle gouvernée

## Prérequis

- Une instance STOA (cloud ou [auto-hébergée](/docs/deployment/hybrid))
- Une API REST avec une spécification OpenAPI (ou nous en créerons une simple)

## Étape 1 : Enregistrer votre API

Connectez-vous à la [Console](https://console.gostoa.dev) et naviguez vers **APIs > Créer une API**.

```bash
# Ou via le CLI :
curl -X POST ${STOA_API_URL}/v1/apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "weather-api",
    "description": "Obtenir les prévisions météo par ville",
    "version": "1.0.0",
    "spec_url": "https://api.example.com/openapi.json"
  }'
```

STOA lit votre spécification OpenAPI et crée l'entrée API avec tous les endpoints mappés.

## Étape 2 : Activer l'exposition MCP

Dans la Console, allez dans l'onglet **Paramètres** de votre API et activez **Exposition MCP**.

STOA transforme automatiquement vos opérations OpenAPI en outils MCP :
- `GET /weather/{city}` devient un outil MCP nommé `get-weather`
- Les paramètres deviennent des schémas d'entrée d'outil
- Les schémas de réponse deviennent des descriptions de sortie d'outil

```bash
# Vérifier que les outils MCP sont listés
curl ${STOA_GATEWAY_URL}/mcp/tools/list \
  -H "Authorization: Bearer $TOKEN"
```

Réponse attendue :
```json
{
  "tools": [
    {
      "name": "get-weather",
      "description": "Obtenir les prévisions météo par ville",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "Nom de la ville" }
        },
        "required": ["city"]
      }
    }
  ]
}
```

## Étape 3 : Appeler l'outil via MCP

Un agent IA (ou vous, via curl) peut maintenant appeler l'outil :

```bash
curl -X POST ${STOA_GATEWAY_URL}/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get-weather",
    "arguments": { "city": "Paris" }
  }'
```

STOA gère :
- **Authentification** : valide votre token, applique le RBAC
- **Limitation de débit** : applique le quota de votre plan de souscription
- **Piste d'audit** : enregistre l'appel avec l'identité de l'appelant et le temps de réponse
- **Traduction de protocole** : convertit l'appel MCP en appel REST vers le backend

## Ce qui s'est passé en coulisses

```
Agent IA → MCP tools/call → Passerelle STOA → API REST backend
                                ↓
                           Auth + RBAC
                           Limitation de débit
                           Journalisation d'audit
                           Traduction de protocole
```

Votre API REST n'a pas changé du tout. STOA se place devant, fournissant l'interface MCP et la couche de gouvernance.

## Étapes suivantes

- [Souscrire à une API en libre-service](/docs/tutorials/self-service-subscription)
- [Configurer la limitation de débit](/docs/guides/subscriptions-lifecycle)
- [Mettre en place les tableaux de bord d'observabilité](/docs/guides/observability)
- [Développer des outils MCP personnalisés](/docs/guides/mcp-tools-development)
