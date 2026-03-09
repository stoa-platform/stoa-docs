---
title: "ADR-056 : Architecture de Sécurité FAPI 2.0"
description: "Décide de l'approche par phases pour la conformité FAPI 2.0 de STOA Gateway, avec une période de transition en mode dual supportant simultanément les clients publics PKCE existants et les nouveaux clients confidentiels FAPI 2.0. Repose sur les implémentations DPoP et mTLS déjà en production."
keywords: [fapi, oauth, sécurité, dpop, mtls, par, private_key_jwt, confidential-client, keycloak, conformité]
---

# ADR-056 : Architecture de Sécurité FAPI 2.0

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | Accepté |
| **Date** | 2026-03-06 |
| **Ticket** | CAB-1733 |
| **Auteur** | Christophe Aboulicam |
| **Reviewers** | Council 8,13/10 |

## Contexte

La STOA Gateway (65K LOC Rust) implémente déjà les tokens liés à l'expéditeur via DPoP (RFC 9449) et mTLS (RFC 8705) — les deux exigences FAPI 2.0 les plus difficiles. Cependant, la conformité complète au profil de sécurité FAPI 2.0 nécessite des capacités supplémentaires (PAR, private_key_jwt, clients confidentiels) actuellement manquantes.

Keycloak 26.5.3 en production supporte nativement les profils clients FAPI 2.0 (`fapi-2-security-profile`, `fapi-2-dpop-security-profile`). Aucune mise à niveau Keycloak n'est nécessaire — seulement l'activation de la configuration et l'implémentation côté gateway des flux manquants.

### État Actuel (Résultats du Spike)

**Implémenté (conforme FAPI 2.0)** :
- Validation de preuve DPoP — RFC 9449 Section 4.3 complet, 843 LOC, prévention des replays via cache moka
- Liaison de certificat mTLS — RFC 8705 complet, 1 122 LOC, vérification cnf.x5t#S256
- Middleware de contrainte d'expéditeur unifié — DPoP + mTLS dans un pipeline unique, 621 LOC
- Enforcement PKCE S256 — via le patching de client DCR
- Découverte OAuth — RFC 9728 + RFC 8414 métadonnées
- Échange de token — RFC 8693 dans le Control Plane API (10 cas de test)

**Manquant (requis pour FAPI 2.0)** :
- PAR (Pushed Authorization Requests, RFC 9126) — pas de code existant
- Authentification client private_key_jwt (RFC 7523) — seul client_secret est supporté
- Enforcement des clients confidentiels — l'OAuth MCP actuel utilise des clients publics (PKCE sans secret)
- Proxy de révocation de token — Keycloak le gère, la gateway ne le proxyfie pas

**Manquant (recommandé/optionnel)** :
- JARM (JWT-Secured Authorization Response Mode)
- RAR (Rich Authorization Requests, RFC 9396)
- CIBA (Client-Initiated Backchannel Authentication)

## Décision

Adopter une **approche par phases** pour la conformité FAPI 2.0 avec une période de transition en mode dual :

### Architecture

```
                        FAPI 2.0 Security Profile
                        ========================

Client                  STOA Gateway                    Keycloak 26.5.3
  |                         |                               |
  |--- PAR Request -------->| POST /oauth/par               |
  |                         |--- Forward PAR ------------->  |
  |<-- request_uri ---------|<-- request_uri + expiry ------|
  |                         |                               |
  |--- Auth Request ------->| (validate request_uri)        |
  |                         |--- Forward auth ------------> |
  |<-- auth code -----------|<-- auth code -----------------|
  |                         |                               |
  |--- Token Request ------>| POST /oauth/token             |
  |  + client_assertion     |--- Validate JWT assertion --->|
  |  + code_verifier        |--- Forward token req -------->|
  |  + DPoP proof           |<-- access_token + cnf.jkt ----|
  |<-- access_token --------|                               |
  |                         |                               |
  |--- API Request -------->| Verify:                       |
  |  + DPoP proof           |  1. JWT signature             |
  |  + mTLS cert            |  2. DPoP binding (cnf.jkt)    |
  |                         |  3. mTLS binding (cnf.x5t)    |
  |                         |  4. OPA policy                |
  |<-- Response ------------|                               |
```

### Modèle de Menace (STRIDE)

