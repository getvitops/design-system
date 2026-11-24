/**
 * Check the `vitops_*` blocks inside a seed (or any content export) against the definitions this
 * package ships.
 *
 * EmDash's own `validateSeed` knows the collections but not this plugin's blocks, so a typo'd
 * field name (`primaryLabl`) or an empty gallery `src` passes it and then renders nothing, with no
 * warning. This reads `BLOCKS` and `SECTION_FIELDS`, the same lists the renderers and the admin
 * forms are built from, so it cannot disagree with them.
 *
 * Pure: it takes the parsed JSON and returns problems. `vitops emdash check-seed` is the CLI.
 */
import { BLOCKS } from './blocks.ts';
import type { BlockKitFieldDef } from './blocks.ts';
import { SECTION_FIELDS, SECTION_SLUG } from './block-types.ts';

export interface SeedProblem {
  /** `error` renders wrong or not at all; `warn` is probably a mistake. */
  level: 'error' | 'warn';
  /** Where it is, e.g. `content.pages[0].data.content[2].items[1]`. */
  path: string;
  message: string;
}

const META = new Set(['_type', '_key', '_version']);

interface Shape {
  fields: Map<string, BlockKitFieldDef | undefined>;
}

const shapes = new Map<string, Shape>([
  [
    SECTION_SLUG,
    { fields: new Map(SECTION_FIELDS.map((f) => [f.slug, undefined] as [string, undefined])) },
  ],
  ...BLOCKS.map(
    (b) =>
      [b.type, { fields: new Map((b.fields ?? []).map((f) => [f.action_id, f])) }] as [
        string,
        Shape,
      ],
  ),
]);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** ` (did you mean "x"?)` for the closest candidate within a couple of edits, else nothing. */
function suggest(name: string, candidates: Iterable<string>): string {
  let best: string | undefined;
  let bestDistance = 3;
  for (const c of candidates) {
    const d = distance(name.toLowerCase(), c.toLowerCase());
    if (d < bestDistance) [best, bestDistance] = [c, d];
  }
  return best ? ` (did you mean "${best}"?)` : '';
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const empty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function checkBlock(
  block: Record<string, unknown>,
  type: string,
  shape: Shape,
  path: string,
  out: SeedProblem[],
) {
  for (const key of Object.keys(block)) {
    if (META.has(key) || shape.fields.has(key)) continue;
    out.push({
      level: 'error',
      path,
      message: `${type} has no field "${key}"${suggest(key, shape.fields.keys())}; it is ignored`,
    });
  }
  for (const [name, def] of shape.fields) {
    const value = block[name];
    if (!def) continue;
    if (def.type === 'select' && typeof value === 'string' && value !== '') {
      const allowed = def.options.map((o) => o.value);
      const dynamic = 'optionsRoute' in def && Boolean(def.optionsRoute);
      if (!dynamic && !allowed.includes(value))
        out.push({
          level: 'warn',
          path,
          message: `${type}.${name} is "${value}", which is not one of: ${allowed.join(', ')}`,
        });
    }
    if (def.type === 'repeater') {
      const rows = Array.isArray(value) ? value : [];
      if (value !== undefined && !Array.isArray(value))
        out.push({ level: 'error', path, message: `${type}.${name} must be a list of rows` });
      if ((def.min_items ?? 0) > rows.length && block[name] !== undefined)
        out.push({
          level: 'warn',
          path,
          message: `${type}.${name} needs at least ${def.min_items} row${def.min_items === 1 ? '' : 's'}`,
        });
      const sub = new Map(def.fields.map((f) => [f.action_id, f]));
      rows.forEach((row, i) => {
        const rowPath = `${path}.${name}[${i}]`;
        if (!isObject(row)) {
          out.push({ level: 'error', path: rowPath, message: 'a row must be an object' });
          return;
        }
        for (const key of Object.keys(row))
          if (!sub.has(key) && !META.has(key))
            out.push({
              level: 'error',
              path: rowPath,
              message: `${type}.${name} rows have no field "${key}"${suggest(key, sub.keys())}; it is ignored`,
            });
        if ([...sub.keys()].every((k) => empty(row[k])))
          out.push({ level: 'warn', path: rowPath, message: `${type}.${name} row is empty` });
        // A gallery image with no source renders nothing, and nothing else says so. A warning, not
        // an error: a seed written before the photos exist leaves these empty on purpose.
        if (type === 'vitops_gallery' && name === 'images' && empty(row.src))
          out.push({
            level: 'warn',
            path: rowPath,
            message: 'vitops_gallery image has no src, so it renders nothing',
          });
      });
    }
  }
}

function walk(value: unknown, path: string, out: SeedProblem[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  if (!isObject(value)) return;
  const type = value._type;
  if (typeof type === 'string' && type.startsWith('vitops_')) {
    const shape = shapes.get(type);
    if (!shape)
      out.push({
        level: 'error',
        path,
        message: `unknown block type "${type}"${suggest(type, shapes.keys())}; nothing renders it`,
      });
    else checkBlock(value, type, shape, path, out);
  }
  for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, out);
}

/** Every problem with a `vitops_*` block anywhere in `seed`, in document order. */
export function checkSeedBlocks(seed: unknown): SeedProblem[] {
  const out: SeedProblem[] = [];
  walk(seed, '', out);
  return out;
}
