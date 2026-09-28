/**
 * The CLI's help text, and the addressing that lets every subcommand answer
 * `--help`.
 *
 * It lives beside `cli.ts` rather than inside it for one reason: `cli.ts` calls
 * `main()` at import time, so nothing can import it to check anything. The
 * drift guard in `help.test.ts` needs `COMMANDS` and `helpSection` as values.
 */

export const HELP = `vitops — generate design-system outputs from a design-system.json

Anywhere a command takes --input, that file may be a design-system.json OR the
larger site config that embeds one (company.json / site.json). The two are told
apart by shape, and a site config also supplies the site-level facts generation
reads — its default colour scheme, its legal documents, its icon sprite.

Usage:
  vitops generate [options]     Generate platform output from a config
  vitops init [options]         Scaffold a starter design-system.json
  vitops validate <file>        Validate a config against the schema it says it is
  vitops favicon [options]      Generate a favicon set from a source image
  vitops agents [options]       Link the design-system agent skill + AGENTS.md pointer
  vitops docs [topic]           Print live design-system reference docs to stdout
  vitops lint [opts] [files]    Report classes that resolve to nothing + primitives you re-implemented
  vitops legal [options]        Render legal documents from a site config
  vitops robots [options]       Render robots.txt from a site config's environment
  vitops reviews [options]      Fetch + cache Google Business Profile reviews
  vitops icons [options]        Report which icons your source uses, and build the sprite
  vitops search <sub> [opts]    Search Console: onboard domains (setup) + notify deploys (notify)
  vitops ads <sub> [opts]       Ad properties: verify domains (setup) + emit pixels (tags) + lint
  vitops setup <sub> [opts]     Scripted onboarding: repo, hosting, domain, search, ads, all
  vitops email <sub> [opts]     Sender-domain onboarding: check (setup) + deploy guard (check)
  vitops media [options]       Encode raw video into web-ready WebM + MP4 + poster

Generate options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
  -f, --format <list>   bricks | css | tailwind | design (comma-separated; default: bricks)
                        design emits DESIGN.md only (the agent-facing brief) — pair it
                        with --out . to write it beside AGENTS.md, or compose:
                        --format css,design
  -o, --out <dir>       Output directory (default: ./dist)
      --theme <name>    Which designSystem.themes entry to build, when --input is
                        a site config (default: its defaultTheme, else "default")
      --site <path>     Site config, when it is a different file from --input.
                        Emits legal/*.html into the output directory (see:
                        vitops legal). Omitted with a plain design-system.json:
                        no legal files.
      --site-env <env>  Environment whose A/B variant applies (default: production)

Init options:
  -o, --out <path>      Where to write (default: ./design-system.json, or
                        ./site.json with --site)
      --force           Overwrite an existing file
      --site            Write a site config (Config) instead of a bare
                        design-system.json — embeds a starter design system at
                        designSystem.themes.default, since a Config can't
                        merely reference a sibling file
      --name <name>     organization.name, when --site is set
      --url <url>       site.environments.{production,dev}.url, when --site is set

Validate options:
  <file>                Config to check (default: ./design-system.json). Either
                        kind — a design-system.json or the config that embeds one.
  -i, --input <path>    Same, as a flag
      --site-env <env>  Environment whose A/B variant applies (default: production)

  Checks the schema, then the things a schema cannot: that every role points at a
  palette hue that exists, that every var() an authored declaration references
  resolves to a token this config emits, and that the colour grammar is current.

Favicon options:
  -i, --input <path>    Source SVG or PNG (required)
  -o, --out <dir>       Output directory (default: ./public)
      --low-res <path>  Optional simplified source for the 16px icon
      --background <hex>  Background under the maskable icons, which must be
                        opaque (default: #ffffff)

Agents options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json;
                        validated if present)
      --theme <name>    Theme to read, when --input is a site config
  -o, --out <path>      Doc file to update, idempotently (default: ./AGENTS.md)
      --docs-dir <dir>  Legacy layout: write the docs bundle as files to this dir
                        instead of linking the packaged skill

Docs options:
  <topic>               classes | authoring | formats | color | scales | patterns | elements
                        (no topic: list topics with summaries)
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
      --theme <name>    Theme to render docs from, when --input is a site config
      --all             Print every topic, concatenated

Icons options:
  -i, --input <path>    Site config carrying the "icons" block (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --src <dir>       Source to scan for icon usage (default: ./src)
      --sprite          Also build the SVG sprite
  -o, --out <dir>       Where to write icons.svg with --sprite (default: ./dist)
      --json            Machine-readable report on stdout

Lint options:
  -i, --input <path>    design-system.json or site config (default: ./design-system.json)
      --theme <name>    Theme to judge classes against, when --input is a site config
  -f, --format <fmt>    Format you build (bricks | css | tailwind; default: bricks).
                        Responsive md-* classes are real in css/bricks, inert in tailwind.
  -s, --src <dir>       Directory to scan (default: ./src)
      --strict          Also fail on suggestions (reuse hints), not just on
                        classes that resolve to nothing
  [files...]            Lint these paths instead of scanning --src. Unreadable
                        and non-source paths are skipped, so this can be wired
                        into a pre-commit hook that appends the staged files.
      --fix             Rewrite pre-1.0 colour-grammar token references
                        (var(--<role>-<suffix>) → var(--color-<target>-<role>…))
                        in CSS and <style> blocks. Applied in ONE pass, so the
                        renames that rotate cannot compound. Nothing else is
                        rewritten — every other finding is a judgement call.

  Run this after a major bump: it is the migration tool for anything the
  changelog says was renamed.

Legal options:
  -i, --input <path>    Site config: .json, or a .js/.ts module with a default
                        export (default: ./site.json)
  -d, --doc <name>      privacy | terms | cookies (repeatable; default: those
                        enabled in the config)
  -f, --format <fmt>    md | html | portable-text (default: md)
                        html suits WordPress/Bricks and plain sites;
                        portable-text suits EmDash
  -o, --out <dir>       Write files here (default: print to stdout)
      --site-env <env>  Environment whose A/B variant applies (default: production)

  Generated from your config — a starting point, not legal advice. Review before
  publishing, and make sure the config describes what your site actually does.

Robots options:
  -i, --input <path>    Site config: .json, or a .js/.ts module with a default
                        export (default: ./site.json)
  -o, --out <dir>       Write robots.txt here (default: print to stdout)
      --site-env <env>  Which site.environments entry to render for (default: production)

  Reads the resolved environment's robots directive (falling back to
  site.seo.robots) — the same fact vitops search notify's noindex gate already
  reads. A directive containing noindex disallows every user agent and emits
  no Sitemap line; otherwise it allows everything and links
  site.seo.indexing.sitemapUrl, or the derived <canonical>/sitemap-index.xml.

Reviews options:
  -i, --input <path>    Site config carrying site.reviews (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --location <key>  Fetch only this site.reviews.locations key
      --cache <path>    Where to read/write the cache (default: .vitops/reviews.json)
      --out <dir>       Also write the selected reviews per location as JSON here
      --dry             Print the plan and exit. Fetches nothing.
      --check           Fetch and diff against the cache; exit non-zero on drift.
                        Mutates nothing.

  Reviews live only on the legacy Business Profile v4 API — there is no newer
  replacement — and the calling GCP project must be allowlisted by Google before
  any call succeeds (a one-time approval; a 403 says so rather than failing
  opaquely). Auth is user OAuth, the same VITOPS_GOOGLE_CLIENT_ID /
  VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN (or ADC login) that
  vitops search setup uses, scoped to business.manage. The cache is meant to be
  committed: reviews change slowly, and a build should not need a live Google
  credential. Review JSON-LD is off by default (site.reviews.schema) — a business
  marking up reviews of itself is not eligible for Google's rich results and
  risks a manual action.

Search subcommands:
  vitops search setup [opts]    Onboard site.searchConsole domains into GSC
  vitops search notify [opts]   Tell search engines about a deploy (sitemap + IndexNow)

Search setup options:
  -i, --input <path>    Site config carrying site.searchConsole (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --domain <name>   Scope to a single site.searchConsole entry
      --dry             Print the plan and exit. Changes nothing, and runs without
                        credentials (planning from scratch, which it says).
      --check           Report drift and exit non-zero if any domain is not fully
                        onboarded. Mutates nothing, but does need credentials —
                        drift is a comparison against live state.

  For each domain it ensures the apex verification TXT in Cloudflare, verifies
  ownership (DNS_TXT, retried with backoff while DNS propagates — a still-
  unverified domain is reported PENDING, not failed), adds the sc-domain: property,
  and adds any delegatedOwners to the web resource. DNS is only ever created,
  never edited or deleted. Credentials come from the environment:
  CLOUDFLARE_API_TOKEN (Zone:DNS:Edit + Zone:Read — the standard "Edit zone DNS"
  template covers both; Zone:Read is what the zone-by-name lookup uses), and
  VITOPS_GOOGLE_CLIENT_ID /
  VITOPS_GOOGLE_CLIENT_SECRET / VITOPS_GOOGLE_REFRESH_TOKEN (a user OAuth token
  scoped to siteverification + webmasters). Granting a Google Group Full-User
  access has no API and is surfaced as a reminder.

  Or just be logged in: with no VITOPS_GOOGLE_* set, an Application Default
  Credentials login is used —
    gcloud auth application-default login \\
      --scopes=openid,https://www.googleapis.com/auth/siteverification,\\
  https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
  ADC authenticates through a shared OAuth client that owns no project, so it also
  needs site.google.project in the config (sent as x-goog-user-project), both APIs
  enabled on that project, and serviceusage.services.use on it. One project per site
  is what keeps each site's API usage and billing separate.

Search notify options:
  -i, --input <path>    Site config carrying seo.indexing (default: ./site.json)
      --site-env <env>  Environment to notify for (default: production). An
                        environment whose robots policy says noindex is refused.
      --sitemap <src>   Sitemap URL or local path (default: from the config)
      --urls <list>     Comma-separated URLs to submit, skipping the diff
      --all             Submit every URL in the sitemap, not just what changed
      --dry             Print the plan and exit. Makes no requests.
      --check           Read-only: ask Google whether seo.indexing.priorityUrls
                        are indexed. Exits non-zero if one is not.
      --new-key         Print a fresh IndexNow key and exit
      --write-key <dir> Write the IndexNow key file into <dir> (for stacks with
                        no Astro integration to do it — Bricks, WordPress)
      --snapshot <path> Changed-URL state file (default: .vitops/sitemap-snapshot.json).
                        Persist it between runs (a CI cache) or every run submits
                        everything.

  What notify can and cannot do: Google exposes no "request indexing" API, and its
  sitemap ping endpoint was removed in 2023 — so it resubmits your sitemap
  through the Search Console API and verifies the result with --check. IndexNow
  reaches Bing, Yandex, Naver, Seznam and Yep; Google does not participate.
  Search Console takes either credential, whichever you already have, added as an
  owner of the property: a service account in VITOPS_GSC_SERVICE_ACCOUNT (inline
  JSON) or GOOGLE_APPLICATION_CREDENTIALS (a path), or the same user OAuth
  credential "search setup" uses (VITOPS_GOOGLE_CLIENT_ID / _CLIENT_SECRET /
  _REFRESH_TOKEN). The service account is preferred when both are set — this runs
  on every deploy, and it does not expire.

Ads subcommands:
  vitops ads setup [opts]       Ensure each platform's domain-verification DNS record
  vitops ads tags [opts]        Print the consent-gated pixel snippets
  vitops ads lint [opts]        Report ad properties the rest of the config can't see

Ads setup options:
  -i, --input <path>    Site config carrying site.ads (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --provider <name> Scope to one site.ads entry (google | meta | linkedin |
                        reddit | tiktok | microsoft | pinterest | snapchat)
      --dry             Print the plan and exit. Creates nothing. With
                        CLOUDFLARE_API_TOKEN set it reads live DNS first, so the
                        plan says what is already done; without one it plans from
                        scratch and says so, rather than refusing to run.
      --check           Report drift and exit non-zero if any property is not
                        linked. Mutates nothing, prompts for nothing.
      --no-prompt       Never ask for a missing token; fail with the field name
                        instead (the default when stdin is not a TTY, e.g. in CI)
      --no-write        Don't persist an answered token back into the config

  Four platforms verify a domain by DNS TXT — Meta, TikTok, Pinterest, Snapchat —
  and that record is the one thing this creates for you (in Cloudflare, via
  CLOUDFLARE_API_TOKEN; created only, never edited or deleted). Google Ads,
  LinkedIn, Reddit and Microsoft Ads have no domain verification at all: linking
  there is the tag and the account ID, and the run says so rather than skipping in
  silence. No platform Marketing API is called — Meta's needs a system-user token
  and Google's needs an approved developer token, so the final "Verify" click stays
  a reminder. The verification token is not a secret (it is published in DNS, which
  is the ownership proof), so it lives in the config and is prompted for on the
  first run.

Ads tags options:
  -i, --input <path>    Site config carrying site.ads (default: ./site.json)
      --provider <name> Print one platform's tag
      --strategy <s>    idle | async | interaction (default: idle)

  Prints each pixel as an INERT, consent-gated <script>: type="text/plain" with the
  library URL on data-src, so an undecided visitor's page issues no third-party
  request. For stacks with no Astro integration — Bricks, WordPress, Eleventy.
  Paste into your template; @getvitops/core's consent runtime activates them.

Ads lint options:
  -i, --input <path>    Site config carrying site.ads (default: ./site.json)

  Reports the gaps that are invisible at runtime: a click-ID parameter this
  platform stamps that attribution doesn't capture, a pixel while site.tracking is
  off (every conversion arrives unattributed), and a configured property with no
  tag ID. Exits non-zero on a finding.

Crm check options:
  -i, --input <path>    Site config carrying site.crm (default: ./site.json)
      --site-env <env>  Environment to resolve (default: production)

  Fetches the live field/property list (HubSpot: crm/v3/properties/contacts;
  Bigin: bigin/v2/settings/fields) and reports every fieldMap/trackingFields
  target that doesn't exist there. HubSpot rejects a submission naming an
  unrecognised property; Bigin silently ignores it — this is the only way to
  see a broken mapping before a real submission finds it. Needs
  VITOPS_HUBSPOT_ACCESS_TOKEN, VITOPS_ZOHO_CLIENT_ID/_CLIENT_SECRET/
  _REFRESH_TOKEN, or (unused for now) VITOPS_JOBBER_CLIENT_ID/_CLIENT_SECRET/
  _REFRESH_TOKEN, matching whichever provider site.crm names. Jobber currently
  renders fieldMap/trackingFields as note-text lines rather than app-configured
  custom fields, so there is nothing live to check there yet. Exits non-zero
  on any missing target.

Crm setup options:
  -i, --input <path>    Site config carrying site.crm (default: ./site.json)
      --site-env <env>  Environment to resolve (default: production)
      --dry             Print what would be created and exit. Creates nothing.

  HubSpot: creates missing contact properties named by fieldMap/trackingFields.
  Bigin: no such API exists, so this always prints a manual reminder listing
  the fields to add in Zoho Bigin's field editor, then re-run "crm check".
  Jobber: app-configured custom fields aren't wired up yet, so this prints a
  reminder instead of creating anything.

Setup repo options:
      --dry             Print the plan and exit
      --check           Report drift/blocked steps and exit non-zero, mutating nothing
      --public          Create the repo public (default: private)
      --platform <p>    cloudflare (default) | node — shown for parity with the hosting stage's plan
      --no-dev-resources  Same — this stage never provisions D1/R2 either way

  Creates the GitHub repo (via \`gh\`), pushes main + dev, makes dev the default
  branch, and requests main branch protection + the production/dev environments.
  Idempotent — a re-run of a fully set-up repo is all skips. Branch protection and
  environment reviewers 403 on a private repo without GitHub Pro/Team; that is
  reported as blocked, with the manual Settings path, never as a failure.

Setup hosting options:
      --dry             Print the plan and exit
      --check           Report drift/blocked steps and exit non-zero, mutating nothing
      --platform <p>    cloudflare (default) | node
      --no-dev-resources  Skip D1/R2 — a pure static Workers Assets project has
                        nothing to provision, just the account id + token

  Provisions the isolated dev D1 database + R2 bucket (cloudflare) and sets the
  DEV_D1_ID / CLOUDFLARE_ACCOUNT_ID repo secrets, once \`vitops setup repo\` has run.
  CLOUDFLARE_API_TOKEN is always reported as blocked — no API can create one; see
  the printed dashboard link. Requires \`npx wrangler login\` first.

Setup domain options:
  -i, --input <path>    Site config (default: ./site.json)
      --site-env <env>  Environment to check (default: production)
      --dry             Print the plan and exit
      --check           Exit non-zero if the domain state is inconsistent
      --domain <apex>   Print the manual cutover steps for this apex

  Plans and checks the consistency between wrangler.jsonc's workers.dev/custom-domain
  state and site.json's environments/domains/robots — it NEVER edits wrangler.jsonc
  or deploys. Cutover overwrites the zone's DNS record and can take an existing live
  site down; that step is manual, on purpose. See SETUP.html's "Domain strategy" stage.

Setup search options:
  Forwards every option to \`vitops search setup\` unchanged — see "Search setup
  options:" above.

Setup ads options:
  Forwards every option to \`vitops ads setup\` unchanged — see "Ads setup options:"
  above.

Setup all options:
      --dry             Print every stage's plan and exit
      --check           Report drift across every stage and exit non-zero
      --public          Create the repo public, for the repo stage
      --platform <p>    cloudflare (default) | node, for the repo + hosting stages
      --no-dev-resources  Skip D1/R2 in the hosting stage (repo stage never provisions them)

  Runs repo, hosting, search, ads in order. Stops at the first stage that fails;
  a blocked step (the API token, GitHub Pro/Team gating) is reported, not fatal.

Email subcommands:
  vitops email setup [domain]  Onboard a from-address domain, waiting for its DNS to resolve
  vitops email check [opts]    Non-blocking deploy guard: warn if a from domain isn't onboarded

Email setup options:
  -i, --input <path>    Site config carrying site.notifications.email (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
  [domain]              Onboard this exact name instead of deriving candidates from
                        config + a source scan
      --src <dir>       Source to scan for from: literals as a supplement to config
                        (default: ./src)
      --dry             Print the plan and exit. Needs no credential — plans from
                        scratch and says so.
      --check           Report drift and exit non-zero. Mutates nothing.
      --no-prompt       Never ask before enabling a domain (the default when
                        stdin is not a TTY, e.g. in CI — it just enables)
      --timeout <s>     Cap on each DNS-propagation poll wait, in seconds (default: 5)

  The onboarded entity is an EXACT name, and it is usually a subdomain
  (send.example.com), never the apex a from address names. When the exact
  domain is absent but a sibling in the same zone is already onboarded, this
  is reported blocked rather than silently enabling the apex too — enabling
  it rewrites _dmarc.<domain>, which can tighten policy on every OTHER mail
  sent from that domain. Sending from the onboarded sibling is the
  recommended fix. Needs CLOUDFLARE_API_TOKEN (Zone:Read + an Email Sending
  scope — broader than the "Edit zone DNS" template other commands use).

Email check options:
  -i, --input <path>    Site config carrying site.notifications.email (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies (default: production)
      --src <dir>       Source to scan for from: literals (default: ./src)
      --strict          Exit non-zero on drift (the default just warns and exits 0)
      --skip            Skip the check entirely (same as VITOPS_SKIP_EMAIL_CHECK)

  Meant to run before a deploy. With no CLOUDFLARE_API_TOKEN it reports "not
  checked" and exits 0, so a CI job without the secret never fails on the
  check itself. Skip per-site with site.notifications.email.verifySender: false
  when the scan can't see the real from address and the warning would be a
  false positive.

Media options:
      --raw <dir>       Directory of unprocessed video, walked recursively
                        (default: ./raw)
  -o, --out <dir>       Where the encoded outputs go (default: ./src/assets/processed).
                        Subdirectories under --raw are preserved.
      --max-width <px>  Cap the output width, keeping aspect ratio (default: 1920;
                        0 disables scaling)
      --crf <n>         Quality on VP9's scale, 0-63, lower is better (default: 32).
                        The MP4 fallback uses the equivalent on H.264's scale.
      --max-bitrate <r> Optional ceiling, e.g. 2M or 800k (default: none, which is
                        constant quality rather than constrained)
      --audio           Keep the audio track (default: dropped — the common case is
                        a muted autoplay loop)
      --poster-time <s> Timestamp the poster frame is taken from (default: 0, which
                        is often black on a clip that fades in)
      --outputs <list>  Comma-separated: webm | mp4 | poster (default: all three)
      --manifest <path> Cache file (default: .vitops/media-manifest.json)
      --force           Re-encode everything, ignoring the cache
      --dry             Print the plan and exit. Encodes nothing.

  Needs ffmpeg on PATH — it is an external tool, not an npm dependency, and this
  command fails rather than quietly skipping. Commit the outputs and the manifest:
  ffmpeg output is not reproducible across versions, so re-encoding in CI churns
  the diff on every toolchain bump. Use --force when you mean to re-encode.

Common:
  -h, --help            Show this help
`;

