---
'@getvitops/create': patch
'@getvitops/utils': patch
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
'@getvitops/config': patch
---

**Added: the Google Business Profile API approval is now a step in `SETUP.html`.** Google reviews come only from the Business Profile API, which rejects every call from a Google Cloud project Google has not approved, whatever the credential. The approval is a one-time request that takes days to weeks, is per Google Cloud project rather than per site or client, and cannot be done in code, so it is a checklist step (`connections.gbp`) to file at kickoff instead of being discovered as a `403` when the reviews block is built. The setup skill, in both templates, lists it as a hard stop: an agent reports it as a blocker with that lead time and does not tick the step until `vitops reviews --check` stops answering 403. No code or config changed.

`@getvitops/utils`, `generator`, `core`, `cli`, `vite`, `astro` and `config` — no consumer-facing change in these packages.
