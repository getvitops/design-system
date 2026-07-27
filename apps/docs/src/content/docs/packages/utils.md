---
title: "@getvitops/utils"
description: "Shared build-time utilities — favicon generation and friends."
sidebar:
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
