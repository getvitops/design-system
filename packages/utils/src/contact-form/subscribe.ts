/**
 * The email-list opt-in a form can carry, as pure decisions.
 *
 * Pairs with `site.campaigns` (`@getvitops/utils/campaigns`): the route subscribes a visitor only
 * when the form submits the consent field truthy and names a list. Two shapes:
 *
 *  - `checkbox`: an enquiry form with an unticked box ("Email me updates"). The tick is the
 *    consent; unticked submits nothing, which the route reads as declined.
 *  - `only`: a dedicated signup ("Join the waitlist"). Pressing its own button is the express
 *    request, so the consent field is a hidden input, and a visible statement says what the
 *    visitor is agreeing to, since CASL asks that the purpose be clear.
 *
 * The defaults for the two field names match `site.campaigns.consentField` / `listField`. A site
 * that changes them there passes the same names here; nothing reads the config at render time.
 */

export const DEFAULT_CONSENT_FIELD = 'subscribe';
export const DEFAULT_LIST_FIELD = 'list';
/** What a ticked box (or the hidden input) submits. Any non-declined value opts in. */
export const CONSENT_VALUE = 'yes';

export const DEFAULT_CHECKBOX_LABEL = 'Email me updates';
export const DEFAULT_ONLY_STATEMENT =
  'By subscribing you agree to receive emails from us. You can unsubscribe at any time.';

export interface SubscribeInput {
  /** One list key, or several separated by commas/spaces. */
  list?: unknown;
  /** The checkbox label, or for a signup-only form the consent statement. */
  label?: unknown;
  /** A dedicated signup: no checkbox, the submit button is the opt-in. */
  only?: unknown;
  consentField?: unknown;
  listField?: unknown;
}

export interface SubscribeControl {
  mode: 'checkbox' | 'only';
  /** Comma-joined, every key already safe to split on `[,\s]+`. */
  list: string;
  label: string;
  consentField: string;
  listField: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
/** Keys the route splits on commas and whitespace, so a key may carry neither. */
const SAFE_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const SAFE_FIELD = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * The opt-in a form should render, or `null` when it has none (no list named, or no usable key).
 * An unusable key is dropped rather than repaired: a silently renamed list would subscribe a
 * visitor to a different one than the editor meant.
 */
export function resolveSubscribe(input: SubscribeInput): SubscribeControl | null {
  const keys = str(input.list)
    .split(/[,\s]+/)
    .filter((k) => SAFE_KEY.test(k));
  if (keys.length === 0) return null;
  const only = input.only === true;
  const consentField = SAFE_FIELD.test(str(input.consentField))
    ? str(input.consentField)
    : DEFAULT_CONSENT_FIELD;
  const listField = SAFE_FIELD.test(str(input.listField))
    ? str(input.listField)
    : DEFAULT_LIST_FIELD;
  return {
    mode: only ? 'only' : 'checkbox',
    list: [...new Set(keys)].join(','),
    label: str(input.label) || (only ? DEFAULT_ONLY_STATEMENT : DEFAULT_CHECKBOX_LABEL),
    // The two names must differ, or one input would shadow the other.
    consentField,
    listField: listField === consentField ? DEFAULT_LIST_FIELD : listField,
  };
}

/** Names the author's own fields must steer clear of when an opt-in is rendered. */
export function subscribeReserved(control: SubscribeControl | null): string[] {
  return control ? [control.consentField, control.listField] : [];
}
