/**
 * The email-onboarding module's own option surface.
 *
 * Structural rather than imported from `@getvitops/generator` for the usual
 * reason — the generator already depends on this package — and rather than
 * imported from `../notify/types.ts`, which describes what a *notification*
 * channel sends, not what a *sending domain* needs onboarded. The two share a
 * concept (a `from` address) but not a config shape.
 *
 * `EmailProvider` is open to more than `'cloudflare'` on purpose, unlike
 * `EmailChannelConfig['provider']` in `notify/types.ts` (a closed `z.literal`
 * there, since nothing else is implemented for *sending mail*). Checking
 * whether a domain is *onboarded* is a narrower problem a second provider can
 * answer without the notify channel itself changing shape.
 */

/** Providers this module knows how to check onboarding for. Only `cloudflare` is implemented. */
export type EmailProvider = 'cloudflare' | 'ses' | 'sendgrid';

/** A `from` address worth checking, and where it came from. */
export interface FromCandidate {
  address: string;
  domain: string;
  /**
   * `config` — `site.notifications.email.from` stated explicitly.
   * `derived` — `resolveSender`'s `noreply@<canonical>` default.
   * `scan` — found in source by the static scanner (see `scan.ts`).
   */
  source: 'config' | 'derived' | 'scan';
}

/** One sending domain/subdomain's live state, as Cloudflare reports it. */
export interface SendingDomainState {
  name: string;
  enabled: boolean;
  tag: string;
  dkimSelector?: string | undefined;
  returnPathDomain?: string | undefined;
}

/** One DNS record Cloudflare expects for a sending domain, from `sendingDns`. */
export interface ExpectedRecord {
  type: 'MX' | 'TXT';
  name: string;
  content: string;
  priority?: number | undefined;
}

/** Everything `planSendingDomains` needs, once the CLI has read the config + scan. */
export interface EmailConfig {
  candidates: FromCandidate[];
  provider: EmailProvider;
}

/**
 * Live state for one zone, gathered by the executor before planning.
 *
 * `subdomains` is every sending name Cloudflare reports **in the domain's own
 * zone** (there is no cross-zone lookup) — the planner needs the whole list,
 * not just an exact-name match, so it can name a sibling that IS onboarded
 * when the exact domain is not (the `send.<zone>` case).
 */
export interface ZoneSendingState {
  zoneId?: string | undefined;
  subdomains: SendingDomainState[];
}
