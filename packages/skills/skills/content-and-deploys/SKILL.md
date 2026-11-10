---
name: content-and-deploys
description: How content, builds and deploys fit together on this EmDash site — where each kind of data is the source of truth, why pages are prerendered, how a publish reaches the live site, and refreshing the dev database. Use for any deploy or build problem, stale or missing content, "my publish isn't live", scheduled posts, previews, 404s, server islands, or refreshing dev from prod.
---

# Content and deploys

## Where the truth lives

Truth runs a different direction per kind of data.

| Data                                                        | Truth                         | Moves by                                                                  |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Code, Astro pages, `site.json`, design system, seed, schema | git (`dev`)                   | promote `dev → main`                                                      |
| Content: entries, media, menus, settings                    | **production** D1/R2          | editors work there; drafts and "Publish changes" are the staging step     |
| Dev database                                                | disposable copy of production | `scripts/refresh-dev.mjs` / the `site-refresh-dev` workflow, one way only |

The dev site exists to rehearse code and schema changes against real content. Never promote it
back. The refresh refuses any target not named `*-dev`, and drops every table in its target. It
copies no sessions (they are in KV). Set `EMDASH_PREVIEW_SECRET` on the dev worker, or prod preview
links would open drafts there. The dev worker's cron trigger is dropped, so scheduled publishing
can't be exercised on dev.

## Rendering and freshness: everything is prerendered

`output: 'server'` is still required (the admin, media/API routes and scheduled publishing need a
Worker), but every public page — `index.astro`, `[...slug].astro`, `404.astro` — has
`export const prerender = true`, and `[...slug].astro` lists the published `pages` entries in
`getStaticPaths()`. The HTML is written at build time and served as a static asset; the Worker only
handles `/_emdash/*` and anything deliberately left on-demand. A route with no `prerender` export is
re-rendered on every request, so don't leave it off by accident.

- **Where build-time content comes from.** The Cloudflare adapter prerenders against a _local_ D1
  (`.wrangler/state`), never the deployed one — on a CI runner that is an empty database, which
  would bake "No home page yet" into every page. `scripts/pull-content.mjs` (the first step of
  `vpr deploy` and `vpr deploy:dev`) exports production's D1 and loads it locally first. It fails
  closed: a failed export aborts the deploy rather than publishing an empty site (the one exception
  is a database that doesn't exist yet, the first deploy, which builds from the seed).
  `SKIP_PULL_CONTENT=1` skips it.
- **The local database must be migrated before the build.** The template runs
  `migrations: { runtime: 'check' }`, so a build against a local database with pending migrations
  prerenders EmDash's one-line "Database migrations are required" response into every page — and
  still succeeds. A fresh runner, a first deploy, a `SKIP_PULL_CONTENT=1` build and an **upgrade**
  deploy (the pull restores production's older schema, and `emdash migrate` only runs after the
  build) would all publish that. `vitops emdash prepare-db` (`vpr prepare-local-db`, run after the
  pull by `vpr deploy`, `vpr deploy:dev` and the reusable workflow) starts `astro dev` once, calls
  EmDash's `dev-bypass` setup (which migrates and applies the seed's sample content) and stops it;
  `vitops emdash check-prerender` (part of `vpr build`) then fails the build if any prerendered page
  is not a real HTML page with a title. Run `vpr prepare-local-db` by hand before a first local
  `vpr build`. It only writes the disposable `.wrangler/state`; the dev administrator it creates is
  never deployed.
- **Freshness is a rebuild.** A page reflects production as of the last build, so a publish in the
  admin has to trigger one (see "Publish-triggered rebuilds").
- **Scheduled publishes.** The Worker cron trigger in `wrangler.jsonc` (every minute) is what makes
  content scheduled in the admin publish, and what runs plugin cron and maintenance. Keep it. A
  scheduled publish changes the database but not the live HTML until a rebuild; whether it fires
  the publish hook below is unverified, so check before relying on it.
- **Drafts and previews.** A prerendered page cannot show an unpublished draft, so an admin
  "Preview" link shows the last published build. If previews matter, add a dedicated on-demand
  route for them rather than removing `prerender` from the public ones.
- **Dynamic parts are server islands.** Anything that must be fresh per request goes in its own
  component rendered with `server:defer` inside the prerendered page; the surrounding HTML stays
  static. Keep islands rare — each is a Worker request after load.
- **Unknown URLs.** There is no `Astro.rewrite('/404')`: a slug not listed by `getStaticPaths()` has
  no route, so Astro serves the prerendered `404.html` with a real 404 status. Rewriting an
  on-demand route to a prerendered one fails (500), so don't reintroduce it.

## Publish-triggered rebuilds

`.github/workflows/deploy-prod.yml` also runs on a `repository_dispatch` event of type
`emdash-publish` (it pins `ref` to `main`, because a dispatch runs from the default branch, `dev`).
Wire an EmDash plugin hook to send it:

```jsonc
// emdash-plugin.jsonc
"capabilities": ["content:read", "network:request"],
"allowedHosts": ["api.github.com"]
```

```ts
// src/plugin.ts
hooks: {
  'content:afterPublish': async (_event, ctx) => {
    const token = await ctx.settings.get<string>('githubToken'); // an encrypted plugin setting
    if (!token || !ctx.http) return;
    await ctx.http.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      body: JSON.stringify({ event_type: 'emdash-publish' }),
    });
  },
}
```

The token is a fine-grained GitHub token with `Contents: write` on this repo only, stored as the
plugin's encrypted setting (a sandboxed plugin can't read Worker environment variables), never in
the repo. The hook name, capabilities and `ctx.http` / `ctx.settings` calls follow EmDash's plugin
reference but this exact plugin has not been run against a live site, so treat it as a starting
point. Two costs: the run goes through the `production` environment, so it **waits for the
reviewers' approval** like any prod deploy (relax that rule if editors' publishes should go live
unattended), and bursts of publishes queue behind the `deploy-prod` concurrency group rather than
cancelling each other. Without the hook, a manual run of **Deploy prod** (or a push to `main`) does
the same job.
