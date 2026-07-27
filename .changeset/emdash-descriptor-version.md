---
'@getvitops/emdash': patch
---

Fix the plugin descriptor reporting a stale version.

`@getvitops/emdash@0.2.1` shipped a descriptor whose `version` read `0.2.0`. The value was a
hand-maintained literal carrying a "keep in sync with package.json" comment; `changeset version`
bumps package.json and leaves such a literal alone, so the two drifted at release time. A test
asserts they match, but the release chain built and published without running tests, so nothing
caught it.

It's now derived from package.json, which removes the failure mode rather than relying on
remembering, and the `release` task runs the test suite before publishing.
