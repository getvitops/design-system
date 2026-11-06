import { BLOCKS, type BlockKitFieldDef, type PortableTextBlockDef } from './blocks.ts';
import { vitopsBlockTypes } from './block-types.ts';

const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function describe(f: BlockKitFieldDef): string {
  const bits: string[] = [];
  if ('options' in f && Array.isArray(f.options) && f.options.length) {
    const values = f.options.map((o) => String((o as { value: unknown }).value));
    bits.push(
      values.length > 8
        ? `one of ${values.length} values (e.g. ${values.slice(0, 4).join(', ')})`
        : `one of ${values.join(', ')}`,
    );
  }
  if ('initial_value' in f && f.initial_value !== undefined) {
    bits.push(`default \`${String(f.initial_value)}\``);
  }
  if (f.type === 'repeater' && 'min_items' in f && f.min_items)
    bits.push(`min ${f.min_items} rows`);
  return bits.join('; ');
}

function fieldRows(fields: BlockKitFieldDef[], prefix = ''): string[] {
  return fields.flatMap((f) => {
    const own = `| \`${prefix}${f.action_id}\` | ${f.type} | ${cell((f as { label?: string }).label)} | ${cell(describe(f))} |`;
    return f.type === 'repeater' ? [own, ...fieldRows(f.fields, `${f.action_id}[].`)] : [own];
  });
}

/**
 * The block reference an agent reads via `vitops docs blocks`: every Portable Text `_type`,
 * its fields and what each saves. Rendered from the same `BLOCKS` the editor menu uses, so
 * it cannot describe a field the editor doesn't offer.
 */
export function renderBlocksDoc(blocks: readonly PortableTextBlockDef[] = BLOCKS): string {
  const out = [
    '---',
    'type: concept',
    'title: EmDash blocks',
    'description: Portable Text block types from @getvitops/emdash, with every field',
    '---',
    '',
    '# EmDash blocks',
    '',
    'Each block is a Portable Text object: `{ "_type": "vitops.cards", "_key": "<unique>", ...fields }`.',
    'Portable Text blocks are flat — they cannot contain other blocks, and a repeater row holds scalar fields only.',
    'To put blocks inside something, use the section block TYPE (end of this page), whose body is Portable Text.',
    'Give every block a unique `_key`; gallery and carousel derive their element id from it.',
    '',
    '## Colour: `tone` and `color`',
    '',
    'Every block that colours something takes the same two fields. `tone` is a colour role from the',
    "site's `colors.roles` (or a semantic name); an unknown role falls back through its semantic",
    'relatives to `neutral`. `color` is an escape hatch naming a palette hue (`amber`) or hue and step',
    '(`amber-300`) and wins over `tone`; its contrast is not checked. Renderers emit `--tone-*` custom',
    'properties, never a class built from the value. Multiline fields that accept links take',
    '`[text](/url)`; hero headings accent words wrapped in `*stars*`.',
    '',
  ];
  for (const b of blocks) {
    out.push(`## \`${b.type}\` — ${b.label}`, '');
    if (b.placeholder) out.push(`${b.placeholder}.`, '');
    if (b.fields?.length) {
      out.push(
        '| Field | Type | Label | Notes |',
        '| --- | --- | --- | --- |',
        ...fieldRows(b.fields),
        '',
      );
    }
  }
  out.push(
    '## Block types (the `blocks` field)',
    '',
    'Schema-level block types, not Portable Text blocks: add them to the seed (`blockTypes: [...vitopsBlockTypes()]`),',
    "allow the slug on the collection's `blocks` field, and render with `blockTypeComponents` from `@getvitops/emdash/astro`.",
    '',
  );
  for (const t of vitopsBlockTypes()) {
    out.push(`### \`${t.slug}\` — ${t.label}`, '', `${t.description ?? ''}`, '');
    const fields = t.versions.find((v) => v.version === t.currentVersion)?.fields ?? [];
    out.push(
      '| Field | Type | Label | Notes |',
      '| --- | --- | --- | --- |',
      ...fields.map((f) => {
        const notes = [
          f.validation?.options ? `one of ${f.validation.options.join(', ')}` : '',
          f.defaultValue !== undefined ? `default \`${String(f.defaultValue)}\`` : '',
          f.type === 'portableText' ? 'accepts every `vitops.*` block above' : '',
        ].filter(Boolean);
        return `| \`${f.slug}\` | ${f.type} | ${cell(f.label)} | ${cell(notes.join('; '))} |`;
      }),
      '',
    );
  }
  return out.join('\n');
}
