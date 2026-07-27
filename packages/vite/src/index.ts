/**
 * @getvitops/vite — a Vite plugin that generates Vitops design-system output from a
 * `design-system.json` during a Vite/Astro (EmDash) build, and hot-regenerates when
 * the config changes in dev.
 *
 *   import vitops from '@getvitops/vite';
 *   export default { plugins: [vitops({ input: 'design-system.json', format: 'tailwind', out: 'src/styles' })] };
 *
 * Thin wrapper over @getvitops/generator — the same generator the CLI uses.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { generate, validate, type Format } from '@getvitops/generator';
import { generateFavicons, writeFaviconManifest } from '@getvitops/utils';

/** Endpoint `<wc-theme-editor>` probes for, and POSTs its patch to. */
const EDITOR_ENDPOINT = '/__vitops/design-system';

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
  /** Path to the design-system.json. Default: 'design-system.json'. */
  input?: string;
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
}

export default function vitops(options: VitopsPluginOptions = {}): Plugin {
  const format: Format = options.format ?? 'tailwind';
  const outDir = options.out ?? 'src/styles';
  let input = resolve(options.input ?? 'design-system.json');
  let root = '';

  const run = async () => {
    await generate({ input, format, outDir });
    if (options.editorManifestDir) {
      const src = resolve(root, outDir, 'design-manifest.json');
      if (existsSync(src)) {
        const dest = resolve(root, options.editorManifestDir, 'vitops');
        mkdirSync(dest, { recursive: true });
        copyFileSync(src, join(dest, 'design-manifest.json'));
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

  return {
    name: '@getvitops/vite',
    // Resolve paths against Vite's project root once it's known.
    configResolved(config) {
      root = config.root;
      input = resolve(config.root, options.input ?? 'design-system.json');
    },
    async buildStart() {
      this.addWatchFile(input);
      await run();
    },
    async watchChange(id) {
      if (resolve(id) === input) await run();
    },
    configureServer(server) {
      server.watcher.add(input);
      server.watcher.on('change', async (file) => {
        if (resolve(file) !== input) return;
        await run();
        server.ws.send({ type: 'full-reload' });
      });

      // Dev-only design-system write-back, for `<wc-theme-editor>`'s "Save to
      // source". Registered in configureServer only, so it exists in `vite dev`
      // and never in a build — on a static deploy the editor's probe 404s and the
      // button simply isn't rendered. The only writable path is `input`, already
      // resolved from config: a request supplies a patch, never a destination.
      server.middlewares.use(EDITOR_ENDPOINT, (req, res, next) => {
        const json = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (req.method === 'GET') {
          try {
            return json(200, {
              writable: true,
              path: input,
              config: JSON.parse(readFileSync(input, 'utf8')),
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

            const current = JSON.parse(readFileSync(input, 'utf8')) as unknown;
            const merged = deepMerge(current, patch);
            // Validate the *merged* result, not the patch: a patch is a partial
            // by design, so it can't be validated on its own, and writing an
            // invalid config would break the very dev server doing the writing.
            const result = validate(merged);
            if (!result.ok)
              return json(400, {
                errors: result.errors.map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`),
              });

            writeFileSync(input, `${formatConfig(merged)}\n`);
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
