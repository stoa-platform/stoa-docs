---
sidebar_position: 3
slug: /guides/stoa-connect-quickstart
title: "Connecter une passerelle tierce avec stoa-connect"
description: "Installez et configurez stoa-connect pour relier Kong, Gravitee ou webMethods au Plan de Contrôle STOA — découverte d'API, synchronisation des politiques et heartbeat en moins de 10 minutes."
keywords: [stoa-connect, kong, gravitee, webmethods, passerelle hybride, plan de contrôle, découverte api, synchronisation politiques]
---

# Connecter une passerelle tierce avec stoa-connect

`stoa-connect` (**STOA Link**, unifié par [ADR-057](/docs/architecture/adr/adr-057-product-lineup-gateway-link-connect) et [ADR-073](/docs/architecture/adr/adr-073-adopt-envoy-data-plane)) est l'agent Go léger sur site qui s'exécute aux côtés de votre passerelle API existante (Kong, Gravitee ou webMethods) ou sert l'ADS xDS mTLS en boucle locale à Envoy upstream — reliant votre plan de données au Plan de Contrôle STOA par HTTPS/SSE sortant.

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
<TabItem value="envoy" label="Envoy (xDS ADS)">

```bash
export STOA_CONTROL_PLANE_URL="${STOA_API_URL}"
export STOA_GATEWAY_API_KEY="gw_your_key_here"
export STOA_INSTANCE_NAME="envoy-prod-01"
export STOA_ENVIRONMENT="production"

# Sélection explicite obligatoire (l'auto-détection ne choisit jamais envoy ; pas d'URL admin)
export STOA_GATEWAY_TYPE="envoy"
export STOA_ENVOY_ADS_ADDR="127.0.0.1:18000"   # adresse IP loopback uniquement
export STOA_ENVOY_NODE_URI="spiffe://example.internal/envoy/prod-01"
export STOA_ENVOY_TLS_CERT="/etc/stoa-connect/tls/ads-server.crt"
export STOA_ENVOY_TLS_KEY="/etc/stoa-connect/tls/ads-server.key"
export STOA_ENVOY_CLIENT_CA="/etc/stoa-connect/tls/envoy-client-ca.crt"
export STOA_ENVOY_LISTENER_PORT="10000"
export STOA_ENVOY_AUTH_ADDR="127.0.0.1:9001"   # ExtAuthzService gRPC fail-closed
```

</TabItem>
</Tabs>

| Variable | Obligatoire | Défaut | Description |
|----------|-------------|--------|-------------|
| `STOA_CONTROL_PLANE_URL` | Oui | — | URL de base de l'API du Plan de Contrôle |
| `STOA_GATEWAY_API_KEY` | Oui | — | `X-Gateway-Key` pour l'authentification au Plan de Contrôle |
| `STOA_GATEWAY_TYPE` | Oui | `auto` | `kong`, `gravitee`, `webmethods`, `auto` ou `envoy` (`envoy` doit être défini explicitement) |
| `STOA_GATEWAY_ADMIN_URL` | Modes Admin API | — | URL locale de l'API d'administration (inutilisée lorsque `STOA_GATEWAY_TYPE=envoy`) |
| `STOA_ENVOY_ADS_ADDR` | Mode Envoy | `127.0.0.1:18000` | Adresse d'écoute ADS mTLS loopback (IP loopback littérale uniquement) |
| `STOA_ENVOY_NODE_URI` | Mode Envoy | — | URI SAN obligatoire du certificat client Envoy autorisé |
| `STOA_ENVOY_TLS_CERT` / `KEY` / `CLIENT_CA` | Mode Envoy | — | Certificat/clé serveur et autorité cliente mTLS obligatoire |
| `STOA_ENVOY_LISTENER_PORT` | Mode Envoy | — | Port d'écoute HTTP loopback généré pour Envoy |
| `STOA_ENVOY_AUTH_ADDR` | Mode Envoy | — | `host:port` du service gRPC `ExtAuthzService` fail-closed (`stoa-gateway`) |
| `STOA_INSTANCE_NAME` | Non | hostname | Identifiant affiché dans la Console |
| `STOA_ENVIRONMENT` | Non | `production` | Libellé d'environnement |
| `STOA_HEARTBEAT_INTERVAL` | Non | `30s` | Fréquence des heartbeats |
| `STOA_SSE_ENABLED` | Non | `false` | Flux SSE sortant sur option après enregistrement ([ADR-059](/docs/architecture/adr/adr-059-simplified-deployment-sse)) ; sinon polling périodique des routes |
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

Au démarrage (`cmd/stoa-connect/main.go`), `stoa-connect` va :

