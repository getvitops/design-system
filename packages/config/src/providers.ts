/**
 * Closed provider lists, as bare literals. No zod import — see vite.config.ts for why this is its own entry.
 */

/**
 * The ad platforms `vitops ads` can link a site to.
 *
 * A closed enum, mirroring `AD_PROVIDER_KEYS` in `@getvitops/utils/ads` — that
 * module owns what each platform *can do* (whether it verifies a domain, what its
 * tag is, which click ID it stamps), this owns what a config may *say*. Mirrored
 * rather than derived because a `z.enum` needs literals to reach the published JSON
 * Schema; `config.test.ts` asserts the two lists are the same set, so a provider
 * added to one and not the other fails the build rather than silently getting no
 * verification step and no tag.
 */
export const AD_PROVIDERS = [
  'google',
  'meta',
  'linkedin',
  'reddit',
  'tiktok',
  'microsoft',
  'pinterest',
  'snapchat',
] as const;

export type AdProvider = (typeof AD_PROVIDERS)[number];

/**
 * The CRMs this toolchain can push a form submission into.
 *
 * A closed enum, mirroring `CrmProvider` in `@getvitops/utils/crm` — that module
 * owns what each provider's API needs, this owns what a config may say.
 * Mirrored rather than derived for the same reason `AD_PROVIDERS` is: a
 * `z.enum` needs literals to reach the published JSON Schema.
 */
export const CRM_PROVIDERS = ['hubspot', 'bigin', 'jobber'] as const;

export type CrmProviderConfig = (typeof CRM_PROVIDERS)[number];

export const BIGIN_DATA_CENTERS = ['com', 'ca', 'eu', 'in', 'com.au', 'jp'] as const;
