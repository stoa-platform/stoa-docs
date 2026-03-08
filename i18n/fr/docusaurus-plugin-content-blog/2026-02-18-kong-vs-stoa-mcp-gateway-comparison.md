---
slug: kong-vs-stoa-mcp-gateway
title: "Kong vs STOA : fédérer plutôt que remplacer"
authors: [stoa-team]
tags: [comparison, mcp, ai, api-gateway]
description: "Kong n'a pas de support MCP natif en 2026. Benchmarks de découverte d'outils, OAuth 2.1 et transport SSE — et les alternatives open source."
keywords:
  - Kong vs STOA MCP
  - Kong MCP gateway
  - comparatif API gateway MCP
  - gateway agent IA 2026
  - alternative Kong open source
  - MCP découverte outils
  - Kong plugin MCP
  - API gateway pour agents IA
  - Model Context Protocol gateway
  - gateway MCP enterprise
  - Kong migration
---

<!-- last verified: 2026-03 -->

Kong et STOA supportent tous les deux le Model Context Protocol, mais avec des philosophies opposées. Kong a ajouté MCP via des plugins sur sa stack éprouvée Nginx/Lua. STOA a intégré MCP au cœur du gateway dès le premier jour. Cet article compare les deux spécifiquement sur les capacités MCP — découverte d'outils, transport, authentification, gouvernance et support des workflows d'agents — pour vous aider à choisir le bon MCP gateway pour votre architecture d'agents IA.

<!-- truncate -->

:::info Articles liés
Pour un comparatif général STOA/Kong (multi-tenancy, licences, souveraineté), voir [STOA vs Kong : API Gateway pour l'ère de l'IA](/blog/stoa-vs-kong). Pour les fondamentaux du protocole MCP, voir [MCP Protocol Deep Dive](/blog/mcp-protocol-architecture-deep-dive). Pour un panorama plus large, voir [Guide API Gateway Open Source 2026](/blog/open-source-api-gateway-2026).
:::

## Support MCP en un coup d'œil

Les deux gateways peuvent proxy du trafic MCP. La différence réside dans la profondeur d'intégration de MCP dans l'architecture du gateway.

| Capacité MCP | Kong (Gateway 3.12+) | STOA |
|---|---|---|
| **Transport MCP** | Proxy HTTP via plugin AI MCP Proxy | SSE + JSON-RPC natifs dans le cœur du gateway |
| **Découverte d'outils** | Catalogue API via Konnect (Enterprise) | Catalogues d'outils CRD par tenant |
| **OAuth 2.1 pour agents** | Plugin AI MCP OAuth2 + plugin OAuth2 standard | OAuth 2.1 natif avec PKCE, suppression de scope DCR |
| **Autorisation par outil** | Plugin MCP ACL (depuis 3.13) | Moteur de politiques OPA — par outil, par tenant, par scope |
| **Identité agent** | Identité consumer standard | Injection de contexte JWT agent-aware |
| **Métrologie d'usage** | Vitals (Enterprise) ou plugin Prometheus | Métrologie Kafka native par agent, par outil, par tenant |
| **Négociation de protocole** | N/A (proxy HTTP) | Négociation de version MCP (2025-03-26 / 2025-11-25) |
| **mTLS pour agents** | Plugin mTLS standard | mTLS avec chemins de bypass OAuth pour la découverte MCP |
| **Injection de contexte Skill** | N/A | Injection native d'en-tête `X-Skill-Context` |
| **UAC (définir une fois, exposer partout)** | N/A | REST + MCP + GraphQL depuis une seule définition d'API |

## Découverte d'outils

La manière dont les agents IA trouvent les outils disponibles est le point de départ de toute interaction MCP.

### L'approche Kong

