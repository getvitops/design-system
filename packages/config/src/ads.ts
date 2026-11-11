import * as z from '@zod/mini';
import { desc } from './desc.ts';
import { AD_PROVIDERS } from './providers.ts';

export const AdProviderSchema = z.enum(AD_PROVIDERS);

/**
 * One ad property this site is linked to.
 *
 * Facts, not prose — the same rule the legal block follows. This records *which*
 * account and *which* tag id, and the platform capability table decides what can be
 * done about them. It is also what finally lets the rest of the toolchain see an ad
 * pixel: the generated cookie notice discloses its cookies, `vitops ads lint`
 * checks its click ID is captured, and the consent gate is handed the cookie names
 * to clear on revoke. A pixel pasted into a template is invisible to all three.
 */
export const AdPropertySchema = z.strictObject({
  accountId: desc(
    z.optional(z.string()),
    'The advertising account as the platform shows it — Google Ads customer ID, Meta ad account, LinkedIn partner ID, Reddit advertiser ID. For LinkedIn this is also the Insight Tag id; everywhere else the tag id is `pixelId`.',
  ),
  pixelId: desc(
    z.optional(z.string()),
    'The tag/pixel ID the browser snippet initialises — Meta pixel, TikTok pixel, Reddit pixel, Microsoft UET tag ID, Pinterest tag ID, Snap pixel, or the Google Ads conversion ID (`AW-…`, which is NOT the customer ID).',
  ),
  conversionLabel: desc(
    z.optional(
      z.union([
        z.string(),
        z.strictObject({
          call: desc(
            z.optional(z.string()),
            'Fired on a tel: link click. Create the action in Google Ads with category "Phone call lead".',
          ),
          email: desc(
            z.optional(z.string()),
            'Fired on a mailto: link click. Create the action in Google Ads with category "Contact".',
          ),
          form: desc(
            z.optional(z.string()),
            'Fired client-side by `vitopsFormConversion()` — the consumer\'s own submit handler calls it once a form POST succeeds. Create the action in Google Ads with category "Submit lead form". Don\'t fire it from a success-page query parameter: that replays on refresh and the honeypot returns the same success page.',
          ),
        }),
      ]),
    ),
    'Google Ads only: the conversion action label(s) paired with the `AW-…` conversion ID — ' +
      "the category (Phone call lead, Contact, …) is a property of the action in Google Ads, not of the tag call, so a wrong category can't be fixed from code; " +
      'either one bare label (back-compat, treated as the `call` action) or a map of ' +
      'action → label, so a call, an email click and a form submission each fire their own ' +
      'Google Ads conversion action instead of all three reporting as the same one.',
  ),
  conversionActionId: desc(
    z.optional(
      z.union([
        z.string(),
        z.strictObject({
          call: desc(z.optional(z.string()), 'Fired on a tel: link click.'),
          email: desc(z.optional(z.string()), 'Fired on a mailto: link click.'),
          form: desc(z.optional(z.string()), 'Fired on a form submission.'),
        }),
      ]),
    ),
    'Google Ads only: the conversion action **resource id(s)** (a numeric id, or a full ' +
      '`customers/…/conversionActions/…` resource name) used for server-side offline ' +
      'conversion upload — NOT the same value as `conversionLabel`, which is the opaque ' +
      "label the web tag uses and which the Ads API's upload endpoint does not accept. " +
      'Only meaningful when `reporting: "server"`.',
  ),
  callTracking: desc(
    z.optional(
      z.strictObject({
        label: desc(
          z.string(),
          'The conversion action label of a **separate** Google Ads action of type "Calls from a phone number on your website" (not the `conversionLabel.call` action, which counts `tel:` taps). Paired with `pixelId` as `AW-…/<label>`.',
        ),
        number: desc(
          z.string(),
          'The phone number exactly as the site displays it, e.g. `613-555-0100`. Google swaps its forwarding number in only where the page text matches these digits, so a differently formatted number on the page is silently never replaced.',
        ),
        cache: desc(
          z.optional(z.boolean()),
          'Set false to stop Google caching the fetched forwarding number in a cookie (`phone_conversion_options.cache`). Default true, so the number follows the visitor across pages.',
        ),
      }),
    ),
    'Google Ads only: **website call conversions**. The Google tag fetches a Google forwarding number for visitors who arrived from a Google ad and swaps it in for `number`, so a phone call (not just a `tel:` tap) is attributed to the click. Google decides who sees it; this toolchain also rewrites the matching `tel:` links, which Google does not. Counts the same call as `conversionLabel.call` if both are primary — make one secondary in Google Ads. Any other platform has no equivalent: see `site.tracking.phoneNumbers`.',
  ),
  reporting: desc(
    z.optional(z.enum(['client', 'server'])),
    'Google Ads only: `"client"` (default) fires the conversion via `gtag.js` in the ' +
      'browser at click/submit time; `"server"` uploads it via the Ads API from the ' +
      'conversion endpoint instead (see `conversionActionId`). An action with no matching ' +
      '`conversionActionId` keeps firing client-side regardless of this setting, so setting ' +
      'it before `conversionActionId` is filled in never silently drops a conversion.',
  ),
  domain: desc(
    z.optional(z.string()),
    'Bare hostname to verify with this platform. Defaults to the host of `domains.canonical` — set it only when the ad account is verified against a different domain.',
  ),
  domainVerification: desc(
    z.optional(z.string()),
    'The verification token from the platform UI, for the platforms that verify by DNS TXT (Meta, TikTok, Pinterest, Snapchat). `vitops ads setup` prompts for it and writes it here on first run. NOT a secret — it is published in DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key. A value containing `=` is used as the whole record, which is the escape hatch if a platform changes its prefix.',
  ),
  category: desc(
    z.optional(z.enum(['marketing', 'analytics'])),
    'Consent category the tag waits on (default `marketing`). An ad pixel is advertising by default; `analytics` is for a site using one purely for its own measurement.',
  ),
  enabled: desc(
    z.optional(z.boolean()),
    'Set false to keep the property on record without emitting its tag.',
  ),
});

export type AdPropertyConfig = z.infer<typeof AdPropertySchema>;
