---
title: "ADR-027 : Authentification X509 par En-têtes HTTP"
description: "Décide comment STOA valide les certificats client mTLS via des en-têtes HTTP lorsque le TLS est terminé au niveau du load balancer de bord."
keywords: [mTLS, X509, authentification par certificat, terminaison TLS, Keycloak, sécurité]
---

# ADR-027 : Authentification X509 par En-têtes HTTP

## Statut

Accepté

## Date

2026-01-31

## Contexte

STOA supporte mTLS pour l'authentification des clients API (RFC 8705 Certificate-Bound Access Tokens). En production, le TLS est terminé au niveau du load balancer de bord (F5) — pas au niveau de Keycloak. Keycloak doit donc valider les certificats client reçus via des en-têtes HTTP injectés par le proxy de confiance.

### Décisions Associées

- **ADR-026** : Fédération Multi-IAM — mTLS entre composants
- **ADR-011** : Modes de Sécurité API — mTLS pour les APIs internes CORE
- **CAB-865** : Provisionnement des certificats client
- **CAB-866** : Synchronisation des certificats Keycloak (attributs x509.certificate.sha256)

## Décision

Utiliser le **SPI `x509cert-lookup` intégré de Keycloak** avec le mode de fournisseur nginx. Aucun SPI Java personnalisé n'est requis.

### Architecture

```
Client (mTLS) ──→ F5 / Nginx (termine le TLS) ──→ Keycloak (lit les en-têtes)
                        │
                        └─ Injecte : SSL_CLIENT_CERT, SSL_CLIENT_VERIFY,
                                    SSL_CLIENT_S_DN, SSL_CLIENT_FINGERPRINT
```

### Contrat des En-têtes (F5 → Keycloak)

| En-tête | Contenu | Format |
|--------|---------|--------|
| `SSL_CLIENT_CERT` | Certificat client | PEM encodé en URL |
| `SSL_CLIENT_CERT_CHAIN_0` | Certificat CA émetteur | PEM encodé en URL |
| `SSL_CLIENT_VERIFY` | Résultat de vérification | `SUCCESS` / `FAILED` / `NONE` |
| `SSL_CLIENT_S_DN` | Nom Distingué du Sujet | `CN=client-123.client.stoa.internal` |
| `SSL_CLIENT_FINGERPRINT` | Empreinte SHA-256 | Chaîne hexadécimale |

### Flux d'Authentification

Le flux `x509-client-credentials` utilise :
1. **Authentificateur X509** (ALTERNATIVE, priorité 10) — fait correspondre l'empreinte du certificat avec l'attribut client `x509.certificate.sha256` (défini par CAB-866)
2. **Secret client** (ALTERNATIVE, priorité 20) — repli pour les clients sans certificats

### Configuration

Variables d'environnement Keycloak :
```
KC_SPI_X509CERT_LOOKUP_PROVIDER=nginx
KC_SPI_X509CERT_LOOKUP_NGINX_SSL_CLIENT_CERT=SSL_CLIENT_CERT
KC_SPI_X509CERT_LOOKUP_NGINX_SSL_CERT_CHAIN_PREFIX=SSL_CLIENT_CERT_CHAIN
KC_SPI_X509CERT_LOOKUP_NGINX_CERTIFICATE_CHAIN_LENGTH=1
```

## Considérations de Sécurité

1. **Proxy de Confiance Uniquement** : Une `NetworkPolicy` Kubernetes restreint les sources pouvant envoyer des en-têtes X509 à Keycloak. Sans cela, n'importe quel pod pourrait usurper `SSL_CLIENT_CERT`.
2. **Validation des En-têtes** : Keycloak valide l'empreinte du certificat par rapport à l'attribut `x509.certificate.sha256` du client enregistré.
3. **Journalisation des Audits** : Keycloak journalise toutes les tentatives d'authentification. L'échec d'auth X509 (certificat manquant/invalide) est journalisé au niveau WARN.
4. **Pas de PEM dans les Journaux** : Seules les empreintes sont journalisées ; le PEM complet du certificat n'est jamais écrit dans les journaux.

## Conséquences

### Positives

- Aucun code Java personnalisé à construire, tester ou maintenir
- Utilise le SPI Keycloak éprouvé (supporté depuis Keycloak 4.x)
- Compatible avec tout proxy terminant TLS (F5, nginx, HAProxy, AWS ALB)
- Repli gracieux vers client_secret pour les clients non-mTLS

### Négatives

- Dépend de la configuration correcte du proxy (mauvais nom d'en-tête = échec d'auth silencieux)
- La politique réseau est critique — une mauvaise configuration permet l'usurpation d'en-tête

### Atténuations

- Le proxy nginx de développement imite les en-têtes F5 pour les tests locaux
- Les tests d'intégration valident tous les scénarios d'auth (certificat valide, invalide, manquant, expiré, révoqué)
- La NetworkPolicy est obligatoire (appliquée via les valeurs Helm)
