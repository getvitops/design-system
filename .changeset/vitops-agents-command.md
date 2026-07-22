---
'@getvitops/cli': minor
---

Add `vitops agents` — writes a managed, marker-delimited block into a consumer's `AGENTS.md`
(or `--out CLAUDE.md`) so AI coding agents can discover the CLI and the design-system class/element
vocabulary. Idempotent (re-run to update between the `<!-- vitops:start -->`/`<!-- vitops:end -->`
markers) and also emits the OKF docs bundle it points at (`--docs-dir`, default `.vitops/docs`).
