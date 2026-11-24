---
'@getvitops/skills': patch
'@getvitops/create': patch
---

**Agents in scaffolded sites now run playwright-cli as `vp exec playwright cli <cmd>`.** The upstream playwright-cli skill writes `playwright-cli <cmd>` (a global binary that is not installed) and the `see-the-page` skill said `pnpm exec`, which the scaffold's own AGENTS.md bans, so agents concluded Playwright was missing and reached for `vp dlx`, which fetches a second unpinned Playwright. `see-the-page` now states the invocation explicitly, and gains a "Comparing against a mockup" section: mockups are built without the toolkit, so compare them with matched screenshots rather than snapshots (snapshot stays for text parity and for pages of the same site).

Existing sites: in `.claude/settings.json`, replace the `Bash(pnpm exec playwright cli:*)` and `Bash(npx --no-install playwright cli:*)` allow entries with `Bash(vp exec playwright cli:*)`.
