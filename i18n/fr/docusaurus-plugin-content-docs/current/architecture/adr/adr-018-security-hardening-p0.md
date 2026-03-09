---
sidebar_position: 18
title: "ADR-018 : Durcissement sécurité P0 — Pentest Team Coca"
description: "Décide les correctifs de sécurité critiques P0 à la suite de l'audit pentest interne Team Coca, incluant le durcissement de l'authentification, CORS et la protection contre les injections."
keywords: [durcissement sécurité, pentest, correctifs P0, CORS, injection, authentification]
---

# ADR-018 : Durcissement sécurité P0 — Pentest Team Coca

| | |
|---|---|
| **Statut** | Accepté |
| **Date** | 2026-01-25 |
| **Auteurs** | Christophe ABOULICAM, Team Coca (Chucky, N3m0, Gh0st, Pr1nc3ss) |
| **Relecteurs** | OSS Killer, Archi Vétéran |
| **Tickets** | CAB-938, CAB-939, CAB-945, CAB-950 |
| **Score** | 10/10 (approbation unanime) |

## Contexte

Un test de pénétration interne mené par **Team Coca** le 2026-01-25 a identifié quatre vulnérabilités de sécurité P0 (critiques) dans la plateforme STOA :

| Ticket | Vulnérabilité | Sévérité | CVSS |
|--------|--------------|----------|------|
| CAB-938 | Validation d'audience JWT désactivée | 🔴 Critique | 8,1 |
| CAB-939 | Épuisement des connexions SSE (Slowloris) | 🔴 Critique | 7,5 |
| CAB-945 | Mauvaises configurations de sécurité des conteneurs | 🔴 Critique | 7,2 |
| CAB-950 | CORS wildcard permet des attaques cross-origin | 🔴 Critique | 6,5 |

### Équipe d'audit

- **🔪 Chucky** — Lead pentest, Infrastructure
- **🐟 N3m0** — Application web, Injection
- **👻 Gh0st** — Chaîne d'approvisionnement, CI/CD
- **👸 Pr1nc3ss** — Ingénierie sociale, OSINT

### Équipe de revue

- **💀 OSS Killer** — Avocat du diable
- **🏛️ Archi Vétéran** — Revue d'architecture (23 ans d'expérience)

## Décision

Nous implémenterons les quatre correctifs de sécurité avec les décisions de conception suivantes :

### CAB-938 : Validation d'audience JWT

**Avant (vulnérable) :**
```python
# mcp-gateway/src/middleware/auth.py:311
payload = jwt.decode(
    token, rsa_key, algorithms=["RS256"],
    options={"verify_aud": False}  # ❌ Tout token de service accepté !
)
```

**Après (sécurisé) :**
```python
payload = jwt.decode(
    token, rsa_key, algorithms=["RS256"],
    audience=self.settings.allowed_audiences_list,
    options={"verify_aud": bool(self.settings.allowed_audiences)}
)
```

**Décisions de conception :**
- Audience par défaut : `stoa-mcp-gateway,account` (compatibilité Keycloak)
- La chaîne vide désactive la validation (compatibilité ascendante)
- Rollback : `ALLOWED_AUDIENCES=""`

### CAB-950 : Liste blanche CORS

**Avant (vulnérable) :**
```python
# mcp-gateway/src/config/settings.py:74
cors_origins: str = "*"  # ❌ N'importe quelle origine peut effectuer des requêtes !
```

**Après (sécurisé) :**
```python
cors_origins: str = "https://console.stoa.dev,https://portal.stoa.dev,..."
cors_allow_methods: str = "GET,POST,PUT,DELETE,OPTIONS"
cors_allow_headers: str = "Authorization,Content-Type,X-Request-ID,X-Tenant-ID"
cors_expose_headers: str = "X-Request-ID,X-Trace-ID"
cors_max_age: int = 600
```

**Décisions de conception :**
- Liste blanche de domaines explicites uniquement
- Méthodes et headers restreints
- Rollback : `CORS_ORIGINS="*"` (non recommandé)

### CAB-939 : Limites de connexions SSE

**Avant (vulnérable) :**
```python
# Aucune limite ! Un attaquant peut ouvrir 10 000+ connexions
async def sse_endpoint():
    while True:  # ❌ Infini, sans timeout
        yield event
```

**Après (sécurisé) :**
```python
# Nouveau module : mcp-gateway/src/middleware/sse_limiter.py
class SSEConnectionLimiter:
    MAX_PER_IP: int = 10
    MAX_PER_TENANT: int = 100
    MAX_TOTAL: int = 5000
    IDLE_TIMEOUT: int = 30  # secondes
    MAX_DURATION: int = 3600  # 1 heure
    RATE_LIMIT_PER_MIN: int = 5
```

**Décisions de conception :**
- Paramètres passés explicitement pour éviter les imports circulaires (correctif OSS Killer)
- Proxies de confiance vides par défaut (doivent être configurés explicitement)
- Rollback : `SSE_LIMITER_ENABLED=false`

### CAB-945 : Durcissement des conteneurs

**Avant (vulnérable) :**
```yaml
# portal/k8s/deployment.yaml
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: false  # ❌ Système de fichiers accessible en écriture !
  # Manquant : capabilities, seccompProfile
```

**Après (sécurisé) :**
```yaml
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    fsGroup: 101
containers:
  - securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        drop: [ALL]
      seccompProfile:
        type: RuntimeDefault
```

**Ressources supplémentaires créées :**
- `k8s/namespace-pss.yaml` — Pod Security Standards (restricted)
- `k8s/networkpolicy-control-plane.yaml` — Isolation réseau

