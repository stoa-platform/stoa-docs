---
sidebar_position: 3
title: "Flux d'Authentification mTLS du Gateway"
description: "Schémas d'architecture détaillés pour la validation des tokens liés aux certificats mTLS dans le STOA Gateway, incluant les flux de bout en bout et l'intégration Keycloak."
keywords: [mTLS, authentication, gateway, certificate, TLS, security, Keycloak]
---

# Flux d'Authentification mTLS du Gateway

Schémas d'architecture détaillés pour la validation des tokens liés aux certificats mTLS dans le STOA Gateway (Rust).

> **ADRs associés** : [ADR-027](adr/adr-027-x509-header-authentication.md) (En-têtes X509), [ADR-028](adr/adr-028-rfc8705-certificate-binding.md) (Liaison RFC 8705), [ADR-029](adr/adr-029-mtls-certificate-lifecycle.md) (Cycle de vie des certificats), [ADR-039](adr/adr-039-mtls-cert-bound-tokens.md) (mTLS Gateway Rust)
>
> **Linear** : CAB-864

---

## 1. Flux mTLS de Bout en Bout

```
                                                    STOA Platform (Cluster K8s)
                                    ┌──────────────────────────────────────────────────┐
                                    │                                                  │
                    mTLS            │   HTTP + en-têtes X-SSL-*                        │
 ┌──────────┐   (TLS 1.2/1.3)   ┌─────────┐                  ┌───────────────────┐    │
 │          │ ─────────────────► │         │ ────────────────► │                   │    │
 │  Client  │   Cert client +   │   F5    │   X-SSL-Client-*  │   STOA Gateway    │    │
 │   App    │   Token Bearer    │  BigIP  │   + Authorization  │   (Rust/axum)     │    │
 │          │ ◄───────────────── │         │ ◄──────────────── │                   │    │
 └──────────┘    Réponse         └─────────┘    Réponse        └───────┬───────────┘    │
                                    │                                   │               │
                                    │                                   │ Récup. JWKS   │
                                    │                          ┌────────▼────────┐      │
                                    │                          │    Keycloak     │      │
                                    │                          │  (JWKS + cnf)  │      │
                                    │                          └─────────────────┘      │
                                    │                                                  │
                                    └──────────────────────────────────────────────────┘
```

### Détail Étape par Étape

