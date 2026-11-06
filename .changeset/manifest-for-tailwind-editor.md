---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/create': patch
'@getvitops/emdash': minor
'@getvitops/vite': minor
---

Fix the EmDash `/design-system` admin page erroring on a tailwind site. It fetches `/vitops/design-manifest.json`, which the `tailwind` format never emitted and the integration only mirrored under `editor: true` (which also loads `editor.js` on every public page).

- **generator** (`tailwind` format only): `design-manifest.json` is now emitted alongside `tailwind.css`. No change to the CSS.
- **astro**: new `vitops({ editorManifest: true })` writes everything an outside host needs into `public/vitops/` (`design-manifest.json`, `editor.js`, a standalone `editor.css`, and `design-system-editor.html`) without loading the editor on public pages. `editor: true` still loads it from `<Head />`.
- **vite**: `editorManifestDir` also writes `vitops/editor.css`, from a throwaway `css`-format pass on tailwind sites.
- **emdash**: the `/design-system` admin page was unstyled and overflowed the admin, because the editor borrows the framework CSS and the admin never loads it. It now embeds `/vitops/design-system-editor.html` in an iframe, so the design system can't leak into the admin's styles. **Requires `editorManifest: true`** in `vitops({ … })`.
- **create**: the EmDash template sets `editorManifest: true`. Existing sites: add it to `vitops({ … })` in `astro.config.mjs`.

No consumer-facing change in the other toolchain packages.
