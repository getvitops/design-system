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
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { generate, type Format } from '@getvitops/generator';
import { generateFavicons } from '@getvitops/utils';

export interface VitopsFaviconOptions {
  /** Source SVG or PNG. */
  source: string;
  /** Optional simplified source for the 16px icon. */
  lowResSource?: string;
  /** Directory to write the favicon set into. Default: 'public'. */
  out?: string;
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
}

export default function vitops(options: VitopsPluginOptions = {}): Plugin {
  const format: Format = options.format ?? 'tailwind';
  const outDir = options.out ?? 'src/styles';
  let input = resolve(options.input ?? 'design-system.json');
  let root = '';

  const run = async () => {
    await generate({ input, format, outDir });
    if (options.favicon) {
      await generateFavicons({
        source: resolve(root, options.favicon.source),
        outputDir: resolve(root, options.favicon.out ?? 'public'),
        ...(options.favicon.lowResSource
          ? { lowResSource: resolve(root, options.favicon.lowResSource) }
          : {}),
      });
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
    },
  };
}
