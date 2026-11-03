import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };
import { TIERS } from '@getvitops/generator';
import { BLOCKS, selectBlocks } from './blocks.ts';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';
import { createPlugin, vitopsEmdash } from './index.ts';

const componentFiles: Record<string, string> = {
  'vitops.actionLink': 'src/astro/blocks/ActionLink.astro',
  'vitops.imageCompare': 'src/astro/blocks/ImageCompare.astro',
  'vitops.copyButton': 'src/astro/blocks/CopyButton.astro',
  'vitops.banner': 'src/astro/blocks/Banner.astro',
  'vitops.details': 'src/astro/blocks/Details.astro',
  'vitops.carousel': 'src/astro/blocks/Carousel.astro',
  'vitops.gallery': 'src/astro/blocks/Gallery.astro',
  'vitops.cards': 'src/astro/blocks/Cards.astro',
  'vitops.accordion': 'src/astro/blocks/Accordion.astro',
  'vitops.marquee': 'src/astro/blocks/Marquee.astro',
};

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
  it('every declared block has a rendering component', () => {
    expect(Object.keys(componentFiles).sort()).toEqual(BLOCKS.map((b) => b.type).sort());
  });

  it.each(BLOCKS.map((b) => [b.type, b] as const))(
    '%s: every field action_id is consumed by its component',
    async (type, block) => {
      const source = await readFile(new URL(`../${componentFiles[type]}`, import.meta.url), 'utf8');
      for (const id of actionIds(block.fields ?? [])) {
        expect(source, `${componentFiles[type]} missing field '${id}'`).toContain(id);
      }
    },
  );

  it('the astro componentsEntry maps exactly the declared block types', async () => {
    const source = await readFile(new URL('./astro/index.ts', import.meta.url), 'utf8');
    for (const block of BLOCKS) {
      expect(source).toContain(`'${block.type}'`);
    }
  });
});

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

  it('TIERS lists no block this package does not define', () => {
    const defined = new Set(BLOCKS.map((b) => b.type));
    const phantom = entries.flatMap(([name, e]) =>
      (e.emdash ?? []).filter((t) => !defined.has(t)).map((t) => `${name}: ${t}`),
    );
    expect(phantom).toEqual([]);
  });

  it.each(BLOCKS.map((b) => b.type))(
    '%s renders through the pattern it is listed under',
    async (type) => {
      const source = await readFile(new URL(`../${componentFiles[type]}`, import.meta.url), 'utf8');
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
    const block = BLOCKS.find((b) => b.type === 'vitops.actionLink');
    const combos = (block?.fields ?? []).filter((f) => f.type === 'combobox');
    expect(combos.map((f) => f.action_id)).toEqual(['startIcon', 'endIcon']);
    for (const f of combos)
      expect((f as { options: unknown[] }).options).toBe(SEMANTIC_ICON_OPTIONS);
  });
});

describe('selectBlocks', () => {
  const types = (blocks: { type: string }[]) => blocks.map((b) => b.type);

  it('offers every block by default', () => {
    expect(types(selectBlocks())).toEqual(types(BLOCKS));
  });

  it('include is an allowlist, in the library order', () => {
    expect(types(selectBlocks({ include: ['vitops.cards', 'vitops.banner'] }))).toEqual([
      'vitops.banner',
      'vitops.cards',
    ]);
  });

  it('exclude drops blocks, and wins over include', () => {
    const out = types(
      selectBlocks({ include: ['vitops.cards', 'vitops.banner'], exclude: ['vitops.cards'] }),
    );
    expect(out).toEqual(['vitops.banner']);
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
    expect(() => selectBlocks({ extra: [{ type: 'vitops.cards', label: 'Dup' }] })).toThrow(
      /already defined/,
    );
    expect(() => selectBlocks({ extra: [mine, mine] })).toThrow(/already defined/);
  });

  it('createPlugin applies the selection to the editor menu', () => {
    const plugin = createPlugin({ blocks: { include: ['vitops.cards'] } }) as unknown as {
      admin: { portableTextBlocks: { type: string }[] };
    };
    expect(types(plugin.admin.portableTextBlocks)).toEqual(['vitops.cards']);
  });
});
