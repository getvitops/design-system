/**
 * The JSON Schema subset `config.schema.json` uses, and the path helpers every form projection
 * shares.
 *
 * Everything under `forms/` takes the schema **as an argument** rather than importing it. The
 * umbrella `Config` lives in `@getvitops/generator`, whose JavaScript entry reaches lightningcss and
 * `node:fs`; a Worker cannot load it. A host hands over `config.schema.json` (imported as JSON in
 * the portal, `configJsonSchema` inside the toolchain), so this module stays free of zod, Node
 * builtins and the token engine.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema | boolean;
  propertyNames?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  items?: JsonSchema | boolean;
  prefixItems?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  default?: unknown;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
}

/** Follow a local `#/$defs/<name>` pointer. The schema never uses any other kind. */
export function resolveRef(node: JsonSchema, root: JsonSchema): JsonSchema {
  if (!node.$ref) return node;
  const name = node.$ref.replace('#/$defs/', '');
  return root.$defs?.[name] ?? {};
}

const objectSchema = (node: JsonSchema | boolean | undefined): JsonSchema | undefined =>
  typeof node === 'object' ? node : undefined;

/**
 * The schema node at a dotted config path (`organization.address.postalCode`), or undefined when
 * the path is not addressable. Descends through `properties` and, for keyed maps, through
 * `additionalProperties`. A segment of `*` means "the value shape of this map", which is how a
 * repeatable row asks for its own field definitions without knowing the tenant's keys.
 *
 * A node that is a `$ref` is followed first, so a path through a shared definition resolves.
 */
export function nodeAt(root: JsonSchema, path: string): JsonSchema | undefined {
  let node: JsonSchema | undefined = root;
  for (const segment of path.split('.')) {
    if (!node) return undefined;
    node = child(resolveRef(node, root), segment, root);
  }
  return node ? resolveRef(node, root) : undefined;
}

/**
 * One step down. A union (`anyOf`) is entered through the first branch that can answer: a palette
 * hue is `{ seed, anchors } | { tones }`, and a path to `seed` must find it without the caller
 * naming a branch.
 */
function child(node: JsonSchema, segment: string, root: JsonSchema): JsonSchema | undefined {
  if (segment === '*') {
    const direct = objectSchema(node.additionalProperties);
    if (direct) return direct;
  } else {
    const own = node.properties?.[segment];
    if (own) return own;
    const extra = objectSchema(node.additionalProperties);
    if (extra) return extra;
  }
  for (const branch of node.anyOf ?? node.oneOf ?? []) {
    const found = child(resolveRef(branch, root), segment, root);
    if (found) return found;
  }
  return undefined;
}

/** True when the node is the generator's `string | { <locale>: string }` shape. */
export function isLocalisable(node: JsonSchema | undefined): boolean {
  if (!node?.anyOf || node.anyOf.length !== 2) return false;
  const [first, second] = node.anyOf;
  const values = objectSchema(second?.additionalProperties);
  return first?.type === 'string' && second?.type === 'object' && values?.type === 'string';
}

/** True when the node is a `{ <key>: <object> }` map rather than a fixed record. */
export function isKeyedMap(node: JsonSchema | undefined): boolean {
  return (
    node?.type === 'object' && !node.properties && typeof node.additionalProperties === 'object'
  );
}

/** Is `path` listed in its parent's `required`? Drives the control's `required` attribute. */
export function isRequired(root: JsonSchema, path: string): boolean {
  const index = path.lastIndexOf('.');
  if (index < 0) return root.required?.includes(path) ?? false;
  const parent = nodeAt(root, path.slice(0, index));
  return parent?.required?.includes(path.slice(index + 1)) ?? false;
}

export type InputType = 'text' | 'email' | 'url' | 'date' | 'number';

/**
 * The `<input type>` for a leaf node. Kept narrow on purpose: `format: "uri"` becomes `type="url"`
 * so a phone keyboard offers the right layout, but nothing here validates. `validateAgainstSchema`
 * does, against the same schema, because a browser's idea of a valid URL is not the contract.
 */
export function inputTypeFor(node: JsonSchema | undefined): InputType {
  if (!node) return 'text';
  if (node.format === 'email') return 'email';
  if (node.format === 'uri') return 'url';
  if (node.format === 'date') return 'date';
  const type = Array.isArray(node.type) ? node.type[0] : node.type;
  if (type === 'number' || type === 'integer') return 'number';
  return 'text';
}

