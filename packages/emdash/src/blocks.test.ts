import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { BLOCKS } from './blocks.ts';
import { createPlugin, vitopsEmdash } from './index.ts';

const componentFiles: Record<string, string> = {
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
