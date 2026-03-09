---
sidebar_position: 20
title: "ADR-020 : Gouvernance des données runtime"
description: "Décide entre la base de données du Control Plane et les dépôts Git pour la gestion des métadonnées API, en choisissant une approche runtime-first avec synchronisation Git."
keywords: [gouvernance des données, Control Plane, Git, métadonnées API, runtime, synchronisation]
---

# ADR-020 : Gouvernance des données runtime — Control Plane vs Git

| Statut | Accepté |
|--------|---------|
| **Date** | 2026-01-23 |
| **Décideurs** | Christophe ABOULICAM |
| **Tickets liés** | CAB-850, CAB-849, CAB-848 |

## Contexte

La plateforme STOA utilise GitOps pour la gestion de l'infrastructure et de la configuration. Cependant, une question critique se pose : **où doivent résider les métadonnées runtime des API ?**

### État actuel (anti-pattern)
Le développeur modifie une catégorie dans stoa-catalog/*.yaml
→ Git push
→ GitLab CI
→ Déploiement
→ Runtime mis à jour

### Problèmes identifiés

| Problème | Impact |
|----------|--------|
| Absence de validation métier | Catégories invalides acceptées |
| Absence de journal d'audit | Qui a modifié quoi, quand, pourquoi ? |
| Absence de RBAC | Toute personne ayant accès Git peut modifier |
| Absence de workflow d'approbation | Les modifications passent en production sans revue |
| Absence de notification aux parties prenantes | Les propriétaires d'API ne sont pas informés |
| Rollback complexe | Revert Git vs appel API |

## Décision

**Partager la gouvernance des données par type :**

| Type de données | Source de vérité | Méthode de modification |
|-----------------|-----------------|------------------------|
| **Spécification OpenAPI** | Git (stoa-catalog) | PR + Revue de code |
| **Configuration infrastructure** | Git (stoa-gitops) | PR + Revue de code |
| **Métadonnées runtime** | PostgreSQL | API Control Plane |

### Qu'est-ce que les métadonnées runtime ?

Les données qui changent **indépendamment du contrat API** :

- `category` / `tags` — Classification
- `visibility` — Community, groupes AD
- `status` — draft, published, deprecated
- `owner` / `team` — Attribution de propriété
- `sla` / `rate_limits` — Policies personnalisées

### Ce qui reste dans Git

Les données qui définissent le **contrat API** :

- Spécification OpenAPI (endpoints, schémas)
- Nom et description de base de l'API
- Version (major.minor.patch)
- Liaisons de protocole (REST, GraphQL, gRPC)

## Architecture

### Modèle de données
```sql
-- Métadonnées runtime (modifiables via Control Plane)
CREATE TABLE api_metadata (
  api_id UUID PRIMARY KEY REFERENCES apis(id),
  category VARCHAR(100),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'draft',
  visibility JSONB,  -- {community_ids: [], ad_groups: []}
  owner_team_id UUID REFERENCES teams(id),
  custom_rate_limit INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Journal d'audit automatique
CREATE TABLE api_metadata_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);
```

### Endpoints API

```
GET    /v1/apis/{api_id}/metadata       — Lire les métadonnées
PATCH  /v1/apis/{api_id}/metadata       — Mettre à jour les métadonnées (RBAC appliqué)
GET    /v1/apis/{api_id}/metadata/audit — Voir l'historique des modifications
```

### Synchronisation initiale (Git → DB)
```python
async def sync_catalog_to_db():
    """
    Importer les métadonnées initiales depuis Git.
    Ne remplace PAS si déjà présent en DB.
    """
    for api_yaml in git_catalog.list_apis():
        if not await db.api_metadata_exists(api_yaml.id):
            await db.create_api_metadata(api_yaml)
        # sinon : la DB est la source de vérité, Git ignoré pour les métadonnées
```

## Conséquences

### Positives

- **Piste d'audit** — Historique complet de qui a modifié quoi
- **RBAC** — Seuls les utilisateurs autorisés peuvent modifier les métadonnées
- **Validation** — Règles métier appliquées au niveau API
- **Notifications** — Parties prenantes informées des modifications
- **Rollback simple** — Appel API vs revert git

### Négatives

- **Deux sources** — Spécification dans Git, métadonnées en DB
- **Complexité de synchronisation** — Logique de bootstrap nécessaire
- **Migration** — Les métadonnées YAML existantes doivent migrer vers la DB

### Neutres

- **Interface Console requise** — Une UI est nécessaire pour les utilisateurs non-techniques
- **Versionnage API** — L'API de métadonnées nécessite une stratégie de versionnage

## Implémentation

Voir [CAB-850](https://linear.app/hlfh-workspace/issue/CAB-850) pour les détails d'implémentation.

### Phases

1. **Phase 1** — Modèle de données + migration Alembic
2. **Phase 2** — Endpoints API + RBAC
3. **Phase 3** — Interface Console
4. **Phase 4** — Script de synchronisation + migration

## Références

- [Kong Declarative vs DB Mode](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
- [Principes GitOps](https://opengitops.dev/)
- Discussion : Claude Chat 2026-01-23
