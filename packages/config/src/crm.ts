import * as z from '@zod/mini';
import { desc } from './desc.ts';
import { BIGIN_DATA_CENTERS, CRM_PROVIDERS } from './providers.ts';

export const CrmProviderSchema = z.enum(CRM_PROVIDERS);

export const HubSpotConfigSchema = z.strictObject({
  portalId: desc(z.string(), 'The HubSpot portal (hub) ID the form belongs to.'),
  formGuid: desc(z.string(), 'The HubSpot form GUID to submit against.'),
  dataCenter: desc(
    z.optional(z.enum(['na', 'eu'])),
    'Which regional submissions API to post to (default `na`).',
  ),
});

export const BiginPipelineConfigSchema = z.strictObject({
  enabled: desc(z.boolean(), 'Also open a Pipelines record for the new/updated contact.'),
  subPipeline: desc(z.optional(z.string()), 'Sub-pipeline to file the record under.'),
  stage: desc(z.optional(z.string()), 'Starting stage for the pipeline record.'),
});

export const BiginConfigSchema = z.strictObject({
  dataCenter: desc(
    z.enum(BIGIN_DATA_CENTERS),
    "The self-client's data centre — determines both the OAuth accounts host and the API host (`www.zohoapis.<dc>`).",
  ),
  duplicateCheckField: desc(
    z.optional(z.string()),
    "Bigin field the upsert dedupes on (default `Email`, Bigin's own unique field).",
  ),
  pipeline: desc(
    z.optional(BiginPipelineConfigSchema),
    'Also open a Pipelines record alongside the Contact.',
  ),
});

export const JobberNoteConfigSchema = z.strictObject({
  enabled: desc(
    z.optional(z.boolean()),
    'Attach a best-effort note carrying the message and unmapped attribution (default true). A failure here never loses the client record itself.',
  ),
});

export const JobberConfigSchema = z.strictObject({
  apiVersion: desc(
    z.optional(z.string()),
    "Override the pinned `X-JOBBER-GRAPHQL-VERSION` date this integration is tested against. An escape hatch for an app pinned to a different version — Jobber's schema can change field names between versions.",
  ),
  dedupe: desc(
    z.optional(z.boolean()),
    "Look up an existing client by email before creating one (default false pending verification of Jobber's search API against a live schema — see AGENTS.md). Jobber's `clientCreate` has no upsert, so without this a resubmitting visitor creates a second client.",
  ),
  note: desc(
    z.optional(JobberNoteConfigSchema),
    'Attach a best-effort note carrying the submitted message and any attribution/extra fields with no dedicated Jobber field.',
  ),
});

/**
 * A client's CRM, wired to the same conversion route `site.notifications`
 * already reaches — see AGENTS.md's "CRM submissions" section for why this is
 * server-side-only and hung off `createConversionRoute()` rather than a
 * client-side embed. Credentials never live here — the toolchain has no
 * secret store, matching every other integration.
 */
export const CrmSchema = z.strictObject({
  provider: desc(CrmProviderSchema, 'Which CRM this site pushes form submissions into.'),
  enabled: desc(
    z.optional(z.boolean()),
    'Set false to keep the block on record without writing to the CRM.',
  ),
  hubspot: desc(z.optional(HubSpotConfigSchema), 'Required when `provider` is `hubspot`.'),
  bigin: desc(z.optional(BiginConfigSchema), 'Required when `provider` is `bigin`.'),
  jobber: desc(z.optional(JobberConfigSchema), 'Required when `provider` is `jobber`.'),
  fieldMap: desc(
    z.optional(z.record(z.string(), z.string())),
    'Submitted form field name → CRM property name. A field with no entry here is dropped, not guessed — an unmapped field never reaches the CRM.',
  ),
  trackingFields: desc(
    z.optional(z.record(z.string(), z.string())),
    '`_ac` attribution key (a click-ID param, a UTM param, `landingPage`, `referrer`, or `ab_variant`) → CRM property name. Same drop-if-unmapped rule as `fieldMap`; a visitor with no `_ac` cookie maps to no attribution fields at all, never an error.',
  ),
});

export type CrmConfig = z.infer<typeof CrmSchema>;
export type HubSpotConfig = z.infer<typeof HubSpotConfigSchema>;
export type BiginConfig = z.infer<typeof BiginConfigSchema>;
export type BiginPipelineConfig = z.infer<typeof BiginPipelineConfigSchema>;
export type JobberConfig = z.infer<typeof JobberConfigSchema>;
