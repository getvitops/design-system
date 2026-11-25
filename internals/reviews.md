# Google reviews

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`vitops reviews` (`packages/cli` → `@getvitops/utils/reviews`) fetches a client's Google Business
Profile reviews and writes them to a committed `.vitops/reviews.json`, which a `<ReviewCard />`
renders — typically several inside `<Carousel>` slides or `<Marquee>` items; there is no group
component and no `wc-review`, because nothing about a review card benefits from progressive
enhancement.

**Start from what the API actually offers, because it settles most of the design:**

- **Reviews live only on the legacy v4 Business Profile API**
  (`mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews`). The newer split APIs
  (Account Management, Business Information) never grew a reviews resource, and Places API (New)
  caps at 5 reviews, drops owner replies, and its ToS caps caching at 30 days — incompatible with a
  committed cache. **TODO — re-check when Google migrates the Reviews endpoint off v4.** Endpoint,
  auth and the review object's fields may all change; `@getvitops/utils/reviews`'s `gbp.ts` is the
  one place that assumption lives.
- **The calling GCP project must be allowlisted by Google before any call succeeds** — a one-time
  access-request form, turnaround measured in days to weeks. `gbp.ts` treats a `403` as that known
  state and says so, rather than surfacing a raw failure. It is
  per Google Cloud project, not per site, and cannot be done in code, so it is a checklist step
  (`connections.gbp` in `SETUP.html`, and a hard stop in the setup skill) to file at kickoff.
- **Auth is always user OAuth**, the same `VITOPS_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` /
  `_REFRESH_TOKEN` (or ADC login) `search setup` uses, scoped to `business.manage`
  (`SCOPES.businessProfile`, `@getvitops/utils/google/token.ts`). Reading a client's own reviews is
  a person acting with owner/manager rights, never a deploy robot.
- **Review JSON-LD is opt-in and off by default** (`site.reviews.schema`). Google's structured-data
  policy treats a business marking up reviews of itself as ineligible for review rich results and
  risks a manual action — there is no markup for "duplicate content"; the honest handling is
  `rel="nofollow"` to the source review, and `<ReviewCard>` only emits `Review` JSON-LD (via the
  existing `schemas/Review.astro`) when both `schema` and `itemReviewed` are supplied.
- **Reviewer avatars are Google-hosted URLs** and default off (`site.reviews.avatars` /
  `<ReviewCard avatar>`). On, every visitor issues a third-party request to
  `googleusercontent.com` for a URL that isn't guaranteed to stay live; off, `.review__initials`
  renders the author's initials instead.

**The pure/IO split mirrors `indexing/` and `onboarding/`.** `reviews/plan.ts` decides which
locations to fetch and why one is skipped (no matching `organization.locations` entry, no
`listings.google` id, no `accountId`, no credential); `selectReviews()` — featured ids first, then
`minRating`/`sort`/`limit` — is the one place "which reviews a site actually shows" is decided, so
`<ReviewCard>` and a future Bricks renderer read the same answer instead of each re-implementing it.
`gbp.ts` and `cache.ts` execute a plan and decide nothing.

`.vitops/reviews.json` is meant to be **committed**, like `media-manifest.json` and unlike
`sitemap-snapshot.json`: reviews change slowly, and a build should not need a live Google credential
to render them. `--check` fetches and diffs against the cache without writing, for CI to flag a
stale commit; a real run **merges only the locations it fetched** (`mergeCache`), so one location's
failure leaves every other location's cached reviews untouched — the same non-destructive-partial-
failure shape `search notify`'s snapshot write follows.

`site.reviews.locations` is keyed by `organization.locations`, and each key must name a real entry
with a `listings.google` id already recorded there (`validateConfig` rejects a typo'd key rather
than silently fetching nothing) — the same field that section's docblock already flagged as
"recorded here so a future sync has a stable id to match against."

**Wiring the cache into an Astro content collection needs no symlink.** Astro 5's `file()` loader
takes a `parser` for nested JSON:

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';

const reviews = defineCollection({
  loader: file('.vitops/reviews.json', {
    parser: (text) => Object.values(JSON.parse(text).locations).flatMap((l: any) => l.reviews),
  }),
});
export const collections = { reviews };
```

Each review already carries a unique `id` (the GBP review id) and a `location` key, so
`getCollection('reviews', ({ data }) => data.location === 'ottawa')` works with no further plumbing.
Non-Astro consumers read the same JSON directly.

### Block escape hatches and widget areas

Every `vitops_*` block carries `anchor` (an `id`), `className` and `style`, applied by each renderer
to its **own outermost element** through `rootAttrs()` and validated in `astro/blocks/attrs.ts`.
There is deliberately no wrapper node: one that appeared only when a field was set would make a
block's DOM shape depend on content, and break CSS and JS selectors written against it. The one
nuance is `vitops_cards`, whose default variant is a `<wc-cards>` host and whose attributes go on
the grid inside it (the panel variant has no host), so they sit on the same element in both. **`style` is
custom properties only**, and that is the point: `--p-card: 2rem` tunes a hook the design system
already defines, while a free-form declaration would let one page diverge from the tokens and
`url(` is a request to wherever an editor points it. **`className` has one caveat**: under the
`tailwind` format a class typed in the CMS exists only if some source already used it (Tailwind
scans files, not content); css and bricks ship every class. Every block (and widget area) has a `theme`, `<role>` or
`<role>:solid`, applied by `rootAttrs()` to the block's own root as `.tone` classes and `--tone-*`
properties, so contrast stays the generator's guarantee and a site's raised or glass role styling
reaches every block; `tone`/`color`/`solid` remain because a block-type field cannot be renamed.

**Widget areas** are EmDash's synced regions (an EmDash Section is copied, so later edits do not
reach earlier uses). `<VitopsWidgetArea>` renders one in the framework's vocabulary — titles at a
chosen heading level, a menu as a labelled `<nav>` — and the `vitops_widgetArea` block places one
in content. An area cannot hold another (a request-scoped depth counter cannot be kept honest
while Astro streams children), and one holding a `core:*` component widget is handed whole to
EmDash's renderer, whose per-widget renderer is not exported. Prerendered pages bake an area at
build time, like menus.

The `tailwind` format needs `@source` lines for the packages whose renderers carry classes:
Tailwind v4 does not scan `node_modules`, so `font-display` (used only by `vitops_stats`) was never
emitted. The Astro integration passes them (`tailwind-sources.ts` → `generate({ sources })`), and
`vitops emdash check-prerender` warns when a type-role class has no rule as a backstop.
