import { describe, expect, it } from 'vitest';
import { generateDocs, renderSkill } from './docs.ts';
import { defaultConfig } from './index.ts';
import { BASE_HOOK, TW_CLASH } from './shared.ts';

// A nonexistent assetsDir is fine: renderElementsDoc guards with existsSync and
// emits an (empty) element reference, so no built package assets are required.
const docs = () => generateDocs(defaultConfig(), '/nonexistent-assets');

describe('generateDocs bundle', () => {
  it('emits exactly the expected OKF tree', () => {
    expect(Object.keys(docs()).sort()).toEqual(
      [
        'index.md',
        'authoring.md',
        'formats.md',
        'concepts/index.md',
        'concepts/color.md',
        'concepts/scales.md',
        'concepts/patterns.md',
        'css/index.md',
        'css/classes.md',
        'bricks/index.md',
        'bricks/elements.md',
      ].sort(),
    );
  });

  it('follows OKF frontmatter rules for every entry', () => {
    for (const [path, content] of Object.entries(docs())) {
      if (path.endsWith('index.md')) {
        expect(content.startsWith('---'), `${path} must not have frontmatter`).toBe(false);
      } else {
        expect(content.startsWith('---\n'), `${path} must start with frontmatter`).toBe(true);
        const fm = content.split('---')[1] ?? '';
        expect(fm, `${path} frontmatter needs a non-empty type`).toMatch(/^type: ".+"$/m);
      }
    }
  });

  it('is deterministic', () => {
    expect(docs()).toEqual(docs());
  });

  it('formats.md lists every TW_CLASH utility (no-drift guarantee)', () => {
    const formats = docs()['formats.md']!;
    for (const cls of TW_CLASH) expect(formats, `missing \`${cls}\``).toContain(`\`${cls}\``);
  });

  it('authoring.md walks the JSON Schema (top-level sections + descriptions)', () => {
    const authoring = docs()['authoring.md']!;
    for (const key of [
      'colors',
      'shadows',
      'fonts',
      'typeScale',
      'spaceScale',
      'patterns',
      'typography',
      'animations',
    ])
      expect(authoring).toContain(`## \`${key}\``);
    // A known nested description proves the walker reads jsonSchema, not a copy.
    expect(authoring).toContain('the seed is preserved at its natural step');
    expect(authoring).not.toContain('## `$schema`');
  });

  it('concepts/patterns.md documents every BASE_HOOK override var', () => {
    const patterns = docs()['concepts/patterns.md']!;
    for (const [prop, sfx] of Object.entries(BASE_HOOK)) {
      expect(patterns).toContain(`\`${prop}\``);
      expect(patterns).toContain(`\`--${sfx}-<pattern>\``);
    }
  });
});

describe('renderSkill', () => {
  it('emits a valid skill fronting the references bundle', () => {
    const skill = renderSkill(defaultConfig());
    expect(skill.startsWith('---\nname: vitops-design-system\n')).toBe(true);
    expect(skill).toMatch(/^description: >-$/m);
    for (const ref of [
      'references/css/classes.md',
      'references/authoring.md',
      'references/formats.md',
      'references/concepts/index.md',
      'references/bricks/elements.md',
    ])
      expect(skill).toContain(ref);
    expect(skill).toContain('vitops agents');
  });

  it('is deterministic', () => {
    expect(renderSkill(defaultConfig())).toEqual(renderSkill(defaultConfig()));
  });
});
