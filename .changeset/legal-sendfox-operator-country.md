---
'@getvitops/generator': patch
---

**Fixed: the privacy policy now names the United States as SendFox's operator jurisdiction.** The `sendfox` processor declared no `operatorCountry`, so a site using SendFox for email campaigns got no foreign-access sentence for it. It is now `the United States` (Sumo Group Inc., a Delaware corporation, checked against SendFox's live privacy policy). No `storage` is asserted, because that policy names no hosting location. Regenerate your legal documents (`vitops legal`) to pick it up; the review banner still applies.

Zoho Bigin and Zoho Campaigns deliberately stay unset: Zoho's policy names the whole Zoho Group as joint controllers and its hosted data centers are per entity, so no single country is true. The comments in `legal/providers.ts` now record that instead of a TODO. All formats: not applicable (no CSS change).

`@getvitops/core`, `@getvitops/utils`, `@getvitops/cli`, `@getvitops/vite`, `@getvitops/astro`, `@getvitops/config`: no consumer-facing change in these packages. (`core` also gains a test-only cleanup that stops an intermittent unhandled error in `WCCarousel.dom.test.ts`; nothing ships.)
