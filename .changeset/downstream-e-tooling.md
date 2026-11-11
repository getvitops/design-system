---
'@getvitops/cli': minor
'@getvitops/generator': patch
'@getvitops/skills': patch
'@getvitops/create': patch
---

Tooling fixes from the vitops.ca build (findings 14, 23, 24, 25).

- **`vitops emdash form-template --from <seed.json | export.json> [--name contact] [--site site.json] [--dry]`** copies a `vitops_form` block into `site.templates` with the renderer's own field resolver, so the generated privacy policy and `check-prerender` know what the form collects. A re-run is a no-op, and the result is validated before it is written.
- `site.templates` form fields accept `checkboxes` (the block's spelling), and the template union now discriminates on `type`, so a bad entry is reported at its path instead of as a bare "Invalid input".
- **`prepare-db` fails fast and says why.** It validates `site.json` before starting the dev server, writes the server's output to `.vitops/prepare-db.log`, stops waiting as soon as the log shows an error, and prints the log's tail on failure, instead of waiting out a five-minute timeout with nothing to read.
- **`check-prerender`** skips the toolkit's own assets under `vitops/` (no more "0 h1" for the theme-editor page) and warns when the sitemap lists URLs the build produced no page for (a collection with no `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`).
- The emdash template ignores the duplicate `pnpm-@getvitops+skills-*` links `skills experimental_sync` leaves beside each skill; the `content-and-deploys` skill explains the sitemap warning.
