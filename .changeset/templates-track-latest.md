---
'@getvitops/create': minor
---

Scaffolded projects now track the current toolchain instead of a version frozen at authoring time.

The emdash template pinned `@getvitops/astro: ^0.7.0`, `@getvitops/cli: ^0.4.0` and
`@getvitops/emdash: ^0.2.1` — ranges that were right when written and then quietly weren't. Anyone
running `vp create @getvitops:emdash` through the whole 1.0 release got a project a full major
behind, which looks like a working scaffold and isn't. Every `@getvitops/*` dependency is now
`latest`, which is the correct answer here precisely because these packages move in lockstep: a
scaffold wants the set that was released together, not whichever versions someone last remembered
to type.

**Also fixed: `vite` and `vite-plus` were `catalog:`.** That is a pnpm protocol which only resolves
inside this monorepo, and the publish-time rewrite that handles it for a package's own dependencies
does not reach inside `templates/**` — those ship as verbatim data. So the scaffold succeeded and
the first `install` in it failed on an unresolvable specifier. Both now say `latest`.

A test over every template's `package.json` now rejects `workspace:`/`catalog:` specifiers and
requires `@getvitops/*` deps to be `latest`, so neither can come back silently.
