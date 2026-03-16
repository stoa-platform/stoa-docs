---
slug: kong-vs-stoa-mcp-gateway
title: "Kong Gateway en 2026 : ce qui manque pour les agents IA (et comment STOA le complète)"
authors: [stoa-team]
tags: [comparison, mcp, ai, api-gateway]
description: "Kong ne supporte pas nativement le protocole MCP. Comparaison Kong vs STOA pour exposer vos APIs aux agents IA. Zéro migration, MCP-ready en 1 jour."
keywords:
  - Kong MCP gateway
  - Kong vs STOA MCP
  - MCP API gateway comparison
  - AI agent gateway 2026
  - Kong AI MCP proxy
  - MCP tool discovery
  - Kong MCP plugin
  - API gateway for AI agents
  - Model Context Protocol gateway
  - enterprise MCP gateway
---

<!-- last verified: 2026-02 -->

Kong et STOA supportent tous les deux le Model Context Protocol, mais ils l'abordent depuis des directions opposées. Kong a ajouté MCP via des plugins sur sa pile éprouvée Nginx/Lua. STOA a intégré MCP dans le cœur du gateway dès le premier jour. Cet article compare les deux spécifiquement sur les capacités MCP — découverte d'outils, transport, authentification, gouvernance et support des workflows d'agents — pour vous aider à choisir le bon MCP gateway pour votre architecture d'agents IA.

<!-- truncate -->

