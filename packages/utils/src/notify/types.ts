/**
 * The notification module's option surface.
 *
 * Structural rather than imported from `@getvitops/generator` for the usual
 * reason — the generator depends on this package — so this mirrors the
 * `site.notifications` block field for field and the Astro side adapts.
 */

/**
 * A rendered message, channel-neutral.
 *
 * Every channel receives the same `ConversionEvent` and renders it its own way;
 * this is what an email channel produces. `text` is not optional: some clients
 * show only plain text, and HTML-only mail scores worse for spam.
 */
export interface RenderedMessage {
  subject: string;
  text: string;
  html: string;
}

/**
 * Cloudflare Email Sending — the only provider implemented this pass.
 *
 * A `z.literal` on the schema side rather than an enum with one member, so
 * widening it later is additive.
 */
export interface EmailChannelConfig {
  provider: 'cloudflare';
  /** Falls back to the location cascade — see `resolveRecipient`. */
  to?: string | undefined;
  /** Falls back to `noreply@<canonical>`. */
  from?: string | undefined;
  /** Display name on the From header. Defaults to the organization name. */
  fromName?: string | undefined;
  replyTo?: string | undefined;
  /**
   * Workers binding name (default `EMAIL`). Configurable because a consumer may
   * use a restricted binding with `allowed_sender_addresses`.
   */
  binding?: string | undefined;
}

export interface NotificationsConfig {
  /** A bare address is shorthand for `{ provider: 'cloudflare', to }`. */
  email?: string | EmailChannelConfig | undefined;
  // TODO: `sms` and `persist` channels. Adding one should be a new sender file
  // and a schema variant — `planNotifications` gains a branch, `ConversionEvent`
  // and the recipient cascade do not change.
}

/** Everything `planNotifications` needs. Assembled by the caller from the config. */
export interface NotifyContext {
  notifications?: NotificationsConfig | undefined;
  /** `domains.canonical`, for the default From address. */
  canonical?: string | undefined;
  /** `organization.name`, for the From display name and the subject line. */
  organizationName?: string | undefined;
  /**
   * Location e-mails in preference order — the fallback when no explicit
   * recipient is configured. The caller orders these (primary first).
   */
  locationEmails?: string[] | undefined;
}

/** A channel's decision: on, or off with a stated reason. Mirrors `ChannelPlan`. */
export interface ChannelPlan {
  enabled: boolean;
  /** Why it's off. Present iff `enabled` is false. */
  skip?: string;
}

export interface EmailPlan extends ChannelPlan {
  provider: 'cloudflare';
  to?: string | undefined;
  from?: string | undefined;
  fromName?: string | undefined;
  replyTo?: string | undefined;
  binding: string;
}

export interface NotificationPlan {
  email: EmailPlan;
  /** True when no channel is enabled — the caller can say so rather than guess. */
  empty: boolean;
}

/** What one channel's dispatch produced. */
export interface ChannelResult {
  channel: 'email';
  sent: boolean;
  /** Why not, or what went wrong. Present iff `sent` is false. */
  reason?: string;
  /** The provider's own error code, when it gave one (e.g. `E_SENDER_NOT_VERIFIED`). */
  code?: string;
}

/**
 * The Workers `send_email` binding, narrowed to what this module uses.
 *
 * Declared structurally so `@getvitops/utils` never imports `cloudflare:workers`
 * and gains no Cloudflare dependency — the consumer's route passes `env.EMAIL` in.
 * Consumers with `wrangler types` generated will find their real binding
 * assignable to this.
 */
export interface EmailBinding {
  send(message: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }): Promise<unknown>;
}