## Architecture

### Avant (vulnérable)

```
┌─────────────────────────────────────────────────────────────┐
│                    FAILLES DE SÉCURITÉ                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 JWT : verify_aud=False                                  │
│     └── Tout token Keycloak de tout service accepté         │
│                                                             │
│  🔴 CORS : origins="*"                                      │
│     └── Requêtes cross-origin depuis n'importe quel domaine │
│                                                             │
│  🔴 SSE : Aucune limite                                     │
│     └── Attaque Slowloris peut épuiser les ressources serveur│
│                                                             │
│  🔴 Conteneurs : Système de fichiers accessible en écriture,│
│     aucune suppression de capabilities                      │
│     └── Évasion de conteneur → compromission nœud possible  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Après (durci)

```
┌─────────────────────────────────────────────────────────────┐
│                    DÉFENSE EN PROFONDEUR                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ JWT : verify_aud=True, audience="stoa-mcp-gateway"      │
│     └── Seuls les tokens émis pour ce service acceptés     │
│                                                             │
│  ✅ CORS : Liste blanche explicite (*.stoa.dev, *.gostoa.dev)│
│     └── Seuls les frontends connus peuvent faire des requêtes│
│                                                             │
│  ✅ SSE : 10/IP, 100/tenant, 30s inactif, 1h max           │
│     └── Attaques par épuisement de connexions atténuées    │
│                                                             │
│  ✅ Conteneurs : Lecture seule, capabilities supprimées,    │
│     seccomp                                                 │
│     └── Surface d'attaque minimisée, PSS appliqué          │
│                                                             │
│  ✅ NetworkPolicy : Control plane isolé                     │
│     └── Trafic est-ouest restreint aux services connus      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Conséquences

### Positives

- **Surface d'attaque réduite** — Les quatre vulnérabilités P0 sont corrigées
- **Défense en profondeur** — Plusieurs couches de sécurité
- **Prêt pour la conformité** — PSS restricted, journalisation d'audit, RBAC
- **Capacité de rollback** — Chaque correctif dispose d'un interrupteur via variable d'environnement
- **Documenté** — ADR, changelog, guide de configuration

### Négatives

- **Risque de changement cassant** — La validation d'audience JWT peut rejeter les tokens existants
- **Configuration requise** — Les proxies de confiance doivent être configurés explicitement
- **Surveillance nécessaire** — Le limiteur SSE nécessite des métriques Prometheus (P1)

### Neutres

- **Impact sur les performances** — Minimal (~1 ms pour la vérification de la limite SSE)
- **Chemin de migration** — Compatibilité ascendante avec les interrupteurs de variables d'environnement

## Conformité

| Standard | Exigence | Statut |
|----------|----------|--------|
| OWASP API Security | API8:2023 Mauvaise configuration sécurité | ✅ Corrigé |
| CIS Kubernetes | 5.2.* Pod Security Standards | ✅ Implémenté |
| NIS2 | Segmentation réseau | ✅ NetworkPolicy |
| DORA | Réponse aux incidents | ✅ Plan de rollback |

## Références

### Externes

- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Attaque Slowloris](https://en.wikipedia.org/wiki/Slowloris_(computer_security))
- [Bonnes pratiques JWT (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)

### Internes

- [CAB-938](https://linear.app/hlfh-workspace/issue/CAB-938) — Validation JWT
- [CAB-939](https://linear.app/hlfh-workspace/issue/CAB-939) — Épuisement SSE
- [CAB-945](https://linear.app/hlfh-workspace/issue/CAB-945) — Durcissement conteneurs
- [CAB-950](https://linear.app/hlfh-workspace/issue/CAB-950) — Durcissement UI/CLI

## Annexe : Historique des revues

### Scores de revue

| Relecteur | Rôle | v1 | v2 | v3 | v4 (Final) |
|-----------|------|-----|-----|-----|------------|
| 🔪 Chucky | Infra | 7/10 | 9/10 | 9/10 | 10/10 |
| 🐟 N3m0 | Web | 8/10 | 9/10 | 9/10 | 10/10 |
| 👻 Gh0st | CI/CD | 6/10 | 8,5/10 | 9/10 | 10/10 |
| 👸 Pr1nc3ss | OSINT | 9/10 | 10/10 | 10/10 | 10/10 |
| 💀 OSS Killer | Adversarial | - | - | 8,5/10 | 10/10 |
| 🏛️ Archi Vétéran | Architecture | - | - | 9/10 | 10/10 |

### Corrections clés par relecteur

| Relecteur | Problème identifié | Correctif appliqué |
|-----------|-------------------|-------------------|
| Chucky | `automountServiceAccountToken` manquant | Ajouté aux deployments |
| Chucky | Health checks NetworkPolicy trop ouverts | Restreints au CIDR cluster |
| N3m0 | Audience Keycloak par défaut | Ajout de `account` aux valeurs par défaut |
| N3m0 | `expose_headers` manquant | Paramètre CORS ajouté |
| Pr1nc3ss | Usurpation X-Forwarded-For | Validation des proxies de confiance |
| Gh0st | Absence de tests dans le plan | Tests dans le même commit |
| Gh0st | Absence de plan de rollback | Interrupteurs via variables d'environnement |
| OSS Killer | Risque d'import circulaire | Paramètres passés explicitement |
| OSS Killer | Proxies de confiance trop larges | Vide par défaut |
| Archi Vétéran | Absence de documentation | SECURITY-CHANGELOG ajouté |

---

*Pentest Team Coca — 2026-01-25 🍫*
