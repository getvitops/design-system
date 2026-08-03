/**
 * @getvitops/astro — the Astro integration. One entry wires the design system's
 * `<head>` contributions into a consumer site:
 *   - favicons + PWA manifest (generated into public/),
 *   - the web-component runtime bundles (copied into public/vitops/),
 *   - (opt-in) the design-system CSS, generated + auto-injected (no manual import).
 * The `<Head />` component (shipped alongside) renders the tags, reading resolved
 * config from the `virtual:getvitops/head` module this integration provides.
 */
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LegalOutput, SiteFont, StylesheetFormat } from '@getvitops/generator';
import { isSiteConfig, resolveSiteConfig } from '@getvitops/generator';
import {
  type FaviconLink,
  collectIconRefs,
  faviconLinks,
  generateFavicons,
  generateIconInclude,
  resolveIcon,
  scanFiles,
  writeFaviconManifest,
} from '@getvitops/utils';
import vitops from '@getvitops/vite';
import type { AstroIntegration } from 'astro';
import {
  consentCategories,
  type GetvitopsAnalyticsOptions,
  type GetvitopsConsentOptions,
  type OptionalConsentCategory,
  resolveAnalytics,
} from './analytics.ts';
import { type HeadFont, resolveFonts } from './fonts.ts';
import type { GetvitopsSeoOptions } from './seo.ts';

export interface GetvitopsFaviconOptions {
  /** Source SVG or PNG. */
  source: string;
  lowResSource?: string;
  /** App name → enables `site.webmanifest`. */
  name?: string;
  /** PWA theme color (also `<meta name="theme-color">`). */
  themeColor?: string;
  backgroundColor?: string;
}

export interface GetvitopsCssOptions {
  /**
   * Path to the config (default `'design-system.json'`).
   *
   * May be a `design-system.json` **or** the larger site config that embeds one
   * (`company.json` / `site.json`) — they are told apart by shape. Pointing this
   * at a site config makes the top-level `site` option redundant and lets
   * `legal` and `fonts` default their own `input` to it, so the path is declared
   * once.
   */
  input?: string;
  /**
   * Which `designSystem.themes` entry to build, when `input` is a site config.
   * Default: the config's `defaultTheme`, else `default`.
   */
  theme?: string;
  /**
   * Output format (default 'tailwind'). Narrower than the generator's `Format`
   * on purpose: this option exists to produce a stylesheet to inject, and the
   * `design` format emits only `DESIGN.md`. Run that one via the CLI
   * (`vitops generate --format design --out .`).
   */
  format?: StylesheetFormat;
  /** Directory the generated CSS is written to (default 'src/styles'). */
  out?: string;
  /**
   * Auto-inject the generated stylesheet into every SSR page (default true).
   * Set false when other integrations add routes that must not inherit the
   * design system (e.g. EmDash's `/_emdash/admin`) — then import the generated
   * file (`<out>/tailwind.css` or `<out>/styles.css`) from your site layout so
   * only your own pages (and previews rendered through them) are styled.
   */
  inject?: boolean;
  /**
   * Also flip to dark when the visitor's OS asks and they have made no explicit
   * choice — `@media (prefers-color-scheme: dark)`.
   *
   * Off by default: turning it on flips the site dark for dark-OS visitors, which
   * is a visible change to an existing site. Turning it **on** is what makes
   * `<color-scheme-toggle>`'s "System" position do anything (System removes the
   * theme attribute, so without this block it falls through to light), and it is
   * the only way a no-JS page gets the OS appearance at all.
   *
   * The site config's `designSystem.defaultColorScheme: "system"` says the same thing and is the
   * better home for it when you have one — this option wins if both are set, and
   * exists because requiring a whole `SiteConfig` to set one boolean would be out
   * of proportion.
   */
  systemColorScheme?: boolean;
}

export interface GetvitopsSiteOptions {
  /** Path to the site config (JSON). */
  input: string;
  /** Environment whose A/B variant applies (default 'production'). */
  siteEnv?: string;
}

export interface GetvitopsLegalOptions {
  /**
   * Path to the site config (JSON) the documents are rendered from. Optional
   * when the top-level `site` option is set — it defaults to that file, since
   * they are almost always the same one.
   */
  input?: string;
  /**
   * Where to write them (default 'src/content/legal'). The default is a content
   * collection: the documents are markdown, and a collection is what lets a page
   * render one through your own layout rather than the integration injecting a
   * route (which nothing in this package does).
   */
  out?: string;
  /** Output format (default 'md'). */
  format?: LegalOutput;
  /** Environment whose A/B variant applies (default 'production'). */
  siteEnv?: string;
}

/** `changefreq`, mirroring @astrojs/sitemap's `ChangeFreq`. */
export type GetvitopsSitemapChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

/** One sitemap entry, mirroring @astrojs/sitemap's `SitemapItem`. */
export interface GetvitopsSitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: GetvitopsSitemapChangeFreq;
  priority?: number;
  /** Alternate-language variants. `lang` is required, as upstream requires it. */
  links?: { lang: string; hreflang?: string; url: string }[];
}

/**
 * Forwarded verbatim to `@astrojs/sitemap`. Deliberately a hand-written subset of
 * its `SitemapOptions` rather than a re-export: aliasing would put an
 * `import … from '@astrojs/sitemap'` — and, transitively via `SitemapItem`, from
 * `sitemap` — into this package's published .d.mts, which cannot resolve for the
 * consumers who don't install the optional peer. Worse, `skipLibCheck` (on by
 * default via astro's base tsconfig) *suppresses* that error, silently degrading
 * the option to `any` instead of failing loudly.
 *
 * Need something not listed here (e.g. `chunks`)? Add `sitemap()` to your own
 * `integrations` array — getvitops detects it and leaves yours in charge.
 */
