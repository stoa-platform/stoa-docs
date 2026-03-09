---
sidebar_position: 38
title: "ADR-038 : Stratégies de Déploiement Sidecar sur Infrastructure VM"
description: "Décide des stratégies de déploiement sidecar pour exécuter STOA Gateway aux côtés d'applications sur une infrastructure basée sur VM sans Kubernetes."
keywords: [sidecar, déploiement VM, systemd, gateway, non-Kubernetes, infrastructure]
---

# ADR-038 : Stratégies de Déploiement Sidecar sur Infrastructure VM

## Statut

Proposé

## Date

2026-02-08

## Contexte

STOA Gateway supporte 4 modes de déploiement (`shadow`, `proxy`, `edge-mcp`, `sidecar`) tels que définis dans [ADR-024](./adr-024-gateway-unified-modes.md) (CAB-958). Le **mode sidecar** est spécifiquement conçu pour coexister avec des gateways tiers existants (webMethods, Kong, Apigee) sans les remplacer.

Un manque critique existe : de nombreux clients entreprise — particulièrement dans les secteurs bancaire, assurance et public — exploitent leurs gateways sur **infrastructure bare-metal ou VM** (RHEL, CentOS, Windows Server), et non sur Kubernetes. Le pattern sidecar est issu du monde service mesh / Kubernetes (Envoy, Istio, Linkerd), mais la grande majorité des clients cibles de STOA **ne sont pas sur Kubernetes** pour leur couche gateway API.

### Le Problème

> « Notre gateway webMethods tourne sur une VM RHEL 8. Comment déployer le sidecar STOA ? »
> — Chaque prospect entreprise régulée

Nous avons besoin d'une stratégie de déploiement claire et directrice pour le mode sidecar sur infrastructure VM, avec des options de repli pour les environnements où Docker/Podman n'est pas autorisé.

### Contraintes

- Zéro modification du gateway existant (webMethods, Kong, Apigee)
- Zéro interruption lors du déploiement du sidecar
- Compatible avec les processus de gestion des changements d'entreprise (approbation CAB, plan de rollback)
- Doit fonctionner dans des environnements air-gapped ou à réseau restreint
- Doit supporter les stacks de monitoring existantes (Nagios, Zabbix, SCOM) aux côtés de l'observabilité STOA

## Décision

Nous supportons **trois stratégies de déploiement** pour le mode sidecar sur infrastructure VM, avec un ordre de recommandation clair :

### Stratégie A : Conteneur sur Hôte (RECOMMANDÉE)

Déployer `stoa-gateway --mode=sidecar` comme un conteneur Docker/Podman sur la même VM que le gateway existant.

```
┌──────────────────────────────────────────────┐
│                    VM (RHEL/CentOS)           │
│                                               │
│  ┌─────────────────┐   ┌──────────────────┐  │
│  │   webMethods     │   │  stoa-gateway    │  │
│  │   Gateway        │   │  (container)     │  │
│  │                  │   │                  │  │
│  │   :5555 (HTTP)   │◄──│  :8080 (proxy)   │  │
│  │   :9999 (admin)  │   │  :9090 (metrics) │  │
│  └─────────────────┘   └──────────────────┘  │
│                                               │
│          localhost / bridge network           │
└──────────────────────────────────────────────┘
         │
         │ metrics (HTTPS sortant)
         ▼
┌──────────────────┐
│  STOA Control    │
│  Plane (cloud)   │
└──────────────────┘
```

**Configuration :**

```yaml
# docker-compose.yml (ou équivalent podman)
services:
  stoa-sidecar:
    image: ghcr.io/hlfh/stoa-gateway:latest
    command: ["--mode=sidecar"]
    network_mode: host  # ou bridge avec mapping de ports
    restart: unless-stopped
    environment:
      STOA_UPSTREAM_HOST: "localhost"
      STOA_UPSTREAM_PORT: "5555"
      STOA_CONTROL_PLANE_URL: "https://cp.gostoa.dev"
      STOA_TENANT_ID: "${TENANT_ID}"
    volumes:
      - ./stoa-gateway.yaml:/etc/stoa/gateway.yaml:ro
      - ./certs:/etc/stoa/certs:ro
    ports:
      - "8080:8080"   # Port proxy sidecar
      - "9090:9090"   # Métriques Prometheus
```

**Avantages :**
- Isolation entre les processus sidecar et gateway (filesystem, libs, runtime différents)
- Cycle de mise à jour indépendant — mise à niveau du sidecar sans toucher au gateway
- Rollback = `docker stop stoa-sidecar` (instantané)
- Vérification de signature d'image (Cosign/Notary)
- Limites de ressources via cgroups (`--memory=512m --cpus=0.5`)
- Compatible avec les registres de conteneurs et pipelines CI/CD existants
- Fonctionne avec Podman (rootless) pour les environnements interdisant le daemon Docker

