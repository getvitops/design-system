---
'@getvitops/core': minor
'@getvitops/generator': minor
---

`radii.pill` / `--br-pill` is gone. `999px` is a shape, not a design decision, so it no longer
has a config-editable token of its own — it's now the `rounded-full` utility, named and valued
to match Tailwind's own class, alongside a new `rounded-none`.

**Breaking — `css`/`bricks` only** (the tailwind format never emitted `--br-pill`; Tailwind
already ships `rounded-full`/`rounded-none` natively and always has). A consumer who overrode
`--br-pill` directly, or set `radii.pill` in their own `design-system.json` expecting it to
reshape the switch track, the facet-list count or the badge-indicator bubble, has to migrate:

- The switch track, facet count and badge indicator each already had their own consumer hook
  (`--br-switch-track`, `--br-count`, `--br-badge-indicator`) and now fall back straight to the
  literal `999px` instead of chaining through `--br-pill`. Override the specific hook instead of
  the removed shared one.
- `.badge` is unaffected — it already resolved to `999px` and still does, now via its own
  override (`patterns.items.badge.overrides.br`) rather than a shared primitive.
- Anything that wants a fully round corner outside those three patterns should reach for
  `class="rounded-full"` (or `rounded-none` to zero one out) rather than a `--br-*` variable.

This is **not** reachable by `vitops lint --fix` — its token-rename table is built from colour
role names, and there is no equivalent static table for a shape primitive going away — so this
entry is the migration.

`radii.circle` / `--br-circle` (50%) is untouched: `status`, the radio and the switch thumb all
depend on it, and Tailwind has no equivalent to defer to.
