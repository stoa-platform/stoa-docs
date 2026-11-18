---
title: "ADR-063 — SDD niveau 1 et agent de connaissance MCP stoa-impact"
sidebar_position: 63
---

# ADR-063 — SDD niveau 1 et agent de connaissance MCP stoa-impact

- **Statut** : Accepté (période d’essai, revue le 2026-04-30)
- **Date** : 2026-04-16
- **Décideurs** : Christophe, Claude Code
- **Lié à** : ADR-061 (revue multi-étapes Council), ADR-062 (hiérarchie CLAUDE.md)
- **Ticket parent** : CAB-2066 (issu du découpage de CAB-2059 après Council S1bis à 8.00/10)

## Contexte

Deux lacunes opérationnelles ont ralenti l’exécution des MEGA durant le T1 2026 :

1. **Aucun espace de spécification partagé pour les MEGA.** Les critères d’acceptation, les sous-tâches et l’ordre des dépendances étaient dispersés entre les commentaires Linear, `plan.md`, les messages de commit et des documents ad hoc. Reprendre un MEGA en cours de route exigeait de lire cinq sources pour reconstituer « ce qui est fait, ce qui suit, et quand ce sera terminé ».
2. **Base d’impact accessible uniquement via le shell.** `docs/stoa-impact.db` contient le DAG de dépendances, les contrats, les scénarios et les risques — mais ses seuls consommateurs étaient les scripts `docs/scripts/*.sh`. Les sous-agents sans permission Bash (le réglage par défaut pour `security-reviewer`, `docs-writer`, `content-reviewer`, `competitive-analyst`, `verify-app`, `k8s-ops`) ne pouvaient pas l’interroger. Ils se rabattaient sur `grep` et manquaient les relations structurées.

Le développement piloté par les spécifications (Spec-Driven Development, SDD) compte trois niveaux d’adoption reconnus :

- **L1** — structure seule. Une convention et des modèles, sans contrôle par l’outillage.
- **L2** — ancré dans la spécification. La CI vérifie la conformité du code à la spécification.
- **L3** — spécification comme source. Génération de code à partir de la spécification.

