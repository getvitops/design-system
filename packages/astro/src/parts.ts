import type { Attrs } from '../types.js';

/**
 * Resolve per-part attrs from a presentation type config.
 * For the 'root' part, merges legacy `attrs` with `parts.root` (backward compat).
 */
export function partAttrs(
  present: { attrs?: Attrs; parts?: Record<string, Attrs> } | undefined,
  part: string,
): Attrs {
  const fromParts = present?.parts?.[part];
  if (part === 'root') {
    const legacy = present?.attrs;
    if (!legacy && !fromParts) return {};
    const { class: lc, ...lr } = legacy ?? {};
    const { class: pc, ...pr } = fromParts ?? {};
    return {
      ...(lc || pc ? { class: [lc, pc].filter(Boolean) } : {}),
      ...lr,
      ...pr,
    };
  }
  return fromParts ?? {};
}
