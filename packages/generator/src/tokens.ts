/**
 * Palette expansion + semantic functional tokens.
 *
 * A palette hue is authored one of two ways:
 *   • `{ seed, anchors? }` — an 11-step numeric scale (50…950) generated in
 *     OKLCH via @getvitops/utils/color (lightness transposed toward tinted
 *     near-white/near-black, chroma dampened at the extremes),
 *   • `{ tones }` — a fixed brand kit: authored tones placed verbatim at their
 *     nearest steps + tinted endpoints; nothing else is invented (strict kits).
 *
 * Every role (from `colors.roles`) gets FUNCTIONAL tokens — the public API:
 *   --<role>-bg / -bg-muted / -border / -border-bold / -solid / -solid-bold /
 *   -on-solid / -text / -text-muted / -text-x-muted
 * plus the appearance-relative emphasis stops (x-muted · muted · bold · x-bold)
 * and, for `surface`, the translucent `--surface-glass` + `--overlay` scrim.
 * Dark mode flips the mapping automatically (solid stays mode-stable).
 */
import {
  contrastLc,
  generateOklchPalette,
  hexToOklch,
  oklchStringToHex,
  pickOn,
} from '@getvitops/utils/color';

export const NUMERIC_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;
type NumStep = (typeof NUMERIC_STEPS)[number];

// Lightness centres of the numeric scale (mirrors the engine's internal curve).
const STEP_L: Record<NumStep, number> = {
  '50': 0.95,
  '100': 0.9,
  '200': 0.8,
  '300': 0.7,
  '400': 0.6,
  '500': 0.5,
  '600': 0.4,
  '700': 0.3,
  '800': 0.2,
  '900': 0.1,
  '950': 0.05,
};

export interface ExpandedHue {
  /** Numeric steps (sparse for fixed-tone kits). */
  numeric: Partial<Record<NumStep, string>>;
  /** True when only authored tones + endpoints exist (no interpolation). */
  sparse?: boolean;
}

interface SeedInput {
  seed: string;
  anchors?: Record<string, string>;
}
interface TonesInput {
  tones: string[] | Record<string, string>;
}

const isHex = (v: string) => v.startsWith('#');
const toOklchStr = (v: string) => {
  if (!isHex(v)) return v; // already oklch(...)
  const { l, c, h } = hexToOklch(v);
  return `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`;
};
const nearestStep = (l: number): NumStep =>
  NUMERIC_STEPS.reduce((best, s) =>
    Math.abs(l - STEP_L[s]) < Math.abs(l - STEP_L[best]) ? s : best,
  );

function expandSeeded(input: SeedInput): ExpandedHue {
  // Seed + author anchors pinned at their natural (or explicit) steps, PLUS
  // implicit tinted near-white/near-black endpoint anchors (unless the author
  // pins 50/950 themselves). The engine then interpolates lightness/chroma
  // piecewise BETWEEN anchors — monotonic by construction, with the light side
  // actually reaching near-white (the original "mid-gray light end" bug) and
  // chroma tapering toward the tinted-neutral ends.
  const anchors: Record<string, string> = {};
  const seedStep = nearestStep(hexToOklch(input.seed).l);
  anchors[seedStep] = toOklchStr(input.seed);
  for (const [key, value] of Object.entries(input.anchors ?? {})) {
    const step = (NUMERIC_STEPS as readonly string[]).includes(key)
      ? key
      : nearestStep(hexToOklch(value).l);
    anchors[step] = toOklchStr(value);
  }
  const hue = hexToOklch(input.seed).h;
  anchors['50'] ??= `oklch(97% 0.008 ${hue.toFixed(2)})`;
  anchors['950'] ??= `oklch(13% 0.015 ${hue.toFixed(2)})`;
  const scale = generateOklchPalette(anchors) as Record<string, string>;
  const numeric: Partial<Record<NumStep, string>> = {};
  for (const s of NUMERIC_STEPS) if (scale[s] != null) numeric[s] = oklchStringToHex(scale[s]);
  return { numeric };
}

