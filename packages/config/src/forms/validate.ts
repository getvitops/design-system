/**
 * A JSON Schema walker for exactly the subset `config.schema.json` uses.
 *
 * Messages read as standalone sentences ("Required." not "is required"): they are rendered under
 * the control they belong to, where there is no label to complete.
 *
 * Why not a real validator: ajv compiles schemas with `new Function`, which Cloudflare Workers
 * refuse to evaluate. Why not the generator's own zod schema: its module graph reaches
 * `lightningcss`, `node:fs` and `tailwindcss`. So this walks the published JSON Schema instead, and
 * `unhandledKeywords` is the tripwire that fails the generator's test the day the schema starts
 * using a keyword the walker would silently ignore.
 *
 * This is **field-level** validation. Cross-field rules (a `defaultLocale` that must be a `locales`
 * key, a privacy officer that must name a location) live in `validateConfig` in
 * `@getvitops/generator/config`, which a host runs on the whole document before publishing.
 */
import { nodeAt, resolveRef, type JsonSchema } from './json-schema.ts';

export interface ValidationIssue {
  /** Dotted config path, e.g. `organization.address.postalCode`. */
  path: string;
  message: string;
}

/** Every keyword below is either enforced or deliberately inert (annotations). */
const HANDLED = new Set([
  'type',
  'enum',
  'const',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'properties',
  'required',
  'additionalProperties',
  'propertyNames',
  'items',
  'prefixItems',
  'anyOf',
  'oneOf',
  '$ref',
  '$defs',
  '$id',
  '$schema',
  'description',
  'default',
  'title',
  'examples',
]);

/** Keywords in `schema` that this walker would ignore. Asserted empty by the generator's spec. */
export function unhandledKeywords(schema: JsonSchema): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (!HANDLED.has(key)) found.add(key);
      if (key === 'properties' || key === '$defs') {
        Object.values(value as Record<string, unknown>).forEach(visit);
      } else if (
        key === 'anyOf' ||
        key === 'oneOf' ||
        key === 'prefixItems' ||
        key === 'items' ||
        key === 'additionalProperties' ||
        key === 'propertyNames'
      ) {
        visit(value);
      }
    }
  };
  visit(schema);
  return [...found].sort();
}

const URI = /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$|^mailto:[^\s]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'null':
      return value === null;
    default:
      return typeof value === type;
  }
}

/** Words for a pattern that has no `format` beside it. The regex itself is never shown. */
function patternHint(pattern: string): string {
  if (pattern === '^\\d{4}-\\d{2}-\\d{2}$') return 'Must be a date, as YYYY-MM-DD.';
  return "Isn't in the expected format.";
}

const join = (path: string, key: string): string => (path ? `${path}.${key}` : key);

/**
 * Validate `value` against `schema`. `at` is the dotted path the value lives at, so issues come back
 * with document-relative paths and still land on the right control; `root` is the document schema
 * a `$ref` resolves against (it defaults to `schema`).
 */
export function validateAgainstSchema(
  schema: JsonSchema,
  value: unknown,
  options: { at?: string; root?: JsonSchema } = {},
): ValidationIssue[] {
  return walk(schema, value, options.at ?? '', options.root ?? schema);
}

/**
 * Validate one field's value against the node at `path` in the document schema. This is what a form
 * runs on `input`: no document is needed, and an unknown path is reported rather than passed.
 */
export function validateField(root: JsonSchema, path: string, value: unknown): ValidationIssue[] {
  const node = nodeAt(root, path);
  if (!node) return [{ path, message: 'Not a field this schema allows.' }];
  return walk(node, value, path, root);
}

