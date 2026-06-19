# Design System Build

Source files + build script for the CSS framework consumed by Bricks.

## Structure

```
colors.json          Source of truth for colour (named ramps + semantic roles)
src/
  color.css          GENERATED from colors.json — tokens + .bg-*/.text-color-* utilities
  layout.css         Typography pieces, rhythm, centered grid, layout utilities
  animations.css     Keyframes, timeline/effect classes, floats, text-reveal
  index.css          @import manifest (assembly order)
  deferred.ts        Behaviour script (stagger, observer, feature flags) — TS source
build.mjs            Generates colour CSS, bundles CSS (lightningcss) + JS (tsdown), emits palettes
tsdown.config.ts     Config for bundling deferred.ts -> dist/deferred.js (minified IIFE)
dist/
  styles.css         Bundled, readable (for diffing/reference)
  styles.min.css     Bundled + minified — upload THIS to the theme
  bricks-colors.json Two Bricks Color Manager palettes: "Named" and "Semantic"
  deferred.js        Minified behaviour script (load in <head> with defer)
```

## Build

```
npm install        # once (or: vp install)
npx vp run build   # regenerates dist/ on every change
npx vp run deploy  # build + rsync dist/ to the theme
npx vp check       # format + lint + typecheck
```

## Editing colours

Edit `colors.json` only.

- `named` holds the raw ramps (each a 7-step scale: xxd xd d base l xl xxl).
- `semantic` maps role names (brand-primary, surface, success, …) to a ramp.

Change a hex to recolour. Repoint a role (e.g. `"success": "cobalt"`) to re-aim
it. Rename a ramp by changing its key and any `semantic` entries pointing at it.
Then `npx vp run build`.

`colors.json` drives three outputs at once — the CSS custom properties, the
`.bg-*`/`.text-color-*` utility classes (for both named and semantic), and the
two Bricks palettes — so they can never drift.

## Editing everything else

Edit the relevant `src/*.css` file, then `npx vp run build`. The `@import`s in
`index.css` are bundled into one file by lightningcss; there are no runtime
@import requests in the output.

## Deploy

Upload `dist/styles.min.css` to the child theme. The theme's `functions.php`
cache-busts it with `filemtime()`, so just overwrite the file.
