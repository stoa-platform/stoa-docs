---
title: Sécurité de la plateforme
description: Référence sourcée sur la gestion des vulnérabilités, l'authentification et les tests d'intrusion.
---

# Sécurité de la plateforme

## Objectif et public concerné

Cette référence aide les architectes et les responsables de la sécurité à évaluer **STOA — Sovereign iPaaS — API & integration platform**, avec un module MCP. Elle distingue les contrôles implémentés de l'architecture cible et présente les éléments vérifiables disponibles.

## Sources et périmètre architectural

Les liens vers le code ci-dessous ciblent une révision précise du dépôt. Les ADR publiés décrivent des décisions ; ils n'attestent pas d'un déploiement.

L'[ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane.md) décide que le data plane utilise Envoy upstream, configuré par xDS via STOA Link, avec l'autorisation dans des services externes et le module MCP derrière Envoy. Il indique explicitement que le serveur xDS de Link n'est pas encore implémenté. Le code de la passerelle Rust cité ici documente donc la passerelle maintenue, sans prouver le déploiement de la cible Envoy.

## Gestion des vulnérabilités

### Signalement et traitement

La [politique de sécurité][policy] du dépôt demande un signalement privé au contact de sécurité indiqué, plutôt qu'une issue GitHub publique. Inclure la révision concernée, les étapes de reproduction, la configuration pertinente et l'impact. La politique décrit l'accusé de réception, l'évaluation, le développement d'un correctif pour les vulnérabilités vérifiées et la divulgation coordonnée. Ses conditions de protection des chercheurs limitent les tests aux comptes détenus ou explicitement autorisés et demandent d'éviter les atteintes à la vie privée, la destruction de données et les interruptions de service.

### Contrôles automatisés et limites

Les contrôles suivants sont configurés dans le dépôt source ; leur configuration ne démontre ni l'absence de vulnérabilité détectée ni une couverture complète.

| Contrôle | Comportement configuré et limites | Preuve |
|---|---|---|
| Analyse statique | Clippy pour Rust, Bandit pour Python et règles de sécurité ESLint. La sélection sur les pull requests dépend des chemins modifiés. | [Security Scan][scan], [sélection des chemins][selection] |
| Dépendances | `cargo audit`, `pip-audit` et `npm audit` limité aux dépendances de production pour la console et le portail. Ces étapes autorisent l'échec ; la commande Python exclut explicitement un avis de sécurité. | [Security Scan][scan] |
| Secrets et conteneurs | Gitleaks examine les commits de la PR, ou l'arbre courant hors PR. Trivy examine les images sélectionnées pour les vulnérabilités HIGH/CRITICAL disposant d'un correctif ; le job conteneur autorise l'échec. | [Security Scan][scan] |
| Contrôles planifiés | Un workflow hebdomadaire distinct définit les audits de dépendances, Gitleaks sur tout l'historique et les scans d'images. Plusieurs étapes sont informatives, une variable du dépôt peut les désactiver et la référence d'image du portail reste non résolue dans cette révision. | [Scheduled Security Scan][scheduled] |
| Mises à jour des dépendances | Dependabot regroupe chaque semaine les mises à jour mineures et correctives pour pip, npm, Cargo, Docker et GitHub Actions. Les versions majeures et certaines versions nommées sont exclues. Les propositions de mise à jour ne démontrent pas une remédiation. | [Configuration Dependabot][dependabot] |
| CodeQL | Le run du dépôt lié atteste d'une analyse gérée par GitHub pour Actions et Go. Ce run ne démontre pas une couverture CodeQL de tous les langages ou composants. | [Run CodeQL][codeql] |

## Authentification et autorisation

