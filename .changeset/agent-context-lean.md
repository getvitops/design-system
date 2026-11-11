---
'@getvitops/skills': minor
'@getvitops/create': minor
'@getvitops/cli': minor
---

**Leaner scaffolded `AGENTS.md`, and skills named by scope.** The EmDash template's `AGENTS.md` went from 212 to about 70 lines and the static one from 141 to about 50: only always-true rules stay (source of truth, generated CSS, branches, `vp`/`vpr`, where to look), and task-specific guidance moved into skills loaded when the task matches.

- **Breaking, `@getvitops/skills`: skills are renamed by scope.** `custom-blocks` → `emdash-custom-blocks`, `content-and-deploys` → `emdash-content-and-deploys`, `contact-form` → `emdash-contact-form`, `csp` → `vitops-csp`, `see-the-page` → `vitops-see-the-page`, `ads` → `vitops-ads`. `emdash-*` skills only apply to an EmDash site; `vitops-*` apply anywhere, and both prefixes are reserved for toolkit skills. New: `emdash-building-pages` (blocks, nesting, page opener, widget areas, escape hatches, layout primitives, `site.chrome`) and `vitops-consent` (split out of `vitops-design-system`, whose description and body now cover styling and tokens only). Existing sites: run `vp install` so `skills experimental_sync` relinks, and replace the per-skill `.agents/skills/<name>` / `.claude/skills/<name>` lines in `.gitignore` with `.agents/skills/vitops-*`, `.agents/skills/emdash-*` and the same two under `.claude/skills/`. A site's own skill must not use those prefixes.
- **`vitops agents sync`:** the block lists only skills that apply (a project without `emdash` in its dependencies gets no `emdash-*` ones, and they are not linked), summaries are cut at a clause rather than with an ellipsis, the pointer says `vp exec vitops docs`, and the version stamp is gone so the file no longer changes on every CLI bump.
- **`@getvitops/create`:** both templates ship the trimmed `AGENTS.md`; the project-naming steps moved into the `setup` skill and EmDash 1.x behaviours, legal-page replacement and the audit prerequisites into `emdash-content-and-deploys`. Existing sites: nothing to change beyond the skill rename; delete the sections you no longer need.
