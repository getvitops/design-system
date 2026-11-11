---
'@getvitops/skills': minor
'@getvitops/create': minor
---

**Agents now look at rendered pages with `playwright-cli`.** Both templates add `playwright` as a devDependency, run `playwright cli install --skills` from `prepare` (writing the upstream command reference to `.claude/skills/playwright-cli/`), ship `.playwright/cli.config.json`, allow `pnpm exec playwright cli`, and deny `mcp__claude-in-chrome__*` and `mcp__playwright__*` in `.claude/settings.json`. `@getvitops/skills` adds a short `see-the-page` skill (serve first, snapshot before screenshot, dark mode, mobile, no-JS) that defers to the upstream one. Existing sites: add `playwright` as a devDependency, extend `prepare`, and copy the settings. `vitops audit` now needs only `@axe-core/playwright lighthouse` added.
