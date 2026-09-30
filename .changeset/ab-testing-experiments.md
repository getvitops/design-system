---
'@getvitops/generator': minor
'@getvitops/astro': minor
---

**New: `site.experiments`** — runtime, per-visitor A/B content experiments for a page that
must stay at one URL (unlike `site.abTesting`'s existing build-time variant merge, which is
for a full design-system/CSS-level test via two manual deploys — `site.experiments` is the
opposite granularity: one page, one cookie, content branched in the page itself). Keyed by
an open experiment name, so more than one can run at once, each with its own consent
category, cookie name/lifetime, split ratio and pair of variant names.

**New `vitopsAbTesting()` middleware** (`@getvitops/astro/middleware`) — the first Astro
middleware this toolchain ships. Wire it into your own `src/middleware.ts`:

```ts
import { vitopsAbTesting } from '@getvitops/astro/middleware';
import config from '../site.json' with { type: 'json' };

export const onRequest = vitopsAbTesting({ experiments: config.site.experiments ?? {} });
```

It assigns and cookie-pins a visitor to one of an experiment's two variants on first visit,
by weighted random (`splitRatio`) — and never touches an already-set cookie, so a recognized
query parameter named after the cookie itself (`?_ab_<key>=<variant>`) reliably forces that
variant, even overriding an existing assignment. Combined with `splitRatio: 0`, this is a
blue/green-style "100% on control, but a shared link reveals the other variant" mode with no
special-cased logic.

A page reads its own experiment's cookie (`Astro.cookies.get(cookieName)?.value`) and
renders whichever of its two hand-written blocks matches — there's no config-schema
representation of "the variant content," which is what keeps this lightweight regardless of
how many experiments are configured.

**`<Analytics />` gained a reporting hook**: each configured provider's bootstrap now
attaches an enabled experiment's assignment to the real pageview via that provider's own
mechanism — Plausible via `plausible.init({customProperties})`, Matomo via
`setCustomDimension` (needs a new `site.analytics.matomo.abVariantDimensions` entry — the
dimension must exist in your Matomo instance first), GA4 via a runtime-merged
`gtag('config', …)` call. A no-op when `site.experiments` is unset — zero behavior change
for every existing site.

Also new: `experimentDimensionWarnings(site)` (`@getvitops/generator`) — a build-time warning
(not a hard error) when an enabled experiment's site also configures Matomo but has no
matching `abVariantDimensions` entry.

**Not included in this pass, deliberately**: a mechanism for a fully prerendered
(`output: 'static'`) page — this needs a genuinely separate Cloudflare Worker Route + two
pre-built static variants, real but bounded follow-up work. Everything above applies to an
on-demand-rendered page (the current EmDash templates' default), which needs zero new
deploy infrastructure.