Kong a ajouté un serveur MCP pour son control plane Konnect (gestion d'API cloud). Connectés à Konnect, les agents IA peuvent découvrir les API enregistrées dans le catalogue de services. Pour Kong auto-hébergé (sans Konnect), la découverte d'outils repose sur la connaissance préalable des endpoints par l'agent — il n'y a pas de mécanisme de découverte intégré dans le gateway open source.

Le plugin AI MCP Proxy route les requêtes MCP vers les serveurs MCP upstream. Il gère bien le proxying HTTP mais n'ajoute pas de couche de découverte. Vous configurez des routes par serveur MCP, et les agents doivent savoir quelle route appeler.

### L'approche STOA

STOA utilise des CRD Kubernetes (`Tool` et `ToolSet`) comme catalogue d'outils. Chaque tenant obtient une vue filtrée des outils disponibles en fonction de ses scopes et de son namespace. Un agent IA se connectant via le transport SSE de MCP ne reçoit que les outils qu'il est autorisé à voir — pas de sur-récupération, pas de configuration manuelle de routes.

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

Le gateway résout ces CRD au runtime. Quand un nouvel outil est ajouté au namespace d'un tenant, les agents le découvrent lors de leur prochain appel `tools/list` sans redémarrage ni rechargement de configuration du gateway.

### Différence clé

La découverte Kong fonctionne au niveau du control plane (Konnect), nécessitant un abonnement Enterprise pour l'expérience complète. La découverte STOA est intégrée au gateway open source via des CRD Kubernetes — aucun tier commercial requis.

:::info Enjeu pour les grandes entreprises françaises

Dans les architectures SI des banques et assureurs français, les équipes d'intégration gèrent souvent des centaines d'API internes via des catalogues centralisés (webMethods, Axway). La découverte d'outils MCP doit s'intégrer dans cette gouvernance existante : les équipes métier enregistrent leurs outils, les agents IA les découvrent dans le périmètre de leur tenant, et le RSSI conserve la visibilité sur l'ensemble via le portail développeur.

L'approche CRD de STOA s'adapte naturellement au modèle Kubernetes-native déjà adopté par les DSI qui ont modernisé leur infrastructure. L'approche Konnect de Kong convient aux organisations qui préfèrent une solution SaaS gérée — mais pose la question de la résidence des données du catalogue d'API.

:::

## Authentification et autorisation

MCP introduit de nouveaux défis d'authentification : les agents IA ne sont pas des développeurs humains. Ils ont besoin de flux de credentials automatisés (pas de redirection navigateur) avec des permissions fines au niveau outil.

### L'approche Kong

Le plugin AI MCP OAuth2 de Kong fournit les flux OAuth 2.0 pour les connexions MCP. Combiné au plugin OAuth2 standard et au nouveau plugin MCP ACL (Gateway 3.13), vous pouvez contrôler quels consumers accèdent à quelles routes MCP. Le plugin ACL supporte des listes allow/deny par route de serveur MCP.

C'est une approche solide qui exploite le système de plugins mature de Kong. La limitation est la granularité : les ACL opèrent au niveau route (quel serveur MCP), pas au niveau outil (quel outil spécifique au sein d'un serveur).

### L'approche STOA

STOA implémente OAuth 2.1 avec PKCE nativement dans le gateway, incluant l'enregistrement dynamique de client (DCR) automatisé. Quand un agent IA (comme Claude) se connecte :

1. L'agent découvre les métadonnées OAuth via RFC 9728 (`/.well-known/oauth-protected-resource`)
2. Le DCR crée un client public avec PKCE automatiquement
3. Le gateway supprime les scopes problématiques des payloads DCR (empêchant le remplacement des scopes par défaut Keycloak)
4. Chaque invocation d'outil passe par OPA avec le contexte complet : tenant, scopes, identité agent et métadonnées de l'outil

L'autorisation est par outil, pas par route. Un agent peut avoir le scope `stoa:read` (autorisant les outils en lecture seule) mais pas `stoa:write` — c'est appliqué à chaque invocation `tools/call` par OPA, pas au niveau de la connexion MCP.

### Différence clé

Kong autorise au niveau route/serveur via des plugins. STOA autorise au niveau de chaque invocation d'outil via des politiques OPA. Pour les architectures où différents outils au sein du même serveur MCP nécessitent des niveaux de permission différents, l'approche STOA offre une granularité plus fine sans configuration de plugin supplémentaire.

:::tip Conformité DORA : granularité d'autorisation

Le règlement DORA exige des établissements financiers qu'ils appliquent le **principe du moindre privilège** aux accès aux systèmes critiques (article 9). Dans le contexte des agents IA, cela signifie qu'un agent autorisé à lire les données client ne doit pas pouvoir les modifier — même si les deux outils (lecture et écriture) sont exposés via le même serveur MCP.

L'autorisation par route (Kong) nécessite de séparer les outils en lecture et en écriture sur des serveurs MCP distincts pour atteindre cette granularité. L'autorisation par outil (STOA/OPA) l'applique nativement au sein du même serveur, ce qui simplifie l'architecture tout en respectant les exigences réglementaires.