```
Étape 1 : Handshake TLS + Présentation du Certificat Client
════════════════════════════════════════════════════════════

  Client                              F5 BigIP
    │                                    │
    │──── ClientHello ──────────────────►│
    │◄─── ServerHello + ServerCert ──────│
    │◄─── CertificateRequest ────────────│   F5 demande le cert client
    │──── ClientCertificate ────────────►│   Le client envoie son cert X.509
    │──── CertificateVerify ────────────►│   Le client prouve la possession de sa clé privée
    │──── Finished ─────────────────────►│
    │◄─── Finished ──────────────────────│
    │                                    │
    │  Session TLS établie              │


Étape 2 : F5 Valide le Certificat Client
═══════════════════════════════════════

  F5 BigIP (validation interne)
    │
    ├── Vérifier la signature contre la chaîne CA
    │     Root CA ──► CA Intermédiaire ──► Cert client
    │
    ├── Vérifier la période de validité
    │     NotBefore <= maintenant <= NotAfter
    │
    ├── Vérifier la révocation
    │     ├── Téléchargement CRL (si configuré)
    │     └── Requête OCSP (si configuré)
    │
    └── Résultat : SUCCÈS ou ÉCHEC:<raison>
          │
          └── ÉCHEC → F5 retourne 403 au client, la requête n'atteint PAS le Gateway


Étape 3 : F5 Injecte les En-têtes et Transmet la Requête
════════════════════════════════════════════════════════

  F5 ──────────► STOA Gateway
  En-têtes injectés :
    Authorization: Bearer <jwt>                        (du client)
    X-SSL-Client-Verify: SUCCESS                       (par F5)
    X-SSL-Client-S-DN: CN=acme-consumer,O=Acme Corp   (par F5)
    X-SSL-Client-I-DN: CN=STOA Platform CA,O=STOA     (par F5)
    X-SSL-Client-Serial: 0A:1B:2C:3D:4E:5F            (par F5)
    X-SSL-Client-Fingerprint: a1b2c3d4e5f6...          (par F5, SHA-256 hex)
    X-SSL-Client-NotAfter: 2027-01-01T00:00:00Z        (par F5)


Étape 4 : Le Gateway Extrait les Métadonnées du Certificat (auth/mtls.rs)
═══════════════════════════════════════════════════════════

  extract_certificate_from_headers(&headers, &config)
    │
    ├── Lire X-SSL-Client-Verify
    │     "SUCCESS" → continuer
    │     autre chose → retourner Err(MTLS_CERT_INVALID)
    │
    ├── Lire X-SSL-Client-Fingerprint
    │     normaliser : supprimer les deux-points, minuscules
    │     calculer base64url : hex → bytes → base64url_encode
    │
    ├── Lire X-SSL-Client-S-DN → subject_dn
    ├── Lire X-SSL-Client-I-DN → issuer_dn
    │     vérifier allowed_issuers (si configuré)
    ├── Lire X-SSL-Client-Serial → serial
    ├── Lire X-SSL-Client-NotAfter → not_after
    │     vérifier expiration : not_after > maintenant
    │
    └── Retourner Ok(CertificateInfo { ... })
          → stocké dans request.extensions()


Étape 5 : Le Gateway Valide le JWT + Extrait cnf (extension claims.rs)
════════════════════════════════════════════════════════════════════

  Flux JWT existant (inchangé) :
    │
    ├── Extraire le token Bearer de l'en-tête Authorization
    ├── Décoder l'en-tête JWT → obtenir kid
    ├── Récupérer JWKS depuis Keycloak (cache moka, TTL 5min)
    ├── Vérifier la signature RS256
    ├── Valider iss, aud, exp, leeway
    └── Désérialiser la structure Claims
          │
          └── NOUVEAU champ : claims.cnf: Option<CnfClaim>
                │
                └── CnfClaim { x5t_s256: Option<String> }
                      = SHA-256 encodé en base64url du DER du cert client


Étape 6 : Le Gateway Vérifie la Liaison Certificat-Token (auth/mtls.rs)
════════════════════════════════════════════════════════════════

  verify_certificate_binding(&cert_info, &cnf_claim)
    │
    ├── Obtenir cert_info.fingerprint_b64url (calculé à l'étape 4)
    │     "obLD1N5..."
    │
    ├── Obtenir cnf_claim.x5t_s256
    │     "obLD1N5..."
    │
    ├── Décoder les deux en bytes
    │
    ├── Comparaison temporellement constante (subtle::ConstantTimeEq)
    │     cert_bytes.ct_eq(&token_bytes)
    │
    ├── CORRESPONDANCE → continuer vers RBAC + handler
    │
    ├── DISCORDANCE → 403 MTLS_BINDING_MISMATCH
    │
    ├── Pas de cert + mtls_required → 401 MTLS_CERT_REQUIRED
    │
    └── Pas de cnf + cert présent + require_binding → 403 MTLS_BINDING_REQUIRED
```

---

## 2. Enregistrement des Consommateurs (Liaison de Certificat)

Cette procédure étend l'enregistrement des consommateurs de la Phase 2 (CAB-1121) avec la liaison de certificat.

