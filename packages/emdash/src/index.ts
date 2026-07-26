/**
 * @getvitops/emdash — EmDash CMS native plugin for the Vitops design system.
 *
 * Declares Vitops Portable Text block types (editable from the EmDash admin's
 * slash menu) and ships the Astro components that render them via the
 * `componentsEntry` (`@getvitops/emdash/astro`).
 *
 * Composes with — does not replace — the `getvitops()` Astro integration from
 * `@getvitops/astro`: the integration owns design-system CSS generation and
 * copies the web-component bundles into `public/<wcBase>/`; this plugin only
 * adds the editor-facing layer. Register both in the consumer site:
 *
 * ```js
 * // astro.config.mjs
 * integrations: [
 *   react(),
 *   getvitops({ css: {...} }),
 *   emdash({ database, storage, plugins: [vitopsEmdash()] }),
 * ]
 * ```
 */
import { definePlugin } from 'emdash';
import type { PluginDescriptor } from 'emdash';
import { BLOCKS } from './blocks.ts';

export { BLOCKS } from './blocks.ts';
export type { BlockKitFieldDef, PortableTextBlockDef } from './blocks.ts';
export { vitopsHosting } from './hosting.ts';
export type { HostingTarget, VitopsHosting, VitopsHostingOptions } from './hosting.ts';

/** Keep in sync with package.json (asserted by index.test.ts). */
const VERSION = '0.2.0';
const PLUGIN_ID = 'vitops';
const FRAGMENTS_CAPABILITY = 'hooks.page-fragments:register';

export interface VitopsEmdashOptions {
  /**
   * How the web-component runtime scripts reach the page:
   * - `'integration'` (default) — the site's layout renders `<Head />` from
   *   `@getvitops/astro`, which emits the script tags; this plugin adds none.
   * - `'fragments'` — for layouts using EmDash's `<EmDashHead/>`/`<EmDashBodyEnd/>`
   *   instead: the plugin injects the script tags via the `page:fragments` hook.
   *   Either way the bundles themselves must exist under `public/<wcBase>/`,
   *   which the `getvitops()` integration provides (webComponents: true).
   *   Do not enable both delivery paths — the scripts would load twice.
   */
  scripts?: 'integration' | 'fragments';
  /** Public base path of the web-component bundles (default '/vitops'). */
  wcBase?: string;
}

/**
 * Descriptor factory — import in `astro.config.mjs` and pass to the emdash()
 * integration's `plugins` array.
 */
export function vitopsEmdash(options: VitopsEmdashOptions = {}): PluginDescriptor {
  return {
    id: PLUGIN_ID,
    version: VERSION,
    format: 'native',
    entrypoint: '@getvitops/emdash',
    componentsEntry: '@getvitops/emdash/astro',
    options,
    capabilities: options.scripts === 'fragments' ? [FRAGMENTS_CAPABILITY] : [],
  } as PluginDescriptor;
}

/** Runtime side — EmDash imports and calls this from the descriptor's entrypoint. */
export function createPlugin(options: VitopsEmdashOptions = {}) {
  const scripts = options.scripts ?? 'integration';
  const wcBase = options.wcBase ?? '/vitops';

  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    capabilities: scripts === 'fragments' ? [FRAGMENTS_CAPABILITY] : [],

    hooks:
      scripts === 'fragments'
        ? {
            // Mirrors @getvitops/astro Head.astro: module polyfills + elements
            // in head, deferred enhancements at end of body.
            'page:fragments': async () => [
              {
                kind: 'html',
                placement: 'head',
                html:
                  `<link rel="modulepreload" href="${wcBase}/polyfills.js">` +
                  `<script type="module" src="${wcBase}/polyfills.js"></script>` +
                  `<script type="module" src="${wcBase}/elements.js"></script>`,
                key: 'vitops-wc',
              },
              {
                kind: 'external-script',
                placement: 'body:end',
                src: `${wcBase}/deferred.js`,
                defer: true,
                key: 'vitops-deferred',
              },
            ],
          }
        : {},

    admin: {
      portableTextBlocks: BLOCKS,
    },
  });
}

export default createPlugin;