:::info Articles liés
Pour une comparaison générale de STOA et Kong (multi-tenancy, licences, souveraineté), consultez [STOA vs Kong : API Gateway pour l'ère IA](/blog/stoa-vs-kong). Pour les fondamentaux du protocole MCP, consultez [Architecture du protocole MCP en profondeur](/blog/mcp-protocol-architecture-deep-dive). Pour un panorama plus large des gateways, consultez le [Guide des API Gateways Open Source 2026](/blog/open-source-api-gateway-2026).
:::

## Le support MCP en un coup d'œil

Les deux gateways peuvent proxifier le trafic MCP. La différence réside dans le degré d'intégration de MCP dans l'architecture du gateway.

| Capacité MCP | Kong (Gateway 3.12+) | STOA |
|---|---|---|
| **Transport MCP** | Proxy HTTP via le plugin AI MCP Proxy | SSE natif + JSON-RPC dans le cœur du gateway |
| **Découverte d'outils** | Catalogue API basé sur Konnect (Enterprise) | Catalogues d'outils par tenant via CRDs |
| **OAuth 2.1 pour agents** | Plugin AI MCP OAuth2 + plugin OAuth2 standard | OAuth 2.1 natif avec PKCE, stripping de scopes DCR |
| **Autorisation au niveau outil** | Plugin MCP ACL (depuis la 3.13) | Moteur de politiques OPA — par outil, par tenant, par portée |
| **Identité agent** | Identité consommateur standard | Injection de contexte JWT agent-aware |
| **Comptage d'utilisation** | Vitals (Enterprise) ou plugin Prometheus | Comptage Kafka intégré par agent, par outil, par tenant |
| **Négociation de protocole** | N/A (proxy HTTP) | Négociation de version MCP (2025-03-26 / 2025-11-25) |
| **mTLS pour agents** | Plugin mTLS standard | mTLS avec chemins de bypass OAuth pour la découverte MCP |
| **Injection de contexte Skill** | N/A | Injection native de l'en-tête `X-Skill-Context` |
| **UAC (définir une fois, exposer partout)** | N/A | REST + MCP + GraphQL depuis une seule définition d'API |

## Découverte d'outils

La façon dont les agents IA trouvent les outils disponibles est le point de départ de toute interaction MCP.

### L'approche de Kong

Kong a ajouté un serveur MCP pour son plan de contrôle Konnect (gestion d'API hébergée dans le cloud). Lorsqu'il est connecté à Konnect, les agents IA peuvent découvrir les APIs enregistrées dans le catalogue de services. Pour Kong auto-hébergé (sans Konnect), la découverte d'outils repose sur la connaissance préalable des endpoints par l'agent — il n'existe pas de mécanisme de découverte intégré dans le gateway open source.

Le plugin AI MCP Proxy route les requêtes MCP vers des serveurs MCP en amont. Il gère bien le proxying HTTP mais n'ajoute pas de couche de découverte par-dessus. Vous configurez des routes par serveur MCP, et les agents doivent savoir quelle route appeler.

### L'approche de STOA

STOA utilise des CRDs Kubernetes (`Tool` et `ToolSet`) comme catalogue d'outils. Chaque tenant obtient une vue filtrée des outils disponibles en fonction de ses portées et de son namespace. Un agent IA se connectant via le transport SSE de MCP ne reçoit que les outils qu'il est autorisé à voir — pas de sur-récupération, pas de configuration manuelle de routes.

```yaml
apiVersion: gostoa.dev/v1alpha1
kind: Tool
metadata:
  name: weather-api
  namespace: tenant-acme
spec:
  displayName: Weather Lookup
  description: Get current weather for a city
  endpoint: https://api.weather.example/v1/current
  method: GET
  scopes: ["stoa:read"]
```

Le gateway résout ces CRDs à l'exécution. Lorsqu'un nouvel outil est ajouté au namespace d'un tenant, les agents le découvrent lors de leur prochain appel `tools/list` sans aucun redémarrage du gateway ni rechargement de configuration.

### Différence clé

La découverte de Kong fonctionne au niveau du plan de contrôle (Konnect), nécessitant un abonnement Enterprise pour une expérience complète. La découverte de STOA est intégrée dans le gateway open source via des CRDs Kubernetes — aucun tier commercial requis.

## Authentification et autorisation

MCP introduit de nouveaux défis d'authentification : les agents IA ne sont pas des développeurs humains. Ils ont besoin de flux d'authentification automatisés (sans redirections navigateur) avec des permissions finement granulaires au niveau outil.

### L'approche de Kong

Le plugin AI MCP OAuth2 de Kong fournit des flux OAuth 2.0 pour les connexions MCP. Combiné au plugin OAuth2 standard et au nouveau plugin MCP ACL (Gateway 3.13), vous pouvez contrôler quels consommateurs accèdent à quelles routes MCP. Le plugin ACL supporte les listes d'autorisation/blocage par route de serveur MCP.

C'est une approche solide qui tire parti du système de plugins mature de Kong. La limitation est la granularité : les ACLs opèrent au niveau de la route (quel serveur MCP), et non au niveau de l'outil (quel outil spécifique au sein d'un serveur).

### L'approche de STOA

STOA implémente OAuth 2.1 avec PKCE nativement dans le gateway, incluant l'enregistrement dynamique de clients (DCR) automatisé. Lorsqu'un agent IA (comme Claude) se connecte :

1. L'agent découvre les métadonnées OAuth via RFC 9728 (`/.well-known/oauth-protected-resource`)
2. DCR crée automatiquement un client public avec PKCE
3. Le gateway supprime les portées problématiques des payloads DCR (évitant le remplacement des portées par défaut de Keycloak)
4. Chaque invocation d'outil passe par OPA avec le contexte complet : tenant, portées, identité agent et métadonnées outil

L'autorisation est par outil, pas par route. Un agent peut avoir la portée `stoa:read` (autorisant les outils en lecture seule) mais pas `stoa:write` — ceci est appliqué à chaque invocation `tools/call` par OPA, et non au niveau de la connexion MCP.

### Différence clé

Kong autorise au niveau route/serveur via des plugins. STOA autorise au niveau de l'invocation individuelle d'outil via des politiques OPA. Pour les architectures où différents outils au sein d'un même serveur MCP requièrent des niveaux de permission différents, l'approche de STOA offre une granularité plus fine sans configuration supplémentaire de plugins.

## Transport et protocole

### L'approche de Kong

Le plugin AI MCP Proxy fonctionne comme un reverse proxy HTTP. Le trafic MCP est proxifié en tant que requêtes HTTP standard vers des serveurs MCP en amont. Cela fonctionne bien pour les transports MCP basés sur HTTP, mais le plugin ne participe pas au protocole MCP lui-même — Kong n'analyse pas et ne comprend pas les messages JSON-RPC qui le traversent.

### L'approche de STOA

Le gateway de STOA comprend nativement le protocole MCP. Il analyse les messages JSON-RPC, gère les connexions SSE et traite la négociation de version de protocole. Cela signifie que le gateway peut :

- **Filtrer les listes d'outils** par tenant avant qu'elles n'atteignent l'agent (pas seulement proxifier la liste complète de l'upstream)
- **Injecter du contexte** dans les appels d'outils (en-têtes `X-Skill-Context`, claims JWT)
- **Comptabiliser par invocation d'outil** avec des données structurées (quel agent a appelé quel outil, avec quels paramètres, à quel coût)
- **Négocier les versions de protocole** entre agents attendant différentes versions de la spec MCP

Le compromis est clair : l'approche proxy de Kong est plus simple et fonctionne avec n'importe quel serveur MCP en amont sans modification. L'approche native de STOA ajoute une couche de traitement mais permet une gouvernance plus riche.

## Support des workflows d'agents

Les architectures d'agents IA modernes impliquent des workflows multi-étapes : un agent découvre des outils, sélectionne le bon, l'appelle avec du contexte, et utilise le résultat pour décider de la prochaine action. Le rôle du gateway dans ce workflow détermine le niveau de contrôle que vous avez sur le comportement des agents.

### Kong

Kong se concentre sur la couche proxy. Il route les requêtes MCP de manière fiable, applique les limites de débit et l'authentification, et journalise le trafic. La logique de workflow des agents réside dans le framework d'agent (LangChain, CrewAI, AutoGen) — Kong ne participe pas à la sélection des outils et ne l'influence pas.

### STOA

STOA participe au workflow au niveau de la gouvernance :

- **Injection de contexte Skill** : lorsqu'un agent appelle un outil, STOA peut injecter du contexte supplémentaire (paramètre `_skill_context`) fournissant à l'agent une configuration pertinente, un historique ou des contraintes
- **Liste blanche d'outils** : les administrateurs définissent quels outils les agents d'un tenant peuvent utiliser — l'agent ne voit jamais les outils non autorisés
- **Limites de débit par outil** : différentes limites de débit par outil (un outil de recherche peut autoriser 100 appels/minute tandis qu'un outil d'écriture en autorise 10)
- **Pistes d'audit** : chaque invocation d'outil est journalisée avec le contexte complet (identité agent, outil, paramètres, réponse) vers Kafka pour la conformité

## Quand choisir quoi

**Choisissez Kong pour MCP si :**
- Vous utilisez déjà Kong et souhaitez ajouter un proxying MCP basique sans changer votre stack.
- Vos besoins MCP sont simples : proxifier le trafic MCP vers des serveurs en amont, appliquer une authentification standard.
- Vous utilisez Konnect (Enterprise) et souhaitez une découverte d'outils basée sur le catalogue API pour les agents.
- Les ACLs au niveau route sont suffisantes pour votre modèle d'autorisation.
- Vous appréciez l'écosystème de plugins mature de Kong pour les besoins non-MCP (transformations, logging, cache).

**Choisissez STOA pour MCP si :**
- MCP est un protocole primaire dans votre architecture, pas un ajout à une gestion REST existante.
- Vous avez besoin d'une autorisation par outil (politiques OPA) au-delà des ACLs au niveau route.
- L'isolation multi-tenant des outils est requise (différents tenants voient différents catalogues d'outils).
- Vous souhaitez une gouvernance protocol-aware : filtrage d'outils, injection de contexte, comptage par outil.
- Vous préférez la découverte d'outils open source (CRDs) plutôt qu'un plan de contrôle commercial.
- La souveraineté des données européenne est une exigence pour votre trafic MCP.

**Envisagez les deux (mode sidecar) si :**
- Kong gère votre trafic REST/GraphQL et vous souhaitez STOA spécifiquement pour la gouvernance MCP.
- Vous souhaitez évaluer les capacités MCP de STOA aux côtés de votre déploiement Kong existant.

## Contexte de l'écosystème MCP

Kong et STOA font tous deux partie d'un écosystème MCP plus large. Pour comprendre comment MCP se compare aux autres approches d'intégration d'agents IA, consultez [MCP vs Function Calling vs LangChain](/blog/mcp-vs-openai-function-calling-vs-langchain). Pour un tutoriel pratique sur la construction d'outils MCP, consultez [Convertir des APIs REST en outils MCP](/blog/convert-rest-api-to-mcp-tools).

Le protocole MCP évolue rapidement. L'approche par plugins de Kong leur permet d'itérer rapidement sur le support MCP au fur et à mesure des évolutions de la spec. L'approche native de STOA signifie que les mises à jour de protocole nécessitent des releases du gateway, mais garantissent une intégration plus profonde. Les deux stratégies ont leurs mérites — le bon choix dépend de si MCP est une préoccupation primaire ou l'un des nombreux protocoles que votre gateway gère.

---

## FAQ

### Kong supporte-t-il MCP nativement ?

Kong supporte MCP via des plugins, pas nativement dans le cœur du gateway. Le plugin AI MCP Proxy (Gateway 3.12+) proxifie le trafic MCP, et le plugin AI MCP OAuth2 gère l'authentification des agents. Ces plugins fonctionnent bien pour le proxying MCP standard, mais opèrent au niveau HTTP plutôt qu'en analysant les messages du protocole MCP.

### Puis-je utiliser Kong et STOA ensemble ?

Oui. Le mode de déploiement sidecar de STOA est conçu précisément pour ce scénario. Routez le trafic MCP vers STOA tandis que Kong continue de gérer REST et GraphQL. Consultez le [guide de migration Kong](/docs/guides/migration/kong) pour une configuration étape par étape.

### Quel gateway est le meilleur pour la découverte d'outils MCP ?

Cela dépend de votre infrastructure. Kong offre la découverte d'outils via Konnect (plan de contrôle Enterprise). STOA offre la découverte d'outils via des CRDs Kubernetes (open source, auto-hébergé). Si vous utilisez déjà Konnect, la découverte de Kong s'intègre de façon transparente. Si vous utilisez Kubernetes auto-hébergé, la découverte basée sur les CRDs de STOA ne nécessite aucun abonnement commercial.

### Le support MCP est-il stable dans les deux gateways ?

Kong a ajouté le support MCP dans Gateway 3.12 (octobre 2025) avec des améliorations continues dans la 3.13. STOA intègre MCP comme protocole de base depuis sa première release. Les deux implémentations sont prêtes pour la production, mais le protocole MCP lui-même est encore en évolution (spec actuelle : 2025-03-26, avec 2025-11-25 en draft).

### Comment fonctionnent les limites de débit pour MCP dans chaque gateway ?

Kong applique les limites de débit au niveau de la route en utilisant son plugin Rate Limiting standard. STOA supporte des limites de débit par outil — différents outils au sein d'une même connexion MCP peuvent avoir des limites différentes, appliquées par les politiques OPA et suivies via le comptage Kafka.

---

*Vous évaluez des MCP gateways pour votre infrastructure d'agents IA ? [Essayez le démarrage rapide STOA](/docs/guides/quickstart) pour voir la découverte d'outils MCP, OAuth 2.1 et la gouvernance par outil en action.*

> **Avertissement :** Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible en date de février 2026. Les capacités des produits changent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque fournisseur. Toutes les marques commerciales appartiennent à leurs propriétaires respectifs.
