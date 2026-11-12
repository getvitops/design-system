/**
 * EmDash schema diff — what to replay from one instance's content model onto another's.
 *
 * EmDash keeps collections and fields in the database beside the content, so they travel with a
 * database copy and with nothing else. That is the problem this solves: syncing prod into a
 * long-lived dev site replaces dev's schema with prod's, so any collection or field someone added
 * on dev would silently vanish. Diffing the two `GET /_emdash/api/schema` exports first says
 * exactly which additions to replay afterwards.
 *
 * Pure: two exports in, a plan out. `client.ts` fetches and applies; nothing here touches the
 * network, which is what lets `--dry` and a PR summary be complete accounts of what a run would do
 * and lets the cases that matter be asserted without a server.
 *
 * Only ADDITIONS are ever planned for application. A field present on both sides with a different
 * definition is reported, never altered, and a field or collection present only on the target is
 * reported as information, never removed: removing a field deletes its column and values and a JSON
 * export cannot restore them. That is the same rule `onboarding/cloudflare.ts` follows for DNS.
 *
 * The types are a structural copy of `emdash/client`'s `SchemaExport` rather than an import:
 * `@getvitops/utils` takes no dependency on the CMS, and the REST contract is the stable surface.
 */

export interface SchemaField {
  slug: string;
  label: string;
  type: string;
  required: boolean;
  unique: boolean;
  defaultValue?: unknown;
  validation?: unknown;
  widget?: string;
  options?: unknown;
}

export interface SchemaCollection {
  slug: string;
  label: string;
  labelSingular: string;
  description?: string;
  icon?: string;
  supports: string[];
  fields: SchemaField[];
}

export interface SchemaExport {
  version: string;
  collections: SchemaCollection[];
}

export type SchemaOp =
  | { kind: 'create-collection'; collection: Omit<SchemaCollection, 'fields'> }
  | { kind: 'add-field'; collection: string; field: SchemaField; sortOrder: number };

/**
 * Something the diff noticed and will not act on. `review` needs a person (a definition differs,
 * or a block type can't be replayed); `info` is the target being ahead of the source.
 */
export interface SchemaNote {
  severity: 'review' | 'info';
  kind:
    | 'changed-field'
    | 'changed-collection'
    | 'target-only-collection'
    | 'target-only-field'
    | 'block-type';
  collection?: string;
  field?: string;
  message: string;
}

export interface SchemaPlan {
  /** Additions to apply, in order: every collection first, then fields (a reference may need either). */
  apply: SchemaOp[];
  notes: SchemaNote[];
  /** Fields and collections already identical on both sides. */
  unchanged: number;
}

export interface DiffOptions {
  /** Block type slugs on each side, when known. They can be reported but not replayed. */
  fromBlockTypes?: string[];
  toBlockTypes?: string[];
}

/** Stable JSON — sorted keys, `undefined` dropped — so two equal definitions compare equal. */
function canon(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined && x !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, norm(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(value) ?? null);
}

/** The parts of a field that change the data model. The label is cosmetic and is left out. */
const fieldShape = (f: SchemaField) =>
  canon({
    type: f.type,
    required: f.required,
    unique: f.unique,
    defaultValue: f.defaultValue,
    validation: f.validation,
    widget: f.widget,
    options: f.options,
  });

const sameSet = (a: string[], b: string[]) => canon([...a].sort()) === canon([...b].sort());

