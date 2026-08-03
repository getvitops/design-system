/**
 * Palette expansion + semantic colour tokens.
 *
 * A palette hue is authored one of two ways:
 *   • `{ seed, anchors? }` — an 11-step numeric scale (50…950) generated in
 *     OKLCH via @getvitops/utils/color. Lightness comes from the shared
 *     `LIGHTNESS_LADDER`; the seed (and any anchors) are reproduced verbatim at
 *     their steps.
 *   • `{ tones }` — a fixed brand kit: authored tones placed verbatim at their
 *     nearest steps + tinted endpoints; nothing else is invented (strict kits).
 *
 * **The grammar.** Every role gets tokens named `--color-<target>-<role>[-<variant>]`,
 * where target ∈ bg | text | icon | border. Putting the target *inside* the name is
 * the point: `--color-bg-danger-muted` and `--color-text-danger-muted` are distinct
 * tokens, so the two axes that used to collide over one `<family>-<role>-<modifier>
 * ` namespace cannot any more. The utility class is the token name minus `--color-`.
 *
 * Variants are ordinal — xx-muted < x-muted < muted < (bare) < bold < x-bold —
 * and the tables are **sparse**: a target only emits the cells that are actually
 * viable. `bold` means "more emphatic than the role's default in the current
 * appearance", not "darker"; the appearance decides polarity.
 *
 * Roles come in two kinds (declared in `colors.roles`):
 *   • `surface` — a page/panel colour. Has a bare `bg-<role>` plus the full
 *     emphasis range and the complete text scale.
 *   • `chromatic` (default) — a signal colour. Backgrounds split into *tints*
 *     (`bg-<role>-x-muted` / `-muted`) and *solids* (`bg-<role>-solid[-bold|-x-bold]`);
 *     there is deliberately **no bare `bg-<role>`**, because "how loud?" is a
 *     question the author has to answer.
 *
 * Dark mode re-points which step each token reads; the solid family and the
 * `text-on-<role>` foreground computed against it stay mode-stable, so a filled
 * button keeps its identity across appearances.
 */
import {
  LIGHTNESS_LADDER,
  contrastLc,
  generateOklchPalette,
  hexToOklch,
  oklchStringToHex,
  pickOn,
  tintedEndpoints,
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

/**
 * Lightness of each numeric step. Re-exported from the engine's ladder rather
 * than restated — there used to be three copies of this curve (here, the engine,
 * and the linter) and they were free to drift.
 */
const STEP_L = Object.fromEntries(
  NUMERIC_STEPS.map((s) => [s, LIGHTNESS_LADDER[Number(s) as keyof typeof LIGHTNESS_LADDER]]),
) as Record<NumStep, number>;

export interface ExpandedHue {
  /** Numeric steps (sparse for fixed-tone kits). */
  numeric: Partial<Record<NumStep, string>>;
  /** True when only authored tones + endpoints exist (no interpolation). */
  sparse?: boolean;
  /**
   * Steps the author pinned, and how far each sits from the ladder's lightness.
   * A pinned colour is reproduced exactly, so a large value here is legal — but
   * it means this hue reads heavier or lighter than its siblings at that step,
   * which the generator surfaces as a warning.
   */
  deviations?: Partial<Record<NumStep, number>>;
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

/**
 * Claim `step` for `value`, refusing to overwrite a step another colour already
 * took.
 *
 * Silently dropping one of two colliding tones is the worst outcome: the palette
 * still builds, and the tone the author cared about is simply gone. The record
 * form (`tones: { "600": "#…", "700": "#…" }`) is the escape hatch, so the error
 * points at it.
 */
function claim(
  into: Record<string, string>,
  step: string,
  value: string,
  hueLabel: string,
  what: string,
): void {
  const taken = into[step];
  if (taken != null && taken !== value) {
    throw new Error(
      `palette hue "${hueLabel}": ${what} ${value} and ${taken} both map to step ${step}. ` +
        `Key them explicitly, e.g. { "${step}": "${taken}", "${Number(step) + 100}": "${value}" }.`,
    );
  }
  into[step] = value;
}

function expandSeeded(input: SeedInput, hueLabel: string): ExpandedHue {
  // The seed and any author anchors pin verbatim at their natural (or explicit)
  // steps; the engine fills every other step from the shared lightness ladder,
  // fading chroma toward the tinted ends. No implicit 50/950 anchors any more —
  // the ladder already defines the endpoints, and pinning them would override it.
  // Author anchors are placed FIRST and may collide only with each other. The
  // seed goes in afterwards, and only where an anchor hasn't already claimed the
  // step: an explicit anchor is the author overriding that step, which is exactly
  // what the live editor writes when you recolour a swatch. Treating that as a
  // collision would break the editor's save path.
  const anchors: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.anchors ?? {})) {
    const step = (NUMERIC_STEPS as readonly string[]).includes(key)
      ? key
      : nearestStep(hexToOklch(value).l);
    claim(anchors, step, toOklchStr(value), hueLabel, 'anchors');
  }
  const seedStep = nearestStep(hexToOklch(input.seed).l);
  anchors[seedStep] ??= toOklchStr(input.seed);
  const scale = generateOklchPalette(anchors) as Record<string, string>;
  const numeric: Partial<Record<NumStep, string>> = {};
  for (const s of NUMERIC_STEPS) if (scale[s] != null) numeric[s] = oklchStringToHex(scale[s]);
  return { numeric, deviations: deviationsFor(anchors) };
}

