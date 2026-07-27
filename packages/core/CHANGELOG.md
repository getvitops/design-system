# @getvitops/core

## 0.8.0

### Minor Changes

- **New: `<wc-theme-editor>`, a live theme editor you can ship with your site.**

  Tune the whole design system in the browser — palette, semantic roles, type roles, spacing, layout,
  pattern geometry, radii, shadows — with no rebuild. Edits are layered as `:root` custom-property
  overrides, persist to localStorage, and export as CSS or as a `design-system.json` patch. It follows
  your site's colour scheme and drives the same `data-theme` + storage key as `<color-scheme-toggle>`,
  so the two no longer fight.

  It ships as a **separate, opt-in bundle** (`@getvitops/core/editor`, ~13 kB, no Lit) and is never
  registered in `elements.js`: a page that doesn't ask for it pays nothing.

  ```js
  // astro.config.mjs
  getvitops({
    css: { input: 'design-system.json', format: 'css', out: 'src/styles' },
    editor: true,
  });
  ```

  ```html
  <!-- anywhere in your layout -->
  <wc-theme-editor></wc-theme-editor>
  ```

  `editor: true` copies `editor.js` into `public/vitops/`, loads it from `<Head />`, and mirrors
  `design-manifest.json` to `/vitops/design-manifest.json` (override with the `manifest` attribute).
  Outside Astro, load the bundle yourself and point `manifest` at the file.

  **Save straight back to your config, in dev.** `@getvitops/vite` now serves a dev-only
  `/__vitops/design-system` endpoint: the editor POSTs its patch, the plugin deep-merges it into your
  `design-system.json`, validates the _merged_ result, writes it back preserving the file's formatting,
  then regenerates and reloads. The endpoint exists only under `vite dev` — on a static deploy the
  editor detects its absence and hides the button, while everything else still works.

  **Added:** `colors.roleTokens` in `design-manifest.json` — the functional token set (bg / border /
  solid / on-solid / text / emphasis stops) precomputed per hue, in `default` and `surface` variants for
  both appearances. Re-pointing a role at another hue needs these: `solid` is chosen by scanning the hue
  and `on-solid` is a computed contrast value, so neither is derivable by a browser client.

  **Removed:** the dead `interaction` block from `design-manifest.json` — a hardcoded
  `{duration, easing}` literal with no schema key, no reverse-index entry, and no corresponding CSS
  variable. Nothing could have consumed it meaningfully. The real animation knobs are
  `--animation-duration-*` / `--custom-ease-*`.

  **Fixed:** a `[popover]` reset in `popover.css` was stripping the background, padding and border from
  any pattern used as a popover. It is imported after `drawer.css`, so at equal specificity it beat
  `.drawer` — and `dialog` (0-0-1) too — leaving a `.drawer[popover]` transparent and unpadded despite
  drawer.css documenting popover as supported. The reset now sits in `:where()` at zero specificity, so
  it still overrides the UA stylesheet but any pattern class takes its surface back. Open/closed
  behaviour is unchanged.

  **Added:** `input[type="range"]` and `input[type="color"]` now have baseline styling in `forms.css`
  (accent colour from `--ui-primary-solid`; the colour swatch picks up the control border and radius).

### Patch Changes

- @getvitops/utils@0.8.0

## 0.7.0

### Patch Changes

- @getvitops/utils@0.7.0

## 0.6.0

### Patch Changes

- @getvitops/utils@0.6.0

## 0.5.0

### Patch Changes

- @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0

## 0.2.1

### Patch Changes

- @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- Redesign the colour system: seeded OKLCH tonal scales plus functional semantic tokens
  (`bg`/`text`/`solid`/`on-solid`, `muted`/`bold`), with named-alias back-compat. Updates the
  framework CSS, the schema, and the generated docs to the new token model.

### Patch Changes

- @getvitops/utils@0.2.0
