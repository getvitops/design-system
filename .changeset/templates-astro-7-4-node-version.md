---
'@getvitops/create': minor
---

**Scaffolds now pin Astro `^7.4.4` and ship a `.node-version`.** Both templates (`emdash`, `static`)
move from `astro: ^7.1.2` to `^7.4.4` — the newest release at least three days old when this was
chosen (7.4.5 was under a day old), matching what this repo builds and tests against — and add a
`.node-version` containing `24`, so version managers that read it (fnm, mise, asdf, Volta) agree with
the `.nvmrc` the reusable CI workflows read and the `devEngines` pin pnpm reads. `templates.test.ts`
now fails if those three disagree, or if a template's Astro range drifts from the repo's catalog.

Existing projects are not changed: bump `astro` yourself, and add `.node-version` if you want it.

Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
in this package.
