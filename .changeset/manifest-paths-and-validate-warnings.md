---
'@getvitops/cli': minor
---

Fix two wrong paths in the live-editor manifest, and surface token-namespace collisions.

**`validate()` now returns `warnings: string[]`** alongside `ok`/`data`/`errors`, for configs that
parse and generate but won't behave as authored. `vitops validate` prints them. The field is always
present, so existing code reading `ok`/`errors` is unaffected.

The first warning covers a collision the flat `--<prop>-<name>` grammar allows: a `patterns.radii`
key named after a pattern claims the same variable. The example config hits it —
`patterns.radii.card` and the `card` pattern both want `--br-card`:

```
! patterns.radii.card collides with the "card" pattern on --br-card;
  the pattern's override hook wins — rename the radius
```

**`design-manifest.json` reverse-index fixes** (affects the live editor's edit-to-config mapping):

- Numeric colour steps mapped to `colors.palette.<hue>.seed`. The seed regenerates the whole ramp,
  so every step of a hue collapsed onto one path and editing two steps would silently keep one.
  They now map to `colors.palette.<hue>.anchors.<n>` — the schema's step → colour override.
- `--br-<name>` resolved to `patterns.radii.<name>` even when a pattern owned the variable. Radii
  are now applied last and only where a pattern hasn't claimed it, matching what the CSS actually
  does.
