/**
 * Turn a projection into field descriptors: what to render, derived from the schema.
 *
 * A descriptor is data, not markup. The renderer in `@getvitops/utils/forms` turns it into HTML and
 * the web components enhance that HTML, so the decision "this field is a select with these options"
 * is made once, here, from the same JSON Schema that validates the value.
 */
import { humanize, metaFor } from './fields.ts';
import {
  inputTypeFor,
  isKeyedMap,
  isLocalisable,
  isUnconditionallyRequired,
  nodeAt,
  propertiesOf,
  resolveRef,
  valueAt,
  type JsonSchema,
} from './json-schema.ts';
import type { NoticeItem, PathItem, Projection, ProjectionItem } from './projections.ts';

export type Widget =
  | 'text'
  | 'email'
  | 'url'
  | 'date'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'switch'
  | 'color'
  | 'locale'
  | 'lines'
  | 'map'
  | 'group'
  | 'unsupported';

export interface FieldDescriptor {
  kind: 'field';
  /** Dotted config path. A path under a map's rows carries `*` (`organization.services.*.name`). */
  path: string;
  label: string;
  widget: Widget;
  required: boolean;
  /** The schema's own description, as inline markdown. Render with `renderInlineMarkdown`. */
  description?: string;
  /** Help that replaces the schema description (from the registry or the projection). */
  help?: string;
  placeholder?: string;
  /** For `select` and `radio`; for a `map`, the closed set its keys must come from. */
  options?: readonly string[];
  /** The current value, when the path is concrete and the host supplied a document. */
  value?: unknown;
  /**
   * What the schema says an absent value means. A switch must start from this, not from "off": an
   * unset `default: true` field rendered unchecked would be saved as an explicit `false`.
   */
  default?: unknown;
  /** For a `group`: its fields. For a `map`: the template of one row, with `*` in each path. */
  children?: readonly FieldDescriptor[];
  /** For a `map`: the rows the current value holds. */
  rows?: readonly { key: string; value: unknown }[];
  /** Number bounds, when the schema states them. */
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface NoticeDescriptor {
  kind: 'notice';
  id: string;
}

export type ProjectedItem = FieldDescriptor | NoticeDescriptor;

/** Deeper than this a field is reported `unsupported` rather than rendered as nested fieldsets. */
const MAX_DEPTH = 4;
/** An enum this small reads better as radio buttons than as a select. */
const RADIO_MAX = 4;

interface DescribeOptions {
  values?: unknown;
  override?: Omit<PathItem, 'path'>;
  depth?: number;
}

/** Describe one config path, or `undefined` when the schema has no such node. */
export function describeField(
  root: JsonSchema,
  path: string,
  options: DescribeOptions = {},
): FieldDescriptor | undefined {
  const node = nodeAt(root, path);
  if (!node) return undefined;
  const depth = options.depth ?? 0;
  const meta = metaFor(path);
  const override = options.override;

  const descriptor: FieldDescriptor = {
    kind: 'field',
    path,
    label: override?.label ?? meta?.label ?? humanize(path.split('.').at(-1)!),
    widget: override?.widget ?? meta?.widget ?? deriveWidget(node, root, depth),
    required: isUnconditionallyRequired(root, path),
  };
  if (node.description) descriptor.description = node.description;
  const help = override?.help ?? meta?.help;
  if (help) descriptor.help = help;
  if (meta?.placeholder) descriptor.placeholder = meta.placeholder;
  if (node.default !== undefined) descriptor.default = node.default;
  if (node.minimum !== undefined) descriptor.min = node.minimum;
  if (node.maximum !== undefined) descriptor.max = node.maximum;
  if (node.maxLength !== undefined) descriptor.maxLength = node.maxLength;

  const concrete = !path.includes('*');
  if (concrete && options.values !== undefined) {
    const value = valueAt(options.values, path);
    if (value !== undefined) descriptor.value = value;
  }

  const strings = enumOf(node);
  if (strings && (descriptor.widget === 'select' || descriptor.widget === 'radio')) {
    descriptor.options = strings;
  }
  if (meta?.optionsFrom && !override?.widget) {
    // Options come from the document being edited, so with no document there are none to offer.
    const source =
      options.values !== undefined ? valueAt(options.values, meta.optionsFrom) : undefined;
    if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
      descriptor.widget = 'select';
      descriptor.options = Object.keys(source);
    }
  }

