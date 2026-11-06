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
 * (JS ran, the key was valid) and no token has arrived yet. With no widget the
 * form submits as the no-JS path always did, and the server decides.
 */
export function holdSubmit(state: { live: boolean; token: string }): boolean {
  return state.live && !state.token;
}
