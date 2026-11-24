/**
 * Stepper entry — bundled to `dist/stepper.js`, exported as `@getvitops/core/stepper`, loaded as an
 * ES module.
 *
 * Its own entry rather than part of `elements.js`: `<wc-stepper>` is a plain `HTMLElement` with no
 * Lit, and `elements.js` has under 500 B of its budget left. It is tiny (~1.5 KB gzipped) and needs
 * nothing else, so it loads in either order with `<wc-config-form>` and `<wc-field>`.
 */
import '../web-components/WCStepper.js';
