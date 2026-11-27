/**
 * Eager entry (`dist/elements.js`, and `@getvitops/core/elements`): every `wc-*` element, up front.
 *
 * This no longer bundles the elements itself. Each is its own module under `dist/elements/` (see
 * `element-tags.ts`, the one table the build, the loader and the tests read), and this loads all of
 * them at once with no observer. It exists for a host that wants a fixed script tag rather than a
 * scan: the Bricks theme enqueues it, because a builder re-renders markup constantly, which is the
 * hardest case for an observer-driven loader. Everyone else uses `loader.js`.
 *
 * Every tag in the table is `wc-*` prefixed, and that is a rule rather than a convention:
 * `tiers.test.ts` asserts the prefix over every `customElements.define` in `src/web-components/`.
 *
 * What isn't registered here yet (the unbuilt components, the element-display gap) is tracked in
 * AGENTS.md's "Component architecture" section, not here.
 */
import { expose, setBase, loadAll } from './loader-core.ts';

if (typeof document !== 'undefined') {
  setBase(new URL('./elements/', import.meta.url).href);
  expose();
  void loadAll();
}
