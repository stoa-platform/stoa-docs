---
sidebar_position: 75
title: "ADR-075 : Socle de secrets — OpenBao via l'API Vault"
sidebar_label: "ADR-075 : socle de secrets"
description: "STOA utilise un seul socle de secrets pour le produit et pour les environnements de l'équipe plateforme : OpenBao, accessible par l'API HTTP de Vault. Infisical est retiré. Les clients peuvent garder le HashiCorp Vault qu'ils exploitent déjà."
keywords: [ADR, gestion des secrets, socle de secrets, OpenBao, HashiCorp Vault, Infisical, API Vault, External Secrets Operator, licence, MPL-2.0, BSL, décision d'architecture]
---

# ADR-075 : Socle de secrets — OpenBao via l'API Vault

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Statut** | ✅ Acceptée |
| **Date** | 2026-11-07 |
| **Décideurs** | Christophe Aboulicam |
| **Linear** | CAB-1795 |
| **Liées** | [ADR-029](./adr-029-mtls-certificate-lifecycle.md), [ADR-037](./adr-037-deployment-modes-sovereign-first.md), [ADR-048](./adr-048-integrated-chat-agent.md) |

## Contexte

STOA lit des secrets à deux endroits.

1. **Dans le produit.**
   - L'API du plan de contrôle lit les identifiants des connecteurs, ceux des serveurs MCP externes et la clé de pseudonymisation de l'audit par l'API HTTP de Vault. Elle utilise le client `hvac` et, dans un cluster, la méthode d'authentification Kubernetes.
   - Le chart Helm peut synchroniser les secrets de la passerelle avec un `ExternalSecret` d'External Secrets Operator (ESO) qui vise un `ClusterSecretStore` Vault.
   - Le déploiement Docker Compose fournit des gabarits Vault Agent.
2. **Dans l'exploitation de l'équipe plateforme.** Les scripts d'exploitation, les tâches d'amorçage et l'outillage des développeurs lisent leurs secrets dans une instance Infisical auto-hébergée.

Deux systèmes, c'étaient deux choses à durcir, sauvegarder, faire tourner et auditer. Aucune décision écrite ne désignait la source de vérité. Le choix opposait Infisical et Vault. OpenBao, le fork libre de Vault maintenu sous l'égide de la Linux Foundation, est entré dans la comparaison parce qu'il conserve l'API de Vault.

### Ce que permet chaque licence

Vérifié le 2026-11-07 sur les fichiers de licence de la branche principale de chaque projet :

| | HashiCorp Vault (1.15 et suivantes) | Infisical | OpenBao |
|---|---|---|---|
| Licence | Business Source License 1.1. Chaque version passe sous MPL 2.0 quatre ans après sa sortie | MIT, sauf chaque dossier `ee/`, sous la licence propriétaire Infisical Enterprise | Mozilla Public License 2.0 |
| Licence libre | Non | Cœur MIT seulement | Oui |
| Usage interne en production | Autorisé. La licence précise qu'un usage interne n'est pas une offre concurrente | Autorisé pour le cœur MIT. L'image officielle contient aussi du code `ee/`, qui s'exécute même sans clé de licence. Sa licence n'autorise l'usage en production qu'avec un abonnement | Autorisé |
| Distribution avec STOA | Autorisée. L'usage en production n'est exclu que pour un produit payant concurrent des versions payantes de Vault du concédant | Le code `ee/` ne peut pas être distribué | Autorisée. Les fichiers OpenBao modifiés restent sous MPL 2.0 |
| Indisponible sans licence commerciale | Namespaces, réplication, descellement automatique par HSM, groupes de contrôle, politiques Sentinel, quotas de baux | Journal d'audit, RBAC et rôles personnalisés, rotation des secrets, secrets dynamiques, restauration à une date, SSO, liste d'adresses IP autorisées, circuits d'approbation | Rien. OpenBao n'a pas d'édition commerciale |

### Ce dont la plateforme a besoin

- **Une trace d'audit.** Des personnes, des services et des agents d'IA lisent des secrets. Chaque lecture doit laisser une trace. Les périphériques d'audit de Vault et d'OpenBao l'assurent dans la distribution libre. Le journal d'audit d'Infisical exige une offre payante.
- **Le contrat du produit.** Les clients qui exploitent STOA dans leur propre environnement veulent le brancher sur le Vault qu'ils opèrent déjà. Le plan de contrôle parle déjà l'API de Vault.

## Décision

1. **Un seul socle de secrets, accessible par l'API HTTP de Vault**, sert à la fois le produit et les environnements de l'équipe plateforme. Infisical est retiré.
2. **OpenBao est le socle que STOA exploite et livre.** Cela couvre les environnements opérés par STOA et les déploiements de référence : valeurs par défaut du chart Helm, démarrage rapide Docker Compose et développement local.
3. **Le produit reste neutre au niveau de l'API.**
   - Le plan de contrôle garde son client de l'API Vault et n'utilise, dans le parcours produit, aucune fonction propre à OpenBao.
   - Les clients peuvent brancher STOA sur OpenBao ou sur un HashiCorp Vault dont ils ont déjà la licence.
   - ESO fournit les secrets aux charges Kubernetes par son fournisseur Vault, dont la documentation couvre OpenBao.
4. **Le socle de l'équipe plateforme tourne sur une machine virtuelle dédiée, hors du cluster Kubernetes.** Il survit à une reconstruction du cluster et peut servir à son amorçage.

### Exigences pour l'instance de l'équipe plateforme

Avant l'écriture du premier vrai secret :

- TLS sur chaque écouteur ;
- un périphérique d'audit activé ;
- le stockage intégré, avec des sauvegardes chiffrées et un test de restauration depuis la copie hors de l'hôte ;
- une procédure de descellement écrite.

### Points ouverts, tranchés pendant la mise en œuvre

- **Descellement.** La VM de la plateforme n'a pas de KMS cloud. Les options sont le descellement Shamir, manuel après chaque redémarrage, et le scellement par clé statique. OpenBao ne recommande ce dernier que si une source de confiance existante détient la clé. Le choix et la procédure sont consignés dans le runbook d'exploitation.
- **Chemin réseau.** Les charges Kubernetes joignent le socle par un chemin privé. La méthode d'authentification (Kubernetes ou JWT) est configurée en conséquence.
- **Compatibilité du client.** Une tâche de CI exécute le client `hvac` du plan de contrôle contre OpenBao avant que les déploiements de référence changent d'image.

## Conséquences

### Positives

- Un seul système à durcir, sauvegarder, faire tourner et auditer.
- Aucune réécriture du produit : le plan de contrôle, le chart et le déploiement Compose utilisent déjà l'API de Vault.
- Une chaîne de gestion des secrets libre, conforme aux principes « Open Source first » et « Self-hosted possible » et aux déploiements souverains ([ADR-037](./adr-037-deployment-modes-sovereign-first.md)).
- Périphériques d'audit, politiques, secrets dynamiques, moteurs PKI et SSH, sans licence commerciale. Le fournisseur PKI Vault de l'[ADR-029](./adr-029-mtls-certificate-lifecycle.md) garde la même API.

### Négatives

- OpenBao doit être descellé après chaque redémarrage, sauf si un descellement automatique est configuré. Infisical n'a pas de scellement.
- L'outillage d'exploitation qui lit Infisical doit passer à l'API de Vault.
- La MPL 2.0 est un copyleft au niveau du fichier : les fichiers OpenBao modifiés doivent rester sous MPL 2.0 s'ils sont distribués.

### Atténuations

- La procédure de descellement et le test de restauration sont répétés avant le premier vrai secret.
- L'outillage d'exploitation migre par petites pull requests. L'instance Infisical est retirée après le départ de son dernier consommateur.
- STOA exploite OpenBao comme un service distinct et ne le modifie pas : les obligations de la MPL 2.0 se limitent à publier la source amont.
- Le parcours produit reste sur l'API générique de Vault, et la tâche de compatibilité en CI le protège. HashiCorp Vault reste donc utilisable par les clients.

### Suites

- La clé de chiffrement que l'[ADR-048](./adr-048-integrated-chat-agent.md) place dans Infisical rejoint le socle de secrets en même temps que l'outillage d'exploitation.
- Les pages publiques qui décrivent encore Infisical sont mises à jour dans des pull requests de suite.

## Alternatives Considérées

| Option | Pourquoi elle n'a pas été retenue |
|---|---|
| HashiCorp Vault comme socle de la plateforme | La BSL 1.1 n'est pas une licence libre. Namespaces, réplication et descellement par HSM exigent une licence commerciale. Les clients peuvent toujours l'utiliser (décision 3). |
| Infisical pour l'équipe plateforme, API Vault pour le produit | Deux systèmes à sécuriser. Infisical n'a pas de journal d'audit sans offre payante. Sa licence `ee/` laisse incertain l'usage en production sans abonnement. |
| Infisical partout | Il faudrait réécrire la résolution des identifiants et la pseudonymisation de l'audit du plan de contrôle, avec les mêmes limites de licence et d'audit. |

## Références

- [Licence de HashiCorp Vault (BSL 1.1)](https://github.com/hashicorp/vault/blob/main/LICENSE) et [FAQ des licences HashiCorp](https://www.hashicorp.com/license-faq)
- [Fonctions de Vault Enterprise](https://developer.hashicorp.com/vault/docs/enterprise)
- [Licence d'Infisical](https://github.com/Infisical/infisical/blob/main/LICENSE) et [licence Infisical Enterprise du dossier `ee/`](https://github.com/Infisical/infisical/blob/main/backend/src/ee/LICENSE.md)
- [Fonctions d'Infisical actives sans clé de licence](https://github.com/Infisical/infisical/blob/main/backend/src/ee/services/license/license-fns.ts) (`getDefaultOnPremFeatures`)
- [Tarifs d'Infisical](https://infisical.com/pricing)
- [OpenBao](https://openbao.org/) et [licence d'OpenBao (MPL 2.0)](https://github.com/openbao/openbao/blob/main/LICENSE)
- [Configuration du scellement d'OpenBao](https://openbao.org/docs/configuration/seal/) et [scellement par clé statique](https://openbao.org/docs/configuration/seal/static/)
- [External Secrets Operator — fournisseur OpenBao](https://external-secrets.io/latest/provider/openbao/)
