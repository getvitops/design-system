/**
 * @getvitops/vite — a Vite plugin that generates Vitops design-system output from a
 * `design-system.json` (or from the larger site config that embeds one) during a
 * Vite/Astro (EmDash) build, and hot-regenerates when the config changes in dev.
 *
 *   import vitops from '@getvitops/vite';
 *   export default { plugins: [vitops({ input: 'design-system.json', format: 'tailwind', out: 'src/styles' })] };
 *
 * Thin wrapper over @getvitops/generator — the same generator the CLI uses.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import {
  generate,
  generateLegal,
  isSiteConfig,
  resolveSiteConfig,
  validate,
  type Format,
  type LegalOutput,
} from '@getvitops/generator';
import { generateFavicons, writeFaviconManifest } from '@getvitops/utils';

/** Endpoint `<wc-theme-editor>` probes for, and POSTs its patch to. */
const EDITOR_ENDPOINT = '/__vitops/design-system';

/**
 * Where the design system lives inside the config file on disk.
 *
 * `[]` for a `design-system.json` — the file *is* the design system. For a site
 * config it is under `designSystem`, and this reads the **raw** object rather
 * than the resolved one because the editor's write-back has to land where the
 * author actually put it. `resolveSiteConfig` normalises the two shorthands in
 * memory; a writer that assumed the canonical shape would grow a second
 * `themes` key beside the author's bare map and silently stop editing anything.
 */
export function designSystemPath(raw: unknown, theme = 'default'): string[] {
  if (!isSiteConfig(raw)) return [];
  const ds = (raw as Record<string, unknown>).designSystem as Record<string, unknown>;
  if (ds != null && typeof ds === 'object') {
    if ('themes' in ds) return ['designSystem', 'themes', theme];
    // A bare `DesignSystem` written inline — one theme, and it is `default`.
    if ('colors' in ds) return ['designSystem'];
  }
  return ['designSystem', theme]; // the legacy bare theme map
}

export const getAt = (obj: unknown, path: string[]): unknown =>
  path.reduce<unknown>((cur, k) => (cur as Record<string, unknown>)?.[k], obj);

/** Return a copy of `obj` with `path` replaced by `value`. Creates missing objects. */
export function setAt(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value;
  const [head, ...rest] = path as [string, ...string[]];
  const base = (typeof obj === 'object' && obj !== null ? obj : {}) as Record<string, unknown>;
  return { ...base, [head]: setAt(base[head], rest, value) };
}

/**
 * Recursively merge a patch into a config. Plain objects merge key-wise;
 * everything else (scalars, and arrays — a token list is replaced, not appended)
 * is overwritten by the patch.
 */