export const SEARCH_HELP = `vitops search — Google Search Console

  vitops search setup [opts]    Onboard site.searchConsole domains as GSC domain properties
  vitops search notify [opts]   Tell search engines a deploy happened (sitemap + IndexNow)

Run \`vitops --help\` for the full option list for each subcommand.
`;

export const ADS_HELP = `vitops ads — link this site to its ad properties

  vitops ads setup [opts]       Ensure each platform's domain-verification DNS record
  vitops ads tags [opts]        Print the consent-gated pixel snippets
  vitops ads lint [opts]        Report ad properties the rest of the config can't see

Run \`vitops --help\` for the full option list for each subcommand.
`;

export const CRM_HELP = `vitops crm — push form submissions into a client CRM

  vitops crm check [opts]       Compare site.crm's fieldMap/trackingFields against the live CRM
  vitops crm setup [opts]       Create missing HubSpot properties (Bigin/Jobber have no such API)

Run \`vitops --help\` for the full option list for each subcommand.
`;

export const EMAIL_HELP = `vitops email — sender-domain onboarding checks

  vitops email setup [domain]  Onboard a from-address domain, waiting for its DNS to resolve
  vitops email check [opts]    Non-blocking deploy guard: warn if a from domain isn't onboarded

Run \`vitops --help\` for the full option list for each subcommand.
`;