export interface GetvitopsSitemapOptions {
  /** Keep a page out of the sitemap. Receives the page's full absolute URL. */
  filter?: (page: string) => boolean;
  /** Absolute URLs of pages Astro doesn't build but the site serves. */
  customPages?: string[];
  /** Absolute URLs of externally-generated sitemaps to list in the index. */
  customSitemaps?: string[];
  /** Max entries per file before it splits (default 45000). */
  entryLimit?: number;
  /** Filename prefix (default 'sitemap' → `sitemap-index.xml`). */
  filenameBase?: string;
  changefreq?: GetvitopsSitemapChangeFreq;
  lastmod?: Date;
  priority?: number;
  /** Per-entry rewrite; return `undefined` to drop the entry. */
  serialize?: (
    item: GetvitopsSitemapEntry,
  ) => GetvitopsSitemapEntry | Promise<GetvitopsSitemapEntry | undefined> | undefined;
  /** Emit `<xhtml:link rel="alternate">` for localised routes. */
  i18n?: { defaultLocale: string; locales: Record<string, string> };
  /** XSL stylesheet to prettify the XML (path relative to `site`, or absolute URL). */
  xslURL?: string;
  /** XML namespaces to exclude (all included by default). */
  namespaces?: { news?: boolean; xhtml?: boolean; image?: boolean; video?: boolean };
}

export interface GetvitopsOptions {
  /**
   * Your site config — the one place to name it.
   *
   * A `SiteConfig` records site-level facts, several of which other options here
   * need: `designSystem.defaultColorScheme` decides whether the generated colour layer
   * carries a `prefers-color-scheme` block, `fonts` can supply the webfont
   * declarations, and `legal` renders from it. Set this and each of those reads
   * it, rather than repeating the path per feature. Every one can still be given
   * explicitly, which wins.
   *
   * Needs `css`, since the generation runs in the Vite plugin `css` registers.
   */
  site?: GetvitopsSiteOptions;
  favicon?: GetvitopsFaviconOptions;
  /** Copy + link the web-component bundles (default true). */
  webComponents?: boolean;
  /** Generate + auto-inject the design-system CSS. Off unless provided. */
  css?: GetvitopsCssOptions;
  /**
   * Ship the live theme editor (default false).
   *
   * Copies `editor.js` into `public/vitops/`, loads it from `<Head />`, and mirrors
   * the generated `design-manifest.json` next to it so `<wc-theme-editor>` resolves
   * its default `/vitops/design-manifest.json`. Requires `css` (the manifest is a
   * `css`-format output) — place the `<wc-theme-editor>` tag in your layout yourself.
   *
   * Editing is live on any deploy; **saving back** to `design-system.json` needs the
   * dev server, so on a static build that button simply isn't rendered.
   */
  editor?: boolean;
  /**
   * Render the site's legal documents (privacy policy, terms, cookie notice)
   * from a site config, and re-render when it changes. Off unless provided.
   *
   * Requires `css`, which is what registers the Vite plugin that runs the
   * generation — without it the documents would be written once and never
   * refresh. Not using `css`? Run `vitops legal` from the CLI instead; it is the
   * same renderer and works in any stack.
   */
  legal?: GetvitopsLegalOptions;
  /**
   * Load webfonts through Astro's Fonts API and emit `<Font />` for each from
   * `<Head />`. Off unless provided.
   *
   * This is the seam the design system deliberately lacks. `design-system.json`'s
   * `fonts` block holds **stacks only** — `--font-<name>` tokens and nothing else: no
   * `@font-face`, no preload, no metrics-matched fallback. Declaring the family here
   * makes the token resolvable *and* loaded, so the token keeps pointing at a
   * `cssVariable` rather than at a literal stack the browser has no file for:
   *
   * ```js
   * getvitops({ fonts: [{ name: 'League Spartan', provider: 'fontsource',
   *                       cssVariable: '--font-league-spartan',
   *                       weights: ['100 900'], subsets: ['latin'], preload: true }] })
   * ```
   * ```jsonc
   * // design-system.json
   * "fonts": { "display": "var(--font-league-spartan), sans-serif" }
   * ```
   *
   * Pass a **string** instead to read the array from a site config's `fonts` block —
   * the same declarations, kept next to the rest of the site's facts. (`siteEnv`
   * picks the A/B variant, as in `legal`.) With the top-level `site` option set,
   * plain `true` does the same thing without repeating the path.
   *
   * Independent of `css`: the loading runs in `astro:config:setup`, not in the Vite
   * plugin. Both `<Head />` and the config entry are required — Astro's `fonts:`
   * config resolves the files, and `<Font />` is what puts the `@font-face` on the
   * page — so a declaration without `<Head />` in your layout loads nothing.
   */
  fonts?: boolean | string | SiteFont[] | GetvitopsFontsOptions;
  /**
   * Emit `sitemap-index.xml` + `sitemap-0.xml` via `@astrojs/sitemap`, and link it
   * from `<Head />`. Off unless provided; `true` uses its defaults.
   *
   * Needs `@astrojs/sitemap` (an optional peer — install it yourself) and the
   * `site` astro.config option, since a sitemap lists absolute URLs.
   *
   * Skipped with a warning when `emdash()` is registered — EmDash serves its own
   * database-driven `/sitemap.xml` — and deferred to when you already list
   * `@astrojs/sitemap` yourself. Note it enumerates **prerendered** routes only,
   * so on-demand pages of an `output: 'server'` site are not listed.
   */
  sitemap?: boolean | GetvitopsSitemapOptions;
  /**
   * Site-level defaults for `<Seo />` (`@getvitops/astro/Seo.astro`) — site name,
   * title template, Open Graph + Twitter defaults, verification tokens. Off unless
   * provided; per-page props override every field.
   *
   * Needs the `site` astro.config option for canonical and `og:url`; without it
   * `<Seo />` omits every absolute-URL tag rather than deriving one from the
   * request, and this warns at build time.
   *
   * On an EmDash site prefer `<EmDashHead>`, which covers the same tags from the
   * CMS — using both double-emits them.
   */
  seo?: GetvitopsSeoOptions;
  /**
   * Resolve semantic icon names centrally and, on a server build, derive which
   * icons to bundle by scanning your source. Off unless provided; `true` uses
   * the defaults below.
   *
   * Two separate jobs, and it is worth knowing which one you are buying:
   *
   * 1. **Naming.** `<Icon name="menu" />` resolves through the semantic map, so
   *    the icon set is a config value rather than something spelled out at every
   *    call site. A name containing `:` passes through untouched — that is the
   *    escape hatch for a set-specific glyph.
   * 2. **Bundle size.** astro-icon is zero-config on a static build, but under
   *    `output: 'server'` it bundles EVERY icon in a set unless given an
   *    `include` map. That is the list consumers end up hand-maintaining. Here it
   *    is derived by scanning `scan` for icon references, merged with anything
   *    you declare. On a static build no `include` is passed at all, because
   *    there is nothing to trim.
   *
   * Names the scanner cannot read statically (`<Icon name={expr} />`) are
   * reported with file and line, not guessed at — declare them in `include`.
   */
  icons?: boolean | GetvitopsIconsOptions;
  /**
   * Analytics tags for `<Analytics />` — Google Analytics, Microsoft Clarity,
   * Matomo, Plausible. Off unless provided.
   *
   * Every tag loads off the critical path (`strategy`, default `'idle'`: after
   * `load`, on an idle callback) and, when it sets cookies, only after consent.
   *
   * Which consent category a provider needs is derived from whether it sets
   * cookies, not declared — so configuring a cookie-setting provider without
   * `consent` warns rather than silently tracking everyone.
   */
  analytics?: GetvitopsAnalyticsOptions;
  /**
   * The consent gate: `@getvitops/core/consent` + `<CookieConsent />`. Off unless
   * provided; `true` uses its defaults.
   *
   * A sibling of `analytics`, not part of it. The gate is general — anything
   * marked `data-consent="<category>"` waits on the same choice, so A/B
   * assignment, personalisation and third-party embeds use it too, and a site can
   * enable it with no analytics configured at all.
   *
   * Pair it with `legal` so the cookie notice describes the categories this
   * actually offers.
   */
  consent?: boolean | GetvitopsConsentOptions;
}