function walk(
  schema: JsonSchema,
  value: unknown,
  path: string,
  root: JsonSchema,
): ValidationIssue[] {
  const node = resolveRef(schema, root);
  const issues: ValidationIssue[] = [];
  const fail = (message: string): void => {
    issues.push({ path, message });
  };

  const branchesOf = node.anyOf ?? node.oneOf;
  if (branchesOf) {
    // A branch that validates clean wins outright. Reporting every branch's complaints would bury
    // the real one under "expected object" noise for a field the user correctly typed as a string.
    const branches = branchesOf.map((branch) => walk(branch, value, path, root));
    if (branches.some((branch) => branch.length === 0)) return [];
    fail("Doesn't match any shape this field allows.");
    return issues;
  }

  if (node.type) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((type) => typeMatches(value, type))) {
      fail(`Expected ${types.join(' or ')}.`);
      return issues;
    }
  }

  if (node.enum && !node.enum.includes(value)) fail(`Must be one of: ${node.enum.join(', ')}.`);
  if ('const' in node && value !== node.const) fail(`Must be ${String(node.const)}.`);

  if (typeof value === 'string') {
    // A format and a pattern often describe the same thing (`format: email` plus the library's own
    // regex). Say it once, in words: a visitor is never shown a regular expression.
    const formatMessage =
      node.format === 'uri'
        ? 'Must be a full URL, including https://'
        : node.format === 'email'
          ? 'Must be an email address.'
          : node.format === 'date'
            ? 'Must be a date, as YYYY-MM-DD.'
            : undefined;
    const formatOk =
      node.format === 'uri'
        ? URI.test(value)
        : node.format === 'email'
          ? EMAIL.test(value)
          : node.format === 'date'
            ? DATE.test(value)
            : true;
    const patternOk = !node.pattern || new RegExp(node.pattern).test(value);
    if (!formatOk) fail(formatMessage!);
    else if (!patternOk) fail(formatMessage ?? patternHint(node.pattern!));
    if (node.minLength !== undefined && value.length < node.minLength) {
      fail(node.minLength === 1 ? 'Required.' : `Must be at least ${node.minLength} characters.`);
    }
    if (node.maxLength !== undefined && value.length > node.maxLength) {
      fail(`Must be at most ${node.maxLength} characters.`);
    }
  }

  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum)
      fail(`Must be at least ${node.minimum}.`);
    if (node.maximum !== undefined && value > node.maximum)
      fail(`Must be at most ${node.maximum}.`);
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) {
      fail(`Must be greater than ${node.exclusiveMinimum}.`);
    }
    if (node.exclusiveMaximum !== undefined && value >= node.exclusiveMaximum) {
      fail(`Must be less than ${node.exclusiveMaximum}.`);
    }
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) {
      fail(`Needs at least ${node.minItems} ${node.minItems === 1 ? 'item' : 'items'}.`);
    }
    if (node.maxItems !== undefined && value.length > node.maxItems) {
      fail(`Allows at most ${node.maxItems} ${node.maxItems === 1 ? 'item' : 'items'}.`);
    }
    const prefix = node.prefixItems ?? [];
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      const own = prefix[index];
      if (own) {
        issues.push(...walk(own, item, itemPath, root));
      } else if (node.items === false) {
        issues.push({ path: itemPath, message: 'Not allowed here.' });
      } else if (typeof node.items === 'object') {
        issues.push(...walk(node.items, item, itemPath, root));
      }
    });
  }

  if (typeMatches(value, 'object')) {
    const record = value as Record<string, unknown>;
    for (const key of node.required ?? []) {
      if (record[key] === undefined) issues.push({ path: join(path, key), message: 'Required.' });
    }
    for (const [key, child] of Object.entries(record)) {
      if (node.propertyNames) issues.push(...walk(node.propertyNames, key, join(path, key), root));
      const childSchema =
        node.properties?.[key] ??
        (typeof node.additionalProperties === 'object' ? node.additionalProperties : undefined);
      if (!childSchema) {
        if (node.additionalProperties === false) {
          issues.push({ path: join(path, key), message: 'Not a field this schema allows.' });
        }
        continue;
      }
      issues.push(...walk(childSchema, child, join(path, key), root));
    }
  }

  return issues;
}
