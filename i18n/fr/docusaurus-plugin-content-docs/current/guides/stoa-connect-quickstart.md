---
sidebar_position: 3
slug: /guides/stoa-connect-quickstart
title: "Connecter une passerelle tierce avec stoa-connect"
description: "Installez et configurez stoa-connect pour relier Kong, Gravitee ou webMethods au Plan de Contrôle STOA — découverte d'API, synchronisation des politiques et heartbeat en moins de 10 minutes."
keywords: [stoa-connect, kong, gravitee, webmethods, passerelle hybride, plan de contrôle, découverte api, synchronisation politiques]
---

# Connecter une passerelle tierce avec stoa-connect

`stoa-connect` est un agent Go léger qui s'exécute aux côtés de votre passerelle API existante (Kong, Gravitee ou webMethods) et la connecte au Plan de Contrôle STOA — aucun remplacement de passerelle requis.

## Ce que vous allez accomplir

À la fin de ce guide, votre passerelle tierce sera en mesure de :

- Apparaître dans la Console STOA sous **Gateways**
- Exposer ses API dans l'inventaire du Plan de Contrôle (découverte automatique toutes les 60 secondes)
- Recevoir les politiques poussées depuis STOA automatiquement
- Envoyer des heartbeats toutes les 30 secondes pour que la Console affiche l'état de santé en temps réel

## Architecture

```
VPS / On-Premise
┌─────────────────────────────────────────┐
│  Third-Party Gateway (Kong/Gravitee/wM) │
│  ← admin API ─────────────────────┐     │
│                                    │     │
│  stoa-connect agent ──────────────┘     │
│  (Go binary, port 8090)                 │
│     ├── register with CP                │
│     ├── heartbeat 30s                   │
│     ├── discover APIs 60s               │
│     └── sync policies 60s              │
└──────────────────┬──────────────────────┘
                   │ HTTPS (X-Gateway-Key)
                   ▼
         STOA Control Plane
         (${STOA_API_URL})
```

## Prérequis

