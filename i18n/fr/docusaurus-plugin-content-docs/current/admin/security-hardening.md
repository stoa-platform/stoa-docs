---
sidebar_position: 6
title: "Durcissement Sécurité"
description: "Durcir la Plateforme STOA pour la production — politiques réseau, configuration TLS, sécurité des conteneurs, RBAC, gestion des secrets et alignement réglementaire."
keywords:
  - security hardening
  - TLS
  - network policies
  - container security
  - compliance
---

# Durcissement Sécurité

Liste de vérification et guide de durcissement sécurité pour la Plateforme STOA en production.

## Couches de Sécurité

```
┌─────────────────────────────────────────┐
│ Réseau (TLS, NetworkPolicy, pare-feu)   │
├─────────────────────────────────────────┤
│ Identité (Keycloak, OIDC, mTLS)         │
├─────────────────────────────────────────┤
│ Application (RBAC, quotas, blocage SSRF)│
├─────────────────────────────────────────┤
│ Conteneur (PSS, seccomp, FS en lecture) │
├─────────────────────────────────────────┤
│ Données (chiffrement au repos, audit)   │
└─────────────────────────────────────────┘
```

## Configuration TLS

### TLS Ingress

Tous les endpoints externes doivent utiliser TLS 1.2+ :

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stoa-gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
spec:
  tls:
    - secretName: gateway-tls
      hosts:
        - mcp.<VOTRE_DOMAINE>
```

### TLS Interne

Pour le chiffrement service-à-service dans le cluster, activez mTLS via le gateway. Voir [Configuration mTLS](/docs/guides/mtls-configuration).

## Politiques Réseau

### Isolation des Tenants

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: stoa-system
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: stoa-system
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: TCP
          port: 53
        - protocol: UDP
          port: 53
    - to:
        - podSelector: {}
```

### Restriction de Sortie du Gateway

Limitez les connexions sortantes du gateway aux backends connus :

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: gateway-egress
  namespace: stoa-system
spec:
  podSelector:
    matchLabels:
      app: stoa-gateway
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: control-plane-api
      ports:
        - port: 8000
    - to:
        - namespaceSelector: {}
      ports:
        - port: 443    # Backends HTTPS
        - port: 53     # DNS
          protocol: UDP
```

## Sécurité des Conteneurs

### Standards de Sécurité des Pods

Appliquez le standard de sécurité des pods `restricted` :

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: stoa-system
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Contexte de Sécurité (Tous les Conteneurs)

```yaml
securityContext:
  privileged: false
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true    # Pas pour les conteneurs nginx
  capabilities:
    drop:
      - ALL
  seccompProfile:
    type: RuntimeDefault
```

## Protection SSRF

Le STOA Gateway inclut une liste de blocage SSRF intégrée qui rejette les URLs backend pointant vers :

- Adresses loopback (`127.0.0.0/8`, `::1`)
- Réseaux privés (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Link-local (`169.254.0.0/16` — métadonnées AWS)
- IPv6 unique-local (`fd00::/8`)

C'est une défense en profondeur : les URLs backend proviennent de données configurées par l'administrateur, mais un Control Plane compromis pourrait injecter des cibles internes.

## En-têtes de Sécurité

Le gateway ajoute automatiquement ces en-têtes à chaque réponse :

| En-tête | Valeur | Objectif |
|---------|--------|---------|
| `X-Content-Type-Options` | `nosniff` | Prévenir le sniffing MIME |
| `X-Frame-Options` | `DENY` | Prévenir le clickjacking |
| `X-XSS-Protection` | `0` | Désactiver le filtre XSS hérité |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Contrôler la fuite de referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restreindre les APIs navigateur |

## Gestion des Secrets

### Architecture Recommandée

```
Infisical (auto-hébergé) → Secrets K8s → Variables d'env des pods
```

- Ne jamais coder les secrets en dur dans le code, les valeurs Helm ou les ConfigMaps
- Utiliser `secretRef` dans les specs de pods pour référencer les Secrets K8s
- Effectuer la rotation des secrets via Infisical ; les pods récupèrent les changements au redémarrage

Voir [Gestion des Secrets](/docs/reference/security-configuration) pour la configuration détaillée.

### Liste de Vérification de Rotation des Secrets

| Secret | Fréquence de Rotation | Méthode |
|--------|-----------------------|--------|
| Mot de passe de base de données | 90 jours | Infisical + redémarrage des pods |
| Secrets clients Keycloak | 90 jours | Admin Keycloak + mise à jour de config |
| Token admin du Gateway | 90 jours | Secret K8s + redémarrage des pods |
| Certificats TLS | Automatique (cert-manager) | cert-manager gère le renouvellement |
| Clés API | À la demande | Initiée par le consommateur via API |

## Alignement Réglementaire

### DORA (Digital Operational Resilience Act)

| Exigence DORA | Capacité STOA |
|---------------|---------------|
| Gestion des risques ICT | RBAC, piste d'audit, monitoring |
| Signalement d'incidents | Alertmanager + logs d'audit |
| Tests de résilience opérationnelle | Benchmarks Gateway Arena |
| Risques tiers | Patron adaptateur multi-gateway |
| Partage d'informations | Piste d'audit OpenSearch |

### NIS2 (Directive Sécurité des Réseaux et des Systèmes d'Information)

| Exigence NIS2 | Capacité STOA |
|---------------|---------------|
| Analyse des risques | En-têtes de sécurité, liste de blocage SSRF |
| Gestion des incidents | Alertes Prometheus, piste d'audit |
| Sécurité de la chaîne d'approvisionnement | Génération SBOM (CI), commits signés |
| Chiffrement | TLS 1.2+, support mTLS |
| Contrôle d'accès | RBAC Keycloak, 4 rôles |

> La Plateforme STOA fournit des capacités techniques qui soutiennent les efforts de conformité réglementaire. Cela ne constitue pas un avis juridique ni une garantie de conformité. Les organisations doivent consulter un conseiller juridique qualifié pour leurs obligations réglementaires.

## Liste de Vérification de Durcissement Production

- [ ] TLS sur tous les endpoints ingress
- [ ] NetworkPolicy appliquée au namespace `stoa-system`
- [ ] Standard de sécurité des pods défini à `restricted`
- [ ] Protection contre la force brute Keycloak activée
- [ ] Durées de vie des tokens réduites (5min accès, 15min inactivité)
- [ ] Liste de blocage SSRF active (par défaut)
- [ ] En-têtes de sécurité actifs (par défaut)
- [ ] Secrets dans Infisical/Vault (pas dans env ou ConfigMap)
- [ ] Rôles RBAC attribués (pas d'accès admin par défaut)
- [ ] Piste d'audit activée (OpenSearch)
- [ ] Alerting configuré (Alertmanager)
- [ ] Images de conteneurs scannées (Trivy en CI)
- [ ] Commits signés imposés

## Voir Aussi

- [Configuration mTLS](/docs/guides/mtls-configuration) -- Tokens liés aux certificats
- [Permissions RBAC](/docs/reference/rbac-permissions) -- Matrice des rôles
- [Configuration Sécurité](/docs/reference/security-configuration) -- JWT, CORS, limites SSE
- [Monitoring & Alerting](/docs/admin/monitoring) -- Configuration des alertes
- [Administration Keycloak](/docs/admin/keycloak) -- Durcissement des identités
