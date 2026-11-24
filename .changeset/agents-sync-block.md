---
'@getvitops/cli': minor
'@getvitops/create': patch
---

`vitops agents` (also `vitops agents sync`) now keeps a short fenced block at the **top** of `AGENTS.md` instead of appending a long one. The block names the config, says to prefer the framework's classes, and links the skills linked under `.agents/skills` from installed `@getvitops/*` packages (with a one-line "use when …" from each), plus `vitops docs <topic>` for reference; the generate-command list and the topic list are gone. A later run replaces only that block in place and leaves the rest of the file alone; with no block, it is added at the top; a block from an older release is updated where it is. The command also links every skill an installed `@getvitops/skills` ships, so it works without the `skills` CLI. The templates run it from `prepare` and ship the block already in `AGENTS.md`.
