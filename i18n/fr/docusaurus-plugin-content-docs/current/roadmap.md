---
sidebar_position: 5
title: "Feuille de Route STOA Platform : Fonctionnalités & Jalons"
description: "Feuille de route publique de la Plateforme STOA — fonctionnalités à venir pour le gateway API open source natif IA avec support MCP, proxy LLM, mode sidecar, CLI et adapters multi-fournisseurs"
keywords: [roadmap, features, release plan, MCP gateway, API management, STOA, open source, LLM proxy]
---

# Feuille de Route

Notre vision pour la Plateforme STOA — construire le gateway pour l'ère de l'IA.

:::info Document Vivant
Cette feuille de route reflète nos priorités actuelles et peut évoluer en fonction des retours de la communauté et des besoins du marché. Des idées à partager ? [Rejoignez la discussion sur Discord](https://discord.gostoa.dev).
:::

:::tip Dernière Version
**[v2.2.0](/blog/release-v2.2.0)** (Mars 2026) — Proxy LLM, Inscription Self-Service, Système de Skills, MCP 2025-11-25, OAuth 2.1 DPoP et 12 nouveaux endpoints API.
:::

---

## Disponible Aujourd'hui

**Plateforme Core, MCP Gateway, Proxy LLM & Support Multi-Fournisseurs**

| Fonctionnalité | Statut | Depuis |
|----------------|--------|--------|
| Control Plane API (Python/FastAPI) | Disponible | v0.1.0 |
| STOA Gateway (Rust/Tokio/axum) | Disponible | v0.2.0 |
| Protocole MCP 2025-11-25 — découverte d'outils, ressources, prompts, completion | Disponible | v2.2.0 |
| Portail Développeur — découverte d'API et inscription en self-service | Disponible | v0.1.0 |
| Console Admin — catalogue API, observabilité, opérations tenant | Disponible | v0.1.0 |
| Architecture Multi-Tenant — isolation au niveau namespace | Disponible | v0.1.0 |
| SSO Keycloak — OIDC, fédération LDAP, multi-realm | Disponible | v0.1.0 |
| Proxy LLM — routage multi-fournisseurs (OpenAI, Azure, Mistral) | Disponible | v2.2.0 |
| Gestion des Coûts LLM — budgets par tenant, application, tableau de bord | Disponible | v2.2.0 |
| Inscription Self-Service — provisioning tenant, limites d'essai | Disponible | v2.2.0 |
| Système de Skills — CRUD natif gateway avec circuit breaker | Disponible | v2.2.0 |
| UAC (Universal API Contract) — validateur JSON Schema, transformation OpenAPI | Disponible | v2.2.0 |
| OAuth 2.1 — liaison DPoP, gestion DCR RFC 7592 | Disponible | v2.2.0 |
| Rate Limiting — quotas par consommateur | Disponible | v0.2.0 |
| Circuit Breaker — par upstream avec zombie reaper | Disponible | v0.2.0 |
| mTLS — tokens liés aux certificats (RFC 8705) | Disponible | v0.2.0 |
| En-têtes de Sécurité — bonnes pratiques OWASP, liste de blocage SSRF | Disponible | v0.2.0 |
| Masquage PII — middleware + endpoints admin | Disponible | v2.2.0 |
| Scanner de Posture de Sécurité | Disponible | v2.2.0 |
| Adapters Gateway — webMethods, Kong, Gravitee, Apigee, AWS, Azure APIM | Disponible | v2.2.0 |
| Auto-Enregistrement Gateway — heartbeat zéro configuration | Disponible | v0.2.0 |
| Observabilité — Prometheus, Grafana, OpenSearch | Disponible | v0.1.0 |
| Gateway Arena — lab de benchmark continu (20 dimensions enterprise) | Disponible | v2.2.0 |
| Vérification Continue de la Plateforme — 3 CUJs toutes les 15 min | Disponible | v2.2.0 |
| W3C Traceparent — propagation du tracing distribué | Disponible | v2.2.0 |
| Charts Helm — déploiement complet de la plateforme | Disponible | v0.1.0 |
| Moteur de Politiques OPA | Disponible | v0.1.0 |
| Onboarding Consommateurs — modèle de données, sync Keycloak, quotas | Disponible | v0.2.0 |
| Born GitOps — cycle de vie API déclaratif (ADR-040) | Disponible | v0.2.0 |
| Piste d'Audit — double écriture PG + pipeline OpenSearch | Disponible | v2.2.0 |
| Intégration ArgoCD — déploiement GitOps sur OVH + Hetzner | Disponible | v0.2.0 |
| CRDs — Tool, ToolSet, GatewayInstance, GatewayBinding | Disponible | v0.2.0 |
| Pipeline de Métriques d'Utilisation | Disponible | v2.2.0 |
| Facturation — budgets, consommateurs, API de modèles | Disponible | v2.2.0 |
| Gestion du Cycle de Vie des Contrats | Disponible | v2.2.0 |
| Endpoints de Gouvernance des Données | Disponible | v2.2.0 |
| Réconciliation SCIM vers Gateway | Disponible | v2.2.0 |
| Framework i18n (Console) | Disponible | v2.2.0 |
| Assistant de Chat IA Intégré | Disponible | v2.2.0 |
| Export/Import Tenant (Reprise après Sinistre) | Disponible | v2.2.0 |
| Documentation — 100+ guides, références, ADRs et docs API | Disponible | v2.2.0 |

---

## En Cours

**Opérateur GitOps, Mode Sidecar & Expérience Développeur**

| Fonctionnalité | Statut |
|----------------|--------|
| Opérateur de Réconciliation GitOps — opérateur K8s remplaçant AWX (ADR-042) | En cours |
| Mode Sidecar Gateway — coexistence avec Kong, Envoy, etc. (ADR-024) | En cours |
| Outil CLI (`stoactl`) — gestion style kubectl (Go/Cobra) | En cours |
| Landing Page & Tarification (gostoa.dev) | En cours |

---

## Planifié

**Performance, Scalabilité & Écosystème**

| Fonctionnalité | Statut |
|----------------|--------|
| Mode Proxy Gateway — proxy transparent pour les backends legacy | Planifié (T3 2026) |
| Mode Shadow Gateway — miroir de trafic et génération UAC | Planifié (T4 2026) |
| Provider Terraform | Planifié |
| Import OpenAPI — auto-enregistrement depuis une spec | Planifié |
| SDK (Python, TypeScript) | Planifié |
| Déploiement Edge | Planifié |
| Plugins WebAssembly | Planifié |
| Cache des Réponses | Planifié |
| Connecteurs MCP Pré-construits | Planifié |
| Templates GitOps (ArgoCD) | Planifié |
| Registre Helm Public | Planifié |

---

## En Réflexion

- **Policy as Code** — Définir des politiques d'accès en langage naturel
- **Marketplace** — Découvrir et partager des configurations d'outils MCP
- **Multi-Cloud Natif** — Optimisations spécifiques aux fournisseurs
- **Observabilité des Agents** — Traçage de bout en bout des workflows d'agents IA

---

## Participer

Nous construisons en public et accueillons les contributions !

- **Discord** : [Rejoindre la communauté](https://discord.gostoa.dev)
- **Issues** : [Signaler des bugs ou demander des fonctionnalités](https://github.com/stoa-platform/stoa/issues)
- **Contribuer** : [Guide de contribution](https://github.com/stoa-platform/stoa/blob/main/CONTRIBUTING.md)
- **Contact** : [hello@gostoa.dev](mailto:hello@gostoa.dev)

---

*Cette feuille de route est directionnelle et sujette à modification. Pour les discussions sur la feuille de route enterprise, contactez [sales@gostoa.dev](mailto:sales@gostoa.dev).*