```
  ┌──────────────┐
  │  Opérateur   │
  │  (Console)   │
  └──────┬───────┘
         │
         │ POST /api/v1/consumers
         │ Body: { external_id, display_name, tenant_id, certificate_pem }
         ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     Control Plane API                           │
  │                                                                 │
  │  1. Valider le certificat (existant : certificates.py)          │
  │     ├── Parser PEM → X.509                                      │
  │     ├── Vérifier expiration (alerter si < 30 jours)            │
  │     ├── Vérifier taille minimale de clé (2048 RSA / P-256 EC)  │
  │     └── Extraire : subject, issuer, SAN, taille clé, empreinte │
  │                                                                 │
  │  2. Calculer l'empreinte du certificat pour RFC 8705           │
  │     ├── Encoder le certificat en DER                           │
  │     ├── Hash SHA-256                                            │
  │     └── Encoder en Base64url → x5t_s256                        │
  │                                                                 │
  │  3. Créer le client Keycloak (existant : CAB-1121 Phase 2)     │
  │     ├── Client ID : {tenant}-{consumer_external_id}            │
  │     ├── Grant type : client_credentials                         │
  │     ├── Service account : activé                               │
  │     ├── Attribut client : x5t_s256 = <empreinte>              │
  │     └── Attribut client : x509.certificate.sha256 = <hex>      │
  │                (pour l'authentificateur x509 Keycloak, ADR-027) │
  │                                                                 │
  │  4. Configurer le protocol mapper cnf sur le client            │
  │     ├── Type de mapper : Hardcoded claim                        │
  │     ├── Nom de la claim token : cnf                             │
  │     ├── Type JSON de la claim : JSON                            │
  │     ├── Valeur : {"x5t#S256": "<x5t_s256>"}                   │
  │     ├── Ajouter au token d'accès : true                        │
  │     └── Ajouter au token ID : false                             │
  │                                                                 │
  │  5. Enregistrer le consommateur                                │
  │     ├── consumer_id, tenant_id, external_id                    │
  │     ├── keycloak_client_id                                      │
  │     ├── certificate_fingerprint (SHA-256 hex)                   │
  │     ├── certificate_fingerprint_b64url (pour la vérification)  │
  │     ├── certificate_subject_dn, certificate_not_after          │
  │     └── mtls_enabled = true                                    │
  │                                                                 │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Flux d'Enregistrement en Masse (Phase 3)

```
  L'opérateur prépare un CSV (100 lignes max) :
  ┌──────────────────────────────────────────────────────────────────┐
  │ external_id,display_name,tenant_id,certificate_pem              │
  │ acme-svc-001,Acme Service 1,tenant-acme,-----BEGIN CERT...      │
  │ acme-svc-002,Acme Service 2,tenant-acme,-----BEGIN CERT...      │
  │ ...                                                              │
  │ acme-svc-100,Acme Service 100,tenant-acme,-----BEGIN CERT...    │
  └──────────────────────────────────────────────────────────────────┘
        │
        │  POST /api/v1/admin/consumers/bulk
        │  Content-Type: multipart/form-data
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     Control Plane API                           │
  │                                                                 │
  │  Par ligne (séquentiel, chaque ligne est atomique) :            │
  │  ┌─────────────────────────────────────────────────────────┐    │
  │  │ 1. Valider le certificat PEM                            │    │
  │  │ 2. Calculer l'empreinte x5t_s256                        │    │
  │  │ 3. Créer le client Keycloak + protocol mapper cnf       │    │
  │  │ 4. Enregistrer le consommateur en base                  │    │
  │  │                                                         │    │
  │  │ En cas de succès : { row, status: "success", consumer_id } │ │
  │  │ En cas d'échec : rollback ligne, { row, status: "error", ... } │
  │  └─────────────────────────────────────────────────────────┘    │
  │                                                                 │
  │  Toutes les lignes sont traitées (les échecs n'arrêtent pas le lot). │
  └──────────────────────────────────────────────────────────────────┘
        │
        ▼
  Réponse :
  {
    "total": 100,
    "success": 97,
    "failed": 3,
    "results": [
      { "row": 1,  "status": "success", "consumer_id": "...", "client_id": "..." },
      { "row": 42, "status": "error",   "error": "certificate expired" },
      ...
    ]
  }
```

---

## 4. Modes de Défaillance

| # | Défaillance | Où | HTTP | Code d'erreur | Récupération |
|---|-------------|-----|------|---------------|--------------|
| F1 | Cert client expiré | F5 | Erreur TLS (pas HTTP) | N/A | Le client renouvelle le cert auprès de la CA |
| F2 | Cert client révoqué | F5 | Erreur TLS (pas HTTP) | N/A | Réémettre le cert, mettre à jour la CRL |
| F3 | CA inconnue | F5 | Erreur TLS (pas HTTP) | N/A | Importer la CA dans le trust store F5 |
| F4 | Vérification F5 = FAILED | Gateway | 403 | `MTLS_CERT_INVALID` | Consulter les logs F5 pour la raison |
| F5 | Pas d'en-têtes cert + mtls requis | Gateway | 401 | `MTLS_CERT_REQUIRED` | Le client doit présenter un cert |
| F6 | JWT expiré | Gateway | 401 | `TOKEN_EXPIRED` | Rafraîchir le token |
| F7 | JWT sans claim `cnf` | Gateway | 403 | `MTLS_BINDING_REQUIRED` | Enregistrer le cert sur le client Keycloak, obtenir un nouveau token |
| F8 | Discordance d'empreinte | Gateway | 403 | `MTLS_BINDING_MISMATCH` | Le token a été émis pour un autre cert |
| F9 | Cert renouvelé, ancien token | Gateway | 403 | `MTLS_BINDING_MISMATCH` | Obtenir un nouveau token (période de grâce ADR-029) |
| F10 | Émetteur pas dans la liste autorisée | Gateway | 403 | `MTLS_ISSUER_DENIED` | Ajouter l'émetteur à `STOA_MTLS_ALLOWED_ISSUERS` |
| F11 | Usurpation d'en-tête | Gateway | 403 | `MTLS_CERT_INVALID` | Appliquer la NetworkPolicy K8s (ADR-027) |
| F12 | Mapper Keycloak manquant | Keycloak | 403 | `MTLS_BINDING_REQUIRED` | Configurer le protocol mapper cnf sur le client |

---

## 5. Rotation des Certificats (Intégration ADR-029)

```
  Jour 0                            Jour 0+période_grâce
    │                                    │
    ▼                                    ▼
  ┌──────────┐     Rotation    ┌──────────────────────┐     Grâce expirée    ┌──────────┐
  │ Cert A   │  ──────────→    │ Cert A + Cert B      │  ──────────────→     │ Cert B   │
  │ (actif)  │                 │ (tous deux valides)   │                      │ (actif)  │
  └──────────┘                 └──────────────────────┘                      └──────────┘

  PUT /api/v1/consumers/{id}/certificate
    │
    ├── Valider le nouveau certificat
    ├── Calculer le nouveau x5t_s256
    ├── Stocker l'ancienne empreinte comme certificate_fingerprint_previous
    ├── Définir previous_cert_expires_at = maintenant + période_grâce (défaut : 24h)
    ├── Mettre à jour l'attribut client Keycloak avec le nouveau x5t_s256
    └── Durant la période de grâce : le Gateway accepte les tokens liés à L'UN OU L'AUTRE empreinte
```

---

## 6. Sécurité Réseau

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                     Cluster Kubernetes                         │
  │                                                                │
  │   ┌─────────────┐    NetworkPolicy     ┌──────────────────┐   │
  │   │   F5 BigIP  │───(ingress: allow)──►│  STOA Gateway    │   │
  │   │   (pod)     │    X-SSL-* approuvé  │  (pod)           │   │
  │   └─────────────┘                      └──────────────────┘   │
  │                                                                │
  │   ┌─────────────┐    NetworkPolicy     ┌──────────────────┐   │
  │   │  Autre Pod  │───(BLOQUÉ)────X────►│  STOA Gateway    │   │
  │   │             │    X-SSL-* supprimé  │  (pod)           │   │
  │   └─────────────┘                      └──────────────────┘   │
  │                                                                │
  │   Défense en profondeur : le Gateway supprime X-SSL-* des     │
  │   sources non-F5, même si la NetworkPolicy est mal configurée. │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 7. Observabilité

### Métriques Prometheus

```
stoa_gateway_mtls_requests_total{status="success|binding_mismatch|cert_invalid|cert_required|binding_required"}
stoa_gateway_mtls_binding_duration_seconds{quantile="0.5|0.9|0.99"}
stoa_gateway_mtls_cert_expiry_days{consumer_id, tenant_id}
```

### Champs de Log Structuré

```json
{
  "event": "mtls_auth",
  "status": "success",
  "cert_subject_dn": "CN=acme-consumer,O=Acme Corp,C=FR",
  "cert_serial": "0A:1B:2C:3D:4E:5F",
  "cert_not_after": "2027-01-01T00:00:00Z",
  "binding_match": true,
  "user_id": "acme-consumer-001",
  "tenant_id": "tenant-acme",
  "trace_id": "abc123"
}
```

### Alertes

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| `MtlsBindingMismatchRate` | taux binding_mismatch &gt; 0.1/s sur 5min | Warning |
| `MtlsCertExpiringSoon` | cert_expiry_days &lt; 30 | Warning |
| `MtlsCertExpired` | cert_expiry_days &lt;= 0 | Critical |
| `MtlsHighFailureRate` | taux d'échec &gt; 5% sur 5min | Critical |
