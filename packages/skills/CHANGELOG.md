# @getvitops/skills

## 0.1.0-alpha.1

### Patch Changes

- 322dd6a: Tooling fixes from the vitops.ca build (findings 14, 23, 24, 25).

  - **`vitops emdash form-template --from <seed.json | export.json> [--name contact] [--site site.json] [--dry]`** copies a `vitops_form` block into `site.templates` with the renderer's own field resolver, so the generated privacy policy and `check-prerender` know what the form collects. A re-run is a no-op, and the result is validated before it is written.
  - `site.templates` form fields accept `checkboxes` (the block's spelling), and the template union now discriminates on `type`, so a bad entry is reported at its path instead of as a bare "Invalid input".
  - **`prepare-db` fails fast and says why.** It validates `site.json` before starting the dev server, writes the server's output to `.vitops/prepare-db.log`, stops waiting as soon as the log shows an error, and prints the log's tail on failure, instead of waiting out a five-minute timeout with nothing to read.
  - **`check-prerender`** skips the toolkit's own assets under `vitops/` (no more "0 h1" for the theme-editor page) and warns when the sitemap lists URLs the build produced no page for (a collection with no `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`).
  - The emdash template ignores the duplicate `pnpm-@getvitops+skills-*` links `skills experimental_sync` leaves beside each skill; the `content-and-deploys` skill explains the sitemap warning.

## 0.1.0-alpha.0

### Minor Changes

- 0a47856: New package `@getvitops/skills`: agent skills for sites built with the toolchain (`custom-blocks`, `content-and-deploys`, `contact-form`, `csp`). The emdash template depends on it and runs `skills experimental_sync` on `prepare`, which links them into `.agents/skills/` and `.claude/skills/`, so they update with `vp update` instead of being copied at scaffold time. Existing sites: `vp add @getvitops/skills && vp add -D skills`, set `prepare` to `vp config && skills experimental_sync -y -a claude-code --no-frozen-lockfile`, gitignore the four linked names, and delete the site's own copies of those four skills (the sync never replaces a directory it did not create).

  The emdash template's `AGENTS.md` is shortened to the always-relevant rules. Deploy and content mechanics (where each kind of data is the truth, prerendering, publish-triggered rebuilds, refreshing dev), the contact form, and the CSP move into those skills. Corrects the nesting guidance: a block type with a `portableText` field (such as `vitops_section`) holds other blocks, while `vitops_*` Portable Text blocks do not. Adds guidance for agents to record reusable toolkit gaps in `UPSTREAM.md`. The generated stylesheet is no longer described as always `tailwind.css`.
