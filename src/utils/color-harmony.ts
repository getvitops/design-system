/**
 * Color harmony strategies for generating complementary colors
 */

export type HarmonyStrategy =
  | 'complement'
  | 'analogous-plus'
  | 'analogous-minus'
  | 'triadic-plus'
  | 'triadic-minus'
  | 'split-plus'
  | 'split-minus'
  | 'tetradic-plus'
  | 'tetradic-minus';

export interface HarmonyOption {
  id: HarmonyStrategy;
  label: string;
  description: string;
  hueShift: number;
}

export const HARMONY_STRATEGIES: HarmonyOption[] = [
  {
    id: 'complement',
    label: 'Complement',
    description: 'Opposite on color wheel (high contrast)',
    hueShift: 180
  },
  {
    id: 'analogous-plus',
    label: 'Analogous+',
    description: 'Adjacent colors (harmonious)',
    hueShift: 30
  },
  {
    id: 'analogous-minus',
    label: 'Analogous-',
    description: 'Adjacent colors (harmonious)',
    hueShift: -30
  },
  {
    id: 'triadic-plus',
    label: 'Triadic+',
    description: 'Evenly spaced (balanced)',
    hueShift: 120
  },
  {
    id: 'triadic-minus',
    label: 'Triadic-',
    description: 'Evenly spaced (balanced)',
    hueShift: -120
  },
  {
    id: 'split-plus',
    label: 'Split Complement+',
    description: 'Near opposite (softer contrast)',
    hueShift: 150
  },
  {
    id: 'split-minus',
    label: 'Split Complement-',
    description: 'Near opposite (softer contrast)',
    hueShift: -150
  },
  {
    id: 'tetradic-plus',
    label: 'Tetradic+',
    description: 'Square spacing (rich palette)',
    hueShift: 90
  },
  {
    id: 'tetradic-minus',
    label: 'Tetradic-',
    description: 'Square spacing (rich palette)',
    hueShift: -90
  }
];

/**
 * Applies a harmony strategy to a hue value
 */
export function applyHarmonyStrategy(baseHue: number, strategy: HarmonyStrategy): number {
  const harmonyOption = HARMONY_STRATEGIES.find(h => h.id === strategy);
  if (!harmonyOption) return baseHue;

  let newHue = baseHue + harmonyOption.hueShift;

  // Normalize to 0-360 range
  while (newHue < 0) newHue += 360;
  while (newHue >= 360) newHue -= 360;

  return newHue;
}

/**
 * Gets all harmony suggestions for a given base hue
 */
export function getHarmonySuggestions(baseHue: number): Array<{ strategy: HarmonyStrategy; hue: number; label: string; description: string }> {
  return HARMONY_STRATEGIES.map(strategy => ({
    strategy: strategy.id,
    hue: applyHarmonyStrategy(baseHue, strategy.id),
    label: strategy.label,
    description: strategy.description
  }));
}

/**
 * Default functional color hues (if user doesn't specify)
 */
export const DEFAULT_FUNCTIONAL_HUES = {
  success: 142,  // Green
  warning: 38,   // Orange/Amber
  error: 0,      // Red
  info: 200      // Blue
} as const;

/**
 * Suggests a functional color hue based on existing palette to maintain harmony
 */
export function suggestFunctionalColorHue(
  type: keyof typeof DEFAULT_FUNCTIONAL_HUES,
  existingHues: number[]
): number {
  const defaultHue = DEFAULT_FUNCTIONAL_HUES[type];

  if (existingHues.length === 0) {
    return defaultHue;
  }

  // Find the closest existing hue and adjust slightly to maintain harmony
  const avgHue = existingHues.reduce((sum, h) => sum + h, 0) / existingHues.length;

  // Rotate the default hue to be more in line with the palette's color temperature
  const hueShift = avgHue - 200; // Assuming 200 is neutral blue
  let adjustedHue = defaultHue + (hueShift * 0.3); // 30% influence

  // Normalize
  while (adjustedHue < 0) adjustedHue += 360;
  while (adjustedHue >= 360) adjustedHue -= 360;

  return adjustedHue;
}
