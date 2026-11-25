# Ad-platform linking

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`vitops ads` (`packages/cli` → `@getvitops/utils/ads`) is the ad-side counterpart to `search`, over a
**`Config`**'s `site.ads` block — a record keyed by platform (`google` `meta` `linkedin` `reddit`
`tiktok` `microsoft` `pinterest` `snapchat`), each entry naming the account, the tag id and, where
the platform verifies one, the domain-verification token. Three subcommands: `setup` ensures the
verification DNS record, `tags` prints the consent-gated pixel snippets, `lint` reports the gaps
nothing else can see.

**`site.ads` exists because a pixel pasted into a template is invisible to the toolchain.** Before
it, `site.tracking` captured click IDs and `site.analytics` drove the cookie notice, but the ad
property itself was recorded nowhere — so a Meta pixel could set `_fbp` on a site whose generated
notice never mentioned it, whose consent gate never cleared it on revoke, and whose attribution
never captured LinkedIn's or Pinterest's click ID at all (`li_fat_id` and `epik` were both missing
from `PLATFORM_PARAMS`, which meant every conversion from either platform arrived unattributed —
indistinguishable from organic).

**Start from what the platforms actually accept.** Only four verify a domain, all by apex DNS TXT
(Meta, TikTok, Pinterest, Snapchat); that record is the one thing created for you. Google Ads,
LinkedIn, Reddit and Microsoft Ads have **no domain verification at all** — there, linking is the
tag and the account id. Those resolve to a `skip` **carrying the reason**, never a silent omission,
because a bare skip reads as "already done".

Five things are load-bearing:

- **No platform Marketing API is called.** Meta's Business Management `verify_domain` needs a
  system-user token and Google's Ads API needs an approved developer token with the consumer's own
  account on the line — the same reasoning that keeps the Google Indexing API unwired. The final
  "Verify" click is a reminder in the summary. Don't add it.
- **The pure/executor split is onboarding's, and `ads` reuses its DNS verbs outright.**
  `ads/plan.ts` decides everything and touches nothing; `onboarding/cloudflare.ts` executes. There
  is deliberately no second DNS module: it has no update and no delete verb, and one copy is one
  place for "never removes a record" to stay true.
- **A missing config value is `blocked`, with the field name in `needs` — not an error and not a
  skip.** That is what lets the CLI _ask_: a first run has no verification token, because the token
  does not exist until someone opens the platform UI. `prompt.ts` asks, the answer is folded into
  the setup and **the planner runs again**, so what executes is always a plan the pure planner
  produced. Asking requires a TTY and the absence of `--dry`/`--check`/`--no-prompt`; a CI run gets
  the named field instead and never hangs. A blocked step counts as drift and exits non-zero.
- **The token is written back to the config; a credential never is.** It is published in DNS — the
  platform fetching it back is the ownership proof — exactly like the IndexNow key, and persisting
  it is what makes the re-run a no-op. The write merges into the **raw on-disk object** and rewrites
  the surrounding file whole, following `@getvitops/vite`'s `designSystemPath()` rule, so a config
  using `extends` or a shorthand shape isn't normalised into a copy nothing builds from.
- **`AD_PLATFORMS` is the single source, and it feeds three surfaces that must agree.** The cookie
  list reaches `data-consent-cookies` (what a revoke clears) _and_ the generated cookie notice via
  `adProcessors()` in `legal/providers.ts`; the click-ID list is checked against `PLATFORM_PARAMS`;
  the tag is emitted inert (`type="text/plain"` + `data-src`, never a live `src`). `AD_PROVIDERS`
  lives in `@getvitops/config/providers` as bare literals (a `z.enum` needs literals to reach the
  published JSON Schema), and `ads-config.test.ts` asserts it matches the capability table.

Credentials follow the same env-var pattern as everything else: `CLOUDFLARE_API_TOKEN` for the DNS
write, and nothing else — no platform API is called, so no ad-platform credential exists to leak.

**`<Ads />` is a sibling of `<Analytics />`, not part of it.** Both render the same inert markup —
and that markup now has exactly one implementation, `<GatedTags />`, over the shared `GatedTag`
shape. What differs is everything else, which is why the resolvers are separate: analytics providers
are integration options while ad properties are `site.ads`; `resolveAnalytics` **derives** a
category from whether the provider sets cookies while an ad property **states** one (`marketing`
unless it says otherwise); `ResolvedTag['key']` is the four analytics providers and is paired
against the generator's processor table, so widening it to eight platforms would make that check
answer for tags it doesn't govern; and the environment switch is its own — `environments.<env>.ads`,
cascading to `analytics` then true, because a preview deployment sending pageviews is survivable and
one firing conversion pixels is not. The integration resolves ads **before** choosing offered consent
categories, since a pixel is a `marketing` demand and the banner must already have a row for it.
