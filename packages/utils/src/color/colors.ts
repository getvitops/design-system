import Color from 'colorjs.io';
import {
  OKLCH as OKLCH_Space,
  sRGB as sRGB_Space,
  P3 as P3_Space,
  ColorSpace,
  to,
  toGamutCSS,
  clone,
  serialize,
  type PlainColorObject,
} from 'colorjs.io/fn';

// Register color spaces once for functional API
ColorSpace.register(OKLCH_Space);
ColorSpace.register(sRGB_Space);
ColorSpace.register(P3_Space);

export interface RgbResult {
  r: number;
  g: number;
  b: number;
  inGamut: boolean;
  /** Max channel overshoot beyond [0,1] before clamping. 0 when in gamut. */
  gamutDistance: number;
}

/**
 * Convert OKLCh to sRGB, returning 0-255 clamped values with gamut flag.
 * Fast path for per-pixel canvas rendering (no gamut mapping, just clamp).
 */
export function oklchToSrgb(l: number, c: number, h: number): RgbResult {
  const col: PlainColorObject = { space: OKLCH_Space, coords: [l, c, h], alpha: 1 };
  const rgb = to(col, sRGB_Space);
  const [r, g, b] = rgb.coords;
  const inGamut = r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;
  const gamutDistance = inGamut ? 0 : Math.max(-r, r - 1, -g, g - 1, -b, b - 1, 0);
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255))),
    inGamut,
    gamutDistance,
  };
}

/**
 * Convert OKLCh to Display P3, returning 0-255 clamped values with gamut flag.
 * Fast path for per-pixel canvas rendering on P3 displays.
 */
export function oklchToP3(l: number, c: number, h: number): RgbResult {
  const col: PlainColorObject = { space: OKLCH_Space, coords: [l, c, h], alpha: 1 };
  const rgb = to(col, P3_Space);
  const [r, g, b] = rgb.coords;
  const inGamut = r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;
  const gamutDistance = inGamut ? 0 : Math.max(-r, r - 1, -g, g - 1, -b, b - 1, 0);
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255))),
    inGamut,
    gamutDistance,
  };
}

/**
 * Gamut-map an OKLCh color using the CSS gamut mapping algorithm, return hex.
 * Slower than oklchToSrgb/oklchToP3 (uses iterative reduction), use for single colors only.
 */
export function gamutMapOklchToHex(
  l: number,
  c: number,
  h: number,
  space: 'srgb' | 'p3' = 'srgb',
): string {
  const col: PlainColorObject = { space: OKLCH_Space, coords: [l, c, h], alpha: 1 };
  const targetSpace = space === 'p3' ? P3_Space : sRGB_Space;
  const mapped = toGamutCSS(clone(col), { space: targetSpace });
  const rgb = to(mapped, sRGB_Space);
  return serialize(rgb, { format: 'hex' });
}

// Standard 11-step scale - will be transposed based on input anchors
export const STEP_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type StepName = (typeof STEP_NAMES)[number];

export const COLOR_GROUPS = [
  'neutral',
  'brand',
  'primary',
  'accent',
  'complement',
  'success',
  'warning',
  'error',
  'info',
] as const;
export type ColorGroup = (typeof COLOR_GROUPS)[number];

/**
 * Convert hex color to OKLCH components
 */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const color = new Color(hex);
  const oklch = color.to('oklch');
  return {
    l: oklch.coords[0],
    c: oklch.coords[1],
    h: oklch.coords[2] || 0,
  };
}

/**
 * Convert OKLCH components to hex color
 */
export function oklchToHex(oklch: { l: number; c: number; h: number }): string {
  const color = new Color('oklch', [oklch.l, oklch.c, oklch.h]);
  // Convert to sRGB and clamp to gamut, then format as hex
  const srgb = color.to('srgb');
  if (!srgb.inGamut()) {
    srgb.toGamut({ method: 'css' });
  }
  return srgb.toString({ format: 'hex' });
}

/**
 * Convert OKLCH CSS string to hex color
 * @example oklchStringToHex("oklch(50% 0.15 270)") => "#8b5cf6"
 */
export function oklchStringToHex(oklchString: string): string {
  try {
    const color = new Color(oklchString);
    const srgb = color.to('srgb');
    if (!srgb.inGamut()) {
      srgb.toGamut({ method: 'css' });
    }
    return srgb.toString({ format: 'hex' });
  } catch {
    return '#808080';
  }
}

