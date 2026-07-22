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
import type { Format } from '@getvitops/generator';
import {
  type FaviconLink,
  faviconLinks,
  generateFavicons,
  writeFaviconManifest,
} from '@getvitops/utils';
import vitops from '@getvitops/vite';
import tailwindcss from '@tailwindcss/vite';
import type { AstroIntegration } from 'astro';

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
  /** Output format (default 'tailwind'). */
  format?: Format;
  /** Directory the generated CSS is written to (default 'src/styles'). */
  out?: string;
}

export interface GetvitopsOptions {
  favicon?: GetvitopsFaviconOptions;
  /** Copy + link the web-component bundles (default true). */
  webComponents?: boolean;
  /** Generate + auto-inject the design-system CSS. Off unless provided. */
  css?: GetvitopsCssOptions;
}

interface HeadData {
  favicons: boolean;
  faviconLinks: FaviconLink[];
  themeColor: string | null;
  webComponents: boolean;
  wcBase: string;
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
            for (const f of ['polyfills.js', 'deferred.js', 'elements.js', 'polyfills']) {
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

        // 3. Virtual head module for <Head/>
        updateConfig({
          vite: {
            plugins: [
              virtualHeadPlugin({
                favicons: !!opts.favicon,
                faviconLinks: opts.favicon ? faviconLinks({ hasSvg, manifest: hasManifest }) : [],
                themeColor: opts.favicon?.themeColor ?? null,
                webComponents,
                wcBase: '/vitops',
              }),
            ],
          },
        });

        // 4. CSS — generate + compile + auto-inject (consumer imports nothing).
        if (opts.css) {
          const format: Format = opts.css.format ?? 'tailwind';
          const out = opts.css.out ?? 'src/styles';
          const plugins = [vitops({ input: opts.css.input ?? 'design-system.json', format, out })];
          // tailwindcss() is typed against a newer vite than @getvitops/vite's
          // peer; the Plugin shapes are structurally compatible at runtime
          // (Astro forwards them verbatim), so bridge the two type identities.
          if (format === 'tailwind') plugins.push(...(tailwindcss() as unknown as typeof plugins));
          updateConfig({ vite: { plugins } });
          const cssFile = format === 'tailwind' ? 'tailwind.css' : 'styles.css';
          const cssPath = resolve(root, out, cssFile);
          injectScript('page-ssr', `import ${JSON.stringify(cssPath)};`);
          logger.info(`design-system CSS (${format}) auto-injected from ${out}/${cssFile}`);
        }
      },
    },
  };
}
