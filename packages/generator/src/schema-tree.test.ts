import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown, schemaTreeNodes, type JsonSchemaNode } from './docs.ts';
import { configJsonSchema } from './config.ts';
import { jsonSchema } from './schema.ts';

const config = () => schemaTreeNodes(configJsonSchema as unknown as JsonSchemaNode);
const ds = () => schemaTreeNodes(jsonSchema as unknown as JsonSchemaNode);

/** Depth-first flatten, so assertions can talk about the whole tree. */
function flatten(nodes: ReturnType<typeof config>): ReturnType<typeof config> {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
const find = (path: string) => flatten(config()).find((n) => n.id === path);

describe('schemaTreeNodes', () => {
  it('returns the three config sections at the root', () => {
    expect(config().map((n) => n.label)).toEqual(['designSystem', 'organization', 'site']);
  });

  /**
   * The three sections are what everything else links to, so their ids are a
   * contract, not an implementation detail — cross-links from the docs bundle land
   * on `#designSystem`.
   */
  it('gives each top-level section an id equal to its name', () => {
    for (const node of config()) expect(node.id).toBe(node.label);
  });

  it('marks the required top-level keys', () => {
    // `designSystem` is also the discriminator that tells a Config from a bare
    // design system; `organization` is the only optional section.
    expect(
      config()
        .filter((n) => n.required)
        .map((n) => n.label),
    ).toEqual(['designSystem', 'site']);
  });

  /**
   * Duplicate ids are invalid HTML and silent: `getElementById` returns the first,
   * so a deep link lands on the wrong node with no error. Map pseudo-labels and
   * `anyOf` branches both used to produce them.
   */
  it('never repeats an id', () => {
    for (const nodes of [config(), ds()]) {
      const all = flatten(nodes).flatMap((n) => (n.id ? [n.id] : []));
      expect(all.length).toBeGreaterThan(50);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('gives fields dotted paths that read like a config path', () => {
    for (const path of [
      'site.analytics.clarityId',
      'site.tracking.category',
      'site.searchConsole.delegatedOwners',
      'site.seo.indexing.searchConsole.siteUrl',
    ])
      expect(find(path), `missing ${path}`).toBeDefined();
  });

  /** `<name>` / `[items]` are not keys, so they carry no id — but the path threads on. */
  it('leaves a map or array pseudo-node unaddressable', () => {
    const pseudo = flatten(config()).filter((n) => n.label === '<name>' || n.label === '[items]');
    expect(pseudo.length).toBeGreaterThan(0);
    for (const n of pseudo) expect(n.id).toBeUndefined();
    // The path continues through them, or a map's fields would be unreachable.
    expect(find('site.searchConsole.delegatedOwners')).toBeDefined();
  });

  /**
   * A union whose branches are objects must stay explorable. Flattened to a leaf,
   * `notifications.email`'s object fields are simply absent — and absent content in
   * a reference is indistinguishable from content that does not exist.
   */
  it('exposes anyOf branches as unnamed groups with their fields', () => {
    const email = find('site.notifications.email');
    expect(email).toBeDefined();
    expect(email!.children.length).toBeGreaterThan(0);
    expect(email!.children.every((c) => c.variant)).toBe(true);
    const fields = email!.children.flatMap((c) => c.children.map((f) => f.label));
    for (const f of ['provider', 'to', 'from', 'fromName', 'replyTo', 'binding'])
      expect(fields).toContain(f);
  });

  it('carries descriptions through verbatim, not pre-rendered', () => {
    // Raw schema text — escaping and inline markdown are the renderer's job.
    expect(find('site.tracking.category')!.description).toContain('`marketing`');
  });

  it('respects idPrefix so two trees can share a page', () => {
    const nodes = schemaTreeNodes(configJsonSchema as unknown as JsonSchemaNode, {
      idPrefix: 'cfg',
    });
    expect(nodes.map((n) => n.id)).toEqual(['cfg.designSystem', 'cfg.organization', 'cfg.site']);
  });

  it('caps depth when asked', () => {
    const shallow = schemaTreeNodes(configJsonSchema as unknown as JsonSchemaNode, { maxDepth: 1 });
    expect(shallow[0]!.children.length).toBeGreaterThan(0);
    expect(shallow[0]!.children.every((c) => c.children.length === 0)).toBe(true);
  });

  it('is deterministic', () => {
    expect(config()).toEqual(config());
  });
});

describe('renderInlineMarkdown', () => {
  /**
   * Escaping must happen BEFORE the inline pass, or a description closes a tag and
   * silently eats the rest of the tree. Several schema descriptions contain angle
   * brackets (`<canonical>/<key>.txt`).
   */
  it('escapes first, then renders the closed subset', () => {
    const out = renderInlineMarkdown('Break <script>x</script> & use `code` and **bold**.');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('<code>code</code>');
    expect(out).toContain('<strong>bold</strong>');
  });

  it('escapes a quote, since the result may land in an attribute', () => {
    expect(renderInlineMarkdown('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('renders real schema text containing angle brackets', () => {
    const out = renderInlineMarkdown('Defaults to `<canonical>/<key>.txt`.');
    expect(out).toBe('Defaults to <code>&lt;canonical&gt;/&lt;key&gt;.txt</code>.');
  });

  /** The schema uses it; omitting it printed the asterisks on the page. */
  it('renders single-asterisk emphasis', () => {
    expect(renderInlineMarkdown('a *presentation* of the organization')).toBe(
      'a <em>presentation</em> of the organization',
    );
    expect(renderInlineMarkdown('**bold** and *thin*')).toBe(
      '<strong>bold</strong> and <em>thin</em>',
    );
  });

  /**
   * The reason code spans are lifted before emphasis runs. `colors.utilities`
   * describes its families as literal asterisk wildcards; pairing them as emphasis
   * eats both asterisks and italicises the text between two unrelated utilities,
   * leaving prose that names families that don't exist.
   */
  it('never reads an asterisk inside a code span as emphasis', () => {
    const out = renderInlineMarkdown('Targets `bg-*`, `text-*`, `border-*` families.');
    expect(out).toBe(
      'Targets <code>bg-*</code>, <code>text-*</code>, <code>border-*</code> families.',
    );
    expect(out).not.toContain('<em>');
  });

  it('handles emphasis and code wildcards in the same string', () => {
    const out = renderInlineMarkdown('The *target* is `bg-*` or `text-*`.');
    expect(out).toBe('The <em>target</em> is <code>bg-*</code> or <code>text-*</code>.');
  });

  it('leaves the real colors.utilities description intact', () => {
    const desc = (
      flatten(schemaTreeNodes(jsonSchema as unknown as JsonSchemaNode)).find(
        (n) => n.label === 'utilities',
      )?.description ?? ''
    ).toString();
    const out = renderInlineMarkdown(desc);
    // Every wildcard family survives as code, and nothing became emphasis.
    for (const fam of ['bg-*', 'text-*', 'border-*'])
      expect(out, `lost ${fam}`).toContain(`<code>${fam}</code>`);
    expect(out).not.toContain('<em>');
  });
});
