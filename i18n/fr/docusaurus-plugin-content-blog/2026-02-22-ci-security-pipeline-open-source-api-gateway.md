---
slug: ci-security-pipeline-open-source-api-gateway
title: "Pipeline CI Sécurité en 9 Jobs : Scanner Chaque PR Automatiquement"
description: "Gitleaks, Bandit, Clippy SAST, Trivy et vérifications de licences dans un seul pipeline GitHub Actions. Comment détecter secrets et CVEs sur chaque PR pour 3 langages."
authors: [christophe]
tags: [security, architecture, open-source, tutorial]
keywords:
  - ci security pipeline api gateway
  - github actions security scanning
  - open source api gateway security
  - sbom generation cyclonedx spdx
  - sast open source api gateway
---
<!-- last verified: 2026-02 -->

# Pipeline CI Sécurité en 9 Jobs : Comment STOA Scanne Chaque PR

**STOA exécute 9 jobs de sécurité en parallèle sur chaque pull request — scanning de secrets, SAST pour trois langages, audits de dépendances, scanning de containers, conformité des licences, génération de SBOM et vérification des signatures de commits.** Cet article détaille chaque job, explique ce qu'il détecte et vous montre comment adopter la même approche dans vos propres projets. C'est dans l'esprit de notre philosophie de [gateway API open source](/blog/open-source-api-gateway-2026) : le scanning de sécurité doit être intégré dans le CI, pas rajouté après une compromission.

<!-- truncate -->

## Pourquoi 9 jobs et non 1

Un seul scanner de sécurité ne peut pas tout couvrir. Les outils de détection de secrets ne comprennent pas le flux de code. Les outils SAST ne scannent pas les images de containers. Les scanners de licences ne vérifient pas les CVEs. Chaque job du pipeline détecte ce que les autres manquent.

La conception à 9 jobs suit un modèle de **défense en profondeur** : même si un job a un faux négatif, un autre détecte le problème à une couche différente. Une clé API codée en dur peut passer à travers Bandit (qui cherche des patterns de code), mais Gitleaks la signalera par regex. Une dépendance vulnérable peut ne pas déclencher de résultat SAST, mais `pip-audit` rapportera le CVE.

Exécuter les jobs en parallèle signifie aussi que le pipeline se termine en le temps du job le plus lent (~5 minutes pour les builds de containers), et non la somme de tous les jobs. Les développeurs obtiennent un retour rapide sans sacrifier la couverture.

Voici le pipeline complet en un coup d'œil :

| # | Job | Outil | Langage | Bloquant ? |
|---|-----|-------|---------|-----------|
| 1 | Secret Scan | Gitleaks 8.21 | Tous | Oui |
| 2 | SAST Python | Bandit | Python | Oui |
| 3 | SAST Rust | Clippy (strict) | Rust | Oui |
| 4 | SAST JavaScript | ESLint Security | TypeScript | Partiel |
| 5 | Dependency Scan | cargo-audit, pip-audit, npm audit | Tous | Non |
| 6 | Container Scan | Trivy | Images Docker | Non |
| 7 | License Compliance | Trivy SPDX | Tous | Oui (vérification requise) |
| 8 | SBOM Generation | Trivy CycloneDX + SPDX | Tous | Oui (vérification requise) |
| 9 | Signed Commits | git verify-commit | Tous | Oui (vérification requise) |

Trois de ces jobs sont des **vérifications requises** pour la fusion — ce qui signifie qu'une PR ne peut pas être fusionnée tant qu'ils ne passent pas. Les autres sont soit bloquants (font échouer le job mais ne bloquent pas la fusion) soit consultatifs (rapportent les résultats sans échouer). Cette approche progressive évite la fatigue d'alertes tout en détectant les problèmes critiques.

---

## Détail de chaque job

### 1. Gitleaks — Détection de secrets

