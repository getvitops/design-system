---
'@getvitops/generator': patch
---

`vitops init` no longer scaffolds a config that warns on its own output.

`defaultConfig()` declared `patterns.radii.card`, a key named after the `card` pattern — the exact
collision `validate()` started reporting in 0.8.0. The primitive won `--br-card`, shadowing the
pattern's override hook and leaving its `--br-card-group` alias unreachable, so a scaffolded project
was warned about a config it had just been given.

The key is dropped. This is **value-preserving**: `card` belongs to the `panel` group, which already
carries the same `0.5rem`, so `--br-card-group` → `--br-panel` → `0.5rem` renders identically.

**Migration:** none for existing configs — your `design-system.json` is not touched. If you copied
the scaffold and reference `var(--br-card)` directly in hand-written CSS, note it is now an
_override hook_ (undefined until you set it) rather than a defined primitive; read `--br-card-group`
instead, or keep your own `radii` key under a name no pattern uses.
