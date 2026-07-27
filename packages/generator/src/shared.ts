/**
 * Data shared between the generator (`generate.ts`) and the docs bundle
 * (`docs.ts`). Lives in its own module because `generate.ts` imports `docs.ts` —
 * importing back the other way would be a cycle.
 */

/**
 * Pattern base geometry props → per-pattern override-hook shorthand. Each hook
 * wraps the authored value (`padding: var(--p-btn, 0.4em 0.8em)`) so a
 * consumer restyles one pattern by setting one variable. The hook is named after
 * the pattern's key, not its class.
 */
export const BASE_HOOK: Record<string, string> = {
  padding: 'p',
  'border-radius': 'br',
  border: 'b',
  'box-shadow': 'ds',
  'font-size': 'fs',
};

/**
 * Framework utility classes whose names collide with Tailwind's own defaults.
 * The `tailwind` format strips any rule targeting these — Tailwind provides
 * them, so consumers use Tailwind's utilities for these names instead.
 */
export const TW_CLASH: ReadonlySet<string> = new Set<string>([
  'block',
  'inline',
  'inline-block',
  'flow-root',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'table',
  'inline-table',
  'table-caption',
  'table-cell',
  'table-row',
  'contents',
  'hidden',
  'list-item',
  'static',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  'isolate',
  'visible',
  'invisible',
  'collapse',
  'sr-only',
  'not-sr-only',
  'flex-row',
  'flex-row-reverse',
  'flex-col',
  'flex-col-reverse',
  'flex-wrap',
  'flex-nowrap',
  'items-start',
  'items-end',
  'items-center',
  'items-baseline',
  'items-stretch',
  'justify-start',
  'justify-end',
  'justify-center',
  'justify-between',
  'justify-around',
  'justify-evenly',
  'content-start',
  'content-end',
  'content-center',
  'content-between',
  'content-around',
  'content-evenly',
  'text-left',
  'text-center',
  'text-right',
  'text-justify',
  'text-start',
  'text-end',
]);