1. Si `STOA_CONTROL_PLANE_URL` et `STOA_GATEWAY_API_KEY` sont renseignés, enregistrer la passerelle auprès du Plan de Contrôle (`POST /v1/internal/gateways/register`) et démarrer le heartbeat **uniquement après un enregistrement réussi**
2. Démarrer la découverte des API locales — **ignorée lorsque `STOA_GATEWAY_TYPE=envoy`**, qui démarre à la place le serveur ADS mTLS loopback
3. Lancer la synchronisation des politiques, ainsi que le flux SSE sortant sur option (`STOA_SSE_ENABLED=true` avec `gateway_id` enregistré) ou le polling périodique des routes

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
  "version": "0.3.10-main",
  "commit": "639e8b9a",
  "gateway_id": "a1b2c3d4-...",
  "discovered_apis": 12
}
```

*(Note : `/health` reflète la vivacité HTTP de l'agent local et peut renvoyer `"status": "ok"` avec `"gateway_id": "unregistered"` si l'enregistrement auprès du Plan de Contrôle a été omis ou a échoué — vérifiez que `gateway_id` ne vaut pas `"unregistered"`.)*

Ou via la CLI :

```bash
stoactl connect status --url http://localhost:8090
```

Confirmez que la passerelle apparaît dans la Console STOA (`${STOA_CONSOLE_URL}`) sous **Gateways**. L'indicateur d'état passe au vert dès réception du premier heartbeat.

---

## Référence CLI

`stoactl connect` propose les sous-commandes de diagnostic opérateur suivantes :

```bash
# Afficher l'état de l'agent et la connectivité (:8090/health)
stoactl connect status --url http://localhost:8090

# Découvrir les API directement sur une passerelle à API d'administration (kong | gravitee | webmethods | auto)
stoactl connect discover --admin-url http://localhost:8001 --type kong
```

:::note Mode Envoy xDS & limites de `/sync`
- **Découverte (`stoactl connect discover`)** interroge directement l'API d'administration d'une passerelle tierce (`kong`, `gravitee`, `webmethods` ou `auto`). En mode **Envoy** (`STOA_GATEWAY_TYPE=envoy`), `stoa-connect` sert l'ADS xDS mTLS loopback depuis l'état du Plan de Contrôle ; `Discover` retourne `UnsupportedError` et est ignoré par conception.
- **Synchronisation manuelle (`stoactl connect sync`)** : Bien que `stoactl connect` définisse une sous-commande `sync` (`POST <url>/sync`), `cmd/stoa-connect/main.go` sur `main` actuel ne monte que `/health`, `/metrics` et `/webhook/events` (n'exécutez pas `stoactl connect sync` sur `stoa-connect` ; les routes et politiques sont réconciliées automatiquement via la boucle interne et le flux SSE optionnel).
:::

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `UNAUTHORIZED` au démarrage | `STOA_GATEWAY_API_KEY` invalide ou expirée | Régénérez la clé dans Console → Paramètres → Gateways |
| La passerelle reste OFFLINE dans la Console | Le heartbeat n'atteint pas le Plan de Contrôle | Vérifiez que les règles du pare-feu autorisent le trafic HTTPS sortant vers `${STOA_API_URL}` |
| 0 API découverte | `STOA_GATEWAY_ADMIN_URL` incorrecte (ou exécution en mode Envoy) | Vérifiez avec `curl ${STOA_GATEWAY_ADMIN_URL}/health` (le mode Envoy ignore la découverte par conception) |
| La synchronisation des politiques échoue | Identifiants rejetés ou politique Envoy non traduite | Vérifiez `STOA_GATEWAY_ADMIN_*` ; en mode Envoy v1 seuls `cors`, `rate_limit` et `ip_filter` sont traduits |

Pour des logs structurés, définissez `LOG_LEVEL=debug` avant de démarrer l'agent.

---

## Compagnon et stoa-connect

`stoa-connect` (**STOA Link**) est l'agent de synchronisation Control Plane et serveur xDS. Il synchronise l'état souhaité vers les API d'administration des passerelles tierces (webMethods, Kong, Gravitee) ou sert l'ADS mTLS loopback à Envoy upstream ([Architecture du plan de données](/docs/architecture/data-plane)), hors du chemin des charges utiles HTTP clientes.

Le compagnon est une autre intégration. Le binaire Rust `stoa-gateway`, démarré avec `STOA_GATEWAY_MODE=sidecar`, répond à `POST /authz` HTTP pour un hôte dans le même pod ou un appel applicatif (tandis que `STOA_EXT_AUTHZ_GRPC_ADDR` expose le service gRPC `ExtAuthzService` natif pour Envoy). Voir [Usage du compagnon](./companion-usage.md).

## Étapes suivantes

- [Configuration multi-passerelles](/docs/guides/multi-gateway-setup) — Orchestrez plusieurs passerelles depuis un unique Plan de Contrôle
- [Auto-enregistrement de passerelle](/docs/guides/gateway-auto-registration) — Enregistrement automatique et heartbeats
- [Politiques OPA](/docs/guides/opa-policies) — Rédigez des politiques de gouvernance synchronisées sur vos passerelles