/** What to replay from `from` onto `to`. */
export function diffSchema(
  from: SchemaExport,
  to: SchemaExport,
  opts: DiffOptions = {},
): SchemaPlan {
  const targetBySlug = new Map(to.collections.map((c) => [c.slug, c]));
  const creates: SchemaOp[] = [];
  const fields: SchemaOp[] = [];
  const notes: SchemaNote[] = [];
  let unchanged = 0;

  for (const c of from.collections) {
    const target = targetBySlug.get(c.slug);
    if (!target) {
      const { fields: _fields, ...rest } = c;
      creates.push({ kind: 'create-collection', collection: rest });
      c.fields.forEach((field, sortOrder) =>
        fields.push({ kind: 'add-field', collection: c.slug, field, sortOrder }),
      );
      continue;
    }

    if (sameSet(c.supports, target.supports)) unchanged++;
    else {
      notes.push({
        severity: 'review',
        kind: 'changed-collection',
        collection: c.slug,
        message: `"${c.slug}" supports [${[...c.supports].sort().join(', ')}] on the source and [${[...target.supports].sort().join(', ')}] on the target. Not changed automatically.`,
      });
    }

    const targetFields = new Map(target.fields.map((f) => [f.slug, f]));
    c.fields.forEach((field, sortOrder) => {
      const there = targetFields.get(field.slug);
      if (!there) {
        fields.push({ kind: 'add-field', collection: c.slug, field, sortOrder });
      } else if (fieldShape(field) === fieldShape(there)) {
        unchanged++;
      } else {
        notes.push({
          severity: 'review',
          kind: 'changed-field',
          collection: c.slug,
          field: field.slug,
          message: `"${c.slug}.${field.slug}" is defined differently on the source and the target (type, required, unique, default, validation, widget or options). Not changed automatically.`,
        });
      }
    });

    const sourceFields = new Set(c.fields.map((f) => f.slug));
    for (const f of target.fields) {
      if (!sourceFields.has(f.slug)) {
        notes.push({
          severity: 'info',
          kind: 'target-only-field',
          collection: c.slug,
          field: f.slug,
          message: `"${c.slug}.${f.slug}" exists only on the target. Left alone.`,
        });
      }
    }
  }

  const sourceSlugs = new Set(from.collections.map((c) => c.slug));
  for (const c of to.collections) {
    if (!sourceSlugs.has(c.slug)) {
      notes.push({
        severity: 'info',
        kind: 'target-only-collection',
        collection: c.slug,
        message: `Collection "${c.slug}" exists only on the target. Left alone.`,
      });
    }
  }

  if (opts.fromBlockTypes && opts.toBlockTypes) {
    const there = new Set(opts.toBlockTypes);
    for (const slug of opts.fromBlockTypes) {
      if (!there.has(slug)) {
        notes.push({
          severity: 'review',
          kind: 'block-type',
          message: `Block type "${slug}" exists only on the source. Block types carry a version history this tool cannot replay: add it on the target from the admin or the site's seed.`,
        });
      }
    }
  }

  return { apply: [...creates, ...fields], notes, unchanged };
}

/** Whether replaying would change the target. */
export const hasChanges = (plan: SchemaPlan): boolean => plan.apply.length > 0;
/** Whether a person needs to look at something before the target can be called in step. */
export const needsReview = (plan: SchemaPlan): boolean =>
  plan.notes.some((n) => n.severity === 'review');
/** Drift for `--check`: something to apply, or something only a person can settle. */
export const hasDrift = (plan: SchemaPlan): boolean => hasChanges(plan) || needsReview(plan);

const describeOp = (op: SchemaOp): string =>
  op.kind === 'create-collection'
    ? `create collection "${op.collection.slug}"`
    : `add field "${op.collection}.${op.field.slug}" (${op.field.type}${op.field.required ? ', required' : ''})`;

/** Plain text for the terminal. */
export function formatPlan(plan: SchemaPlan): string {
  const lines: string[] = [];
  if (plan.apply.length) {
    lines.push(`Apply (${plan.apply.length}, additive only):`);
    for (const op of plan.apply) lines.push(`  + ${describeOp(op)}`);
  } else {
    lines.push('Nothing to apply.');
  }
  const review = plan.notes.filter((n) => n.severity === 'review');
  const info = plan.notes.filter((n) => n.severity === 'info');
  if (review.length) {
    lines.push('', `Needs a person (${review.length}):`);
    for (const n of review) lines.push(`  ! ${n.message}`);
  }
  if (info.length) {
    lines.push('', `Target is ahead (${info.length}):`);
    for (const n of info) lines.push(`  · ${n.message}`);
  }
  lines.push('', `${plan.unchanged} item(s) already identical.`);
  return lines.join('\n');
}

/** Markdown for a PR body or a job summary. */
export function formatPlanMarkdown(plan: SchemaPlan): string {
  const out: string[] = [];
  if (!plan.apply.length && !plan.notes.some((n) => n.severity === 'review')) {
    out.push('No schema changes to apply.');
  }
  if (plan.apply.length) {
    out.push(`**Schema additions to apply (${plan.apply.length})**`, '');
    for (const op of plan.apply) out.push(`- ${describeOp(op)}`);
  }
  const review = plan.notes.filter((n) => n.severity === 'review');
  if (review.length) {
    out.push('', `**Needs a person (${review.length})**`, '');
    for (const n of review) out.push(`- ${n.message}`);
  }
  const info = plan.notes.filter((n) => n.severity === 'info');
  if (info.length) {
    out.push('', `<details><summary>Target is ahead (${info.length})</summary>`, '');
    for (const n of info) out.push(`- ${n.message}`);
    out.push('', '</details>');
  }
  return out.join('\n');
}
