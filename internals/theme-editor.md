# The live theme editor

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`<wc-theme-editor>` layers runtime `:root` overrides over the generated token layer via one injected
`<style id="ds-overrides">`, so the whole design system is tunable in the browser with no rebuild. It
reads its editable surface from `design-manifest.json` (a `css`-format output) and exports edits back
as CSS or as a `design-system.json` patch; on a dev server running `@getvitops/vite`, **Save to
source** POSTs that patch to `/__vitops/design-system` and the plugin merges → validates → writes →
regenerates. On any static build the probe fails and the button isn't rendered.

These are load-bearing and easy to break:

- **A role is not a ramp alias.** `--color-<role>-<step>` is never emitted — a role resolves to
  target-prefixed tokens (`--color-bg-<role>`, `--color-bg-<role>-solid`, `--color-text-<role>`, …).
  `text-on-<role>` can't be derived in the browser (it's a computed contrast literal), which is why
  the manifest ships **`colors.roleTokens`** precomputed per hue, in `chromatic` and `surface`
  variants × light/dark. A remap copies that set; it does not rewrite a ramp reference. The previous
  editor got this wrong and wrote 11 dead declarations per role.
- **The role's `kind` travels with it** in `manifest.colors.roles`, and the editor must read it from
  there rather than inferring `role === 'surface'` — the two kinds emit _different token sets_, so
  inferring silently gave the wrong set to `neutral` and to any consumer-named surface role.
  `buildPatch` writes `colors.roles.<role>` as the **object** form for the same reason: a bare hue
  string means chromatic, so patching one over a surface role would demote it on the next build.
- **Palette hexes are scheme-global.** The dark block re-points which step each token reads; it never
  redefines `--color-<hue>-<step>`. Hue edits therefore belong in `:root` only.
- **A step maps to `colors.palette.<hue>.anchors.<n>`, not `.seed`.** The seed regenerates the whole
  ramp, and mapping all 11 steps to one path silently loses every edit but the last.
- **The patch is always design-system-relative; the file it lands in may not be.** The editor only
  knows about a design system, so when the plugin's `input` is a site config the server merges into
  — and validates — the design-system _subtree_ (`designSystemPath()` in `@getvitops/vite`), writing
  only the surrounding file whole. It reads that path off the **raw** on-disk object, not the
  resolved one: `resolveConfig` normalises the two `designSystem` shorthands in memory, so a
  writer assuming the canonical shape would grow a `themes` key beside the author's bare map and
  silently edit a copy nothing builds from. Merging at the root instead is the louder version of the
  same bug — a `colors` key beside `organization`, and `validate` rejecting the site config
  wholesale so every save fails with errors about the wrong document.

Consumers point the element at its manifest with the `manifest` attribute; the Astro integration's
`editor: true` mirrors the file to `/vitops/design-manifest.json` (the default) _inside the generate
pass_, so it can't race a cold start or go stale after a config edit.