- Une passerelle Kong, Gravitee ou webMethods en cours d'exécution avec son API d'administration accessible localement
- Un compte STOA sur [console.gostoa.dev](https://console.gostoa.dev)
- Une **clé API de passerelle** obtenue depuis la Console STOA (Paramètres → Gateways → Nouvelle clé)

## Étape 1 — Installer stoa-connect

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="linux" label="Linux (amd64)">

```bash
curl -sSL https://get.gostoa.dev/connect | sh
```

</TabItem>
<TabItem value="macos" label="macOS (Homebrew)">

```bash
brew install stoa-platform/tap/stoa-connect
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker pull ghcr.io/stoa-platform/stoa-connect:latest
```

</TabItem>
<TabItem value="go" label="Depuis les sources (Go 1.22+)">

```bash
go install github.com/stoa-platform/stoa-connect@latest
```

</TabItem>
</Tabs>

Vérifiez l'installation :

```bash
stoa-connect --version
```

---

## Étape 2 — Configurer

Créez un fichier `.env` (ou exportez les variables dans votre shell ou votre unité systemd) :

<Tabs>
<TabItem value="kong" label="Kong">

```bash
# Connexion au Plan de Contrôle
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="kong-prod-01"    # détecté automatiquement depuis le hostname si omis
export STOA_ENVIRONMENT="production"

# API d'administration de la passerelle
export STOA_GATEWAY_TYPE="kong"
export STOA_GATEWAY_ADMIN_URL="http://localhost:8001"
export STOA_GATEWAY_ADMIN_TOKEN="your-kong-admin-token"
```

</TabItem>
<TabItem value="gravitee" label="Gravitee">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="gravitee-prod-01"
export STOA_ENVIRONMENT="production"

export STOA_GATEWAY_TYPE="gravitee"
export STOA_GATEWAY_ADMIN_URL="http://localhost:8083"
export STOA_GATEWAY_ADMIN_USER="admin"
export STOA_GATEWAY_ADMIN_PASSWORD="your-gravitee-password"
```

</TabItem>
<TabItem value="webmethods" label="webMethods">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="webmethods-prod-01"
export STOA_ENVIRONMENT="production"

export STOA_GATEWAY_TYPE="webmethods"
export STOA_GATEWAY_ADMIN_URL="http://localhost:5555"
export STOA_GATEWAY_ADMIN_USER="Administrator"
export STOA_GATEWAY_ADMIN_PASSWORD="your-webmethods-password"
```

</TabItem>
</Tabs>

| Variable | Obligatoire | Défaut | Description |
|----------|-------------|--------|-------------|
| `STOA_CONTROL_PLANE_URL` | Oui | — | URL de base de l'API du Plan de Contrôle |
| `STOA_GATEWAY_API_KEY` | Oui | — | `X-Gateway-Key` pour l'authentification au Plan de Contrôle |
| `STOA_GATEWAY_TYPE` | Oui | `auto` | `kong`, `gravitee` ou `webmethods` |
| `STOA_GATEWAY_ADMIN_URL` | Oui | — | URL locale de l'API d'administration de la passerelle |
| `STOA_INSTANCE_NAME` | Non | hostname | Identifiant affiché dans la Console |
| `STOA_ENVIRONMENT` | Non | `production` | Libellé d'environnement |
| `STOA_HEARTBEAT_INTERVAL` | Non | `30s` | Fréquence des heartbeats |
| `STOA_CONNECT_PORT` | Non | `8090` | Port HTTP local de l'agent |

---

## Étape 3 — Démarrer

<Tabs>
<TabItem value="binary" label="Binaire">

```bash
stoa-connect
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker run -d \
  --name stoa-connect \
  --network host \
  --env-file .env \
  ghcr.io/stoa-platform/stoa-connect:latest
```

</TabItem>
<TabItem value="systemd" label="systemd">

```ini
# /etc/systemd/system/stoa-connect.service
[Unit]
Description=STOA Connect Agent
After=network.target

[Service]
EnvironmentFile=/etc/stoa-connect/env
ExecStart=/usr/local/bin/stoa-connect
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now stoa-connect
```

</TabItem>
</Tabs>

Au démarrage, `stoa-connect` va :

1. Enregistrer la passerelle auprès du Plan de Contrôle (`POST /v1/internal/gateways/register`)
2. Découvrir les API depuis l'API d'administration locale de la passerelle
3. Démarrer la boucle de heartbeat (toutes les 30 secondes)
4. Lancer la synchronisation des politiques (toutes les 60 secondes)

---

## Étape 4 — Vérifier

Vérifiez que l'agent est opérationnel :

```bash
# Vérifier l'état de l'agent (remplacez l'URL par l'adresse de votre agent)
curl -s http://localhost:8090/health | jq
```

Résultat attendu :

```json
{
  "status": "ok",
  "version": "0.3.0",
  "gateway_id": "a1b2c3d4-...",
  "discovered_apis": 12
}
```

Ou via la CLI :

```bash
stoactl connect status --url http://localhost:8090
```

Confirmez que la passerelle apparaît dans la Console sur [console.gostoa.dev](https://console.gostoa.dev) sous **Gateways**. L'indicateur d'état doit devenir vert en moins de 30 secondes.

---

## Référence CLI

`stoactl connect` propose trois sous-commandes pour les opérations courantes :

```bash
# Afficher l'état de l'agent et la connectivité
stoactl connect status --url http://localhost:8090

# Déclencher une découverte d'API immédiate (sans attendre les 60s)
stoactl connect discover --admin-url http://localhost:8001

# Forcer une synchronisation des politiques depuis le Plan de Contrôle
stoactl connect sync --url http://localhost:8090
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `UNAUTHORIZED` au démarrage | `STOA_GATEWAY_API_KEY` invalide ou expirée | Régénérez la clé dans Console → Paramètres → Gateways |
| La passerelle reste OFFLINE dans la Console | Le heartbeat n'atteint pas le Plan de Contrôle | Vérifiez que les règles du pare-feu autorisent le trafic HTTPS sortant vers `${STOA_API_URL}` |
| 0 API découverte | `STOA_GATEWAY_ADMIN_URL` incorrecte | Vérifiez avec `curl ${STOA_GATEWAY_ADMIN_URL}/health` |
| La synchronisation des politiques échoue | Identifiants d'administration rejetés | Vérifiez `STOA_GATEWAY_ADMIN_TOKEN` / `USER` / `PASSWORD` |

Pour des logs structurés, définissez `LOG_LEVEL=debug` avant de démarrer l'agent.

---

## Étapes suivantes

- **Configuration multi-passerelles** — gérez plusieurs passerelles depuis un seul Plan de Contrôle (bientôt disponible)
- **Enregistrement automatique de passerelle** — enregistrement natif STOA sans agent (bientôt disponible)
- **Politiques OPA** — rédigez des politiques que stoa-connect synchronisera avec votre passerelle (bientôt disponible)
