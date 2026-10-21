---
sidebar_position: 1
slug: /guides/quickstart
title: "Démarrage rapide : Connecter un agent IA à votre API"
description: "Connectez Claude à vos API via une instance STOA que vous exploitez — installez, indiquez votre URL de serveur MCP et effectuez votre premier appel d'outil IA."
keywords:
  - STOA démarrage rapide
  - passerelle API premiers pas
  - tutoriel agent IA MCP
  - connecter Claude à une API
  - premier appel d'outil
---

# Démarrage rapide : Connecter un agent IA à votre API

Passez de zéro à votre premier appel API piloté par l'IA en moins de 5 minutes.

:::info Auto-hébergement uniquement
Le cloud public STOA (console, inscription, API et passerelle MCP) a été éteint le 23 mai 2026. Ce guide suppose une instance STOA que **vous** installez. Le site de documentation [docs.gostoa.dev](https://docs.gostoa.dev) reste en ligne.

Les exemples utilisent le nom réservé `stoa.example`. Remplacez-le par le domaine de votre installation.
:::

## Ce que vous allez accomplir

À la fin de ce guide, un agent IA (Claude) découvrira et appellera une API via votre passerelle STOA.

## Étape 1 : Installer STOA

Choisissez un parcours :

1. **En local, avec Docker** — [Auto-héberger en 5 minutes avec stoactl](/docs/guides/stoactl-quickstart)
2. **Kubernetes** — [Guide d'installation](/docs/admin/installation)

Notez ensuite les URL de **votre** instance :

| Composant | Exemple |
|-----------|---------|
| Passerelle MCP | `https://mcp.stoa.example/mcp/sse` |
| Keycloak | `https://auth.stoa.example` |
| Console | `https://console.stoa.example` |


## Étape 2 : Connecter Claude à STOA

1. Ouvrez [claude.ai](https://claude.ai) (abonnement Pro ou Team requis pour MCP)
2. Allez dans **Paramètres** → **Intégrations** → **Ajouter un serveur MCP**
3. Entrez :
   - **URL** : `https://mcp.stoa.example/mcp/sse`
   - **Nom** : `STOA Platform`
4. Authentifiez-vous avec vos identifiants STOA lorsque demandé

C'est tout. Claude est maintenant connecté à votre passerelle STOA.

## Étape 3 : Effectuer votre premier appel d'outil IA

Demandez à Claude :

> « Quels outils sont disponibles dans STOA ? »

Claude utilise la connexion MCP pour découvrir votre catalogue d'API et vous montre les outils disponibles.

Ensuite, demandez :

> « Utilise l'outil echo pour envoyer un message de test »

Claude appellera l'outil via STOA et retournera le résultat.

**Vous venez d'expérimenter le "Time To First Agent Call"** — un agent IA a découvert et appelé une API de manière autonome.

---

## Ce qui s'est passé en coulisses

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude  │────▶│ STOA Gateway │────▶│ API Backend │
│ (Agent)  │◀────│  (MCP + Auth)│◀────│             │
└──────────┘     └──────────────┘     └─────────────┘
```

STOA a géré :
- **Découverte** : Claude a trouvé les outils disponibles via MCP `tools/list`
- **Authentification** : OAuth 2.1 avec PKCE (aucun secret exposé)
- **Autorisation** : Vérification de l'accès de votre tenant
- **Routage** : Transfert de l'appel vers le bon backend
- **Observabilité** : Journalisation de l'appel pour l'analytique

---

## Enregistrer votre propre API {#register-your-own-api}

Prêt à exposer votre propre API backend comme outil IA ?

1. Dans la Console, allez dans **API Backend** → **Enregistrer une API**
2. Entrez le nom de votre API et l'URL du backend
3. STOA génère automatiquement les outils MCP à partir de votre spec OpenAPI
4. Créez une **clé API à portée limitée** sous **Clés API** pour l'accès programmatique

Votre API est maintenant appelable par n'importe quel agent IA connecté.

---

## Alternative : Utiliser curl au lieu de Claude

Si vous préférez la ligne de commande, vous pouvez appeler STOA directement :

```bash
# Obtenir un jeton OAuth
TOKEN=$(curl -s -X POST "https://auth.stoa.example/realms/stoa/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Lister les outils disponibles
curl -s "https://mcp.stoa.example/mcp/tools/list" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.tools[] | {name, description}'

# Appeler un outil
curl -s -X POST "https://mcp.stoa.example/mcp/tools/call" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "echo", "arguments": {"message": "bonjour"}}' | jq
```

---

## Étapes suivantes

| Objectif | Guide |
|----------|-------|
| Connecter un agent à votre passerelle | [MCP pour développeurs](/docs/guides/mcp-developer-guide) |
| Créer des outils MCP personnalisés | [Développement d'outils MCP](/docs/guides/mcp-tools-development) |
| Gérer les abonnements API | [Cycle de vie des abonnements](/docs/guides/subscriptions-lifecycle) |
| Choisir une topologie | [Modèles de déploiement](/docs/deployment/hybrid) |
| Comprendre le protocole MCP | [Fiche protocole MCP](/docs/guides/fiches/mcp-protocol) |

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Claude ne peut pas se connecter au serveur MCP | Utilisez l'URL de votre passerelle, par exemple `https://mcp.stoa.example/mcp/sse` — notez le chemin `/mcp/sse` |
| « Non autorisé » après connexion | Ré-authentifiez-vous : déconnectez puis reconnectez le serveur MCP dans les paramètres de Claude |
| Aucun outil n'apparaît | Votre tenant n'a peut-être pas encore d'API enregistrée — enregistrez-en une dans la Console |
| curl retourne `401` | Jeton expiré (par défaut : 5 min) — relancez la commande de jeton |
