---
slug: why-apache-2-not-bsl
title: "Apache 2.0 vs BSL : Pourquoi la vraie licence open source gagne"
authors: [christophe]
tags: [open-source, community, education]
description: "La BSL, la SSPL et les doubles licences créent un enfermement caché. Les arguments économiques pour choisir Apache 2.0 et pourquoi cela compte pour vos décisions de stack technique."
keywords: [apache 2.0 license, BSL license, open source license comparison, SSPL vs Apache, open core, open source business model, vendor lock-in, source available, true open source]
---
<!-- last verified: 2026-02 -->

# Pourquoi nous avons choisi Apache 2.0 (et ce que nous pensons de la BSL)

En 2024, HashiCorp a fait passer Terraform de la MPL à la BSL. En 2023, Redis est passé de la BSD à la SSPL. Elastic, MongoDB, CockroachDB — tous ont suivi le même schéma : construire une communauté grâce à l'open source, puis changer la licence quand les besoins commerciaux l'exigent.

Nous comprenons pourquoi ils l'ont fait. Nous avons choisi une autre voie malgré tout.

STOA Platform est sous licence **Apache 2.0** — l'une des licences open source les plus permissives qui existe. Aucune astuce de type "source disponible". Pas d'"open core" où les fonctionnalités utiles sont réservées aux abonnés payants. Aucun changement de licence prévu lorsque nous atteindrons un objectif de chiffre d'affaires.

Voici pourquoi — et pourquoi cela compte pour tout développeur choisissant un [gateway API open source](/blog/open-source-api-gateway-2026) aujourd'hui.

<!-- truncate -->

## Le scénario type du changement de licence

Le schéma est désormais familier :

