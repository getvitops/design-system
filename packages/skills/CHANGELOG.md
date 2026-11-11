# @getvitops/skills

## 0.1.0-alpha.2

### Minor Changes

- 6b5ea17: **Leaner scaffolded `AGENTS.md`, and skills named by scope.** The EmDash template's `AGENTS.md` went from 212 to about 70 lines and the static one from 141 to about 50: only always-true rules stay (source of truth, generated CSS, branches, `vp`/`vpr`, where to look), and task-specific guidance moved into skills loaded when the task matches.

  - **Breaking, `@getvitops/skills`: skills are renamed by scope.** `custom-blocks` → `emdash-custom-blocks`, `content-and-deploys` → `emdash-content-and-deploys`, `contact-form` → `emdash-contact-form`, `csp` → `vitops-csp`, `see-the-page` → `vitops-see-the-page`, `ads` → `vitops-ads`. `emdash-*` skills only apply to an EmDash site; `vitops-*` apply anywhere, and both prefixes are reserved for toolkit skills. New: `emdash-building-pages` (blocks, nesting, page opener, widget areas, escape hatches, layout primitives, `site.chrome`) and `vitops-consent` (split out of `vitops-design-system`, whose description and body now cover styling and tokens only). Existing sites: run `vp install` so `skills experimental_sync` relinks, and replace the per-skill `.agents/skills/<name>` / `.claude/skills/<name>` lines in `.gitignore` with `.agents/skills/vitops-*`, `.agents/skills/emdash-*` and the same two under `.claude/skills/`. A site's own skill must not use those prefixes.
  - **`vitops agents sync`:** the block lists only skills that apply (a project without `emdash` in its dependencies gets no `emdash-*` ones, and they are not linked), summaries are cut at a clause rather than with an ellipsis, the pointer says `vp exec vitops docs`, and the version stamp is gone so the file no longer changes on every CLI bump.
  - **`@getvitops/create`:** both templates ship the trimmed `AGENTS.md`; the project-naming steps moved into the `setup` skill and EmDash 1.x behaviours, legal-page replacement and the audit prerequisites into `emdash-content-and-deploys`. Existing sites: nothing to change beyond the skill rename; delete the sections you no longer need.

- bb61a35: **Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

  - **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
  - **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
  - The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
  - `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
  - `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
  - `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

  `@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.

- 7069f93: **Agents now look at rendered pages with `playwright-cli`.** Both templates add `playwright` as a devDependency, run `playwright cli install --skills` from `prepare` (writing the upstream command reference to `.claude/skills/playwright-cli/`), ship `.playwright/cli.config.json`, allow `pnpm exec playwright cli`, and deny `mcp__claude-in-chrome__*` and `mcp__playwright__*` in `.claude/settings.json`. `@getvitops/skills` adds a short `see-the-page` skill (serve first, snapshot before screenshot, dark mode, mobile, no-JS) that defers to the upstream one. Existing sites: add `playwright` as a devDependency, extend `prepare`, and copy the settings. `vitops audit` now needs only `@axe-core/playwright lighthouse` added.

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