export interface GetvitopsFontsOptions {
  /** Path to a site config (JSON) whose `fonts` array holds the declarations. */
  input?: string;
  /** Declarations written inline; merged after anything `input` supplies. */
  families?: SiteFont[];
  /** Environment whose A/B variant applies to `input` (default 'production'). */
  siteEnv?: string;
}

export interface GetvitopsIconsOptions {
  /** Icon set for UI chrome. Default `'fa7-solid'`. */
  ui?: string;
  /** Icon set for brand marks. Default `'simple-icons'`. */
  brand?: string;
  /**
   * Weight for suffix-weighted sets like Phosphor (`'bold'`, `'fill'`, …).
   * Ignored by sets that split weights across collections, e.g. Font Awesome.
   */
  weight?: string;
  /**
   * Icons to bundle, in `generateIconInclude`'s shape:
   * `{ semantic: ['menu'], 'simple-icons': ['zoho'] }`.
   *
   * Merged with what the scan finds. Declared names that don't resolve **throw**
   * (a config error); scanned names that don't resolve only **warn** (a source
   * typo shouldn't kill the dev server).
   */
  include?: Parameters<typeof generateIconInclude>[0];
  /**
   * How `<Icon />` draws the glyph.
   *
   * `'inline'` (default) reads it from the `@iconify-json/*` collection and
   * inlines the `<svg>` — no runtime request, no icon-integration peer.
   * `'sprite'` emits `<use href="…/icons.svg#id">` instead, for pages served
   * where the sprite is already on the origin.
   *
   * Note this is separate from `register`: whether astro-icon is registered for
   * YOUR OWN `<Icon>` usage is a different question from how ours renders.
   */
  engine?: 'inline' | 'sprite';
  /**
   * Register the icon integration for you (default true). Set false when you
   * already list `icon()` in `integrations` yourself — the scan, the sprite and
   * the resolver still run either way.
   */
  register?: boolean;
  /** Directories to scan, relative to the project root. Default `['src']`; `false` disables. */
  scan?: string[] | false;
  /** Public href of the sprite, for the `'sprite'` engine. Default `'/vitops/icons.svg'`. */
  sprite?: string;
  /** Aliases applied before the semantic map — legacy names, or values stored in CMS content. */
  overrides?: Record<string, string>;
}

/**
 * Serialised into the virtual module with `JSON.stringify`, so every field here
 * must be JSON-representable — no functions. (That is why the sitemap's *href*
 * lives here and its options, which carry `filter`/`serialize`, do not.)
 */
