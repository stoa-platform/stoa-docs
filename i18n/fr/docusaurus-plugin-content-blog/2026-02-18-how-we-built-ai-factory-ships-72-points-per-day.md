---
slug: how-we-built-ai-factory-ships-72-points-per-day
title: "AI Factory : comment un développeur livre 72 points de story par jour"
description: "505 points de story en 7 jours avec Claude Code, des intégrations MCP et une coordination multi-instances. L'architecture derrière notre workflow de développement piloté par l'IA."
authors: [christophe]
tags: [ai, architecture, open-source, tutorial]
keywords:
  - ai factory software development
  - claude code productivity
  - ai agent software engineering
  - mcp ai development workflow
  - ai-assisted software development
  - ai pair programming at scale
  - autonomous ai coding agent
  - claude code multi-instance
  - ai development velocity
---
<!-- last verified: 2026-02 -->

**Un seul développeur livrant 72 points de story par jour sur 7 composants, 22 PRs par semaine, avec zéro régression sur main.** Ce n'est pas un exercice théorique — c'est le résultat mesuré de l'AI Factory de STOA Platform durant le Cycle 7 (9-15 février 2026). Cet article explique l'architecture, les protocoles de coordination, et les leçons difficiles qui permettent son fonctionnement.

Si vous construisez un [MCP gateway](/blog/what-is-mcp-gateway) ou toute plateforme open source complexe, les patterns décrits ici sont directement réutilisables. Ils ne sont pas liés à STOA — nous les avons extraits dans une bibliothèque de patterns réutilisables (HEGEMON) que tout projet peut adopter.

<!-- truncate -->

## Le problème : développeur solo, périmètre enterprise

STOA Platform est un API gateway open source avec 7 composants majeurs : un gateway Rust, une API de control plane Python, deux frontends React (Console + Portal), un CLI Go, des tests E2E et des charts Helm. La codebase s'étend sur ~50 000 lignes à travers 4 langages.

Construire cela seul prendrait des années avec le développement traditionnel. Le défi n'est pas d'écrire du code — Claude Code et des agents de codage IA similaires gèrent bien cela. Le défi est la **coordination** : comment faire tourner 4 instances IA en parallèle sans qu'elles se marchent dessus ? Comment maintenir la qualité quand le code est généré à 10x la vitesse ? Comment conserver un workflow trunk-based où main est toujours déployable ?

L'AI Factory est notre réponse. C'est un ensemble de règles, de protocoles et d'automatisations qui transforme Claude Code d'un simple assistant de codage en une **équipe de développement coordonnée**.

## Vue d'ensemble de l'architecture

L'AI Factory opère à 5 niveaux d'autonomie :

```
Niveau 1 : Interactif       — Claude répond aux demandes directes
Niveau 2 : Planifié         — Health checks CI quotidiens, audits hebdomadaires
Niveau 3 : Pipeline Linear  — Ticket → validation Council → PR → merge
Niveau 4 : Auto-améliorant  — Rétrospective hebdomadaire, mises à jour des règles
Niveau 5 : Multi-agents     — Implémentation parallèle de tickets (expérimental)
```

Les niveaux 1 à 3 sont en usage quotidien. Le niveau 4 tourne chaque semaine. Le niveau 5 est utilisé pour les tickets MEGA (20+ points de story).

L'insight clé : **l'autonomie sans gouvernance, c'est le chaos**. Chaque niveau a un kill-switch (variable de dépôt GitHub), un plafond de coût et un portail humain. L'AI Factory n'est pas "laisser l'IA faire n'importe quoi" — c'est un pipeline discipliné où les agents IA opèrent dans des limites clairement définies.

## Les 5 piliers

### 1. Validation Council — le portail qualité

Chaque fonctionnalité, correction de bug ou décision d'architecture au-dessus de 5 points de story doit passer une **validation Council** avant que l'implémentation commence. Le Council est une revue à 4 personas qui note la proposition :

| Persona | Rôle | Focus |
|---------|------|-------|
| **Chucky** | Avocat du diable | Risques, complexité cachée, scope creep |
| **OSS Killer** | Sceptique VC | Valeur marché, avantage concurrentiel, ROI |
| **Archi 50x50** | Architecte vétéran | Qualité technique, maintenabilité, patterns |
| **Better Call Saul** | Juridique/Conformité | Licences, RGPD, claims concurrentiels |

Chaque persona note de 1 à 10. Une moyenne >= 8,0 est un Go automatique. Entre 6,0 et 7,9, des ajustements sont obligatoires. En dessous de 6,0, la proposition est rejetée.

