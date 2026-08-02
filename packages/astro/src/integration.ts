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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LegalOutput, StylesheetFormat } from '@getvitops/generator';
import {
  type FaviconLink,
  faviconLinks,
  generateFavicons,
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

        // 4. Virtual head module for <Head/>
        updateConfig({
          vite: {
            plugins: [
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

        // 5. CSS — generate + compile + auto-inject (consumer imports nothing).
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
