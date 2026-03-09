---
slug: building-custom-mcp-tools-stoa
title: "Créer des Outils MCP Personnalisés : Tutoriel Pratique avec Code"
description: "Créez, enregistrez et exposez des outils MCP personnalisés via un gateway. Tutoriel pratique avec exemples Python et bonnes pratiques pour la production."
authors: [stoa-team]
tags: [tutorial, mcp, ai, api-gateway]
keywords:
  - custom MCP tools
  - STOA gateway tutorial
  - MCP tool development
  - AI agent integration
  - Kubernetes CRD tutorial
  - API gateway for AI
---
<!-- last verified: 2026-02 -->

Les outils MCP personnalisés vous permettent d'exposer n'importe quelle API comme une interface native IA que Claude et d'autres agents IA peuvent découvrir et invoquer automatiquement. Ce tutoriel vous guide à travers la création, l'enregistrement et le test d'un outil MCP personnalisé en utilisant le gateway STOA, de la définition YAML initiale jusqu'à l'invocation en direct par un agent IA.

<!-- truncate -->

## Qu'est-ce que les Outils MCP Personnalisés ?

Le [Model Context Protocol (MCP)](/blog/what-is-mcp-gateway) définit une façon standard pour les agents IA de découvrir et d'invoquer des outils externes. Au lieu de coder en dur des appels API ou de construire des intégrations personnalisées pour chaque service, vous définissez les outils comme des ressources déclaratives que les agents peuvent interroger à l'exécution.

STOA implémente MCP comme un gateway natif Kubernetes, ce qui signifie que vos outils sont définis comme des Custom Resource Definitions (CRDs) qui vivent aux côtés de vos manifestes d'application. Une fois enregistrés, ces outils deviennent immédiatement disponibles pour tout agent IA compatible MCP [connecté à votre gateway](/blog/connecting-ai-agents-enterprise-apis).

À la fin de ce tutoriel, vous aurez :
- Un outil MCP fonctionnel qui encapsule une API REST
- Une expérience pratique avec le CRD Tool de STOA
- Un flux de test montrant un agent IA invoquant votre outil
- Une compréhension des patterns de découverte, enregistrement et exécution d'outils

## Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Gateway STOA en fonctionnement** — suivez le [guide de démarrage rapide](/blog/mcp-gateway-quickstart-docker) si vous n'avez pas encore déployé
- **Accès kubectl** à votre cluster Kubernetes (ou Docker Compose pour le développement local)
- **Connaissance de base YAML** — les outils sont définis comme des manifestes Kubernetes
- **Une API REST à encapsuler** — nous utiliserons une API météo publique comme exemple, mais vous pouvez substituer votre propre API interne
- **curl ou httpie** pour les tests (optionnel mais recommandé)

Si vous êtes nouveau aux concepts MCP, consultez d'abord notre [présentation du MCP gateway](/docs/concepts/mcp-gateway).

## Étape 1 : Concevoir la Spécification de Votre Outil

Chaque outil MCP nécessite trois éléments : un nom unique, des paramètres d'entrée (le schéma) et un endpoint à invoquer. Concevons un outil simple de recherche météo.

### API d'Exemple : OpenWeatherMap

Nous allons encapsuler l'endpoint météo actuelle d'OpenWeatherMap :
```
GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}
```

### Décisions de Conception de l'Outil

1. **Nom** : `get_current_weather` — suit la convention de nommage MCP (verbe + nom, snake_case)
2. **Schéma d'entrée** : un seul paramètre requis `city` (chaîne)
3. **Schéma de sortie** : JSON avec les champs `temp`, `description`, `humidity`
4. **Authentification** : clé API passée via paramètre de requête (gérée par l'injection de secret de STOA)

Cette conception s'intègre proprement dans la structure du CRD Tool. Pour les APIs complexes avec plusieurs opérations, envisagez de créer des outils séparés pour chaque endpoint (voir le [guide de développement d'outils MCP](/docs/guides/mcp-tools-development) pour les patterns).