:::

## Transport et protocole

### L'approche Kong

Le plugin AI MCP Proxy opère comme un reverse proxy HTTP. Le trafic MCP est proxié comme des requêtes HTTP standard vers les serveurs MCP upstream. Cela fonctionne bien pour les transports MCP basés sur HTTP mais ne participe pas au protocole MCP lui-même — Kong ne parse ni ne comprend les messages JSON-RPC qui le traversent.

### L'approche STOA

Le gateway STOA comprend le protocole MCP nativement. Il parse les messages JSON-RPC, gère les connexions SSE, et assure la négociation de version du protocole. Cela signifie que le gateway peut :

- **Filtrer les listes d'outils** par tenant avant qu'elles n'atteignent l'agent (pas simplement proxier la liste complète de l'upstream)
- **Injecter du contexte** dans les appels d'outils (en-têtes `X-Skill-Context`, claims JWT)
- **Mesurer par invocation d'outil** avec des données structurées (quel agent a appelé quel outil, avec quels paramètres, à quel coût)
- **Négocier les versions du protocole** entre agents attendant différentes versions de la spec MCP

Le compromis est clair : l'approche proxy de Kong est plus simple et fonctionne avec tout serveur MCP upstream sans modification. L'approche native de STOA ajoute une couche de traitement mais permet une gouvernance plus riche.

## Support des workflows d'agents

Les architectures d'agents IA modernes impliquent des workflows multi-étapes : un agent découvre les outils, sélectionne le bon, l'appelle avec du contexte, et utilise le résultat pour décider l'action suivante. Le rôle du gateway dans ce workflow détermine le niveau de contrôle que vous avez sur le comportement de l'agent.

### Kong

Kong se concentre sur la couche proxy. Il route les requêtes MCP de manière fiable, applique rate limits et authentification, et journalise le trafic. La logique de workflow de l'agent vit dans le framework d'agent (LangChain, CrewAI, AutoGen) — Kong ne participe pas à et n'influence pas la sélection d'outils.

### STOA

STOA participe au workflow au niveau gouvernance :

- **Injection de contexte Skill** : quand un agent appelle un outil, STOA peut injecter du contexte supplémentaire (paramètre `_skill_context`) fournissant à l'agent la configuration, l'historique ou les contraintes pertinentes
- **Allow-listing d'outils** : les administrateurs définissent quels outils les agents d'un tenant peuvent utiliser — l'agent ne voit jamais les outils interdits
- **Rate limiting par outil** : des limites différentes par outil (un outil de recherche peut autoriser 100 appels/minute tandis qu'un outil d'écriture en autorise 10)
- **Pistes d'audit** : chaque invocation d'outil est journalisée avec le contexte complet (identité agent, outil, paramètres, réponse) vers Kafka pour la conformité

## Fédérer plutôt que remplacer : l'approche coexistence

Pour les grandes entreprises européennes qui utilisent déjà Kong en production, la question n'est pas "Kong ou STOA ?" mais "comment ajouter les capacités MCP sans perturber l'existant ?".

C'est exactement le scénario pour lequel STOA a été conçu :

```
Trafic REST/GraphQL existant ──→ Kong ──→ Services backend
Trafic agents IA (MCP)       ──→ STOA ──→ Mêmes services backend
```

Le mode sidecar permet une coexistence sans migration big-bang. Kong continue de gérer le trafic traditionnel avec ses plugins éprouvés. STOA prend en charge le trafic MCP avec sa gouvernance native. Les deux gateways coexistent devant les mêmes services backend.

Cette approche est particulièrement adaptée aux organisations soumises à des contraintes de gestion du changement strictes (comités d'architecture, processus CAB) où le remplacement d'une brique d'infrastructure critique est un projet de 12 à 18 mois.

## Quand choisir quoi

**Choisissez Kong pour MCP si :**
- Vous utilisez déjà Kong et voulez ajouter un proxying MCP basique sans changer de stack.
- Vos besoins MCP sont simples : proxier le trafic MCP vers des serveurs upstream, appliquer l'auth standard.
- Vous utilisez Konnect (Enterprise) et voulez la découverte d'outils basée sur le catalogue API pour les agents.
- Les ACL au niveau route suffisent pour votre modèle d'autorisation.
- Vous valorisez l'écosystème de plugins mature de Kong pour les besoins non-MCP (transforms, logging, cache).

**Choisissez STOA pour MCP si :**
- MCP est un protocole principal de votre architecture, pas un ajout à la gestion REST existante.
- Vous avez besoin d'autorisation par outil (politiques OPA) au-delà des ACL au niveau route.
- L'isolation multi-tenant des outils est requise (différents tenants voient différents catalogues).
- Vous voulez une gouvernance protocol-aware : filtrage d'outils, injection de contexte, métrologie par outil.
- Vous préférez une découverte d'outils open source (CRD) à un control plane commercial.
- La souveraineté des données européenne est une exigence pour votre trafic MCP.

**Envisagez les deux (mode sidecar) si :**
- Kong gère votre trafic REST/GraphQL et vous voulez STOA spécifiquement pour la gouvernance MCP.
- Vous voulez évaluer les capacités MCP de STOA en parallèle de votre déploiement Kong existant.
- Votre organisation impose une migration progressive (pas de big-bang).

## Contexte de l'écosystème MCP

Kong et STOA font partie d'un écosystème MCP plus large. Pour comprendre comment MCP se compare aux autres approches d'intégration d'agents IA, voir [MCP vs Function Calling vs LangChain](/blog/mcp-vs-openai-function-calling-vs-langchain). Pour un tutoriel pratique sur la création d'outils MCP, voir [Convertir des API REST en outils MCP](/blog/convert-rest-api-to-mcp-tools).

Le protocole MCP évolue rapidement. L'approche plugin de Kong lui permet d'itérer vite sur le support MCP au fil de l'évolution de la spec. L'approche native de STOA implique que les mises à jour du protocole nécessitent des releases du gateway mais garantissent une intégration plus profonde. Les deux stratégies ont du mérite — le bon choix dépend de si MCP est un enjeu principal ou un protocole parmi d'autres que votre gateway gère.

---

## FAQ

### Kong supporte-t-il MCP nativement ?

Kong supporte MCP via des plugins, pas nativement dans le cœur du gateway. Le plugin AI MCP Proxy (Gateway 3.12+) proxie le trafic MCP, et le plugin AI MCP OAuth2 gère l'authentification des agents. Ces plugins fonctionnent bien pour le proxying MCP standard mais opèrent à la couche HTTP plutôt que de parser les messages du protocole MCP.

### Peut-on utiliser Kong et STOA ensemble ?

Oui. Le mode de déploiement sidecar de STOA est conçu pour ce scénario exact. Routez le trafic MCP vers STOA tandis que Kong continue de gérer REST et GraphQL. Voir le [guide de migration Kong](/docs/guides/migration/kong) pour la mise en place pas-à-pas.

### Quel gateway est meilleur pour la découverte d'outils MCP ?

Cela dépend de votre infrastructure. Kong offre la découverte d'outils via Konnect (control plane Enterprise). STOA offre la découverte via des CRD Kubernetes (open source, auto-hébergé). Si vous utilisez déjà Konnect, la découverte Kong s'intègre naturellement. Si vous utilisez Kubernetes auto-hébergé, la découverte CRD de STOA ne nécessite aucun abonnement commercial.

### Le support MCP est-il stable dans les deux gateways ?

Kong a ajouté le support MCP dans Gateway 3.12 (octobre 2025) avec des améliorations continues dans 3.13. STOA a MCP comme protocole central depuis sa première release. Les deux implémentations sont production-ready mais le protocole MCP lui-même évolue encore (spec actuelle : 2025-03-26, avec 2025-11-25 en draft).

### Comment fonctionnent les rate limits MCP dans chaque gateway ?

Kong applique les rate limits au niveau route via son plugin Rate Limiting standard. STOA supporte les rate limits par outil — différents outils au sein de la même connexion MCP peuvent avoir des limites différentes, appliquées par les politiques OPA et suivies via la métrologie Kafka.

---

*Vous évaluez les MCP gateways pour votre infrastructure d'agents IA ? [Essayez le quickstart STOA](/docs/guides/quickstart) pour voir la découverte d'outils MCP, OAuth 2.1 et la gouvernance par outil en action.*

> **Avertissement :** Les comparaisons de fonctionnalités sont basées sur la documentation publique disponible en mars 2026. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque éditeur. Toutes les marques appartiennent à leurs propriétaires respectifs.
