---
'@getvitops/astro': minor
'@getvitops/emdash': minor
---

Block images now reliably become responsive AVIF, and say so when they cannot.

- `@getvitops/astro` sets Astro's `site` for builds when the project has none, from `EMDASH_SITE_URL`, then `site.environments.<env>.url`, then `site.domains.canonical` (production only). Placeholder hosts such as `example.com` are skipped. Before this, a prerendered page saw `localhost` as its origin, the image service handed the URL back unchanged, and the hero shipped as the full-size original with no `width` or `height`. It does not touch `emdash({ siteUrl })`, which is also the passkey origin. A project that sets `site` itself is unchanged. Affects all formats.
- `@getvitops/emdash`: when a block image has a ratio but is not transformed, the build now logs one warning per origin and reason instead of falling back silently.
- `@getvitops/emdash`: Gallery thumbnails (cropped to the block's `aspect`), Carousel slides (`srcset`, `sizes`, `width`, `height`, cropped to `aspect`) and Section backdrops (16:9) are now transformed. The Gallery dialog image keeps its own shape. Logos and Marquee still render plain `<img>`.
