---
title: "@getvitops/cli"
description: "The command line: generate, validate, scaffold, and wire up coding agents."
section: "Packages"
order: 10
---

```sh
npm i -D @getvitops/cli
```


CLI for the Vitops design-system generator. Turn a `design-system.json` into Tailwind v4,
Bricks, `DESIGN.md`, or standalone CSS output.

```sh
# scaffold a starter config (stamps a $schema for editor autocomplete)
npx vitops init

# validate it against the schema
npx vitops validate design-system.json

# generate output (comma-separate formats)
npx vitops generate --input design-system.json --format tailwind --out src/styles
npx vitops generate --format bricks,css --out dist
```

`--input` takes a `design-system.json` **or** the larger site config that embeds one (`company.json`) — told apart by shape, on every command that accepts it. `--theme <name>` picks a `designSystem.themes` entry other than the default, and `vitops validate` routes on the file's shape.

## Commands

| command                                            | does                                            |
| -------------------------------------------------- | ----------------------------------------------- |
| `vitops init [--out design-system.json] [--force]` | write a starter config with `$schema`           |
| `vitops validate <file>`                           | schema-check (non-zero exit on error)           |
| `vitops generate -i <file> -f <formats> -o <dir>`  | `tailwind` / `bricks` / `design` / `css` output |
| `vitops favicon -i <svg\|png> -o <dir>`            | generate a favicon set from a source image      |
| `vitops agents [-o AGENTS.md] [--docs-dir <dir>]`  | link the agent skill + AGENTS.md pointer        |
| `vitops docs [topic] [--all]`                      | print live reference docs to stdout             |
| `vitops lint [-f <fmt>] [-s <dir>]`                | find framework classes that resolve to nothing  |
| `vitops legal [-d <doc>] [-f <fmt>]`               | render privacy policy / terms / cookie notice   |
| `vitops icons [--sprite]`                          | report icon usage, and build the SVG sprite     |
| `vitops media [--raw <dir>] [--out <dir>]`         | encode raw video into WebM + MP4 + poster       |
| `vitops search setup [--dry] [--check]`            | onboard domains into Google Search Console      |
| `vitops search notify [--dry] [--check]`           | tell search engines about a deploy              |

`legal`, `icons` and `search` read a **site config** rather than a `design-system.json`, because
what they emit describes a site rather than a token set. `media` reads neither — an encoder setting
describes a build step, so it's all flags.

## Using the output

**Tailwind / Astro (EmDash).** Generate into your styles dir and import it (Tailwind v4):

```sh
vitops generate --input design-system.json --format tailwind --out src/styles
```

```css
@import './styles/tailwind.css';
```

