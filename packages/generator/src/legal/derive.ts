/**
 * Site config → the facts a legal document asserts.
 *
 * The division of labour here is the whole point: **the config records facts,
 * the template owns prose.** Nothing in this module writes a sentence a lawyer
 * would need to review, and nothing in a template invents a fact. That is what
 * lets the wording be corrected without touching a consumer's config, and a
 * consumer's provider to change without touching the prose.
 *
 * Everything it returns is derived from config the site already has to hold to
 * function — which analytics ID is set, which forms exist, where it deploys —
 * plus the facts a consumer declares in `legal.privacyPolicy`. There is no
 * source of truth here beyond `SiteConfig`.
 *
 * Pure: no I/O, no clock. `lastUpdated` comes from the config rather than
 * `Date.now()` so a rebuild produces a byte-identical document.
 */
import { t } from '@getvitops/utils';
import { resolvePrivacyContact, type ContactObject, type SiteConfig } from '../site.ts';
import { resolveProcessors, type Processor } from './providers.ts';

/**
 * The facts every legal template renders from.
 *
 * List-shaped fields are `string[]`, not pre-joined strings, because they land
 * in bullet positions: a template that splices an empty string into a list emits
 * a stray `-` bullet, and that is exactly the kind of silent breakage a
 * published policy must not have.
 */
export interface PolicyVars {
  businessName: string;
  url: string;
  /** Reads after "at": "…contact our Privacy Officer at <this>." */
  mailingAddress: string;
  lastUpdated: string | undefined;
  /** Extra retention sentence, when the consumer stated one. */
  retention: string | undefined;
  /** A consumer-supplied governing-law phrase, which wins over the two below. */
  governingLaw: string | undefined;
  /** Province/territory, spelled out — "Ontario", never "ON". */
  governingProvince: string | undefined;
  governingCountry: string;

  /** Circumstances in which personal information is collected. */
  collectionReasons: string[];
  /** Categories of personal information collected. */
  piiCollected: string[];
  /** What the browser sends automatically. */
  techInfo: string[];
  /** Why that technical information is used. */
  techInfoPurposes: string[];
  /** What cookies track. */
  cookieTracked: string[];
  /** Why cookies are used. */
  cookiePurposes: string[];
  /** A sentence about the consent tool, or `undefined` when there is none. */
  cookieTool: string | undefined;
  /** How collected information is used. */
  usePurposes: string[];
  /** Choices a visitor has. */
  optOutOptions: string[];
  /** The subset of `optOutOptions` about cookies — an e-mail unsubscribe link is
   * not a cookie choice, and listing it in a cookie notice reads as padding. */
  cookieOptOutOptions: string[];