| Menace | Catégorie | Atténuation |
|--------|-----------|-------------|
| Vol de token + rejeu | Usurpation | Liaison DPoP (cnf.jkt) — token inutilisable sans clé privée |
| Man-in-the-middle | Falsification | Liaison mTLS (cnf.x5t#S256) — certificat épinglé au token |
| Injection de code d'autorisation | Falsification | PAR — paramètres auth envoyés côté serveur, pas dans l'URL |
| Usurpation de client | Usurpation | private_key_jwt — pas de secrets partagés, preuve asymétrique |
| Exfiltration de token | Divulgation d'information | Contraintes d'expéditeur — token volé nécessite DPoP/cert correspondant |
| Escalade de scope | Élévation de privilèges | Enforcement de politique OPA + RAR (Phase 2) |

### Transition en Mode Dual

Pendant la transition, la gateway supporte **deux profils de sécurité client** simultanément :

| Profil | Méthode d'Auth | Clients | Calendrier |
|--------|----------------|---------|------------|
| **Standard** (actuel) | PKCE Public + `auth_method: none` | Claude.ai, clients MCP | Maintenant → fin Phase 2 |
| **FAPI 2.0** | Confidentiel + `private_key_jwt` + DPoP/mTLS | Clients financiers/réglementés | Phase 1 → permanent |

Le profil par client est déterminé par la configuration du client Keycloak. Les clients MCP existants continuent de fonctionner sans changement. Les nouveaux clients FAPI obtiennent le profil de sécurité complet.

### Frontière Gateway ↔ Control Plane API

| Responsabilité | Gateway (Rust) | CP API (Python) |
|----------------|----------------|-----------------|
| Proxy endpoint PAR | `POST /oauth/par` → KC | N/A |
| Validation d'assertion client | Vérification signature JWT | N/A |
| Enforcement contrainte d'expéditeur | Middleware DPoP + mTLS | N/A |
| Échange de token | N/A (futur Phase 2) | `POST /v1/consumers/.../token-exchange` |
| Cycle de vie client | Proxy DCR + patch PKCE | `create_consumer_client()` avec config FAPI |
| Attribution profil client FAPI | N/A | KC admin API — définir profil client |

## Phases d'Implémentation

### Phase 1 — Fondation FAPI 2.0 ✅ (complétée PR #1526)

1. ✅ **Proxy PAR** (`POST /oauth/par`) — nouvel endpoint, transmission à KC, retour `request_uri`
2. ✅ **Activer le profil KC FAPI** — `fapi-2-security-profile` sur les nouveaux clients
3. ✅ **Activation OTel** — kill-switch runtime (`OTEL_ENABLED=true/false`), pas seulement au moment de la compilation
4. ✅ **ADR + docs** — ce document
5. ✅ **Unifier les versions KC** — quickstart/E2E vers 26.5.3

### Phase 2 — Clients Confidentiels + Gouvernance (3-6 mois)

6. ✅ **private_key_jwt** — parsing d'assertion client, validation JWKS, mise à jour des métadonnées de découverte (PR #1531)
7. **Échange de token dans la gateway** — proxy RFC 8693 pour les chaînes de délégation agent
8. **RAR** — rich authorization requests pour l'accès API fine-grained
9. **Modèle de délégation agent** — claim `on_behalf_of`, suivi d'intention, consentement

### Phase 3 — Certification (6-12 mois)

10. **Suite de tests de conformité FAPI 2.0** — tests OpenID Foundation
11. **Certification formelle** — listing OpenID Foundation
12. **Modèle de menace STRIDE** — revue de sécurité formelle

### Phase 4 — Innovation (12-18 mois)

13. **Mode sidecar eBPF** — enforcement de politique au niveau kernel
14. **eIDAS 2.0** — intégration du Portefeuille d'Identité Numérique Européen
15. **Signature de Message FAPI 2.0** — non-répudiation requête/réponse

## Conséquences

### Positives
- STOA devient l'une des premières gateways API open source avec conformité FAPI 2.0
- Déverrouille les segments de marché réglementés (finance, santé, e-gouvernement)
- L'investissement existant DPoP + mTLS (2 586 LOC) est directement réutilisé
- Keycloak 26.5.3 déjà déployé — pas de mise à niveau d'infrastructure nécessaire
- Le mode dual empêche de casser les intégrations MCP existantes

### Négatives
- PAR ajoute de la latence (aller-retour supplémentaire vers KC avant l'autorisation)
- private_key_jwt nécessite la gestion des clés client (endpoints JWKS par client)
- L'exigence de client confidentiel casse le flux MCP OAuth Claude.ai actuel (atténué par le mode dual)
- La certification FAPI a un coût de maintenance continu (re-certification annuelle)

### Risques
- Claude.ai pourrait ne pas supporter private_key_jwt pour MCP OAuth (atténuation : conserver le profil standard)
- Les profils FAPI 2.0 Keycloak peuvent avoir des cas limites non couverts par les tests KC (atténuation : suite de conformité propre)
- Le toggle runtime OTel peut avoir un impact sur les performances même quand désactivé (atténuation : benchmark)

## Références

- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-security-profile-id2-2-01.html)
- [RFC 9449 — DPoP](https://www.rfc-editor.org/rfc/rfc9449)
- [RFC 8705 — mTLS](https://www.rfc-editor.org/rfc/rfc8705)
- [RFC 9126 — PAR](https://www.rfc-editor.org/rfc/rfc9126)
- [RFC 7523 — JWT Bearer Client Auth](https://www.rfc-editor.org/rfc/rfc7523)
- [RFC 8693 — Token Exchange](https://www.rfc-editor.org/rfc/rfc8693)
- [Keycloak 26 FAPI 2.0 Support](https://www.keycloak.org/docs/latest/securing_apps/#_fapi-2-0-support)