## Étape 2 : Créer le Manifeste CRD Tool

STOA utilise des Custom Resource Definitions Kubernetes pour gérer les outils. Voici le manifeste complet pour notre outil météo :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-current
  namespace: default
  labels:
    app: weather-service
    category: external-api
spec:
  displayName: "Obtenir la Météo Actuelle"
  description: "Récupère les conditions météo actuelles pour une ville via l'API OpenWeatherMap"

  # Schéma d'entrée (format JSON Schema)
  inputSchema:
    type: object
    required:
      - city
    properties:
      city:
        type: string
        description: "Nom de la ville (ex. 'Paris', 'New York')"
        minLength: 2
        maxLength: 100

  # Configuration de l'API backend
  endpoint: "https://api.openweathermap.org/data/2.5/weather"
  method: POST

  # Authentification et secrets
  auth:
    type: apiKey
    apiKey:
      location: query
      name: appid
      secretRef:
        name: openweathermap-creds
        key: api-key

  # Transformation de la requête
  requestTransform:
    queryParams:
      - name: q
        valueFrom: "{{.input.city}}"
      - name: units
        value: "metric"

  # Transformation de la réponse
  responseTransform:
    template: |
      {
        "temperature": {{.response.main.temp}},
        "description": "{{.response.weather[0].description}}",
        "humidity": {{.response.main.humidity}},
        "city": "{{.response.name}}"
      }
```

### Comprendre le Manifeste

| Section | Rôle |
|---------|---------|
| `metadata` | Identification Kubernetes (nom, namespace, labels) |
| `spec.displayName` | Nom lisible affiché dans les listings d'outils MCP |
| `spec.description` | Aide les agents IA à comprendre quand utiliser cet outil |
| `spec.inputSchema` | JSON Schema définissant les paramètres requis/optionnels |
| `spec.endpoint` | URL de l'API backend à invoquer |
| `spec.auth` | Comment s'authentifier (apiKey, bearer, oauth2, mtls) |
| `spec.requestTransform` | Mapper l'entrée MCP vers les paramètres de requête, en-têtes ou corps |
| `spec.responseTransform` | Extraire les champs pertinents de la réponse API pour la consommation par l'agent |

Le template `responseTransform` utilise la syntaxe de template Go pour façonner la réponse JSON verbeuse de l'API en une structure propre que l'agent IA peut facilement analyser.

## Étape 3 : Stocker les Secrets et Appliquer le Manifeste

Avant d'appliquer le CRD Tool, créez un Secret Kubernetes pour la clé API :

```bash
kubectl create secret generic openweathermap-creds \
  --from-literal=api-key=VOTRE_CLÉ_API_ICI \
  -n default
```

Maintenant appliquez le manifeste d'outil :

```bash
kubectl apply -f weather-tool.yaml
```

Vérifiez que l'outil a bien été enregistré :

```bash
kubectl get tools -n default

