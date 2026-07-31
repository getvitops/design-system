---
title: "@getvitops/astro"
description: "Astro integration — CSS generation, favicons/PWA, web-component bundles, <Head />."
section: "Packages"
order: 20
---

```sh
npm i -D @getvitops/astro
```


Astro integration for the Vitops design system. Generates your design-system CSS at build time,
copies the web-component bundles into `public/`, generates favicons + a PWA manifest, and gives you
a `<Head />` component that wires it all into the page.

Requires Astro >= 7 (and `astro-icon` >= 1).

```sh
npm i -D @getvitops/astro
```

## Setup

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import getvitops from '@getvitops/astro';

export default defineConfig({
  integrations: [
    getvitops({
      css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' },
      favicon: { source: 'src/assets/logo.svg', name: 'My Site', themeColor: '#0b0b0c' },
    }),
  ],
});
```

```astro
---
// src/layouts/Base.astro
import Head from '@getvitops/astro/Head.astro';
---

<html lang="en">
  <head>
    <Head />
  </head>
  <body><slot /></body>
</html>
```

`<Head />` emits the favicon/PWA tags and the web-component runtime scripts in the correct order and
priority. It does **not** emit a stylesheet `<link>` — the integration imports the generated CSS into
Astro's module graph and Astro emits that link itself.

## Options

| option          | default              | does                                                              |
| --------------- | -------------------- | ----------------------------------------------------------------- |
| `css`           | off unless given     | generate + auto-inject the design-system CSS                      |
| `css.input`     | `design-system.json` | source config                                                     |
| `css.format`    | `tailwind`           | `tailwind` \| `css` \| `bricks`                                   |
| `css.out`       | `src/styles`         | directory the generated CSS is written to                         |
| `css.inject`    | `true`               | inject the stylesheet into every SSR page                         |
| `webComponents` | `true`               | copy + link the web-component bundles                             |
| `favicon`       | off unless given     | `source`, `lowResSource`, `name`, `themeColor`, `backgroundColor` |

Set `css.inject: false` when another integration adds routes that must not inherit the design system
(e.g. EmDash's `/_emdash/admin`) — then import the generated file (`<out>/tailwind.css` or
`<out>/styles.css`) from your own layout, so only your pages are styled.

## Components

Thin authoring helpers that emit the framework's HTML/CSS patterns — **none require runtime JS**:

```astro
import Subgrid from '@getvitops/astro/components/Subgrid.astro';
import Cards from '@getvitops/astro/components/Cards.astro';
import NodeRenderer from '@getvitops/astro/components/NodeRenderer.astro';
import Popover from '@getvitops/astro/components/Popover.astro';
import Details from '@getvitops/astro/components/Details.astro';
import Drawer from '@getvitops/astro/components/Drawer.astro';
import WebComponentLoader from '@getvitops/astro/components/WebComponentLoader.astro';
```

They emit framework classes only — never a Tailwind utility — so they render the same under
`css.format: 'tailwind'`, `'css'` and `'bricks'`, and need no Tailwind installed.

### `Subgrid` / `Cards`

`Subgrid` re-emits each slotted child as an `<li>` of a `.subgrid` grid, carrying the child's own
`class` and `style` across; `Cards` does the same with `card` added to every item. Each item spans
`--subgrid-row-span` row tracks and re-declares them as `subgrid`, so the tranches inside every
card — head, body, footer — land on the same row lines regardless of content length.

```astro
<Cards class="plans">
  <article><h3>Basics</h3><p>…</p><a class="cta" href="#">Start</a></article>
  <article><h3>Managed</h3><p>…</p><a class="cta" href="#">Start</a></article>
</Cards>

<style>
  .plans {
    --subgrid-cols: 2;      /* columns */
    --subgrid-row-span: 3;  /* tranches per card: head, body, CTA */
    --subgrid-gap: 1.5rem;  /* grid gap: between columns, and between tranches */
    --subgrid-row-gap: 2rem; /* extra space between wrapped rows of cards */
  }
  @media (width < 48rem) { .plans { --subgrid-cols: 1; } }
</style>
```

Set the custom properties from your own CSS rather than inline, so media-query overrides win.
Sizing and gaps stay yours: the pattern only sets the grid gap from `--subgrid-gap`.

`--subgrid-row-gap` exists because the grid's row gap is the gap between an item's *tranches*, so
it cannot also be the gap between *rows of items*; it's applied with `sibling-index()`, and where
that isn't supported (currently everything but Chromium) wrapped rows simply fall back to the grid
gap. `--num-items` is set on the `<ul>` for nth-child-style maths.
