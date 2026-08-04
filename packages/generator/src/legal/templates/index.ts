/**
 * The jurisdiction registry.
 *
 * Adding a jurisdiction is: author the three templates, add one key here, add
 * one member to `JURISDICTIONS` in `config.ts`. The `satisfies` below makes the
 * second and third steps a compile error if you skip either — a config could
 * otherwise name a jurisdiction with no templates behind it and silently render
 * against the wrong body of law.
 *
 * Every jurisdiction owes all three documents. A partial set would mean
 * `legal.termsOfService.enabled` silently emitting nothing.
 */
import type { Jurisdiction } from '../../config.ts';
import type { PolicyVars } from '../derive.ts';
import { cookiesCa } from './cookies.ca.ts';
import { privacyCa } from './privacy.ca.ts';
import { termsCa } from './terms.ca.ts';

export type LegalDoc = 'privacy' | 'terms' | 'cookies';

export type DocSet = Record<LegalDoc, (v: PolicyVars) => string>;

export const TEMPLATES = {
  ca: { privacy: privacyCa, terms: termsCa, cookies: cookiesCa },
} satisfies Record<Jurisdiction, DocSet>;

/** Stable output order, independent of which docs a given config enables. */
export const DOC_ORDER: LegalDoc[] = ['privacy', 'terms', 'cookies'];

/** Output filename stem per document — also the Bricks shortcode's allowlist. */
export const DOC_SLUGS: Record<LegalDoc, string> = {
  privacy: 'privacy-policy',
  terms: 'terms-of-service',
  cookies: 'cookie-notice',
};
