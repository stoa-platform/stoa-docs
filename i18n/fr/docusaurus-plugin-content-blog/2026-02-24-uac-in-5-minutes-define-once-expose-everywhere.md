---
slug: uac-in-5-minutes-define-once-expose-everywhere
title: "Universal API Contract : Définir une Fois, Exposer en REST + MCP"
description: "Un seul contrat API, deux protocoles. Créez une définition UAC et exposez-la simultanément en REST et MCP avec un tutoriel pratique de 5 minutes."
authors: [stoa-team]
tags: [tutorial, quickstart, mcp, api-gateway]
keywords:
  - universal api contract tutorial
  - stoa uac define once expose everywhere
  - api gateway multi-protocol tutorial
  - rest to mcp single contract
  - stoa platform uac getting started
---
<!-- last verified: 2026-02 -->

Vous définissez une API une seule fois. STOA l'expose à la fois comme endpoint REST et comme outil MCP — mêmes politiques, même surveillance, zéro duplication. C'est l'Universal API Contract (UAC), et ce tutoriel vous y guide en 5 minutes.

La plupart des plateformes API vous obligent à maintenir des configurations séparées pour chaque protocole : une pour les consommateurs REST, une autre pour les agents IA via MCP. Cela signifie des limites de débit dupliquées, des règles d'auth dupliquées, et une surface de misconfiguration doublée. L'UAC élimine tout cela.

<!-- truncate -->

## Ce que Vous allez Construire

À la fin de ce tutoriel, vous aurez :

1. Un seul contrat UAC définissant une API météo
2. Un endpoint REST servant les clients HTTP traditionnels
3. Un outil MCP servant les agents IA — depuis le même contrat
4. Une politique de rate limit partagée qui s'applique aux deux protocoles

**Durée** : 5 minutes
**Difficulté** : Débutant
**Prérequis** : Instance STOA en fonctionnement ([Quick Start](/blog/stoa-quickstart-first-api-5-minutes)), curl

:::tip Configurez votre environnement
```bash
export STOA_API_URL="http://localhost:8000"      # Control Plane API
export STOA_GATEWAY_URL="http://localhost:3001"   # Endpoint Gateway
```

Vous utilisez la version hébergée ? Remplacez par `https://api.<YOUR_DOMAIN>` et `https://mcp.<YOUR_DOMAIN>`.
:::

## Étape 1 : Obtenir un Token Admin

Commencez par vous authentifier auprès de la Control Plane API :

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/stoa/protocol/openid-connect/token \
  -d "client_id=control-plane-api" \
  -d "client_secret=your-client-secret" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

Vous utiliserez ce token pour tous les appels API suivants.

## Étape 2 : Créer un Contrat UAC

Un contrat UAC est la source unique de vérité pour votre API. Il définit le backend, l'authentification, les politiques et la visibilité sur le portail — tout en un seul endroit.

```bash
CONTRACT_RESPONSE=$(curl -s -X POST "${STOA_API_URL}/v1/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "weather-api",
    "apiVersion": "1.0.0",
    "tenant": "default",
    "displayName": "Weather API",
    "description": "Current weather data for any city",
    "endpoint": {
      "url": "https://api.open-meteo.com/v1",
      "method": "REST",
      "timeout": "10s"
    },
    "auth": {
      "type": "api_key"
    },
    "policies": [
      {
        "type": "rate_limit",
        "config": {
          "requests_per_minute": 60
        }
      }
    ],
    "portal": {
      "visible": true,
      "categories": ["weather", "demo"]
    }
  }')

CONTRACT_ID=$(echo $CONTRACT_RESPONSE | jq -r .id)
echo "Contract ID: $CONTRACT_ID"
```

Ce seul payload définit tout : l'URL du backend, la méthode d'authentification, la limitation de débit et la liste sur le portail. Aucune configuration spécifique au gateway n'est nécessaire.

## Étape 3 : Vérifier les Bindings de Protocole par Défaut

Quand vous créez un contrat UAC, STOA active automatiquement un binding REST. Vérifiez quels bindings sont actifs :

