---
'@getvitops/generator': minor
'@getvitops/utils': minor
---

Theming escape hatches, so a real palette builds without raw ramp steps. All additive; existing configs build unchanged.

- **Dark-only sites.** `designSystem.defaultColorScheme: "dark"` (accepted by the schema before, but ignored) now makes the dark tokens the `:root` appearance with `color-scheme: dark`, emits no light block or `data-theme` flip, and skips light-mode contrast checks. Reaches css, bricks and tailwind formats. Do not ship `<wc-color-scheme-toggle>` on such a site.
- **Role solid step and foreground.** `colors.roles.<role>` may be `{ hue, kind?, solid?, foreground? }`. `solid: 400` starts the solid family at step 400 (bold and x-bold walk one and two rungs darker); `foreground: "dark" | "light"` pins `text-on-<role>`. The APCA check (Lc 60) still runs on the pair emitted. The string shorthand is unchanged. All formats. The live editor's `roleTokens` still assume the default 600 family when re-pointing a role.
- **Split shadows.** `shadows.<name>` may be `{ box?, drop? }`: `box` (spread, inset, layers) is `--shadow-<name>`; `drop` is `--shadow-<name>-drop` and feeds `.drop-shadow-<name>` and the `shadow:` state shortcut. The string form is unchanged. css/bricks emit `.drop-shadow-*`; tailwind emits the `-drop` token only.
- **Layout tokens.** New optional `layout` block (`widths.{measure,breakout,spotlight,nav}`, `regionSpace.{min,preferred,max}`) emitted as `--width-*` / `--region-space*` on `:root` in css, bricks and tailwind formats, and exposed in `design-manifest.json` (`layout`, `reverseIndex`). Keys you omit keep the framework defaults.
- **`acknowledgeOffLadder: true`** on a palette hue silences that hue's off-ladder anchor warnings.
- **Typography:** `transform` and `decoration` are now accepted as aliases of `text-transform` and `text-decoration` (canonical wins when both are present) instead of warning and being dropped.
- **Docs strings** (`authoring.md`, JSON Schema hovers) state the Lc 60 muted-text requirement against the page plane and give a type-scale recipe for marketing headings.
- `@getvitops/utils`: `pickOn` takes an optional `prefer: 'light' | 'dark'`.
