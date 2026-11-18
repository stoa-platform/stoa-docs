# ADR-061 — Système de revue du Council en plusieurs étapes

**Statut :** Accepté (S1+S2 en service, implémentation de S3 en cours — CAB-2046)
**Date :** 2026-04-11
**Auteur :** Christophe (CAB Ingenierie)
**Tickets parents :** CAB-2046 [MEGA] Council Stage 3 — Automated Code Review, CAB-2047 (CLI), CAB-2048 (hook pre-push), CAB-2049 (workflow CI), CAB-2050 (rotation de l'historique), CAB-2051 (mode shadow)

---

## Contexte

L'AI Factory de STOA exécute jusqu'à cinq instances Claude Code en parallèle (backend, frontend, auth, mcp, qa) qui génèrent, relisent et fusionnent du code presque sans intervention humaine. À grande échelle, trois catégories de défaillances franchissent un contrôle fondé uniquement sur les tests :

1. **Mauvais sujet** — une instance prend un ticket trop vague, mal cadré ou déjà obsolète, et passe des heures à développer quelque chose dont personne n'a besoin.
2. **Mauvais plan** — un plan est techniquement valide mais contredit une décision d'architecture récente, évalue mal le étendue des conséquences ou ignore une contrainte de conformité.
3. **Mauvais code** — l'implémentation passe le lint, les tests et le typage, mais introduit une dette subtile, élargit la surface d'attaque, rompt un contrat inter-composants ou enfreint une convention qu'aucun linter automatisé ne détecte.

Le lint, les tests et CodeQL sont nécessaires mais insuffisants. Ils détectent les problèmes syntaxiques et les motifs connus, mais n'évaluent pas le *jugement*.

Une réponse naïve consiste à « faire relire chaque PR par un humain ». Cela ne passe pas à l'échelle quand 5 instances parallèles poussent 15 à 30 PR par jour, et cela gaspille la ressource la plus coûteuse (Christophe) sur des PR qu'un LLM validerait correctement dans 95 % des cas.

**Ce dont nous avons besoin** : un système de validation qui injecte un jugement par LLM aux trois points de décision ci-dessus — avant le début du travail, avant l'écriture du code et avant la fusion — pour un coût borné, avec un coupe-circuit clair et un raisonnement lisible par les humains pour audit.

---

## Décision

Implémenter un **système Council à 3 étapes** où chaque étape conditionne la suivante. Les étapes 1 et 2 évaluent des documents (tickets, plans) via un **jury LLM de 8 personas** (les profils de référence Team Coca maintenu dans l'outillage interne). L'étape 3 évalue les diffs de code via une revue LLM parallèle sur 4 axes à l'aide d'un outil CLI (`scripts/council-review.sh`).

```
┌──────────────────┐   ┌────────────────┐   ┌─────────────┐   ┌──────────────────┐
│ S1: ticket       │ → │ S2: plan       │ → │ implement   │ → │ S3: code review  │ → merge
│ pertinence       │   │ validation     │   │             │   │ (4 axes, diff)   │
│ (prose,          │   │ (prose,        │   │             │   │ (CLI,            │
│  8 personas)     │   │  8 personas)   │   │             │   │  parallel API)   │
└──────────────────┘   └────────────────┘   └─────────────┘   └──────────────────┘
```

Chaque étape émet un verdict tranché : **Go** (continuer), **Fix** (appliquer les ajustements puis relancer) ou **Redo** (rejeter et réécrire de zéro). Un score global ≥ 8.0/10 est requis pour obtenir Go.

### Étape 1 — Pertinence du ticket (en service depuis C11, promue au jury à 8 personas via CAB-2054)

Invoquée par le skill `/council` sur une description de fonctionnalité ou d'ADR *avant* le début de tout travail. Le jury complet Team Coca de 8 personas (profils de référence maintenus dans l’outillage interne) évalue le *ticket lui-même* :

| Persona | Rôle | Cible d'analyse |
|---------|------|-------|
| **Chucky** (Devil's Advocate) | Tests d'intrusion / risque | Risques, cas limites, modes de défaillance, complexité cachée |
| **N3m0** (Webapp Security) | Frontend / UX / DX | Accessibilité (a11y), surfaces UI exposées, navigation clavier, fuites dans les messages d'erreur |
| **Gh0st** (Supply Chain) | Dépendances / SBOM | Dépendances approuvées par défaut, dérive des fichiers lock, CVE transitives |
| **Pr1nc3ss** (Social Engineering) | Frontières de confiance | Vecteurs de phishing, contournement via facteurs humains, fuite d'informations par messages d'erreur |
| **OSS Killer** (VC Skeptic) | Viabilité marché | Avantage concurrentiel défendable, valeur utilisateur, ROI, risque de copie sans différenciation |
| **Archi 50x50** (Veteran Architect) | Qualité technique | Couplage, passage à l'échelle, adéquation des patterns, dette technique |
| **Better Call Saul** (Legal/IP) | Juridique / conformité | Licences, RGPD/DORA, affirmations concurrentielles, mentions légales |
| **Gekk0** (Monetization / GTM) | Délai de monétisation | Adéquation aux paliers tarifaires, levier de monétisation, aide à la vente, discours GTM |

Chaque persona renvoie un score /10, un verdict et des *ajustements* précis à appliquer. La moyenne est combinée au modificateur **Impact Score** du Context Compiler (LOW 0, MEDIUM 0, HIGH −0.5, CRITICAL −1.0) pour produire un score final. Seuil : ≥ 8.0 → Go.

Les noms des personas sont des archétypes de la pop culture (Chucky = Child's Play, Gekk0 = Gordon Gekko / "Wall Street", Better Call Saul = univers Breaking Bad, etc.) utilisés en interne comme alias pour ces rôles de contradicteurs. Ce ne sont pas des marques commerciales.

L'étape 1 intercepte : travail mal cadré, fonctionnalités sans valeur mesurable, dérive du périmètre, affirmations concurrentielles non vérifiées, critères d'acceptation trop vagues, naïveté sur la chaîne d'approvisionnement logicielle, fonctionnalités non monétisables, lacunes d'accessibilité. Elle s'exécute en ~60 secondes (un appel Sonnet par persona, parallélisé par le skill Council).

### Étape 2 — Validation du plan (en service depuis C11, promue au jury à 8 personas via CAB-2054)

Invoquée par le même skill `/council` sur un *plan d'implémentation complet* (fichiers touchés, étapes, nombre de lignes attendu, alternatives envisagées). Même jury de 8 personas, même barème et même boucle d'ajustement — mais les questions portent désormais sur la justesse technique du plan, et non plus sur la pertinence du besoin.

L'étape 2 intercepte : fichiers placés dans le mauvais composant, étapes comportant des dépendances d'ordre cachées, estimations de LOC fausses d'un facteur 2 à 5×, alternatives non envisagées, failles de sécurité dans l'approche proposée, ruptures de contrat déguisées en refactorings.

Les plans obtenant un score < 8.0 reçoivent des ajustements numérotés que l'auteur applique, puis l'étape 2 est relancée sur le plan révisé. Les tickets portant le label `ship-fast-path` (≤ 5 pts en mode Ship) sautent entièrement l'étape 2 — la valeur attendue d'une validation de plan y est inférieure à son coût pour cette taille.

### Étape 3 — Revue de code automatisée (implémentation en cours — CAB-2046)

Invoquée *après* l'implémentation sur le diff git réel. Contrairement à S1/S2, l'étape 3 est un **outil CLI** (`scripts/council-review.sh`), et non un skill Claude. Il exécute quatre appels à l'API Anthropic en parallèle dans des sous-shells isolés, un par axe, et agrège leurs scores en un verdict unique.

| Axe | Évalue | Contexte injecté |
|------|-----------|------------------|
| **conformance** | Conventions de code, format de commit, nommage, code mort, hygiène des TODO | Titre + description du ticket Linear (lecture seule via `issueSearch`) |
| **debt** | Dette technique, duplication, code mort, complexité, abstractions discutables | Diff uniquement |
| **attack_surface** | Nouveaux endpoints, gestion des secrets, SSRF, validation des entrées, contournement d'auth | Rapport JSON Trivy (au mieux) |
| **contract_impact** | Contrats inter-composants, changements d'API cassants, dérive de schéma | Extrait de `docs/stoa-impact.db` — composants et contrats affectés |

Chaque axe est strictement isolé : un sous-shell distinct, un fichier temporaire distinct et un prompt système distinct chargé depuis `scripts/council-prompts/<axis>.md`. Les PID sont capturés de manière incrémentale (une affectation juste après chaque `&`, et non un unique `$!` final — bash ne renvoie que le PID du dernier processus lancé en arrière-plan). Une boucle `wait` comptabilise les échecs et transmet les résultats à une fonction pure `aggregate_scores` qui émet le JSON du verdict.

**L'étape 3 est branchée sur deux points de contrôle** :

1. **Hook pre-push** (CAB-2048) — s'exécute à chaque `git push`. Bloque le push si le verdict est REWORK ou en cas d'erreur. Peut être désactivé localement via `DISABLE_COUNCIL_GATE=1` pour les urgences.
2. **Workflow CI** (`council-gate.yml`, CAB-2049) — s'exécute sur chaque PR. Contrôle de statut requis pour la fusion. Activé par feature flag via `vars.COUNCIL_S3_ENABLED` pour un déploiement progressif (mode shadow d'abord — CAB-2051).

### Garde-fous stricts (appliqués avant tout appel API)

Les trois étapes partagent cinq garde-fous imposés par le CLI :

1. **Coupe-circuit `COUNCIL_DISABLE=1`** — sortie rapide code 0, sans revue. Redondant avec le feature flag CI et `DISABLE_COUNCIL_GATE` en pre-push, mais couvre l'invocation manuelle.
2. **Plafond de coût quotidien** — `COUNCIL_DAILY_CAP_EUR` (par défaut 5 €). Avant chaque exécution, le CLI lit `council-history.jsonl`, additionne le `cost_eur` du jour et sort avec le code 0 (et non 2) si le plafond est atteint. L'objectif est d'« ignorer la revue aujourd'hui », pas de « faire échouer la PR ».
3. **Déduplication SHA** — SHA1 du diff complet. Les diffs identiques le même jour (relances CI, cherry-picks, push vides) ignorent la revue. Contournement : `COUNCIL_FORCE_DEDUP=0`.
4. **Pré-contrôle Gitleaks (BLOQUANT)** — le diff est analysé par `gitleaks` avec `--exit-code 1` *avant tout appel API*. La moindre fuite entraîne une sortie code 2, sans trafic API. C'est la protection la plus économique contre l'exfiltration de secrets vers Anthropic.
5. **Troncature du diff** — limite stricte à 10 000 lignes sur le diff envoyé au modèle. La troncature est journalisée et enregistrée dans l'entrée JSONL (`diff_truncated: true`).

Chaque exécution, qu'elle soit APPROVED/REWORK/error/BYPASSED, ajoute une entrée JSONL à `council-history.jsonl` :

```json
{
  "timestamp": "2026-04-11T17:39:01Z",
  "ticket": "CAB-2047",
  "status": "APPROVED",
  "global_score": 8.50,
  "axes_evaluated": 4,
  "db_fresh": true,
  "model": "claude-sonnet-4-5",
  "tokens": 3200,
  "input_tokens": 2800,
  "output_tokens": 400,
  "cost_eur": 0.014,
  "diff_lines": 142,
  "diff_truncated": false,
  "duration_ms": 18500,
  "diff_sha": "ab2a795c7ca0924f21cac2d606fde5666de17bb1"
}
```

Ce fichier constitue le registre de coûts faisant foi pour le plafond quotidien, le cache de déduplication et la piste d'audit de sécurité et de conformité. Il est ignoré par Git (local à la machine) et subit une rotation à 500 lignes via CAB-2050.

### Choix de bash comme langage (ajustement nº 12)

Lors de CAB-2047, Council S2 a signalé la taille d'environ 400 LOC du CLI comme un signal d'alerte pour du bash et a demandé explicitement si Python serait préférable. La réponse est bash, pour quatre raisons :

1. **Cohérence** avec `scripts/ai-ops/ai-factory-notify.sh` (232 LOC) et `scripts/ai-ops/model-router.sh` (120 LOC) — tout l'outillage CI est déjà en bash.
2. **Aucune nouvelle chaîne d'outils CI** — les runners GitHub Actions disposent déjà de bash + jq + curl + gitleaks préinstallés. Python ajouterait venv/pip/requirements à chaque exécution CI invoquant Council S3.
3. **Fonction pure testable** — la logique centrale (`aggregate_scores`) est une fonction pure opérant sur un répertoire temporaire de fichiers JSON. Elle se teste aisément via bats-core face à des fixtures fabriquées, sans risque d'injection shell.
4. **Durcissement robuste à moindre coût** — shellcheck `-S style` intercepte la plupart des pièges bash. `set -euo pipefail`, le quotage explicite des variables et l'expression régulière en liste blanche pour les identifiants de composants (`^[a-zA-Z0-9_-]+$`) avant toute interpolation SQL couvrent les cas restants.

Le risque de fragilité est atténué par les garde-fous ci-dessus, par shellcheck en CI et par la suite de fixtures MOCK_API (`MOCK_API=1` court-circuite chaque appel API vers une fixture JSON locale — permettant des tests rapides, hermétiques et sans coût).

### Critères de notation

Les trois étapes utilisent la même grille. Chaque axe ou persona renvoie un entier de 1 à 10 :

| Note | Verdict |
|------|---------|
| 9-10 | Parfait ou quasi parfait. Aucun point bloquant. |
| 8 | Acceptable. Commentaires mineurs non bloquants. **Minimum pour Go.** |
| 6-7 | Fix requis. Des ajustements précis doivent être appliqués avant une nouvelle exécution. |
| 1-5 | Redo. L'approche sous-jacente est erronée, il faut repartir de zéro. |

La note globale est la moyenne arithmétique des axes valides (S3) ou des 8 personas (S1/S2), éventuellement ajustée par le modificateur Context Compiler Impact. Une étape passe à Go si la note globale est ≥ 8.0 **et** qu'aucun axe ou persona n'a renvoyé individuellement un Redo.

### Modèle de coûts

| Étape | Déclencheur | Modèle | Coût typique | Fréquence |
|-------|-------------|--------|--------------|-----------|
| S1 | Skill `/council` sur la description du ticket | Sonnet 4.5 × 8 personas | ~0,010 € par exécution | 5-15/jour |
| S2 | Skill `/council` sur le plan | Sonnet 4.5 × 8 personas | ~0,016 € par exécution | 3-10/jour |
| S3 | Hook pre-push + CI sur chaque diff | Sonnet 4.5 × 4 axes parallèles | ~0,03-0,06 € par exécution | 15-30/jour |

Coût quotidien attendu en régime de croisière : **1-2 €/jour** (largement sous le plafond de 5 €). Le passage de CAB-2054 d'un jury S1/S2 de 4 à 8 personas a ajouté ~+0,30-0,60 €/jour (linéaire selon la taille du jury à longueur de prompt constante), ce qui reste largement dans l'enveloppe budgétaire existante. Le plafond sert de coupe-circuit contre les boucles pathologiques (par exemple une tempête de relances CI), et non d'objectif budgétaire.

---

## Solutions envisagées

### A. Revue exclusivement humaine

**Rejeté.** Avec 5 instances parallèles poussant 15 à 30 PR/jour, cela place Christophe devant un arriéré de revue de 2 heures et bloque toute l’usine sur la disponibilité d’une seule personne. Cela gaspille aussi le jugement humain sur des PR qu’un LLM approuverait correctement dans 95 % des cas.

### B. Lint + tests uniquement (sans Council)

**Rejeté.** C’est la référence d’avant Council. Elle manque les trois classes de défaillance ciblées par Council : mauvais sujet, mauvais plan, problèmes de code subtils invisibles pour les outils syntaxiques. CAB-1944 a livré 5 régressions aux frontières de tests bouchonnés que 5 700 tests passants n’ont pas détectées — un contrôle Stage 3 sur le diff aurait signalé ce motif de bouchonnage aux frontières.

### C. Council à étape unique (revue de code seule)

**Rejeté.** S3 seul attrape le mauvais code, pas le mauvais travail. Une instance qui passe 6 heures à implémenter le mauvais ticket passera S3 sans difficulté (le code est propre) tout en perdant ce temps. S1 et S2 interceptent les défaillances des heures ou des jours plus tôt, quand le coût d’un retour arrière est minimal.

### D. LLM open source local (sans appels API)

**Rejeté pour l’instant.** L’écart de qualité entre Sonnet 4.5 et les modèles auto-hébergés 8B-70B sur la revue de code structurée reste important (vérifié en avril 2026 — les modèles locaux hallucinent des points bloquants ou manquent les vrais). Un coût API de 1 à 2 €/jour reste modique face au temps d’ingénierie perdu sur un mauvais merge. À réévaluer quand les modèles locaux combleront cet écart ou si le coût API dépasse 20 €/jour.

### E. CLI Python pour S3 (au lieu de bash)

**Rejeté.** Voir « Choix du langage » ci-dessus. Python était l’hypothèse par défaut à la sortie de Council S2, mais l’analyse détaillée a favorisé bash sur trois dimensions sur quatre (cohérence, chaîne d’outillage CI, durcissement) avec égalité sur la quatrième (testabilité — bats-core vaut pytest pour les tests de fonctions pures).

### F. S3 mono-axe (conformité seule)

**Rejeté comme cible finale, mais retenu comme trajectoire MVP.** Les étapes 1 à 3b de CAB-2047 ont livré la conformité seule comme garde-fou intermédiaire pendant le câblage de l’orchestration. L’étape 3c a achevé la transition vers les 4 axes. Le repli mono-axe est conservé comme option de débogage via `COUNCIL_AXES_ONLY=conformance`.

---

## Conséquences

### Positives

- **Trois filets de sécurité indépendants** contre les régressions de l’AI Factory, chacun interceptant une classe de défaillance distincte.
- **Le raisonnement est visible.** Chaque verdict Go/Fix/Redo s’accompagne d’un retour par axe et d’une liste d’ajustements. Les humains qui auditent un merge peuvent lire le raisonnement du Council, pas seulement la note.
- **Le coût est borné et observable.** `council-history.jsonl` fournit le coût exact par revue, et le plafond quotidien agit comme un disjoncteur strict.
- **Coupe-circuits à chaque couche.** `COUNCIL_DISABLE`, `DISABLE_COUNCIL_GATE`, `vars.COUNCIL_S3_ENABLED`, `COUNCIL_FORCE_DEDUP=0` — chaque instance, workflow CI ou opérateur peut désactiver n’importe quelle brique indépendamment.
- **Le déploiement en shadow mode** (CAB-2051) réduit le risque de l’activation bloquante en production : S3 tourne sur chaque PR, mais son verdict reste non bloquant pendant 2 à 3 semaines. Nous calibrons les seuils sur des diffs réels avant de basculer le drapeau de contrôle obligatoire.
- **Le pré-contrôle Gitleaks** empêche l’exfiltration de secrets vers Anthropic et répond à la principale préoccupation de confidentialité liée à la revue de code par LLM.
- **Alignement canonique sur HEG-PAT-003** (CAB-2054). Le jury S1/S2 correspond désormais exactement au jeu canonique de 8 personas Team Coca maintenu dans l’outillage interne. Toute dérive entre le patron canonique et l’implémentation disparaît, et la composition du jury est auditable depuis une source de vérité unique.

### Négatives

- **Le jugement d’un LLM n’est pas déterministe.** Un même diff relu deux fois peut obtenir 8.1 puis 7.9. Nous l’acceptons : le seuil porte sur une moyenne de 4 axes (S3) ou de 8 personas (S1/S2). Pour S1/S2, doubler le jury de 4 à 8 personas réduit la variance par exécution d’environ √2 (loi des grands nombres), ce qui compense largement le bruit additionnel par appel lié à un jury plus large — la moyenne sur 8 personas est donc *plus* stable que l’ancienne moyenne sur 4 personas, et non moins.
- **Le calibrage des prompts est itératif.** Les étapes 4 et 5 de CAB-2047 affineront les prompts par axe sur des diffs réels avant que S3 ne devienne bloquant. Prévoir 2 à 3 cycles d’itération sur les prompts au cours du premier mois.
- **Dépendance API supplémentaire.** S3 dépend de l’accessibilité de l’API Anthropic depuis la CI. Une panne bloque les merges. Atténuations : le plafond quotidien déclenche un passage souple (code de sortie 0), un délai d’expiration de 30 s et deux nouvelles tentatives couvrent les pannes transitoires, et `COUNCIL_DISABLE=1` reste disponible à tout moment.
- **Risque de dérive des coûts.** Une boucle incontrôlée ou un changement de tarif du modèle pourrait percuter le plafond. Ce plafond constitue la première ligne de défense, complétée en seconde ligne par un audit hebdomadaire de `council-history.jsonl`.

### Neutres

- **Coût de maintenance bash.** Le CLI compte ~1 300 LOC de bash. Shellcheck et bats-core couvrent l’essentiel du risque, mais une refonte ample demanderait plus d’efforts qu’en Python. Nous acceptons ce compromis car il s’agit d’un outillage CI qui évolue rarement.
- **Dérive des fixtures MOCK_API.** Les fichiers JSON de fixtures doivent être mis à jour lorsque le schéma de l’outil `record_review` change. Atténuations : le schéma est simple (score, retour, points bloquants) et évolue peu. Toute dérive apparaît immédiatement lors des tests MOCK_API.

---

## Plan de déploiement (phases CAB-2046)

| Phase | Ticket | Description | Statut |
|-------|--------|-------------|--------|
| 1 | CAB-2047 | CLI `scripts/council-review.sh` + 4 axes + tests bats + doc | En cours (étapes 1 à 3c mergées, étape 4 à suivre) |
| 2 | CAB-2048 | Extension du hook pre-push — invocation locale de council-review.sh | Bloqué par CAB-2047 |
| 3 | CAB-2049 | Workflow CI `council-gate.yml` + feature flag | Bloqué par CAB-2047 |
| 4 | CAB-2050 | Rotation de `council-history.jsonl` (fenêtre glissante de 500 lignes) | Bloqué par CAB-2047 |
| 5 | CAB-2051 | Observation en shadow mode (2-3 semaines non bloquant) → bascule en contrôle requis | Bloqué par CAB-2048 + CAB-2049 + CAB-2050 |

L’application bloquante ne devient obligatoire qu’une fois la phase 5 terminée et le calibrage confirmé par les données du shadow mode (taux de faux positifs < 10 %, taux de faux négatifs < 5 % face à une vérité terrain issue d’une revue manuelle).

---

## Vérification

- **Couverture S1/S2** : chaque nouveau ticket estimé à ≥ 5 pts OU portant le label `council-review`. Skill : `/council <description>`.
- **Couverture S3** : chaque `git push` (hook pre-push, local) ET chaque PR (CI, distant). Mode fail-closed à la fin du shadow mode.
- **Piste d’audit** : `council-history.jsonl` (local), commentaires Linear avec les labels `council:ticket-go` / `council:plan-go` pour S1/S2, historique des contrôles de statut GitHub pour S3.
- **Observabilité des coûts** : audit hebdomadaire via `scripts/ai-ops/council-audit.sh` (livrable CAB-2050) — rapporte le nombre total d’exécutions, le coût, la distribution des verdicts et la dérive de calibrage.

---

## Références

- CAB-2046 — `[MEGA] Council Stage 3 — Automated Code Review` (parent)
- CAB-2047 — CLI `council-review.sh` (13 pts, en cours)
- CAB-2048 — extension du hook pre-push
- CAB-2049 — workflow CI `council-gate.yml`
- CAB-2050 — rotation de `council-history.jsonl`
- CAB-2051 — observation en shadow mode
- CAB-2054 — alignement de Council S1/S2 sur 8 personas selon HEG-PAT-003 (cet amendement)
- `.claude/skills/council/SKILL.md` — runbook S1/S2
- `.claude/rules/council-s3.md` — runbook S3 (livrable de l’étape 4 de CAB-2047)
- `scripts/council-review.sh` — implémentation du CLI S3
- `scripts/council-prompts/{conformance,debt,attack_surface,contract_impact}.md` — prompts système par axe (externalisés à l’étape 3a de CAB-2047)
- ADR-050 — Guardrails, Token Budget, State Machine (première utilisation de Council, score 7.25/10 Fix)
- ADR-056 — Architecture FAPI 2.0 (Council 8.13/10 Go)
- ADR-059 — Simplified Deployment SSE (Council 8.00/10 Go, impact CRITICAL)
- ADR-060 — AI-Verified UI Testing (complémentaire — Council valide le jugement, ADR-060 valide le rendu visuel)

## Relecteurs

| Rôle | Statut |
|---|---|
| **Council S1** | 8.125/10 Go (sur CAB-2046) — réévalué à 8.5/10 Go sur l’amendement CAB-2054 |
| **Council S2** | 8.5/10 Go (sur CAB-2046, 13 ajustements appliqués) — réévalué à 8.0/10 Go sur l’amendement CAB-2054 (5 ajustements appliqués) |
| **Architecte** | Christophe (CAB Ingenierie) |
| **Score d’impact** | HIGH (20) — inter-composants (CI, hook pre-push, scripts/), déploiement sous feature flag, coupe-circuits à chaque couche. L’amendement CAB-2054 est MEDIUM (~10) — documentation uniquement, aucun changement à l’exécution |