function expandTones(input: TonesInput, hueLabel: string): ExpandedHue {
  // Strict kit: authored tones verbatim at their nearest step; add tinted
  // endpoints (the one allowed exception); interpolate nothing else.
  const entries: Array<[string | null, string]> = Array.isArray(input.tones)
    ? input.tones.map((hex) => [null, hex])
    : Object.entries(input.tones).map(([k, hex]) => [k, hex]);

  const placed: Record<string, string> = {};
  for (const [key, hex] of entries) {
    const step =
      key != null && (NUMERIC_STEPS as readonly string[]).includes(key)
        ? key
        : nearestStep(hexToOklch(hex).l);
    claim(placed, step, hex, hueLabel, 'tones');
  }

  const numeric: Partial<Record<NumStep, string>> = {};
  for (const [step, hex] of Object.entries(placed)) numeric[step as NumStep] = hex;

  const firstTone = entries[0]?.[1] ?? '#808080';
  const ends = tintedEndpoints(hexToOklch(firstTone).h);
  numeric['50'] ??= ends.light;
  numeric['950'] ??= ends.dark;

  return { numeric, sparse: true, deviations: deviationsFor(placed) };
}

/** How far each pinned colour sits from its step's ladder lightness. */
function deviationsFor(pinned: Record<string, string>): Partial<Record<NumStep, number>> {
  const out: Partial<Record<NumStep, number>> = {};
  for (const [step, value] of Object.entries(pinned)) {
    const l = isHex(value) ? hexToOklch(value).l : hexToOklch(oklchStringToHex(value)).l;
    out[step as NumStep] = l - STEP_L[step as NumStep];
  }
  return out;
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
    if (typeof e?.seed === 'string') out[name] = expandSeeded(e as SeedInput, name);
    else if (e?.tones != null) out[name] = expandTones(e as TonesInput, name);
    else throw new Error(`palette hue "${name}" must have a "seed" or "tones"`);
  }
  return out;
}

/**
 * Warn about pinned colours that sit noticeably off the ladder. Not an error:
 * the author asked for that exact colour and gets it. But at ~0.03 L the hue
 * starts reading visibly heavier or lighter than its siblings at that step, and
 * that is the class of drift the fixed ladder exists to prevent.
 */
export const LADDER_TOLERANCE = 0.03;

export function ladderWarnings(palette: Record<string, ExpandedHue>): string[] {
  const warnings: string[] = [];
  for (const [hue, expanded] of Object.entries(palette)) {
    for (const [step, deviation] of Object.entries(expanded.deviations ?? {})) {
      if (Math.abs(deviation as number) <= LADDER_TOLERANCE) continue;
      const dir = (deviation as number) > 0 ? 'lighter' : 'darker';
      warnings.push(
        `colors.palette.${hue}: the colour pinned at step ${step} is ${Math.abs(
          deviation as number,
        ).toFixed(3)} ${dir} than the shared lightness ladder — this hue will read ` +
          `${dir} than others at ${step}. Legal, but move it to a neighbouring step if that wasn't intended.`,
      );
    }
  }
  return warnings;
}

/**
 * Gamut mapping nudges lightness by a hair, so an exact `<` comparison would
 * report rounding as an inversion. Well below any deviation a person could see.
 */
const MONOTONIC_EPSILON = 1e-3;