/**
 * Format a color name by separating compound words
 * Examples: "mediumseagreen" -> "Medium Sea Green", "darkblue" -> "Dark Blue"
 */
export function formatColorName(name: string): string {
  if (!name) return 'Unknown';

  // Handle special cases with proper word separation
  const specialCases: Record<string, string> = {
    aliceblue: 'Alice Blue',
    antiquewhite: 'Antique White',
    blanchedalmond: 'Blanched Almond',
    blueviolet: 'Blue Violet',
    burlywood: 'Burly Wood',
    cadetblue: 'Cadet Blue',
    cornflowerblue: 'Cornflower Blue',
    darkblue: 'Dark Blue',
    darkcyan: 'Dark Cyan',
    darkgoldenrod: 'Dark Goldenrod',
    darkgray: 'Dark Gray',
    darkgreen: 'Dark Green',
    darkgrey: 'Dark Grey',
    darkkhaki: 'Dark Khaki',
    darkmagenta: 'Dark Magenta',
    darkolivegreen: 'Dark Olive Green',
    darkorange: 'Dark Orange',
    darkorchid: 'Dark Orchid',
    darkred: 'Dark Red',
    darksalmon: 'Dark Salmon',
    darkseagreen: 'Dark Sea Green',
    darkslateblue: 'Dark Slate Blue',
    darkslategray: 'Dark Slate Gray',
    darkslategrey: 'Dark Slate Grey',
    darkturquoise: 'Dark Turquoise',
    darkviolet: 'Dark Violet',
    deeppink: 'Deep Pink',
    deepskyblue: 'Deep Sky Blue',
    dimgray: 'Dim Gray',
    dimgrey: 'Dim Grey',
    dodgerblue: 'Dodger Blue',
    floralwhite: 'Floral White',
    forestgreen: 'Forest Green',
    ghostwhite: 'Ghost White',
    greenyellow: 'Green Yellow',
    hotpink: 'Hot Pink',
    indianred: 'Indian Red',
    lavenderblush: 'Lavender Blush',
    lawngreen: 'Lawn Green',
    lemonchiffon: 'Lemon Chiffon',
    lightblue: 'Light Blue',
    lightcoral: 'Light Coral',
    lightcyan: 'Light Cyan',
    lightgoldenrodyellow: 'Light Goldenrod Yellow',
    lightgray: 'Light Gray',
    lightgreen: 'Light Green',
    lightgrey: 'Light Grey',
    lightpink: 'Light Pink',
    lightsalmon: 'Light Salmon',
    lightseagreen: 'Light Sea Green',
    lightskyblue: 'Light Sky Blue',
    lightslategray: 'Light Slate Gray',
    lightslategrey: 'Light Slate Grey',
    lightsteelblue: 'Light Steel Blue',
    lightyellow: 'Light Yellow',
    limegreen: 'Lime Green',
    mediumaquamarine: 'Medium Aquamarine',
    mediumblue: 'Medium Blue',
    mediumorchid: 'Medium Orchid',
    mediumpurple: 'Medium Purple',
    mediumseagreen: 'Medium Sea Green',
    mediumslateblue: 'Medium Slate Blue',
    mediumspringgreen: 'Medium Spring Green',
    mediumturquoise: 'Medium Turquoise',
    mediumvioletred: 'Medium Violet Red',
    midnightblue: 'Midnight Blue',
    mintcream: 'Mint Cream',
    mistyrose: 'Misty Rose',
    navajowhite: 'Navajo White',
    oldlace: 'Old Lace',
    olivedrab: 'Olive Drab',
    orangered: 'Orange Red',
    palegoldenrod: 'Pale Goldenrod',
    palegreen: 'Pale Green',
    paleturquoise: 'Pale Turquoise',
    palevioletred: 'Pale Violet Red',
    papayawhip: 'Papaya Whip',
    peachpuff: 'Peach Puff',
    powderblue: 'Powder Blue',
    rosybrown: 'Rosy Brown',
    royalblue: 'Royal Blue',
    saddlebrown: 'Saddle Brown',
    sandybrown: 'Sandy Brown',
    seagreen: 'Sea Green',
    skyblue: 'Sky Blue',
    slateblue: 'Slate Blue',
    slategray: 'Slate Gray',
    slategrey: 'Slate Grey',
    springgreen: 'Spring Green',
    steelblue: 'Steel Blue',
    whitesmoke: 'White Smoke',
    yellowgreen: 'Yellow Green',
  };

  const lowerName = name.toLowerCase();
  if (specialCases[lowerName]) {
    return specialCases[lowerName];
  }

  // Default: just capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Get the closest CSS color name for a hex color
 */
export function getColorName(hex: string): string {
  try {
    const color = new Color(hex);
    const oklch = color.to('oklch');
    const hue = oklch.coords[2] || 0;

    if (hue < 30 || hue >= 330) return 'Red';
    if (hue < 60) return 'Orange';
    if (hue < 90) return 'Yellow';
    if (hue < 150) return 'Green';
    if (hue < 210) return 'Cyan';
    if (hue < 270) return 'Blue';
    if (hue < 330) return 'Purple';
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get color name with hue value
 */
export function getColorNameWithHue(hex: string): string {
  try {
    const color = new Color(hex);
    const oklch = color.to('oklch');
    const hue = oklch.coords[2] || 0;
    const roundedHue = Math.round(hue / 10) * 10;
    const name = getColorName(hex);
    return `${name} ${roundedHue}`;
  } catch {
    return 'Unknown';
  }
}

// Color harmony definitions
export const HARMONY_TYPES = [
  'single',
  'analogous',
  'triad',
  'complementary',
  'split-complementary',
  'square',
  'compound',
] as const;
export type HarmonyType = (typeof HARMONY_TYPES)[number];

export interface HarmonyDefinition {
  label: string;
  offsets: number[];
  primaryIndex: number;
}

export const HARMONY_DEFINITIONS: Record<HarmonyType, HarmonyDefinition> = {
  single: {
    label: 'Single',
    offsets: [0],
    primaryIndex: 0,
  },
  analogous: {
    label: 'Analogous',
    offsets: [-30, 0, 30],
    primaryIndex: 1,
  },
  triad: {
    label: 'Triad',
    offsets: [0, 120, 240],
    primaryIndex: 0,
  },
  complementary: {
    label: 'Complementary',
    offsets: [0, 180],
    primaryIndex: 0,
  },
  'split-complementary': {
    label: 'Split Complementary',
    offsets: [0, 150, 210],
    primaryIndex: 0,
  },
  square: {
    label: 'Square',
    offsets: [0, 90, 180, 270],
    primaryIndex: 0,
  },
  compound: {
    label: 'Compound',
    offsets: [-30, 0, 180, 210],
    primaryIndex: 1,
  },
};

/**
 * The shared lightness ladder every ramp is built on (lightest → darkest).
 *
 * Fixed, NOT seed-derived. Two hues at the same step have to read equally light,
 * otherwise one contrast table cannot serve every hue and a `muted` variant means
 * something different depending on which role you ask. Only chroma and hue vary
 * between ramps.
 *
 * The previous engine transposed this curve onto each seed, which let relative
 * luminance at step 300 range from 0.253 (rust) to 0.384 (amber) across the
 * shipped palette — the drift this replaces.
 *
 * Anchored steps are the one deliberate exception: see `generateOklchPalette`.
 */
export const LIGHTNESS_LADDER: Record<StepName, number> = {
  50: 0.98,
  100: 0.95,
  200: 0.9,
  300: 0.83,
  400: 0.74,
  500: 0.65,
  600: 0.54,
  700: 0.47,
  800: 0.38,
  900: 0.29,
  950: 0.21,
};

/**
 * Chroma a ramp decays *towards* beyond its outermost anchors, so the near-white
 * and near-black ends keep a whisper of the hue instead of going flat grey. The
 * dark end carries slightly more because chroma reads weaker against black.
 *
 * It is a CEILING, not a target — `Math.min(ENDPOINT_CHROMA.x, anchor.c)`. That
 * distinction is the whole reason a neutral is authorable. The interpolation
 * factor reaches exactly 1 at steps 50 and 950 for every anchor position, so as a
 * target it made the endpoints these constants *unconditionally*: seeds at chroma
 * 0.001, 0.002, 0.05 and 0.2 all produced a byte-identical step 50. A brand
 * wanting plain white with grey panels had no seed that worked, and chroma 0 was
 * worst of all — colorjs returns NaN hue for a true achromatic colour, which
 * `hexToOklch` collapses to 0, so the "neutral" came out pink.
 *
 * As a ceiling, a low-chroma seed simply stays low and a chroma-0 seed stays 0 at
 * every unanchored step, which makes the NaN-hue collapse invisible rather than
 * something `hexToOklch` has to solve (its `|| 0` is load-bearing for
 * `getColorName`).
 */
export const ENDPOINT_CHROMA = { light: 0.008, dark: 0.015 } as const;

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

/**
 * Parses an OKLCH CSS string into numerical components.
 * @param oklchString - e.g., 'oklch(50% 0.15 270)'
 * @returns Lightness (0-1), Chroma (0-~0.37), Hue (0-360)
 */
export function parseOklch(oklchString: string): OklchColor {
  const parts = oklchString.match(/oklch\(([^ ]+) ([^ ]+) ([^ ]+)\)/);
  if (!parts) throw new Error('Invalid OKLCH string format.');

  const [, lRaw = '', cRaw = '', hRaw = ''] = parts;
  const l = parseFloat(lRaw) / (lRaw.includes('%') ? 100 : 1);
  const c = parseFloat(cRaw);
  const h = parseFloat(hRaw);

  return { l, c, h };
}

/**
 * Linearly interpolates a value between a start and end point.
 */
function lerp(start: number, end: number, factor: number): number {
  return start + factor * (end - start);
}

/**
 * Interpolate hue the short way round the wheel. A ramp anchored at 350° and 10°
 * spans 20°, not 340° — the naive lerp sent it the long way through cyan.
 */
function lerpHue(start: number, end: number, factor: number): number {
  const delta = ((((end - start) % 360) + 540) % 360) - 180;
  return (start + delta * factor + 360) % 360;
}

/**
 * The ladder step whose lightness is closest to `lightness` — i.e. where a
 * supplied colour naturally belongs.
 */
export function assignStepByLightness(lightness: number): StepName {
  let closestStep: StepName = 500;
  let minDiff = Math.abs(lightness - LIGHTNESS_LADDER[500]);

  for (const step of STEP_NAMES) {
    const diff = Math.abs(lightness - LIGHTNESS_LADDER[step]);
    if (diff < minDiff) {
      minDiff = diff;
      closestStep = step;
    }
  }

  return closestStep;
}

/**
 * How far an anchored colour sits from its step's ladder lightness.
 *
 * The generator surfaces this as a warning: a large deviation is legal (the
 * caller asked for that exact colour) but it means the hue will read heavier or
 * lighter than its siblings at that step, which is worth knowing rather than
 * discovering later.
 */
export function ladderDeviation(step: StepName, lightness: number): number {
  return lightness - LIGHTNESS_LADDER[step];
}

/** Absolute chroma ceiling — beyond this nothing survives gamut mapping anyway. */
const MAX_CHROMA = 0.37;

/**
 * Build a complete 11-step OKLCH ramp from one or more anchor colours.
 *
 * **Ladder-first with exact anchors.** Every anchor is reproduced *verbatim* at
 * its step; every other step takes its lightness from `LIGHTNESS_LADDER`, with
 * chroma and hue interpolated between the flanking anchors and decayed toward
 * `ENDPOINT_CHROMA` beyond the outermost ones.
 *
 * The consequence is the point: a client's brand hex survives byte-for-byte,
 * while the other ten steps stay directly comparable to every other hue. The
 * deviation from the ladder is bounded and *local to anchored steps* — unlike
 * the previous engine, which warped the whole ramp to fit its anchors so every
 * step drifted.
 *
 * Chroma may come out beyond the sRGB gamut here; that is deliberate.
 * `oklchStringToHex` gamut-maps with the CSS algorithm, which reduces chroma
 * while holding lightness, so the ladder survives the conversion.
 */
export function generateOklchPalette(
  input: string | string[] | Record<string, string>,
): Record<StepName, string> {
  let anchors: Record<number, string> = {};

  if (typeof input === 'string') {
    anchors[assignStepByLightness(parseOklch(input).l)] = input;
  } else if (Array.isArray(input)) {
    for (const colorStr of input) {
      anchors[assignStepByLightness(parseOklch(colorStr).l)] = colorStr;
    }
  } else if (typeof input === 'object' && input !== null) {
    anchors = { ...input };
  } else {
    throw new Error(
      'Input must be a color string, array of colors, or object with step assignments',
    );
  }

  const parsedAnchors: Record<number, OklchColor> = {};
  for (const [key, value] of Object.entries(anchors)) {
    parsedAnchors[Number(key)] = parseOklch(value);
  }

  const anchorSteps = Object.keys(parsedAnchors)
    .map(Number)
    .sort((a, b) => a - b) as StepName[];

  // Interpolate across step *index*, not the numeric label: the labels aren't
  // evenly spaced (50→100 is a smaller jump than 100→200), so lerping on them
  // would bunch the ramp up at the light end.
  const idx = (step: number) => STEP_NAMES.indexOf(step as StepName);
  const lastIdx = STEP_NAMES.length - 1;

  const palette: Record<number, string> = {};

  for (const step of STEP_NAMES) {
    // An anchor is the caller's exact colour. Emit it untouched.
    if (parsedAnchors[step]) {
      palette[step] = anchors[step] as string;
      continue;
    }

    // `lighter` is the nearest anchor with a smaller step (50 is lightest);
    // `darker` the nearest with a larger one.
    const lighter = [...anchorSteps].reverse().find((s) => s < step);
    const darker = anchorSteps.find((s) => s > step);

    let chroma: number;
    let hue: number;

    if (lighter !== undefined && darker !== undefined) {
      const a = parsedAnchors[lighter] as OklchColor;
      const b = parsedAnchors[darker] as OklchColor;
      const factor = (idx(step) - idx(lighter)) / (idx(darker) - idx(lighter));
      chroma = lerp(a.c, b.c, factor);
      hue = lerpHue(a.h, b.h, factor);
    } else if (lighter !== undefined) {
      // Past the darkest anchor — fade toward the tinted near-black end.
      const a = parsedAnchors[lighter] as OklchColor;
      const factor = (idx(step) - idx(lighter)) / (lastIdx - idx(lighter));
      chroma = lerp(a.c, Math.min(ENDPOINT_CHROMA.dark, a.c), factor);
      hue = a.h;
    } else if (darker !== undefined) {
      // Past the lightest anchor — fade toward the tinted near-white end.
      const b = parsedAnchors[darker] as OklchColor;
      const factor = (idx(darker) - idx(step)) / idx(darker);
      chroma = lerp(b.c, Math.min(ENDPOINT_CHROMA.light, b.c), factor);
      hue = b.h;
    } else {
      chroma = 0.1;
      hue = 0;
    }

    const lightness = LIGHTNESS_LADDER[step];
    const finalL = (lightness * 100).toFixed(2) + '%';
    const finalC = Math.min(chroma, MAX_CHROMA).toFixed(4);
    const finalH = hue.toFixed(2);

    palette[step] = `oklch(${finalL} ${finalC} ${finalH})`;
  }

  return palette;
}

// ── Contrast + endpoints (for the functional-token layer) ────────────────────

/** APCA lightness-contrast (Lc) magnitude between a foreground and background. */
export function contrastLc(fg: string, bg: string): number {
  return Math.abs(new Color(bg).contrast(fg, 'APCA'));
}

/**
 * Pick a tinted near-white or near-black foreground for best contrast on `bg`
 * (a whisper of the background's hue mixed into off-white/off-black).
 */
export function pickOn(bg: string, hue?: number): string {
  const h = hue ?? hexToOklch(bg).h;
  const white = oklchToHex({ l: 0.98, c: 0.01, h });
  const black = oklchToHex({ l: 0.16, c: 0.02, h });
  return contrastLc(white, bg) >= contrastLc(black, bg) ? white : black;
}

/**
 * The tinted off-white / off-black endpoints for a hue — white/black with a
 * whisper of the hue mixed in. These are the text/background tints every ramp
 * needs (and the one exception strict brand kits allow).
 *
 * Derived from `LIGHTNESS_LADDER` and `ENDPOINT_CHROMA` rather than its own
 * literals, so a strict tone kit's endpoints land on the same ladder rungs a
 * generated ramp would have used. This is the single definition — callers must
 * not hand-write their own near-white/near-black.
 */
export function tintedEndpoints(hue: number, chroma?: number): { light: string; dark: string } {
  return {
    light: oklchToHex({
      l: LIGHTNESS_LADDER[50],
      c: Math.min(chroma ?? ENDPOINT_CHROMA.light, 0.02),
      h: hue,
    }),
    dark: oklchToHex({
      l: LIGHTNESS_LADDER[950],
      c: Math.min((chroma ?? ENDPOINT_CHROMA.dark) * 1.5, 0.03),
      h: hue,
    }),
  };
}
