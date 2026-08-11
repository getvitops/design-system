/**
 * The framework's classification of every class it ships: is this a **pattern**
 * or a **utility**?
 *
 * That question has one answer, and both formats must encode it the same way:
 *
 * | classification | css / bricks         | tailwind                          |
 * | -------------- | -------------------- | --------------------------------- |
 * | `components`   | `vitops.components`  | inside an `@layer components` block |
 * | `utilities`    | `vitops.utilities`   | `@utility <name>`                 |
 * | `tailwindOwns` | `vitops.utilities`   | omitted — it is in `TW_CLASH`     |
 *
 * It lives in its own module so `bundle-layers.test.ts` (which asserts the css
 * half, and needs the gitignored `assets/` build artifact) and
 * `format-parity.test.ts` (which asserts the tailwind half, and runs in a clean
 * checkout) test the SAME list. Two independent lists would drift, which is the
 * failure this whole pair of suites exists to prevent.
 *
 * This is a representative sample, not an enumeration — one or two per family is
 * enough to catch a partial landing in the wrong layer, which is how the entire
 * utility half of `layout.css` sat in `vitops.components` for months.
 */
export const LAYER_CONTRACT = {
  /** Patterns: multi-rule constructs other things compose into. */
  components: [
    'rhythm',
    'centered',
    'region',
    'split',
    'card',
    'cta',
    'reveal',
    'reveal-fade',
    // A component whose NAME collides with a Tailwind utility. `sticky` is why
    // `CLASH_KEEP` exists: the tailwind strip matched a rule's leading `.<name>`
    // and deleted `patterns/sticky.css` wholesale.
    'sticky',
    // A layout pattern whose responsive behaviour lives in container queries
    // keyed on its OWN classes. Guarded here because the tailwind strip drops any
    // `@container (min-width:)` block whose selectors are all `.<bp>-` prefixed —
    // name those wrong and the desktop layout ships in css/bricks only, which is
    // how a mobile-stuck `sitenav` once went out.
    'navshell',
  ],
  /** Single-purpose utilities the framework defines itself. */
  utilities: [
    'split-1-2',
    'split-reverse',
    'measure',
    'spotlight',
    'grid-auto',
    'm-xs',
    'm-p-h',
    'gap-l',
    'bg-danger-muted',
    'font-display',
  ],
  /**
   * Utilities Tailwind already ships. We emit them for css/bricks and defer in
   * tailwind (`TW_CLASH`), so they must be in `vitops.utilities` on our side and
   * absent from ours on Tailwind's. Every one of these sat in
   * `vitops.components` before the layout split — this row is the regression
   * guard that goes red on the old arrangement.
   */
  tailwindOwns: ['flex-col', 'items-center', 'text-center', 'hidden', 'sr-only', 'rounded-full'],
} as const;
