---
'@getvitops/cli': patch
---

Fix `vitops emdash prepare-db` on a clean CI runner: it created `.vitops/` only after writing its log into it (ENOENT), and relied on `astro dev` detaching by itself, which Astro 7 does only when it detects an AI agent, so it ran in the foreground until the 5-minute timeout. It now passes `--background` and reads the server's own log from `.astro/dev.log`. Not CSS; no format affected.
