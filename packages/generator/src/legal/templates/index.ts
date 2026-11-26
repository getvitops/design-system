/**
 * The jurisdiction registry.
 *
 * Adding a jurisdiction is: author the three templates, add one key here, add
 * one member to `JURISDICTIONS` in `config.ts`. The `satisfies` below makes the
 * second and third steps a compile error if you skip either — a config could
 * otherwise name a jurisdiction with no templates behind it and silently render
 * against the wrong body of law.
 *
 * Every jurisdiction owes every document. A partial set would mean
 * `legal.termsOfService.enabled` silently emitting nothing.
 */
import type { Jurisdiction } from '../../config.ts';
import type { PolicyVars } from '../derive.ts';
import { accessibilityStatement } from './accessibility.ts';
import { cookiesCa } from './cookies.ca.ts';
import { cookiesQc } from './cookies.qc.ts';
import { privacyCa } from './privacy.ca.ts';
import { privacyQc } from './privacy.qc.ts';
import { termsCa } from './terms.ca.ts';
import { termsQc } from './terms.qc.ts';

export type LegalDoc = 'privacy' | 'terms' | 'cookies' | 'accessibility';

export type DocSet = Record<LegalDoc, (v: PolicyVars) => string>;

export const TEMPLATES = {
  ca: {
    privacy: privacyCa,
    terms: termsCa,
    cookies: cookiesCa,
    accessibility: accessibilityStatement,
  },
  qc: {
    privacy: privacyQc,
    terms: termsQc,
    cookies: cookiesQc,
    accessibility: accessibilityStatement,
  },
} satisfies Record<Jurisdiction, DocSet>;

/** Stable output order, independent of which docs a given config enables. */
export const DOC_ORDER: LegalDoc[] = ['privacy', 'terms', 'cookies', 'accessibility'];

/** Output filename stem per document — also the Bricks shortcode's allowlist. */
export const DOC_SLUGS: Record<LegalDoc, string> = {
  privacy: 'privacy-policy',
  terms: 'terms-of-service',
  cookies: 'cookie-notice',
  accessibility: 'accessibility-statement',
};

/**
 * The route each document is published at by convention. This is NOT the file
 * stem: `cookies` is written to `cookie-notice.*` but belongs at `/cookies`, the
 * same way `privacy-policy.*` belongs at `/privacy`. The stems are long-form
 * filenames; the routes are the short URLs the template seed, the audit's
 * default page list and the consent banner's default link all assume.
 */
export const LEGAL_PATHS: Record<LegalDoc, string> = {
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  accessibility: '/accessibility',
};
