# @getvitops/utils

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

## Video encoding (`@getvitops/utils/media`)

Encode a directory of raw video into VP9/WebM + an H.264/MP4 fallback + a JPG poster frame.

```ts
import { processMedia } from '@getvitops/utils/media';

const { written, skipped } = await processMedia({
  raw: 'raw',
  out: 'src/assets/processed',
  config: { maxWidth: 1920, crf: 32 },
});
```

Its own subpath, like `./indexing`: it shells out to **`ffmpeg`**, which must be on `PATH`, and
it throws rather than skipping when it isn't.

Runs are cached in `.vitops/media-manifest.json` on source content and encode settings, so a
second run costs a hash per file. `planMedia` decides all of it and touches no filesystem, which
is what makes `dry: true` a complete account of a run rather than an approximation — the same
split `./indexing` makes.

Also available via the CLI (`vitops media`), the Vite plugin's `media` option, and
`getvitops({ media })` in Astro. See the [CLI readme](https://www.npmjs.com/package/@getvitops/cli)
for why the outputs are meant to be committed.

## Search-engine notification (`@getvitops/utils/indexing`)

The engine behind `vitops search notify`: sitemap parsing, the changed-URL diff against the previous
run's snapshot, IndexNow submission, and the Search Console API calls (sitemap resubmit + read-only
URL inspection). `plan()` is pure — no network, no filesystem, no clock — and `indexnow.ts` /
`gsc.ts` execute a plan without deciding anything.

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/utils/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
