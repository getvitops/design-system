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
 * This covers the EXPLICIT choice. The OS preference is a second, opt-in block —
 * see `SYSTEM_DARK_SEL` — because turning it on flips a site dark for dark-OS
 * users, which is the site's decision rather than the design system's.
 *
 * Shared so the docs quote the selector the generator actually emits.
 */
export const DARK_SEL = ':root[data-brx-theme="dark"], :root[data-theme="dark"]';

/**
 * Selector for the OS-preference dark block, emitted inside
 * `@media (prefers-color-scheme: dark)` when a site opts in.
 *
 * Derived from `DARK_SEL`'s attributes rather than written out a third time, and
 * inverted: this must apply when NO explicit choice has been made. That is
 * exactly what `<color-scheme-toggle>`'s "System" position produces — it removes
 * `data-theme` entirely — so with this block present System resolves to the OS
 * instead of silently falling through to light, and needs no JS to do it.
 *
 * The `:not()`s are what keep an explicit *light* choice winning over a dark OS.
 */
export const SYSTEM_DARK_SEL = `:root${DARK_SEL.split(', ')
  .map((s) => s.replace(/^:root\[([\w-]+)="dark"\]$/, '[$1="light"]'))
  .map((attr) => `:not(${attr})`)
  .join('')}`;

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
 * Every token key a role can resolve to, across both role kinds. Shared so the
 * required-roles drift test greps for exactly what the generator emits.
 *
 * These are *keys*, not var names: the role sits in the middle of the property
 * (`--color-bg-danger-muted`), so compose them with `tokenVar()` from `tokens.ts`
 * rather than concatenating by hand.
 */
export const ROLE_TOKEN_KEYS: readonly string[] = [
  // backgrounds — surface roles get the bare token and the full range,
  // chromatic roles get tints plus the solid family.
  'bg',
  'bg-muted',
  'bg-x-muted',
  'bg-bold',
  'bg-x-bold',
  'bg-solid',
  'bg-solid-bold',
  'bg-solid-x-bold',
  // foregrounds
  'text',
  'text-bold',
  'text-muted',
  'text-x-muted',
  'text-xx-muted',
  'text-on',
  'text-on-bold',
  // non-text tiers
  'icon',
  'icon-muted',
  'border',
  'border-muted',
  'border-bold',
];

/** How a role is authored in `colors.roles`: a bare hue, or a hue plus its kind. */
// `kind` admits an explicit `undefined` because the repo runs
// `exactOptionalPropertyTypes` and the zod-inferred config type spells optionals
// that way — without it every call site would need a cast.
export type RoleSpec = string | { hue: string; kind?: 'surface' | 'chromatic' | undefined };

/** The palette hue a role points at, through either authoring form. */
export const roleHue = (spec: RoleSpec): string => (typeof spec === 'string' ? spec : spec.hue);

/**
 * A role's kind. The bare-string shorthand means `chromatic`, because signal
 * colours are the common case and surfaces are the two or three you name once.
 */
export const roleKind = (spec: RoleSpec): 'surface' | 'chromatic' =>
  typeof spec === 'string' ? 'chromatic' : (spec.kind ?? 'chromatic');

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
  'text-wrap',
  'text-nowrap',
  'text-balance',
  'text-pretty',
]);