  if (descriptor.widget === 'group' || descriptor.widget === 'map') {
    const container = descriptor.widget === 'map' ? nodeAt(root, `${path}.*`) : node;
    const templatePath = descriptor.widget === 'map' ? `${path}.*` : path;
    const only = override?.fields;
    const children: FieldDescriptor[] = [];
    for (const key of Object.keys(propertiesOf(container, root))) {
      if (only && !only.includes(key)) continue;
      const child = describeField(root, `${templatePath}.${key}`, {
        values: options.values,
        depth: depth + 1,
      });
      if (child) children.push(child);
    }
    descriptor.children = children;

    if (descriptor.widget === 'map') {
      const keys = node.propertyNames?.enum;
      if (Array.isArray(keys)) descriptor.options = keys.map(String);
      const current = concrete ? valueAt(options.values, path) : undefined;
      if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
        descriptor.rows = Object.entries(current).map(([key, value]) => ({ key, value }));
      }
    }
  }

  return descriptor;
}

function enumOf(node: JsonSchema): readonly string[] | undefined {
  if (Array.isArray(node.enum) && node.enum.every((v) => typeof v === 'string')) {
    return node.enum as string[];
  }
  return undefined;
}

function deriveWidget(node: JsonSchema, root: JsonSchema, depth: number): Widget {
  if (isLocalisable(node)) return 'locale';
  // `string | { …richer shape }` (a logo, a notification address): the form edits the string form,
  // which the schema accepts, and the richer one stays a file edit until a surface needs it.
  const simple = (node.anyOf ?? []).find((branch) => resolveRef(branch, root).type === 'string');
  if (simple) return deriveWidget(resolveRef(simple, root), root, depth);
  const type = Array.isArray(node.type) ? node.type[0] : node.type;
  const strings = enumOf(node);
  if (strings) return strings.length <= RADIO_MAX ? 'radio' : 'select';
  if (type === 'boolean') return 'switch';
  if (type === 'array') {
    const items = typeof node.items === 'object' ? resolveRef(node.items, root) : undefined;
    if (items?.type === 'string') return 'lines';
    // A fixed tuple of strings (an A/B pair) edits the same way: one value per line.
    const tuple = node.prefixItems?.map((entry) => resolveRef(entry, root));
    return tuple?.length && tuple.every((entry) => entry.type === 'string')
      ? 'lines'
      : 'unsupported';
  }
  if (isKeyedMap(node)) return depth >= MAX_DEPTH ? 'unsupported' : 'map';
  if (type === 'object' && node.properties) return depth >= MAX_DEPTH ? 'unsupported' : 'group';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'string') return inputTypeFor(node) as Widget;
  // Any other union has no single control that edits it; the host decides what to show instead.
  return 'unsupported';
}

const isNotice = (item: ProjectionItem): item is NoticeItem =>
  typeof item === 'object' && 'kind' in item;

/**
 * Describe every item of a projection, in order. A path the schema does not know is dropped; the
 * generator's drift test fails on that, so a typo cannot ship quietly, but a form built from a
 * newer or older schema than the projection still renders what it can.
 */
export function resolveProjection(
  root: JsonSchema,
  projection: Projection,
  options: { values?: unknown } = {},
): ProjectedItem[] {
  const out: ProjectedItem[] = [];
  for (const item of projection.items) {
    if (isNotice(item)) {
      out.push({ kind: 'notice', id: item.id });
      continue;
    }
    const spec: PathItem = typeof item === 'string' ? { path: item } : item;
    const { path, ...override } = spec;
    const described = describeField(root, path, { values: options.values, override });
    if (described) out.push(described);
  }
  return out;
}