function deepMerge(base: unknown, patch: unknown): unknown {
  const isPlain = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isPlain(base) || !isPlain(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(base[k], v);
  return out;
}

/** Printed width the config is formatted to — matches the repo formatter's default. */
const PRINT_WIDTH = 100;

/**
 * Serialize a config the way a formatter would: 2-space indent, but arrays of
 * scalars kept on one line when they fit.
 *
 * `JSON.stringify(v, null, 2)` explodes every array onto its own lines, so writing
 * back a two-key patch reflowed ~300 lines of `design-system.json` — a diff nobody
 * can review, for a change of two values. Matching the prevailing style keeps the
 * write surgical, which is the whole point of saving to source rather than copying
 * a patch by hand.
 */
function formatConfig(value: unknown, col = 0, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const inline = `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
      if (col + inline.length <= PRINT_WIDTH) return inline;
    }
    const items = value.map((v) => `${pad}  ${formatConfig(v, indent + 2, indent + 2)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '{}';
    const items = entries.map(([k, v]) => {
      const head = `${pad}  ${JSON.stringify(k)}: `;
      return head + formatConfig(v, head.length, indent + 2);
    });
    return `{\n${items.join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export interface VitopsFaviconOptions {
  /** Source SVG or PNG. */
  source: string;
  /** Optional simplified source for the 16px icon. */
  lowResSource?: string;
  /** Directory to write the favicon set into. Default: 'public'. */
  out?: string;
  /** App name — when set (with `themeColor`), also emit `site.webmanifest`. */
  name?: string;
  /** PWA theme color (also drives `<meta name="theme-color">`). */
  themeColor?: string;
  /** PWA background color. */
  backgroundColor?: string;
}

export interface VitopsPluginOptions {
  /**
   * Path to the config. Default: `'design-system.json'`.
   *
   * May be a `design-system.json` **or** the larger site config that embeds one
   * (`company.json` / `site.json`) — told apart by shape. Pointing it at a site
   * config also supplies `site` below, so a consumer who keeps their tokens
   * there declares the path once instead of three times.
   */
  input?: string;
  /**
   * Which `designSystem.themes` entry to build, when `input` is a site config.
   * Default: the config's `defaultTheme`, else `default`.
   *
   * Also the theme `<wc-theme-editor>`'s **Save to source** writes back into.
   */
  theme?: string;
  /** Output target. Default: 'tailwind' (the EmDash/Astro case). */
  format?: Format;
  /** Directory to write generated output into. Default: 'src/styles'. */
  out?: string;
  /** Also generate a favicon set on build from this source image. */
  favicon?: VitopsFaviconOptions;
  /**
   * Directory to mirror `design-manifest.json` into as `vitops/design-manifest.json`
   * — the URL `<wc-theme-editor>` fetches by default. Set by the Astro integration's
   * `editor` option. Copied inside the generate pass rather than by the caller, so
   * it can't race the first generation and can't go stale on regeneration.
   */
  editorManifestDir?: string;
  /**
   * Directory to mirror the generated `icons.svg` into as `vitops/icons.svg` —
   * the URL `<Icon />` targets under the `sprite` engine. Same reasoning as
   * `editorManifestDir`: copied inside the generate pass, so it can't race a
   * cold start or go stale after a config edit. The *href* is a plain string
   * decided at config:setup; only the bytes arrive here.
   */
  spriteDir?: string;
  /**
   * Also render the site's legal documents on build, and re-render when the site
   * config changes.
   *
   * Its own option because it is an *output* you opt into — but its `input` is
   * optional, defaulting to `site.input`, then to `input` when that is itself a
   * site config. `legal: {}` is therefore the whole declaration in the common case.
   */
  legal?: VitopsLegalOptions;
  /**
   * The site config, for the parts of generation that depend on site-level facts
   * rather than on the design system — currently `designSystem.defaultColorScheme`, which
   * decides whether the colour layer carries a `prefers-color-scheme` block.
   *
   * Only needed when the site config is a *different* file from `input`; when
   * `input` is itself a site config, that one is used. Watched, so an edit
   * regenerates.
   */
  site?: VitopsSiteOptions;
  /**
   * Emit the `prefers-color-scheme: dark` block. Normally read from the site
   * config's `designSystem.defaultColorScheme: "system"`; set here it wins, for consumers with no
   * site config.
   */
  systemColorScheme?: boolean;
}

export interface VitopsSiteOptions {
  /** Path to the site config (JSON). */
  input: string;
  /** Environment whose A/B variant applies. Default: 'production'. */
  siteEnv?: string;
}

export interface VitopsLegalOptions {
  /**
   * Path to the site config (JSON). Optional: defaults to `site.input`, then to
   * the plugin's own `input` when that is itself a site config.
   */
  input?: string;
  /** Directory to write documents into. Default: 'src/content/legal'. */
  out?: string;
  /** Output format. Default: 'md', which suits an Astro content collection. */
  format?: LegalOutput;
  /** Environment whose A/B variant applies. Default: 'production'. */
  siteEnv?: string;
}

export default function vitops(options: VitopsPluginOptions = {}): Plugin {
  const format: Format = options.format ?? 'tailwind';
  const outDir = options.out ?? 'src/styles';
  let input = resolve(options.input ?? 'design-system.json');
  let legalInput = options.legal?.input ? resolve(options.legal.input) : '';
  let siteInput = options.site ? resolve(options.site.input) : '';
  let root = '';

  const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as unknown;

  const run = async () => {
    // Read once and hand `generate` the parsed object: it has to be inspected
    // here anyway to know whether `input` is a site config, and reading the same
    // file twice per regeneration is how a half-written save gets picked up.
    const raw = readJson(input);
    const inputIsSite = isSiteConfig(raw);
    // `generate` reads the site config only for what the stylesheet depends on;
    // legal documents stay the separate opt-in below.
    await generate({
      input: raw as Parameters<typeof generate>[0]['input'],
      format,
      outDir,
      ...(options.theme != null ? { theme: options.theme } : {}),
      siteEnv: options.site?.siteEnv ?? 'production',
      ...(options.systemColorScheme != null
        ? { systemColorScheme: options.systemColorScheme }
        : {}),
      // An explicit `site` wins; otherwise `input` supplies it when it is one.
      ...(siteInput ? { site: readJson(siteInput) as never } : {}),
    });
    if (options.legal) {
      // The three paths are the same file in almost every project, so the
      // declaration cascades rather than being repeated.
      const legalPath = legalInput || siteInput || (inputIsSite ? input : '');
      if (!legalPath)
        throw new Error(
          '[vitops] legal: needs a site config — set `legal.input`, or the `site` option, or ' +
            'point `input` at a site config.',
        );
      const legalOut = resolve(root, options.legal.out ?? 'src/content/legal');
      const site = resolveSiteConfig(readJson(legalPath), options.legal.siteEnv ?? 'production');
      const files = generateLegal(site, { output: options.legal.format ?? 'md' });
      mkdirSync(legalOut, { recursive: true });
      for (const [name, content] of Object.entries(files))
        writeFileSync(join(legalOut, name), content);
    }
    if (options.editorManifestDir) {
      const src = resolve(root, outDir, 'design-manifest.json');
      if (existsSync(src)) {
        const dest = resolve(root, options.editorManifestDir, 'vitops');
        mkdirSync(dest, { recursive: true });
        copyFileSync(src, join(dest, 'design-manifest.json'));
      }
    }
    if (options.spriteDir) {
      const src = resolve(root, outDir, 'icons.svg');
      if (existsSync(src)) {
        const dest = resolve(root, options.spriteDir, 'vitops');
        mkdirSync(dest, { recursive: true });
        copyFileSync(src, join(dest, 'icons.svg'));
      }
    }
    if (options.favicon) {
      const faviconOut = resolve(root, options.favicon.out ?? 'public');
      await generateFavicons({
        source: resolve(root, options.favicon.source),
        outputDir: faviconOut,
        ...(options.favicon.lowResSource
          ? { lowResSource: resolve(root, options.favicon.lowResSource) }
          : {}),
        // Composited under the maskable outputs, so they match the manifest's
        // `background_color` rather than being transparent where it must not be.
        ...(options.favicon.backgroundColor
          ? { backgroundColor: options.favicon.backgroundColor }
          : {}),
      });
      if (options.favicon.name && options.favicon.themeColor) {
        await writeFaviconManifest(faviconOut, {
          name: options.favicon.name,
          themeColor: options.favicon.themeColor,
          ...(options.favicon.backgroundColor
            ? { backgroundColor: options.favicon.backgroundColor }
            : {}),
        });
      }
    }
  };

  // Every config `run()` reads is an input, so every one must trigger a re-run —
  // a legal document (or a colour layer) that only refreshes when the design
  // system changes is worse than one that never refreshes, because it looks
  // current. De-duplicated because `site.input` and `legal.input` are usually the
  // same file, and watching it twice would regenerate twice per edit.
  const watched = () => [...new Set([input, siteInput, legalInput].filter(Boolean))];

  return {
    name: '@getvitops/vite',
    // Resolve paths against Vite's project root once it's known.
    configResolved(config) {
      root = config.root;
      input = resolve(config.root, options.input ?? 'design-system.json');
      if (options.legal?.input) legalInput = resolve(config.root, options.legal.input);
      if (options.site) siteInput = resolve(config.root, options.site.input);
    },
    async buildStart() {
      for (const f of watched()) this.addWatchFile(f);
      await run();
    },
    async watchChange(id) {
      if (watched().includes(resolve(id))) await run();
    },
    configureServer(server) {
      for (const f of watched()) server.watcher.add(f);
      server.watcher.on('change', async (file) => {
        if (!watched().includes(resolve(file))) return;
        await run();
        server.ws.send({ type: 'full-reload' });
      });

      // Dev-only design-system write-back, for `<wc-theme-editor>`'s "Save to
      // source". Registered in configureServer only, so it exists in `vite dev`
      // and never in a build — on a static deploy the editor's probe 404s and the
      // button simply isn't rendered. The only writable path is `input`, already
      // resolved from config: a request supplies a patch, never a destination.
      //
      // The editor's patch is always design-system-relative (`colors.palette.…`),
      // because that is the only config it knows about. When `input` is a site
      // config the patch is therefore merged into — and validated against — the
      // design system SUBTREE, and only the surrounding file is written whole.
      // Merging it at the root instead would write a `colors` key beside
      // `organization` that nothing reads, and `validate` would reject the site
      // config wholesale, so every save would fail with errors about the wrong
      // document.
      server.middlewares.use(EDITOR_ENDPOINT, (req, res, next) => {
        const json = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (req.method === 'GET') {
          try {
            const current = readJson(input);
            const at = designSystemPath(current, options.theme);
            return json(200, {
              writable: true,
              path: input,
              // The subtree, not the file: the editor's own model of a config is
              // a design system, and `at` says where in the file it lives.
              at,
              config: getAt(current, at),
            });
          } catch (err) {
            return json(500, { error: (err as Error).message });
          }
        }

        if (req.method !== 'POST') return next();

        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const { patch } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              patch?: unknown;
            };
            if (patch == null || typeof patch !== 'object')
              return json(400, { errors: ['body must be { patch: object }'] });

            const current = readJson(input);
            const at = designSystemPath(current, options.theme);
            const merged = deepMerge(getAt(current, at), patch);
            // Validate the *merged* result, not the patch: a patch is a partial
            // by design, so it can't be validated on its own, and writing an
            // invalid config would break the very dev server doing the writing.
            const result = validate(merged);
            if (!result.ok)
              return json(400, {
                errors: result.errors.map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`),
              });

            writeFileSync(input, `${formatConfig(setAt(current, at, merged))}\n`);
            // The watcher above picks the write up and regenerates + reloads.
            return json(200, { ok: true, warnings: result.warnings });
          } catch (err) {
            return json(400, { errors: [(err as Error).message] });
          }
        });
      });
    },
  };
}
