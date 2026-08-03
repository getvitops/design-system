---
type: "Design Concept"
title: "Vitops icons — one semantic vocabulary across icon sets"
description: "Semantic icon names that resolve per configured set, how the bundle is derived on a server build, and the three delivery paths (astro-icon, astro-iconset, SVG sprite)."
resource: "design-system.json"
tags: [icons, svg, sprite, astro-icon, design-system]
generator: "@getvitops/generator"
---

# Icons

Icons are named by **meaning**, not by set. `menu` resolves to `fa7-solid:bars`,
`lucide:menu` or `ph:list` depending on which set the site configures, so changing
sets is a config edit rather than a find-and-replace across templates.

The escape hatch is deliberate and always available: **a name containing `:` passes
through untouched**. `<Icon name="simple-icons:zoho" />` renders that exact glyph
whether or not the semantic map knows it.

## Declaring them

The `icons` block lives in the **site config**, not `design-system.json` — it
describes what a site uses, not what the design system defines.

```json
{
  "icons": {
    "ui": "ph",
    "brand": "simple-icons",
    "weight": "bold",
    "semantic": ["menu", "close", "arrow-right"],
    "simple-icons": ["zoho", "cloudflare"],
    "sprite": true
  }
}
```

`ui` and `brand` pick which set a semantic name resolves against. Any other key is
an iconify collection name with an explicit list, passed through verbatim.

**`weight` is only meaningful for sets that encode weight in the icon NAME.**
Phosphor does (`list`, `list-bold`, `list-fill`), so `ph` accepts it; Font Awesome
splits weights across collections instead (`fa7-solid` vs `fa7-regular`), so there
the weight is part of the prefix and this key is ignored.

## Why the bundle list exists

astro-icon is **zero-config on a static build**. Under `output: 'server'` it bundles
*every icon in a set* unless given an `include` map — which is why projects end up
hand-maintaining one.

The `icons` option on `getvitops()` derives it by scanning your source, merged with
whatever you declare. On a static build **no include is passed at all**: there is
nothing to trim there, and a list could only drop a glyph the scan couldn't see.

Two failure modes, treated differently on purpose:

- A name you **declared** that doesn't resolve is a config error and **throws**.
- A name only the **scan** found and can't resolve just **warns** — a bare unmapped
  name is more often a local `src/icons/*.svg` than a mistake, and a dev server
  that dies on a template typo is worse than one that tells you.

Names computed at runtime (`<Icon name={expr} />`) can't be read statically. They are
reported with file and line, never guessed at — declare them in `semantic` or a
per-set list. Run `vitops icons` to see the whole report.

## Delivery

| Path | Used by | Needs |
| --- | --- | --- |
| `astro-icon` / `astro-iconset` | Astro sites | the integration, an optional peer |
| **SVG sprite** (`icons.svg`) | Bricks/WordPress, EmDash renderers, plain HTML | `icons.sprite: true` |

The sprite is the no-JavaScript path: `<svg><use href="/vitops/icons.svg#ph--list"></svg>`.
Ids are the qualified name with `:` replaced by `--` (`:` is not valid in a fragment
identifier), **plus a set-independent `icon-<name>` alias for every semantic name** —
so sprite markup survives an icon-set change the same way `resolveIcon` protects Astro
call sites.

In WordPress, `vitops_icon('menu')` and `[vitops_icon name="menu"]` emit that markup,
and a **Vitops → Icon** Bricks element wraps the same helper.

⚠️ An external-file `<use>` is **same-origin only** and dead under `file://`. Serving
`dist/` from a different origin makes every icon vanish with no console error.

## Markup

Always the framework's `.icon` box:

```html
<span class="icon" aria-hidden="true"><svg>…</svg></span>
```

`.icon` sizes in `em` via `--icon-size` (default `1.25em`) and sets `fill: currentColor`,
so an icon inherits the colour of whatever it sits in. Because `.cta` and
`:where(button, .btn)` are already `inline-flex` with a `gap`, **a start or end icon is
child order — not a modifier class**.

Icons are `aria-hidden` by default. Pass a label only when the icon carries meaning on
its own; beside a text label it would be announced twice.

Note `.icon-mask` is a different thing: the CSS-only adornment path used by
`.link--icon::before`, where the glyph is a `mask-image` on a pseudo-element and there
is no markup to hang an `<svg>` on.