La [politique de sécurité][policy] identifie Keycloak comme fournisseur OIDC. Dans l'API du control plane, les [dépendances d'authentification][api-auth] vérifient les signatures RS256 avec la clé publique du realm Keycloak, valident l'émetteur et les claims de durée de validité, puis vérifient l'audience dans un ensemble accepté qui conserve des audiences de compatibilité. Le [code RBAC][rbac] définit les rôles d'administrateur de plateforme, d'administrateur de tenant, de DevOps et de lecteur, et applique les décisions d'accès aux tenants.

Le [validateur JWT][jwt] de la passerelle Rust maintenue utilise les clés OIDC et valide la signature, l'émetteur, la durée de validité et l'audience. Les points d'entrée MCP disposent d'un chemin explicite de validation de l'audience de la ressource.

### mTLS et jetons liés aux certificats

La passerelle Rust contient un [middleware d'extraction des certificats et de vérification de liaison][mtls] et une [configuration mTLS][mtls-config]. Elle peut recevoir les métadonnées de certificat d'un terminateur TLS et comparer l'empreinte du certificat au claim JWT `cnf.x5t#S256`. Ce contrôle dépend de la configuration : mTLS est désactivé par défaut, les routes obligatoires sont configurables et une liste vide de proxies de confiance accepte toutes les sources. Une revue de déploiement doit donc examiner le terminateur et la configuration de confiance des proxies, ainsi que la vérification du jeton.

L'[ADR-039](../architecture/adr/adr-039-mtls-cert-bound-tokens.md) décrit la conception de la liaison au certificat. Pour la cible Envoy, l'[ADR-073](../architecture/adr/adr-073-adopt-envoy-data-plane.md), section 5, laisse à vérifier le support natif des jetons liés aux certificats et de DPoP ; les vérifications absentes relèvent du service d'autorisation externe. L'emplacement de la terminaison TLS et l'assainissement des en-têtes de certificat restent également ouverts dans cette décision.

## Démarche de test d'intrusion et limites des preuves

L'[ADR-018](../architecture/adr/adr-018-security-hardening-p0.md) publié décrit un exercice interne de test d'intrusion et les décisions de durcissement qui en découlent. Son périmètre comprend la validation d'audience JWT, l'épuisement des connexions SSE, les restrictions des conteneurs et CORS. Sa trace de revue demande des tests avec les correctifs, une configuration explicite, une documentation et un plan de retour arrière.

Pour une revue d'architecture, utiliser ce document comme exemple traçable du raisonnement reliant une découverte à sa remédiation :

1. Identifier la frontière de sécurité et les conditions de reproduction dans le constat, comme le demande la [politique de sécurité][policy].
2. Relier le contrôle proposé à sa décision de durcissement et à son implémentation.
3. Examiner les tests associés, les exigences de configuration et les conditions de retour arrière.

Ces étapes de revue résument la démarche de l'ADR. Celui-ci constitue une preuve historique, et non un rapport de test indépendant de la version actuelle ou de la cible Envoy. Cette page ne fournit aucun nouveau résultat de test, taux de réussite, niveau d'assurance ou affirmation d'un programme récurrent de tests d'intrusion externes.

## Voir aussi

- [Configuration de sécurité](./security-configuration.md)
- [Permissions RBAC](./rbac-permissions.md)
- [Décision sur le data plane Envoy](../architecture/adr/adr-073-adopt-envoy-data-plane.md)

[policy]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/SECURITY.md
[scan]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/security-scan.yml
[selection]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/scripts/security-scan-changes.py
[scheduled]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/workflows/security-scheduled.yml
[dependabot]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/.github/dependabot.yml
[codeql]: https://github.com/stoa-platform/stoa/actions/runs/41899401121
[api-auth]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/src/auth/dependencies.py
[rbac]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/control-plane-api/src/auth/rbac.py
[jwt]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/auth/jwt.rs
[mtls]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/auth/mtls.rs
[mtls-config]: https://github.com/stoa-platform/stoa/blob/4290bb39fe57de7516c46ea675a5c90ce4ed13f8/stoa-gateway/src/config/mtls.rs
