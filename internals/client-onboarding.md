# Client onboarding

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

Standing up a new client site is the one job every other subsystem above assumes has already
happened — a `vitops.json`, a GitHub repo with the right branch policy, hosting resources, a domain
decision. `SETUP.html` (`packages/create/assets/sop/`, mirrored byte-identically into both
`@getvitops/create` templates) is the checklist; `vitops setup` (`packages/cli/src/commands/setup.ts`
→ `@getvitops/utils/hosting`) is what most of it runs.

**Every scaffolded template ships a `vitops.json`, not a bare `design-system.json`.**
`ConfigSchema` requires `designSystem` and there is no file-level `extends`, so a config that
merely referenced a sibling design-system file was never expressible — the token set has to be
embedded, under `designSystem.themes.default`. `defaultSiteConfig()`
(`packages/generator/src/index.ts`, beside `defaultConfig()`) is what `vitops init --site` writes.
This is what turns on `legal`/`robots`/`search`/`ads`/`reviews`/`icons` for a fresh scaffold — all
six default to reading `vitops.json` and previously had nothing to read.

**`vitops setup` absorbs what used to be template-local `init-github.mjs`/`init-hosting.mjs`
scripts**, so the capability reaches every consumer, not just a fresh `vp create` scaffold — the
templates' own `pnpm run init:github`/`init:hosting`/`sop` scripts are now one-line callers.
`repo`/`hosting` follow the same pure-planner/executor split as `onboarding/`, `ads/` and
`indexing/`: `@getvitops/utils/hosting/plan.ts` decides everything (idempotent — a step whose
desired state already holds resolves to `skip`, so a re-run is all skips by construction) and
`wrangler.ts`/`github.ts` execute a plan and decide nothing, shelling out to `wrangler`/`gh` for
the same reason `@getvitops/utils/media` shells to `ffmpeg` — an external tool, not an npm
dependency, with no token-free API alternative. `search`/`ads` are **not** reimplemented inside
`setup` — it forwards to the CLI's own `search setup`/`ads setup` as child processes, so there is
exactly one implementation of each and no risk of the two drifting.

**Never destructive, and one thing is permanently unautomatable.** No `setup` step deletes a
database, bucket, branch, protection rule or DNS record — matching `onboarding/cloudflare.ts`'s
DNS verbs, which have no update or delete either. `CLOUDFLARE_API_TOKEN` is always reported
`blocked`: no Cloudflare API can mint a token, so this is a permanent manual step, not a gap to
close later. Branch protection and the `production` environment 403 on a private repo without
GitHub Pro/Team — also `blocked`, carrying the manual Settings path, never a failure.

**The domain-strategy decision has no schema field, and that is deliberate.** The workers.dev-vs-
custom-domain choice is already expressible twice over: during the workers.dev phase
`site.environments.<env>.url` **is** the workers.dev URL and `site.domains` is absent (`domains`
is optional; `canonical` is required only _within_ it); at cutover `domains.canonical` appears and
the env URL changes. A `workersDev` boolean would be a second source of truth for something
derivable, and `site.deployment` is documented as "informational for tooling" — it deliberately
declines to model platform mechanics. Instead `vitops setup domain` plans and checks the
_consistency_ between `wrangler.jsonc`'s `workers_dev`/`routes` state and the config
(`planDomainConsistency`), catching two real launch defects: a live workers.dev site whose
`<link rel=canonical>` still points at an old site the cutover hasn't happened for yet, and a
cut-over site still advertising the workers.dev origin. Paired with **workers.dev URLs being
indexable** — `site.environments.<env>.robots: "noindex,nofollow"` during the workers.dev phase is
a launch gate `vitops robots` and `search notify`'s noindex gate already honour, at zero new
schema cost.

**`vitops setup domain` never performs the cutover itself** — it only plans and checks. Setting
`routes[].custom_domain: true` in `wrangler.jsonc` makes Cloudflare create/overwrite the zone's DNS
record on the next deploy, which is the instant an existing live site at that domain goes dark.
That is the one irreversible-feeling step in the whole sequence, and it stays a human's call, made
by working `SETUP.html`'s "Domain strategy" stage — never something a command applies as one part
of a bigger batch. `vitops search setup` is safe to run _before_ cutover regardless: it only ever
_creates_ an apex TXT record, never touching the zone's routing.

**Two audiences read the same checklist.** `SETUP.html` is canonical — one copyable command per
step in plain language, what it does, how to tell it worked. `.agents/skills/setup/SKILL.md`
(mirrored into both templates, modelled on the existing `promote` skill) lets an agent work the
same list autonomously; it adds only sequencing and the human-only stops (the API token, the
domain cutover, publishing any generated legal document) and does not restate the steps — two
copies of the same content would drift. `SETUP.html`'s checkbox state persists in `localStorage`
today, behind one named seam (`window.__vitopsSopStore`) so a later EmDash-backed store is a
swap, not a rewrite — that store does not exist yet; don't build it speculatively.