**Inconvénients :**
- Nécessite Docker ou Podman runtime sur la VM
- Certaines organisations ont des politiques interdisant les conteneurs sur les VMs « legacy »
- Légère surcharge de ressources supplémentaire (~50 Mo RAM de base)

**Quand l'utiliser :** Choix par défaut. Fonctionne pour 80%+ des environnements entreprise.

### Stratégie B : Binaire Natif (REPLI)

Déployer `stoa-gateway` comme un binaire Linux natif géré par systemd. Aucun runtime de conteneur requis.

```
┌──────────────────────────────────────────────┐
│                    VM (RHEL/CentOS)           │
│                                               │
│  ┌─────────────────┐   ┌──────────────────┐  │
│  │   webMethods     │   │  stoa-gateway    │  │
│  │   (JVM process)  │   │  (native binary) │  │
│  │                  │   │                  │  │
│  │   :5555          │◄──│  :8080           │  │
│  └─────────────────┘   └──────────────────┘  │
│                                               │
│  systemctl start stoa-gateway                 │
└──────────────────────────────────────────────┘
```

**Configuration :**

```ini
# /etc/systemd/system/stoa-gateway.service
[Unit]
Description=STOA Gateway Sidecar
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=stoa
Group=stoa
ExecStart=/opt/stoa/bin/stoa-gateway --mode=sidecar --config=/etc/stoa/gateway.yaml
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/stoa /var/lib/stoa
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Avantages :**
- Zéro dépendance sur un runtime de conteneur
- Familier pour les équipes ops gérant l'infrastructure traditionnelle (systemd, RPM/DEB)
- Surface d'attaque minimale — binaire statique unique (cible Rust : `x86_64-unknown-linux-musl`)
- Empreinte de ressources la plus faible (~30 Mo RAM)
- Compatible avec les politiques SELinux, AppArmor
- Distribuable en package RPM/DEB ou tarball

**Inconvénients :**
- Moins d'isolation que le conteneur (filesystem, libs partagés)
- La mise à jour nécessite le remplacement du binaire + redémarrage du service
- Doit correspondre à l'architecture de l'OS cible (fournir des builds `x86_64` + `aarch64`)
- Pas de limites de ressources intégrées (doit utiliser cgroups systemd manuellement)

**Quand l'utiliser :** Lorsque le runtime de conteneur est interdit par politique de sécurité. Courant dans les banques centrales, la défense et les environnements très régulés.

### Stratégie C : VM Adjacent (CAS LIMITE)

Déployer `stoa-gateway` sur une VM légère dédiée, proxyfiant le trafic vers la VM du gateway.

```
┌────────────────────┐         ┌────────────────────┐
│  VM-1 (Gateway)    │         │  VM-2 (STOA)       │
│                    │         │                    │
│  ┌──────────────┐  │  réseau │  ┌──────────────┐  │
│  │  webMethods   │◄─┼────────┼──│ stoa-gateway  │  │
│  │  :5555        │  │        │  │ :8080         │  │
│  └──────────────┘  │        │  └──────────────┘  │
└────────────────────┘         └────────────────────┘
```

**Avantages :**
- Isolation totale — VM du gateway complètement intacte
- Gestion du cycle de vie indépendante
- Simplifie l'approbation de gestion des changements (aucune modification de la VM de production)

**Inconvénients :**
- Latence réseau entre les VMs (1-5ms selon l'infrastructure)
- Réseau plus complexe (règles firewall, VLANs)
- Pas un vrai pattern « sidecar » — c'est un reverse proxy / node proxy
- Surcoût et overhead de gestion de la VM supplémentaire
- Doit gérer l'échec de VM-2 indépendamment (pas de destin partagé avec le gateway)

**Quand l'utiliser :** Uniquement quand absolument aucun logiciel ne peut être installé sur la VM du gateway. Rare en pratique, mais requis pour certaines architectures legacy adjacentes aux mainframes.

## Matrice de Décision

| Critère                      | A : Conteneur | B : Binaire Natif | C : VM Adjacent |
|------------------------------|:-------------:|:-----------------:|:---------------:|
| Isolation                    | ★★★★☆        | ★★★☆☆            | ★★★★★           |
| Facilité de déploiement      | ★★★★★        | ★★★★☆            | ★★★☆☆           |
| Facilité de rollback         | ★★★★★        | ★★★★☆            | ★★★★☆           |
| Surcoût de ressources        | ★★★★☆        | ★★★★★            | ★★★☆☆           |
| Latence réseau               | ★★★★★        | ★★★★★            | ★★★☆☆           |
| Friction gestion des changements | ★★★★☆    | ★★★★☆            | ★★★★★           |
| Acceptation entreprise       | ★★★★☆        | ★★★★★            | ★★★☆☆           |
| Support air-gapped           | ★★★★☆        | ★★★★★            | ★★★★☆           |

**Recommandation :** A > B > C (essayer dans l'ordre, revenir en arrière uniquement si bloqué par la politique)

## Patterns d'Interception du Trafic

Quelle que soit la stratégie de déploiement, le sidecar doit intercepter le trafic. Deux patterns :

### Pattern 1 : Proxy Explicite (RECOMMANDÉ)

Les consommateurs sont configurés pour envoyer le trafic au port du sidecar plutôt qu'au gateway directement. Le sidecar transmet au gateway après traitement.

```
Consommateur → :8080 (stoa-sidecar) → :5555 (webMethods) → Backend
```

- Nécessite une reconfiguration des consommateurs (alias DNS ou mise à jour du load balancer)
- Visibilité complète sur la requête ET la réponse
- Peut appliquer des politiques avant que le trafic n'atteigne le gateway

### Pattern 2 : Tap Passif (Compatible shadow)

Le trafic circule normalement vers le gateway. Le sidecar reçoit une copie miroir via le mirroring de port, iptables TPROXY, ou duplication au niveau applicatif.

```
Consommateur → :5555 (webMethods) → Backend
                    │
                    └── miroir → :8080 (stoa-sidecar, lecture seule)
