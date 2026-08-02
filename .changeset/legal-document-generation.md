---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/cli': minor
'@getvitops/vite': minor
---

Generate legal documents from your site config

`vitops legal` renders a privacy policy, terms of service and cookie notice from a site
config, in markdown, HTML or EmDash Portable Text:

```sh
vitops legal --out ./content                 # every enabled document, as markdown
vitops legal --doc privacy --format html     # one document, as an HTML fragment
```

The documents are **derived from your config**, not filled into a form. The analytics
provider they name is the one whose ID you set; the personal information they list is what
your configured forms actually collect; the countries they name come from the providers you
use. So a provider swap updates the policy on the next build, and the fix for a wrong policy
is a corrected config — hand-editing the output is overwritten.

Enable documents under `legal`, which gains the facts the prose asserts:

```jsonc
{
  "legal": {
    "jurisdiction": "ca", // only 'ca' (PIPEDA) ships today
    "privacyPolicy": {
      "enabled": true,
      "lastUpdated": "2026-08-01",
      "retention": "24 months after our last contact with you",
      // Third parties the config cannot imply. Analytics, Turnstile and your
      // deploy platform are detected automatically — list only the rest.
      "processors": [
        { "name": "Stripe", "purpose": "payment processing", "country": "the United States" },
      ],
    },
    "termsOfService": { "enabled": true },
    "cookieConsent": {
      "enabled": true,
      "type": "opt-in",
      "categories": ["Essential", "Analytics"],
    },
  },
}
```

Delivery, by stack:

- **Any stack** — `vitops legal`. No integration code; prints to stdout without `--out`.
- **WordPress/Bricks** — `vitops generate --site <path>` also writes `dist/legal/*.html`, and
  the theme loader now registers `[vitops_legal doc="privacy"]` to render one in a page. The
  document updates on the next deploy with no action in WordPress.
- **Astro** — `getvitops({ legal: { input: 'site.json', out: 'src/content/legal' } })` writes
  markdown into a content collection and re-renders when the site config changes. It needs a
  `css` config (that is what registers the Vite plugin); without one, use the CLI.
- **EmDash** — `--format portable-text`, pasted into the admin.

Also new on the public API: `generateLegal()`, `renderMarkdown()`, `renderNodes()`,
`derivePolicyVars()`, `parseMarkdown()` / `toHtmlFragment()` / `toPortableText()`, and
`resolvePrivacyContact()`.

Two things to know before you publish anything this produces:

- **It is not legal advice.** Every document opens with a review banner saying so. The
  bundled terms-of-service prose in particular is generic website boilerplate and
  deliberately does not cover sales, refunds, subscriptions, accounts or user-generated
  content — a site doing any of those needs clauses drafted for it.
- **It is only as true as your config.** A policy asserting things your site does not do is
  worse than no policy. Check that the config describes reality before you ship the output.

`validateSite` now rejects a config that enables a privacy policy without a contact for
privacy requests or a `domains.canonical`, since both are interpolated into sentences that
would otherwise render blank.