/**
 * Ramps whose lightness does not fall monotonically from 50 to 950.
 *
 * A ramp built from the ladder alone cannot invert — only pinned colours (a seed,
 * an `anchor`, a `tones` entry) can, because they are the one thing allowed off
 * it. `ladderWarnings` will not catch it: it compares each pinned step against
 * *its own* ladder rung, never against its neighbours, so it reports the wrong
 * defect ("reads darker than others at 600") while the real problem is that 600
 * is darker than 700. And since `LADDER_TOLERANCE` is 0.03 — the same size as the
 * ladder's own 50→100 gap — two anchors can each sit within tolerance and still
 * invert, with no warning at all.
 *
 * This is an error rather than a warning because the rest of the system assumes
 * the order: `snap` picks the nearest step by ladder lightness, the mode-stable
 * solid family hard-codes 600/700/800 as increasingly dark, and both dark tables
 * re-point steps on the same assumption. An inverted ramp therefore runs hover
 * states backwards — the failure the fixed ladder was introduced to eliminate.
 */
export function monotonicityErrors(palette: Record<string, ExpandedHue>): string[] {
  const errors: string[] = [];
  for (const [hue, expanded] of Object.entries(palette)) {
    const numeric = expanded.numeric ?? {};
    // Present steps only — a sparse `tones` kit is legal, and comparing against
    // absent steps would invent inversions that aren't there.
    const steps = NUMERIC_STEPS.filter((s) => numeric[s] != null);
    for (let i = 1; i < steps.length; i++) {
      const [prev, step] = [steps[i - 1] as NumStep, steps[i] as NumStep];
      // The final hex, not the nominal ladder value: a pinned colour is emitted
      // verbatim, and it is precisely the pinned steps that can invert.
      const lPrev = hexToOklch(numeric[prev] as string).l;
      const lStep = hexToOklch(numeric[step] as string).l;
      if (lStep < lPrev + MONOTONIC_EPSILON) continue;
      // Point at the colour the author actually wrote. Only a pinned step can be
      // off the ladder, so naming its correct home is the actionable half — the
      // unpinned neighbour is already exactly where it belongs, and telling
      // someone to move that one sends them the wrong way.
      const pinned = expanded.deviations ?? {};
      const culprits = ([prev, step] as NumStep[]).filter((s) => pinned[s] != null);
      const fix = culprits.length
        ? culprits
            .map((s) => {
              const l = hexToOklch(numeric[s] as string).l;
              return `${numeric[s]} (pinned at ${s}) sits at L ${l.toFixed(3)}, nearest step ${nearestStep(l)}`;
            })
            .join('; ')
        : `no step here is pinned, so this is a bug in the generator rather than in your config`;
      errors.push(
        `colors.palette.${hue}: step ${step} (${numeric[step]}, L ${lStep.toFixed(3)}) is LIGHTER ` +
          `than step ${prev} (${numeric[prev]}, L ${lPrev.toFixed(3)}). A ramp must darken from 50 ` +
          `to 950 — inverted, a hover from \`bg-<role>-solid\` to \`-solid-bold\` gets lighter, and ` +
          `the dark-mode tables re-point steps assuming the order. ${fix}.`,
      );
    }
  }
  return errors;
}

// ── the token tables ─────────────────────────────────────────────────────────

/** Which shape of token set a role gets. */
export type RoleKind = 'surface' | 'chromatic';

/** Token key → numeric step. Keys are `<target>[-<variant>]`; see `tokenVar`. */
type Table = Record<string, NumStep>;

/**
 * Surface roles: a bare `bg` (cards, panels, inputs), `bg-muted` for the page
 * behind them, `bg-x-muted` for wells, and `bg-bold`/`-x-bold` for the inverse
 * surface a tooltip sits on. Elevation is expressed by *which* token you reach
 * for — page `bg-muted`, card `bg` — rather than by a raised/sunken pair. That
 * is what lets a future `data-surfaces` axis flatten it without touching markup.
 */
const SURFACE_LIGHT: Table = {
  bg: '50',
  'bg-muted': '100',
  'bg-x-muted': '200',
  'bg-bold': '800',
  'bg-x-bold': '950',
  text: '900',
  'text-bold': '950',
  'text-muted': '700',
  'text-x-muted': '500',
  'text-xx-muted': '400',
  'text-on-bold': '50',
  icon: '600',
  'icon-muted': '500',
  'border-muted': '200',
  border: '300',
  'border-bold': '600',
};
const SURFACE_DARK: Table = {
  bg: '900',
  'bg-muted': '950',
  'bg-x-muted': '950',
  'bg-bold': '200',
  'bg-x-bold': '50',
  text: '100',
  'text-bold': '50',
  // 300 and 400, not v3.1's 400 and 500: those were tuned against WCAG and come
  // up short of APCA's secondary-text and non-text bars over a dark surface.
  'text-muted': '300',
  'text-x-muted': '500',
  'text-xx-muted': '600',
  'text-on-bold': '950',
  icon: '400',
  'icon-muted': '500',
  'border-muted': '800',
  border: '700',
  'border-bold': '400',
};

