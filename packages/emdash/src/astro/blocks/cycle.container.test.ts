/**
 * Import-order regression: `@getvitops/emdash/astro` before `emdash/ui`.
 *
 * `emdash/ui` reads `virtual:emdash/block-components`, which in a real build re-exports this
 * package's `blockComponents`. The entry used to import `Section.astro`, which imported
 * `emdash/ui` at module load, closing a cycle: with the entry imported first, the virtual module
 * evaluated while `blockComponents` was still undefined and every `vitops.*` block inside a
 * `vitops_section` body was dropped from the prerendered HTML. The build still passed.
 *
 * This mock has the real shape (it reads the entry's export), and the test imports the entry
 * first, which is the order that used to break.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('virtual:emdash/block-components', async () => {
  const entry = await import('../index.ts');
  return { pluginBlockComponents: { ...entry.blockComponents } };
});
vi.mock('virtual:emdash/config', () => ({ default: {} }));
vi.mock('virtual:getvitops/reviews', () => ({ default: { locations: {} } }));
vi.mock('virtual:getvitops/icons', () => ({
  default: {
    engine: 'sprite',
    brand: 'simple-icons',
    ui: 'lucide',
    overrides: {},
    weight: null,
    root: '',
  },
}));

type Component = Parameters<AstroContainer['renderToString']>[0];

describe('import order', () => {
  it('a vitops_section body keeps its vitops.* blocks when the entry is imported first', async () => {
    const entry = await import('../index.ts');
    const container = await AstroContainer.create();
    const html = await container.renderToString(
      entry.blockTypeComponents.vitops_section as unknown as Component,
      {
        props: {
          value: {
            heading: 'Services',
            body: [
              {
                _type: 'vitops_cards',
                _key: 'c',
                cards: [{ title: 'Managed IT', body: 'We run it.' }],
              },
            ],
          },
        },
      },
    );
    expect(html).toContain('Managed IT');
    expect(html).not.toContain('data-vitops-unrendered');
  }, 60_000);

  it('marks a body block with no renderer so check-prerender can fail the build', async () => {
    const entry = await import('../index.ts');
    const container = await AstroContainer.create();
    const html = await container.renderToString(
      entry.blockTypeComponents.vitops_section as unknown as Component,
      {
        props: {
          value: { heading: 'Services', body: [{ _type: 'vitops_nope', _key: 'x' }] },
        },
      },
    );
    expect(html).toContain('data-vitops-unrendered="vitops_nope"');
  }, 60_000);
});
