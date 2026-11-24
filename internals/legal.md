# Legal documents

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`generateLegal(site, { docs, output })` (`packages/generator/src/legal/`) renders a privacy
policy, terms of service, cookie notice and accessibility statement from a **`Config`**. It reads facts from two of its
sections — the company from `organization`, what the site actually does from `site` — which is
the split the documents already assumed. It is a sibling of
`generateDocs`, **not** a `generate()` format, and that is structural rather than stylistic:
`generate()` is keyed to a `DesignSystem`, so a legal format would be a format that ignores
its own input. It returns a `{ filename: content }` map and lets each caller write it.

The governing rule is **the config records facts; the template owns prose.** Nothing in
`derive.ts` writes a sentence a lawyer would review, and no template invents a fact. That is
what lets wording be corrected without touching a consumer's config, and a consumer's
provider change without touching prose. It also means **the fix for a wrong policy is a
corrected config** — hand-editing the output is overwritten by the next build.

Four things here are load-bearing:

- **The provider table (`providers.ts`) is what makes derivation possible.** A policy naming
  Plausible while the site runs GA is a compliance defect, not a typo, so the provider comes
  from which analytics ID is set, whether `site.security.turnstile.siteKey` exists, and what
  `site.deployment.platform` says — never from a hand-maintained string. It covers only what the
  schema can imply; everything else (payment, CRM, mail) is declared in
  `site.legal.privacyPolicy.processors` and flows through the same pipeline. `cookies: []` is
  **meaningfully different from `undefined`**: it asserts a provider is cookieless (Plausible),
  which the cookie notice states positively rather than omitting.
- **Form templates are the PII inventory.** `site.templates` entries of type `form` are the only
  place the config says what personal information the site actually collects, so
  `piiCollected` derives from their `FormFieldSchema` fields. `hidden` fields and honeypots are
  excluded — neither is visitor-supplied, and describing them as collected would be untrue.
- **The markdown subset is closed and the renderer throws outside it.** We author every
  template, so `render.ts` is exactly as capable as they are: `#`/`##`/`###`, `- ` bullets,
  `> ` quote, `**strong**`, `` `code` ``, `[text](url)` links (added for the accessibility
  statement; the URL is made safe at the output, not the input). An unsupported construct is an
  error, not a silent degrade — that is what stops a literal `| --- |` reaching a published
  page. HTML goes through
  `nodesToHtml` from `@getvitops/utils` (escaping already solved); Portable Text maps the `> `
  quote to `vitops_banner` and **drops the `# ` heading**, which is EmDash's `data.title` field.
- **`JURISDICTIONS` in `config.ts` and `TEMPLATES` in `legal/templates/index.ts` are checked
  against each other** by `satisfies`. Adding a jurisdiction is: author three templates, add
  one enum member, add one registry key — skip either and it fails to compile rather than
  rendering against the wrong body of law. `ca` (PIPEDA) and `qc` (Quebec Law 25) ship. The
  `ca` prose names the Office of the Privacy Commissioner of Canada and frames transfers as
  "outside of Canada", so do not reuse it elsewhere; `qc` is its own text (Commission d'accès
  à l'information, transfers "outside Quebec") and carries a second review banner naming
  counsel review, the person in charge of privacy and French availability.

Delivery is one renderer, four consumers — the CLI is the load-bearing one, because it is the
surface every consumer has regardless of stack:

| Consumer      | How                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **any stack** | `vitops legal [--doc <name>] [--format md\|html\|portable-text] [--out <dir>]` — stdout without `--out`. Hugo, Eleventy, a hand-built WP theme need no integration code.                                                                                            |
| **WordPress** | `generate({ site })` also emits `dist/legal/*.html`; `bricks/load.php` registers `[vitops_legal doc="privacy"]`, whose `doc` is matched against a fixed allowlist (it lands in a filesystem read). `legal.test.ts` drift-guards that allowlist against `DOC_SLUGS`. |
| **Astro**     | `vitops({ legal: { input, out } })` — a sibling of `css`, not a widening of it. Runs inside `@getvitops/vite`'s `run()` so it regenerates on config change; writes markdown to a content collection. No route injection (nothing in the repo does that).            |
| **EmDash**    | `--format portable-text`, pasted into the admin. The scaffolded seed keeps its short, obviously-unfinished placeholders on purpose — a full generated policy for a fictional business is likelier to ship unread.                                                   |

Every document opens with a non-optional review banner. These are rendered from a template by
a build tool; the one failure mode with real consequences is a consumer publishing one as-is.
