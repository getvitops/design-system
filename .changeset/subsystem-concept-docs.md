---
'@getvitops/generator': minor
'@getvitops/cli': minor
---

Document the consent, conversion-tracking, search and legal subsystems for agents.

`vitops docs` gains four topics — `consent`, `tracking`, `search`, `legal` — and the docs
bundle gains the matching concept docs under `concepts/`. Until now these subsystems were
described only by their generated config-schema field descriptions, so an agent working in a
consumer project had no account of the rules that make them work, and every one of those rules
fails **silently** when broken:

- a gated tag given a live `src` instead of `type="text/plain"` fetches the third party anyway,
  so the gate becomes decorative;
- a caller using `granted()` instead of `require()` never raises the banner, so on a site where
  nothing else demands that category the permission is never offered, never granted, and the
  write never happens;
- an absent `window.vitopsConsent` read as "denied" rather than "this site has no gate";
- a consent patch widened to every category records consent nobody gave;
- a sitemap with no `<lastmod>` makes edited pages undetectable, so `search notify` looks
  healthy while never resubmitting anything;
- a stale IndexNow key file returns `202` and is then discarded;
- Google's Indexing API accepts ordinary URLs, discards them, and violates its own terms.

The packaged agent skill now covers consent and conversion tracking, and its description names
these subsystems so it is actually surfaced when they are the task.

Also fixed: the icons concept doc still called the Astro integration `getvitops()`, renamed to
`vitops()` in 3.0.
