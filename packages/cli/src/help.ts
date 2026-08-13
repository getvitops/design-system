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
  vitops icons [options]        Report which icons your source uses, and build the sprite
  vitops search <sub> [opts]    Search Console: onboard domains (setup) + notify deploys (notify)
  vitops ads <sub> [opts]       Ad properties: verify domains (setup) + emit pixels (tags) + lint
  vitops domains <sub> [opts]   Canonical domain: HTTPS, HSTS + alias redirects (setup)
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
  -o, --out <path>      Where to write (default: ./design-system.json)
      --force           Overwrite an existing file

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
      --site <path>     Site config carrying the "icons" block (default: ./site.json)
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

Domains subcommands:
  vitops domains setup [opts]   Configure the canonical domain on Cloudflare

Domains setup options:
  -i, --input <path>    Site config carrying site.domains (default: ./site.json)
      --site-env <env>  Environment whose A/B variant applies, and which scopes
                        environment-specific aliases (default: production)
      --dry             Print the plan and exit. Changes nothing. With
                        CLOUDFLARE_API_TOKEN set it reads the live zone first, so
                        the plan says what is already done; without one it plans
                        from scratch and says so, rather than refusing to run.
      --check           Report drift and exit non-zero if the canonical domain is
                        not fully configured. Mutates nothing.

  Makes site.domains true rather than decorative. Three things on the canonical
  zone: Always Use HTTPS (which upgrades http://<canonical> — no redirect rule
  covers that), HSTS, and one forwarding Page Rule per alias. The www <-> apex
  counterpart of the canonical host is redirected without needing an aliases entry.

  Gated on Cloudflare actually being the nameserver. A zone can sit in an account
  with status "pending" — visible in the dashboard, serving nothing, because the
  registrar still delegates elsewhere. Every write would then succeed and take
  effect nowhere, so that case is reported with the nameservers to set rather than
  as a clean run.

  HSTS is applied only AFTER Always Use HTTPS is confirmed on, and is deferred (not
  failed) otherwise: a browser holds the policy for its max-age no matter what the
  zone says afterwards. preload additionally requires maxAge >= 1 year and
  includeSubDomains — the preload list's own rules — and is reported as blocked
  rather than submitted and rejected.

  Page Rules are addressed individually, and identity is the target pattern: a rule
  matching <alias>/* is updated, anything else on the zone is never read back,
  rewritten or removed. There is no delete verb. Note the per-zone quota is low (3
  on Free, 20 on Pro) and Cloudflare is steering new work toward Redirect Rules; a
  run that would exceed the quota says so instead of failing opaquely.

  Needs a wider token than the other Cloudflare commands: Zone:Read, Zone
  Settings:Edit, Zone:Page Rules:Edit, plus Zone:DNS:Edit when an alias has no
  record yet (an alias host gets a proxied AAAA 100:: placeholder so requests reach
  Cloudflare at all — a rule on a host that doesn't resolve there is inert). No
  dashboard template bundles all four; build a custom token.

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

export const DOMAINS_HELP = `vitops domains — make the declared canonical domain true

  vitops domains setup [opts]   Configure the canonical domain on Cloudflare:
                                Always Use HTTPS, HSTS, and one forwarding Page
                                Rule per alias

Run \`vitops --help\` for the full option list.
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
  'icons',
  'search',
  'ads',
  'domains',
  'media',
] as const;

/** Commands that group subcommands instead of taking options directly. */
export const SUBCOMMANDS: Record<string, readonly string[]> = {
  search: ['setup', 'notify'],
  ads: ['setup', 'tags', 'lint'],
  domains: ['setup'],
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
        : command === 'domains'
          ? DOMAINS_HELP
          : undefined) ??
    HELP
  );
}
