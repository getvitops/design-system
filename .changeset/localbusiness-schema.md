---
'@getvitops/utils': minor
'@getvitops/generator': minor
'@getvitops/astro': patch
---

Extract the LocalBusiness JSON-LD builder out of `<LocalBusiness />` into a reusable
`localBusinessGraph()`, and add the location fields listing platforms (GBP, Bing Places, Apple
Business Connect) actually need.

**Added — `@getvitops/utils`.** `localBusinessGraph(options)` (+ its `LocalBusinessGraphOptions`,
`OpeningHoursSpecification` and `SpecialHoursSpecification` types) is now exported from
`@getvitops/utils`, alongside the existing `organizationGraph`/`articleGraph`/`breadcrumbGraph`/
`faqGraph` builders — same module, same shape, usable anywhere a JSON-LD graph is built outside an
Astro component.

**Added — `authoring`/`config` (`@getvitops/generator`).** Four new `organization.locations.<slug>`
fields: `hoursSpecial` (dated deviations from the recurring `hours` — holiday hours, a one-off
closure), `photos` (`ImageRefSchema[]` → JSON-LD `image`), `sameAs` (this location's own listing
URLs, distinct from `organization.sameAs`, which is the company overall), and `listings` (external
listing ids keyed by platform — `google` | `bing` | `apple` — not consumed by the generator today;
recorded so a future listings-sync command has a stable id to match against).

**Changed — `astro`.** `<LocalBusiness />`'s `Props` type is now `LocalBusinessGraphOptions`
(re-exported, not redefined) rather than a local interface that had drifted from what the builder
actually accepted. No markup or prop-name change for an existing consumer.
