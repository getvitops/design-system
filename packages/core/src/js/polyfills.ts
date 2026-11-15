// Feature-detected polyfill loader.
//
// Each entry pairs a `test` (returns `true` when the feature is natively
// supported, i.e. NO polyfill is needed) with a `load` (imports + applies the
// polyfill on demand). Nothing ships to browsers that already support a
// feature — `loadPolyfills()` only imports the misses.
//
// The polyfills are self-hosted: each `load` is a bare dynamic `import()`, so
// the bundler splits every polyfill into its own async chunk that's fetched
// only when its `test` fails.
//
// Detection mirrors the progressive-enhancement stance in AGENTS.md: prefer
// native modern CSS/HTML, degrade gracefully, and only reach for JS/polyfills
// where a missing capability would actually break the experience (rather than
// merely drop an enhancement). Scroll-timeline is the exception that's genuinely
// handled *without* JS: animation.css cancels the affected animations under
// `@supports not (animation-timeline: view())`, so an engine without timelines
// renders them at their natural opacity whether or not this file ever runs. Its
// `load` below is an opt-in upgrade, not a correctness requirement — which is why
// it can sit commented out.

// `CSS.supports` can throw on malformed input in some engines; guard it.
const cssSupports = (decl: string): boolean => {
  try {
    return typeof CSS !== 'undefined' && CSS.supports(decl);
  } catch {
    return false;
  }
};

export interface Polyfill {
  /** Human-readable feature name (surfaced in logs + the degraded event). */
  name: string;
  /** `true` when natively supported — the polyfill is skipped. */
  test: () => boolean;
  /** Import + apply the polyfill. Only called when `test()` is false. */
  load: () => Promise<unknown>;
}

/**
 * Polyfills that load only when a site asks for them (`vitops({ polyfills: { enable } })`).
 *
 * `temporal` is here because nothing in core reads the API (`<wc-format>` uses `Intl`), so
 * loading it for every visitor on an engine without Temporal bought no feature the framework
 * ships. Everything else stays on by default: a polyfill omitted by accident fails silently in
 * an old browser, so the safe default for the ones core depends on is "on, opt out".
 */
export const OPT_IN_POLYFILLS: readonly string[] = ['temporal'];

/** Which polyfills a page turns on or off, from `vitops({ polyfills })`. */
export interface PolyfillSelection {
  /** Opt-in polyfills to turn on (see `OPT_IN_POLYFILLS`). */
  enable?: readonly string[];
  /** Polyfills to leave out. Wins over `enable` if a name is somehow in both. */
  disable?: readonly string[];
}

/**
 * The polyfills that should run: everything except the opt-in set, plus anything `enable`d,
 * minus anything `disable`d. Pure, so the policy is asserted without a DOM.
 */
export function selectPolyfills(list: Polyfill[], selection: PolyfillSelection = {}): Polyfill[] {
  const enable = new Set(selection.enable ?? []);
  const disable = new Set(selection.disable ?? []);
  return list.filter(
    ({ name }) => !disable.has(name) && (enable.has(name) || !OPT_IN_POLYFILLS.includes(name)),
  );
}

/**
 * Read the selection `<Head />` writes onto this script's own tag
 * (`data-polyfills-enable` / `data-polyfills-disable`, space-separated).
 *
 * Looked up by a marker attribute rather than `document.currentScript`, which is `null` inside
 * a module script. No tag, or no attributes, means the default set, so a site that loads this
 * bundle by hand keeps working.
 */
export function readPolyfillSelection(
  doc: Pick<Document, 'querySelector'> = document,
): PolyfillSelection {
  const tag = doc.querySelector<HTMLElement>('script[data-vitops-polyfills]');
  const words = (value: string | undefined): string[] => value?.split(/\s+/).filter(Boolean) ?? [];
  return {
    enable: words(tag?.dataset.polyfillsEnable),
    disable: words(tag?.dataset.polyfillsDisable),
  };
}