```bash
curl -s "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}/bindings" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Résultat attendu :

```json
{
  "bindings": [
    {
      "protocol": "rest",
      "enabled": true,
      "path": "/weather-api/v1",
      "created_at": "2026-02-24T10:00:00Z"
    }
  ]
}
```

REST est actif par défaut. Votre API est déjà accessible via le gateway à `/weather-api/v1`. Mais nous voulons que les agents IA y accèdent aussi — ajoutons donc MCP.

## Étape 4 : Activer le Binding MCP

Ajoutez un binding MCP pour que les agents IA puissent découvrir et appeler votre API comme un outil MCP :

```bash
curl -s -X POST "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}/bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "mcp",
    "enabled": true,
    "tool_name": "get_weather",
    "tool_description": "Get current weather for a city"
  }' | jq .
```

Maintenant le même contrat est exposé sur deux protocoles. La limite de débit de 60 requêtes/minute s'applique aux deux — aucune politique séparée n'est nécessaire.

## Étape 5 : Tester l'Endpoint REST

Appelez l'API météo via le chemin REST du gateway :

```bash
curl -s "${STOA_GATEWAY_URL}/weather-api/v1/forecast?latitude=48.85&longitude=2.35" \
  -H "X-API-Key: your-api-key" | jq '.current_weather'
```

Vous devriez voir des données météo pour Paris. La requête a traversé le pipeline middleware de STOA : authentification, rate limiting, journalisation — tout défini dans votre contrat UAC.

## Étape 6 : Tester l'Outil MCP

Appelez maintenant la même API comme outil MCP. Les agents IA utilisent ce format pour découvrir et invoquer les outils :

```bash
# Lister les outils disponibles (découverte MCP)
curl -s "${STOA_GATEWAY_URL}/mcp/tools/list" \
  -H "Authorization: Bearer $TOKEN" | jq '.tools[] | select(.name == "get_weather")'
```

Résultat attendu :

```json
{
  "name": "get_weather",
  "description": "Get current weather for a city",
  "inputSchema": {
    "type": "object",
    "properties": {
      "latitude": { "type": "number" },
      "longitude": { "type": "number" }
    }
  }
}
```

Appelez l'outil :

```bash
curl -s -X POST "${STOA_GATEWAY_URL}/mcp/tools/call" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_weather",
    "arguments": {
      "latitude": 48.85,
      "longitude": 2.35
    }
  }' | jq .
```

Même backend. Même rate limit. Même piste d'audit. Deux protocoles.

## Étape 7 : Vérifier les Politiques Partagées

Le rate limit s'applique aux deux protocoles. Vérifions en consultant la politique attachée au contrat :

```bash
curl -s "${STOA_API_URL}/v1/contracts/${CONTRACT_ID}" \
  -H "Authorization: Bearer $TOKEN" | jq '.policies'
```

```json
[
  {
    "type": "rate_limit",
    "config": {
      "requests_per_minute": 60
    },
    "applied_to": ["rest", "mcp"]
  }
]
```

Le champ `applied_to` confirme que les deux bindings partagent la politique. Si un consommateur utilise 50 requêtes via REST, il lui en reste 10 pour les appels MCP — c'est un pool de quota unique.

---

## Ce que Vous avez Construit

En 5 minutes, vous avez expérimenté la proposition de valeur centrale de STOA :

| Quoi | Approche Traditionnelle | Approche UAC |
|------|------------------------|--------------|
| **Définition API** | Une config par gateway | Un contrat UAC |
| **Support protocole** | Configs REST + MCP séparées | Contrat unique, plusieurs bindings |
| **Rate limiting** | Politiques dupliquées par protocole | Politique partagée, quota unique |
| **Surveillance** | Tableaux de bord séparés | Piste d'audit unifiée |

C'est le modèle "Define Once, Expose Everywhere". Au fur et à mesure que STOA ajoute des bindings de protocole (GraphQL et gRPC sont sur la [feuille de route](/docs/roadmap)), vos contrats existants gagnent de nouvelles capacités sans reconfiguration.

---

## Scénario Concret : Un SaaS avec Consommateurs Humains et IA

Imaginez que vous gérez un SaaS de logistique. Votre API REST sert votre tableau de bord web et votre application mobile. Maintenant un client veut que son assistant IA interroge automatiquement l'état des expéditions.

Sans UAC, vous construiriez et maintiendriez une intégration MCP séparée : nouvelles routes, nouvelle config d'auth, nouvelles limites de débit, nouvelle surveillance. Quand vous mettez à jour le schéma d'expédition, vous le mettez à jour à deux endroits. Quand vous changez les limites de débit, vous les changez à deux endroits. Quand quelque chose casse, vous déboguez deux systèmes.

Avec UAC, vous ajoutez une ligne — le binding MCP — et votre contrat existant, les politiques et la surveillance couvrent les deux cas d'usage. L'assistant IA bénéficie de la même auth, des mêmes limites de débit et de la même piste d'audit que votre tableau de bord web. Les changements de schéma se propagent automatiquement aux deux protocoles car il n'y a qu'une seule source de vérité.

Ce n'est pas hypothétique. À mesure que les agents IA deviennent des consommateurs d'API de première classe aux côtés des humains, les plateformes qui les traitent comme un simple binding de protocole vont s'adapter. Celles qui maintiennent des piles API parallèles ne le feront pas.

---

## Comment UAC Fonctionne Sous le Capot

L'UAC est une **définition d'API normalisée et agnostique au gateway**. Quand vous créez un contrat, le control plane de STOA le stocke comme source de vérité. Quand vous ajoutez des bindings, l'[Adaptateur Gateway](/docs/concepts/uac) traduit l'UAC dans le format requis par le gateway cible.

```
           ┌──── Binding REST ──── Clients HTTP
