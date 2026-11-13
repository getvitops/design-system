/**
 * Render field descriptors as a complete, no-JavaScript HTML form.
 *
 * `@getvitops/config/forms` decides WHAT a field is (a select with these options, a locale map, a
 * keyed map of rows); this module writes the markup, once, for every host: an Astro page
 * (`set:html`), an EmDash admin route, a Worker. The result posts named fields in the
 * `formToConfig` convention, so a plain `<form method="post">` round-trips with scripting off, and
 * `<wc-field>` / `<wc-config-form>` enhance the same markup in place.
 *
 * Everything goes through `nodesToHtml`, so text is escaped and tag and attribute names are
 * validated by the same code that renders legal documents. Attribute VALUES additionally have `&`
 * escaped here: `nodesToHtml` escapes only the quote, and a value a visitor typed (`AT&T`,
 * `&copy`) must come back out of the form exactly as it went in.
 *
 * Worker-safe: no Node builtin, no parse5 (the pure renderer lives in `../html-render.ts`).
 */
import {
  boolName,
  linesName,
  locName,
  mapFieldName,
  mapKeyName,
  numName,
  projectionById,
  resolveProjection,
  scalarName,
  valueAt,
  type FieldDescriptor,
  type JsonSchema,
  type NoticeDescriptor,
  type OnboardingStep,
  type ProjectedItem,
  type Projection,
  type ValidationIssue,
} from '@getvitops/config/forms';
import type { ContentNode } from '../content.ts';
import { nodesToHtml } from '../html-render.ts';

/** Text, or already-built nodes, shown for a `notice` item. Plain text is escaped. */
export type NoticeContent = string | ContentNode[];

export interface RenderOptions {
  /** Field errors by dotted document path (`organization.email`, `organization.services.roof.name`). */
  errors?: Readonly<Record<string, string>>;
  /** Locale codes for a localisable field. With more than one, each gets its own row. */
  locales?: readonly string[];
  /** Content for `notice` items by id. Merged over `DEFAULT_NOTICES`. */
  notices?: Readonly<Record<string, NoticeContent>>;
  /** Prefix for generated ids, so two forms on one page cannot collide. Default `f`. */
  idPrefix?: string;
  /** The document being edited, for map rows and the current values of a section's fields. */
  values?: unknown;
  /** Heading level for a section's title. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/**
 * Stand-ins for notices a host has not supplied. The accessibility step's requirements summary is
 * built elsewhere; until a host wires it in, the form says so rather than showing a gap.
 */
export const DEFAULT_NOTICES: Readonly<Record<string, NoticeContent>> = {
  'accessibility.obligations':
    'A summary of the accessibility requirements that apply to your business is not available here yet.',
};

/** The first message for each path, ready for `RenderOptions.errors`. */
export function errorsByPath(issues: readonly ValidationIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) if (!(issue.path in out)) out[issue.path] = issue.message;
  return out;
}

/* ── Inline markdown, as nodes ─────────────────────────────────────────────── */

/** Sentinel for a lifted code span; an escape, never the literal byte. */
const SLOT = '\u0000';
const INLINE = new RegExp(`\\*\\*([^*]+)\\*\\*|\\*([^*\\n]+)\\*|${SLOT}(\\d+)${SLOT}`);

/**
 * The same inline markdown `renderInlineMarkdown` (`@getvitops/config/forms`) accepts (backticks,
 * `**strong**`, `*em*`), as nodes, so a schema description can sit inside the escaped tree instead of
 * being spliced in as raw HTML. A test holds the two to the same output.
 */
