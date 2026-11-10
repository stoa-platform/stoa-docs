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
    title: 'Mesure d’audience et replays',
    description: 'Avec votre accord, Google Analytics mesure les visites et Microsoft Clarity enregistre des replays masqués des interactions. Aucun usage publicitaire. Votre choix est conservé six mois.',
    details: 'Détails sur la mesure d’audience', accept: 'Autoriser', refuse: 'Refuser', settings: 'Paramètres d’audience',
  } : {
    title: 'Audience measurement and replays',
    description: 'With your permission, Google Analytics measures visits and Microsoft Clarity records masked interaction replays. No advertising use. Your choice is saved for six months.',
    details: 'Audience measurement details', accept: 'Allow', refuse: 'Decline', settings: 'Audience settings',
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
      <Link to={`${french ? '/fr' : ''}/docs/guides/web-analytics`}>{text.details}</Link>
      <div className={styles.actions}>
        <button type="button" className="button button--secondary" onClick={() => choose('refused')}>{text.refuse}</button>
        <button type="button" className="button button--secondary" onClick={() => choose('accepted')}>{text.accept}</button>
      </div>
    </section>}
  </>;
}