UAC ───────┤
           └──── Binding MCP  ──── Agents IA (Claude, GPT, etc.)
```

Si vous connectez ensuite un gateway Kong ou Gravitee, le même contrat UAC se synchronise automatiquement dans leur format natif. Consultez la [vue d'ensemble de l'architecture](/docs/concepts/architecture) pour la vue complète.

L'insight clé est que les bindings de protocole sont des **vues** du contrat, pas des copies. Il n'y a pas de problème de synchronisation car il n'y a rien à synchroniser — un contrat, plusieurs chemins de lecture.

### Que se Passe-t-il Quand Vous Changez Quelque Chose ?

| Action | Effet sur REST | Effet sur MCP |
|--------|---------------|---------------|
| Mettre à jour l'URL backend | Immédiat | Immédiat |
| Changer le rate limit | S'applique aux requêtes REST | S'applique aux appels d'outils MCP |
| Faire pivoter une clé API | Les appels REST ont besoin d'une nouvelle clé | Auth MCP inchangée (utilise OAuth) |
| Ajouter un nouveau champ au schéma | Disponible dans la réponse REST | Disponible dans la sortie de l'outil MCP |
| Désactiver l'API | REST retourne 404 | L'outil MCP disparaît du listing |

Pas de maintenance double. Pas de dérive entre les configurations.

---

## FAQ

### Puis-je ajouter des bindings GraphQL ou gRPC ?

Pas encore. REST et MCP sont actuellement supportés. Les bindings GraphQL et gRPC sont planifiés — vérifiez la [feuille de route](/docs/roadmap) pour le calendrier. Quand ils seront disponibles, vos contrats UAC existants les supporteront sans changements.

### En quoi cela diffère-t-il de créer deux APIs séparées ?

Deux APIs séparées signifient deux ensembles de politiques, deux flux de surveillance, et deux points de panne. Avec UAC, vous gérez un seul contrat. Les changements de limites de débit, de règles d'auth ou d'URLs de backend se propagent instantanément à tous les bindings de protocole.

### Qu'en est-il de l'authentification ?

UAC supporte les types d'auth `oauth2`, `api_key`, `basic` et `none`. La configuration d'auth s'applique à tous les bindings. Pour l'auth spécifique au protocole (ex : MCP OAuth 2.1 avec PKCE), STOA gère la traduction au niveau de la couche gateway.

### Puis-je utiliser UAC avec mon gateway Kong ou Apigee existant ?

Oui. Le pattern d'adaptateur de STOA supporte [7 backends gateway](/docs/concepts/architecture), incluant Kong, Gravitee, Apigee, Azure APIM et AWS API Gateway. Le contrat UAC est traduit dans le format natif de chaque gateway.

---

## Prochaines Étapes

- **[Plongée Conceptuelle UAC](/docs/concepts/uac)** — comprendre le schéma complet UAC, les types de politiques et le flux GitOps
- **[Quick Start : Première API en 5 Minutes](/blog/stoa-quickstart-first-api-5-minutes)** — déployez STOA localement avec Docker Compose
- **[MCP Gateway avec Docker](/blog/mcp-gateway-quickstart-docker)** — configuration pratique du gateway MCP
- **[Semaine 1 avec STOA : Runbook d'Opérations](/blog/week-1-with-stoa-operations-runbook)** — de l'installation à la production en 7 jours
- **[Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway)** — architecture et modèle de sécurité expliqués
