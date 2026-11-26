import * as z from '@zod/mini';
import { desc } from './desc.ts';
import { CAMPAIGN_PROVIDERS, ZOHO_CAMPAIGNS_DATA_CENTERS } from './providers.ts';

export const CampaignProviderSchema = z.enum(CAMPAIGN_PROVIDERS);

export const ZohoCampaignsConfigSchema = z.strictObject({
  dataCenter: desc(
    z.enum(ZOHO_CAMPAIGNS_DATA_CENTERS),
    "The account's data centre — decides both the OAuth accounts host and the Campaigns API host (`campaigns.zoho.<dc>`).",
  ),
});

export const CampaignListSchema = z.strictObject({
  label: desc(
    z.string(),
    'Human name for the list ("Waitlist"). Shown in the notification email that records the opt-in.',
  ),
  zohoCampaigns: desc(
    z.optional(z.strictObject({ listKey: z.string() })),
    'Zoho Campaigns list key. Required when `provider` is `zoho-campaigns`.',
  ),
  sendfox: desc(
    z.optional(z.strictObject({ listId: z.number() })),
    'SendFox list id. Required when `provider` is `sendfox`.',
  ),
});

/**
 * Email-list signups. Independent of `site.crm`: a contact form wants a reply, a signup wants a
 * stream of messages, and the two carry different consent. This block owns the signup;
 * `site.crm` keeps owning the enquiry. Credentials never live here.
 */
export const CampaignsSchema = z.strictObject({
  provider: desc(CampaignProviderSchema, 'Which email-campaign tool holds the subscriber lists.'),
  enabled: desc(
    z.optional(z.boolean()),
    'Set false to keep the block on record without subscribing anyone.',
  ),
  lists: desc(
    z.record(z.string(), CampaignListSchema),
    'Subscribable lists, keyed by the name a form submits (`waitlist`, `blog`, `reports`).',
  ),
  zohoCampaigns: desc(
    z.optional(ZohoCampaignsConfigSchema),
    'Required when `provider` is `zoho-campaigns`.',
  ),
  consentField: desc(
    z.optional(z.string()),
    "Form field that carries the visitor's explicit opt-in (default `subscribe`). A signup is only attempted when it is ticked or submitted truthy; the tick is the consent record.",
  ),
  listField: desc(
    z.optional(z.string()),
    'Form field naming the list key(s) to join (default `list`). May hold several keys; omit it when exactly one list is configured.',
  ),
  mirrorToCrm: desc(
    z.optional(z.boolean()),
    'When `site.crm` is also configured, record the signup on the CRM contact as a fact ("Signed up: waitlist"), never as subscription state (default true). Turn off when the client already syncs the CRM to the campaign tool.',
  ),
});

export type CampaignsConfig = z.infer<typeof CampaignsSchema>;
export type CampaignListConfig = z.infer<typeof CampaignListSchema>;
export type ZohoCampaignsConfig = z.infer<typeof ZohoCampaignsConfigSchema>;