1. **Lancement en open source** — attirer des contributeurs, construire une communauté, gagner en adoption
2. **Croissance vers les entreprises** — les grandes sociétés adoptent le projet, souvent sans payer
3. **Découverte du problème cloud** — AWS/GCP/Azure proposent le projet en tant que service géré, en captant les revenus
4. **Changement de licence** — BSL, SSPL ou double licence pour bloquer les fournisseurs cloud
5. **La communauté se fracture** — OpenTofu (issu de Terraform), Valkey (issu de Redis), OpenSearch (issu d'Elasticsearch)

La logique commerciale est sensée : si Amazon gagne plus d'argent avec votre projet que vous, quelque chose est cassé. Nous compatissons avec cette position.

Mais le changement de licence a des conséquences qui vont bien au-delà des fournisseurs cloud.

## Qui en souffre vraiment

Lorsqu'un projet passe de l'open source à la BSL/SSPL, les plaintes les plus bruyantes viennent des fournisseurs cloud. Mais ce ne sont pas eux qui souffrent le plus.

**Les freelances et consultants** ont construit des activités autour du déploiement et de la personnalisation de ces outils. Les restrictions de la BSL limitent désormais leur capacité à proposer des services gérés à leurs clients.

**Les petites entreprises** qui avaient choisi l'outil *précisément* parce qu'il était open source font maintenant face à une incertitude juridique. Peuvent-elles encore l'héberger elles-mêmes ? Peuvent-elles l'inclure dans leur plateforme ? Les détails de la BSL varient.

**Les contributeurs** qui ont donné du code, de la documentation et des rapports de bugs à l'édition communautaire voient maintenant leur travail enfermé derrière une licence commerciale à laquelle ils n'avaient pas consenti.

**Les projets concurrents et les forks** émergent (OpenTofu, Valkey), fragmentant l'écosystème et créant de la confusion sur la version à utiliser.

La cible visée était AWS. Les victimes réelles sont la communauté.

## Ce que signifie vraiment Apache 2.0

Apache 2.0 est simple :

- **Utilisation** pour tout usage, y compris commercial
- **Modification** comme bon vous semble
- **Distribution** — modifiée ou non
- **Concession de brevet** — les contributeurs accordent des droits de brevet (protège les utilisateurs contre les poursuites en brevets)
- **Pas de copyleft** — vous n'avez pas à ouvrir le code source de vos modifications
- **Attribution** — conservez la mention de licence et le fichier NOTICE

C'est tout. Aucune restriction sur la façon dont vous le déployez. Aucune restriction sur la vente de services autour de lui. Aucune restriction sur les fournisseurs cloud qui l'offrent en tant que service.

## « Mais quid d'AWS ? »

C'est la question que tout le monde pose. Si STOA est sous Apache 2.0, qu'est-ce qui empêche Amazon de lancer « AWS STOA Gateway » et de nous manger la mise ?

La réponse honnête : rien, légalement. La même chose qui les empêche de le faire pour chaque projet Apache 2.0.

La réponse pratique : **ça n'a pas d'importance**, pour plusieurs raisons.

### 1. Protection par la marque

Le nom « STOA », le logo et la marque sont déposés. Amazon peut forker le code, mais ne peut pas l'appeler STOA. Il devrait le rebaptiser et maintenir son propre fork — ce qui est coûteux et diverge rapidement.

C'est exactement ce qui s'est passé avec Kubernetes (marque Google, adoptée par la CNCF), Envoy (marque Lyft), et d'innombrables autres projets. La marque a une valeur indépendante du code.

### 2. Le fossé de l'écosystème

La valeur de STOA n'est pas seulement le binaire du gateway. C'est le control plane, le portail développeur, la console, le CLI, les charts Helm, la documentation, les ADRs, la communauté. Forker le code ne signifie pas forker l'écosystème.

Les projets qui ont été "AWSés" étaient des outils mono-binaire (Redis, Elasticsearch). STOA est une plateforme avec plusieurs composants intégrés. Forker un élément brise l'intégration.

### 3. L'entreprise comme modèle commercial

Le modèle de revenus de STOA n'est pas « facturer pour le logiciel ». C'est :

- **Support entreprise** — SLA, support dédié, dépannage en production
- **Service géré** (futur) — nous l'opérons pour vous
- **Certification et formation** — certification officielle STOA
- **Intégrations personnalisées** — adaptateurs et connecteurs spécifiques aux entreprises

Rien de tout cela n'est menacé par un fork du code. On ne peut pas forker un contrat de support.

### 4. Nous ne sommes pas assez grands pour intéresser AWS

Soyons honnêtes : AWS copie les projets qui ont une adoption massive et une opportunité évidente de revenus en tant que service géré. STOA est un projet open source pré-revenu. Ce serait un honneur qu'AWS nous juge dignes d'être copiés — cela signifierait que nous avons réussi.

Si ce jour vient, nous nous battrons sur l'écosystème, le support et la vitesse d'innovation. Pas sur les restrictions de licence.

## Le problème de confiance

Voici le problème plus profond : **les changements de licence détruisent la confiance**.

Quand un projet change sa licence, chaque utilisateur et contributeur en tire une leçon : *la licence peut changer à tout moment*. Même si la nouvelle licence est raisonnable aujourd'hui, le précédent est établi.

Nous pensons que la confiance se capitalise. Chaque année où STOA reste sous Apache 2.0 renforce la confiance :

- **Les contributeurs** savent que leur travail restera ouvert
- **Les entreprises** savent qu'elles peuvent construire sur STOA sans risque juridique
- **La communauté** sait que le projet sert ses utilisateurs, pas seulement les investisseurs

C'est un avantage concurrentiel qui prend des années à construire et des secondes à détruire.

## L'alternative du partage des revenus

Au lieu de restreindre la licence pour capter des revenus, nous avons conçu un programme de récompenses pour les contributeurs où **45 % des revenus entreprise reviennent à la communauté** (voir [Récompenses Contributeurs](https://docs.gostoa.dev/docs/community/rewards)).

La logique : si la communauté crée de la valeur, la communauté devrait partager les revenus — pas en être exclue.

Il s'agit encore d'un cadre (nous sommes pré-revenu). Mais l'intention est publique et documentée dès le premier jour, pas annoncée rétrospectivement après des levées de fonds.

## Comment évaluer les licences open source

Si vous choisissez entre des gateways API (ou toute infrastructure), voici un cadre d'évaluation pratique :

| Question | Apache 2.0 / MIT | BSL / SSPL / Source-Disponible |
|----------|-------------------|-------------------------------|
| Puis-je l'auto-héberger sans restrictions ? | Oui | Dépend du cas d'usage |
| Puis-je l'offrir dans ma plateforme ? | Oui | Généralement non |
| Puis-je modifier et redistribuer ? | Oui | Oui, mais avec conditions |
| Mes clients peuvent-ils utiliser mon fork commercialement ? | Oui | Vérifiez les petits caractères |
| La licence changera-t-elle à l'avenir ? | Possible mais peu probable (aucun intérêt commercial) | C'est déjà arrivé une fois... |
| Puis-je contribuer sans signer un CLA permettant la relicence ? | Généralement oui | Souvent exige un CLA |

**La question du CLA est critique.** De nombreux projets « open source » exigent que les contributeurs signent un Accord de Licence de Contributeur (CLA) qui accorde à l'entreprise le droit de relicencier leurs contributions. C'est le mécanisme juridique qui permet les futurs changements de licence. Vérifiez le CLA avant de contribuer.

STOA utilise le [Developer Certificate of Origin (DCO)](https://developercertificate.org/) — une signature légère qui confirme que vous avez écrit le code et que vous avez le droit de le contribuer. Aucun droit de relicence accordé.

## Notre engagement

STOA Platform restera sous Apache 2.0. Pas parce que nous n'avons pas de modèle commercial (nous en avons un). Pas parce que nous nous fichons des fournisseurs cloud (nous nous en soucions). Mais parce que :

1. **La confiance vaut plus que l'enfermement** — chaque utilisateur qui choisit STOA en sachant que la licence ne changera pas est un utilisateur qui reste
2. **Communauté > Contrôle** — les meilleurs projets d'infrastructure appartiennent à leurs communautés, pas à une seule entreprise
3. **La sécurité ne devrait pas être monnayée** — si les fonctionnalités de sécurité de votre gateway API sont derrière une licence commerciale, vous n'avez pas un produit de sécurité — vous avez un entonnoir de vente

## Ce que vous pouvez faire

Si vous tenez au vrai open source :

- **Vérifiez la licence** avant d'adopter un outil — pas seulement l'étiquette, mais les termes réels
- **Vérifiez le CLA** — s'ils peuvent relicencier vos contributions, ils le feront éventuellement
- **Soutenez les projets Apache 2.0 / MIT / BSD** — étoilez-les, contribuez, parlez-en autour de vous
- **Posez la question difficile aux fournisseurs** : « Vous engagez-vous à ne jamais changer la licence ? »

---

## FAQ

### Apache 2.0 peut-il vraiment soutenir une activité commerciale ?

Oui. Kubernetes (Google), Envoy (Lyft), Apache Kafka (Confluent) et Terraform/OpenTofu prouvent que les projets Apache 2.0 peuvent générer des milliards en revenus entreprise. Le modèle commercial repose sur les services, pas les restrictions de licence.

### Que se passe-t-il si quelqu'un forke STOA et nous concurrence ?

Ils peuvent forker le code mais pas la marque (marque déposée), la communauté ou l'écosystème. Maintenir un fork compétitif nécessite un investissement d'ingénierie soutenu. La plupart des forks meurent dans les 6 mois — ceux qui survivent (OpenTofu, Valkey) prouvent qu'il y avait un vrai besoin communautaire.

### Comment la licence STOA affecte-t-elle mon projet ?

Apache 2.0 est l'une des licences les plus permissives. Vous pouvez utiliser STOA commercialement, le modifier, l'intégrer dans un logiciel propriétaire et le redistribuer. La seule exigence : conserver la mention de licence et le fichier NOTICE. Pas de copyleft, pas de pièges à brevets.

### Où puis-je en savoir plus sur la philosophie open source de STOA ?

Consultez notre [philosophie communautaire](https://docs.gostoa.dev/docs/community/philosophy) pour les valeurs HLFH complètes, et notre [programme de récompenses contributeurs](https://docs.gostoa.dev/docs/community/rewards) pour savoir comment nous prévoyons de partager les revenus avec la communauté. Pour l'aspect sécurité de l'open source, consultez notre [checklist de sécurité API](/blog/api-security-checklist-solo-dev).

---

**En lien** : [Guide Open Source API Gateway](/blog/open-source-api-gateway-2026) | [Philosophie STOA](https://docs.gostoa.dev/docs/community/philosophy) | [Checklist Sécurité API](/blog/api-security-checklist-solo-dev)

*STOA est Apache 2.0. L'a toujours été. Le sera toujours. [Étoilez-nous sur GitHub](https://github.com/stoa-platform/stoa) si cela compte pour vous.*
