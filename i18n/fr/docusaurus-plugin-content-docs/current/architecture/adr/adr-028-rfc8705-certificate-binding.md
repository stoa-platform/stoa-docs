---
title: "ADR-028 : Validation de Liaison de Certificat RFC 8705"
description: "Décide comment le MCP Gateway valide les tokens JWT liés à un certificat en utilisant la normalisation d'empreinte RFC 8705 et la comparaison sécurisée en temps constant."
keywords: [RFC 8705, liaison de certificat, JWT, mTLS, empreinte, sécurité]
---

# ADR-028 : Validation de Liaison de Certificat RFC 8705

## Statut

Accepté

## Date

2026-02-01

## Contexte

STOA supporte mTLS pour l'authentification des clients API en utilisant les RFC 8705 Certificate-Bound Access Tokens. Les tokens JWT contiennent une claim `cnf.x5t#S256` avec l'empreinte SHA-256 du certificat client. Le MCP Gateway doit valider que le certificat présenté par le client (via l'en-tête du proxy terminant TLS) correspond à l'empreinte liée au JWT.

Le défi : différents systèmes dans la chaîne utilisent différents formats d'empreinte.

| Système | Format | Exemple |
|--------|--------|---------|
| JWT RFC 8705 (`cnf.x5t#S256`) | base64url | `hLmVMvjnmCm_I4d8_3nw5A` |
| F5 / Nginx (par défaut) | hex minuscule | `84b99532f8e79829bf23877cff79f0e4` |
| Sortie CLI OpenSSL | hex avec deux-points | `84:B9:95:32:F8:E7:98:29:BF:23:87:7C:FF:79:F0:E4` |

De plus, le nom de l'en-tête injecté par le proxy terminant TLS varie selon le déploiement (`X-SSL-Client-Cert-SHA256`, `X-Client-Cert-Fingerprint`, `SSL_CLIENT_FINGERPRINT`, etc.).

### Décisions Associées

- **ADR-027** : Authentification X509 par En-têtes HTTP — contrat d'en-têtes entre F5 et Keycloak
- **ADR-011** : Modes de Sécurité API — mTLS pour les APIs internes CORE
- **CAB-868** : Métriques de Liaison de Certificat
- **CAB-1024** : Politique de Liaison de Certificat Pilotée par UAC

## Décision

### 1. Normalisation en hex minuscule pour toutes les comparaisons

Les trois formats d'empreinte sont normalisés en hex minuscule (sans séparateurs) avant comparaison. Cela évite les problèmes de sensibilité à la casse et l'ambiguïté de format.

```
base64url  →  décoder  →  hex minuscule
hex majuscule  →  minuscule   →  hex minuscule
hex:deux-points →  supprimer   →  hex minuscule
```

### 2. Comparaison sécurisée en temps constant

Toutes les comparaisons d'empreintes utilisent `secrets.compare_digest()` pour prévenir les attaques par canal auxiliaire basées sur le timing. Cela s'applique au middleware MCP Gateway et au module partagé `fingerprint_utils`.

### 3. Détection automatique du format lorsqu'il n'est pas spécifié

`detect_format(fingerprint)` inspecte le motif de la chaîne :
- Contient `:` → `hex_colons`
- Correspond à `^[a-fA-F0-9]+$` → `hex`
- Sinon → `base64url` (avec validation du jeu de caractères : `^[A-Za-z0-9\-_]+$`)

### 4. Configuration pilotée par UAC

Tous les paramètres de liaison de certificat sont configurables par tenant via le schéma UAC (Universal API Contract) :

| Chemin UAC | Type | Défaut | Description |
|----------|------|---------|-------------|
| `security.authentication.mtls.cert_binding.enabled` | boolean | `true` | Activer la validation de liaison de certificat |
| `security.authentication.mtls.cert_binding.header_name` | string | `X-SSL-Client-Cert-SHA256` | En-tête du proxy TLS |
| `security.authentication.mtls.cert_binding.fingerprint_format` | enum | `hex` | Format : `base64url`, `hex`, `hex_colons` |
| `security.authentication.mtls.cert_binding.jwt_claim` | string | `cnf.x5t#S256` | Chemin de claim JWT |
| `security.authentication.mtls.cert_binding.strict_mode` | boolean | `true` | Rejeter si `cnf` présent mais en-tête absent |

### 5. Utilitaires centralisés

Toute la logique de conversion de format réside dans `control-plane-api/src/services/fingerprint_utils.py` :
- Énumération `FingerprintFormat`
- `detect_format()`, `normalize_to_hex()`, `hex_to_base64url()`
- `fingerprints_match()` — comparaison cross-format sécurisée en temps constant

Le MCP Gateway duplique la normalisation inline (ne peut pas importer depuis control-plane-api), mais suit le même algorithme.

### 6. Génération de politique webMethods

La configuration UAC cert_binding génère une action de politique `requestProcessing` webMethods via `mappers.py`, en passant le nom d'en-tête, le format, la claim JWT et le mode strict comme paramètres de mapping d'entrée.

## Conséquences

### Positives

- **Fonctionne avec n'importe quelle configuration F5/LB** — le nom d'en-tête et le format sont configurables, pas codés en dur
- **Aucun changement de code par déploiement** — le schéma UAC pilote toute la configuration
- **Sécurisé contre les attaques de timing** — `secrets.compare_digest` partout
- **Correspondance cross-format** — la même empreinte en hex, base64url ou avec deux-points correspond correctement
- **Feature flag** — `cert_binding_enabled` permet un déploiement progressif

### Négatives

- **Trois conversions de format** — doit gérer correctement base64url, hex et hex_colons
- **Complexité du schéma UAC** — ajoute un objet `cert_binding` imbriqué à `security.authentication.mtls`
- **Normalisation dupliquée** — MCP Gateway et control-plane-api ont chacun leur propre implémentation (runtimes différents)

### Risques

- **Ambiguïté base64url** — une chaîne hex comme `abcdef1234` pourrait être détectée à tort comme hex alors qu'elle est en base64url. Atténuée par des indications explicites de format dans la configuration UAC.
- **Usurpation d'en-tête** — si l'en-tête proxy n'est pas supprimé des requêtes externes, un attaquant pourrait injecter une fausse empreinte. Atténuée par la configuration F5/Nginx (proxy de confiance uniquement).
