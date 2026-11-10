import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };
import { TIERS } from '@getvitops/generator';
import { BLOCKS, selectBlocks } from './blocks.ts';
import { SECTION_FIELDS, vitopsBlockTypes } from './block-types.ts';
import { SEMANTIC_TONES } from './astro/blocks/tone.ts';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';
import { createPlugin, vitopsEmdash } from './index.ts';

/**
 * Block type → component file, derived from the `blockComponents` map in `astro/index.ts`
 * rather than listed here, so a block wired to the wrong component (or not wired) fails.
 */
async function componentFilesFromIndex(): Promise<Record<string, string>> {
  const source = await readFile(new URL('./astro/index.ts', import.meta.url), 'utf8');
  const imports = Object.fromEntries(
    [...source.matchAll(/import (\w+) from '\.\/(blocks\/[\w.]+\.astro)'/g)].map((m) => [
      m[1]!,
      `src/astro/${m[2]}`,
    ]),
  );
  return Object.fromEntries(
    [...source.matchAll(/['"]?(vitops_\w+)['"]?:\s*(\w+)/g)]
      .filter((m) => m[1] !== 'vitops_section') // a block TYPE (`blockTypeComponents`), not a Portable Text block
      .map((m) => [m[1]!, imports[m[2]!] ?? '']),
  );
}

/** Component source with comments removed, so a docblock naming a field can't satisfy a check. */
async function codeOf(file: string): Promise<string> {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const componentFiles = await componentFilesFromIndex();

/** Every `action_id` a block saves, including the sub-fields of a repeater's rows. */
function actionIds(fields: NonNullable<(typeof BLOCKS)[number]['fields']>): string[] {
  return fields.flatMap((f) => [
    f.action_id,
    ...(f.type === 'repeater' ? f.fields.map((sub) => sub.action_id) : []),
  ]);
}

describe('descriptor + runtime', () => {
  it('descriptor version matches package.json', () => {
    expect(vitopsEmdash().version).toBe(pkg.version);
  });

  it('descriptor points at the package entrypoints', () => {
    const descriptor = vitopsEmdash();
    expect(descriptor.id).toBe('vitops');
    expect(descriptor.format).toBe('native');
    expect(descriptor.entrypoint).toBe(pkg.name);
    expect(descriptor.componentsEntry).toBe(`${pkg.name}/astro`);
  });

  it('default scripts mode declares no capabilities and no hooks', () => {
    expect(vitopsEmdash().capabilities).toEqual([]);
    const plugin = createPlugin() as unknown as { hooks?: Record<string, unknown> };
    expect(Object.keys(plugin.hooks ?? {})).toEqual([]);
  });

  it('fragments mode declares the page-fragments capability and hook', () => {
    expect(vitopsEmdash({ scripts: 'fragments' }).capabilities).toEqual([
      'hooks.page-fragments:register',
    ]);
    const plugin = createPlugin({ scripts: 'fragments' }) as unknown as {
      hooks?: Record<string, unknown>;
    };
    expect(Object.keys(plugin.hooks ?? {})).toEqual(['page:fragments']);
  });

  it('fragments hook emits the wcBase script tags', async () => {
    type Hook = (() => Promise<unknown>) & { handler?: () => Promise<unknown> };
    const plugin = createPlugin({ scripts: 'fragments', wcBase: '/assets/wc' }) as unknown as {
      hooks: { 'page:fragments': Hook };
    };
    // definePlugin normalizes hooks to { handler, pluginId } config objects.
    const hook = plugin.hooks['page:fragments'];
    const fragments = await (hook.handler ?? hook)();
    expect(JSON.stringify(fragments)).toContain('/assets/wc/polyfills.js');
    expect(JSON.stringify(fragments)).toContain('/assets/wc/elements.js');
    expect(JSON.stringify(fragments)).toContain('/assets/wc/deferred.js');
  });
});

describe('block ↔ component agreement', () => {
  it('every declared block has a rendering component, and the file exists', async () => {
    expect(Object.keys(componentFiles).sort()).toEqual(BLOCKS.map((b) => b.type).sort());
    for (const file of Object.values(componentFiles)) {
      await expect(readFile(new URL(`../${file}`, import.meta.url), 'utf8')).resolves.toBeTruthy();
    }
  });

  it.each(BLOCKS.map((b) => [b.type, b] as const))(
    '%s: every field action_id is consumed by its component',
    async (type, block) => {
      const source = await codeOf(componentFiles[type]!);
      for (const id of actionIds(block.fields ?? [])) {
        // The escape hatches are applied by rootAttrs in each renderer (see the test below).
        if (COMMON.has(id)) continue;
        expect(source, `${componentFiles[type]} missing field '${id}'`).toMatch(
          new RegExp(`\\b${id}\\b`),
        );
      }
    },
  );

  it.each(BLOCKS.map((b) => b.type))(
    '%s applies its escape hatches to its own root',
    async (type) => {
      // One rule for every block: id/class/style go on the outermost element it renders, via
      // rootAttrs — never an extra wrapper node, so the DOM shape does not depend on the fields set.
      const source = await codeOf(componentFiles[type]!);
      expect(source).toContain('rootAttrs(');
      expect(source).not.toContain('BlockShell');
    },
  );

  it('the astro componentsEntry maps exactly the declared block types', async () => {
    const source = await readFile(new URL('./astro/index.ts', import.meta.url), 'utf8');
    for (const block of BLOCKS) {
      expect(source).toMatch(new RegExp(`\\b${block.type}\\b\\s*:`));
    }
  });
});

/** Field ids every block carries and `rootAttrs` applies (see `astro/blocks/attrs.ts`). */
const COMMON = new Set(['anchor', 'className', 'class_name', 'style', 'theme']);

describe('blocks ↔ the TIERS manifest', () => {
  // The generator cannot import this package (this one imports it), so the check that
  // blocks and the manifest agree runs from here, where both are visible.
  const entries = Object.entries(TIERS);
  const claimed = (type: string) => entries.filter(([, e]) => e.emdash?.includes(type));

  it.each(BLOCKS.map((b) => b.type))('%s is claimed by at least one TIERS pattern', (type) => {
    expect(
      claimed(type).map(([name]) => name),
      `no TIERS entry lists '${type}'`,
    ).not.toEqual([]);
  });

  it('a block TYPE (block-types.ts) is claimed too, under its slug', () => {
    for (const { slug } of vitopsBlockTypes())
      expect(
        claimed(slug).map(([name]) => name),
        `no TIERS entry lists '${slug}'`,
      ).not.toEqual([]);
  });

  it('TIERS lists no block this package does not define', () => {
    const defined = new Set([
      ...BLOCKS.map((b) => b.type),
      ...vitopsBlockTypes().map((t) => t.slug),
    ]);
    const phantom = entries.flatMap(([name, e]) =>
      (e.emdash ?? []).filter((t) => !defined.has(t)).map((t) => `${name}: ${t}`),
    );
    expect(phantom).toEqual([]);
  });

  it.each(BLOCKS.map((b) => b.type))(
    '%s renders through the pattern it is listed under',
    async (type) => {
      const source = await codeOf(componentFiles[type]!);
      // The adapter must reach its pattern by something the manifest names: the Astro
      // component it wraps, the web component's tag, or one of the pattern's classes.
      // A block that hand-writes unrelated markup would fail all three.
      const markers = (e: (typeof TIERS)[string]): string[] => [
        ...(e.astro ?? []).map((a) => a.component.split('/').pop()!),
        ...(e.wc ? [e.wc.tag] : []),
        ...e.css.classes.map((c) => `class="${c}`),
        ...e.css.classes.filter((c) => !c.includes('__')),
      ];
      const reachable = claimed(type).some(([, e]) => markers(e).some((m) => source.includes(m)));
      expect(reachable, `${componentFiles[type]} references none of its pattern's markers`).toBe(
        true,
      );
    },
  );
});

describe('semantic icon options', () => {
  it('offers exactly the semantic vocabulary the sprite is built from', async () => {
    // These are now DERIVED from @getvitops/utils rather than copied from it,
    // so this can no longer go stale — it asserts the derivation, and that the
    // reference collection is `fa7` (every semantic name is defined there; the
    // other sets are alternate resolutions of the same names). An editor may
    // only pick a name the sprite will actually carry an `icon-<name>` alias
    // for, or the block renders an empty box with no error anywhere.
    const { iconMap } = await import('@getvitops/utils');
    expect(SEMANTIC_ICON_OPTIONS.map((o) => o.value)).toEqual(Object.keys(iconMap.fa7).sort());
  });

  it('uses the value as its own label, so the two cannot drift', () => {
    expect(SEMANTIC_ICON_OPTIONS.every((o) => o.label === o.value)).toBe(true);
  });

  it('is what the actionLink icon fields offer', () => {
    const block = BLOCKS.find((b) => b.type === 'vitops_actionLink');
    const combos = (block?.fields ?? []).filter((f) => f.type === 'combobox');
    expect(combos.map((f) => f.action_id)).toEqual(['startIcon', 'endIcon']);
    for (const f of combos)
      expect((f as { options: unknown[] }).options).toBe(SEMANTIC_ICON_OPTIONS);
  });
});

describe('vitops_section block type', () => {
  const [section] = vitopsBlockTypes();

  it('is a valid block-type slug (no dot) and versioned from 1', () => {
    expect(section!.slug).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(section!.currentVersion).toBe(1);
    expect(section!.versions.map((v) => v.version)).toEqual([1]);
  });

  it('has a Portable Text body — the reason it is a block type, not a Portable Text block', () => {
    expect(SECTION_FIELDS.find((f) => f.slug === 'body')?.type).toBe('portableText');
  });

  it('every select declares its options, as the schema requires', () => {
    for (const f of SECTION_FIELDS.filter((x) => x.type === 'select'))
      expect(f.validation?.options?.length, f.slug).toBeGreaterThan(0);
  });

  it('every field slug is consumed by Section.astro, and it renders the body through <PortableText>', async () => {
    const source = await codeOf('src/astro/blocks/Section.astro');
    for (const f of SECTION_FIELDS.filter((x) => !COMMON.has(x.slug)))
      expect(source, `Section.astro missing '${f.slug}'`).toMatch(new RegExp(`\\b${f.slug}\\b`));
    expect(source).toContain('<PortableText value={body}');
  });

  it('is exported from the componentsEntry under its slug', async () => {
    const source = await readFile(new URL('./astro/index.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/blockTypeComponents[\s\S]*vitops_section: Section/);
  });
});

describe('the shared tone convention', () => {
  // `vitops_banner` keeps its original four-value `tone` (non-breaking), so it is the one
  // block with a `tone` field that is not on the shared convention.
  const colouring = BLOCKS.filter(
    (b) => b.type !== 'vitops_banner' && b.fields?.some((f) => f.action_id === 'tone'),
  );

  it('every block that offers a tone offers the color escape hatch beside it', () => {
    expect(colouring.map((b) => b.type)).toEqual(
      expect.arrayContaining([
        'vitops_hero',
        'vitops_cards',
        'vitops_steps',
        'vitops_stats',
        'vitops_callout',
      ]),
    );
    for (const b of colouring)
      expect(
        b.fields!.some((f) => f.action_id === 'color'),
        b.type,
      ).toBe(true);
  });

  it('the tone select asks the plugin route for the site roles and keeps a static fallback', () => {
    for (const b of colouring) {
      const tone = b.fields!.find((f) => f.action_id === 'tone') as unknown as {
        options: { value: string }[];
        optionsRoute: string;
      };
      expect(tone.optionsRoute, b.type).toBe('tones/list');
      expect(tone.options.map((o) => o.value)).toEqual(['', ...SEMANTIC_TONES]);
    }
  });

  it('components resolve tone through resolveTone, never a class built from the value', async () => {
    for (const b of colouring) {
      const source = await codeOf(componentFiles[b.type]!);
      expect(source, b.type).toContain('resolveTone(');
      expect(source, b.type).not.toMatch(/bg-\$\{|text-\$\{/);
    }
  });

  it('the legacy banner tone and actionLink role values keep working', () => {
    const banner = BLOCKS.find((b) => b.type === 'vitops_banner')!;
    const tone = banner.fields!.find((f) => f.action_id === 'tone') as {
      options: { value: string }[];
    };
    expect(tone.options.map((o) => o.value)).toEqual(['info', 'success', 'warning', 'danger']);
  });

  it('the plugin serves the roles at tones/list: stated, with the semantic names kept', async () => {
    const plugin = createPlugin({ tones: ['brand-primary', 'danger'] }) as unknown as {
      routes: Record<string, { handler: (ctx: unknown) => Promise<{ items: { id: string }[] }> }>;
    };
    const { items } = await plugin.routes['tones/list']!.handler({});
    expect(items.map((i) => i.id)).toEqual([
      '',
      'brand-primary',
      'danger',
      ...SEMANTIC_TONES.filter((t) => t !== 'danger'),
    ]);
  });
});

describe('cards (U19) and hero extensions', () => {
  it('a card title is a real heading with a level, not <p class="font-heading">', async () => {
    const source = await codeOf('src/astro/blocks/Cards.astro');
    expect(source).toContain('<Heading class="card__title font-heading"');
    expect(source).not.toMatch(/<p class="font-heading"/);
    const cards = BLOCKS.find((b) => b.type === 'vitops_cards')!;
    expect(cards.fields!.some((f) => f.action_id === 'level')).toBe(true);
  });
});

describe('vitops_reviews', () => {
  it('reads the cache as a build-time import and chooses with the shared selectReviews', async () => {
    const source = await codeOf('src/astro/blocks/Reviews.astro');
    expect(source).toContain("from 'virtual:getvitops/reviews'");
    expect(source).toContain('selectReviews(');
    // The Worker-safe subpath, never the root entry (its graph reaches node:fs).
    expect(source).toContain("'@getvitops/utils/reviews/select'");
    expect(source).not.toMatch(/@getvitops\/utils\/reviews'/);
    expect(source).not.toMatch(/node:fs|readFileSync|readCache/);
  });

  it('keeps privacy-sensitive options off by default and offers no JSON-LD switch', () => {
    const block = BLOCKS.find((b) => b.type === 'vitops_reviews')!;
    const field = (id: string) => block.fields!.find((f) => f.action_id === id)!;
    expect((field('avatars') as { initial_value: boolean }).initial_value).toBe(false);
    expect(block.fields!.some((f) => /schema|jsonld/i.test(f.action_id))).toBe(false);
  });
});

describe('vitops_nav', () => {
  it('asks the plugin for the site menus and keeps a static fallback', () => {
    const block = BLOCKS.find((b) => b.type === 'vitops_nav')!;
    const menu = block.fields!.find((f) => f.action_id === 'menu') as unknown as {
      options: { value: string }[];
      optionsRoute: string;
    };
    expect(menu.optionsRoute).toBe('menus/list');
    expect(menu.options.length).toBeGreaterThan(0);
  });

  it('the plugin registers the menus/list route', () => {
    const plugin = createPlugin() as unknown as { routes: Record<string, unknown> };
    expect(Object.keys(plugin.routes)).toContain('menus/list');
  });

  it('reuses the header nav helpers instead of copying them', async () => {
    const source = await codeOf('src/astro/blocks/Nav.astro');
    expect(source).toContain("'@getvitops/astro/components/sitenav.ts'");
    expect(source).toContain('trimDepth(');
    const tree = await codeOf('src/astro/blocks/NavTree.astro');
    expect(tree).toContain('isCurrent(');
    expect(tree).toContain('aria-current');
  });
});

describe('selectBlocks', () => {
  const types = (blocks: { type: string }[]) => blocks.map((b) => b.type);

  it('offers every block by default', () => {
    expect(types(selectBlocks())).toEqual(types(BLOCKS));
  });

  it('include is an allowlist, in the library order', () => {
    expect(types(selectBlocks({ include: ['vitops_cards', 'vitops_banner'] }))).toEqual([
      'vitops_banner',
      'vitops_cards',
    ]);
  });

  it('exclude drops blocks, and wins over include', () => {
    const out = types(
      selectBlocks({ include: ['vitops_cards', 'vitops_banner'], exclude: ['vitops_cards'] }),
    );
    expect(out).toEqual(['vitops_banner']);
  });

  it('throws on an unknown name rather than offering nothing', () => {
    expect(() => selectBlocks({ include: ['vitops.cardz'] })).toThrow(
      /unknown block 'vitops.cardz'/,
    );
    expect(() => selectBlocks({ exclude: ['nope'] })).toThrow(/blocks.exclude/);
  });

  it("appends the site's own blocks and refuses a colliding type", () => {
    const mine = { type: 'acme.hero', label: 'Hero' };
    expect(types(selectBlocks({ extra: [mine] })).at(-1)).toBe('acme.hero');
    expect(() => selectBlocks({ extra: [{ type: 'vitops_cards', label: 'Dup' }] })).toThrow(
      /already defined/,
    );
    expect(() => selectBlocks({ extra: [mine, mine] })).toThrow(/already defined/);
  });

  it('createPlugin applies the selection to the editor menu', () => {
    const plugin = createPlugin({ blocks: { include: ['vitops_cards'] } }) as unknown as {
      admin: { portableTextBlocks: { type: string }[] };
    };
    expect(types(plugin.admin.portableTextBlocks)).toEqual(['vitops_cards']);
  });
});

describe('the plugin block map is not emptied by an import cycle', () => {
  /**
   * `emdash/ui` statically imports `virtual:emdash/block-components`, which is `astro/index.ts`.
   * Any module that index reaches and that also imports `emdash/ui` statically makes a cycle, and
   * when a site imports `@getvitops/emdash/astro` first the virtual module evaluates while
   * `blockComponents` is still undefined: the static build then drops every `vitops_*` block inside
   * a section body, and nothing fails. Renderers that need `<PortableText>` import it lazily.
   */
  it('no renderer imports emdash/ui statically', async () => {
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(import.meta.dirname, 'astro');
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
      );
    const offenders: string[] = [];
    for (const f of files(root).filter((p) => /\.(astro|ts)$/.test(p) && !p.endsWith('.test.ts'))) {
      const src = (await readFile(f, 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      if (/(^|\n)\s*import[^;]*from\s+['"]emdash\/ui['"]/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