export const SETUP_HELP = `vitops setup — the scripted path from an empty scaffold to a live site

  vitops setup repo [opts]      GitHub repo + branch policy (main protected, dev open)
  vitops setup hosting [opts]   Dev D1 + R2 + repo secrets (cloudflare) or a Node target
  vitops setup domain [opts]    Plan/check the workers.dev-vs-custom-domain consistency
                                 (never applies the cutover — see SETUP.html)
  vitops setup search [opts]    Forwards to \`vitops search setup\`
  vitops setup ads [opts]       Forwards to \`vitops ads setup\`
  vitops setup all [opts]       Run repo, hosting, search, ads in order

Run \`vitops --help\` for the full option list for each subcommand.
`;

/**
 * Every command `main()` dispatches. Exported so the unknown-command message
 * and the help drift guard read the same list — the message used to carry its
 * own hand-maintained copy.
 */
export const COMMANDS = [
  'generate',
  'init',
  'validate',
  'favicon',
  'agents',
  'docs',
  'lint',
  'legal',
  'robots',
  'reviews',
  'icons',
  'search',
  'ads',
  'crm',
  'setup',
  'email',
  'media',
] as const;

/** Commands that group subcommands instead of taking options directly. */
export const SUBCOMMANDS: Record<string, readonly string[]> = {
  search: ['setup', 'notify'],
  ads: ['setup', 'tags', 'lint'],
  crm: ['check', 'setup'],
  setup: ['repo', 'hosting', 'domain', 'search', 'ads', 'all'],
  email: ['setup', 'check'],
};

