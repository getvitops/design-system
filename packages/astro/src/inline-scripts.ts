/**
 * The inline scripts `<Head />` emits, as plain strings.
 *
 * They live here rather than in `Head.astro`'s frontmatter for one reason: a
 * Content-Security-Policy that doesn't allow `'unsafe-inline'` has to name each
 * inline script by SHA-256, and the hash is of the exact emitted bytes. One
 * constant imported by both the component (which emits it) and `csp.ts` (which
 * hashes it) makes "the hash matches what the page serves" true by construction
 * rather than by a test remembering to compare two copies. `csp.test.ts` and the
 * container render test still assert it against real rendered HTML.
 *
 * No imports and no Node builtins: `Head.astro` runs in a Worker for any page
 * that is rendered on demand.
 */

/**
 * Applies the remembered colour scheme before first paint.
 *
 * The key MUST match `WCColorSchemeToggle.STORAGE_KEY` in @getvitops/core;
 * `head.test.ts` asserts they stay in step. try/catch because localStorage
 * throws in private/partitioned contexts.
 */
export const THEME_SCRIPT =
  `try{var s=localStorage.getItem('vitops-color-scheme');` +
  `if(s==='light'||s==='dark'){document.documentElement.dataset.theme=s;` +
  `document.documentElement.style.colorScheme=s+' only'}}catch(e){}`;

/**
 * Applies the remembered high-contrast choice before first paint, so a visitor who turned it on
 * does not see the standard palette flash first. Absent means "follow the OS", which the stylesheet
 * already does, so nothing is written for it.
 *
 * **Separate from `THEME_SCRIPT`, and opt-in** (`<Head contrast />`, `inline: { contrast: true }`
 * in `csp.ts`): editing `THEME_SCRIPT` would change its hash and silently break the dark-mode
 * bootstrap on every site that already pins it in a Content-Security-Policy. A site that does not
 * opt in loses only this pre-paint restore, never anything it had.
 *
 * The key MUST match `CONTRAST_STORAGE_KEY` in @getvitops/core's `contrast-toggle.ts`;
 * `head.test.ts` asserts they stay in step.
 */
export const CONTRAST_SCRIPT =
  `try{var c=localStorage.getItem('vitops-contrast');` +
  `if(c==='more'||c==='standard')document.documentElement.dataset.contrast=c}catch(e){}`;

/**
 * The consent gate's build-time signal: "something on this page may need
 * permission, and the real gate hasn't loaded yet."
 *
 * `consent.js` and `elements.js` are both deferred modules with no ordering
 * guarantee between them, so `<wc-color-scheme-toggle>` can upgrade and be clicked
 * before the gate exists. Without this, a caller probing for
 * `window.vitopsConsent` in that window would see nothing, correctly conclude
 * that sites without the gate should just store — and store. The stub closes the
 * window by making the gate's *existence* known synchronously in `<head>`, which
 * is the only place that beats every deferred bundle.
 *
 * It answers `false` to everything, because nothing is granted until the store
 * has been read, and queues what it was asked so `consent/runtime.ts` can replay
 * it on evaluation. `q` entries are `[category]` for `require()` and
 * `[category, resolve]` for `request()`. Same shape as the `dataLayer`/`gtag`
 * stub in `analytics.ts` and for the same reason.
 *
 * Emitted only when the gate is on: its absence is what tells a caller the site
 * has no gate at all.
 */
export const CONSENT_STUB =
  `window.vitopsConsent=window.vitopsConsent||{q:[],` +
  `require:function(c){this.q.push([c]);return false},` +
  `request:function(c){var s=this;return new Promise(function(r){s.q.push([c,r])})},` +
  `granted:function(){return false},needed:function(){return false}};`;