interface HeadData {
  favicons: boolean;
  faviconLinks: FaviconLink[];
  themeColor: string | null;
  webComponents: boolean;
  wcBase: string;
  editor: boolean;
  /** `<link rel="sitemap">` target, or null when no sitemap was registered. */
  sitemap: string | null;
  /**
   * Families registered by `getvitops({ fonts })`, for `<Font />`. Only ours: a
   * `cssVariable` Astro cannot resolve makes `<Font />` throw, so this must never
   * include a family declared elsewhere (a user-level `fonts:`, or EmDash's).
   */
  fonts: HeadFont[];
  /** `config.site`, so `<Seo />` has a canonical base even without `Astro.site`. */
  site: string | null;
  /** Site-level `<Seo />` defaults. Function-free, hence serialisable. */
  seo: GetvitopsSeoOptions;
  /** `<Analytics />` providers. IDs and flags only — function-free. */
  analytics: GetvitopsAnalyticsOptions;
  /** Is the consent gate active? Decides whether tags are gated at all. */
  consent: boolean;
  /** Categories `<CookieConsent />` offers unless a page overrides them. */
  consentCategories: OptionalConsentCategory[];
  /** Cookie-notice URL for the banner, or null. */
  consentPolicyUrl: string | null;
  /** Does `<Head />` need to load `consent.js`? (gate enabled, or a tag needs scheduling) */
  consentRuntime: boolean;
}

/**
 * Which providers `getvitops({ analytics })` configures that the site config's
 * own `analytics` block does not.
 *
 * The two are separate surfaces on purpose — the integration must not import
 * `SiteConfig` — but they describe the same site, and a disagreement between them
 * is a compliance defect rather than a style issue: `vitops legal` derives the
 * cookie notice from the site config, so a provider missing there is a tag the
 * site runs and its own notice never mentions. That is precisely what the
 * generator's processor table exists to prevent.
 *
 * Read is best-effort — the `legal` step already reports an unreadable config,
 * and a second copy of that error helps nobody.
 */
const SITE_CONFIG_KEYS: Record<string, string> = {
  googleAnalytics: 'googleAnalyticsId',
  clarity: 'clarityId',
  matomo: 'matomo',
  plausible: 'plausibleDomain',
};

function undisclosedProviders(configPath: string, analytics: GetvitopsAnalyticsOptions): string[] {
  let declared: Record<string, unknown>;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { analytics?: unknown };
    declared = (parsed.analytics ?? {}) as Record<string, unknown>;
  } catch {
    return [];
  }
  return Object.keys(SITE_CONFIG_KEYS).filter(
    (key) =>
      analytics[key as keyof GetvitopsAnalyticsOptions] !== undefined &&
      !declared[SITE_CONFIG_KEYS[key] as string],
  );
}

const VIRTUAL_ID = 'virtual:getvitops/head';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

function virtualHeadPlugin(data: HeadData) {
  return {
    name: '@getvitops/astro:virtual-head',
    resolveId(id: string) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id: string) {
      return id === RESOLVED_ID ? `export default ${JSON.stringify(data)};` : null;
    },
  };
}

/**
 * What `<Icon />` needs to resolve a name at render time.
 *
 * JSON only, same rule as `HeadData` — which is precisely why there is no
 * `resolver` field. `resolveIcon` is a pure function in `@getvitops/utils` that
 * the component imports statically; what varies per site is the *data* it takes.
 */
interface IconsData {
  engine: 'inline' | 'sprite' | 'none';
  /**
   * Absolute project root, for resolving `@iconify-json/*`.
   *
   * Explicit rather than `process.cwd()`: the collections are a dependency of
   * the SITE, and the cwd is wherever the process happened to start — a task
   * runner invoking astro from a monorepo root resolves nothing and every icon
   * renders as an empty box, with no error to explain it.
   */
  root: string;
  ui: string;
  brand: string;
  weight: string | null;
  overrides: Record<string, string>;
  sprite: string | null;
}

const ICONS_ID = 'virtual:getvitops/icons';
const RESOLVED_ICONS_ID = `\0${ICONS_ID}`;

function virtualIconsPlugin(data: IconsData) {
  return {
    name: '@getvitops/astro:virtual-icons',
    resolveId(id: string) {
      return id === ICONS_ID ? RESOLVED_ICONS_ID : null;
    },
    load(id: string) {
      return id === RESOLVED_ICONS_ID ? `export default ${JSON.stringify(data)};` : null;
    },
  };
}

/** Defaults live here so the component and the integration can't drift. */
const ICON_DEFAULTS = {
  ui: 'fa7-solid',
  brand: 'simple-icons',
  sprite: '/vitops/icons.svg',
  scan: ['src'],
} as const;

/**
 * Probe an optional icon integration so it can be registered for the consumer's
 * OWN `<Icon>` usage. Nothing here decides how our `<Icon />` renders — that is
 * `engine`, and it never needs a peer.
 */
/**
 * Indirection so the bundler can't resolve the specifier statically. See the
 * import site in the `tailwind` branch for why that matters.
 */
const TAILWIND_VITE = '@tailwindcss/vite';

