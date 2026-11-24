/**
 * Pure decisions for the `vitops_form` block: which of an editor's field rows become real
 * controls, and under what submitted names.
 *
 * Names matter more than they look. `createConversionRoute` (`@getvitops/astro/routes`) is
 * what receives the post, and it reserves a few: `phone` and `event` are the tel:/mailto:
 * click-beacon payload and are dropped from a form submission, `cf-turnstile-response` is
 * the Turnstile token, and `website`/`honeypot`/`_honeypot` are the honeypots (a filled one
 * makes the route answer success and deliver nothing). A visitor-facing field called
 * "Phone" must therefore not submit as `phone`, or the number silently vanishes from the
 * notification and the CRM record. `identifySubmitter` reads `tel` for a phone number, so
 * that is where it goes.
 */

export const FIELD_TYPES = [
  'text',
  'email',
  'tel',
  'textarea',
  'select',
  'checkbox',
  'checkboxes',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Names the route treats specially. A field must never submit under one of these. */
export const RESERVED_NAMES = new Set([
  'event',
  'phone',
  'cf-turnstile-response',
  'website',
  'honeypot',
  '_honeypot',
  '_next',
]);

/** The honeypot's name: the first of the route's own defaults, so no option needs passing. */
export const HONEYPOT_NAME = 'website';

export const MAX_FIELDS = 20;

export interface FormField {
  /** Submitted name. */
  name: string;
  /** DOM id suffix; unique within the form. */
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  help: string;
  options: string[];
  autocomplete: string | undefined;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** `Your full name` -> `your_full_name`. Empty when the text holds nothing usable. */
export function slugName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** A submitted name for a row: the editor's `name` if usable, else one derived from the label. */
export function fieldName(
  raw: unknown,
  label: string,
  type: FieldType,
  taken: Set<string>,
): string {
  let base = slugName(str(raw)) || slugName(label) || type;
  if (!/^[a-z]/.test(base)) base = `f_${base}`;
  if (base === 'phone') base = 'tel';
  if (RESERVED_NAMES.has(base)) base = `${base}_field`;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  taken.add(name);
  return name;
}

/** The HTML `autocomplete` token for a field, or undefined when there is no honest one. */
export function autocompleteFor(name: string, type: FieldType): string | undefined {
  if (type === 'email') return 'email';
  if (type === 'tel') return 'tel';
  if (type !== 'text') return undefined;
  const map: Record<string, string> = {
    name: 'name',
    full_name: 'name',
    your_name: 'name',
    first_name: 'given-name',
    given_name: 'given-name',
    last_name: 'family-name',
    family_name: 'family-name',
    company: 'organization',
    organization: 'organization',
    organisation: 'organization',
    postal_code: 'postal-code',
    postcode: 'postal-code',
    zip: 'postal-code',
    city: 'address-level2',
    address: 'street-address',
  };
  return map[name];
}

/** Editor rows to renderable fields. Rows with no label are dropped; at most {@link MAX_FIELDS}. */
export function resolveFields(rows: Record<string, unknown>[]): FormField[] {
  const taken = new Set<string>();
  const out: FormField[] = [];
  for (const row of rows) {
    const label = str(row['label']);
    if (!label) continue;
    if (out.length >= MAX_FIELDS) break;
    const rawType = str(row['type']);
    const type = (FIELD_TYPES as readonly string[]).includes(rawType)
      ? (rawType as FieldType)
      : 'text';
    const name = fieldName(row['name'], label, type, taken);
    const options =
      type === 'select' || type === 'checkboxes'
        ? str(row['options'])
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    // A select with nothing to choose is unusable; render it as free text instead.
    const effective: FieldType =
      (type === 'select' || type === 'checkboxes') && options.length === 0 ? 'text' : type;
    out.push({
      name,
      id: `form-${out.length + 1}-${name}`,
      label,
      type: effective,
      required: row['required'] === true,
      placeholder:
        effective === 'checkbox' || effective === 'select' || effective === 'checkboxes'
          ? ''
          : str(row['placeholder']),
      help: str(row['help']),
      options,
      autocomplete: autocompleteFor(name, effective),
    });
  }
  return out;
}

/**
 * Where the endpoint may send a visitor back to: a same-site path, nothing else. The form
 * posts its own page path as `_next`; the route that reads it must apply this too, or the
 * field becomes an open redirect.
 */
export function safeNext(input: unknown): string | null {
  const v = typeof input === 'string' ? input : '';
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || v.length > 200) return null;
  // Control characters (and a query/fragment) are exactly what a redirect target must not carry.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f#?]/.test(v)) return null;
  return v;
}

/** The endpoint a form posts to: a same-site path, defaulting to the conversion route. */
export function safeAction(input: unknown): string {
  return safeNext(input) ?? '/api/track';
}
