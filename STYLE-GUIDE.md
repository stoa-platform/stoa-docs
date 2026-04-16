# STOA Editorial Style Guide

Audience primaire : **architecte / décideur EU régulé** (banque, assurance,
secteur public, télécom, énergie). Format : blog long (≥ 1 200 mots),
documentation d'architecture, post de réflexion sur un pattern.

Court — tout ce qui n'est pas listé ici vit dans la pull request review.

## Voix

- **Didactique, sans condescendance.** L'audience a vu 20 ans de gateways, de
  migrations et de ralliements méthodologiques. On écrit pour un pair.
- **Vulgariser, c'est traduire — pas simplifier.** Reformuler un concept dans
  les mots du lecteur, pas en retirant la profondeur. Si un terme technique
  est pertinent, le garder et l'expliquer une fois.
- **Opinions ancrées, jamais péremptoires.** *"Sur ce type de legacy, nous
  avons vu le pattern X échouer sur Y."* plutôt que *"X est mauvais."*
- **Montrer le raisonnement.** Décisions d'architecture = contexte → options
  → trade-offs → choix → conséquences. Pas de conclusions désincarnées.

Référence vivante : le prompt *STOA LinkedIn Weekly Voice* dans
`hegemon/skills/linkedin-voice/SKILL.md`. Cette voix courte se prolonge en
format long en gardant la même discipline : pas de hype, pas d'adverbes
vides.

## Accroche et chute

- **Accroche (≤ 3 phrases).** Un fait observé, un chiffre sourcé, une
  contradiction opérationnelle. Pas *"Dans le monde du cloud moderne…"*.
- **Chute (≤ 3 phrases).** Une conclusion actionnable ou un choix à faire.
  Pas de *"Nous espérons que cet article vous aidera."*.

## BLACKLIST (format long)

| Motif | Pourquoi |
|---|---|
| *"révolutionnaire"*, *"game-changing"*, *"ultimate"* | Marketing vide, disqualifie auprès de l'audience |
| *"costs add up"*, *"runs into millions"*, chiffres sans source | Déclaration non vérifiable → détecté par `audit-content-compliance.sh` |
| *"legacy"* en adjectif seul | Remplacer par *"système historique déployé en 20XX"* ou équivalent daté |
| *"Escape vendor lock-in"*, *"replace your expensive X"* | Positionnement agressif, incompatible avec la cible architecte |
| *"better than [Concurrent]"*, *"superior to"* | Claim comparatif sans source → P1 auto-détecté |
| *"STOA est conforme à DORA/AI Act/NIS2"* sans citation officielle | Claim réglementaire fabriqué → P1_REGULATORY_CLAIM bloque |

Liste détectée automatiquement par `scripts/audit-content-compliance.sh`.
Le gate humain ci-dessous complète — la machine ne voit pas tous les pièges.

## Gate de publication — "Aide-t-il l'ESN à vendre STOA ?"

Discipline humaine v1, **pas d'enforcement CI**. Avant merge, l'auteur
répond aux quatre questions ci-dessous. Si une réponse est *non*, l'article
reste en draft.

- [ ] **Un architecte en mission chez un client régulé peut-il citer cet
      article en réunion sans avoir à se défendre ?** (Test du partage ESN)
- [ ] **Le lecteur repart avec un point de décision concret ?** (Pas un
      contenu purement éducatif sans *call to action technique*)
- [ ] **Chaque affirmation réglementaire ou comparative renvoie à une source
      primaire cliquable ?** (ENISA, eur-lex, ISO, NIST, documentation
      éditeur officielle, ou marqueur whitelisté dans l'audit script)
- [ ] **Le ton permet un repartage tel quel sur LinkedIn par un architecte
      freelance ou un lead ESN ?** (Ni mou ni aggressif)

## Disclaimer "regulatory positioning" — template

À insérer à la fin de tout article qui mentionne DORA, AI Act, NIS2, GDPR,
SOC 2, ISO 27001 ou HIPAA dans un contexte d'alignement produit :

> **Regulatory positioning.** STOA is a tooling layer that supports
> compliance with [*nom du cadre*, lien officiel]. Certification,
> accreditation, and attestation remain the responsibility of the operator
> deploying STOA in production. Last verified : *YYYY-MM*.

## Sources autorisées

**Primaires (citer en priorité)** :

- [InfoQ Software Architect Newsletter](https://www.infoq.com/software-architects-newsletter/)
- [Ardoq Knowledge Hub](https://www.ardoq.com/knowledge-hub/eu-ai-act) —
  cadrage EU AI Act, DORA, NIS2.
- [ENISA news](https://www.enisa.europa.eu/news) — autorité cyber EU.
- [Orange Business Perspective Data & AI](https://perspective.orange-business.com/en/) —
  regard grand compte EU sur AI & data.
- [eur-lex.europa.eu](https://eur-lex.europa.eu/) — textes officiels UE.
- `iso.org`, `nist.gov` — normes internationales.

**Secondaires (acceptables si sourcées)** : Gartner, Forrester, IDC, blog
éditeur officiel du concurrent cité, Levels.fyi pour les chiffres de
rémunération.

**Jamais** : LLM reformulation sans trace sourcée, bouche-à-oreille, article
de presse marketing sans chiffre cliquable.
