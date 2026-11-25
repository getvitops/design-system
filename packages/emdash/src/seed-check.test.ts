import { describe, expect, it } from 'vite-plus/test';
import { checkSeedBlocks } from './seed-check.ts';

const wrap = (...content: object[]) => ({ content: { pages: [{ data: { content } }] } });

describe('checkSeedBlocks', () => {
  it('accepts a correct block, including the shared escape hatches', () => {
    expect(
      checkSeedBlocks(
        wrap({ _type: 'vitops_hero', _key: 'a', heading: 'Hi', primaryLabel: 'Go', anchor: 'top' }),
      ),
    ).toEqual([]);
  });

  it("flags a typo'd field and suggests the real one", () => {
    const [p] = checkSeedBlocks(wrap({ _type: 'vitops_hero', primaryLabl: 'Go' }));
    expect(p).toMatchObject({ level: 'error', path: 'content.pages[0].data.content[0]' });
    expect(p!.message).toContain('did you mean "primaryLabel"');
  });

  it('flags an unknown vitops block type', () => {
    const [p] = checkSeedBlocks(wrap({ _type: 'vitops_heroo' }));
    expect(p!.message).toContain('did you mean "vitops_hero"');
  });

  it('ignores blocks that are not ours', () => {
    expect(checkSeedBlocks(wrap({ _type: 'image', alt: 'x' }, { _type: 'block' }))).toEqual([]);
  });

  it('checks repeater rows and an empty gallery src', () => {
    const problems = checkSeedBlocks(
      wrap({
        _type: 'vitops_gallery',
        images: [
          { src: '', alt: 'a' },
          { src: '/x.jpg', altt: 'b' },
        ],
      }),
    );
    expect(problems.map((p) => p.message).join('\n')).toMatch(/no src/);
    expect(problems.map((p) => p.message).join('\n')).toMatch(/no field "altt".*"alt"/);
  });

  it('warns on a select value outside its options but not on a site-defined one', () => {
    const bad = checkSeedBlocks(wrap({ _type: 'vitops_hero', layout: 'diagonal' }));
    expect(bad[0]).toMatchObject({ level: 'warn' });
    expect(checkSeedBlocks(wrap({ _type: 'vitops_hero', tone: 'my-brand-role' }))).toEqual([]);
  });

  it('walks into a section body and checks the section type itself', () => {
    const problems = checkSeedBlocks({
      layout: [
        {
          _type: 'vitops_section',
          _version: 1,
          heading: 'x',
          ctaLabel: 'wrong',
          body: [{ _type: 'vitops_logoz' }],
        },
      ],
    });
    expect(problems).toHaveLength(2);
  });
});
