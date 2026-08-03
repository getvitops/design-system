/**
 * Build an SVG sprite from an icon `include` map.
 *
 * This is the delivery path for consumers that cannot run an icon integration:
 * Bricks/WordPress, EmDash's renderers, anything rendering HTML outside an Astro
 * build. Markup is `<svg><use href="…/icons.svg#ph--caret-down"/></svg>` — no
 * runtime JS and no network call, which is what keeps it inside the tier rules
 * (a runtime-fetching element would be behaviour JS with no fallback to enhance).
 *
 * The icon DATA comes from the `@iconify-json/*` collections, which stay optional
 * peers loaded dynamically: `@iconify-json/ph` alone is ~4.5 MB and the semantic
 * map spans five sets, so depending on them directly would be indefensible for
 * every consumer who never asks for a sprite.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IconifyJSON } from '@iconify/types';
import { getIconData, iconToSVG, replaceIDs } from '@iconify/utils';

export interface IconSpriteOptions {
  /** Exactly `generateIconInclude()`'s shape: collection → icon names. */
  include: Record<string, string[]>;
  /**
   * Extra ids pointing at an already-included icon, e.g. `{ 'icon-menu': 'ph:list' }`,
   * so a consumer can reference a semantic name without knowing the set.
   */
  aliases?: Record<string, string>;
  /**
   * Directory to resolve `@iconify-json/*` from. Defaults to `process.cwd()`.
   *
   * Load-bearing: the collections are the CONSUMER's dependency, not this
   * package's, so a bare `import('@iconify-json/ph/…')` from inside the
   * generator resolves against the generator's own node_modules and misses them
   * entirely — which reads as "not installed" on a project that has them.
   */
  resolveFrom?: string;
  /** Injected in tests so the emitter can run without any @iconify-json/* installed. */
  loadSet?: (prefix: string) => Promise<IconifyJSON | null>;
}

export interface IconSpriteResult {
  svg: string;
  /** Every `<symbol>` id emitted, in order. */
  ids: string[];
  /** `prefix:name` entries that were asked for but not found. */
  missing: string[];
}

/**
 * `ph:caret-down` → `ph--caret-down`.
 *
 * The one place this grammar lives. `Icon.astro` mirrors it and `icon.test.ts`
 * guards the pair, because a drift here resolves `<use>` to nothing and renders
 * as an empty box rather than an error.
 */
export function spriteId(qualified: string): string {
  return qualified.replace(':', '--');
}

/**
 * Default loader: the collection JSON shipped by `@iconify-json/<prefix>`.
 *
 * Resolved through a `createRequire` rooted at the consumer's directory, then
 * imported by absolute path — a bare specifier would resolve against this
 * package instead, where the collections deliberately aren't installed.
 */
async function loadCollection(prefix: string, from: string): Promise<IconifyJSON | null> {
  try {
    const req = createRequire(pathToFileURL(join(from, 'noop.js')));
    const path = req.resolve(`@iconify-json/${prefix}/icons.json`);
    const mod = await import(pathToFileURL(path).href, { with: { type: 'json' } });
    return (mod.default ?? mod) as IconifyJSON;
  } catch {
    return null;
  }
}

export async function buildIconSprite(o: IconSpriteOptions): Promise<IconSpriteResult> {
  const from = o.resolveFrom ?? process.cwd();
  const load = o.loadSet ?? ((prefix: string) => loadCollection(prefix, from));
  const symbols: string[] = [];
  const ids: string[] = [];
  const missing: string[] = [];
  /** qualified name → its rendered body+viewBox, so an alias can reuse it. */
  const rendered = new Map<string, { viewBox: string; body: string }>();

  for (const [prefix, names] of Object.entries(o.include)) {
    if (!names?.length) continue;
    const set = await load(prefix);
    if (!set) {
      throw new Error(
        `[vitops icons] Cannot build the sprite: the "${prefix}" icon set is not installed. ` +
          `Run \`pnpm add -D @iconify-json/${prefix}\`, or drop it from your icons config.`,
      );
    }
    for (const name of names) {
      // getIconData resolves aliases and parent chains, so `include` can name
      // either a real icon or one of the set's own aliases.
      const data = getIconData(set, name);
      if (!data) {
        missing.push(`${prefix}:${name}`);
        continue;
      }
      const built = iconToSVG(data, { height: 'none' });
      // MANDATORY. Two icons carrying the same internal gradient/clip id would
      // otherwise collide once concatenated into one document, and the second
      // silently renders with the first's paint.
      const body = replaceIDs(built.body);
      const id = spriteId(`${prefix}:${name}`);
      rendered.set(`${prefix}:${name}`, { viewBox: built.attributes.viewBox, body });
      ids.push(id);
      symbols.push(`<symbol id="${id}" viewBox="${built.attributes.viewBox}">${body}</symbol>`);
    }
  }

  for (const [alias, target] of Object.entries(o.aliases ?? {})) {
    const hit = rendered.get(target);
    if (!hit) {
      missing.push(`${target} (aliased as ${alias})`);
      continue;
    }
    // The body is DUPLICATED rather than nested as <use href="#target"> inside
    // the symbol. Nested-use is legal but unreliable precisely under an
    // external-file <use>, which is exactly how this sprite is consumed; a
    // handful of duplicated paths in a ~40 KB file is the cheaper trade.
    ids.push(alias);
    symbols.push(`<symbol id="${alias}" viewBox="${hit.viewBox}">${hit.body}</symbol>`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">` +
    symbols.join('') +
    `</svg>\n`;

  return { svg, ids, missing };
}

/**
 * One icon's renderable parts, for inlining into markup.
 *
 * Exists because `<Icon />` cannot go through astro-icon: its `./components`
 * entry is a TypeScript file that Vite must transform, so it can only be
 * reached by a statically-analysable import — and a static import is exactly
 * what made the optional peer mandatory for anyone rendering Popover, Details
 * or Drawer. Reading the collection directly sidesteps the peer entirely and
 * shares this file's loader with the sprite, so both paths draw the same glyph.
 */
export async function loadIconSvg(
  qualified: string,
  opts?: { resolveFrom?: string; loadSet?: (prefix: string) => Promise<IconifyJSON | null> },
): Promise<{ viewBox: string; body: string } | null> {
  const i = qualified.indexOf(':');
  if (i <= 0) return null;
  const prefix = qualified.slice(0, i);
  const name = qualified.slice(i + 1);
  const from = opts?.resolveFrom ?? process.cwd();
  const load = opts?.loadSet ?? ((p: string) => loadCollection(p, from));
  const set = await load(prefix);
  if (!set) return null;
  const data = getIconData(set, name);
  if (!data) return null;
  const built = iconToSVG(data, { height: 'none' });
  // Same id-collision guard as the sprite: several inlined icons share one
  // document, so an un-rewritten gradient id would cross-render.
  return { viewBox: built.attributes.viewBox, body: replaceIDs(built.body) };
}