async function probeIconPackage(name: 'astro-icon' | 'astro-iconset'): Promise<boolean> {
  try {
    await import(/* @vite-ignore */ name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Does the file at `path` hold a site config rather than a bare design system?
 *
 * Swallows a missing or unparseable file and answers `false`: this only decides
 * whether the other options may default their paths to this one, and the real
 * read happens in the Vite plugin, which reports a parse error properly. Failing
 * the build here would turn "your JSON has a trailing comma" into an error about
 * an option the consumer never set.
 */
function readsAsSiteConfig(path: string): boolean {
  try {
    return isSiteConfig(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return false;
  }
}

export default function getvitops(opts: GetvitopsOptions = {}): AstroIntegration {
  return {
    name: '@getvitops/astro',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript, logger }) => {
        const root = fileURLToPath(config.root);
        const publicDir = fileURLToPath(config.publicDir);
        const webComponents = opts.webComponents !== false;
        const editor = opts.editor === true;
        if (editor && !opts.css)
          logger.warn('editor: true needs a `css` config — it reads design-manifest.json.');
        if (opts.legal && !opts.css)
          logger.warn(
            'legal: needs a `css` config — the generation runs in the Vite plugin that `css` ' +
              'registers. Run `npx vitops legal` instead if you do not use `css`.',
          );
        // Where the site config is, if there is one. `css.input` counts when it
        // is itself a site config — that is the common setup once a consumer
        // keeps their tokens inside `company.json`, and making every option
        // repeat the path is exactly the friction this is meant to remove.
        // The effective path, default included, so the answer matches what the
        // Vite plugin will actually read rather than only covering the case
        // where the option was written out.
        const cssInput = opts.css ? (opts.css.input ?? 'design-system.json') : undefined;
        const siteInput =
          opts.site?.input ??
          (cssInput != null && readsAsSiteConfig(resolve(root, cssInput)) ? cssInput : undefined);
        if (opts.site && !opts.css)
          logger.warn(
            'site: needs a `css` config — it is read during generation, which runs in the Vite ' +
              'plugin that `css` registers. Without it the site config changes nothing here.',
          );
        // `legal` only needs its own `input` when it points somewhere other than
        // the site config; the two are almost always the same file.
        const legalInput = opts.legal?.input ?? siteInput;
        if (opts.legal && !legalInput)
          throw new Error(
            '[getvitops] legal: needs `legal.input` (a site config path), the top-level `site` ' +
              'option, or a `css.input` that is itself a site config.',
          );
        if (opts.seo) {
          // Warn once here rather than letting every page silently drop its
          // canonical — a missing absolute URL is invisible in the output.
          if (!config.site)
            logger.warn(
              'seo: needs the `site` astro.config option (your deployed URL) — without it <Seo /> ' +
                'omits canonical, og:url and any relative og:image rather than guessing an origin.',
            );
          if (config.integrations.some((i) => i.name === 'emdash'))
            logger.warn(
              'seo: emdash() is registered, and its <EmDashHead> emits the same title/description/' +
                'canonical/og tags from the CMS. Use one or the other — rendering both duplicates ' +
                'every tag.',
            );
        }
        // Analytics + consent are resolved here rather than in the component:
        // resolveAnalytics is pure, its warnings belong beside the others, and
        // step 2 needs to know whether the consent bundle has to be copied.
        const consentEnabled = !!opts.consent;
        const consentOpts: GetvitopsConsentOptions =
          typeof opts.consent === 'object' ? opts.consent : {};
        const analytics = resolveAnalytics(opts.analytics, { consent: consentEnabled });
        // Fall back to `analytics` rather than an empty list: the gate is general,
        // so a site may be gating an A/B split or an embed we cannot see from
        // here, and a banner offering no choices is useless.
        const detectedCategories = consentCategories(analytics.tags);
        const offeredCategories: OptionalConsentCategory[] =
          consentOpts.categories ??
          (detectedCategories.length ? detectedCategories : ['analytics']);
        for (const warning of analytics.warnings) logger.warn(warning);

        // `legalInput`, not `opts.legal.input` — the path is now a cascade
        // (explicit legal input → `site.input` → a `css.input` that reads as a
        // site config), so a consumer who declares `legal: {}` and lets it fall
        // through still gets the disclosure check rather than skipping it.
        if (opts.analytics && legalInput) {
          const undisclosed = undisclosedProviders(resolve(root, legalInput), opts.analytics);
          if (undisclosed.length)
            logger.warn(
              `analytics: ${undisclosed.join(', ')} ${undisclosed.length === 1 ? 'is' : 'are'} ` +
                "configured here but absent from your site config's `analytics` block, so the " +
                'cookie notice `legal` generates will not disclose ' +
                `${undisclosed.length === 1 ? 'it' : 'them'}. Add ` +
                `${undisclosed.map((k) => SITE_CONFIG_KEYS[k]).join(', ')} to ${legalInput}.`,
            );
        }

        const hasManifest = !!(opts.favicon?.name && opts.favicon?.themeColor);
        let hasSvg = false;

        // 1. Favicons + manifest → public/
        if (opts.favicon) {
          const source = resolve(root, opts.favicon.source);
          hasSvg = source.endsWith('.svg');
          await generateFavicons({
            source,
            outputDir: publicDir,
            ...(opts.favicon.lowResSource
              ? { lowResSource: resolve(root, opts.favicon.lowResSource) }
              : {}),
            // Also the manifest's `background_color`. The maskable outputs are
            // composited onto it, so the raster and the manifest agree.
            ...(opts.favicon.backgroundColor
              ? { backgroundColor: opts.favicon.backgroundColor }
              : {}),
          });
          if (opts.favicon.name && opts.favicon.themeColor) {
            await writeFaviconManifest(publicDir, {
              name: opts.favicon.name,
              themeColor: opts.favicon.themeColor,
              ...(opts.favicon.backgroundColor
                ? { backgroundColor: opts.favicon.backgroundColor }
                : {}),
            });
          }
          logger.info('generated favicons + manifest → public/');
        }

        // 1b. Webfonts → Astro's `fonts:` config (+ <Font /> data for <Head />)
        let headFonts: HeadFont[] = [];
        if (opts.fonts) {
          const given: GetvitopsFontsOptions = Array.isArray(opts.fonts)
            ? { families: opts.fonts }
            : typeof opts.fonts === 'string'
              ? { input: opts.fonts }
              : opts.fonts === true
                ? {}
                : opts.fonts;
          // `fonts: true` (or an options object with no `input`) reads the site
          // config's own `fonts` array — one place to declare a family, next to
          // the rest of the site's facts. That config is wherever it is: the
          // `site` option, or `css.input` when it is one.
          const o: GetvitopsFontsOptions = {
            ...given,
            ...(given.input == null && given.families == null && siteInput
              ? { input: siteInput, ...(opts.site?.siteEnv ? { siteEnv: opts.site.siteEnv } : {}) }
              : {}),
          };
          const declared: SiteFont[] = [];
          if (o.input) {
            // resolveSiteConfig validates and throws with field paths, so a typo'd
            // provider fails the build here rather than resolving to a fallback stack.
            const site = resolveSiteConfig(
              JSON.parse(readFileSync(resolve(root, o.input), 'utf8')),
              o.siteEnv ?? 'production',
            );
            declared.push(...(site.fonts ?? []));
          }
          declared.push(...(o.families ?? []));

          if (declared.length === 0) {
            logger.warn(
              'fonts: nothing declared — no webfonts will load. Add families, or drop the option.',
            );
          } else {
            // A user-level `fonts:` is already on `config` here; another integration's
            // is not (its updateConfig may not have run yet). Astro concatenates the
            // arrays, and two entries on one variable means the last wins silently —
            // so flag the half we can actually see.
            const existing = new Set(
              ((config as { fonts?: { cssVariable?: string }[] }).fonts ?? []).map(
                (f) => f.cssVariable,
              ),
            );
            const { fonts, head } = resolveFonts(declared);
            for (const f of head)
              if (existing.has(f.cssVariable))
                logger.warn(
                  `fonts: ${f.cssVariable} is already declared in your astro.config \`fonts\` ` +
                    'array. Astro resolves one family per variable, so one of the two will be ' +
                    'dropped — remove it from one place.',
                );
            updateConfig({ fonts });
            headFonts = head;
            const preloaded = head.filter((f) => f.preload !== false).length;
            logger.info(
              `fonts: ${fonts.length} famil${fonts.length === 1 ? 'y' : 'ies'} registered ` +
                `via Astro's Fonts API (${preloaded} preloaded) — <Head /> emits <Font /> for each`,
            );
          }
        }

        // 2. Web-component bundles → public/vitops/
        //
        // `consent.js` is copied independently of `webComponents`: the gate is
        // what decides whether third-party tags run, so a site that turned the
        // element runtime off and still asked for consent must not silently lose
        // it — that failure mode is tags loading for everyone.
        const consentRuntime = consentEnabled || analytics.needsRuntime;
        if (webComponents || consentRuntime) {
          const corePkg = fileURLToPath(import.meta.resolve('@getvitops/core/package.json'));
          const coreDist = join(dirname(corePkg), 'dist');
          const dest = join(publicDir, 'vitops');
          if (existsSync(coreDist)) {
            const bundles = webComponents
              ? ['polyfills.js', 'deferred.js', 'elements.js', 'polyfills']
              : [];
            if (consentRuntime) bundles.push('consent.js');
            if (editor) bundles.push('editor.js');
            for (const f of bundles) {
              const src = join(coreDist, f);
              if (existsSync(src)) cpSync(src, join(dest, f), { recursive: true });
            }
            logger.info('copied web-component bundles → public/vitops/');
          } else {
            logger.warn(
              `@getvitops/core dist not found (${coreDist}); run build:core. Skipping WC copy.`,
            );
          }
        }

        // 3. Sitemap — opt-in, delegated to the official @astrojs/sitemap.
        //
        // Registered through updateConfig rather than imported at module scope,
        // because the package is an optional peer. Astro core has no
        // addIntegration() (that is Starlight's plugin API), but appending here is
        // supported: runHookConfigSetup re-reads `integrations.length` each
        // iteration and assigns the merged array back onto the settings, and
        // @astrojs/sitemap declares no `astro:config:setup` hook at all — only
        // config:done / routes:resolved / build:done, which all run afterwards.
        //
        // Runs before the virtual head module so <Head /> can link the result.
        let sitemapHref: string | null = null;
        if (opts.sitemap) {
          const registered = config.integrations.map((i) => i.name);
          if (registered.includes('@astrojs/sitemap')) {
            logger.info(
              'sitemap: @astrojs/sitemap is already in your integrations — leaving yours in charge.',
            );
          } else if (registered.includes('emdash')) {
            logger.warn(
              'sitemap: emdash() already serves /sitemap.xml from the database, which also covers ' +
                'on-demand pages a static sitemap cannot. Skipping — drop the `sitemap` option, or ' +
                'add @astrojs/sitemap to `integrations` yourself to run both.',
            );
          } else if (!config.site) {
            logger.warn(
              'sitemap: needs the `site` astro.config option (your deployed URL) — a sitemap lists ' +
                'absolute URLs. Skipping.',
            );
          } else {
            // Optional peer, loaded the same way as @tailwindcss/vite below.
            //
            // The import is cast because the option surface here is this package's
            // narrowed mirror, not @astrojs/sitemap's own `SitemapOptions`: the two
            // disagree on `serialize`'s entry type (upstream's `changefreq` is the
            // `EnumChangefreq` enum, ours the string union a consumer actually
            // wants to write). The shapes are identical at runtime — the value is
            // forwarded verbatim. Cast the module rather than widening the local to
            // `(o?: unknown)`, which is the wrong variance: a target accepting
            // `unknown` promises to accept *any* argument, which upstream doesn't.
            type SitemapFactory = (o?: GetvitopsSitemapOptions) => AstroIntegration;
            let sitemap: SitemapFactory;
            try {
              ({ default: sitemap } = (await import('@astrojs/sitemap')) as unknown as {
                default: SitemapFactory;
              });
            } catch {
              throw new Error(
                '[getvitops] sitemap requires `@astrojs/sitemap` in your devDependencies — ' +
                  'install it, or drop the `sitemap` option.',
              );
            }
            if (config.output === 'server')
              logger.warn(
                "sitemap: output: 'server' — @astrojs/sitemap lists prerendered routes only, so " +
                  'on-demand pages are left out. Add `export const prerender = true` to the pages ' +
                  'you want indexed, or list them in `sitemap.customPages`.',
              );
            const sitemapOpts = opts.sitemap === true ? undefined : opts.sitemap;
            updateConfig({ integrations: [sitemap(sitemapOpts)] });
            sitemapHref = `/${sitemapOpts?.filenameBase ?? 'sitemap'}-index.xml`;
            logger.info(`sitemap registered → ${sitemapHref.slice(1)}`);
          }
        }

        // 4. Icons — resolve names centrally, and derive the bundle on a server build.
        //
        // Everything here has to finish BEFORE the updateConfig that appends the
        // icon integration, because an appended integration's own
        // astro:config:setup runs after this hook returns — it cannot be handed
        // options computed later. That is why the scan is synchronous rather than
        // deferred to the Vite plugin's buildStart, which runs far too late.
        let iconsData: IconsData | null = null;
        if (opts.icons) {
          const o: GetvitopsIconsOptions = opts.icons === true ? {} : opts.icons;
          const ui = o.ui ?? ICON_DEFAULTS.ui;
          const brand = o.brand ?? ICON_DEFAULTS.brand;
          const spriteHref = o.sprite ?? ICON_DEFAULTS.sprite;

          // Declared icons first. An unresolvable name here THROWS — it's a
          // config error, and generateIconInclude has always been loud about it.
          // `exactOptionalPropertyTypes` is on, so an optional key has to be
          // absent rather than explicitly undefined.
          const weightOpt = o.weight ? { weight: o.weight } : {};
          const include: Record<string, string[]> = o.include
            ? generateIconInclude({ ui, brand, ...weightOpt, ...o.include })
            : {};
          const add = (prefix: string, name: string) => {
            const list = (include[prefix] ??= []);
            if (!list.includes(name)) list.push(name);
          };

          // Then whatever the source actually references.
          const scanDirs = o.scan === false ? [] : (o.scan ?? [...ICON_DEFAULTS.scan]);
          const unresolved: string[] = [];
          const dynamic: { file: string; line: number; expr: string }[] = [];
          for (const dir of scanDirs) {
            const abs = resolve(root, dir);
            if (!existsSync(abs)) continue;
            const found = collectIconRefs(scanFiles(abs));
            dynamic.push(
              ...found.dynamic.map((d) => ({
                file: relative(root, d.file),
                line: d.line,
                expr: d.expr,
              })),
            );
            for (const name of found.names) {
              // Already qualified — group it under its own prefix verbatim.
              const colon = name.indexOf(':');
              if (colon > 0) {
                add(name.slice(0, colon), name.slice(colon + 1));
                continue;
              }
              // A scanned name that doesn't resolve only WARNS. It is far more
              // likely a local SVG (astro-icon reads src/icons/*.svg by bare
              // name) or a sprite id than a mistake, and a dev server that dies
              // on a typo in a template is worse than one that tells you.
              try {
                const q = resolveIcon(name, ui, weightOpt);
                add(q.slice(0, q.indexOf(':')), q.slice(q.indexOf(':') + 1));
              } catch {
                unresolved.push(name);
              }
            }
          }

          // `include` only matters where a bundle is at stake. astro-icon is
          // zero-config on a static build; passing a list there would trim
          // nothing and risk dropping a glyph the scan couldn't see.
          const wantsInclude = config.output !== 'static';
          if (dynamic.length && wantsInclude) {
            logger.warn(
              `icons: ${dynamic.length} icon name(s) are computed at runtime and cannot be ` +
                `bundled automatically:\n` +
                dynamic.map((d) => `  ${d.file}:${d.line}  ${d.expr}`).join('\n') +
                `\n  Declare them in \`icons.include\` (or set \`icons.scan: false\` to silence this).`,
            );
          }
          if (unresolved.length)
            logger.warn(
              `icons: ${unresolved.length} name(s) are not in the semantic map for '${ui}': ` +
                `${unresolved.join(', ')}. Left as-is — fine for a local src/icons/*.svg or a ` +
                `sprite id, a typo otherwise.`,
            );

          const engine: IconsData['engine'] = o.engine ?? 'inline';
          if (o.sprite && !opts.css)
            logger.warn(
              'icons: the sprite is written by the same pass that generates the CSS, so ' +
                '`sprite` without `css` produces no file. Add `css`, or run `vitops icons --sprite`.',
            );

          const registered = config.integrations.map((i) => i.name);
          const already = registered.find((n) => n === 'astro-icon' || n === 'astro-iconset');
          if (o.register === false) {
            logger.info('icons: register: false — resolving names only, not registering anything.');
          } else if (already) {
            // Only the registration is skipped. The resolver, the scan and the
            // sprite are not astro-icon's job, so they still run.
            logger.info(
              `icons: ${already} is already in your integrations — leaving yours in charge.`,
            );
          } else {
            // Registered for the consumer's OWN `<Icon>` (astro-icon's), and to
            // hand it the derived include. Independent of how ours renders —
            // `<Icon />` inlines from the collection and needs no integration —
            // so a missing package is silence, not an error.
            const pkg = (await probeIconPackage('astro-icon'))
              ? 'astro-icon'
              : (await probeIconPackage('astro-iconset'))
                ? 'astro-iconset'
                : null;
            if (pkg) {
              type IconFactory = (o?: Record<string, unknown>) => AstroIntegration;
              const { default: icon } = (await import(/* @vite-ignore */ pkg)) as unknown as {
                default: IconFactory;
              };
              updateConfig({ integrations: [icon(wantsInclude ? { include } : {})] });
              logger.info(
                wantsInclude
                  ? `icons: ${pkg} registered — bundling ${Object.values(include).flat().length} icon(s)`
                  : `icons: ${pkg} registered (output: 'static' — no include needed)`,
              );
            }
          }

          iconsData = {
            engine,
            root,
            ui,
            brand,
            weight: o.weight ?? null,
            overrides: o.overrides ?? {},
            sprite: engine === 'sprite' || o.sprite ? spriteHref : null,
          };
        }

        // 5. Virtual head module for <Head/>
        updateConfig({
          vite: {
            plugins: [
              virtualIconsPlugin(
                iconsData ?? {
                  engine: 'none',
                  root,
                  ui: ICON_DEFAULTS.ui,
                  brand: ICON_DEFAULTS.brand,
                  weight: null,
                  overrides: {},
                  sprite: null,
                },
              ),
              virtualHeadPlugin({
                favicons: !!opts.favicon,
                faviconLinks: opts.favicon ? faviconLinks({ hasSvg, manifest: hasManifest }) : [],
                themeColor: opts.favicon?.themeColor ?? null,
                webComponents,
                wcBase: '/vitops',
                editor,
                sitemap: sitemapHref,
                fonts: headFonts,
                site: config.site ?? null,
                seo: opts.seo ?? {},
                analytics: opts.analytics ?? {},
                consent: consentEnabled,
                consentCategories: offeredCategories,
                consentPolicyUrl: consentOpts.policyUrl ?? null,
                consentRuntime,
              }),
            ],
          },
        });

        // 6. CSS — generate + compile + auto-inject (consumer imports nothing).
        if (opts.css) {
          const format: StylesheetFormat = opts.css.format ?? 'tailwind';
          // Typed out above, but a plain-JS config reaches here unchecked and
          // would otherwise fail late with an unresolvable `styles.css` import.
          if ((format as string) === 'design')
            throw new Error(
              "[getvitops] css.format: 'design' emits only DESIGN.md, not a stylesheet. " +
                'Run `npx vitops generate --format design --out .` for that file, and set ' +
                "css.format to 'tailwind' | 'css' | 'bricks' here.",
            );
          const out = opts.css.out ?? 'src/styles';
          const plugins = [
            vitops({
              input: opts.css.input ?? 'design-system.json',
              ...(opts.css.theme != null ? { theme: opts.css.theme } : {}),
              format,
              out,
              // Mirrored inside the generate pass so the served copy can never be
              // missing on a cold start or stale after a config edit.
              ...(editor ? { editorManifestDir: publicDir } : {}),
              // Same mirroring rule as the manifest: the bytes are produced by
              // this pass, so the copy belongs inside it rather than in the hook.
              ...(iconsData?.sprite ? { spriteDir: publicDir } : {}),
              // Same reasoning: inside the pass, so the documents track the site
              // config in dev instead of going stale after the first build.
              ...(opts.legal ? { legal: { ...opts.legal, input: legalInput as string } } : {}),
              // Read during generation for the site-level facts the stylesheet
              // depends on — currently `designSystem.defaultColorScheme`, which decides
              // whether the colour layer carries a prefers-color-scheme block.
              ...(opts.site ? { site: opts.site } : {}),
              ...(opts.css.systemColorScheme != null
                ? { systemColorScheme: opts.css.systemColorScheme }
                : {}),
            }),
          ];
          // Tailwind is an optional peer — only the `tailwind` format needs it,
          // so it's loaded here rather than imported at module scope. (The
          // plugin is typed against a newer vite than @getvitops/vite's peer;
          // the Plugin shapes are structurally compatible at runtime — Astro
          // forwards them verbatim — so bridge the two type identities.)
          //
          // The specifier goes through a constant, with `@vite-ignore`, for the
          // same reason `probeIconPackage` does it: a statically analysable
          // `import('@tailwindcss/vite')` makes the bundler FOLLOW the module
          // even on a `css`-format site that never reaches this branch, and the
          // chain ends at @tailwindcss/oxide's native `.node` binding, which it
          // cannot parse. That failed the whole build with an opaque
          // "stream did not contain valid UTF-8" — for a site not using Tailwind
          // at all. `optional peer` has to mean optional to the bundler too.
          if (format === 'tailwind') {
            let tailwindcss: () => unknown[];
            try {
              ({ default: tailwindcss } = (await import(
                /* @vite-ignore */ TAILWIND_VITE
              )) as unknown as { default: () => unknown[] });
            } catch {
              throw new Error(
                "[getvitops] css.format: 'tailwind' requires `tailwindcss` and `@tailwindcss/vite` " +
                  'in your devDependencies — install them, or switch to css.format: ' +
                  "'css' for the standalone bundle.",
              );
            }
            plugins.push(...(tailwindcss() as unknown as typeof plugins));
          }
          updateConfig({ vite: { plugins } });
          const cssFile = format === 'tailwind' ? 'tailwind.css' : 'styles.css';
          if (opts.css.inject !== false) {
            const cssPath = resolve(root, out, cssFile);
            injectScript('page-ssr', `import ${JSON.stringify(cssPath)};`);
            logger.info(`design-system CSS (${format}) auto-injected from ${out}/${cssFile}`);
          } else {
            logger.info(
              `design-system CSS (${format}) generated at ${out}/${cssFile} (inject: false — import it from your layout)`,
            );
          }
        }
      },
    },
  };
}
