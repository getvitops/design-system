/**
 * Named, ordered groups of config paths: the unit a form surface reuses.
 *
 * A portal settings page renders several projections; an onboarding step lists projection ids; the
 * docs configurator renders all of them. The grouping is declared once here, so those surfaces
 * cannot arrange the same field differently by accident.
 *
 * A path names a node of `config.schema.json`. An object node renders as a fieldset of its
 * properties and a keyed map as repeatable rows. `fields` narrows which properties of such a node a
 * projection shows (the brand step edits a palette's `seed`, not its `anchors`).
 */
import type { Widget } from './describe.ts';

export interface PathItem {
  /** Dotted config path. */
  path: string;
  label?: string;
  help?: string;
  widget?: Widget;
  /** For a group or map: only these property names are shown. */
  fields?: readonly string[];
}

/** Text injected by the host (a requirements summary, a link to the theme editor). */
export interface NoticeItem {
  kind: 'notice';
  /** Matched against the `notices` the host passes to the renderer. */
  id: string;
}

export type ProjectionItem = string | PathItem | NoticeItem;

export interface Projection {
  id: string;
  title: string;
  description?: string;
  items: readonly ProjectionItem[];
}

const D = 'designSystem.themes.default';

export const PROJECTIONS: readonly Projection[] = [
  {
    id: 'organization.identity',
    title: 'Your business',
    description: 'How your business is named and described across the site and search results.',
    items: [
      'organization.name',
      'organization.legalName',
      'organization.description',
      'organization.logo',
      'organization.foundingDate',
      'organization.taxID',
      'organization.vatID',
    ],
  },
  {
    id: 'organization.contact',
    title: 'Contact details',
    items: [
      'organization.email',
      'organization.phone',
      'organization.address',
      'organization.sameAs',
      'organization.links',
    ],
  },
  {
    id: 'organization.locations',
    title: 'Locations',
    items: [
      'organization.primaryLocation',
      // Hours, photos and listings are arrays of objects; no control edits them yet.
      {
        path: 'organization.locations',
        fields: ['slug', 'name', 'email', 'phone', 'address', 'type', 'description'],
      },
    ],
  },
  {
    id: 'organization.services',
    title: 'Services',
    items: [{ path: 'organization.services', fields: ['slug', 'name', 'description'] }],
  },
  {
    id: 'brand.basics',
    title: 'Brand',
    description:
      'The colours and fonts the site is built from. Everything finer than this lives in the theme editor.',
    items: [
      { path: `${D}.colors.palette`, fields: ['seed'] },
      { path: `${D}.colors.roles`, fields: ['hue', 'kind', 'foreground'] },
      `${D}.fonts`,
      `${D}.typography.families`,
    ],
  },
  {
    id: 'brand.shape',
    title: 'Shadows and spacing',
    description: 'How raised things look and how wide and airy the layout is.',
    items: [
      { path: `${D}.shadows`, fields: ['box', 'drop'] },
      `${D}.layout.widths`,
      `${D}.layout.regionSpace`,
    ],
  },
  {
    // HOOK-UP POINT for the accessibility-requirements work (built separately). Two seams, both
    // already wired, so adding it changes no form code:
    //  1. The `accessibility.obligations` notice below renders whatever HTML a host passes as
    //     `notices['accessibility.obligations']` to `renderProjectionHtml` / `renderStepHtml`
    //     (`@getvitops/utils/forms`); until a host passes one, `DEFAULT_NOTICES` says the summary
    //     is not available. The resolver (jurisdictions + headcount -> obligations) belongs to that
    //     work; a host calls it with the draft and passes the rendered blurb in.
    //  2. New fields it introduces (headcount, sector, audience regions, ...) are added to `items`
    //     here. `forms-projection.test.ts` fails until every new `organization` / `site` key is
    //     either listed in a projection or in `UNPROJECTED` with a reason, so it cannot be missed.
    // Jurisdictions already live in the privacy step (`site.legal.jurisdiction`); read them from the
    // draft rather than asking twice.
    id: 'site.accessibility',
    title: 'Accessibility',
    items: [
      { kind: 'notice', id: 'accessibility.obligations' },
      'site.accessibility.standard',
      'site.accessibility.level',
      'site.accessibility.acceptedRisk',
    ],
  },
  {
    id: 'site.locales',
    title: 'Languages',
    items: [
      'site.defaultLocale',
      { path: 'site.locales', fields: ['name', 'tagline', 'basePath'] },
    ],
  },
  {
    id: 'site.domains',
    title: 'Website address',
    items: ['site.domains.canonical'],
  },
  {
    id: 'site.privacy',
    title: 'Privacy and legal',
    items: [
      'site.legal.jurisdiction',
      'site.legal.privacyPolicy.enabled',
      'site.legal.privacyPolicy.privacyOfficerTitle',
      'site.legal.termsOfService.enabled',
      'site.legal.cookieConsent.enabled',
      'site.legal.cookieConsent.type',
    ],
  },
  {
    id: 'site.analytics',
    title: 'Analytics',
    items: [
      'site.analytics.plausibleDomain',
      'site.analytics.googleAnalyticsId',
      'site.analytics.googleTagManagerId',
      'site.analytics.clarityId',
    ],
  },
  {
    id: 'site.notifications',
    title: 'Notifications',
    items: ['site.notifications'],
  },
  {
    id: 'site.crm',
    title: 'CRM',
    items: ['site.crm.provider'],
  },
  {
    id: 'site.ads',
    title: 'Ad platforms',
    items: ['site.ads'],
  },
];

