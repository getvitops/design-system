---
'@getvitops/create': minor
---

**EmDash template:** documents installing the EmDash agent skills per project
(`npx skills add emdash-cms/skills --skill '*' -a claude-code -y`, so they match the pinned `emdash`) in
the README and `AGENTS.md`, and lists the current blocks (hero, cards, accordion, gallery, marquee, …)
with `npx vitops docs blocks` as the full reference. Raises the dependency floors (`@astrojs/react`
7.1, `@astrojs/check` 0.9.12, React 19.3.1) and both templates now pin `pnpm@12.16.1`.
