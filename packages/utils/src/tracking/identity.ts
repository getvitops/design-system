/**
 * Pulling a submitter's identity out of a form's fields.
 *
 * Extracted from `notify/render.ts`'s `submitterName()`, which needed only the
 * display name for a subject line. `crm/map.ts` needs the whole set — first
 * name, last name, email, phone, company — to fill a CRM record, and a form's
 * field names vary the same way `submitterName()` already accounted for
 * (`name` vs `first_name`/`last_name` vs neither). Two independent cascades
 * over the same handful of aliases is exactly the failure `render.ts`'s own
 * comment records: a downstream site had five of six forms carrying
 * `first_name`/`last_name`, and a cascade that only checked `name` read every
 * one of them as "Unknown". Keep this the one place that knows the aliases;
 * `submitterName()` and `crm/map.ts` both delegate to it.
 */

export interface SubmitterIdentity {
  firstName?: string | undefined;
  lastName?: string | undefined;
  /** The best available display name — a submitted full name, first + last
   * joined, or the email address as a last resort. Never empty. */
  fullName: string;
  email?: string | undefined;
  phone?: string | undefined;
  company?: string | undefined;
}

function first(formData: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = formData[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function identifySubmitter(formData: Record<string, string>): SubmitterIdentity {
  const fullNameField = first(formData, 'name', 'full_name', 'fullName', 'fullname', 'your-name');
  const firstName = first(formData, 'first_name', 'firstName', 'firstname', 'given_name');
  const lastName = first(formData, 'last_name', 'lastName', 'lastname', 'family_name', 'surname');
  const email = first(formData, 'email', 'email_address', 'emailAddress');
  const phone = first(formData, 'phone', 'phone_number', 'phoneNumber', 'tel');
  const company = first(formData, 'company', 'company_name', 'organization', 'business');

  let derivedFirst = firstName;
  let derivedLast = lastName;
  if (!derivedFirst && !derivedLast && fullNameField) {
    const parts = fullNameField.split(/\s+/);
    derivedFirst = parts[0];
    derivedLast = parts.slice(1).join(' ') || undefined;
  }

  const joined = [firstName, lastName].filter(Boolean).join(' ');
  const fullName = fullNameField || joined || email || 'Unknown';

  return {
    firstName: derivedFirst,
    lastName: derivedLast,
    fullName,
    email,
    phone,
    company,
  };
}
