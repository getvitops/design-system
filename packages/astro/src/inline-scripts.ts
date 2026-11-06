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
