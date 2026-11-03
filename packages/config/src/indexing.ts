import * as z from '@zod/mini';
import { desc } from './desc.ts';

/**
 * One domain to onboard into Google Search Console via `vitops search setup`.
 *
 * The verification token is fetched live from the Site Verification API at run
 * time and written to DNS — it is never stored here. What the config records is
 * the *intent*: which domains to onboard, and who should co-own them.
 */
export const SearchConsoleSetupSchema = z.strictObject({
  delegatedOwners: desc(
    z.optional(z.array(z.email())),
    'Emails added as verification owners on the Site Verification web resource. Automated via the API — additive and idempotent, never removes an existing owner.',
  ),
  fullUserGroup: desc(
    z.optional(z.email()),
    'A Google Group to grant Full-User access in Search Console. SURFACED AS A REMINDER only: Search Console exposes no user/permission API, so this step stays manual by design.',
  ),
});

/**
 * What `vitops search notify` needs to tell search engines a deploy happened.
 *
 * Scoped by what search engines actually accept, which is narrower than it looks:
 * Google exposes **no** "request indexing" API (the Search Console button is not in
 * its API, and URL Inspection is read-only), and it removed the sitemap ping
 * endpoint in 2023. So the sanctioned set is: an accurate sitemap, a Search Console
 * sitemap resubmit, an IndexNow ping — which Google does *not* honour but Bing,
 * Yandex, Naver, Seznam and Yep do — and a read-only inspection pass to find out
 * what Google actually did.
 *
 * Facts only, the same rule the legal block follows: this records what the site has
 * (a key, a property, which pages matter), never what to say about it.
 */
export const IndexNowSchema = z.strictObject({
  key: desc(
    z.string().check(z.regex(/^[a-zA-Z0-9-]{8,128}$/)),
    'IndexNow key (8–128 chars, hex is conventional). NOT a secret — it is served publicly at `keyLocation` so the engine can verify you own the host. Generate one with `vitops search notify --new-key`.',
  ),
  keyLocation: desc(
    z.optional(z.url()),
    'Absolute URL of the key file. Defaults to `<canonical>/<key>.txt`; set it only when the file lives elsewhere.',
  ),
  endpoint: desc(
    z.optional(z.url()),
    'IndexNow endpoint (default `https://api.indexnow.org/indexnow`). Any participating engine shares submissions with the rest, so one is normally enough.',
  ),
});

export const SearchConsoleSchema = z.strictObject({
  siteUrl: desc(
    z.string(),
    'The property exactly as Search Console identifies it — `sc-domain:acme.ca` for a domain property, or the URL-prefix form `https://acme.ca/`. A mismatch here is a 403, not a "not found".',
  ),
  resubmitSitemap: desc(
    z.optional(z.boolean()),
    'Re-submit the sitemap through the Search Console API on each notify (default true when `searchConsole` is set). This is the automated equivalent of the manual resubmit in the UI.',
  ),
});

export const IndexingSchema = z.strictObject({
  sitemapUrl: desc(
    z.optional(z.url()),
    'The sitemap to submit and to diff for changed URLs. Defaults to `<canonical>/sitemap-index.xml`.',
  ),
  indexNow: desc(
    z.optional(IndexNowSchema),
    'IndexNow submission (Bing, Yandex, Naver, Seznam, Yep — not Google). Omit to skip the channel.',
  ),
  searchConsole: desc(
    z.optional(SearchConsoleSchema),
    'Google Search Console property. Needs a credential at run time — either a service account in `VITOPS_GSC_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`, or the user OAuth credential `vitops search setup` uses (`VITOPS_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`). The service account wins when both are set. Never put a key in this file.',
  ),
  priorityUrls: desc(
    z.optional(z.array(z.url())),
    'The pages whose indexing actually matters. `vitops search notify --check` inspects these and exits non-zero if Google has not indexed one. Kept explicit because URL Inspection is quota-bound (2000/day), so checking every page is neither affordable nor informative.',
  ),
});

export type IndexNowConfig = z.infer<typeof IndexNowSchema>;
export type SearchConsoleConfig = z.infer<typeof SearchConsoleSchema>;
export type IndexingConfig = z.infer<typeof IndexingSchema>;
export type SearchConsoleSetupConfig = z.infer<typeof SearchConsoleSetupSchema>;