Ce n'est pas du théâtre. Le Council a rejeté des propositions, forcé des réductions de périmètre, et détecté des risques légaux (comme les violations des conditions d'utilisation d'Anthropic dans notre conception d'architecture d'agent de chat). Cela ajoute 5 minutes au processus et économise des heures d'implémentation gâchée.

Le rapport Council est automatiquement posté sur Linear (notre outil de suivi de projet) et devient le contexte du ticket. Quand une instance IA reprend le ticket plus tard, elle dispose du raisonnement complet, des ajustements et de la définition de terminé.

### 2. Ship/Show/Ask — le modèle de merge

Tous les changements n'ont pas besoin du même niveau de révision. Inspiré du modèle interne de GitHub :

| Mode | Quand | Implication humaine |
|------|------|---------------------|
| **Ship** | Risque zéro (docs, config, dépendances) | Aucune — merge immédiat |
| **Show** | Faible risque (refacto, tests, style) | Merge d'abord, révision async |
| **Ask** | Tout risque (fonctionnalités, sécurité, BDD) | Stop après PR, attendre le humain |

Claude Code détermine le mode sur la base d'une matrice de décision. Un changement de fichier `.claude/rules/` est Ship. Un nouvel endpoint API est Ask. Un ajout de test est Show.

Cela élimine le goulot d'étranglement "attendre la révision" sur les changements triviaux tout en garantissant une supervision humaine sur ce qui compte.

### 3. Phase Ownership — coordination multi-instances

C'est le problème le plus difficile. Quand vous ouvrez 3 fenêtres de terminal, chacune exécutant Claude Code sur la même codebase, comment éviter les conflits ?

La réponse est le **claim basé sur des fichiers**. Chaque instance Claude Code génère un identifiant unique au démarrage (ex : `t4821`) et claim le travail en écrivant dans un fichier JSON de claim :

```json
{
  "mega": "CAB-1290",
  "phases": [
    {
      "id": 1,
      "name": "API + Gateway",
      "tickets": ["CAB-1350", "CAB-1351"],
      "owner": "t4821",
      "claimed_at": "2026-02-16T14:05",
      "deps": [],
      "completed_at": null
    },
    {
      "id": 2,
      "name": "E2E Tests",
      "tickets": ["CAB-1352"],
      "owner": null,
      "deps": [1],
      "completed_at": null
    }
  ]
}
```

Règles :
- **Premier arrivé, premier servi** : écrire le PID, attendre 100 ms, relire, vérifier que son propre PID est toujours là
- **Ownership de bout en bout** : une instance qui claim une phase la termine entièrement
- **Détection des claims périmés** : les claims de plus de 2 heures sans PID actif sont libérés automatiquement
- **Chaînage de phases** : après avoir terminé une phase, l'instance vérifie la prochaine phase non claimée

Cela nous donne une exécution parallèle avec zéro overhead de coordination. L'Instance 1 travaille sur l'API, l'Instance 2 sur le Gateway, l'Instance 3 rédige la documentation — simultanément, sur des branches séparées, mergées indépendamment vers main.

### 4. State files — la mémoire partagée

Les instances IA sont sans état par défaut. Chacune démarre avec une fenêtre de contexte fraîche. Les state files comblent ce vide :

| Fichier | Utilité | Mis à jour par |
|---------|---------|---------------|
| `memory.md` | État du sprint, décisions, problèmes connus | Chaque session |
| `plan.md` | Vue orientée cycle synchronisée depuis Linear | Skill `/sync-plan` |
| `operations.log` | Traçabilité de session en append-only | Chaque début/fin de session |
| `checkpoints/` | Snapshots pré-merge pour la reprise après crash | Avant les opérations risquées |

Le `operations.log` est le mécanisme de reprise après crash. Chaque session journalise `SESSION-START` et `SESSION-END`. Si une session crashe (dépassement de contexte, panne réseau, interruption utilisateur), la session suivante détecte le `SESSION-END` manquant et propose de reprendre depuis le dernier checkpoint.

Ce n'est pas de l'ingénierie de systèmes distribués sophistiquée. C'est une coordination simple basée sur des fichiers qui fonctionne parce que les modes de défaillance sont prévisibles et la reprise est déterministe.

### 5. Définition de terminé binaire — le plancher qualité

Chaque tâche a une checklist de 10 points qui doivent TOUS passer. Pas de crédit partiel :

1. Le code compile (zéro erreur)
2. Les tests passent (zéro échec)
3. Pas de régressions (tests existants au vert)
4. Lint propre (zéro nouvel avertissement)
5. Format propre (zéro diff)
6. Pas de secrets (scan gitleaks)
7. PR créée
8. CI au vert (3 vérifications requises)
9. State files mis à jour
10. Session journalisée

