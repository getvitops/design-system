import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { BLOCKS } from './blocks.ts';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';
import { createPlugin, vitopsEmdash } from './index.ts';

const componentFiles: Record<string, string> = {
  'vitops.actionLink': 'src/astro/blocks/ActionLink.astro',
  'vitops.imageCompare': 'src/astro/blocks/ImageCompare.astro',
  'vitops.copyButton': 'src/astro/blocks/CopyButton.astro',
  'vitops.banner': 'src/astro/blocks/Banner.astro',
  'vitops.details': 'src/astro/blocks/Details.astro',
  'vitops.carousel': 'src/astro/blocks/Carousel.astro',
};

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
      for (const field of block.fields ?? []) {
        expect(source, `${componentFiles[type]} missing field '${field.action_id}'`).toContain(
          field.action_id,
        );
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

describe('semantic icon options', () => {
  it('still matches the icon map they were generated from', async () => {
    // src/icon-options.ts is a build-time COPY of @getvitops/utils' iconMap,
    // because this package carries no runtime @getvitops/* dependency — that is
    // what lets it version independently of the fixed toolchain group. The copy
    // can therefore go stale, so check it rather than trust it. Regenerate with
    // `pnpm --filter @getvitops/emdash gen:icons`.
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