/**
 * Chromatic roles: tints for alert/badge backgrounds, solids for fills. No bare
 * `bg` — see the module docblock. No `text-muted` either: a de-emphasised
 * coloured text could not hold its contrast target off a white surface, so the
 * way to soften coloured text is weight/size, not another colour.
 */
const CHROMATIC_LIGHT: Table = {
  'bg-x-muted': '50',
  'bg-muted': '100',
  text: '700',
  'text-bold': '900',
  icon: '600',
  border: '200',
  'border-bold': '300',
};
const CHROMATIC_DARK: Table = {
  'bg-x-muted': '950',
  'bg-muted': '900',
  text: '300',
  'text-bold': '200',
  icon: '400',
  border: '800',
  'border-bold': '700',
};

/**
 * The solid family — mode-stable, so a filled button keeps its identity when the
 * appearance flips. Fixed steps rather than the old scan-and-clamp: with a shared
 * lightness ladder every hue's 600 already sits at the same lightness, so there
 * is nothing left to search for. `text-on-<role>` is computed against `bg-solid`.
 */
const SOLID: Table = { 'bg-solid': '600', 'bg-solid-bold': '700', 'bg-solid-x-bold': '800' };

/**
 * Map a token key to its CSS custom property for a given role.
 *
 * `on` is the one irregular case: the foreground for a filled surface reads
 * `--color-text-on-<role>`, with the role *after* `on`, because it names what it
 * sits on rather than what it is.
 *
 * The utility class name is this minus the `--color-` prefix, which is why the
 * emitter and the linter can both derive their vocabulary from one function.
 */
export function tokenVar(role: string, key: string): string {
  const dash = key.indexOf('-');
  const target = dash === -1 ? key : key.slice(0, dash);
  const variant = dash === -1 ? '' : key.slice(dash + 1);
  if (variant === 'on') return `--color-${target}-on-${role}`;
  if (variant.startsWith('on-')) return `--color-${target}-on-${role}-${variant.slice(3)}`;
  return variant ? `--color-${target}-${role}-${variant}` : `--color-${target}-${role}`;
}

/** The class name a token key produces for a role (`bg-danger-solid`, …). */
export const tokenClass = (role: string, key: string): string =>
  tokenVar(role, key).slice('--color-'.length);

export interface FunctionalRole {
  role: string;
  hue: string;
  kind: RoleKind;
  /** token key → CSS value, per appearance. */
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** Resolve the token set for one role over its hue. */
export function functionalRole(
  role: string,
  hueName: string,
  hue: ExpandedHue,
  kind: RoleKind = 'chromatic',
): FunctionalRole {
  const numeric = hue.numeric;
  const v = (n: NumStep) => `var(--color-${hueName}-${snap(numeric, n)})`;
  const hex = (n: NumStep) => numeric[snap(numeric, n)] as string;

  const map = (table: Table): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [token, step] of Object.entries(table)) out[token] = v(step);
    return out;
  };

  // Solids and the foreground computed against them are identical in both
  // appearances — that mode-stability is the whole point of the family.
  const solids = map(SOLID);
  const onSolid = pickOn(hex(SOLID['bg-solid'] as NumStep));

  const light = {
    ...map(kind === 'surface' ? SURFACE_LIGHT : CHROMATIC_LIGHT),
    ...solids,
    'text-on': onSolid,
  };
  const dark = {
    ...map(kind === 'surface' ? SURFACE_DARK : CHROMATIC_DARK),
    ...solids,
    'text-on': onSolid,
  };
  return { role, hue: hueName, kind, light, dark };
}

// ── the contrast contract ────────────────────────────────────────────────────

/**
 * APCA targets. `TEXT` is the body-text bar; `SECONDARY` covers text on a
 * non-primary surface and de-emphasised text. `NON_TEXT` is the icon/boundary
 * tier — the APCA analogue of WCAG's 3:1, where a glyph may run more vivid than
 * text because shape carries meaning alongside contrast.
 */
export const CONTRAST = { TEXT: 75, SECONDARY: 60, NON_TEXT: 45 } as const;

