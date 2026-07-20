/**
 * @getvitops/vite — a Vite plugin that generates Vitops design-system output from a
 * `design-system.json` during a Vite/Astro (EmDash) build, and hot-regenerates when
 * the config changes in dev.
 *
 *   import vitops from '@getvitops/vite';
 *   export default { plugins: [vitops({ input: 'design-system.json', format: 'tailwind', out: 'src/styles' })] };
 *
 * Thin wrapper over @getvitops/core — the same generator the CLI uses.
 */
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { generate, type Format } from '@getvitops/core';

export interface VitopsPluginOptions {
  /** Path to the design-system.json. Default: 'design-system.json'. */
  input?: string;
  /** Output target. Default: 'tailwind' (the EmDash/Astro case). */
  format?: Format;
  /** Directory to write generated output into. Default: 'src/styles'. */
  out?: string;
}

export default function vitops(options: VitopsPluginOptions = {}): Plugin {
  const format: Format = options.format ?? 'tailwind';
  const outDir = options.out ?? 'src/styles';
  let input = resolve(options.input ?? 'design-system.json');

  const run = async () => {
    await generate({ input, format, outDir });
  };

  return {
    name: '@getvitops/vite',
    // Resolve the config path against Vite's project root once it's known.
    configResolved(config) {
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
