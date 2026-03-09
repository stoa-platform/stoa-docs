---
title: "ADR-029 : Gestion du Cycle de Vie des Certificats mTLS"
description: "Décide de l'architecture pour la rotation automatisée des certificats mTLS, l'onboarding en masse et le renouvellement à zéro downtime pour les consommateurs d'API d'entreprise."
keywords: [mTLS, cycle de vie des certificats, rotation, onboarding en masse, zéro downtime, PKI]
---

# ADR-029 : Gestion du Cycle de Vie des Certificats mTLS

## Statut

Accepté

## Date

2026-02-01

## Contexte

Les clients d'entreprise exploitant plus de 100 consommateurs d'API avec des certificats mTLS font face à des défis opérationnels :
- La rotation manuelle des certificats prend 5 à 10 jours par certificat
- Le zéro downtime est requis lors de la rotation (engagements SLA)
- La conformité (PCI-DSS, SOC2) nécessite une piste d'audit complète de toutes les opérations sur les certificats
- Des périodes de grâce doivent permettre aux anciens et nouveaux certificats de coexister lors de la migration

### Décisions Associées

- **ADR-028** : Validation de Liaison de Certificat RFC 8705 — comparaison des empreintes
- **ADR-027** : Authentification X509 par En-têtes HTTP — contrat d'en-têtes
- **CAB-865** : API de provisionnement des certificats client
- **CAB-866** : Synchronisation des certificats Keycloak
- **CAB-869** : Rotation des certificats avec période de grâce

## Décision

### 1. Provisionnement automatisé via API

Les clients sont provisionnés via `POST /v1/clients` qui génère un certificat et retourne la clé privée **une seule fois** (jamais stockée côté serveur).

Deux fournisseurs de certificats :

| Fournisseur | Cas d'Usage | Implémentation |
|----------|----------|----------------|
| `MockCertificateProvider` | Développement, démos | Certificats auto-signés via la bibliothèque `cryptography` |
| `VaultPKIProvider` | Production | Moteur de secrets PKI HashiCorp Vault (P1) |

Le fournisseur est sélectionné via la configuration. Les deux implémentent la même interface : `generate_certificate(cn, tenant_id) → (cert_pem, key_pem, fingerprint, serial)`.

### 2. Rotation avec période de grâce

Lorsqu'un certificat est renouvelé (`POST /v1/clients/{id}/rotate`) :

1. Un nouveau certificat est généré
2. L'ancienne empreinte passe à `certificate_fingerprint_previous`
3. `previous_cert_expires_at` est défini à `maintenant + période_de_grâce`
4. L'attribut utilisateur Keycloak est mis à jour avec **les deux** empreintes
5. La clé privée est retournée **une seule fois** dans la réponse
6. Les anciens et nouveaux certificats sont valides pendant la période de grâce

```
┌──────────┐     Rotation      ┌──────────────────────────────┐     Expiration Grâce     ┌──────────┐
│ Cert A   │  ──────────→    │ Cert A (grâce) + Cert B      │  ──────────────→      │ Cert B   │
│ (actif)  │                 │ (tous deux valides)           │                       │ (actif)  │
└──────────┘                 └──────────────────────────────┘                       └──────────┘
```

### 3. Période de grâce basée sur le temps (pas le nombre de requêtes)

**Choisi** : La période de grâce expire après une durée configurable (défaut : 24 heures, plage : 1h-168h).

