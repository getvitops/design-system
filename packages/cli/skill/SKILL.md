---
name: vitops-design-system
description: >-
  Work with this project's Vitops design system. Use when styling or authoring
  pages or components (choosing utility/pattern classes, colours, spacing,
  typography), when editing design-system.json (tokens, palette, patterns,
  scales, animations), when generating output (vitops generate --format
  tailwind|css|bricks), or when asking what the design system provides on a
  given platform (Tailwind vs Bricks vs standalone CSS).
---

# Vitops design system

This project is styled with the Vitops design system (`@getvitops/*`): a variable-driven
CSS framework generated from `design-system.json` (the single source of truth — semantic
colour roles, fluid type/space scales, component patterns, animation effects).

**Core rule:** prefer the framework's utility + component classes over hand-written CSS or
ad-hoc values — they encode the tokens, respond to dark mode, and update with the system.

## Getting the current reference docs

Run **`vitops docs <topic>`** — it prints the reference as markdown to stdout, generated
live from this project's `design-system.json` and the installed package version, so it is
never stale and always names the project's actual tokens. (If `vitops` isn't on PATH, use
`pnpm exec vitops docs <topic>` or `npx vitops docs <topic>`.)

| Run                     | When you need                                                          |
| ----------------------- | ---------------------------------------------------------------------- |
| `vitops docs classes`   | which class to apply — the full class vocabulary as naming rules       |
| `vitops docs authoring` | what a `design-system.json` field means / what's valid                 |
| `vitops docs formats`   | tailwind vs css vs bricks output — incl. which utilities Tailwind owns |
| `vitops docs color`     | how the colour system works (seeded OKLCH scales, roles, dark mode)    |
| `vitops docs scales`    | how the fluid type/space scales work                                   |
| `vitops docs patterns`  | how pattern CSS is assembled (token cascade, override hooks, states)   |
| `vitops docs elements`  | the custom Bricks Builder elements and their controls                  |

`vitops docs` (no topic) lists the topics; `vitops docs --all` prints everything.

## Other commands

- `vitops generate --format <tailwind|css|bricks>` — generate the platform output.
- `vitops init` / `vitops validate` — scaffold / check a `design-system.json`.
- `vitops agents` — (re-)link this skill into `.agents/skills/` + `.claude/skills/` and
  refresh the AGENTS.md pointer block. The links point into the installed package and
  survive version bumps; re-run only if they were deleted.
