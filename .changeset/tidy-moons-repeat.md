---
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/vite': minor
'@getvitops/cli': minor
---

Add `vitops media` — encode raw video into web-ready outputs, instead of hand-rolling an ffmpeg
script per project.

Keep unprocessed video in a `raw/` directory and run:

```
vitops media --raw raw --out src/assets/processed
```

Each source becomes three files: **VP9/WebM**, an **H.264/MP4** fallback, and a **JPG poster**.
Import them like any other asset, so your bundler content-hashes them:

```astro
---
import hero from '../assets/processed/hero.webm';
import poster from '../assets/processed/hero.jpg';
---
<video poster={poster.src} autoplay muted loop playsinline>
  <source src={hero} type="video/webm" />
</video>
```

In Astro it's an integration option — `vitops({ css, media: { raw: 'raw', out: 'src/assets/processed' } })`
— and it runs in the same pass that generates your CSS. `@getvitops/vite` gains a matching `media`
option, and `@getvitops/utils/media` exports `processMedia()` for anything else.

Defaults: capped at 1920px wide, CRF 32, audio dropped (the common case is a muted autoplay loop),
poster from frame 0. All of them are flags. `--dry` prints exactly what a run would do.

**Runs are cached**, on source content plus encode settings, in `.vitops/media-manifest.json` — a
24 MB clip that took 88 seconds the first time takes 0.14 seconds the second. A missing output
re-encodes; a corrupt manifest re-encodes everything. Neither ever reads as "already done", because
that failure is silent and no rebuild would fix it.

**Commit the outputs and the manifest.** A fresh CI clone has neither and would re-encode from
scratch; committing both means CI never needs ffmpeg. It also keeps your history clean — ffmpeg
output isn't byte-reproducible across versions, so a CI re-encode would rewrite every video on any
toolchain bump. Use `--force` when you mean to re-encode.

**`ffmpeg` is an external tool, not an npm dependency** — install it yourself (`brew install
ffmpeg`, `apt install ffmpeg`, `winget install Gyan.FFmpeg`). The command fails without it rather
than skipping: a page referencing a video that was never encoded is broken, not degraded.

Two defaults worth knowing about. The MP4 exists because older iOS and the in-app webviews inside
social apps still don't decode VP9, and it's written with `+faststart` — without which a browser
downloads the whole file before showing frame one. And a poster taken from frame 0 is often black
on a clip that fades in; that's `--poster-time`, not a bug.