Les vérifications spécifiques aux composants ajoutent des seuils de couverture (70 % pour Python, zéro avertissement clippy pour Rust), et les vérifications post-merge vérifient le pipeline CD complet (CI sur main, build Docker, mise à jour du pod).

L'insight clé : **l'IA prendra des raccourcis si vous le permettez**. Sans une DoD binaire, vous obtenez du code qui "marche à peu près" avec des commentaires TODO, des tests ignorés et des cas limites non traités. La DoD rend la qualité non négociable.

## Les chiffres : résultats du Cycle 7

| Métrique | Valeur |
|----------|-------|
| **Durée** | 7 jours (9-15 février 2026) |
| **Points de story** | 505 terminés |
| **Vélocité** | 72 pts/jour |
| **Issues fermées** | 44 |
| **PRs mergées** | 22 |
| **Composants touchés** | 7 (gateway, API, console, portal, CLI, E2E, docs) |
| **Régressions sur main** | 0 |

Sur la base des estimations typiques des équipes Scrum, un développeur solo livre 5 à 10 points de story par jour et une équipe de 4-5 ingénieurs en livre 40 à 60 par sprint (2 semaines). L'AI Factory atteint une production dans la plage d'une équipe avec la supervision d'une seule personne.

La vélocité n'est pas constante. Certains jours dépassent les 100 points (exécution parallèle de MEGAs). D'autres jours n'en atteignent que 20 (blocages sur l'infrastructure ou le débogage). Les 72 pts/jour sont la moyenne sur le cycle complet.

### À quoi ressemblent 505 points ?

Le Cycle 7 a inclus :

- **Gateway Rust** : 559 tests (unitaires + intégration + contrats + E2E + résilience + sécurité), mise à jour reqwest 0.12, circuit breaker, protection SSRF
- **API Python** : 528 nouveaux tests (couverture de 53 % à 72 %), API de cycle de vie de déploiement, pont Kafka événementiel, complétion de l'auth
- **Console React** : 959 tests, 24 fichiers de test, tableau de bord de déploiement avec rollback
- **Portal React** : 680 tests, 24 fichiers de test, gestion des consommateurs, abonnements UAC
- **CLI Go** : commandes deploy create/list/get/rollback
- **E2E** : 5 scénarios de déploiement, 9 scénarios BDD SaaS
- **Infrastructure** : hardening K8s production, pipeline de jobs de sécurité, optimisation des performances de l'arena

Chacun de ces éléments était une PR séparée, déployable indépendamment, avec ses propres tests et vérification CI.

## Leçons difficiles

### 1. La fenêtre de contexte est le vrai goulot d'étranglement

Les agents de codage IA sont limités par la fenêtre de contexte, pas par la vitesse. Une session Claude Code qui essaie de tenir toute la codebase dans son contexte se dégrade après ~60 % d'utilisation. La solution : **délégation agressive**.

La recherche va aux sous-agents `Explore` (modèle haiku, économique). L'écriture de tests va aux sous-agents `test-writer` (sonnet). La revue de sécurité va à `security-reviewer` (lecture seule, ne peut rien casser). La session principale reste légère et focalisée sur la coordination.

### 2. Les règles l'emportent sur les prompts

Les premières versions de l'AI Factory utilisaient de longs prompts système. Ils étaient fragiles — une seule instruction ambiguë provoquait des erreurs en cascade. La version actuelle utilise **22 fichiers de règles** avec des frontières `globs:` qui ne chargent que les règles pertinentes par type de fichier. Cela économise ~5 000 tokens par session et rend chaque règle testable indépendamment.

Les règles sont versionnées dans `.claude/rules/` et suivent le même workflow de PR que le code. Quand une règle cause un problème, vous la corrigez comme un bug — pas en réécrivant un prompt de 2 000 mots.

### 3. Les intégrations MCP changent tout

L'AI Factory se connecte à [Linear](/blog/connecting-ai-agents-enterprise-apis) (tickets), Cloudflare (DNS), Vercel (déploiements) et n8n (automatisation) via MCP. Cela signifie que Claude Code peut :

- Récupérer la Définition de Terminé d'un ticket avant de commencer le travail
- Mettre à jour le statut du ticket à "Terminé" après le merge de la PR
- Poster un rapport de validation Council comme commentaire Linear
- Vérifier le statut de déploiement Vercel après le merge d'une PR de documentation

Cela ferme la boucle entre "l'IA écrit du code" et "l'IA gère le projet". L'AI Factory ne génère pas seulement des PRs — elle gère le cycle de vie complet des tickets du backlog à la production.

### 4. Le développement trunk-based est non négociable

Chaque expérience avec des branches de longue durée a échoué. Les conflits de merge s'accumulent de façon exponentielle quand 3 instances IA travaillent en parallèle. La solution : **squash merge vers main, toujours**. Chaque PR fait moins de 300 LOC, est déployable indépendamment, et est mergée dans les heures suivant sa création.

