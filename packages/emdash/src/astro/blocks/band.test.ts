import { describe, expect, it } from 'vite-plus/test';
import { bandToSection, groupBands } from './band.ts';

const p = (key: string) => ({ _type: 'block', _key: key });
const band = (key: string, extra: object = {}) => ({ _type: 'vitops_band', _key: key, ...extra });

describe('groupBands', () => {
  it('leaves content with no band as one run', () => {
    expect(groupBands([p('a'), p('b')])).toEqual([{ kind: 'blocks', blocks: [p('a'), p('b')] }]);
  });

  it('puts the blocks after a marker inside it, up to the next marker', () => {
    const groups = groupBands([p('intro'), band('1'), p('a'), p('b'), band('2'), p('c')]);
    expect(groups.map((g) => g.kind)).toEqual(['blocks', 'band', 'band']);
    expect(groups[1]).toMatchObject({ body: [p('a'), p('b')] });
    expect(groups[2]).toMatchObject({ body: [p('c')] });
  });

  it('tolerates empty or non-array content', () => {
    expect(groupBands(undefined)).toEqual([]);
    expect(groupBands([])).toEqual([]);
  });
});

describe('bandToSection', () => {
  it('renames the hero-style button fields to the section type slugs and attaches the body', () => {
    const body = [p('a')];
    const section = bandToSection(
      band('1', { heading: 'Hi', primaryLabel: 'Go', primaryHref: '/go', secondaryHref: '/more' }),
      body,
    );
    expect(section).toMatchObject({
      heading: 'Hi',
      cta_label: 'Go',
      cta_href: '/go',
      secondary_href: '/more',
      body,
    });
    expect(section).not.toHaveProperty('primaryLabel');
  });
});