export const prerenderPolyfills: Polyfill[] = [
  // {
  //   // Scroll-driven animations — animation-timeline: scroll()/view()
  //   name: 'scroll-timeline',
  //   test: () => cssSupports('animation-timeline: scroll()'),
  //   // @ts-expect-error -- ships no bundled types; loaded for side effects only.
  //   load: () => import('scroll-timeline-polyfill/dist/scroll-timeline.js'),
  // },
  {
    // Web Components — custom elements + shadow DOM
    name: 'webcomponents',
    test: () => 'customElements' in window && 'attachShadow' in Element.prototype,
    load: () => import('@webcomponents/webcomponentsjs/webcomponents-bundle.js'),
  },
  {
    // Declarative Shadow DOM — <template shadowrootmode="open">
    name: 'template-shadowroot',
    test: () => 'shadowRootMode' in HTMLTemplateElement.prototype,
    // Must be invoked after import to hydrate already-parsed templates.
    load: async () => {
      const { hydrateShadowRoots } = await import('@webcomponents/template-shadowroot');
      hydrateShadowRoots(document.body);
    },
  },
  {
    // Temporal API — the modern date/time replacement for Date
    name: 'temporal',
    test: () => 'Temporal' in globalThis,
    load: () => import('temporal-polyfill/global'),
  },
  {
    // Popover API — [popover] + popovertarget invokers
    name: 'popover',
    test: () => 'popover' in HTMLElement.prototype,
    load: () => import('@oddbird/popover-polyfill'),
  },
  {
    // Constructed Stylesheets — adoptedStyleSheets + CSSStyleSheet.replace()
    name: 'constructed-stylesheets',
    test: () => 'adoptedStyleSheets' in Document.prototype,
    load: () => import('construct-style-sheets-polyfill'),
  },
  {
    // Invoker Commands API — <button command commandfor>. `<wc-gallery>`'s
    // no-JS fallback is a working modal lightbox built entirely on this (see
    // patterns/gallery.css), and `Drawer.astro` already emits `command="show-modal"`
    // unconditionally — both need this covered rather than merely "preferred".
    name: 'invoker-commands',
    // `commandForElement`, the reflected property of the `commandfor` attribute, rather than
    // `command`: the pair shipped together in every engine that has the feature, and this is the
    // one the polyfill's own README tests. Checked on the prototype, not on `window`/`document`.
    test: () => 'commandForElement' in HTMLButtonElement.prototype,
    load: () => import('invokers-polyfill'),
  },
  // Deliberately omitted — universally supported across the framework's targets,
  // so a polyfill would be dead weight:
  //   • <dialog> / showModal()      • :has()          • container queries
  //   • CSS nesting                 • IntersectionObserver
  // Add an entry here if a target browser ever regresses on one of these.
];

const postrenderPolyfills: Polyfill[] = [
  {
    // CSS Anchor Positioning API — anchor-name / position-anchor
    name: 'css-anchor-positioning',
    test: () => cssSupports('anchor-name: --x'),
    load: async () => (await import('@oddbird/css-anchor-positioning/fn')).default(),
  },
];

/** Dispatched on `window` when one or more polyfills fail to load. */
export const POLYFILL_DEGRADED_EVENT = 'polyfills:degraded';

export interface PolyfillDegradedDetail {
  failures: { name: string; reason: unknown }[];
}

/**
 * Run every feature test and load only the polyfills that are missing. Uses
 * `allSettled` so one failed load can't abort the others; any failures are
 * logged and reported via a `POLYFILL_DEGRADED_EVENT` on `window` so the app
 * can notify the user about potentially degraded behaviour.
 */
export async function loadPolyfills(
  list: Polyfill[] = selectPolyfills(prerenderPolyfills),
): Promise<void> {
  const pending = list.filter(({ test }) => !test());
  const results = await Promise.allSettled(pending.map(({ load }) => load()));

  const failures: PolyfillDegradedDetail['failures'] = [];
  results.forEach((result, i) => {
    const entry = pending[i];
    if (entry && result.status === 'rejected') {
      failures.push({ name: entry.name, reason: result.reason });
      console.warn(`[polyfills] failed to load "${entry.name}":`, result.reason);
    }
  });

  if (failures.length) {
    window.dispatchEvent(
      new CustomEvent<PolyfillDegradedDetail>(POLYFILL_DEGRADED_EVENT, {
        detail: { failures },
      }),
    );
  }
}

if (typeof document !== 'undefined') {
  const selection = readPolyfillSelection();
  void loadPolyfills(selectPolyfills(prerenderPolyfills, selection));
  document.addEventListener('DOMContentLoaded', () =>
    loadPolyfills(selectPolyfills(postrenderPolyfills, selection)),
  );
}
