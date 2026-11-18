# ADR-060 — Cadre de tests UI vérifiés par IA en quatre couches

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** Christophe (CAB Ingenierie)
**Ticket parent :** CAB-1989 [MEGA] Cadre de tests UI vérifiés par IA

---

## Contexte

Les agents d’IA (Claude Code et d’autres agents d’IA internes) écrivent et modifient du code d’interface React dans Console et Portal. Ils exécutent les tests unitaires (vitest) et les linters (ESLint, Prettier) pour vérifier le code. Ces contrôles laissent échapper des défauts de rendu. Une page qui compile et passe les tests peut afficher une mise en page dégradée, des données manquantes ou un balisage inaccessible.

Les tests présentaient les lacunes suivantes lors de la décision.
- Aucune préparation des données pour les tests E2E — les tableaux de bord sont testés à vide ou avec des données simulées
- Aucune assertion ARIA — les tests utilisent des sélecteurs CSS qui cessent de fonctionner lors des refontes de mise en page
- Aucune référence de régression visuelle — les régressions de mise en page ne sont détectées que par des humains
- Aucun contrôle d’accessibilité automatisé — la conformité WCAG 2.1 AA reste un objectif non vérifié automatiquement

Les **concurrents** (Vercel, Netlify) intègrent les tests de régression visuelle directement dans leur plateforme. En tant que plateforme de gestion d’API destinée aux entreprises, STOA doit s’aligner sur la norme EN 301 549 pour les marchés publics européens.

---

## Décision

Mettre en place un **cadre de validation en 4 couches** permettant aux agents d’IA de vérifier eux-mêmes leurs modifications d’interface.

### Couche 1 — Préparation des données de test (`DataSeeder`)

Fabrique de données de test orientée API reposant sur `APIRequestContext` de Playwright. Elle crée des entités déterministes (API, serveurs MCP, abonnements) en s’appuyant sur de vrais backends de l’environnement Arena (echo-backend, fapi-echo, llm-mock). Chaque exécution de test reçoit un `runId` unique garantissant l’isolation, suivi d’un nettoyage automatique.

**Intérêt.** Les tests qui vérifient l’affichage de trois API dans le tableau de bord exigent l’existence préalable de ces trois API. Avec des tableaux vides, certains tests peuvent réussir sans vérifier de données. D’autres dépendent alors de données de production.

### Couche 2 — Assertions ARIA (`aria-helpers`)

Assertions fondées sur les rôles via les localisateurs de l’arbre d’accessibilité de Playwright (`getByRole`, `aria-label`). Elles vérifient le nombre de lignes des tableaux, les valeurs des cartes de métriques, les éléments de liste et la hiérarchie des titres à travers la couche d’accessibilité.

**Intérêt.** Les tests fondés sur les sélecteurs CSS (`getByClass('card')`) deviennent fragiles lors des refontes Tailwind. Les tests fondés sur ARIA résistent aux changements visuels tout en imposant une sémantique valide. Le balisage prend ainsi en charge la navigation au lecteur d’écran.

### Couche 3 — Régression visuelle (Phase 2)

Comparaison de captures d’écran appuyée sur une convention `data-testid` pour masquer les valeurs dynamiques. Les éléments dont l’identifiant se termine par `-count`, `-timestamp` ou `-duration` sont masqués automatiquement pour éviter les faux positifs dus aux valeurs variables. L’intégration continue s’exécute sous Docker pour garantir un rendu identique au pixel près.

**Intérêt.** Les régressions de mise en page (éléments superposés, mode sombre dégradé, points de rupture de la mise en page adaptative manquants) sont invisibles pour les tests unitaires. Les images de référence les détectent automatiquement.

### Couche 4 — Contrôle d’accessibilité (Phase 2)

Intégration d’axe-core via `@axe-core/playwright`. Analyse automatisée des violations WCAG 2.1 AA sous forme de barrière qualité dans la CI. Les violations bloquent la fusion. Leur nombre est suivi dans le temps par un mécanisme de seuil progressif.

**Intérêt.** La norme EN 301 549 (Acte européen sur l’accessibilité) impose le niveau WCAG 2.1 AA pour les produits TIC. Les clients grands comptes (secteur public, banque) exigent des preuves de conformité.

---

## Compromis

| Décision | Avantage | Coût |
|----------|----------|------|
| Vrais backends de l’environnement Arena pour préparer les données | Les tests valident les contrats d’API réels | Exige des backends K8s/VPS actifs |
| Assertions centrées sur ARIA | Résistance aux changements de CSS et contrôle de la sémantique accessible | Exige des attributs `data-testid` et un balisage ARIA sur les pages |
| Docker pour la régression visuelle | Références cohérentes au pixel près entre poste local et CI | 2 à 3 minutes de CI en plus par exécution |
| axe-core comme contrôle bloquant de CI | Vérifications WCAG automatisées | Écarts initiaux à résorber |
| Report de Storybook | Évite de maintenir un catalogue de composants parallèle | Pas de test de composant isolé (couvert par vitest) |

### Alternatives envisagées

1. **Storybook + Chromatic** — Catalogue complet de composants avec tests visuels. Rejeté : charge de maintenance trop lourde pour une équipe de 2 personnes, et les composants STOA sont structurés au niveau des pages plutôt qu’en bibliothèque réutilisable.
2. **Percy (BrowserStack)** — Régression visuelle en mode SaaS. Rejeté : dépendance fournisseur, coût et sortie des données hors de l’UE.
3. **Playwright `toHaveScreenshot` seul** — Comparaison visuelle native. Retenu comme socle technique, mais complété par Docker pour la reproductibilité et par une convention de masquage pour les valeurs dynamiques.

---

## Conséquences

- **Phase 1** (décidée par cet ADR) : DataSeeder, utilitaires ARIA, convention `data-testid`, dépendance `@axe-core/playwright`. Aucune modification de la CI.
- **Phase 2** (prévue) : Images de référence pour la régression visuelle, tests de validation croisée, contrôle axe-core bloquant dans la CI.
- **En continu** : Chaque nouvelle page ou nouveau composant doit inclure des attributs `data-testid` conformes à la convention (`docs/DATA-TESTID-CONVENTION.md` dans le dépôt stoa).
- **Agents d’IA** : Peuvent vérifier eux-mêmes la validité visuelle en lançant `npx playwright test` sur des données préremplies et en comparant les instantanés ARIA.
