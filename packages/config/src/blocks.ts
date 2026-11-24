import * as z from '@zod/mini';
import { desc } from './desc.ts';
import { AD_PROVIDERS } from './providers.ts';

/** `site.notifications` */
export const NotificationsSchema = z.optional(
  z.strictObject({
    email: desc(
      z.optional(
        z.union([
          z.email(),
          z.strictObject({
            provider: desc(
              z.literal('cloudflare'),
              'Delivery provider. Only Cloudflare Email Sending is implemented; the field is stated so adding another is additive.',
            ),
            to: desc(
              z.optional(z.email()),
              'Recipient. Defaults to the primary location’s `email`, then the first location that has one.',
            ),
            from: desc(
              z.optional(z.email()),
              'Sender. Defaults to `noreply@<domains.canonical>`. Its domain must be onboarded (`wrangler email sending enable <domain>`) or every send fails.',
            ),
            fromName: desc(
              z.optional(z.string()),
              'Display name on the From header. Defaults to `organization.name`.',
            ),
            replyTo: desc(z.optional(z.email()), 'Reply-To header.'),
            binding: desc(
              z.optional(z.string()),
              'Workers `send_email` binding name (default `EMAIL`). Set it when using a restricted binding.',
            ),
            verifySender: desc(
              z.optional(z.boolean()),
              "Set false to skip `vitops email check`'s deploy-time onboarding warning for this site — for a `from` domain the scan cannot see is correct (e.g. built dynamically), which would otherwise be a false positive.",
            ),
          }),
        ]),
      ),
      'Where conversion notifications are e-mailed. A bare address is shorthand for `{ provider: "cloudflare", to }`.',
    ),
    actionUrl: desc(
      z.optional(z.string()),
      'Optional action-link template added to the conversion email (e.g. a link into your ' +
        'ad platform or your own CRM/portal). `{clickId}` is replaced with the ad click ID ' +
        'captured on `_ac` (gclid, fbclid, …). Omitted from the email when the event carries ' +
        'no click ID to interpolate, rather than rendering a broken link.',
    ),
  }),
);

/** `site.tracking` */
export const TrackingSchema = z.optional(
  z.strictObject({
    enabled: desc(
      z.optional(z.boolean()),
      'Capture ad click IDs and UTMs from the landing URL into the `_ac` cookie, for attributing conversions.',
    ),
    category: desc(
      z.optional(z.enum(['marketing', 'analytics'])),
      'Consent category the `_ac` cookie waits on (default `marketing`). It is a 90-day identifier tying a visitor to the ad that brought them, so it is only written once this category is granted — and asking for it is what raises the banner.',
    ),
    platforms: desc(
      z.optional(z.array(z.string())),
      'Informational list of ad platforms in use. Capture recognises every known click-ID parameter regardless.',
    ),
    phoneNumbers: desc(
      z.optional(
        z.strictObject({
          number: desc(
            z.string(),
            'The real phone number exactly as the site displays it. Server-rendered HTML always carries this one, so crawlers, structured data and visitors without JavaScript see it.',
          ),
          sources: desc(
            z.partialRecord(z.enum([...AD_PROVIDERS, 'default-paid']), z.string()),
            'Tracking numbers keyed by ad platform (the `site.ads` provider names), each provisioned with a call-tracking provider and forwarding to `number`. `default-paid` is the fallback for a paid visit from a platform with no number of its own. Google needs no entry when `site.ads.google.callTracking` is set — Google supplies its own.',
          ),
          provider: desc(
            z.optional(z.string()),
            'The call-tracking provider (e.g. `twilio`, `callrail`). Informational, but it records callers’ numbers, so it must be named in the privacy policy — declare it in `site.legal.privacyPolicy.processors` unless it is a known one.',
          ),
        }),
      ),
      'Show a visitor from an ad the tracking number for that platform instead of the real one. Swapped in by the capture script from the landing URL (immediately) or the `_ac` cookie (later pages, once `marketing` is granted); the matching `tel:` links are rewritten too. An organic visitor is never swapped. Needs `enabled: true`.',
    ),
  }),
);

/** `site.security` */
export const SecuritySchema = z.optional(
  z.strictObject({
    turnstile: z.optional(
      z.strictObject({
        siteKey: desc(z.optional(z.string()), 'Cloudflare Turnstile site key (public).'),
      }),
    ),
  }),
);

/** `site.deployment` */
export const DeploymentSchema = z.optional(
  z.strictObject({
    platform: z.optional(z.string()),
    buildCommand: z.optional(z.string()),
    deployCommand: z.optional(z.string()),
    outputDirectory: z.optional(z.string()),
    type: z.optional(z.string()),
    repo: desc(
      z.optional(z.string()),
      "`owner/name` of this site's GitHub repository. Read by the EmDash design-system-editor plugin route to auto-commit a client's admin edit back to `branch` — see AGENTS.md's \"EmDash plugin as the design-system editing surface\" section. Absent means that sync is skipped (the live override still applies); nothing else in this toolchain reads it today.",
    ),
    branch: desc(
      z.optional(z.string()),
      'Branch the design-system-editor sync commits to. Default `"dev"` — never `main`/production directly; a commit here still needs this repo\'s own `promote` PR + admin approval to reach production, the same gate every other change goes through.',
    ),
  }),
);

export type NotificationsConfig = NonNullable<z.infer<typeof NotificationsSchema>>;
export type TrackingConfig = NonNullable<z.infer<typeof TrackingSchema>>;
export type SecurityConfig = NonNullable<z.infer<typeof SecuritySchema>>;
export type DeploymentConfig = NonNullable<z.infer<typeof DeploymentSchema>>;