Cela signifie que main est toujours déployable. Cela signifie aussi que n'importe quelle instance peut démarrer depuis un `git pull origin main` fraîche et avoir la certitude de posséder le code le plus récent. Pas de rebase, pas de résolution de conflits, pas d'overhead de gestion de branches.

## La suite : AI Factory v3

L'architecture actuelle (v2) fonctionne pour un développeur solo avec 3 à 4 instances parallèles. La v3 ajoute :

- **Checkpoints enrichis** avec métadonnées de progression pour une reprise après crash plus intelligente
- **Chaînage de phases** — les instances clament automatiquement la prochaine phase débloquée sans redémarrer
- **Hardening du pipeline L3** — du ticket Linear à la PR en un pipeline automatisé
- **Optimisation du contexte de prompt** — réduction des tokens gaspillés entre les sessions

L'AI Factory est open source. Les règles vivent dans `stoa/.claude/rules/`, les agents dans `stoa/.claude/agents/`, et les patterns réutilisables dans la bibliothèque de patterns HEGEMON. Si vous construisez avec Claude Code, Cursor ou tout autre agent de codage IA, ces patterns sont directement applicables à votre workflow.

## Pour commencer

Si vous souhaitez essayer ces patterns dans votre propre projet :

1. **Commencez par les règles, pas par les prompts**. Créez `.claude/rules/` avec des fichiers de règles focalisés pour votre workflow.
2. **Ajoutez une Définition de Terminé**. Une checklist binaire de 10 points prévient la dérive de qualité.
3. **Utilisez des state files**. `memory.md` + `operations.log` donnent à vos sessions IA de la continuité entre les fenêtres de contexte.
4. **Ship/Show/Ask dès le premier jour**. Classifiez chaque changement par niveau de risque. Shippez automatiquement les choses sûres.
5. **Ajoutez le Council pour tout ce qui dépasse le trivial**. Même une revue simplifiée à 2 personas détecte les erreurs qui coûtent des heures à corriger plus tard.

La configuration complète de l'AI Factory est dans le [dépôt STOA](https://github.com/stoa-platform/stoa/tree/main/.claude). Pour le contexte plus large sur MCP et les agents IA, consultez [Qu'est-ce qu'un MCP Gateway](/blog/what-is-mcp-gateway) et [Connecter les agents IA aux APIs enterprise](/blog/connecting-ai-agents-enterprise-apis).

## Foire aux questions

### Combien coûte l'exécution de l'AI Factory ?

Claude Code avec Sonnet pour les sous-agents et Opus pour les sessions principales. À titre de référence, une journée typique d'utilisation d'instances parallèles coûte 50 à 80 $ en appels API pour 3 à 4 instances parallèles.

### Cela remplace-t-il les développeurs ?

Non. L'AI Factory remplace les parties répétitives du développement : le code boilerplate, la génération de tests, les corrections de lint, la création de PRs, la surveillance CI. L'humain (moi) prend toujours toutes les décisions d'architecture, révise les PRs en mode Ask, et gère tout ce que l'IA rate. Considérez-le comme une équipe où vous êtes le tech lead et les agents IA sont des développeurs juniors qui ne dorment jamais.

### Cela fonctionne-t-il avec d'autres agents de codage IA ?

Les patterns (règles, state files, phase ownership, Council) sont agnostiques à l'agent. Les intégrations MCP sont spécifiques au support MCP de Claude Code. La bibliothèque de patterns HEGEMON documente ces patterns de façon neutre par rapport aux outils.

### Que se passe-t-il quand l'IA fait une erreur ?

La DoD binaire détecte la plupart des erreurs avant le merge. Quand quelque chose passe à travers, la vérification CD post-merge le détecte (health check du pod, statut de synchronisation ArgoCD). Sur les 505 points de sortie du Cycle 7, nous avons eu zéro régression sur main — pas parce que l'IA ne fait jamais d'erreurs, mais parce que les portails qualité les détectent avant le merge.

### Comment gérez-vous la sécurité ?

Le sous-agent `security-reviewer` s'exécute sur chaque changement de code. Il est en lecture seule (ne peut pas modifier le code) et produit un verdict binaire Go/Fix/Redo. Tout constat P0 bloque la PR. De plus, CI exécute gitleaks (secrets), Bandit (SAST Python), clippy SAST (Rust) et Trivy (scan de containers) sur chaque PR.

> Les noms de produits mentionnés dans cet article sont des marques déposées de leurs propriétaires respectifs. STOA Platform n'est pas affiliée ni endorsée par aucun fournisseur mentionné.