```

- Zéro reconfiguration des consommateurs
- Lecture seule — ne peut pas appliquer, uniquement observer
- Idéal pour le déploiement initial + génération automatique de contrats UAC (mode shadow)
- Peut passer au Pattern 1 une fois la confiance établie

## Conséquences

### Positives

- Guide de déploiement clair pour chaque type d'infrastructure client
- Pas de dépendance dure sur Kubernetes — supprime le blocage d'adoption pour 70%+ des cibles entreprise
- Chemin progressif : Tap Passif (shadow) → Proxy Explicite (sidecar) → STOA complet (mode proxy)
- Le packaging RPM/DEB ouvre les canaux de distribution entreprise traditionnels
- Avantage concurrentiel : ni Kong ni Apigee ne documentent des patterns de déploiement sidecar sur VM

### Négatives

- Trois stratégies à maintenir, tester et documenter
- Le binaire natif nécessite un pipeline de cross-compilation (cibles Rust `musl`)
- Doit fournir des scripts d'installation / rôles Ansible pour chaque stratégie
- La stratégie conteneur dépend de la compatibilité de version Docker/Podman du client

## Alternatives Considérées

### DaemonSet Kubernetes

Injection de sidecar standard via contrôleur d'admission Kubernetes. Rejeté car le public cible du mode sidecar est explicitement l'infrastructure non-Kubernetes. Si le client a Kubernetes, il doit utiliser le mode `proxy` ou `edge-mcp` avec déploiement via chart Helm.

### Agent Java (Instrumentation JVM)

S'attacher au processus JVM du gateway (ex. webMethods IS tourne sur JVM). Rejeté car cela modifie le runtime du gateway, crée un couplage avec la version JVM du gateway, et viole la contrainte « zéro modification ». Ne fonctionne pas non plus pour les gateways non-JVM.

### Sidecar basé sur eBPF

Utiliser des programmes eBPF pour intercepter le trafic au niveau du kernel sans processus proxy. Différé à post-migration Rust (Phase 19+). Nécessite Linux kernel 5.10+ et des privilèges élevés. Très prometteur pour le pattern tap passif mais prématuré pour le MVP.

## Plan d'Implémentation

| Phase | Livrable | Cible |
|-------|---------|-------|
| MVP (fév. 2026) | Stratégie A : Docker Compose + configs exemples | Démo 24/02 |
| v0.2 | Stratégie B : Binaire statique + unit systemd + RPM | T2 2026 |
| v0.3 | Stratégie C : Rôle Ansible VM adjacent | T3 2026 |
| v1.0 | Tap passif eBPF (post-migration Rust) | T4 2026+ |

## Références

- [ADR-024 : Architecture Gateway Unifiée avec Configuration Basée sur Mode](./adr-024-gateway-unified-modes.md) (CAB-958)
- [Envoy Sidecar Deployment on VMs](https://www.envoyproxy.io/docs/envoy/latest/start/sandboxes/)
- [Consul Connect on VMs](https://developer.hashicorp.com/consul/docs/connect)
- [HashiCorp Nomad — Non-Kubernetes Sidecar Pattern](https://www.nomadproject.io/)
- RFC 8693 — OAuth 2.0 Token Exchange (pour l'authentification sidecar)
