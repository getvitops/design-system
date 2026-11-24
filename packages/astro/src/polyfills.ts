/**
 * `vitops({ polyfills })`: which feature-detected polyfills the page may load.
 *
 * The runtime that acts on this is `polyfills.ts` in `@getvitops/core`; this file is the
 * build-time half (the option's type, and validation so a typo is an error rather than a
 * silent no-op). The names are **mirrored, not imported**, for the reason `analytics.ts`
 * mirrors the consent categories: the core bundle is a browser entry with import-time side
 * effects and has no importable types. `polyfills.test.ts` pins the two lists together.
 */

/** Every polyfill core can load, by the `name` it registers under. */
export const POLYFILL_NAMES = [
  'webcomponents',
  'template-shadowroot',
  'temporal',
  'popover',
  'constructed-stylesheets',
  'invoker-commands',
  'css-anchor-positioning',
  'scroll-target-group',
] as const;

export type PolyfillName = (typeof POLYFILL_NAMES)[number];

export interface GetvitopsPolyfillOptions {
  /**
   * Polyfills to leave out, for a site whose browser support policy makes one dead weight
   * (say `popover` and `invoker-commands` for a site that only targets current browsers).
   * Everything not named here and not opt-in stays on: a polyfill omitted by accident fails
   * silently in an old browser.
   */
  disable?: PolyfillName[];
  /**
   * Opt-in polyfills to turn on. Today that is only `temporal`, which core does not use itself
   * (`<wc-format>` uses `Intl`), so it no longer loads for every visitor; enable it if your own
   * scripts call `Temporal`.
   */
  enable?: PolyfillName[];
}

/** What `<Head />` writes onto the polyfills `<script>` tag. */
export interface HeadPolyfillData {
  enable: string[];
  disable: string[];
}

/**
 * Validate and normalise the option. Throws on an unknown name, or on a name listed in both
 * `enable` and `disable`, because the second is a contradiction nobody meant to write.
 */
export function resolvePolyfills(opts: GetvitopsPolyfillOptions = {}): HeadPolyfillData {
  const known = new Set<string>(POLYFILL_NAMES);
  const clean = (key: 'enable' | 'disable'): string[] => {
    const names = [...new Set(opts[key] ?? [])];
    for (const name of names)
      if (!known.has(name))
        throw new Error(
          `vitops({ polyfills.${key} }): unknown polyfill "${name}". Valid names: ${POLYFILL_NAMES.join(', ')}.`,
        );
    return names;
  };
  const enable = clean('enable');
  const disable = clean('disable');
  const both = enable.filter((n) => disable.includes(n));
  if (both.length)
    throw new Error(
      `vitops({ polyfills }): ${both.map((n) => `"${n}"`).join(', ')} listed in both enable and disable.`,
    );
  return { enable, disable };
}