# Résultat attendu :
# NAME              DISPLAY NAME                  ENDPOINT
# weather-current   Obtenir la Météo Actuelle     https://api.openweathermap.org/...
```

Vérifiez le statut de l'outil :

```bash
kubectl describe tool weather-current -n default
```

La section `Status` affiche :
- **Registered** : l'outil est actif et découvrable
- **Endpoint health** : STOA valide que le backend est accessible
- **Last invocation** : horodatage de la dernière utilisation (vide initialement)

Si le statut affiche `Pending` ou des erreurs, vérifiez les journaux du gateway STOA :

```bash
kubectl logs -n stoa-system deployment/stoa-gateway --tail=50 | grep weather-current
```

## Étape 4 : Tester la Découverte d'Outils

Les agents MCP découvrent les outils via l'endpoint `GET /mcp/v1/tools`. Vérifions que votre outil apparaît dans la liste :

```bash
curl -s https://mcp.gostoa.dev/mcp/v1/tools | jq '.tools[] | select(.name == "get_current_weather")'
```

Réponse attendue :

```json
{
  "name": "get_current_weather",
  "description": "Récupère les conditions météo actuelles pour une ville via l'API OpenWeatherMap",
  "inputSchema": {
    "type": "object",
    "required": ["city"],
    "properties": {
      "city": {
        "type": "string",
        "description": "Nom de la ville (ex. 'Paris', 'New York')"
      }
    }
  }
}
```

C'est exactement le payload qu'un client MCP (comme Claude) reçoit quand il interroge les outils disponibles. Notez comment les champs du CRD se mappent directement au schéma d'outil MCP.

Pour plus de détails sur le protocole de découverte, consultez notre [plongée approfondie dans l'architecture du protocole MCP](/blog/mcp-protocol-architecture-deep-dive).

## Étape 5 : Invoquer l'Outil

Testez maintenant le flux d'invocation de l'outil. Les outils MCP sont invoqués via `POST /mcp/v1/tools/{name}/invoke` :

```bash
curl -X POST https://mcp.gostoa.dev/mcp/v1/tools/get_current_weather/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "city": "Paris"
    }
  }' | jq
```

Réponse attendue :

```json
{
  "result": {
    "temperature": 12.5,
    "description": "nuages épars",
    "humidity": 67,
    "city": "Paris"
  },
  "isError": false
}
```

### Ce qui Vient de Se Passer

1. **L'agent a envoyé** : `{"city": "Paris"}` à l'endpoint MCP de STOA
2. **STOA a transformé** : l'entrée en `GET https://api.openweathermap.org/data/2.5/weather?q=Paris&units=metric&appid=SECRET`
3. **Le backend a répondu** : avec un JSON verbeux incluant des dizaines de champs
4. **STOA a transformé** : la réponse en utilisant le template `responseTransform`, extrayant uniquement les 4 champs définis
5. **L'agent a reçu** : un JSON propre et validé par schéma, prêt pour la génération en langage naturel

Cette couche de transformation est cruciale — elle vous permet d'exposer des APIs d'entreprise complexes avec des schémas complexes comme des outils propres et adaptés à l'IA. Consultez notre guide sur la [conversion d'APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools) pour plus de patterns de transformation.

## Ce que Vous Avez Construit

Vous disposez maintenant d'un outil MCP personnalisé prêt pour la production qui :

