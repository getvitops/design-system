/**
 * Every decision about *whether* a submission subscribes anyone, as one pure function.
 *
 * The gate is the visitor's explicit opt-in (`consentField`), never the `marketing` cookie
 * category: ticking the box is the consent, exactly as filling in a contact form is the
 * necessary processing for an enquiry. A dedicated signup form renders that field as a hidden
 * input, because pressing its own "Join the waitlist" button is the express request.
 */
import { identifySubmitter } from '../tracking/identity.ts';
import type { ConversionEvent } from '../tracking/types.ts';
import type {
  CampaignCredentials,
  CampaignPlan,
  CampaignProvider,
  CampaignsConfig,
} from './types.ts';

/** What each provider needs on every list, as one table rather than a hand-written `if` each. */
export const PROVIDER_REQUIREMENTS: Record<
  CampaignProvider,
  { listKey: 'zohoCampaigns' | 'sendfox'; credentialHint: string }
> = {
  'zoho-campaigns': {
    listKey: 'zohoCampaigns',
    credentialHint: 'No Zoho Campaigns OAuth credentials configured.',
  },
  sendfox: { listKey: 'sendfox', credentialHint: 'No SendFox access token configured.' },
};

const DECLINED = new Set(['', '0', 'false', 'off', 'no', 'n']);

/** A ticked box submits its `value` (default `on`); an unticked one submits nothing. */
export function isOptedIn(value: string | undefined): boolean {
  return value !== undefined && !DECLINED.has(value.trim().toLowerCase());
}

/** The form joins several values under one name with ", ", so split on commas and spaces alike. */
function namedKeys(value: string | undefined): string[] {
  return (value ?? '').split(/[,\s]+/).filter(Boolean);
}

export function planCampaigns(
  event: ConversionEvent,
  config: CampaignsConfig | undefined,
  credentials: CampaignCredentials | undefined,
): CampaignPlan {
  const off = (skip: string, provider?: CampaignProvider): CampaignPlan => ({
    enabled: false,
    provider,
    lists: [],
    unknown: [],
    skip,
  });

  if (!config) return off('No `campaigns` configured.');
  if (config.enabled === false) return off('`campaigns.enabled` is false.', config.provider);

  const requirement = PROVIDER_REQUIREMENTS[config.provider];
  if (config.provider === 'zoho-campaigns' && !config.zohoCampaigns)
    return off(
      '`campaigns.provider` is "zoho-campaigns" but `campaigns.zohoCampaigns` is missing.',
      config.provider,
    );

  const formData = event.formData;
  if (event.type !== 'form' || !formData) return off('Not a form submission.', config.provider);

  const consentField = config.consentField ?? 'subscribe';
  if (!isOptedIn(formData[consentField]))
    return off(`No opt-in: \`${consentField}\` was not ticked.`, config.provider);

  if (!identifySubmitter(formData).email && !event.email)
    return off('No email address to subscribe.', config.provider);

  const configured = Object.keys(config.lists);
  const named = namedKeys(formData[config.listField ?? 'list']);
  // No list named is only unambiguous when exactly one exists.
  const keys = named.length > 0 ? named : configured.length === 1 ? configured : [];
  if (keys.length === 0)
    return off(
      `No list named: \`${config.listField ?? 'list'}\` is empty and ${configured.length} lists are configured.`,
      config.provider,
    );

  const unknown = keys.filter((k) => !Object.hasOwn(config.lists, k));
  const lists = keys
    .filter((k) => Object.hasOwn(config.lists, k))
    .map((key) => ({ key, label: config.lists[key]!.label, config: config.lists[key]! }));
  if (lists.length === 0)
    return {
      ...off(`Unknown list: ${unknown.join(', ')}.`, config.provider),
      unknown,
    };

  if (!credentials) return { ...off(requirement.credentialHint, config.provider), lists, unknown };
  if (credentials.provider !== config.provider)
    return {
      ...off(
        `\`campaigns.provider\` is "${config.provider}" but the supplied credentials are for "${credentials.provider}".`,
        config.provider,
      ),
      lists,
      unknown,
    };

  return { enabled: true, provider: config.provider, lists, unknown };
}