**Alternative rejetée** : Période de grâce basée sur le nombre de requêtes (ex. « l'ancien certificat valide pour 1000 requêtes supplémentaires ») :
- Plus difficile à prédire quand la migration est terminée
- Nécessite un compteur distribué entre les instances de gateway
- Cas limite : les clients à faible trafic pourraient ne jamais épuiser le compteur

La période de grâce basée sur le temps est plus simple, prévisible et suffisante pour tous les cas d'usage observés.

### 4. Nettoyage piloté par événements

Les événements du cycle de vie des certificats sont publiés dans Kafka (`stoa.metering.events`) :

| Événement | Déclencheur | Action du Consommateur |
|-------|---------|-----------------|
| `ClientCreatedEvent` | `POST /v1/clients` | Synchroniser l'empreinte vers Keycloak |
| `CertificateRotatedEvent` | `POST /v1/clients/{id}/rotate` | Mettre à jour Keycloak avec les deux empreintes |
| `GracePeriodExpiredEvent` | Vérification planifiée ou TTL | Effacer `certificate_fingerprint_previous` dans la BD et Keycloak |
| `ClientRevokedEvent` | `DELETE /v1/clients/{id}` | Supprimer de Keycloak, marquer révoqué dans la BD |

Tous les consommateurs sont **idempotents** — sûrs pour rejouer les événements après un échec.

### 5. Schéma de Base de Données

```sql
-- Migration 013 : Créer la table clients
CREATE TABLE clients (
    id                              UUID PRIMARY KEY,
    tenant_id                       VARCHAR(255) NOT NULL,
    name                            VARCHAR(255) NOT NULL,
    certificate_cn                  VARCHAR(255) NOT NULL,
    certificate_serial              VARCHAR(255),
    certificate_fingerprint         VARCHAR(255),
    certificate_pem                 TEXT,
    certificate_not_before          TIMESTAMPTZ,
    certificate_not_after           TIMESTAMPTZ,
    status                          clientstatus DEFAULT 'active',
    created_at                      TIMESTAMPTZ DEFAULT now(),
    updated_at                      TIMESTAMPTZ DEFAULT now()
);

-- Migration 014 : Ajouter les champs de rotation
ALTER TABLE clients ADD COLUMN certificate_fingerprint_previous VARCHAR(255);
ALTER TABLE clients ADD COLUMN previous_cert_expires_at         TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN last_rotated_at                  TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN rotation_count                   INTEGER DEFAULT 0;
```

La période de grâce est déterminée en comparant `previous_cert_expires_at` à l'heure actuelle :

```python
@property
def is_in_grace_period(self) -> bool:
    if not self.previous_cert_expires_at:
        return False
    return datetime.now(timezone.utc) < self.previous_cert_expires_at
```

### 6. Révocation

La révocation est une suppression douce : `status` est défini à `revoked`, le client reste dans la base de données à des fins d'audit. L'attribut utilisateur Keycloak est effacé, et le certificat n'est plus valide pour l'authentification.

## Conséquences

### Positives

- **Rotation à zéro downtime** — les deux certificats valides pendant la période de grâce
- **Piste d'audit** — toutes les opérations enregistrées via les événements Kafka + horodatages BD
- **Période de grâce configurable** — par rotation, s'adapte à la vitesse de migration du client
- **Événements idempotents** — sûrs pour rejouer, résilients aux échecs du consommateur
- **Séparation des responsabilités** — l'API gère le provisionnement, Kafka gère la synchronisation

### Négatives

- **Deux empreintes actives** — surface d'attaque légèrement plus grande pendant la période de grâce (atténuée par l'expiration délimitée dans le temps)
- **Nettoyage différé** — l'expiration de la période de grâce est asynchrone via Kafka (pas immédiate)
- **Exposition de la clé privée** — retournée une fois dans la réponse API ; doit être transmise via mTLS/HTTPS
- **MockCertificateProvider** — pas adapté à la production (certificats auto-signés)

### Risques

- **Indisponibilité de Kafka** — si Kafka est arrêté, la synchronisation Keycloak est retardée. Atténuée par le mode `fail_closed` : les nouveaux clients ne peuvent pas s'authentifier jusqu'à ce que la synchronisation soit terminée.
- **Décalage d'horloge** — l'expiration de la période de grâce dépend de l'heure serveur. Atténuée par l'utilisation d'UTC partout et la synchronisation NTP sur tous les nœuds.
- **Périodes de grâce orphelines** — si le consommateur de nettoyage est arrêté, les anciennes empreintes persistent. Atténuée par un travail de réconciliation périodique.
