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
// merely drop an enhancement). Scroll-timeline is the exception that's already
// handled *without* JS — the inline <head> snippet flips `.no-scroll-timeline`
// on <html> before paint and animation.css cancels the affected animations, so
// its `load` here is an opt-in upgrade, not a correctness requirement.

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
  // TODO: Invoker Commands API — <button command commandfor>. AGENTS.md flags it
  // as a preferred native primitive, but it's too new to actually rely on yet.
  // Add an entry (test: () => 'command' in HTMLButtonElement.prototype,
  // load: () => import('invokers-polyfill')) once we start using it.
  //
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
export async function loadPolyfills(list: Polyfill[] = prerenderPolyfills): Promise<void> {
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
  void loadPolyfills(prerenderPolyfills);
  document.addEventListener('DOMContentLoaded', () => loadPolyfills(postrenderPolyfills));
}