export function inlineMarkdownNodes(source: string): ContentNode[] {
  const spans: string[] = [];
  const lifted = source.replace(/`([^`]+)`/g, (_, body: string) => {
    spans.push(body);
    return `${SLOT}${spans.length - 1}${SLOT}`;
  });
  const parse = (text: string): ContentNode[] => {
    const out: ContentNode[] = [];
    let rest = text;
    for (;;) {
      const match = INLINE.exec(rest);
      if (!match) {
        if (rest) out.push(rest);
        return out;
      }
      if (match.index > 0) out.push(rest.slice(0, match.index));
      if (match[1] !== undefined) out.push({ tag: 'strong', children: parse(match[1]) });
      else if (match[2] !== undefined) out.push({ tag: 'em', children: parse(match[2]) });
      else out.push({ tag: 'code', children: [spans[Number(match[3])] ?? ''] });
      rest = rest.slice(match.index + match[0].length);
    }
  };
  return parse(lifted);
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

type Attrs = Record<string, unknown>;

const el = (tag: string, attrs: Attrs | undefined, ...children: ContentNode[]): ContentNode =>
  attrs ? { tag, attrs, children } : { tag, children };

/** An attribute VALUE: `&` escaped so what a visitor typed survives the round trip. */
const av = (value: unknown): string => String(value).replace(/&/g, '&amp;');

const slug = (name: string): string => name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

/** What the scope above a field supplies: names, values and error paths. */
interface Scope {
  /** The form-control name for a template path, after `wrap` adds its marker. */
  name(path: string, wrap?: (path: string) => string): string;
  /** The current value of a descriptor in this scope. */
  value(d: FieldDescriptor): unknown;
  /** The document path whose error belongs to a descriptor in this scope. */
  docPath(path: string): string;
  /** Depth below the projection item: only depth 0 gets native `required` and "(optional)". */
  depth: number;
}

const identity = (path: string): string => path;

function topScope(): Scope {
  return {
    name: (path, wrap = scalarName) => wrap(path),
    value: (d) => d.value,
    docPath: identity,
    depth: 0,
  };
}

function rowScope(
  parent: Scope,
  map: FieldDescriptor,
  index: number,
  key: string,
  row: unknown,
): Scope {
  const prefix = `${map.path}.*.`;
  const rel = (path: string): string =>
    path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const base = parent.name(map.path, identity);
  return {
    name: (path, wrap = scalarName) => mapFieldName(base, index, wrap(rel(path))),
    value: (d) => valueAt(row, rel(d.path)),
    docPath: (path) => `${parent.docPath(map.path)}.${key}.${rel(path)}`,
    depth: parent.depth + 1,
  };
}

const stringOf = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/* ── Field markup ──────────────────────────────────────────────────────────── */

interface Ctx {
  options: RenderOptions;
  scope: Scope;
}

function helpNodes(d: FieldDescriptor): ContentNode[] {
  if (d.help) return [d.help];
  if (d.description) return inlineMarkdownNodes(d.description);
  return [];
}

/** Wrap a control in `<wc-field>` with its help text and error node. */
function shell(d: FieldDescriptor, ctx: Ctx, id: string, control: ContentNode): ContentNode {
  const error = ctx.options.errors?.[ctx.scope.docPath(d.path)];
  const help = helpNodes(d);
  const parts: ContentNode[] = [control];
  if (help.length) parts.push(el('small', { class: 'field__help', id: `${id}-help` }, ...help));
  parts.push(
    el(
      'span',
      { class: 'field__error', id: `${id}-error`, 'aria-live': 'polite' },
      ...(error ? [error] : []),
    ),
  );
  return el('wc-field', { class: 'field', 'data-invalid': error ? true : null }, ...parts);
}

/** The attributes every native control shares: wiring to its help and error, and its constraints. */
function controlAttrs(d: FieldDescriptor, ctx: Ctx, id: string, name: string): Attrs {
  const error = ctx.options.errors?.[ctx.scope.docPath(d.path)];
  const describedBy = [helpNodes(d).length ? `${id}-help` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');
  return {
    name,
    id,
    // Native `required` only on a field the projection shows directly. Inside a group or a row it
    // means "required if the group exists", which a native attribute would turn into "required".
    required: d.required && ctx.scope.depth === 0 ? true : null,
    'aria-describedby': describedBy || null,
    'aria-invalid': error ? 'true' : null,
  };
}

function labelText(d: FieldDescriptor, ctx: Ctx): ContentNode {
  const optional = !d.required && ctx.scope.depth === 0;
  return el(
    'span',
    { class: 'field__label' },
    d.label,
    ...(optional ? [el('span', { class: 'field__optional' }, ' (optional)')] : []),
  );
}

const INPUT_TYPES = new Set(['text', 'email', 'url', 'date', 'number']);

function renderControl(
  d: FieldDescriptor,
  ctx: Ctx,
  override?: { value: unknown },
): ContentNode | null {
  const id = `${ctx.options.idPrefix ?? 'f'}-${slug(ctx.scope.name(d.path))}`;
  const value = override ? override.value : ctx.scope.value(d);

  switch (d.widget) {
    case 'text':
    case 'email':
    case 'url':
    case 'date':
    case 'number':
    case 'color': {
      const type = INPUT_TYPES.has(d.widget) ? d.widget : 'text';
      const name = ctx.scope.name(d.path, d.widget === 'number' ? numName : scalarName);
      const input = el('input', {
        ...controlAttrs(d, ctx, id, name),
        type,
        value: value === undefined ? null : av(stringOf(value)),
        placeholder: d.placeholder ? av(d.placeholder) : null,
        min: d.min ?? null,
        max: d.max ?? null,
        maxlength: d.maxLength ?? null,
        step: d.widget === 'number' ? 'any' : null,
        // A colour is a CSS colour string (hex or oklch()), which `<input type=color>` cannot hold.
        'data-widget': d.widget === 'color' ? 'color' : null,
      });
      return shell(d, ctx, id, el('label', { class: 'field__control' }, labelText(d, ctx), input));
    }

    case 'textarea':
    case 'lines': {
      const name = ctx.scope.name(d.path, d.widget === 'lines' ? linesName : scalarName);
      const text = Array.isArray(value)
        ? value.filter((v) => typeof v === 'string').join('\n')
        : stringOf(value);
      const area = el(
        'textarea',
        {
          ...controlAttrs(d, ctx, id, name),
          rows: d.widget === 'lines' ? 3 : 4,
          placeholder:
            d.widget === 'lines' ? 'One per line' : d.placeholder ? av(d.placeholder) : null,
          maxlength: d.maxLength ?? null,
        },
        text,
      );
      return shell(d, ctx, id, el('label', { class: 'field__control' }, labelText(d, ctx), area));
    }

    case 'select': {
      const name = ctx.scope.name(d.path);
      const current = stringOf(value);
      const options: ContentNode[] = [];
      if (!d.required || ctx.scope.depth > 0) options.push(el('option', { value: '' }, '—'));
      for (const option of d.options ?? []) {
        options.push(
          el('option', { value: av(option), selected: option === current ? true : null }, option),
        );
      }
      const select = el(
        'select',
        { ...controlAttrs(d, ctx, id, name), class: 'custom-select' },
        ...options,
      );
      return shell(d, ctx, id, el('label', { class: 'field__control' }, labelText(d, ctx), select));
    }

    case 'radio': {
      const name = ctx.scope.name(d.path);
      const current = stringOf(value);
      const base = controlAttrs(d, ctx, id, name);
      const radios = (d.options ?? []).map((option, i) =>
        el(
          'label',
          { class: 'field__option' },
          el('input', {
            type: 'radio',
            name,
            id: `${id}-${i}`,
            value: av(option),
            checked: option === current ? true : null,
            required: base.required ?? null,
            'aria-describedby': base['aria-describedby'] ?? null,
            'aria-invalid': base['aria-invalid'] ?? null,
          }),
          option,
        ),
      );
      return shell(
        d,
        ctx,
        id,
        el(
          'fieldset',
          { class: 'field__control' },
          el(
            'legend',
            { class: 'field__label' },
            d.label,
            ...(!d.required && ctx.scope.depth === 0
              ? [el('span', { class: 'field__optional' }, ' (optional)')]
              : []),
          ),
          ...radios,
        ),
      );
    }

    case 'switch': {
      const name = ctx.scope.name(d.path, boolName);
      const base = controlAttrs(d, ctx, id, name);
      // The hidden "false" comes first in the DOM, so an unchecked box still submits `false` and a
      // checked one's own "true" arrives later and wins (`formToConfig` takes the last).
      const off = el('input', { type: 'hidden', name, value: 'false' });
      const box = el('input', {
        ...base,
        type: 'checkbox',
        value: 'true',
        checked: (value === undefined ? d.default === true : value === true) ? true : null,
        required: null,
      });
      return shell(
        d,
        ctx,
        id,
        el(
          'label',
          { class: 'field__control' },
          off,
          box,
          el('span', { class: 'field__label' }, d.label),
        ),
      );
    }

    case 'locale':
      return renderLocale(d, ctx, id, value);

    case 'group': {
      const inner = renderChildren(d.children ?? [], {
        ...ctx,
        scope: { ...ctx.scope, depth: ctx.scope.depth + 1 },
      });
      if (!inner.length) return null;
      return el(
        'fieldset',
        { class: 'field__group' },
        el('legend', { class: 'field__label' }, d.label),
        ...helpBlock(d),
        ...inner,
      );
    }

    case 'map':
      return renderMap(d, ctx, id);

    default:
      return null;
  }
}

const helpBlock = (d: FieldDescriptor): ContentNode[] => {
  const help = helpNodes(d);
  return help.length ? [el('p', { class: 'field__help' }, ...help)] : [];
};

function renderLocale(d: FieldDescriptor, ctx: Ctx, id: string, value: unknown): ContentNode {
  const locales = ctx.options.locales ?? [];
  const isMap = typeof value === 'object' && value !== null && !Array.isArray(value);
  const stored = isMap ? (value as Record<string, unknown>) : {};

  // One language: a plain text input. A string and a one-entry map mean the same thing to a reader,
  // and `formToConfig` keeps a plain value when no translation row is filled in.
  if (locales.length <= 1 && Object.keys(stored).length <= 1) {
    const only = locales[0] ?? Object.keys(stored)[0];
    const text = isMap ? stringOf(stored[only ?? '']) : stringOf(value);
    return renderControl({ ...d, widget: 'text' }, ctx, { value: text }) as ContentNode;
  }

  // Several: a row per language. A bare string belongs to the first (the default) locale.
  const codes = [...locales, ...Object.keys(stored).filter((code) => !locales.includes(code))];
  const rows = codes.map((code, i) => {
    const text = isMap ? stringOf(stored[code]) : i === 0 ? stringOf(value) : '';
    const rowId = `${id}-${i}`;
    return el(
      'label',
      { class: 'field__control' },
      el('span', { class: 'field__label' }, code),
      el('input', {
        type: 'hidden',
        name: ctx.scope.name(d.path, (p) => locName(p, i, 'code')),
        value: av(code),
      }),
      el('input', {
        type: 'text',
        id: rowId,
        name: ctx.scope.name(d.path, (p) => locName(p, i, 'value')),
        value: av(text),
        lang: av(code),
      }),
    );
  });
  return shell(
    d,
    ctx,
    id,
    el(
      'fieldset',
      { class: 'field__control' },
      el('legend', { class: 'field__label' }, d.label),
      ...rows,
    ),
  );
}

function renderMap(d: FieldDescriptor, ctx: Ctx, id: string): ContentNode | null {
  const rows = [...(d.rows ?? [])];
  // One blank row is always offered: with no script this is how a visitor adds an entry.
  const all = [...rows, { key: '', value: undefined as unknown }];
  const body = all.map((row, i) => {
    const scope = rowScope(ctx.scope, d, i, row.key, row.value);
    const rowCtx: Ctx = { ...ctx, scope };
    const keyName = mapKeyName(ctx.scope.name(d.path, identity), i);
    const keyId = `${id}-${i}-key`;
    const keyLabel = el('span', { class: 'field__label' }, 'Identifier');
    const keyControl = d.options?.length
      ? el(
          'select',
          { name: keyName, id: keyId, class: 'custom-select' },
          el('option', { value: '' }, '—'),
          ...d.options.map((option) =>
            el('option', { value: av(option), selected: option === row.key ? true : null }, option),
          ),
        )
      : el('input', { type: 'text', name: keyName, id: keyId, value: av(row.key) });
    const fields = renderChildren(d.children ?? [], rowCtx);
    return el(
      'fieldset',
      {
        class: 'field__row',
        'data-blank': row.key === '' && row.value === undefined ? true : null,
      },
      el(
        'wc-field',
        { class: 'field' },
        el('label', { class: 'field__control' }, keyLabel, keyControl),
      ),
      ...fields,
    );
  });
  return el(
    'fieldset',
    { class: 'field__group', id },
    el('legend', { class: 'field__label' }, d.label),
    ...helpBlock(d),
    ...body,
  );
}

function renderChildren(children: readonly FieldDescriptor[], ctx: Ctx): ContentNode[] {
  const out: ContentNode[] = [];
  for (const child of children) {
    // A group's children carry their concrete value; a map row's come from the row.
    const node = renderControl(child, ctx);
    if (node) out.push(node);
  }
  return out;
}

/* ── Public ────────────────────────────────────────────────────────────────── */

function noticeNode(notice: NoticeDescriptor, options: RenderOptions): ContentNode | null {
  const content = options.notices?.[notice.id] ?? DEFAULT_NOTICES[notice.id];
  if (content === undefined) return null;
  const children: ContentNode[] = typeof content === 'string' ? [content] : content;
  return el(
    'div',
    { class: 'field__notice', role: 'note', 'data-notice': av(notice.id) },
    ...children,
  );
}

/** Render already-resolved items (fields and notices) to an HTML string. */
export function renderProjectionHtml(
  items: readonly ProjectedItem[],
  options: RenderOptions = {},
): string {
  const ctx: Ctx = { options, scope: topScope() };
  const nodes: ContentNode[] = [];
  for (const item of items) {
    const node = item.kind === 'notice' ? noticeNode(item, options) : renderControl(item, ctx);
    if (node) nodes.push(node);
  }
  return nodesToHtml(nodes);
}

/** Resolve a projection against the schema and render it as a titled section. */
export function renderProjectionSection(
  root: JsonSchema,
  projection: Projection,
  options: RenderOptions = {},
): string {
  const level = options.headingLevel ?? 3;
  const headingId = `${options.idPrefix ?? 'f'}-section-${slug(projection.id)}`;
  const items = resolveProjection(root, projection, { values: options.values });
  const ctx: Ctx = { options, scope: topScope() };
  const fields: ContentNode[] = [];
  for (const item of items) {
    const node = item.kind === 'notice' ? noticeNode(item, options) : renderControl(item, ctx);
    if (node) fields.push(node);
  }
  return nodesToHtml([
    el(
      'section',
      { class: 'field-section', 'aria-labelledby': headingId },
      el(`h${level}`, { id: headingId }, projection.title),
      ...(projection.description
        ? [el('p', { class: 'field-section__intro' }, projection.description)]
        : []),
      ...fields,
    ),
  ]);
}

/** Render every projection a step lists, in order. A review step has none and renders nothing. */
export function renderStepHtml(
  root: JsonSchema,
  step: OnboardingStep,
  options: RenderOptions = {},
): string {
  return step.projections
    .map((id) => projectionById(id))
    .filter((projection): projection is Projection => projection !== undefined)
    .map((projection) => renderProjectionSection(root, projection, options))
    .join('');
}
