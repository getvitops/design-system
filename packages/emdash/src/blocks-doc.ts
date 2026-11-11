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
    'Each block is a Portable Text object: `{ "_type": "vitops_cards", "_key": "<unique>", ...fields }`.',
    'Portable Text blocks are flat — they cannot contain other blocks, and a repeater row holds scalar fields only.',
    'To put blocks inside something, use the section block TYPE (end of this page), whose body is Portable Text.',
    'Give every block a unique `_key`; gallery and carousel derive their element id from it.',
    '',
    '## Colour: `tone` and `color`',
    '',
    'Every block that colours something takes the same two fields. `tone` is a colour role from the',
    "site's `colors.roles` (or a semantic name); an unknown role falls back through its semantic",
    'relatives to `neutral`. `color` is an escape hatch naming a palette hue (`amber`) or hue and step',
    "(`amber-300`) and wins over `tone`; text on a hue solid is the site's `--color-<hue>-<step>-on`,",
    'but contrast is only guaranteed for roles. Renderers emit `--tone-*` custom properties, never a',
    'class built from the value. Rows of `hero.cards`, `cards`, `stats` and `steps` (and `badges.items`)',
    "take their own `tone`/`color`; blank inherits the block's, and a row's colour never reaches its",
    'siblings, so mixed colours need no extra block. Multiline fields that accept links take',
    '`[text](/url)`; hero and section headings accent words wrapped in `*stars*` (coloured by the',
    "`ui-accent` role, or `--accent-color` in the block's `style`). `hero.cards` and `cards` rows also take a",
    '`theme` (a tint or fill of a site colour) so one card can differ from its neighbours.',
    '',
    '## Theme',
    '',
    'Every block carries `theme`: a colour role, tinted (`surface`) or filled (`brand-primary:solid`), applied to',
    "the block's own root with the role's computed readable text. It wins over the block's `tone`.",
    '',
    '## Type size',
    '',
    'Titles use the type roles (`font-heading`, `font-display`, `font-eyebrow`). Every role reads its size',
    "from a custom property, `--<role>-fs` (`--heading-fs`, `--display-fs`), falling back to the role's",
    'configured size, so one block can resize its titles through its `style` field',
    '(`--heading-fs: 1.125rem`) with no site CSS; set it on an ancestor to resize a region. It is inherited,',
    'so it reaches every use of that role inside the block. `style` accepts custom properties only.',
    'Steps, stats and cards also have per-part hooks: `--steps-title-size` (default one step below the',
    'heading role), `--stats-figure-size` and `--card-title-size`.',
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
    '## `vitops_form` needs an endpoint',
    '',
    'The form posts to `/api/track` (the `action` field overrides it), which must be an on-demand route',
    'built with `createConversionRoute()` from `@getvitops/astro/routes`; the emdash template ships one.',
    'Field names are submitted as written, except that `phone` becomes `tel` and a few names the route',
    'reserves (`event`, `website`, `honeypot`, `_honeypot`, `cf-turnstile-response`) are renamed.',
    'It emails `site.notifications.email` and writes `site.crm` when set; with neither, the route refuses',
    'the post rather than accept a message nobody receives. Add the spam check with',
    '`vitops setup turnstile`: once `site.security.turnstile.siteKey` is set the block renders',
    '`<wc-turnstile>`, which loads Cloudflare Turnstile only when the visitor first uses the form',
    '(category `necessary`, so it is not behind the consent banner). The secret lives in the',
    '`VITOPS_TURNSTILE_SECRET` Worker secret, never in `site.json`. Use one form per page.',
    '`vitops emdash check-prerender` warns (fails under `--strict`) when a built page has a form',
    'posting to `/api/track` and `site.json` configures nowhere to deliver it, or lists none of its fields',
    'under `site.templates`.',
    '',
    'A `checkboxes` field ("tick any number") posts one entry per ticked box under the same name; the route',
    'joins them with `", "`. HTML cannot require "at least one", so `required` is not applied to the group.',
    '',
    'The generated privacy policy reads `site.templates` form entries, not this block. Convert the saved',
    'block with `formTemplateFromBlock(block)` from `@getvitops/emdash` and paste the result under',
    '`site.templates` in `site.json`, so the policy lists what the form collects.',
    '',
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
          f.type === 'portableText' ? 'accepts every `vitops_*` block above' : '',
        ].filter(Boolean);
        return `| \`${f.slug}\` | ${f.type} | ${cell(f.label)} | ${cell(notes.join('; '))} |`;
      }),
      '',
    );
  }
  return out.join('\n');
}
