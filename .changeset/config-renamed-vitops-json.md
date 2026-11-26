---
'@getvitops/generator': patch
'@getvitops/cli': patch
'@getvitops/emdash': patch
'@getvitops/create': patch
'@getvitops/skills': patch
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Breaking: the default config file is now `vitops.json`, not `site.json`** (`@getvitops/generator`, `@getvitops/cli`, `@getvitops/emdash`, `@getvitops/create`, `@getvitops/skills`). The file holds the design system and the organization as well as the site, and the first two serve more than websites, so it is named for the toolchain. Nothing about its shape changed, and it is still recognised by shape (a top-level `designSystem` key), so a file you named something else keeps working. There is no fallback to the old name.

Migration: `git mv site.json vitops.json`, then update every import or `input` that names `./site.json` (`astro.config.mjs`, `vite.config.ts`, `package.json` scripts, `wrangler.jsonc` comments). A command that cannot find the config now says this when it sees a `site.json` that is a config and no `vitops.json`: the CLI commands, `vitops emdash` and the site deploy workflow all print the `git mv` line. `vitops lint --fix` does not rename files, so that message is the migration path. A client repo on the reusable `site-deploy-emdash.yml` should rename the file in the same commit that picks up this release.

- `@getvitops/generator`: exports `CONFIG_FILENAME` (`'vitops.json'`, Worker-safe, from `@getvitops/generator/config`) and `legacyConfigHint()` (Node-only). `vitops docs` and the generated reference name `vitops.json`.
- `@getvitops/cli`: `-i/--input` defaults, `init --site`, the `--site` flag of `emdash form-template`/`check-prerender`, `report`, `audit` and `setup` all use `vitops.json`; config discovery no longer lists `site.json`; help text updated.
- `@getvitops/emdash`: the design-system editor's git sync commits to `vitops.json`.
- `@getvitops/create`: both templates ship `vitops.json` and import it by that name. Existing sites are unchanged until they rename.
- `@getvitops/skills`: the agent skills name `vitops.json` and say older sites used `site.json`.
- No consumer-facing change in `@getvitops/core`, `@getvitops/utils`, `@getvitops/vite` or `@getvitops/astro` beyond comments and the `fixed` bump. No CSS change in any format.