- **Vit dans le contrôle de version** — le CRD Tool est un fichier YAML que vous pouvez committer, réviser et suivre aux côtés du code de votre application
- **S'intègre avec le RBAC Kubernetes** — utilisez des namespaces et des role bindings pour contrôler quelles équipes peuvent enregistrer des outils
- **Gère les secrets en toute sécurité** — les clés API n'apparaissent jamais dans les manifestes ou les journaux
- **Transforme les données automatiquement** — les agents reçoivent des réponses propres sans connaître les particularités de l'API backend
- **Se met à l'échelle avec votre infrastructure** — STOA gère la limitation de débit, les nouvelles tentatives et l'observabilité (métriques pour chaque invocation d'outil)

Pour connecter un agent IA comme Claude à votre outil, configurez le client MCP avec l'URL de votre gateway (`https://mcp.gostoa.dev`). L'agent découvrira automatiquement `get_current_weather` et pourra l'invoquer chaque fois qu'un utilisateur pose une question sur les conditions météo.

## Patterns Avancés

### Outils Multi-Étapes

Pour les workflows complexes (ex. "créer un utilisateur, puis envoyer un email"), utilisez des ToolSets pour regrouper les outils liés :

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: ToolSet
metadata:
  name: user-onboarding
spec:
  tools:
    - toolRef:
        name: create-user
    - toolRef:
        name: send-welcome-email
  executionOrder: sequential
```

### Paramètres Dynamiques

Utilisez des templates dans `requestTransform` pour dériver des paramètres du contexte :

```yaml
requestTransform:
  headers:
    - name: X-Tenant-ID
      valueFrom: "{{.context.tenant}}"
    - name: X-Request-ID
      valueFrom: "{{.context.requestId}}"
```

### Validation des Réponses

Ajoutez une validation JSON Schema pour détecter les réponses backend malformées :

```yaml
spec:
  responseSchema:
    type: object
    required: [temperature, city]
    properties:
      temperature:
        type: number
        minimum: -100
        maximum: 100
```

Pour plus de patterns avancés, consultez la [documentation de référence des outils MCP](/docs/reference/mcp-tools).

## Dépannage des Problèmes Courants

| Symptôme | Cause | Solution |
|---------|-------|-----|
| L'outil n'apparaît pas dans les listings | Incompatibilité de namespace ou problème RBAC | Vérifiez `kubectl get tools -A` et le namespace dans curl |
| `401 Unauthorized` lors de l'invocation | Secret non monté ou mauvais nom de clé | Vérifiez que le secret existe : `kubectl get secret openweathermap-creds -o yaml` |
| L'invocation expire | Backend inaccessible ou lent | Ajoutez `spec.timeout: 30s` au manifeste Tool |
| Réponse vide ou malformée | Erreur de template de transformation | Vérifiez les journaux du gateway pour les erreurs d'analyse de template |
| Outil enregistré mais non invocable | L'API backend a changé | Mettez à jour `endpoint` ou `responseTransform` |

## FAQ

### Puis-je encapsuler des APIs internes derrière des pare-feux ?

Oui. STOA s'exécute à l'intérieur de votre cluster Kubernetes, donc les outils peuvent référencer des noms de services internes (ex. `http://user-service.prod.svc.cluster.local`). Pour les APIs hors du cluster, assurez-vous que le pod STOA gateway a accès réseau. Utilisez l'authentification mTLS pour une communication interne sécurisée.

### Comment versionner les outils quand les APIs changent ?

Utilisez le nom de l'outil comme identifiant de version (ex. `weather-v1`, `weather-v2`). Les agents peuvent spécifier quelle version invoquer. Alternativement, mettez à jour l'outil existant et fiez-vous à la validation de schéma de STOA pour détecter les changements incompatibles. Pour les systèmes de production, envisagez des déploiements blue/green où les deux versions s'exécutent simultanément pendant la migration.

### Quelles méthodes d'authentification sont supportées ?

STOA supporte la clé API (requête, en-tête ou cookie), token Bearer, OAuth 2.0 client credentials et mTLS mutuel. Pour OAuth, STOA peut gérer le renouvellement des tokens automatiquement via un CRD `TokenSource`. Consultez le [guide de démarrage MCP](/docs/guides/mcp-getting-started) pour des exemples d'authentification.

## Prochaines Étapes

Maintenant que vous avez construit votre premier outil MCP personnalisé, explorez ces ressources :

- **[Qu'est-ce qu'un MCP Gateway ?](/blog/what-is-mcp-gateway)** — comprendre l'architecture et les principes de conception
- **[Connecter des Agents IA aux APIs d'Entreprise](/blog/connecting-ai-agents-enterprise-apis)** — patterns de déploiement en production et bonnes pratiques de sécurité
- **[MCP Gateway Quickstart avec Docker](/blog/mcp-gateway-quickstart-docker)** — configuration de développement local pour une itération rapide
- **[Guide de Développement d'Outils MCP](/docs/guides/mcp-tools-development)** — référence complète couvrant tous les champs CRD et les patterns de transformation

Pour les questions ou pour partager ce que vous avez construit, rejoignez la discussion sur [GitHub Discussions](https://github.com/stoa-platform/stoa/discussions) ou ouvrez une issue si vous rencontrez un problème. La communauté STOA est là pour vous aider à combler le fossé entre les APIs traditionnelles et le futur natif IA.
