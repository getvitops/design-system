---
title: "@getvitops/utils"
description: "Shared build-time utilities — favicons, video encoding, search-engine submission."
section: "Packages"
order: 60
---

```sh
npm i -D @getvitops/utils
```


Shared build-time utilities for the Vitops toolchain. Used under the hood by
[`@getvitops/cli`](https://www.npmjs.com/package/@getvitops/cli) and
[`@getvitops/vite`](https://www.npmjs.com/package/@getvitops/vite), and usable on its own.

## Favicon generation

Rasterize a source SVG/PNG into the standard favicon set (`favicon.ico`,
`icon-{16?,32,192,512}.png`, `apple-touch-icon.png`, `icon-mask.png`).

```ts
import { generateFavicons } from '@getvitops/utils';

await generateFavicons({
  source: 'brand/logo.svg', // SVG or PNG
  lowResSource: 'brand/logo-16.svg', // optional simplified 16px source
  outputDir: 'public',
});
```

`sharp` + `png-to-ico` are loaded lazily (only when `generateFavicons` runs).
`oxipng` lossless crush is applied when it's on `PATH` and skipped otherwise.

Also available via the CLI (`vitops favicon -i logo.svg -o public`) and the Vite plugin's
`favicon` option.

## Subpaths

The heavy modules are their own entry points, so importing the content helpers doesn't drag in an
encoder or a network client:

| import                       | what it does                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| `@getvitops/utils`           | content model, HTML helpers, icon resolution, JSON-LD, source scanning    |
| `@getvitops/utils/favicon`   | `generateFavicons()` — lazily loads `sharp` + `png-to-ico`               |
| `@getvitops/utils/color`     | the OKLCH ramp + contrast primitives                                      |
| `@getvitops/utils/media`     | `processMedia()` — video encoding; shells out to `ffmpeg`                |
| `@getvitops/utils/indexing`  | sitemap diffing, IndexNow, Search Console submission + inspection         |

`media` and `indexing` share a shape worth knowing if you're extending either: a pure `plan.ts` that
decides everything and touches nothing, with the executor beside it deciding nothing. That's what
lets `--dry` be a complete account of a run, and what lets the consequential parts — the encode
cache, the changed-URL diff — be tested without `ffmpeg` or a network.

```ts
import { processMedia } from '@getvitops/utils/media';
import { plan, collectEntries } from '@getvitops/utils/indexing';
```

Both are surfaced by the CLI as [`vitops media`](/packages/cli/) and
[`vitops indexing`](/packages/cli/), which is the surface every consumer has regardless of stack.
