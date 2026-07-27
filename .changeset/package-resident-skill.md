---
'@getvitops/cli': minor
'@getvitops/generator': minor
---

Package-resident agent skill + `vitops docs`:

- `@getvitops/cli` now ships the `vitops-design-system` agent skill inside the package
  (`skill/SKILL.md`). `vitops agents` no longer emits a generated skill into the repo — it
  symlinks `.agents/skills/` and `.claude/skills/` entries to the installed package (logical
  `node_modules/@getvitops/cli/skill` target, surviving version bumps) and writes the
  AGENTS.md pointer block. Old generated-skill directories are migrated automatically;
  `--docs-dir` keeps the emit-files layout.
- New `vitops docs [topic]` command prints reference docs to stdout, rendered live from the
  project's `design-system.json` (topics: classes, authoring, formats, color, scales,
  patterns, elements; `--all` concatenates).
- `renderSkill()` removed from `@getvitops/generator` (superseded by the packaged skill).
