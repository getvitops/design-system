/**
 * Semantic icon names, as Block Kit combobox options.
 *
 * Derived from `@getvitops/utils`' `iconMap` at import time. This used to be a
 * generated copy, so that the package carried no runtime `@getvitops/*`
 * dependency and could version independently of the fixed toolchain group —
 * but that independence was already fiction: the blocks render from the
 * toolchain's SVG sprite (`<use href="…/icons.svg#icon-menu">`), so an emdash
 * built against one icon vocabulary and a sprite built against another produce
 * empty boxes, silently and with no install-time error. Depending on the real
 * map makes the vocabulary one thing rather than two that can drift.
 *
 * `fa7` is the reference collection: every semantic name is defined there, and
 * the other sets are alternate resolutions of the same names.
 */
import { iconMap } from '@getvitops/utils';

export const SEMANTIC_ICON_OPTIONS: { label: string; value: string }[] = Object.keys(iconMap.fa7)
  .sort()
  // Label and value are the same string on purpose: the editor picks a semantic
  // name, and showing the set-specific glyph id would leak the icon set into
  // authored content — the thing the semantic layer exists to prevent.
  .map((name) => ({ label: name, value: name }));
