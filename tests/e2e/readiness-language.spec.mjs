import {expect, test} from '@playwright/test';

const english = {
  code: 'EN',
  path: '/docs/admin/installation#startup-policy-and-readiness',
  heading: 'Startup Policy and Readiness',
  navbar: 'Main',
  language: 'English',
  mobileMenu: 'Toggle navigation bar',
  mobileBack: '← Back to main menu',
  mobileLanguages: 'Languages',
};

const french = {
  code: 'FR',
  path: '/fr/docs/admin/installation#politiques-au-d%C3%A9marrage-et-readiness',
  heading: 'Politiques au Démarrage et Readiness',
  navbar: 'Principal',
  language: 'Français',
  mobileMenu: 'Ouvrir/fermer la barre de navigation',
  mobileBack: '← Retour au menu principal',
  mobileLanguages: 'Langues',
};

function readinessHeading(page, locale) {
  return page.getByRole('heading', {
    level: 3,
    name: new RegExp(`^${locale.heading}`),
  });
}

for (const [source, target] of [[english, french], [french, english]]) {
  test(`Readiness stays in view when switching ${source.code} → ${target.code}`, async ({page, isMobile}) => {
    await page.goto(source.path);
    // The language menu reads the fragment after Docusaurus hydrates.
    await expect(page.locator('html[data-has-hydrated="true"]')).toBeAttached();
    await expect(readinessHeading(page, source)).toBeInViewport({ratio: 1});

    const navbar = page.getByRole('navigation', {name: source.navbar, exact: true});
    if (isMobile) {
      await navbar.getByRole('button', {name: source.mobileMenu, exact: true}).click();
      await navbar.getByRole('button', {name: source.mobileBack, exact: true}).click();
      await navbar.getByRole('button', {name: source.mobileLanguages, exact: true}).click();
    } else {
      await navbar.getByRole('button', {name: source.language, exact: true}).click();
    }

    await navbar.getByRole('link', {name: target.language, exact: true}).click();
    await expect(page).toHaveURL(target.path);
    await expect(readinessHeading(page, target)).toBeInViewport({ratio: 1});
  });
}
