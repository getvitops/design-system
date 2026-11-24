/**
 * The decisions behind `<wc-turnstile>`, as pure functions (the split AGENTS.md's
 * "consent gate" section draws: a decision in a pure module, the DOM wiring thin).
 */

/** Cloudflare's explicit-render script. Must be fetched from exactly this URL (their docs). */
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * A site key is `0x` plus URL-safe characters. Anything else is refused rather than
 * passed to `turnstile.render`, so a mangled attribute fails closed (the fallback
 * message stays) instead of loading a third-party script for nothing.
 */
export function validSiteKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && /^[0-9A-Za-z_-]{8,64}$/.test(key);
}

/** Script URL with explicit rendering and the onload hook this element defines. */
export function scriptSrc(onload: string): string {
  return `${TURNSTILE_SCRIPT}?render=explicit&onload=${encodeURIComponent(onload)}`;
}

/**
 * Should a submit be held back until a token exists? Only when the widget is live
 * (JS ran, the key was valid), no token has arrived yet, and the check has not FAILED.
 * With no widget the form submits as the no-JS path always did, and the server decides.
 *
 * `failed` matters because a blocked script (an ad blocker, a CSP, a flaky network) would
 * otherwise cancel every submit forever: the visitor with JS could never send the form at all,
 * while the visitor with none could. A failed check falls back to exactly that no-JS path,
 * token-less, and `createConversionRoute`'s `turnstile.required` decides what that means.
 */
export function holdSubmit(state: { live: boolean; token: string; failed?: boolean }): boolean {
  return state.live && !state.token && !state.failed;
}
