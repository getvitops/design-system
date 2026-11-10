/**
 * The shared `tone` convention (UPSTREAM finding 21): every block that colours anything
 * takes one `tone` and, optionally, one `color`.
 *
 * - **`tone`** — a role name from the site's `colors.roles` (`brand-primary`, `danger`, a
 *   consumer-named surface role…), or a semantic name. Role first, then its semantic
 *   fallbacks, then `neutral`.
 * - **`color`** — the escape hatch: a palette hue (`amber`) or hue and step (`amber-300`).
 *   Wins over `tone` when set. Contrast is NOT checked for it — the generator's contrast
 *   contract covers roles, not arbitrary hue/step pairs — so it is for decoration. A solid fill
 *   reads from the site's `--color-<hue>-<step>-on`, but the tint is light-scheme only: use a `tone`
 *   role, which re-points per scheme, where the site has a dark theme.
 *
 * **Why CSS custom properties, not classes.** A class name built from a field value
 * (`bg-${tone}`) is invisible to Tailwind's scanner, so it generates nothing in that
 * format. The resolver instead returns an inline `style` of `--tone-*` properties that
 * the framework's `.tone` pattern (patterns/tone.css) reads. Each property is a `var()`
 * chain, so the fallback happens in CSS at render time and this module needs NO copy of
 * the site's config — a tone the site never defined degrades to `neutral`, not to
 * nothing.
 *
 * The inputs are editor-supplied strings that land inside a `style` attribute, so both are
 * validated against a closed identifier grammar before use; anything else is dropped.
 */

/** Semantic names every site is expected to define (`REQUIRED_ROLES`), plus common aliases. */
export const SEMANTIC_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

/**
 * When a role is absent, which others to try before `neutral`. Covers the framework's own
 * vocabulary (`ui-*`, `brand-*`) so a site that names only some of them still gets the
 * nearest relative rather than a grey block.
 */
const FALLBACKS: Record<string, string[]> = {
  'brand-primary': ['ui-primary', 'info'],
  'brand-secondary': ['ui-secondary', 'info'],
  'ui-primary': ['info'],
  'ui-secondary': ['info'],
  'ui-accent': ['warning'],
  surface: ['neutral'],
  error: ['danger'],
  notice: ['warning'],
  note: ['info'],
  // Retired vitops.ca vocabulary some stored content still carries.
  it: ['ui-primary', 'info'],
  mk: ['ui-accent', 'warning'],
};

const ROLE = /^[a-z][a-z0-9-]{0,40}$/;
const HUE = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*?)(?:-(\d{2,3}))?$/;

/** The role chain for a tone: itself, its relatives, then `neutral`. Pure and exported for tests. */
export function toneChain(tone: unknown): string[] {
  const name = typeof tone === 'string' ? tone.trim().toLowerCase() : '';
  if (!ROLE.test(name)) return ['neutral'];
  return [...new Set([name, ...(FALLBACKS[name] ?? []), 'neutral'])];
}

/** `var(--a, var(--b, …))` over a chain of token names; the last link has no fallback. */
function chain(tokens: string[]): string {
  return tokens.reduceRight<string>(
    (inner, token) => (inner ? `var(${token}, ${inner})` : `var(${token})`),
    '',
  );
}

export interface ResolvedTone {
  /** Always `tone`; a block adds `tone--solid` itself when it fills rather than tints. */
  className: string;
  /** Inline `style` value of `--tone-*` properties (no trailing semicolon). Empty when unset. */
  style: string;
}

/**
 * Resolve a block's `tone` / `color` fields.
 *
 * Returns an empty style when neither is set, so an unconfigured block carries no tone at
 * all (rather than a neutral one) and stays transparent.
 */
export function resolveTone(tone?: unknown, color?: unknown): ResolvedTone {
  const hasTone = typeof tone === 'string' && tone.trim() !== '';
  const hue = typeof color === 'string' ? HUE.exec(color.trim().toLowerCase()) : null;

  if (hue) {
    const [, name, step] = hue;
    const at = (s: string) => `var(--color-${name}-${s})`;
    // The foreground is the site's own: the generator emits `--color-<hue>-<step>-on` for every
    // step, picked by the same APCA rule as `text-on-<role>`, so a fill by hue and step reads
    // without a fixed white and without asking the browser to guess.
    const fill = step ?? '600';
    return {
      className: 'tone',
      style: [
        `--tone-bg: ${at('100')}`,
        `--tone-fg: ${at('900')}`,
        `--tone-border: ${at('300')}`,
        `--tone-solid: ${at(step ?? '600')}`,
        `--tone-on-solid: ${at(`${fill}-on`)}`,
      ].join('; '),
    };
  }

  if (!hasTone) return { className: 'tone', style: '' };

  const roles = toneChain(tone);
  const of = (prefix: string, suffix = '') =>
    chain(roles.map((r) => `--color-${prefix}-${r}${suffix}`));
  return {
    className: 'tone',
    style: [
      `--tone-bg: ${of('bg', '-muted')}`,
      `--tone-fg: ${of('text')}`,
      `--tone-border: ${of('border')}`,
      // A surface role has no `-solid`, only a bare `bg-<role>`; the solid chain ends there.
      `--tone-solid: ${chain([...roles.map((r) => `--color-bg-${r}-solid`), ...roles.map((r) => `--color-bg-${r}`)])}`,
      `--tone-on-solid: ${chain(roles.map((r) => `--color-text-on-${r}`))}`,
    ].join('; '),
  };
}

/**
 * Join a block's own inline style with a resolved tone's, so a renderer can pass one
 * `style` attribute. Empty parts are skipped.
 */
export function joinStyle(...parts: (string | undefined | false)[]): string | undefined {
  const out = parts.filter(Boolean).join('; ');
  return out || undefined;
}

/**
 * A repeater row's own colour: the `style` that overrides the block's `--tone-*` properties for
 * that item, or `undefined` when the row sets none (it then inherits the block's). Only the custom
 * properties are written, so the row picks up the block's own `.tone` surface and just recolours it.
 */
export function rowTone(row: Record<string, unknown>): string | undefined {
  return resolveTone(row.tone, row.color).style || undefined;
}

/**
 * The `theme` every block can carry: a backdrop for the block's own root element, chosen from the
 * site's colour roles. `<role>` is the tinted surface (`bg-<role>-muted`, with the role's text);
 * `<role>:solid` is the filled backdrop with the contrast-computed `text-on-<role>`; `none` or
 * nothing is no theme. Contrast is therefore the generator's guarantee, not the editor's judgement,
 * and a site that styles its roles as raised, glass or flat gets that look, because the tokens are
 * the site's own.
 *
 * Returns the classes and `--tone-*` style to put on the root element, or `undefined` for no theme.
 */
export function resolveTheme(theme: unknown): { className: string; style: string } | undefined {
  if (typeof theme !== 'string') return undefined;
  const [role, fill] = theme
    .trim()
    .toLowerCase()
    .replace(/^none$/, '')
    .split(':');
  if (!role || !ROLE.test(role)) return undefined;
  const tone = resolveTone(role);
  if (!tone.style) return undefined;
  return { className: fill === 'solid' ? 'tone tone--solid' : 'tone', style: tone.style };
}
