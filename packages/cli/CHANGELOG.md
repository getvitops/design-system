# @getvitops/cli

## 0.2.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- d35515e: Add `vitops agents` — writes a managed, marker-delimited block into a consumer's `AGENTS.md`
  (or `--out CLAUDE.md`) so AI coding agents can discover the CLI and the design-system class/element
  vocabulary. Idempotent (re-run to update between the `<!-- vitops:start -->`/`<!-- vitops:end -->`
  markers) and also emits the OKF docs bundle it points at (`--docs-dir`, default `.vitops/docs`).

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.2.0
  - @getvitops/utils@0.2.0
