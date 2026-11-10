import type {ClientModule} from '@docusaurus/types';
import {getAnalyticsController} from './controller';

export const onRouteUpdate: ClientModule['onRouteUpdate'] = () => {
  getAnalyticsController()?.beforeRouteChange();
};

// Docusaurus calls this after the new route is mounted, including the first page.
// The controller deduplicates pathname-only changes and strips query/fragment.
export const onRouteDidUpdate: ClientModule['onRouteDidUpdate'] = ({location}) => {
  getAnalyticsController()?.routeChanged(location.pathname);
};
