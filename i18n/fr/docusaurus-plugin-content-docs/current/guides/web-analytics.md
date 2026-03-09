---
sidebar_position: 4
title: "Analytics Web"
description: "Analytics web respectueux de la vie privée pour la documentation STOA via Vercel Analytics — conforme RGPD, sans cookies."
keywords: [analytics, Vercel, privacy, GDPR, tracking]
custom_edit_url: null
---

<head>
  <meta name="robots" content="noindex, nofollow" />
</head>

# Analytics Web

Suivez les visiteurs et les pages vues de votre déploiement STOA avec Vercel Analytics.

## Vue d'Ensemble

La documentation STOA utilise [Vercel Analytics](https://vercel.com/docs/analytics) pour des analytics web respectueux de la vie privée :

- **Suivi des Visiteurs** — Compter les visiteurs uniques
- **Pages Vues** — Surveiller l'engagement sur les pages
- **Vie Privée d'Abord** — Sans cookies, conforme RGPD
- **Données en Temps Réel** — Informations instantanées

## Démarrage

Pour commencer à compter les visiteurs et les pages vues, suivez ces étapes.

### Étape 1 : Installer le Package

Installez `@vercel/analytics` dans votre projet :

```bash npm2yarn
npm i @vercel/analytics
```

### Étape 2 : Ajouter le Composant React

Importez et utilisez le composant React `<Analytics/>` dans le layout de votre application :

```tsx
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Étape 3 : Déployer et Visiter Votre Site

Déployez vos modifications et visitez le déploiement pour collecter vos pages vues.

:::tip
Si vous ne voyez pas de données après 30 secondes, vérifiez la présence de bloqueurs de contenu et essayez de naviguer entre les pages de votre site.
:::

## Consulter les Analytics

Une fois déployé, accédez à votre tableau de bord analytics à :

```
https://vercel.com/[your-team]/[your-project]/analytics
```

## Référence Complémentaire

Pour des exemples complets et une configuration avancée, consultez la [documentation Vercel Analytics](https://vercel.com/docs/analytics).

---

Besoin d'aide ? Rejoignez notre [communauté Discord](https://discord.gostoa.dev) ou consultez les [Issues GitHub](https://github.com/stoa-platform/stoa/issues).
