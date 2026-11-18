---
'@getvitops/emdash': minor
'@getvitops/create': patch
---

**Image blocks can serve a responsive AVIF `srcset`, and their image fields are now media pickers.** `vitops_hero` (split layout) and `vitops_imageCompare` pick their image from the media library instead of asking for a URL, and those two plus `vitops_cards` gain an optional **image shape** field (`16:9`, `1200x800`, `1.5`). With a shape stated, the block renders `srcset`/`sizes`/`width`/`height` in AVIF (eight widths, 640–1920) through Astro's image endpoint, which EmDash wraps so the resize happens at request time through the Cloudflare `IMAGES` binding. No build re-encodes the images, so CI has nothing to cache for CMS media. With no shape stated the block renders the same plain `<img>` as before: **existing content is unchanged and nothing needs migrating.**

- **Needs the site's URL when `astro build` runs.** EmDash only authorizes the site origin for image transforms when it knows it at build time; without it the block falls back to the plain `<img>` (nothing breaks, nothing is optimized). `site-deploy-emdash.yml` now reads it from `site.json` (`site.environments.dev.url` for the dev deploy, `site.environments.production.url` for prod) and sets `EMDASH_SITE_URL` for the build. A build outside that workflow sets `EMDASH_SITE_URL` itself.
- **Cost:** Cloudflare bills each unique source image × width once per month (5,000 free). AVIF only, so one format per width; up to eight widths per image.
- **AVIF only is deliberate:** a browser without AVIF (~3%) shows a broken image rather than a degraded one. See `TODO(support)` in `BlockImage.astro`.
- `vitops_cards` keeps a URL field for its image: the `@emdash-cms/blocks` types in EmDash 1.4.0 allow only text, number, select and toggle sub-fields in a repeater, so a media picker there waits for a newer EmDash (its docs describe one). The shape field works with a pasted URL.
- Not changed: `vitops_logos`, `vitops_marquee`, `vitops_gallery` and `vitops_carousel` still take URLs and render plain `<img>`.
- `@getvitops/create`: the emdash template declares the `IMAGES` binding explicitly in `wrangler.jsonc` (a missing binding silently serves full-size originals), and `@getvitops/emdash`'s `vitopsHosting()` states `imageService: 'cloudflare-binding'` instead of inheriting the adapter default. Formats reached: n/a (no pattern CSS).
