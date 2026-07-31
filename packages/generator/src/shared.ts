/**
 * Data shared between the generator (`generate.ts`) and the docs bundle
 * (`docs.ts`). Lives in its own module because `generate.ts` imports `docs.ts` —
 * importing back the other way would be a cycle.
 */

/**
 * Selector the dark functional-token flip hangs off.
 *
 * `data-brx-theme` is Bricks' own attribute — Bricks sets it, so it's what the
 * WordPress target needs. Nothing sets it anywhere else, which meant the dark
 * flip was unreachable outside Bricks: the shipped `<color-scheme-toggle>` web
 * component writes `documentElement.dataset.theme` (i.e. `data-theme`), so
 * clicking "Dark" changed an attribute no rule matched. Matching both makes the
 * component work on every target without changing what Bricks already does.
 *
 * Note this covers the explicit choice only — there is deliberately no
 * `prefers-color-scheme` block, so the toggle's "System" position currently
 * resolves to light. Adding one would flip every existing consumer site dark for
 * dark-OS users, which is a product decision, not a bug fix.
 *
 * Shared so the docs quote the selector the generator actually emits.
 */
export const DARK_SEL = ':root[data-brx-theme="dark"], :root[data-theme="dark"]';

/**
 * Roles the shipped CSS partials reference with NO fallback, so a config that
 * omits one leaves those rules resolving to nothing — an invalid declaration,
 * not a graceful degrade.
 *
 * `colors.roles` is an open record: any name works and generates a full token
 * set, utilities and dark flip. But the framework's own component CSS is
 * written against these six, so "roles are arbitrary" is only half true — they
 * are *extensible*, over a required core. `validate()` warns when one is
 * missing; `required-roles.test.ts` re-derives this list from the partials so
 * it cannot drift as components are added.
 *
 * Kept as a constant rather than scanned at call time because `validate()` is
 * a pure function — the CLI, the Vite plugin and `toJSONSchema` all import it,
 * and none of them should touch the filesystem to answer "is this config ok?".
 */
export const REQUIRED_ROLES: readonly string[] = [
  'brand-primary',
  'danger',
  'neutral',
  'surface',
  'ui-primary',
  'warning',
];

/**
 * The functional-token and emphasis-stop suffixes a role resolves to. Shared so
 * the required-roles drift test greps for exactly what the generator emits.
 */
export const ROLE_TOKEN_SUFFIXES: readonly string[] = [
  'bg',
  'bg-muted',
  'bg-bold',
  'border',
  'border-bold',
  'solid',
  'solid-bold',
  'on-solid',
  'text',
  'text-muted',
  'text-x-muted',
];

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
  // Both spellings map to `bg`, because patterns author either (`card` uses the
  // shorthand, `status` the longhand). A pattern setting both would map the
  // same var twice — a config error, not something to design around.
  background: 'bg',
  'background-color': 'bg',
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
