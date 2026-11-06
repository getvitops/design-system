/**
 * Turning one submission into a provider-neutral `CrmRecord`.
 *
 * Pure, and separate from both executors for the reason `notify/render.ts` is
 * separate from `email.ts`: shaping the data is where the two subtle rules
 * that must not regress live, and pinning them here means a test can assert
 * them without a network.
 *
 * `fieldMap`/`trackingFields` are drop-if-unmapped, not guess-if-unmapped — an
 * unmapped field silently disappearing from the CRM record is the same shape
 * of decision `describeEvent()` makes for `OMIT_FIELDS`: an absent mapping is
 * a stated design choice (the operator hasn't decided this field matters to
 * the CRM yet), never an error.
 */
import { identifySubmitter } from '../tracking/identity.ts';
import type { ConversionEvent } from '../tracking/types.ts';
import type { CrmConfig, CrmRecord } from './types.ts';

/**
 * Bigin requires `Last_Name`; a form that only asked for a full name or an
 * email needs one derived rather than 400ing on insert.
 *
 * The fallback chain, in order: an explicit last name field → the last space-
 * separated token of a full name → the local part of the email address →
 * refuse, with a stated reason, rather than fabricate a name from nothing.
 * `map.ts` never emits an empty `lastName` for Bigin — `deliverToCrm` reads
 * the refusal and skips the write instead of letting the CRM reject it.
 */
export function deriveLastName(identity: {
  firstName?: string | undefined;
  lastName?: string | undefined;
  fullName: string;
  email?: string | undefined;
}): { lastName: string } | { refusal: string } {
  if (identity.lastName) return { lastName: identity.lastName };

  const nameParts = identity.fullName.trim().split(/\s+/);
  if (nameParts.length > 1) {
    return { lastName: nameParts[nameParts.length - 1]! };
  }

  if (identity.email) {
    const local = identity.email.split('@')[0];
    if (local) return { lastName: local };
  }

  return {
    refusal:
      'Could not derive a last name from the submission (no last-name field, ' +
      'no space in the full name, and no email to fall back to).',
  };
}

function mapExtra(
  formData: Record<string, string>,
  fieldMap: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fieldMap) return out;
  for (const [field, property] of Object.entries(fieldMap)) {
    const value = formData[field];
    if (value) out[property] = value;
  }
  return out;
}

function mapAttribution(
  event: ConversionEvent,
  trackingFields: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  // A visitor with no `_ac` cookie — organic arrival, or declined consent —
  // yields `{}`, never an error. Absence is not a mapping failure.
  if (!event.tracking || !trackingFields) return out;
  for (const [key, property] of Object.entries(trackingFields)) {
    const value = event.tracking[key];
    if (value !== undefined && value !== '') out[property] = String(value);
  }
  return out;
}

export function mapSubmission(event: ConversionEvent, config: CrmConfig): CrmRecord {
  const formData = event.formData ?? {};
  const identity = identifySubmitter(formData);

  return {
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.email,
    phone: identity.phone ?? event.phone,
    company: identity.company,
    message: formData['message'] ?? formData['comments'] ?? formData['comment'],
    extra: mapExtra(formData, config.fieldMap),
    attribution: mapAttribution(event, config.trackingFields),
  };
}
