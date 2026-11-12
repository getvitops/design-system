---
title: Start a new EmDash site
description: The one-time procedure for standing up a client EmDash site on Cloudflare — from `vp create` to a running admin, with the agent tooling wired — then a hand-off to the in-project setup checklist.
section: 'Start here'
order: 15
---

This is the procedure we follow for every new client site on [EmDash](https://docs.emdashcms.com)
(Astro on Cloudflare Workers, D1 + R2). It takes you from nothing to a running site with the design
system configured and your coding agent set up. Everything that touches a third party — the GitHub repo,
Cloudflare resources, the domain, Search Console, ads, legal — lives in the scaffolded project's own
`SETUP.html` checklist, and this guide hands off to it rather than repeating it.

## Before you start

- **Node 24** and **[Vite+](https://viteplus.dev) (`vp`)**. The scaffold pins its Node version in
  `.node-version`; `vp` reads it.
- **`gh`** (GitHub CLI), logged in: `gh auth login`.
- A **Cloudflare account** and `vp exec wrangler login`. Local development needs neither — `vp dev` runs the
  Worker with local D1/R2 emulation — but the hand-off checklist does.
- The client's name, address and brand colours. You'll enter them in step 4.

## 1. Scaffold the project

```sh
vp create @getvitops:emdash --directory acme-site
cd acme-site
```

`vp create @getvitops` (no template) opens a picker between the EmDash template and the static one.
Add `--agent claude-code` if you want `vp` to write agent instructions too; the template already ships an
`AGENTS.md` and a `.claude/` setup, so you usually don't.

`vp create` installs dependencies as part of scaffolding, so there is no separate `vp install` step (run
`vp install` yourself after pulling someone else's changes). The scaffold's `@getvitops/*` dependencies are `latest`, and `@getvitops/*` is exempt from the template's
3-day release cooldown, so you get the current toolchain release. Everything else holds new releases back
for three days.

## 2. Wire up your coding agent

Three separate things, and you want all three:

**The docs MCP servers.** `.mcp.json` ships with the Astro docs and EmDash docs servers (and Semrush).
Approve them the first time Claude Code asks. Agents then answer EmDash and Astro questions from the
current documentation instead of from memory.

**The EmDash skills — per project, not global.** Skills teach an agent the APIs of the `emdash` version
this project pins. A global copy tracks "latest" and drifts ahead of a project pinned to an older
release — exactly when an agent would write code against APIs that don't exist yet. Install all six:

```sh
npx skills add emdash-cms/skills --skill '*' -y
```

That is `building-emdash-site`, `creating-plugins`, `emdash-cli`, `upgrading-emdash` and the two
WordPress porting skills (useful when you migrate an existing client site). The CLI writes them once to
`.agents/skills/` and symlinks each into `.claude/skills/`, so Claude Code and every other agent that
reads `.agents/skills/` see the same files. Commit `.agents/skills/`, the `.claude/skills/` symlinks and
`skills-lock.json`. After you bump `emdash`, run `npx skills update` — the `upgrading-emdash` skill covers
the rest of the upgrade. See [EmDash's agent skills page](https://docs.emdashcms.com/agent-skills/) for
the other install routes (Codex, a Claude Code plugin marketplace).

**The Vitops design-system skill.**

```sh
vp exec vitops agents -i site.json
```

Links the `vitops-design-system` skill into `.agents/skills/` and `.claude/skills/` and writes a managed
block into `AGENTS.md`. The skill teaches the agent to fetch the class vocabulary live
(`vp exec vitops docs <topic>`), rendered from _your_ `site.json`, so it can never describe tokens the site
doesn't have. `vp exec vitops docs blocks` lists every EmDash block and its fields.

**The site's own MCP server** (`/_emdash/api/mcp`) is separate: it lets an agent read and write _content_
on a running site, over OAuth, with the permissions of the role that approves it. It is not in
`.mcp.json` because it is per environment — add it yourself once the site is deployed, and approve the
narrowest role that does the job (an Editor, not an Admin, for content work). See
[EmDash: AI tools](https://docs.emdashcms.com/guides/ai-tools/).

## 3. Make it the client's

Everything brand-specific is in **`site.json`**:

- `organization` — name, contact, address, locations, services.
- `designSystem.themes.default` — colours, type, spacing, patterns. There is no separate
  `design-system.json`; a scaffold's config embeds it.
- `site` — locales, environments, SEO, analytics, legal switches, icons.

Replace `src/assets/logo.svg` (favicons and the PWA manifest are generated from it), then check your work:

```sh
vp exec vitops validate site.json
vp exec vitops lint -i site.json -f tailwind --strict
```

`lint` catches the failure that is otherwise invisible — a utility class that resolves to nothing. See the
[design system guide](/guides/design-system) and [config guide](/guides/config).

Set the site-level SEO defaults in `site.seo` (title template, default description, Open Graph image,
verification tokens). The site name defaults to `organization.name`.

## 4. First run

```sh
vp run dev
```

(`vp run dev` runs the project's `dev` script, which is `astro dev`. Bare `vp dev` starts plain Vite, which
does not serve this site.) Astro 7 runs the dev server in the background: stop it with
`vp exec astro dev stop`.

- Site: <http://localhost:4321>
- Admin: <http://localhost:4321/_emdash/admin> — complete the setup wizard. Choose **include sample
  content** to publish the seeded pages (home, about, `/terms`, `/privacy`), which show one of each
  design-system block.

In the editor, type `/` to open the slash menu: **hero, cards, accordion, carousel, gallery, marquee,
banner, disclosure, image compare, copy snippet** are the design-system blocks. They render from the same
CSS and web components as the rest of the site, and they work without JavaScript.

## 5. Hand off to the setup checklist

```sh
vp run sop
xdg-open SETUP.html   # or: open SETUP.html
```

`SETUP.html` is the canonical checklist for everything that touches a third party, one copyable command
per step. In order:

1. **Host** — Cloudflare Workers by default.
2. **GitHub repo + branch policy** — `vp exec vitops setup repo`. `dev` is the unprotected integration
   branch; `main` is production, protected, and reached only through the promote workflow.
3. **Hosting resources** — `vp exec vitops setup hosting`: the isolated dev D1 database and R2 bucket, and the
   repo secrets. You create the Cloudflare API token by hand; no API can mint one.
4. **Domain strategy** — go live on `*.workers.dev` first, with `robots: noindex,nofollow`. The custom-domain
   cutover is a separate, deliberate step that takes any existing site at that domain offline the moment
   you deploy.
5. **Configuration** — fill in `site.json` fully.
6. **Search Console, ads, sender email** — `vp exec vitops setup search`, `setup ads`, `email setup`.
7. **Legal** — generate the privacy policy, terms and cookie notice from your config
   (`vp exec vitops legal --format portable-text`), then have them reviewed before publishing.
8. **Launch gates** — robots, canonical domain, favicons, lint, typecheck, the production approval.

An agent can work the same list autonomously through `.agents/skills/setup/`. It stops at the steps that
need a person: the Cloudflare token, the domain cutover and publishing any legal document.

## Where editing happens

Code, pages and `site.json` live in git and promote `dev → main`. **Content lives in production** — editors
work there, and drafts and preview links are the staging step. The dev site holds a disposable copy of
production's database, refreshed from prod and never promoted back.

## Known limits

- The `_headers` security baseline covers static assets only. Worker-rendered EmDash pages are not
  covered by it.
- Cloudflare's new `cf` CLI is in beta and will eventually succeed Wrangler. The scaffold, the Astro
  adapter and EmDash's migration command all use Wrangler today, so stay on it.