/**
 * The slice of `HELP` documenting one command, addressed by its heading.
 *
 * `HELP` is already organised as `<Command> options:` blocks, so this reads the
 * section rather than duplicating it — a second copy of every option list is a
 * second thing to keep true.
 */
export function helpSection(...parts: string[]): string | undefined {
  // Headings capitalise the command only, not the subcommand ("Search setup
  // options:"), so capitalising every part silently misses the two-word ones.
  const name = parts.join(' ');
  const title = `${name.charAt(0).toUpperCase()}${name.slice(1)} options:`;
  const start = HELP.indexOf(`\n${title}\n`);
  if (start === -1) return undefined;
  const body = HELP.slice(start + 1);
  // Stop at the next top-level heading (`Legal options:`, `Common:`, …).
  const next = body.slice(title.length).search(/\n[A-Z][A-Za-z ]*:\n/);
  return next === -1 ? body : body.slice(0, title.length + next);
}

/**
 * `--help` on a leaf subcommand used to reach `parseArgs`, which is strict and
 * declares no `help` option — so `vitops lint --help` exited non-zero with a
 * bare `Unknown option '--help'`. Every subcommand answers it now, and it is
 * resolved in one place rather than in fifteen `options` objects, so a new
 * command cannot forget to.
 */
export const wantsHelp = (argv: string[]): boolean =>
  argv.includes('-h') || argv.includes('--help');

/** The help text to print for `vitops <command> [sub] --help`. */
export function helpFor(command: string, argv: string[]): string {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : undefined;
  return (
    (sub ? helpSection(command, sub) : undefined) ??
    helpSection(command) ??
    (command === 'search'
      ? SEARCH_HELP
      : command === 'ads'
        ? ADS_HELP
        : command === 'crm'
          ? CRM_HELP
          : command === 'setup'
            ? SETUP_HELP
            : command === 'email'
              ? EMAIL_HELP
              : undefined) ??
    HELP
  );
}