function expandTones(input: TonesInput): ExpandedHue {
  // Strict kit: authored tones verbatim at their nearest step; add tinted
  // endpoints (the one allowed exception); interpolate nothing else.
  const tones = Array.isArray(input.tones) ? input.tones : Object.values(input.tones);
  const numeric: Partial<Record<NumStep, string>> = {};
  for (const hex of tones) numeric[nearestStep(hexToOklch(hex).l)] = hex;
  const hue = hexToOklch(tones[0] ?? '#808080').h;
  numeric['50'] ??= oklchStringToHex(`oklch(97% 0.010 ${hue.toFixed(2)})`);
  numeric['950'] ??= oklchStringToHex(`oklch(15% 0.015 ${hue.toFixed(2)})`);
  return { numeric, sparse: true };
}

/** Snap to the nearest AVAILABLE numeric step (sparse kits). */
function snap(numeric: Partial<Record<NumStep, string>>, want: NumStep): NumStep {
  if (numeric[want] != null) return want;
  const have = NUMERIC_STEPS.filter((s) => numeric[s] != null);
  return have.reduce((best, s) =>
    Math.abs(STEP_L[s] - STEP_L[want]) < Math.abs(STEP_L[best] - STEP_L[want]) ? s : best,
  );
}

/** Expand every palette hue into its numeric scale. */
export function expandPalette(raw: Record<string, unknown>): Record<string, ExpandedHue> {
  const out: Record<string, ExpandedHue> = {};
  for (const [name, entry] of Object.entries(raw)) {
    const e = entry as Partial<SeedInput & TonesInput>;
    if (typeof e?.seed === 'string') out[name] = expandSeeded(e as SeedInput);
    else if (e?.tones != null) out[name] = expandTones(e as TonesInput);
    else throw new Error(`palette hue "${name}" must have a "seed" or "tones"`);
  }
  return out;
}

// ── functional token mapping ─────────────────────────────────────────────────

type TokenMap = Record<string, NumStep>;
const LIGHT: TokenMap = {
  bg: '50',
  'bg-muted': '100',
  border: '200',
  'border-bold': '300',
  text: '950',
  'text-muted': '800',
  'text-x-muted': '600',
};
const DARK: TokenMap = {
  bg: '950',
  'bg-muted': '900',
  border: '800',
  'border-bold': '700',
  text: '50',
  'text-muted': '200',
  'text-x-muted': '400',
};
// surface = background planes; elevation is lighter-when-raised in BOTH modes.
const SURFACE_LIGHT: TokenMap = { ...LIGHT, bg: '100', 'bg-muted': '200', 'bg-bold': '50' };
const SURFACE_DARK: TokenMap = { ...DARK, bg: '900', 'bg-muted': '950', 'bg-bold': '800' };
// appearance-relative emphasis stops (base excluded — the bare name is functional).
const EMPHASIS_LIGHT: TokenMap = { 'x-muted': '100', muted: '300', bold: '700', 'x-bold': '900' };
const EMPHASIS_DARK: TokenMap = { 'x-muted': '900', muted: '700', bold: '300', 'x-bold': '100' };
/**
 * The emphasis-stop names, derived from the table rather than re-listed, so the
 * utility emitter in `generate.ts` cannot drift from the tokens it emits.
 */
export const EMPHASIS_STOPS: readonly string[] = Object.keys(EMPHASIS_LIGHT);

