/**
 * `vitops_band`: a section inside a `portableText` field.
 *
 * Portable Text is a flat list, and Block Kit fields cannot hold other blocks, so a band cannot
 * contain its content. It is a **marker** instead: it opens a band, and everything after it up to
 * the next band is that band's body. `groupBands()` does the grouping and `<VitopsContent>`
 * renders it through the same `Section` a `blocks` field uses, so both paths look identical.
 * With no `<VitopsContent>` the marker renders only its own head, and the content that follows
 * stays flat after it: a degrade, not a break.
 */

export const BAND_TYPE = 'vitops_band';

interface Block {
  _type?: string;
  [key: string]: unknown;
}

/** A run of ordinary blocks, or a band marker with the blocks that follow it. */
export type BandGroup =
  | { kind: 'blocks'; blocks: Block[] }
  | { kind: 'band'; band: Block; body: Block[] };

export function groupBands(content: unknown): BandGroup[] {
  const blocks = Array.isArray(content) ? (content as Block[]) : [];
  const groups: BandGroup[] = [];
  for (const block of blocks) {
    if (block?._type === BAND_TYPE) {
      groups.push({ kind: 'band', band: block, body: [] });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === 'band') last.body.push(block);
    else if (last?.kind === 'blocks') last.blocks.push(block);
    else groups.push({ kind: 'blocks', blocks: [block] });
  }
  return groups;
}

/**
 * A band marker's fields as the `vitops_section` block type reads them. The marker uses the
 * hero's camelCase names (`primaryLabel`); a block TYPE's slugs must be lowercase snake_case.
 */
export function bandToSection(band: Block, body: Block[]): Record<string, unknown> {
  const { primaryLabel, primaryHref, secondaryLabel, secondaryHref, ...rest } = band;
  return {
    ...rest,
    cta_label: primaryLabel,
    cta_href: primaryHref,
    secondary_label: secondaryLabel,
    secondary_href: secondaryHref,
    body,
  };
}
