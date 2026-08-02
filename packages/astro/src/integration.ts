/**
 * @getvitops/astro — the Astro integration. One entry wires the design system's
 * `<head>` contributions into a consumer site:
 *   - favicons + PWA manifest (generated into public/),
 *   - the web-component runtime bundles (copied into public/vitops/),
 *   - (opt-in) the design-system CSS, generated + auto-injected (no manual import).
 * The `<Head />` component (shipped alongside) renders the tags, reading resolved
 * config from the `virtual:getvitops/head` module this integration provides.
 */
import { cpSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LegalOutput, StylesheetFormat } from '@getvitops/generator';
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
  /** Path to design-system.json (default 'design-system.json'). */
  input?: string;
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
}

export interface GetvitopsLegalOptions {
  /** Path to the site config (JSON) the documents are rendered from. */
  input: string;
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
   * Which renderer `<Icon />` uses. `'auto'` (default) probes astro-icon, then
   * astro-iconset, then the sprite. Naming an engine explicitly makes a missing
   * package an error rather than a silent fallback.
   */
  engine?: 'auto' | 'astro-icon' | 'astro-iconset' | 'sprite';
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
  /** `config.site`, so `<Seo />` has a canonical base even without `Astro.site`. */
  site: string | null;
  /** Site-level `<Seo />` defaults. Function-free, hence serialisable. */
  seo: GetvitopsSeoOptions;
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
  engine: 'astro-icon' | 'astro-iconset' | 'sprite' | 'none';
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
 * Pick the renderer.
 *
 * `'auto'` probes in order and falls through quietly — both icon integrations
 * are optional peers, and a site that installed neither can still render from a
 * sprite. Naming one explicitly is a promise that it's installed, so a miss is
 * an error: silently rendering something else would hide the mistake until a
 * page came out wrong.
 */
async function resolveIconEngine(
  requested: 'auto' | 'astro-icon' | 'astro-iconset' | 'sprite',
  logger: { warn(msg: string): void },
): Promise<IconsData['engine']> {
  if (requested === 'sprite') return 'sprite';
  const probe = async (name: 'astro-icon' | 'astro-iconset') => {
    try {
      await import(/* @vite-ignore */ name);
      return true;
    } catch {
      return false;
    }
  };
  if (requested !== 'auto') {
    if (await probe(requested)) return requested;
    throw new Error(
      `[getvitops] icons.engine: '${requested}' is not installed. Add it to your ` +
        `devDependencies, or use icons.engine: 'auto' (or 'sprite').`,
    );
  }
  if (await probe('astro-icon')) return 'astro-icon';
  if (await probe('astro-iconset')) return 'astro-iconset';
  logger.warn(
    'icons: neither astro-icon nor astro-iconset is installed — falling back to the sprite. ' +
      'Install one, or set icons.engine explicitly to silence this.',
  );
  return 'sprite';
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

        // 2. Web-component bundles → public/vitops/
        if (webComponents) {
          const corePkg = fileURLToPath(import.meta.resolve('@getvitops/core/package.json'));
          const coreDist = join(dirname(corePkg), 'dist');
          const dest = join(publicDir, 'vitops');
          if (existsSync(coreDist)) {
            const bundles = ['polyfills.js', 'deferred.js', 'elements.js', 'polyfills'];
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

          const engine = await resolveIconEngine(o.engine ?? 'auto', logger);
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
          } else if (engine === 'astro-icon' || engine === 'astro-iconset') {
            type IconFactory = (o?: Record<string, unknown>) => AstroIntegration;
            const { default: icon } = (await import(/* @vite-ignore */ engine)) as unknown as {
              default: IconFactory;
            };
            updateConfig({ integrations: [icon(wantsInclude ? { include } : {})] });
            logger.info(
              wantsInclude
                ? `icons: ${engine} registered — bundling ${Object.values(include).flat().length} icon(s)`
                : `icons: ${engine} registered (output: 'static' — no include needed)`,
            );
          }

          iconsData = {
            engine,
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
                site: config.site ?? null,
                seo: opts.seo ?? {},
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
              ...(opts.legal ? { legal: opts.legal } : {}),
            }),
          ];
          // Tailwind is an optional peer — only the `tailwind` format needs it,
          // so it's loaded here rather than imported at module scope. (The
          // plugin is typed against a newer vite than @getvitops/vite's peer;
          // the Plugin shapes are structurally compatible at runtime — Astro
          // forwards them verbatim — so bridge the two type identities.)
          if (format === 'tailwind') {
            let tailwindcss: () => unknown[];
            try {
              ({ default: tailwindcss } = await import('@tailwindcss/vite'));
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
