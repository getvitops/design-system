---
'@getvitops/generator': minor
'@getvitops/cli': minor
---

**Breaking: the default output format is `tailwind`, not `bricks`.** `generate({ input })` with no `format`, `vitops generate` with no `-f`, and `vitops lint` with no `-f` now target Tailwind (`tailwind.css` plus `tokens.json`), which is what EmDash and Astro sites build. The Astro integration (`css.format`) and `@getvitops/vite` already defaulted to `tailwind`, so a site using either is unaffected. **Migration:** a build that relied on the implicit default (a WordPress/Bricks pipeline, or a script calling `vitops generate` with no flag) passes `--format bricks` / `format: 'bricks'`; the Bricks output itself is unchanged and still supported by name. `vitops lint` on a Bricks site passes `-f bricks` for the same reason. Affects the generator library and the CLI only; no CSS changes in any format. Other fixed-group packages: no consumer-facing change.
