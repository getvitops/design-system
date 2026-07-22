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

// Default lightness positions (lightest to darkest)
const DEFAULT_LIGHTNESS_SCALE: Record<StepName, number> = {
  50: 0.95,
  100: 0.9,
  200: 0.8,
  300: 0.7,
  400: 0.6,
  500: 0.5,
  600: 0.4,
  700: 0.3,
  800: 0.2,
  900: 0.1,
  950: 0.05,
};

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
 * Transpose the default lightness scale to match the provided anchors.
 */
function transposeLightnessScale(
  parsedAnchors: Record<StepName, OklchColor>,
  sortedAnchorSteps: StepName[],
): Record<StepName, number> {
  const transposedScale: Record<number, number> = {};

  if (sortedAnchorSteps.length === 1) {
    const anchorStep = sortedAnchorSteps[0] as StepName;
    const anchorL = (parsedAnchors[anchorStep] as OklchColor).l;
    const defaultAnchorL = DEFAULT_LIGHTNESS_SCALE[anchorStep];

    for (const step of STEP_NAMES) {
      if (step === anchorStep) {
        transposedScale[step] = anchorL;
        continue;
      }

      const defaultStepL = DEFAULT_LIGHTNESS_SCALE[step];

      if (defaultStepL > defaultAnchorL) {
        const factor = (defaultStepL - defaultAnchorL) / (1.0 - defaultAnchorL);
        transposedScale[step] = lerp(anchorL, 0.97, factor);
      } else {
        const factor = defaultStepL / defaultAnchorL;
        transposedScale[step] = lerp(0.05, anchorL, factor);
      }
    }

    return transposedScale;
  }

  for (const step of STEP_NAMES) {
    const anchored = parsedAnchors[step];
    if (anchored) {
      transposedScale[step] = anchored.l;
      continue;
    }

    let lowerStep: StepName | null = null;
    let upperStep: StepName | null = null;

    for (let i = sortedAnchorSteps.length - 1; i >= 0; i--) {
      const candidate = sortedAnchorSteps[i] as StepName;
      if (candidate < step) {
        lowerStep = candidate;
        break;
      }
    }

    for (const anchorStep of sortedAnchorSteps) {
      if (anchorStep > step) {
        upperStep = anchorStep;
        break;
      }
    }

    if (lowerStep !== null && upperStep !== null) {
      const lowerL = (parsedAnchors[lowerStep] as OklchColor).l;
      const upperL = (parsedAnchors[upperStep] as OklchColor).l;
      const span = upperStep - lowerStep;
      const position = step - lowerStep;
      const factor = position / span;
      transposedScale[step] = lerp(lowerL, upperL, factor);
    } else if (lowerStep !== null) {
      const lowerL = (parsedAnchors[lowerStep] as OklchColor).l;
      const defaultLowerL = DEFAULT_LIGHTNESS_SCALE[lowerStep];
      const defaultStepL = DEFAULT_LIGHTNESS_SCALE[step];
      const factor = defaultStepL / defaultLowerL;
      transposedScale[step] = lerp(0.05, lowerL, factor);
    } else if (upperStep !== null) {
      const upperL = (parsedAnchors[upperStep] as OklchColor).l;
      const defaultUpperL = DEFAULT_LIGHTNESS_SCALE[upperStep];
      const defaultStepL = DEFAULT_LIGHTNESS_SCALE[step];
      const factor = (defaultStepL - defaultUpperL) / (1.0 - defaultUpperL);
      transposedScale[step] = lerp(upperL, 0.97, factor);
    }
  }

  return transposedScale;
}

/**
 * Automatically assigns a color to the most appropriate step based on its lightness.
 */
function assignStepByLightness(lightness: number): StepName {
  let closestStep: StepName = 500;
  let minDiff = Math.abs(lightness - DEFAULT_LIGHTNESS_SCALE[500]);

  for (const step of STEP_NAMES) {
    const diff = Math.abs(lightness - DEFAULT_LIGHTNESS_SCALE[step]);
    if (diff < minDiff) {
      minDiff = diff;
      closestStep = step;
    }
  }

  return closestStep;
}

/**
 * Generates a complete 11-step OKLCH palette from one or more colors.
 * Automatically determines which step each color belongs to based on lightness.
 */
export function generateOklchPalette(
  input: string | string[] | Record<string, string>,
): Record<StepName, string> {
  let anchors: Record<number, string> = {};

  if (typeof input === 'string') {
    const parsed = parseOklch(input);
    const step = assignStepByLightness(parsed.l);
    anchors[step] = input;
  } else if (Array.isArray(input)) {
    for (const colorStr of input) {
      const parsed = parseOklch(colorStr);
      const step = assignStepByLightness(parsed.l);
      anchors[step] = colorStr;
    }
  } else if (typeof input === 'object') {
    anchors = input;
  } else {
    throw new Error(
      'Input must be a color string, array of colors, or object with step assignments',
    );
  }

  const parsedAnchors: Record<number, OklchColor> = {};

  for (const key in anchors) {
    parsedAnchors[parseInt(key)] = parseOklch(anchors[key] as string);
  }

  const sortedAnchorSteps = Object.keys(parsedAnchors)
    .map(Number)
    .sort((a, b) => a - b) as StepName[];

  const lightnessScale = transposeLightnessScale(
    parsedAnchors as Record<StepName, OklchColor>,
    sortedAnchorSteps,
  );

  const palette: Record<number, string> = {};

  for (const step of STEP_NAMES) {
    if (parsedAnchors[step]) {
      palette[step] = anchors[step] as string;
      continue;
    }

    let startStep: StepName | null = null;
    let endStep: StepName | null = null;

    for (let i = sortedAnchorSteps.length - 1; i >= 0; i--) {
      const candidate = sortedAnchorSteps[i] as StepName;
      if (candidate < step) {
        startStep = candidate;
        break;
      }
    }

    for (const anchorStep of sortedAnchorSteps) {
      if (anchorStep > step) {
        endStep = anchorStep;
        break;
      }
    }

    let c_int, h_int;

    if (startStep !== null && endStep !== null) {
      const startColor = parsedAnchors[startStep] as OklchColor;
      const endColor = parsedAnchors[endStep] as OklchColor;
      const span = endStep - startStep;
      const position = step - startStep;
      const factor = position / span;

      c_int = lerp(startColor.c, endColor.c, factor);
      h_int = lerp(startColor.h, endColor.h, factor);
    } else if (startStep !== null) {
      const a = parsedAnchors[startStep] as OklchColor;
      c_int = a.c;
      h_int = a.h;
    } else if (endStep !== null) {
      const a = parsedAnchors[endStep] as OklchColor;
      c_int = a.c;
      h_int = a.h;
    } else {
      c_int = 0.1;
      h_int = 0;
    }

    const l_int = lightnessScale[step] as number;

    const dampeningFactor =
      l_int < 0.25
        ? 0.3 + (l_int / 0.25) * 0.7
        : l_int > 0.75
          ? 0.3 + ((1 - l_int) / 0.25) * 0.7
          : 1.0;

    c_int *= dampeningFactor;
    c_int = Math.min(c_int, 0.37);

    const finalL = (l_int * 100).toFixed(2) + '%';
    const finalC = c_int.toFixed(4);
    const finalH = h_int.toFixed(2);

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
 */
export function tintedEndpoints(hue: number, chroma = 0.01): { light: string; dark: string } {
  return {
    light: oklchToHex({ l: 0.98, c: Math.min(chroma, 0.02), h: hue }),
    dark: oklchToHex({ l: 0.16, c: Math.min(chroma * 1.5, 0.03), h: hue }),
  };
}
