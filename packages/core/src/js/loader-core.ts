/**
 * On-demand element loader (`dist/loader.js`).
 *
 * Instead of one `elements.js` that registers every `wc-*` element, this finds the tags a page
 * uses, imports only those modules (plus each one's `static dependencies`), and keeps watching so
 * elements that arrive later (a popover's contents, an EmDash preview, markup injected by a
 * builder) resolve too. Modelled on Web Awesome's autoloader.
 *
 * The entries are `loader.ts` (this, plus watching) and `elements.ts` (the same loading, all tags
 * at once and no observer). Neither imports an element module statically: each element is its own
 * entry, so a page pays only for the ones it loads.
 *
 * Late upgrade is not a new failure mode here: every element is tier 2 or better, so the window
 * before its module lands is the same no-JS state a visitor with scripting off gets permanently.
 *
 * Tags it does not own are ignored (`wc-consent`, which must load ahead of everything it gates,
 * and a site's own `wc-*` elements), so nothing 404s.
 */
import { ELEMENTS, ELEMENT_TAGS } from './element-tags.ts';

type Dependent = { dependencies?: readonly string[] };
/** A document or an element: anything with `querySelectorAll`, and a tag name when it is one. */
type Root = ParentNode & { readonly localName?: string };

const loading = new Map<string, Promise<void>>();
const SELECTOR = ELEMENT_TAGS.join(',');

type Importer = (tag: string) => Promise<unknown>;

/**
 * Where `elements/<tag>.js` lives. Set by the entry, which sits at the bundle root: this module
 * may be a shared chunk under `chunks/`, so its own `import.meta.url` is the wrong anchor.
 */
let base = '';

export function setBase(url: string): void {
  base = url.endsWith('/') ? url : `${url}/`;
}

const defaultImporter: Importer = (tag) => import(/* @vite-ignore */ `${base}${tag}.js`);

let importer: Importer = defaultImporter;

/** Swap the module importer (tests). Pass nothing to restore the real one. */
export function setImporter(next?: Importer): void {
  importer = next ?? defaultImporter;
  loading.clear();
}

/** Import one element's module and, once it is defined, everything it depends on. */
export function load(tag: string): Promise<void> {
  if (!(tag in ELEMENTS)) return Promise.resolve();
  let pending = loading.get(tag);
  if (!pending) {
    pending = (async () => {
      // The element's own module registers it as a side effect of loading.
      if (!customElements.get(tag)) await importer(tag);
      const ctor = customElements.get(tag) as (CustomElementConstructor & Dependent) | undefined;
      const deps = ctor?.dependencies ?? ELEMENTS[tag]?.dependencies ?? [];
      await Promise.all(deps.map(load));
    })().catch((error) => {
      // Forget a failure so a later scan can retry (a flaky network, a deploy mid-load).
      loading.delete(tag);
      console.warn(`[vitops] could not load <${tag}>`, error);
    });
    loading.set(tag, pending);
  }
  return pending;
}

/** Every owned, not-yet-defined tag at or under `root`. */
export function discover(root: Root): string[] {
  const found = new Set<string>();
  const own = root.localName;
  if (own && own in ELEMENTS && !customElements.get(own)) found.add(own);
  for (const el of root.querySelectorAll(SELECTOR)) {
    const tag = el.localName;
    if (!customElements.get(tag)) found.add(tag);
  }
  return [...found];
}

/** Load whatever `root` needs. */
export function scan(root: Root): Promise<void> {
  return Promise.all(discover(root).map(load)).then(() => undefined);
}

let observer: MutationObserver | undefined;

/** Scan the document now and on every later insertion. Idempotent. */
export function start(doc: Document = document): void {
  if (observer) return;
  void scan(doc);
  observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) if (node.nodeType === 1) void scan(node as Element);
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
}

declare global {
  interface Window {
    vitopsElements?: {
      /** Resolves once the tag's element, and what it depends on, are defined. */
      ready(tag: string): Promise<void>;
    };
  }
}

/** Load every element now, without watching. What `elements.js` (the eager entry) does. */
export function loadAll(): Promise<void> {
  return Promise.all(ELEMENT_TAGS.map(load)).then(() => undefined);
}

/** Expose `window.vitopsElements.ready(tag)` for scripts that need an upgraded element. */
export function expose(): void {
  if (typeof window === 'undefined') return;
  window.vitopsElements = {
    ready: async (tag) => {
      await load(tag);
      if (tag in ELEMENTS) await customElements.whenDefined(tag);
    },
  };
}
