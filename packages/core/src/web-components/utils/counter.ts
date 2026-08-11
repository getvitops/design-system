/**
 * What `<wc-counter>` should show, separated from the DOM plumbing that shows
 * it — the same split as `gallery.ts` against `WCGallery`. Everything genuinely
 * decidable is a function over plain data here, tested in the default `node`
 * environment; `WCCounter` only gathers the inputs and acts on the answers.
 */

/** A figure parsed out of an element's fallback text, e.g. `"$1,284.50"`. */
export interface ParsedFigure {
  /** Non-numeric lead-in, e.g. `"$"`. Empty string when there is none. */
  prefix: string;
  /** Non-numeric trailer, e.g. `"%"`, `"+"`, `"×"`. Empty string when there is none. */
  suffix: string;
  value: number;
  /** Decimal places to render — from `text` unless `decimalsOverride` is given. */
  decimals: number;
  /** Whether the parsed text grouped digits (`"1,284"`), so the animation does too. */
  grouping: boolean;
}

/** Leading non-digit run, a signed number (`,` grouping, `.` decimal), trailing non-digit run. */
const FIGURE_RE = /^([^0-9-]*)(-?[0-9,]*\.?[0-9]*)([^0-9]*)$/;

/**
 * Parse a figure out of fallback text.
 *
 * Assumes `,` groups and `.` decimals — en-US-style, matching the grouping
 * `Intl.NumberFormat`'s default locale already uses in `formatterFor`. There is
 * no per-locale fallback text to parse it against instead: the fallback is
 * authored once and must mean the same thing whether or not JS ever runs.
 */
export function parseFigure(text: string, decimalsOverride?: number): ParsedFigure {
  const match = FIGURE_RE.exec(text.trim());
  const numeric = match?.[2] || '0';
  const decimalPart = numeric.split('.')[1];
  return {
    prefix: (match?.[1] ?? '').trim(),
    suffix: (match?.[3] ?? '').trim(),
    value: Number.parseFloat(numeric.replace(/,/g, '')) || 0,
    decimals: decimalsOverride ?? decimalPart?.length ?? 0,
    grouping: numeric.includes(','),
  };
}

/** A formatter that renders `value` the same way the parsed fallback text did. */
export function formatterFor(parsed: ParsedFigure): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouping,
  });
}

/**
 * Named easing curves a `data-easing` attribute can select, mapped to the CSS
 * value that reads the real token — never a duplicated bezier/linear() literal,
 * so a curve edited in `animation.css` cannot drift out of step here.
 */
const EASING_TOKENS: Readonly<Record<string, string>> = {
  linear: 'linear',
  'ease-in': 'var(--custom-ease-in)',
  'ease-out': 'var(--custom-ease-out)',
  'float-sine': 'var(--ease-float-sine)',
  'float-bounce': 'var(--ease-float-bounce)',
};

/** The CSS value for a named easing curve, or `undefined` for an absent/unrecognised name. */
export function easingToken(name: string | null | undefined): string | undefined {
  return name ? EASING_TOKENS[name] : undefined;
}
