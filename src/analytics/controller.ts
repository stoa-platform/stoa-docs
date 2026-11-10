import {DOCS_GA_MEASUREMENT_ID, DOCS_CLARITY_PROJECT_ID} from './config';
import {createAnalyticsController} from './runtime';

let controller: ReturnType<typeof createAnalyticsController> | undefined;

export function getAnalyticsController() {
  if (typeof window === 'undefined') return undefined;
  if (!controller) {
    controller = createAnalyticsController(window, DOCS_GA_MEASUREMENT_ID, Date.now, DOCS_CLARITY_PROJECT_ID);
    controller.start();
  }
  return controller;
}