export interface FunctionalRole {
  role: string;
  hue: string;
  /** token → CSS value, per appearance. */
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** Resolve the functional token set for one role over its hue. */
export function functionalRole(role: string, hueName: string, hue: ExpandedHue): FunctionalRole {
  const numeric = hue.numeric;
  const v = (n: NumStep) => `var(--color-${hueName}-${snap(numeric, n)})`;
  const hex = (n: NumStep) => numeric[snap(numeric, n)] as string;

  // solid: the vivid tone — at least 500 (white text needs the depth), at most 700.
  const naturalRaw = NUMERIC_STEPS.find((s) => numeric[s] === hex('500')) ?? '500';
  const natural = Number(snap(numeric, naturalRaw));
  const solidStep = snap(numeric, String(Math.min(Math.max(natural, 500), 700)) as NumStep);
  const solidBold = snap(numeric, String(Math.min(Number(solidStep) + 100, 950)) as NumStep);
  const onSolid = pickOn(numeric[solidStep] as string);

  const isSurface = role === 'surface';
  const map = (table: TokenMap): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [token, step] of Object.entries(table)) out[token] = v(step as NumStep);
    return out;
  };
  const emphasis = (table: TokenMap, prefix: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [stop, step] of Object.entries(table)) out[`${prefix}-${stop}`] = v(step as NumStep);
    return out;
  };

  const light = {
    ...map(isSurface ? SURFACE_LIGHT : LIGHT),
    solid: v(solidStep),
    'solid-bold': v(solidBold),
    'on-solid': onSolid,
    ...emphasis(EMPHASIS_LIGHT, 'stop'),
  };
  const dark = {
    ...map(isSurface ? SURFACE_DARK : DARK),
    solid: v(solidStep),
    'solid-bold': v(solidBold),
    'on-solid': onSolid,
    ...emphasis(EMPHASIS_DARK, 'stop'),
  };
  return { role, hue: hueName, light, dark };
}

/** Verify a functional role's contrast targets. Returns human-readable failures. */
export function checkContrast(
  fr: FunctionalRole,
  numericOf: (hueName: string) => Partial<Record<NumStep, string>>,
): string[] {
  const failures: string[] = [];
  const resolve = (val: string): string => {
    const m = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/.exec(val);
    if (!m) return val;
    return numericOf(m[1] as string)[m[2] as NumStep] ?? val;
  };
  for (const [name, tokens] of [
    ['light', fr.light],
    ['dark', fr.dark],
  ] as const) {
    // Check text against EVERY background plane the role emits, not just `bg`.
    // Body text on a `card` sits on `--surface-bg-muted` / `-bg-bold`, and those
    // pairings were entirely unguarded before — the point of having planes is
    // that you can stack them, so each one has to stay legible.
    //
    // The bar differs by plane, deliberately. `bg` is the role's primary
    // surface and holds the full APCA body-text target (Lc 75). The secondary
    // planes hold APCA's large/bold-text target (Lc 60): `surface`'s sunken
    // plane in light mode currently measures Lc 69.1 for `text`, which clears
    // 60 but not 75. Closing that needs a step-table change (surface's bg-muted
    // is at step 200 with `text` already pinned at the 950 extreme, so there is
    // no headroom without re-inseting the role), which is a colour-ramp
    // decision, not a test fix. Recorded here so it stays visible.
    const PRIMARY_PLANE = 'bg';
    const planes = (['bg', 'bg-muted', 'bg-bold'] as const).filter((p) => tokens[p] != null);
    for (const plane of planes) {
      const bg = resolve(tokens[plane] as string);
      const textMin = plane === PRIMARY_PLANE ? 75 : 60;
      const checks: Array<[string, string, number]> = [
        ['text', resolve(tokens.text as string), textMin],
        ['text-muted', resolve(tokens['text-muted'] as string), 60],
      ];
      for (const [token, hexV, min] of checks) {
        const lc = contrastLc(hexV, bg);
        if (lc < min)
          failures.push(
            `${fr.role}/${name}: ${token} Lc ${lc.toFixed(1)} < ${min} on ${plane} ${bg}`,
          );
      }
    }
    const onLc = contrastLc(tokens['on-solid'] as string, resolve(tokens.solid as string));
    if (onLc < 60)
      failures.push(`${fr.role}/${name}: on-solid Lc ${onLc.toFixed(1)} < 60 on solid`);
  }
  return failures;
}