  processors: Processor[];
  /** Reads after "including": "…the United States and the European Union". */
  countries: string | undefined;
  consentModel: 'opt-in' | 'opt-out' | 'none';
  cookieCategories: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** "A", "A and B", "A, B and C". */
export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Order-preserving dedupe — the bullet lists are assembled from several sources. */
const uniq = (items: (string | undefined)[]): string[] => [
  ...new Set(items.filter((s): s is string => !!s)),
];

/**
 * Render a contact into the phrase that follows "at". Prefers e-mail (the
 * channel a reader can actually use from the page) and adds the postal address
 * when there is one, because access and correction requests are commonly posted.
 */
function formatContact(contact: ContactObject | undefined): string {
  if (!contact) return '';
  const a = contact.address;
  const postal =
    a &&
    [
      a.streetAddress,
      a.addressLocality,
      [a.addressRegion, a.postalCode].filter(Boolean).join(' '),
      a.addressCountry,
    ]
      .filter(Boolean)
      .join(', ');
  if (contact.email && postal) return `${contact.email}, or by mail at ${postal}`;
  return contact.email ?? postal ?? '';
}

/**
 * What a form field actually collects, as a noun phrase.
 *
 * Typed fields carry their meaning (`email` is an e-mail address in any form);
 * `text` does not, so it falls back to the field's name. A policy that under-
 * describes what a form collects is the failure mode worth avoiding, so an
 * unrecognised text field lands in a catch-all bullet rather than being dropped.
 */
function fieldPhrase(name: string, type: string): string | undefined {
  switch (type) {
    // `hidden` is not visitor-supplied and a honeypot exists to be left empty —
    // describing either as collected information would be inaccurate.
    case 'hidden':
      return undefined;
    case 'email':
      return 'your e-mail address';
    case 'tel':
      return 'your telephone number';
    case 'url':
      return 'any website address you provide';
    case 'date':
      return 'any dates you provide';
    case 'file':
      return 'any files or documents you upload';
    case 'textarea':
      return 'the content of the messages you send us';
    case 'number':
      return 'any numeric details you provide';
    case 'password':
      return 'account credentials';
    case 'select':
    case 'radio':
    case 'checkbox':
      return 'your answers to the questions we ask';
    default:
      break;
  }
  if (/name/i.test(name)) return 'your name';
  if (/compan|organi|business/i.test(name)) return 'your company or organization name';
  if (/address|street|city|province|state|postal|zip|country/i.test(name))
    return 'your mailing address';
  return 'the other details you enter in our forms';
}

const PROVINCES: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

/**
 * `addressRegion` is conventionally a two-letter code, which is right for a
 * postal address and wrong inside a governing-law clause — "the laws of ON" is
 * not a sentence a lawyer would sign off. Anything already spelled out (or from
 * another country) passes through untouched.
 */
function expandProvince(region: string | undefined): string | undefined {
  if (!region) return undefined;
  return PROVINCES[region.toUpperCase()] ?? region;
}

/** Every field across every `form` template, honeypots excluded. */
function formFields(site: SiteConfig): { name: string; type: string }[] {
  const out: { name: string; type: string }[] = [];
  for (const tpl of Object.values(site.templates ?? {})) {
    if (tpl.type !== 'form') continue;
    for (const f of tpl.fields ?? []) out.push({ name: f.name, type: f.type });
  }
  return out;
}

// ── Derivation ──────────────────────────────────────────────────────────────────

export function derivePolicyVars(site: SiteConfig): PolicyVars {
  const locale = site.defaultLocale;
  const org = site.organization;
  const legal = site.legal;
  const privacy = legal?.privacyPolicy;
  const processors = resolveProcessors(site);
  const fields = formFields(site);
  const hasForms = fields.length > 0;
  // Any configured provider counts, whether its config is an ID string
  // (`googleAnalyticsId`) or an object (`matomo`). Checking only for strings
  // would silently under-report a Matomo-only site as having no analytics at all.
  const hasAnalytics = Object.values(site.analytics ?? {}).some((v) =>
    typeof v === 'string' ? v.length > 0 : !!v,
  );
  const cookieProcessors = processors.filter((p) => p.cookies?.length);
  const consent = legal?.cookieConsent;
  const contact = resolvePrivacyContact(site);

  const businessName =
    org?.legalName ?? (org?.name != null ? t(org.name, locale, locale) : undefined) ?? 'we';

  const collectionReasons = uniq([
    'contact us through e-mail, telephone, mail or other correspondence',
    hasForms ? 'submit one of the forms on our Site' : undefined,
    site.services && Object.keys(site.services).length > 0
      ? 'register for a service we provide'
      : undefined,
    fields.some((f) => /newsletter|subscribe|mailing/i.test(f.name))
      ? 'register to receive our newsletter'
      : undefined,
  ]);

  // Only claim to collect what a configured form actually asks for. With no
  // forms, the generic categories stand in — the site still receives whatever a
  // visitor sends by e-mail.
  const piiCollected = uniq([
    ...(hasForms
      ? fields.map((f) => fieldPhrase(f.name, f.type))
      : [
          'your full name',
          'contact information, such as your address, telephone number, or e-mail address',
        ]),
    'any other personal information that you choose to submit to us',
  ]);

  // Session replay is a materially different disclosure from page-view analytics
  // and cannot be folded into `hasAnalytics`: a policy that lists "the pages you
  // view" while the site records mouse movement, scrolling and clicks is
  // under-disclosing, not summarising.
  const hasSessionReplay = !!site.analytics?.clarityId;

  const techInfo = uniq([
    'your domain name',
    'your numerical IP address',
    hasAnalytics ? 'the pages you view and the files you request' : undefined,
    hasAnalytics ? 'the type of browser and operating system you use' : undefined,
    hasAnalytics ? 'the address of the site that referred you' : undefined,
    hasSessionReplay
      ? 'a recording of how you interacted with a page, including mouse movement, scrolling and clicks'
      : undefined,
  ]);

  const techInfoPurposes = uniq([
    hasAnalytics ? 'measure the performance of our Site' : undefined,
    hasSessionReplay ? 'see where visitors encounter difficulty using our Site' : undefined,
    site.security?.turnstile?.siteKey
      ? 'protect our Site and its forms from automated abuse'
      : undefined,
    'better understand how visitors use our Site',
    'improve our Site to better meet your needs',
  ]);

  const ab = site.abTesting;
  const cookieTracked = uniq([
    'your IP address',
    'the type of web browser and operating system used',
    'the pages of the Site visited',
    ab?.enabled ? 'which version of a page you were shown' : undefined,
    hasSessionReplay ? 'how you moved through and interacted with a page' : undefined,
  ]);

  const cookiePurposes = uniq([
    'keep the Site functioning as you move between pages',
    hasAnalytics ? 'understand how our Site is used, in aggregate' : undefined,
    hasSessionReplay ? 'recognise a returning visit as part of the same session' : undefined,
    ab?.enabled ? 'keep you on a consistent version of the Site between visits' : undefined,
    site.security?.turnstile?.siteKey ? 'distinguish visitors from automated traffic' : undefined,
  ]);

  const cookieTool = consent?.enabled
    ? consent.type === 'opt-in'
      ? 'You may also choose which categories of cookies to allow using the consent banner shown when you first visit our Site, and you may change that choice at any time.'
      : 'You may also withdraw your consent to non-essential cookies at any time using the consent controls on our Site.'
    : undefined;

  const usePurposes = uniq([
    'respond to your inquiries',
    'supply you with requested products or services',
    site.notifications?.email
      ? 'route your message to the appropriate person in our organization'
      : undefined,
    site.tracking?.enabled ? 'measure the effectiveness of our marketing' : undefined,
    'send you informational or promotional communication',
    'carry out other purposes that are disclosed to you and to which you consent',
    'carry out any other purpose permitted or required by law',
  ]);

  const cookieOptOutOptions = uniq([
    'You may configure your browser to refuse cookies, though parts of our Site may not function as intended.',
    consent?.enabled ? cookieTool : undefined,
    ...processors
      .filter((p) => p.optOut)
      .map((p) => `You may opt out of ${p.name} directly at ${p.optOut}.`),
  ]);

  const optOutOptions = uniq([
    'You may unsubscribe from any commercial e-mail we send using the "unsubscribe" link in that e-mail.',
    ...cookieOptOutOptions,
  ]);

  const countries = list(uniq(processors.map((p) => p.country)));

  const address = contact?.address ?? org?.address;

  return {
    businessName,
    url: site.domains?.canonical ?? '',
    mailingAddress: formatContact(contact),
    lastUpdated: privacy?.lastUpdated,
    retention: privacy?.retention,
    governingLaw: legal?.termsOfService?.governingLaw,
    governingProvince: expandProvince(address?.addressRegion),
    governingCountry: address?.addressCountry ?? 'Canada',
    collectionReasons,
    piiCollected,
    techInfo,
    techInfoPurposes,
    cookieTracked,
    cookiePurposes,
    cookieTool,
    usePurposes,
    optOutOptions,
    cookieOptOutOptions,
    processors,
    countries: countries || undefined,
    consentModel: consent?.enabled ? (consent.type ?? 'opt-in') : 'none',
    cookieCategories: consent?.categories ?? [],
  };
}
