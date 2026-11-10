import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { BLOCKS } from '../../emdash/src/blocks.ts';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { EXEMPT, FIXTURES } from './fixtures.ts';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { blocksPageContent, buildOverlay, coverage, sectionBlocks } from './overlay.ts';

const template = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'templates', 'emdash', 'seed', 'seed.json'), 'utf8'),
);

describe('e2e fixtures', () => {
  it('cover every block in BLOCKS, or say why not', () => {
    const missing = BLOCKS.map((b) => b.type).filter((t) => !FIXTURES[t] && !(t in EXEMPT));
    // A new block must be added to packages/create/e2e/fixtures.ts (or EXEMPT, with a reason).
    expect(missing).toEqual([]);
  });

  it('name no block that does not exist', () => {
    const known = new Set(BLOCKS.map((b) => b.type));
    expect(Object.keys(FIXTURES).filter((t) => !known.has(t))).toEqual([]);
    expect(Object.keys(EXEMPT).filter((t) => !known.has(t))).toEqual([]);
  });

  it('never both fix and exempt a block', () => {
    expect(Object.keys(EXEMPT).filter((t) => t in FIXTURES)).toEqual([]);
  });

  it('only set fields the block declares', () => {
    for (const block of BLOCKS) {
      const fixture = FIXTURES[block.type];
      if (!fixture) continue;
      const declared = new Set((block.fields ?? []).map((f) => f.action_id));
      expect(
        Object.keys(fixture).filter((k) => !declared.has(k)),
        block.type,
      ).toEqual([]);
    }
  });
});

describe('e2e overlay', () => {
  it('puts every covered block on the /blocks page, once', () => {
    const types = (blocksPageContent() as { _type: string }[]).map((b) => b._type);
    for (const type of coverage().covered) expect(types.filter((t) => t === type)).toHaveLength(1);
  });

  it('wraps plugin blocks in vitops_section block types with unique keys', () => {
    const sections = sectionBlocks() as {
      _type: string;
      _key: string;
      body: { _type: string }[];
    }[];
    expect(sections.every((s) => s._type === 'vitops_section')).toBe(true);
    expect(new Set(sections.map((s) => s._key)).size).toBe(sections.length);
    expect(sections.some((s) => s.body.some((b) => b._type.startsWith('vitops_')))).toBe(true);
  });

  it('adds block types, a blocks field and entries to a copy, leaving the template seed alone', () => {
    const before = JSON.stringify(template);
    const { seed } = buildOverlay(template);
    expect(JSON.stringify(template)).toBe(before);
    expect((seed.blockTypes as { slug: string }[]).map((t) => t.slug)).toContain('vitops_section');
    expect(JSON.stringify(seed.collections)).toContain('"type":"blocks"');
  });
});

describe('the shipped template stays free of the e2e content', () => {
  it('has no block types or blocks field in its seed', () => {
    expect(template.blockTypes).toBeUndefined();
    expect(JSON.stringify(template)).not.toContain('"type":"blocks"');
    expect(JSON.stringify(template)).not.toContain('vitops_section');
  });
});