(Or use [`@getvitops/vite`](https://www.npmjs.com/package/@getvitops/vite) to generate on
build/dev automatically.)

**WordPress / Bricks.** `--format bricks` writes a full, deployable theme payload: the CSS
bundle, the Bricks color/variable import JSON, the JS bundles, the custom `bricks/` elements,
and the `docs/` reference. Generate it into your Bricks **child theme's `dist/` directory**:

```sh
vitops generate --input design-system.json --format bricks --out wp-content/themes/bricks-child/dist
```

Then wire it up **once** — add this to the child theme's `functions.php` so the deployed loader
registers the elements and enqueues the CSS/JS:

```php
// Load the Vitops design system (elements + enqueued assets), if deployed.
$vitops = get_stylesheet_directory() . '/dist/bricks/load.php';
if ( file_exists( $vitops ) ) {
    require_once $vitops;
}
```

`dist/bricks/load.php` registers every element under a "Vitops" builder category, enqueues
`styles.min.css` + the JS bundles (versioned by mtime for cache-busting), and serves the
`docs/` bundle at `<theme>/dist/docs/`. Import `dist/bricks-colors-*.json` and
`dist/bricks-variables.json` into Bricks' Color + Variables managers.

### Shipping the output

The CLI only writes files — how they reach WordPress is up to you:

- **Local dev (WPLocal etc.):** point `--out` straight at the site's theme `dist/`, or symlink
  that `dist/` to your build output once so every regenerate is picked up automatically.
- **Remote:** rsync the generated directory to the theme over SSH —

  ```sh
  rsync -avz --delete dist/ user@host:wp-content/themes/bricks-child/dist/
  ```

- **CI:** run `vitops generate --format bricks` in your pipeline and deploy the artifact the
  same way you deploy the rest of the theme.

**Agent brief (`DESIGN.md`).** `--format design` emits a single `DESIGN.md` and **no CSS** — the
portable brief in [design.md](https://github.com/google-labs-code/design.md) format (YAML token
front matter, then prose) for a coding agent or design tool that doesn't have the toolchain
installed. It conventionally lives at the repo root beside `AGENTS.md`:

```sh
vitops generate --input design-system.json --format design --out .
```

`--format` is comma-separated, but a run shares one `--out` — so keep the brief its own invocation
whenever your stylesheet goes somewhere other than the repo root. Regenerate it with your CSS; it's
derived from the same config, so it can't drift from what the browser gets.

## Video (`vitops media`)

Keep unprocessed video in a `raw/` directory and encode it into web-ready outputs:

```sh
vitops media --raw raw --out src/assets/processed
```

**What it produces.** Each source becomes three files, with the directory structure under `--raw`
preserved:

| output      | what it is                    | why                                                                            |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `.webm`     | VP9, capped at 1920px, CRF 32 | the modern codec — smaller at the same quality                                 |
| `.mp4`      | H.264, `+faststart`           | older iOS and social-app webviews still don't decode VP9                       |
| `.jpg`      | poster frame                  | what the browser shows before the video is decodable                           |

Import them like any other asset, so your bundler content-hashes them:

```astro
---
import hero from '../assets/processed/hero.webm';
import poster from '../assets/processed/hero.jpg';
---

<video poster={poster.src} autoplay muted loop playsinline>
  <source src={hero} type="video/webm" />
</video>
```

**Runs are cached** on source content plus encode settings, in `.vitops/media-manifest.json`. A
24 MB clip that took 88 seconds the first time takes 0.14 seconds the second. A missing output
re-encodes; a corrupt manifest re-encodes everything — neither ever reads as "already done",
because that failure is silent and no rebuild fixes it.

**Commit the outputs and the manifest.** A fresh CI clone has neither and would re-encode from
scratch, so committing both means CI never needs ffmpeg. It also keeps history clean: ffmpeg output
isn't byte-reproducible across versions, so a CI re-encode would rewrite every video on any
toolchain bump. Use `--force` when you mean to re-encode.

**`ffmpeg` is an external tool, not an npm dependency** — install it yourself (`brew install
ffmpeg`, `apt install ffmpeg`, `winget install Gyan.FFmpeg`). The command fails without it rather
than skipping, because a page referencing a video that was never encoded is broken, not degraded.

Defaults are all flags: `--max-width` (1920), `--crf` (32 on VP9's scale; the MP4 uses the H.264
equivalent), `--audio` (dropped by default — the common case is a muted autoplay loop),
`--poster-time` (0, which is often black on a clip that fades in), `--outputs`. `--dry` prints
exactly what a run would do.

In Astro it's an integration option that runs in the same pass as your CSS —
`vitops({ css, media: { raw: 'raw', out: 'src/assets/processed' } })`. `@getvitops/vite` has a
matching `media` option, and `@getvitops/utils/media` exports `processMedia()` for anything else.

## Search engines (`vitops search`)

Two subcommands, split by what they touch: `search setup` gets a domain _into_ Search Console, and
`search notify` tells the engines a deploy happened. (`search notify` was the top-level
`vitops indexing`, renamed — there is no alias.)

### `vitops search notify`

Replaces the manual "open Search Console and resubmit" step at the end of a deploy. Configure it in
your site config under `seo.indexing`:

```jsonc
"seo": {
  "indexing": {
    "indexNow": { "key": "…" },
    "searchConsole": { "siteUrl": "sc-domain:acme.ca" },
    "priorityUrls": ["https://acme.ca/", "https://acme.ca/services"]
  }
}
```

```sh
vitops search notify --dry     # print the plan, make no requests
vitops search notify           # submit
vitops search notify --check   # a day or two later: did Google actually index them?
```

**What it does.** Reads your sitemap, diffs it against the previous run
(`.vitops/sitemap-snapshot.json`), and submits only what changed:

| channel            | what happens                                          | reaches                                |
| ------------------ | ----------------------------------------------------- | -------------------------------------- |
| **IndexNow**       | changed URLs POSTed to `api.indexnow.org`             | Bing, Yandex, Naver, Seznam, Yep       |
| **Search Console** | sitemap re-submitted via the API                       | Google                                 |
| **`--check`**      | URL Inspection on `priorityUrls`; non-zero if unindexed | read-only verification                 |

**Be clear-eyed about the ceiling here, because the obvious expectation is wrong.** Google exposes
no API that requests indexing — the button in Search Console isn't available anywhere, URL
Inspection is read-only, and the sitemap ping endpoint was removed in 2023. IndexNow reaches the
engines above; Google doesn't participate in it. So this automates every sanctioned step and then
_verifies_ the outcome. It does not make Google re-index on demand, and nothing can. Google's
Indexing API is deliberately not wired: it's scoped to job postings and livestreams, and using it
for ordinary pages violates its terms.

`--check` is the part that genuinely replaces the manual visit — run it on a schedule and CI tells
you when a page quietly falls out of the index.

**Wire up `<lastmod>` too, or the diff can't see edits.** `@astrojs/sitemap` emits none by default,
which means a crawler is told your pages exist but never that one changed:

```js
import vitops, { gitLastmod } from '@getvitops/astro';
vitops({ sitemap: { serialize: await gitLastmod() } });
```

It derives each date from the source file's last commit and leaves a page alone rather than
guessing (dynamic routes, ambiguous slugs, shallow clones) — an inaccurate `lastmod` is worse than
none, because Google stops trusting the field site-wide. Needs `fetch-depth: 0` in CI.

**Credentials.** The IndexNow key is public by design — it's served at `/<key>.txt` as the
ownership proof — so it lives in your config, and the Astro integration writes the file into
`public/` for you (`vitops search notify --new-key` generates one, `--write-key <dir>` writes it for
non-Astro stacks). Search Console takes either credential, added as an owner of the property: a
service account in `VITOPS_GSC_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`, or the same
user OAuth credential `search setup` uses. The service account is preferred when both are set,
since `notify` runs on every deploy and a service account does not expire. Neither is ever read
from the config file.

### `vitops search setup`

Onboards domains into Google Search Console as **domain properties** — the manual DNS-paste / wait /
verify / add-property dance, automated. List the domains in your site config under `searchConsole`,
keyed by bare hostname:

```jsonc
"searchConsole": {
  "acme.ca": { "delegatedOwners": ["colleague@acme.ca"], "fullUserGroup": "team@acme.ca" },
  "acme.com": {}
}
```

```sh
vitops search setup --dry            # print the plan, change nothing
vitops search setup --check          # report drift, exit non-zero if any domain isn't onboarded
vitops search setup                  # onboard every domain
vitops search setup --domain acme.ca # scope to one entry
```

**What it does, per domain.** Ensures the apex verification TXT in Cloudflare, verifies ownership via
the Site Verification API (DNS_TXT), adds the `sc-domain:` property, and adds any `delegatedOwners`
to the verified web resource.

| step         | behaviour                                                                              |
| ------------ | -------------------------------------------------------------------------------------- |
| **TXT**      | created in Cloudflare only when missing — records are never edited or deleted          |
| **verify**   | retried with backoff while DNS propagates; still-unverified is reported **PENDING**    |
| **property** | `sc-domain:` property added via the Search Console API                                 |
| **owners**   | `delegatedOwners` added to the web resource (additive — an existing owner is kept)     |

It is **idempotent**: a re-run of an onboarded domain is a no-op. `--check` reports drift and exits
non-zero without mutating anything; `--dry` prints the plan and stops.

**Full-User access is manual.** Search Console has no user/permission API, so granting a Google Group
Full-User access can't be automated — set `fullUserGroup` and the command surfaces it as a reminder
in the summary rather than attempting it.

**Credentials** come from the environment, never the config: `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit`
token — the standard "Edit zone DNS" template also carries the `Zone:Read` the zone lookup needs), and
a Google **user OAuth refresh token** as `VITOPS_GOOGLE_CLIENT_ID` / `VITOPS_GOOGLE_CLIENT_SECRET` /
`VITOPS_GOOGLE_REFRESH_TOKEN`, scoped to `siteverification` + `webmasters`.