Les projets [github/spec-kit](https://github.com/github/spec-kit) (v0.7.1, MIT, 88K étoiles) et [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) (v3.0.2, MIT, 3K étoiles) ciblent les cas d’usage L2–L3, mais on peut y puiser uniquement des modèles L1.

## Décision

### 1. Adopter uniquement le niveau 1 du SDD

- Ajouter une convention légère `.sdlc/` à la racine du dépôt : `context/` (pointeurs vers l’architecture et les conventions, sans dupliquer `CLAUDE.md`), `templates/` (exigence + tâche), `specs/` (un répertoire par MEGA formalisé).
- **Figer cc-sdd v3.0.2** comme source d’inspiration des modèles. Lui emprunter sa machine à états en frontmatter (`pending → in_progress → done`). **Ne pas installer la CLI.** STOA utilise exclusivement Claude Code, ce qui rend la surface multi-agents de la CLI inutile.
- **Opt-in par MEGA.** Un MEGA sans entrée `.sdlc/specs/MEGA-<ID>/` reste valide. L’adoption est mesurée sur deux semaines.

### 2. Exposer `stoa-impact.db` via un serveur MCP local

- Nouveau fichier : `docs/scripts/stoa_impact_mcp.py`.
- **Bibliothèque standard Python pure** (aucune dépendance `@modelcontextprotocol/sdk`) — reprend le modèle existant de « protocole JSON-RPC manuel » utilisé par l’outillage interne et `stoa-gateway`. Le serveur reste ainsi directement exécutable sur tout poste de développement doté de Python 3.11+.
- **JSON-RPC 2.0 sur stdio** (pas de HTTP/SSE) — s’aligne sur le modèle d’invocation déjà utilisé par `linear`, `playwright` et `context7` dans `.mcp.json`.
- **Lecture seule par construction** : `sqlite3.connect("file:...?mode=ro", uri=True)`. Les écritures échouent au niveau du pilote, et non de l’application. Ce comportement est validé par un test de non-régression.
- **Aucun outil de SQL brut**. Huit outils dédiés avec requêtes paramétrées et `additionalProperties: false` sur chaque schéma d’entrée :
  - `list_components`, `get_component`
  - `get_contracts` (direction : in / out / both)
  - `get_impacted_scenarios`, `get_risks`
  - `get_dependency_matrix`, `get_untyped_contracts`,
    `get_component_risk_score`
- Enregistrer dans `.mcp.json` comme entrée locale `command: python3`.

### 3. Critères d’arrêt

La convention L1 et le serveur MCP sont livrés ensemble mais évalués séparément le **2026-04-30**. Les déclencheurs d’abandon sont consignés dans `.sdlc/KILL-CRITERIA.md` au sein du dépôt `stoa` :

- Aucun MEGA réel (hors spécification pilote CAB-2066) formalisé dans `.sdlc/specs/` sous 14 jours.
- Dérive documentaire : un MEGA livré dont l’entrée `.sdlc/` ne correspond plus à Linear ou au code fusionné, sans commit de réconciliation.
- Deux plaintes distinctes de contributeurs concernant la duplication.
- Régression du temps de cycle des MEGA > +10% sur la période d’essai.

Si l’un de ces déclencheurs s’active, `.sdlc/` est supprimé en un seul commit et cet ADR passe au statut **Superseded / Rejected** avec une note de post-mortem.

Pour le serveur MCP, un signal d’abandon distinct s’applique : si le serveur provoque de l’instabilité en CI (tests instables, régression de performance dans les hooks basés sur `build-context.sh`) ou si le gain ergonomique par rapport à `impact-check.sh` s’avère < 5× pour les sous-agents sans Bash, retirer l’entrée de `.mcp.json` et supprimer le module.

## Justification

- **L1 avant L2.** Aucune donnée ne prouve que des spécifications formalisées justifient leur coût de rédaction pour cette équipe. Démarrer au niveau L2 (CI ancrée sur les spécifications) risque de figer une convention inutilisée.
- **Modèles plutôt qu’outillage.** `cc-sdd` et `spec-kit` supposent tous deux une interface CLI `@agent`. STOA dispose déjà d’un point d’entrée Claude Code standardisé. Ajouter une seconde couche CLI fragmenterait les habitudes de travail.
- **cc-sdd plutôt que spec-kit.** spec-kit est plus vaste (88K étoiles) et soutenu par Microsoft, mais cible la génération de code multi-agents (L2–L3). cc-sdd est plus léger, natif pour Claude, et l’en-tête de ses modèles correspond mieux à nos besoins pour L1. Les deux sont sous licence MIT, ce critère est donc neutre.
- **MCP plutôt que le shell pour les sous-agents.** `impact-check.sh` prend ~30ms et les appels MCP équivalents prennent ~40ms. La latence est un non-sujet. Le vrai gain est que les sous-agents sans Bash (security-reviewer, docs-writer, content-reviewer) peuvent désormais interroger le graphe d’impact. L’écart ne porte pas sur la performance — il porte sur la portée.
- **Serveur purement basé sur la bibliothèque standard.** Le SDK Python officiel `mcp` existe mais n’est pas encore utilisé dans le projet. Ajouter une dépendance pour un outil local d’environ ~400 lignes n’en vaut pas la peine. La surface JSON-RPC 2.0 requise par la spécification est triviale à écrire sur mesure et offre un meilleur comportement au démarrage et en cache qu’un serveur encapsulé par un SDK.
- **Aucun outil MCP d’écriture.** La base d’impact possède un seul processus d’écriture (`populate-db.py`) et un script d’apprentissage en ajout seul (`post-change-learn.sh`). Exposer une surface d’écriture via MCP briserait cet invariant et ouvrirait la porte à une dérive de schéma induite par un LLM. Refus catégorique.

## Conséquences

### Positives

- **Requêtes d’impact structurées pour les sous-agents.** Les revues de sécurité et de documentation citent désormais les relations entre composants et scénarios au lieu d’analyser à l’œil nu la sortie de `grep`.
- **Validation interne (dogfooding) des spécifications.** CAB-2066 est lui-même le premier MEGA formalisé sous `.sdlc/specs/MEGA-CAB-2066/` — quatre tâches dotées d’une machine à états.
- **Aucune nouvelle dépendance nette.** Le serveur repose uniquement sur la bibliothèque standard et la convention repose uniquement sur du Markdown.
- **Désactivation peu coûteuse.** Supprimer `.sdlc/` ou l’entrée MCP se fait en un seul commit, sans impact sur l’infrastructure d’exécution.

### Négatives / risques

- **Dette documentaire en cas de non-adoption.** Si la convention est abandonnée, les quatre fichiers modèles et les critères d’arrêt constituent un poids mort pendant la fenêtre d’essai d’environ ~2 semaines. Ce risque est atténué par la date de revue stricte.
- **Messages d’erreur MCP désormais opaques.** Conformément à la revue de sécurité, les erreurs de la couche SQL sont journalisées sur stderr et remplacées par des messages génériques côté client. Le débogage d’une requête mal formée impose désormais de lire la sortie stderr du serveur MCP plutôt que le retour de l’appel d’outil. C’est acceptable pour un outil local.
- **Python 3.11+ requis sur toute machine souhaitant utiliser le serveur MCP.** C’est déjà le socle minimal pour `cli/` et `control-plane-api/`, ce qui n’ajoute aucune nouvelle contrainte.

## Alternatives envisagées

### A. Adopter pleinement spec-kit (L2)

- Installer la CLI `specify`, exécuter des vérifications ancrées sur les spécifications dans la CI.
- **Rejeté.** Rien ne prouve que l’équipe rédige d’abord des spécifications aujourd’hui, et le niveau L2 fige une habitude non validée. À réévaluer après l’essai L1.

### B. SDK Python MCP officiel (`mcp` sur PyPI)

- Utiliser le SDK officiel pour le schéma et le transport.
- **Rejeté.** Ajoute une dépendance pour moins de 200 lignes de code hors SDK. Risque d’instabilité lié aux mises à jour de dépendances. De plus, le SDK utilise HTTP/SSE par défaut, ce qui ne correspond pas au modèle de serveur local sur stdio déjà configuré dans `.mcp.json`.

### C. Serveur MCP en Rust aligné sur l’outillage interne

- Reprendre le modèle existant en Rust avec Axum et protocole sur mesure par souci de cohérence.
- **Rejeté.** Le serveur MCP interne utilise HTTP/SSE pour les accès inter-services, alors que cet outil fonctionne localement via stdio. Le réécrire en Rust par pure cohérence double l’effort d’implémentation sans aucun bénéfice visible pour l’utilisateur.

### D. Exposer la base via un point de terminaison en lecture seule sur la passerelle

- Ajouter une route sur la passerelle servant la base de données au format JSON.
- **Rejeté.** La base d’impact est un artefact de développement. L’exposer via une passerelle située sur le chemin de production mélange deux niveaux opérationnels très différents.

### E. Ignorer complètement MCP — ajouter davantage de scripts `docs/scripts/*.sh`

- Écrire davantage d’enveloppes shell pour les requêtes courantes.
- **Rejeté.** Ne débloque pas l’accès pour les sous-agents dépourvus de Bash, ce qui constituait la contrainte initiale motivant ce choix.

## Revue

- **Date de revue** : 2026-04-30.
- **Responsable** : @PotoMitan.
- **Artefacts à inspecter** : `.sdlc/specs/` (nombre de vrais MEGAs formalisés), `.mcp.json` (toujours présent ?), recherche par grep des appels à `stoa_impact_mcp` dans les journaux de session (signal d’utilisation), tableau de bord du temps de cycle Linear.

## Références

- MEGA Linear : CAB-2066
- Validation Council parente : CAB-2059 S1bis 8.00/10
- Débloqué par : CAB-2065 (canari Agent Teams Go, 2026-04-16)
- Artefacts du dépôt : `.sdlc/`, `docs/scripts/stoa_impact_mcp.py`, `.mcp.json`
- ADR associés : ADR-061 (Council multi-étapes), ADR-062 (hiérarchie CLAUDE.md)