/**
 * Text tokens deliberately exempt from the contract. Placeholders and disabled
 * text are required to look unavailable; holding them to the body-text bar would
 * defeat the affordance. Nothing else may be exempt.
 */
const EXEMPT_TEXT = new Set(['text-x-muted', 'text-xx-muted']);

/**
 * Verify a role's contrast targets. Returns human-readable failures.
 *
 * Chromatic roles are checked against the surface planes they actually sit on
 * (`surfaceBg`) as well as their own tints — coloured text almost never appears
 * over its own solid, it appears over the page. Checking only within the role
 * would have missed the pairing that matters most.
 */
export function checkContrast(
  fr: FunctionalRole,
  numericOf: (hueName: string) => Partial<Record<NumStep, string>>,
  surfaceBg?: { light: string[]; dark: string[] },
): string[] {
  const failures: string[] = [];
  const resolve = (val: string): string => {
    const m = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/.exec(val);
    if (!m) return val;
    return numericOf(m[1] as string)[m[2] as NumStep] ?? val;
  };
  const fail = (appearance: string, msg: string) =>
    failures.push(`${fr.role}/${appearance}: ${msg}`);

  for (const [appearance, tokens] of [
    ['light', fr.light],
    ['dark', fr.dark],
  ] as const) {
    // Backgrounds this role's own foregrounds have to work on. For a surface
    // role that's its own planes; for a chromatic role it's the page surface
    // plus its own tints.
    const ownBg = Object.keys(tokens)
      .filter((k) => k === 'bg' || k.startsWith('bg-'))
      .filter((k) => !k.startsWith('bg-solid'))
      .filter((k) => !k.startsWith('bg-bold') && !k.startsWith('bg-x-bold'));
    const planes: Array<[string, string]> =
      fr.kind === 'surface'
        ? ownBg.map((k) => [k, resolve(tokens[k] as string)])
        : [
            ...(surfaceBg?.[appearance] ?? []).map(
              (h, i) => [`surface#${i}`, h] as [string, string],
            ),
            ...ownBg.map((k) => [k, resolve(tokens[k] as string)] as [string, string]),
          ];

    for (const [planeName, bg] of planes) {
      // `bg` is the role's primary surface and holds the full body-text bar;
      // every other plane holds the secondary bar.
      const textMin = planeName === 'bg' ? CONTRAST.TEXT : CONTRAST.SECONDARY;
      for (const key of ['text', 'text-bold', 'text-muted']) {
        if (tokens[key] == null || EXEMPT_TEXT.has(key)) continue;
        const min = key === 'text-muted' ? CONTRAST.SECONDARY : textMin;
        const lc = contrastLc(resolve(tokens[key] as string), bg);
        if (lc < min) fail(appearance, `${key} Lc ${lc.toFixed(1)} < ${min} on ${planeName} ${bg}`);
      }
      // Icons carry meaning, so they hold the non-text bar everywhere. Borders
      // do not: a chromatic `border-<role>` is *decorative* — the tinted edge of
      // an alert, where the colour reinforces a message the text already makes.
      // Only a surface role's `border-bold` is the "this boundary is the only
      // thing separating two regions" token, so only that one is guaranteed.
      const nonText = fr.kind === 'surface' ? ['icon', 'border-bold'] : ['icon'];
      for (const key of nonText) {
        if (tokens[key] == null) continue;
        const lc = contrastLc(resolve(tokens[key] as string), bg);
        if (lc < CONTRAST.NON_TEXT)
          fail(
            appearance,
            `${key} Lc ${lc.toFixed(1)} < ${CONTRAST.NON_TEXT} on ${planeName} ${bg}`,
          );
      }
    }

    // The filled-surface pairing: text-on against the solid it names.
    const solid = resolve(tokens['bg-solid'] as string);
    const onLc = contrastLc(tokens['text-on'] as string, solid);
    if (onLc < CONTRAST.SECONDARY)
      fail(appearance, `text-on Lc ${onLc.toFixed(1)} < ${CONTRAST.SECONDARY} on bg-solid`);

    // The inverse surface, where it exists.
    if (tokens['bg-bold'] != null && tokens['text-on-bold'] != null) {
      const lc = contrastLc(resolve(tokens['text-on-bold'] as string), resolve(tokens['bg-bold']));
      if (lc < CONTRAST.TEXT)
        fail(appearance, `text-on-bold Lc ${lc.toFixed(1)} < ${CONTRAST.TEXT} on bg-bold`);
    }
  }
  return failures;
}
