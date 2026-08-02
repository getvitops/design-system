---
title: Vitops
description: A design-system toolchain — generate Tailwind v4, Bricks, DESIGN.md, or standalone CSS output from one design-system.json.
section: 'Start here'
order: 0
---

Vitops is a **reusable toolchain**, not a shipped theme. There is no canonical token set to adopt —
every project brings its own consumer-editable `design-system.json`, and the generator turns it into
whatever the target platform needs.

```sh
npm i -D @getvitops/cli
npx vitops init                                     # scaffold a design-system.json
npx vitops generate --format tailwind -o src/styles
```

That's the whole loop: edit the config, regenerate. Nothing in your project is hand-maintained CSS
that has to be kept in sync with a token file.

## What you get

**One config, four targets.** The same file emits a self-contained Tailwind v4 theme, a
WordPress/Bricks payload, an agent-facing `DESIGN.md` brief, or a standalone bundled stylesheet. Pick
with `--format` — it takes a comma-separated list, so the brief composes with a stylesheet.

**Modern CSS first.** Anchor Positioning, Popover, Invoker Commands, `<details>`, subgrid, container
queries and scroll-driven animations do the work. JavaScript is the exception, not the baseline.

**Progressive enhancement where it earns it.** Web components exist only for patterns that genuinely
benefit. The slotted markup is accessible and usable with no JS; the component parses and augments
it in place — so the no-JS rendering is a real fallback, not a blank element.

**Colour that's derived, not enumerated.** Give a hue a seed; the generator derives an 11-step OKLCH
scale and the functional tokens over it. Dark mode is an automatic flip, not a second palette you
maintain. Contrast targets are enforced by unit tests.

**Docs that can't drift.** Every page under *Reference* is generated from the same source the
toolchain ships to consumers via `vitops docs`, so this site can't describe output the generator
doesn't produce.

## This site dogfoods the system

There's no docs framework here. The layout, navigation, type, colour and controls you're looking at
are built from the design system's own CSS framework — `.rhythm`, `.centered`, `.split-*`,
`.font-<role>`, `.link`, `.card`, `.details` — and the colour-scheme toggle in the header is one of
the Lit web components. Turn JavaScript off and the page still works: the toggle disappears (it
hides itself until defined) and the colour scheme follows your OS, while navigation keeps working
because the mobile menu is a native `<details>` disclosure rather than a script. If something here
looks wrong, that's a bug in the framework — which is the point of building the docs this way.

## Where next

- **[Installation](/guides/installation)** — get the toolchain into your project
- **[Your design system](/guides/design-system)** — how `design-system.json` is structured
- **[CSS class vocabulary](/reference/css-classes)** — what you can actually write in markup
- **[Changelog](/changelog)** — what changed and how to migrate
