/** A Turnstile widget as the list endpoint returns it. The list never carries the secret. */
export interface WidgetSummary {
  sitekey: string;
  name: string;
  domains: string[];
  mode: string;
}

/** What the config asks for. */
export interface TurnstileSetup {
  /** Widget display name (not unique in Cloudflare). */
  name: string;
  /** Hostnames to protect; the widget also covers their subdomains. */
  domains: string[];
  /** `site.security.turnstile.siteKey`, when already set. */
  siteKey?: string | undefined;
}

/** What the executor observed. */
export interface TurnstileState {
  /** Undefined when no account could be resolved. */
  accountId?: string | undefined;
  widgets: WidgetSummary[];
}