**Ce qu'il détecte :** Clés API, tokens, mots de passe, clés privées et autres identifiants commités dans le dépôt — y compris ceux enfouis dans l'historique git.

Gitleaks scanne le dépôt complet avec `fetch-depth: 0`, ce qui signifie qu'il vérifie chaque commit, pas seulement le dernier. C'est important car [les secrets dans l'historique git persistent même après suppression](/blog/api-keys-in-git-history) — un `git rm` ne supprime le fichier que de l'arbre de travail, pas des commits passés.

STOA utilise une configuration `.gitleaks.toml` personnalisée qui étend le jeu de règles par défaut avec des listes d'autorisation pour les faux positifs connus :

```toml
[extend]
useDefault = true

[allowlist]
paths = [
  '''docs/.*\.md''',         # Documentation avec des clés d'exemple
  '''tests/.*''',            # Fixtures de tests avec des identifiants factices
  '''deploy/docker-compose/.*''',  # Fichiers compose locaux uniquement
  '''scripts/demo/.*''',     # Scripts de démo avec des identifiants de test
]

regexes = [
  '''stoa_[a-zA-Z]+_[a-zA-Z0-9]{8,}_example''',  # Clés de substitution
  '''your[_-]?api[_-]?key''',
]
```

La liste d'autorisation est explicite et minimale. Chaque chemin y figurant est commenté pour expliquer pourquoi il est sûr. Les faux positifs dans la documentation et les fixtures de tests sont attendus — les vrais secrets dans `src/` ne le sont pas.

**Bloquant ?** Oui. Une fuite de secret est toujours un P0.

### 2. Bandit — SAST Python

**Ce qu'il détecte :** Injection SQL, injection shell, mots de passe codés en dur, utilisation de `eval()`, fonctions de hachage non sécurisées, cryptographie faible et autres anti-patterns de sécurité spécifiques à Python.

Bandit s'exécute sur les deux composants Python (`control-plane-api` et `mcp-gateway`) en utilisant une stratégie de matrice :

```yaml
strategy:
  fail-fast: false
  matrix:
    project: [control-plane-api, mcp-gateway]
```

Les seuils de sévérité et de confiance sont tous deux réglés sur **MEDIUM**, ce qui filtre le bruit à faible confiance tout en détectant les problèmes significatifs :

```bash
bandit -r $PROJECT/ --severity-level medium --confidence-level medium
```

Les résultats sont également exportés en artefacts JSON (conservés 30 jours) pour l'analyse des tendances et les pistes d'audit.

**Bloquant ?** Oui. Sévérité MEDIUM+ avec confiance MEDIUM+ fait échouer le job.

### 3. Clippy SAST — Linting de sécurité Rust

**Ce qu'il détecte :** Patterns non sécurisés, panics dans le code de production, macros de debug oubliées, implémentations inachevées et gestion risquée des erreurs dans le code Rust.

La vérification Clippy standard en CI utilise `-D warnings` (refus de tous les avertissements). Le scan de sécurité va plus loin avec des règles ciblées :

```bash
cargo clippy --all-targets --all-features -- \
  -W warnings \
  -D clippy::todo \
  -D clippy::unimplemented \
  -D clippy::dbg_macro \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic
```

Les flags `-D` (deny) font échouer le build si des macros `todo!()`, `unimplemented!()` ou `dbg!()` sont trouvées — ce sont des raccourcis de développement qui ne doivent jamais atteindre la production. Les flags `-W` (warn) pour `unwrap_used`, `expect_used` et `panic` signalent les points de panique potentiels sans faire échouer le build, car certaines utilisations sont légitimes (par exemple dans le code de test inclus via `--all-targets`).

**Bloquant ?** Oui. Les lints refusés font échouer le job.

### 4. ESLint Security — SAST TypeScript

**Ce qu'il détecte :** `eval()` avec des expressions dynamiques, patterns regex non sécurisés, injection dans des objets, attaques par timing, contournements CSRF et buffer overflows dans le code TypeScript.

Le job ESLint security utilise une **conception à deux niveaux** — 7 règles sont rapportées, mais seulement 2 bloquent la fusion :

```yaml
# Niveau 1 : Rapport complet (non bloquant, 7 règles)
npx eslint 'src/**/*.{ts,tsx}' \
  --plugin security \
  --rule '{"security/detect-object-injection": "error", ...}' \
  --max-warnings 0

# Niveau 2 : Gate bloquant (2 règles critiques uniquement)
npx eslint 'src/**/*.{ts,tsx}' \
  --no-eslintrc \
  --rule '{"security/detect-eval-with-expression": "error",
           "security/detect-unsafe-regex": "error"}'
```

Pourquoi un blocage partiel ? Des règles comme `detect-object-injection` produisent des faux positifs sur la notation bracket légitime (`obj[key]`). Rendre les 7 règles bloquantes noierait les développeurs sous le bruit. Les deux règles bloquantes — `eval` avec des expressions et regex non sécurisé — ont des taux de faux positifs quasi nuls et représentent des vulnérabilités critiques (XSS et ReDoS respectivement).

**Bloquant ?** Partiellement. `detect-eval-with-expression` et `detect-unsafe-regex` bloquent la fusion. Les 5 autres règles rapportent les résultats sans échouer.

### 5. Dependency Scanning — Détection de CVEs

**Ce qu'il détecte :** Vulnérabilités connues (CVEs) dans les dépendances tierces sur les trois écosystèmes de langages.

Trois outils s'exécutent en séquence, chacun ciblant un écosystème :

| Outil | Écosystème | Commande |
|-------|-----------|---------|
| `cargo audit` | Rust (Cargo.lock) | `cargo audit` |
| `pip-audit` | Python (requirements.txt) | `pip-audit -r requirements.txt --desc` |
| `npm audit` | Node.js (package-lock.json) | `npm audit --audit-level=high` |

**Pourquoi non bloquant ?** Les vulnérabilités de dépendances nécessitent souvent des corrections en amont hors du contrôle de l'auteur de la PR. Une dépendance transitive à trois niveaux de profondeur peut avoir un CVE connu sans correctif disponible. Rendre ce job bloquant gèlerait tout le développement jusqu'à ce que chaque mainteneur en amont publie un correctif — une contrainte déraisonnable pour un projet open source.

Les résultats sont suivis comme avertissements. L'exécution planifiée quotidienne (cron à 06:00 UTC) garantit que l'équipe voit les nouveaux CVEs dans les 24 heures même sans PRs actives.

**Bloquant ?** Non. `continue-on-error: true` sur le job. Les résultats sont visibles dans le résumé du workflow.

### 6. Container Scanning — Détection de vulnérabilités d'images

**Ce qu'il détecte :** Vulnérabilités au niveau de l'OS et des bibliothèques dans les images Docker, y compris les CVEs des images de base (Alpine, Debian) et les problèmes au niveau applicatif intégrés dans l'image finale.

Trivy scanne les 5 images de composants :

```yaml
matrix:
  image:
    - name: control-plane-api
    - name: mcp-gateway
    - name: portal
    - name: stoa-gateway
    - name: control-plane-ui
```

Chaque image est construite localement en CI et scannée pour les vulnérabilités de sévérité CRITICAL et HIGH, en ignorant les problèmes non corrigés (pas encore de correctif disponible) :

```yaml
severity: 'CRITICAL,HIGH'
vuln-type: 'os,library'
ignore-unfixed: true
exit-code: '1'
```

Les résultats sont exportés en fichiers SARIF et uploadés dans GitHub Security (lorsque Advanced Security est activé). Cela crée une vue centralisée de toutes les vulnérabilités de containers sur le dépôt.

**Bloquant ?** Non au niveau du job (`continue-on-error: true`), mais l'étape Trivy elle-même sort avec le code 1 sur les résultats HIGH+ — rendant les échecs d'images individuelles visibles dans le résumé du workflow.

### 7. License Compliance — Détection de licences copyleft

**Ce qu'il détecte :** Dépendances utilisant des licences copyleft (GPL, AGPL, LGPL, SSPL, EUPL) qui seraient incompatibles avec la licence Apache 2.0 de STOA.

Trivy scanne le système de fichiers et génère un rapport SPDX, puis un script Python vérifie la licence déclarée de chaque paquet par rapport à une liste de blocage copyleft :

```python
copyleft = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1',
            'LGPL-3.0', 'SSPL-1.0', 'EUPL-1.2']
```

C'est particulièrement important pour un projet open source. Inclure accidentellement une dépendance GPL nécessiterait soit de relicencier l'intégralité du projet, soit de supprimer la dépendance — deux opérations coûteuses. Le détecter au moment d'une PR ne coûte rien. Pour comprendre pourquoi STOA a choisi Apache 2.0 plutôt que la BSL ou d'autres licences, voir [Pourquoi Apache 2.0 et pas BSL](/blog/why-apache-2-not-bsl).

**Bloquant ?** Oui. C'est l'une des 3 vérifications requises pour la fusion.

### 8. SBOM Generation — Software Bill of Materials

**Ce qu'il détecte :** Rien directement — les SBOMs sont un outil de transparence, pas de détection. Ils génèrent un inventaire lisible par machine de chaque composant, bibliothèque et dépendance du projet.

STOA génère des SBOMs dans les deux formats majeurs :

| Format | Standard | Consommateur principal |
|--------|----------|----------------------|
| CycloneDX | OASIS | Outils de sécurité, gestion des vulnérabilités |
| SPDX | ISO/IEC 5962:2021 | Conformité des licences, approvisionnement |

Les deux fichiers sont uploadés comme artefacts avec une rétention de 90 jours — suffisamment longtemps pour les audits et la réponse aux incidents.

Pourquoi est-ce important ? Des réglementations comme [DORA et NIS2](/blog/dora-nis2-api-gateway-compliance) exigent que les organisations tiennent à jour des inventaires précis de leurs logiciels. Quand un nouveau CVE est publié pour une bibliothèque que vous utilisez, le SBOM vous indique immédiatement si vous êtes affecté — sans avoir à chercher manuellement dans les fichiers de lock de 5 composants.

**Bloquant ?** Oui. C'est l'une des 3 vérifications requises pour la fusion.

### 9. Verified Signed Commits — Intégrité de la chaîne d'approvisionnement

**Ce qu'il détecte :** Commits non signés qui pourraient indiquer des identifiants compromis ou des contributions non autorisées.

Le job vérifie les signatures GPG sur les commits de la PR (ou les 10 derniers commits lors d'un push) :

```bash
for COMMIT in $COMMITS; do
  if git verify-commit "$COMMIT" 2>/dev/null; then
    echo "Signed"
  else
    UNSIGNED=$((UNSIGNED + 1))
  fi
done
```

Actuellement configuré comme un **avertissement** (`continue-on-error: true`) plutôt qu'un blocage dur, car tous les contributeurs n'ont pas de clés GPG configurées. Le résumé du workflow indique clairement quels commits sont signés et lesquels ne le sont pas.

**Bloquant ?** Oui (vérification requise), mais le job lui-même utilise `continue-on-error: true` — il rapporte les commits non signés sans empêcher la fusion. Cette approche progressive permet à l'équipe de suivre l'adoption sans bloquer les contributions.

---

## Les trois vérifications requises

La protection de branche GitHub impose 3 vérifications qui doivent passer avant que toute PR puisse fusionner dans `main` :

1. **License Compliance** — pas de dépendances copyleft
2. **SBOM Generation** — l'inventaire logiciel est toujours à jour
3. **Verified Signed Commits** — sensibilisation à la chaîne d'approvisionnement

Ces trois ont été choisies car elles représentent des **engagements organisationnels**, pas seulement de la qualité de code. La conformité des licences protège le statut juridique du projet. Les SBOMs satisfont les exigences réglementaires. Les commits signés construisent la confiance dans la chaîne d'approvisionnement. Aucun d'entre eux ne peut être « corrigé plus tard » — une dépendance copyleft fusionnée aujourd'hui crée une exposition juridique immédiate.

Les jobs SAST et de dépendances (Bandit, Clippy, ESLint, audits) bloquent au niveau du job mais ne sont pas requis pour la fusion. Cela signifie que leurs échecs sont visibles et doivent être reconnus, mais un hotfix urgent peut les contourner si nécessaire.

---

## Polyglotte par conception

STOA est un monorepo polyglotte : Python (API, MCP Gateway), Rust (STOA Gateway) et TypeScript (Console, Portal). Le pipeline de sécurité couvre les trois écosystèmes avec des outils appropriés à chaque langage :

| Préoccupation | Python | Rust | TypeScript | Agnostique au langage |
|---------|--------|------|------------|-------------------|
| SAST | Bandit | Clippy (strict) | ESLint Security | — |
| Dépendances | pip-audit | cargo-audit | npm audit | — |
| Secrets | — | — | — | Gitleaks |
| Containers | Trivy | Trivy | Trivy | Trivy |
| Licences | — | — | — | Trivy SPDX |
| SBOM | — | — | — | Trivy CycloneDX + SPDX |
| Signatures | — | — | — | git verify-commit |

Chaque langage bénéficie de son propre SAST et scanner de dépendances. Les préoccupations transversales (secrets, containers, licences, SBOMs, signatures) utilisent des outils agnostiques au langage qui fonctionnent sur l'ensemble du dépôt.

---

## Comment adopter cela dans votre propre projet

Vous n'avez pas besoin d'un monorepo polyglotte pour bénéficier de cette approche. Voici comment commencer :

### Étape 1 : Ajouter Gitleaks (30 minutes)

Le scanning de secrets a le meilleur ROI de tous les jobs de sécurité. Une seule clé API divulguée peut coûter plus que toutes les autres vulnérabilités combinées.

```yaml
- name: Secret Scan
  uses: gitleaks/gitleaks-action@v2
  with:
    config-path: .gitleaks.toml
```

Commencez avec les règles par défaut. N'ajoutez des chemins à la liste d'autorisation que lorsque vous obtenez des faux positifs — et documentez pourquoi chaque chemin est autorisé.

### Étape 2 : Ajouter le SAST pour votre langage (1 heure)

Choisissez l'outil SAST pour votre langage principal :

- **Python** : `pip install bandit && bandit -r src/ -ll`
- **Rust** : `cargo clippy -- -D clippy::todo -D clippy::dbg_macro`
- **TypeScript** : `npx eslint --plugin security --rule '{"security/detect-eval-with-expression": "error"}'`
- **Go** : `go vet ./...` + `staticcheck ./...`
- **Java** : SpotBugs ou PMD

### Étape 3 : Ajouter la génération de SBOM (15 minutes)

```yaml
- name: Generate SBOM
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    format: 'cyclonedx'
    output: 'sbom.json'

- name: Upload SBOM
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.json
    retention-days: 90
```

Même si vous n'avez pas besoin de SBOMs pour la conformité aujourd'hui, les avoir disponibles quand un CVE majeur apparaît (comme Log4Shell) vous évite des heures d'investigation du type « utilisons-nous cette bibliothèque ? ».

---

## Durcissement de la chaîne d'approvisionnement : Actions GitHub épinglées par SHA

Un détail qui mérite d'être mis en avant : chaque GitHub Action du pipeline est épinglée à un SHA de commit spécifique, pas à un tag de version :

```yaml
# Au lieu de ceci (tag mutable) :
uses: actions/checkout@v4

# STOA utilise ceci (SHA immuable) :
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
```

Les tags de version comme `v4` sont mutables — un mainteneur compromis pourrait pousser du code malveillant sous le même tag. Les SHAs de commits sont immuables. C'est un changement simple qui élimine toute une classe d'attaques de la chaîne d'approvisionnement.

---

## FAQ

### Pourquoi les scans de dépendances ne sont-ils pas bloquants ?

Les vulnérabilités de dépendances se trouvent souvent dans des dépendances transitives que le projet ne contrôle pas directement. Les rendre bloquantes gèlerait le développement chaque fois qu'une bibliothèque en amont a un CVE connu sans correctif disponible. Elles sont plutôt suivies comme avertissements avec des scans planifiés quotidiens pour assurer la visibilité.

### Qu'est-ce qu'un SBOM et pourquoi est-ce important ?

Un Software Bill of Materials (SBOM) est un inventaire lisible par machine de chaque composant de votre logiciel — comme une liste d'ingrédients pour le code. C'est important car des réglementations comme DORA et NIS2 exigent que les organisations sachent exactement ce qui compose leur chaîne d'approvisionnement logicielle. Quand un nouveau CVE est publié, le SBOM vous indique en quelques secondes si vous êtes affecté.

### Pourquoi épingler les GitHub Actions par SHA plutôt que par tag de version ?

Les tags de version (`v4`, `v3`) sont mutables — quiconque a un accès en écriture au dépôt de l'action peut modifier le code vers lequel le tag pointe. Les SHAs de commits sont immuables. L'épinglage par SHA signifie que le code exact que vous avez audité est celui qui s'exécute dans votre CI, même si le dépôt de l'action est compromis ultérieurement.

### Pourquoi ESLint Security plutôt que Semgrep pour TypeScript ?

ESLint Security s'intègre nativement avec la configuration ESLint existante — pas d'installation d'outil supplémentaire, pas de langage de configuration séparé, pas de dépendance runtime. Semgrep est plus puissant pour l'analyse multi-langages, mais pour un scan TypeScript uniquement, ESLint Security offre une couverture suffisante avec zéro complexité supplémentaire. Les deux règles critiques (`detect-eval-with-expression` et `detect-unsafe-regex`) détectent les vulnérabilités TypeScript à impact le plus élevé.

### Comment gérez-vous les faux positifs de Gitleaks ?

Chaque faux positif est ajouté à `.gitleaks.toml` avec un pattern de chemin explicite et un commentaire expliquant pourquoi c'est sûr. La liste d'autorisation utilise des exclusions au niveau du chemin (pas de désactivation globale des règles), donc seuls des fichiers spécifiques sont exemptés. Les faux positifs courants incluent les clés API d'exemple dans la documentation, les fixtures de tests avec des identifiants factices, et les fichiers Docker Compose avec des mots de passe locaux uniquement.

---

## Prochaines étapes

Le scanning de sécurité est une couche d'une stratégie plus large. Pour les sujets connexes :

- [Your API Keys Are in Your Git History](/blog/api-keys-in-git-history) — plongée approfondie sur la détection et la remédiation des secrets
- [API Security Checklist for Solo Devs](/blog/api-security-checklist-solo-dev) — 10 étapes de sécurité pratiques pour les développeurs individuels
- [DORA & NIS2 Compliance for API Gateways](/blog/dora-nis2-api-gateway-compliance) — comment les SBOMs et les pistes d'audit supportent les exigences réglementaires
- [Open-Source API Gateway Landscape 2026](/blog/open-source-api-gateway-2026) — comparaison des postures de sécurité entre les gateways API open source

> Les comparaisons de fonctionnalités sont basées sur la documentation publiquement disponible au 2026-02. Les capacités des produits évoluent fréquemment. Nous encourageons les lecteurs à vérifier les fonctionnalités actuelles directement auprès de chaque fournisseur. Toutes les marques appartiennent à leurs propriétaires respectifs.