Persist `.vitops/` between runs (a CI cache), or every run submits everything. An environment whose
`robots` policy says `noindex` is refused outright, so pointing this at staging can't publish it to
a search engine.

## Teaching AI agents (`vitops agents` + `vitops docs`)

This package **ships an agent skill** (`skill/SKILL.md`, the [Agent Skills](https://code.claude.com/docs/en/skills)
format) that teaches AI coding agents to fetch design-system context on demand. Nothing is
generated into your repo — reference docs print live via `vitops docs`:

```sh
vitops docs                # list topics
vitops docs classes        # the class vocabulary, rendered from YOUR design-system.json
vitops docs authoring      # every config field, from the JSON Schema
vitops docs formats        # tailwind vs css vs bricks (incl. which utilities Tailwind owns)
```

Because output is rendered at call time from your config + the installed package version, it is
never stale. `vitops agents` wires up discovery:

```sh
vitops agents                                   # links the skill + updates ./AGENTS.md
vitops agents --out CLAUDE.md                   # different pointer file
```

It symlinks `.agents/skills/vitops-design-system` and `.claude/skills/vitops-design-system` to the
skill inside the installed package (the links target the logical `node_modules/@getvitops/cli/skill`
path, so they survive version bumps and reinstalls — re-run only if you delete them), and writes a
marker-delimited **managed block** into your `AGENTS.md` listing the CLI commands and `vitops docs`
topics. Re-running only replaces the content between the `<!-- vitops:start -->` /
`<!-- vitops:end -->` markers.

Prefer materialized files (offline/CI contexts, or agents that can't run commands)? The legacy
layout still works: `vitops agents --docs-dir .vitops/docs` writes the full docs bundle as files
and points the AGENTS.md block at them (no skill link).

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
