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
| `vitops docs icons`     | semantic icon names across sets, bundle derivation, sprite delivery    |
| `vitops docs elements`  | the custom Bricks Builder elements and their controls                  |

`vitops docs` (no topic) lists the topics; `vitops docs --all` prints everything.

## Other commands

- `vitops generate --format <tailwind|css|bricks>` — generate the platform output.
- `vitops generate --format design --out .` — write `DESIGN.md`, the agent-facing brief
  (google-labs-code/design.md format: YAML token front matter + prose rationale). It
  emits no CSS, so it composes: `--format css,design`. The live reference above is
  richer; DESIGN.md is for handing the identity to a tool that doesn't have this skill.
- `vitops init` / `vitops validate` — scaffold / check a config. `validate` routes on the
  file's shape, so it checks a site config as a site config.

**The config may be a `design-system.json` or the site config that embeds one.** Every
`--input` (and the Vite plugin / Astro integration equivalent) accepts either; a site
config holds the design system at `designSystem.themes.<name>`, selected with `--theme`.
If this project keeps its tokens inside a `company.json` / `site.json`, point `--input`
there — do not create a second file for the tooling's sake.

## Fonts: vitops names them, it does not load them

`design-system.json`'s `fonts` block holds **stacks only** — each entry emits a
`--font-<name>` token and nothing else: no `@font-face`, no preload, no metrics-matched
fallback. Loading is the host framework's job.

On Astro, load with the **Fonts API** and point the token at the family's `cssVariable`:

```js
// astro.config.mjs
fonts: [
  {
    provider: fontProviders.fontsource(),
    name: 'League Spartan',
    cssVariable: '--font-league-spartan',
    weights: ['100 900'],
    subsets: ['latin'],
  },
];
```

```jsonc
// design-system.json
"fonts": { "display": "var(--font-league-spartan), sans-serif" }
```

Installing `@fontsource*` and importing its CSS in a layout also renders, so it looks
correct — but it gives up subsetting control, preload, and the `size-adjust` /
`ascent-override` fallback metrics, which is a real CLS regression. Reach for it only
where no provider covers the family.

- `vitops legal` — render the site's privacy policy, terms of service and cookie notice
  from a **site config** (not a `design-system.json`). `--format md|html|portable-text`
  covers Astro content collections, WordPress/Bricks fragments and EmDash respectively;
  `--out <dir>` writes files, otherwise it prints to stdout.
  The documents are **derived from the config**: the analytics provider it names is the
  one whose ID is set, the personal information it lists is what the configured forms
  collect, the countries it names come from the providers in use. So the fix for a wrong
  policy is a corrected config, never hand-editing the output — the next build overwrites
  it. Declare processors the config cannot imply (payment, CRM, mail) under
  `legal.privacyPolicy.processors`.
  Generated from config, not legal advice — always tell the user to have it reviewed
  before publishing.
- `vitops agents` — (re-)link this skill into `.agents/skills/` + `.claude/skills/` and
  refresh the AGENTS.md pointer block. The links point into the installed package and
  survive version bumps; re-run only if they were deleted.
