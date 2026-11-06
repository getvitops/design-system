import { describe, expect, it } from 'vite-plus/test';
import { BLOCKS } from './blocks.ts';
import { renderBlocksDoc } from './blocks-doc.ts';

describe('renderBlocksDoc', () => {
  const doc = renderBlocksDoc();

  it('opens with OKF frontmatter', () => {
    expect(doc.startsWith('---\ntype: concept\n')).toBe(true);
  });

  it('documents the section block type, its body field, and the tone convention', () => {
    expect(doc).toContain('### `vitops_section`');
    expect(doc).toContain('| `body` | portableText |');
    expect(doc).toContain('## Colour: `tone` and `color`');
    expect(doc).toContain('vitopsBlockTypes()');
  });

  it('documents the new library blocks', () => {
    for (const t of ['logos', 'steps', 'stats', 'callout', 'entries', 'pricing', 'embed'])
      expect(doc).toContain(`## \`vitops.${t}\``);
  });

  it('documents every block and every field, including repeater sub-fields', () => {
    for (const b of BLOCKS) {
      expect(doc).toContain(`## \`${b.type}\``);
      for (const f of b.fields ?? []) {
        expect(doc).toContain(`\`${f.action_id}\``);
        if (f.type === 'repeater') {
          for (const sub of f.fields)
            expect(doc).toContain(`\`${f.action_id}[].${sub.action_id}\``);
        }
      }
    }
  });
});