/**
 * Top-level keys of `organization` and `site` (and `designSystem`) that no projection shows, each
 * with the reason. The generator's drift test fails when a schema key is in neither this table nor
 * a projection, which is how a field added to the config cannot silently miss every form.
 */
export const UNPROJECTED: Readonly<Record<string, string>> = {
  'organization.contact': 'A string-or-object union; the portal edits the primary location instead',
  'site.dns': 'Infrastructure; staff set it through `vitops setup`',
  'site.cloudflare': 'Infrastructure escape hatch',
  'site.google': 'Infrastructure; the GCP project is a staff concern',
  'site.searchConsole': 'Infrastructure; staff onboard domains with `vitops search setup`',
  'site.environments': 'Infrastructure; set by the toolchain per environment',
  'site.plan': 'Written by the portal at publish time from the tenant subscription',
  'site.abTesting': 'Build-time A/B split; developer-owned',
  'site.experiments': 'Needs a tuple-of-two editor and an entitlement check; the portal owns it',
  'site.fonts': 'Font loading; edited with the brand and theme editor',
  'site.tags': 'Free-form data with no stable shape to render',
  'site.postTypes': 'Free-form data with no stable shape to render',
  'site.galleries': 'Content, not configuration; edited in the CMS',
  'site.testimonials': 'Content, not configuration; edited in the CMS',
  'site.templates': 'A discriminated union of nav, form and node trees; no renderer exists',
  'site.navigation': 'Not read by any renderer yet',
  'site.chrome': 'Design-owned masthead behaviour; promoted from `dev`, not client-edited',
  'site.seo': 'Large and indexing-heavy; a later projection',
  'site.tracking': 'Attribution plumbing; developer-owned',
  'site.reviews': 'Needs Google Business Profile access first; staff-owned',
  'site.security': 'Bot protection keys; staff-owned secrets live in env, not config',
  'site.icons': 'Developer-owned icon set',
  'site.favicon': 'Generated assets; developer-owned',
  'site.deployment': 'Infrastructure; staff set the repo and branch',
};

export function projectionById(id: string): Projection | undefined {
  return PROJECTIONS.find((projection) => projection.id === id);
}

/** The config paths a projection reads, in order. Notices are not paths. */
export function pathsOf(projection: Projection): string[] {
  return projection.items.flatMap((item) => {
    if (typeof item === 'string') return [item];
    return 'kind' in item ? [] : [item.path];
  });
}
