---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/astro': minor
---

Link a site to its ad properties: `site.ads`, `vitops ads`, and `<Ads />`.

`vitops search` covers the whole Search Console relationship. Nothing covered the equivalent one
with ad platforms, and a site's ad accounts had nowhere to live — so a Meta pixel pasted into a
template was invisible to the rest of the toolchain. It set `_fbp` on a site whose generated cookie
notice never mentioned it, whose consent gate never cleared it on revoke, and — for LinkedIn and
Pinterest — whose attribution never captured the click ID at all, so every conversion from those
platforms arrived indistinguishable from organic traffic.

**New `site.ads` block**, keyed by platform (`google`, `meta`, `linkedin`, `reddit`, `tiktok`,
`microsoft`, `pinterest`, `snapchat`):

```jsonc
{
  "site": {
    "ads": {
      "meta": { "pixelId": "123456789", "domainVerification": "abc123" },
      "google": {
        "accountId": "123-456-7890",
        "pixelId": "AW-987654321",
        "conversionLabel": "xyz",
      },
    },
  },
}
```

**`vitops ads setup`** ensures each platform's domain-verification DNS record. Only four platforms
verify a domain at all — Meta, TikTok, Pinterest and Snapchat, by apex DNS TXT — and that record is
the one thing created for you (in Cloudflare, via `CLOUDFLARE_API_TOKEN`; created only, never edited
or deleted). Google Ads, LinkedIn, Reddit and Microsoft Ads have no domain verification: linking
there is the tag and the account id, and the run says so rather than skipping in silence. No
platform Marketing API is called — Meta's needs a system-user token and Google's an approved
developer token with your own account on the line — so the final "Verify" click is surfaced as a
reminder. `--dry` prints the plan, `--check` reports drift and exits non-zero.

**It asks for what the config is missing.** A verification token does not exist until someone
fetches it from the platform UI, so a first run prompts for it, naming the exact UI path, folds the
answer into the plan and writes it to your config. The token is not a secret — it is published in
DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key.
Prompting requires a TTY: with `--dry`, `--check`, `--no-prompt`, or in CI, you get a named error
instead and the run never hangs. `--no-write` keeps the answer out of the config.

**`vitops ads tags`** prints each pixel as an inert, consent-gated `<script>` — `type="text/plain"`
with the library URL on `data-src`, so an undecided visitor's page issues no third-party request.
For Bricks, WordPress, Eleventy: any stack without the Astro integration.

**`vitops ads lint`** reports the gaps that are invisible at runtime: a click ID the platform stamps
that attribution does not capture, a pixel while `site.tracking` is off, a property with no tag id.

**`<Ads />` in `@getvitops/astro`**, a sibling of `<Analytics />` rather than part of it — ad
properties come from the site config, state their own consent category (`marketing` by default,
rather than being derived), and switch per environment on their own
(`environments.<env>.ads`, defaulting to `analytics`, then true, so a preview deployment can send
pageviews without firing conversion pixels). Both components now render through one `<GatedTags />`,
so the inert markup has a single implementation.

**Your cookie notice now discloses every configured pixel** — name, cookies and opt-out — from the
same table that writes `data-consent-cookies`, so the notice and the revoke cannot disagree. If you
add `site.ads` to a config whose privacy policy or cookie notice you have already published,
re-generate and re-read them.

`li_fat_id` (LinkedIn) and `epik` (Pinterest) join the click-ID capture vocabulary; a site running
either platform starts attributing conversions it previously recorded as organic.
