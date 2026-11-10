import React, {useRef, useState, useSyncExternalStore} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useHistory} from '@docusaurus/router';
import useIsomorphicLayoutEffect from '@docusaurus/useIsomorphicLayoutEffect';
import {getAnalyticsController} from '../../analytics/controller';
import {installRouterGuard} from '../../analytics/runtime';
import styles from './styles.module.css';

const subscribe = (listener: () => void) => getAnalyticsController()?.subscribe(listener) ?? (() => {});
const getSnapshot = () => getAnalyticsController()?.getChoice() ?? 'unknown';
const getServerSnapshot = () => 'unknown' as const;

export default function AnalyticsConsent() {
  const {i18n} = useDocusaurusContext();
  const history = useHistory();
  useIsomorphicLayoutEffect(() => installRouterGuard(history, () => {
    getAnalyticsController()?.beforeRouteChange();
  }), [history]);
  const french = i18n.currentLocale === 'fr';
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const text = french ? {
    title: 'Cookies et confidentialité',
    description: 'Avec votre accord, nous utilisons des cookies pour mesurer les visites et comprendre la navigation afin d’améliorer le site.',
    details: 'En savoir plus',
    detailCopy: 'Google Analytics mesure les visites et les clics utiles. Microsoft Clarity fournit des replays masqués des interactions. Aucun usage publicitaire. Votre choix est conservé six mois. Vous pouvez le modifier ou le retirer à tout moment avec le bouton « Cookies ».',
    guide: 'Consulter les détails de la mesure d’audience',
    accept: 'Accepter', refuse: 'Refuser', settings: 'Cookies',
  } : {
    title: 'Cookies and privacy',
    description: 'With your permission, we use cookies to measure visits and understand navigation to improve the site.',
    details: 'Learn more',
    detailCopy: 'Google Analytics measures visits and useful clicks. Microsoft Clarity provides masked interaction replays. No advertising use. Your choice is saved for six months. You can change or withdraw it at any time using the “Cookies” button.',
    guide: 'Read the audience measurement details',
    accept: 'Accept', refuse: 'Reject', settings: 'Cookies',
  };
  const visible = choice === 'unknown' || open;

  function choose(next: 'accepted' | 'refused') {
    getAnalyticsController()?.choose(next);
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return <>
    <button ref={trigger} type="button" className={styles.trigger} onClick={() => setOpen(!open)}
      aria-expanded={visible} aria-controls="docs-audience-preferences">
      {text.settings}
    </button>
    {visible && <section id="docs-audience-preferences" className={styles.panel} aria-label={text.title}>
      <h2>{text.title}</h2>
      <p>{text.description}</p>
      <details className={styles.details}>
        <summary>{text.details}</summary>
        <p>{text.detailCopy}</p>
        <Link to={`${french ? '/fr' : ''}/docs/guides/web-analytics`}>{text.guide}</Link>
      </details>
      <div className={styles.actions}>
        <button type="button" className="button button--secondary" onClick={() => choose('refused')}>{text.refuse}</button>
        <button type="button" className="button button--secondary" onClick={() => choose('accepted')}>{text.accept}</button>
      </div>
    </section>}
  </>;
}
