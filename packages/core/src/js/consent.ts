/**
 * Consent entry — bundled to `dist/consent.js`, exported as
 * `@getvitops/core/consent`, loaded as an ES module.
 *
 * A fifth entry rather than part of `elements.js`, for two reasons that pull the
 * same way:
 *
 *  - **It carries no Lit.** `elements.js` is the Lit bundle. Consent is a legal
 *    requirement, not a design flourish, and a site that needs it should not be
 *    made to download a rendering framework to comply.
 *  - **It gates everything else.** This module decides whether third-party tags
 *    run at all, so it must be free to load ahead of the deferred element bundle
 *    rather than behind it.
 *
 * Importing it has effects: it installs `window.vitopsConsent`, scans the document
 * for gated tags, and registers `<wc-consent>`.
 */
import '../web-components/WCConsent.js';

export { api as consent, CONSENT_EVENT, CONSENT_OPEN_EVENT } from '../consent/runtime.js';
export type { ConsentApi, ConsentStrategy } from '../consent/runtime.js';
export {
  CATEGORIES,
  COOKIE_NAME,
  type ConsentCategory,
  type ConsentChoices,
  type ConsentState,
} from '../consent/store.js';