/** Read a dotted path out of a config document. */
export function valueAt(source: unknown, path: string): unknown {
  let node: unknown = source;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** Write a dotted path, creating objects on the way. Refuses prototype-pollution segments. */
export function setPath(target: JsonObject, path: string, value: Json): void {
  const segments = path.split('.');
  if (segments.some((segment) => UNSAFE_SEGMENTS.has(segment))) return;
  let node = target;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) node[segment] = {};
    node = node[segment] as JsonObject;
  }
  node[segments.at(-1)!] = value;
}

/**
 * A schema containing only `paths`. Used to validate the part of a document a form edits, so a
 * required field elsewhere in the document is not reported against a form that never shows it.
 *
 * Each picked leaf is copied whole. Each ancestor keeps its own constraints (`type`,
 * `additionalProperties`, `propertyNames`) but only the picked properties, and its `required` list
 * is cut to those, because requiring a property the schema no longer lists would make every
 * document invalid. `$defs` rides along so a picked `$ref` still resolves.
 */
export function pickSchema(root: JsonSchema, paths: readonly string[]): JsonSchema {
  const out: JsonSchema = { type: 'object', additionalProperties: false };
  if (root.$defs) out.$defs = root.$defs;

  for (const path of paths) {
    const segments = path.split('.');
    let from: JsonSchema | undefined = root;
    let to: JsonSchema = out;
    for (let i = 0; i < segments.length; i++) {
      if (!from) break;
      const segment = segments[i]!;
      from = branchFor(resolveRef(from, root), segment, root);
      const last = i === segments.length - 1;

      if (segment === '*') {
        const source = objectSchema(from.additionalProperties);
        if (!source) break;
        if (last) {
          to.additionalProperties = source;
          break;
        }
        const existing = objectSchema(to.additionalProperties);
        const copy: JsonSchema = existing ?? shell(source);
        to.additionalProperties = copy;
        to = copy;
        from = source;
        continue;
      }

      // A segment that is not a declared property names a key of a map (`themes.default`), so it is
      // picked as that key, carrying the map's value schema.
      const source = from.properties?.[segment] ?? objectSchema(from.additionalProperties);
      if (!source) break;
      to.properties ??= {};
      if (last) {
        to.properties[segment] = source;
      } else {
        const copy = to.properties[segment] ?? shell(resolveRef(source, root));
        to.properties[segment] = copy;
        to = copy;
      }
      from = source;
    }
  }

  // Required lists: keep an ancestor's entry only for properties that survived the pick.
  const trim = (node: JsonSchema, original: JsonSchema | undefined): void => {
    const source = original ? resolveRef(original, root) : undefined;
    if (node.properties && source?.required) {
      const kept = source.required.filter((key) => key in node.properties!);
      if (kept.length) node.required = kept;
    }
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      trim(child, source?.properties?.[key] ?? objectSchema(source?.additionalProperties));
    }
    const extra = objectSchema(node.additionalProperties);
    if (extra) trim(extra, objectSchema(source?.additionalProperties));
  };
  trim(out, root);
  return out;
}

/** The node (or the union branch of it) that owns `segment`, so a pick can walk through a union. */
function branchFor(node: JsonSchema, segment: string, root: JsonSchema): JsonSchema {
  if (node.properties?.[segment] || typeof node.additionalProperties === 'object') return node;
  for (const branch of node.anyOf ?? node.oneOf ?? []) {
    const resolved = resolveRef(branch, root);
    if (resolved.properties?.[segment] || typeof resolved.additionalProperties === 'object') {
      return resolved;
    }
  }
  return node;
}

/**
 * An object node with the parent's own constraints and nothing picked yet. A map's value schema is
 * dropped (a later `*` segment puts back only what was picked); a boolean `additionalProperties`
 * is a constraint on the node itself and stays.
 */
function shell(source: JsonSchema): JsonSchema {
  const {
    properties: _p,
    required: _r,
    additionalProperties,
    anyOf: _a,
    oneOf: _o,
    ...rest
  } = source;
  return {
    ...rest,
    ...(typeof additionalProperties === 'boolean' ? { additionalProperties } : {}),
  };
}

/**
 * The declared properties of an object node. A union of objects (a palette hue is
 * `{ seed, anchors } | { tones }`) reports the first branch that declares any, which is the one a
 * form edits.
 */
export function propertiesOf(
  node: JsonSchema | undefined,
  root: JsonSchema,
): Record<string, JsonSchema> {
  if (!node) return {};
  const own = resolveRef(node, root);
  if (own.properties) return own.properties;
  for (const branch of own.anyOf ?? own.oneOf ?? []) {
    const found = resolveRef(branch, root).properties;
    if (found) return found;
  }
  return {};
}
