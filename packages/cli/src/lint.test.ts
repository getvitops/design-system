import {
  defaultConfig,
  expandPalette,
  functionalRole,
  roleColorUtilities,
  roleHue,
  roleKind,
} from '@getvitops/generator';
import { describe, expect, it } from 'vitest';
import { extractClasses, judge, lintSource, vocabulary } from './lint.ts';

/**
 * The two shapes this exists to catch, both found in a real consumer site:
 * `bg-navy-d` (a hue that exists, a step that doesn't — left over from the
 * deleted named-step scale) and `md-flex-row` (the css/bricks responsive
 * spelling, inert in the tailwind format).
 *
 * The other half of the contract matters just as much: it must stay SILENT on
 * everything not anchored to the consumer's own config, or it becomes noise
 * nobody runs twice.
 */
const ds = defaultConfig();
const pal = expandPalette(ds.colors.palette);
const roleClasses = roleColorUtilities(
  Object.entries(ds.colors.roles).map(([r, spec]) =>
    functionalRole(r, roleHue(spec), pal[roleHue(spec)]!, roleKind(spec)),
  ),
  ds.colors.utilities ?? ['bg', 'text', 'icon', 'border'],
).map((u) => u.cls);
const v = vocabulary(ds, roleClasses);
const hue = Object.keys(ds.colors.palette)[0] as string;
const role = Object.keys(ds.colors.roles)[0] as string;

describe('judge', () => {
  it('flags a real hue with a step that does not exist', () => {
    const f = judge(`bg-${hue}-d`, v, 'tailwind');
    expect(f?.reason).toContain('not a step');
    expect(f?.suggestion).toContain(`bg-${hue}-500`);
  });

  it('accepts every numeric step on a real hue', () => {
    for (const step of ['50', '100', '500', '900', '950'])
      expect(judge(`bg-${hue}-${step}`, v, 'css'), `bg-${hue}-${step}`).toBeNull();
  });

  it('accepts every role class the generator emits', () => {
    for (const cls of roleClasses) expect(judge(cls, v, 'css'), cls).toBeNull();
  });

  it('flags a role modifier that is not emitted', () => {
    expect(judge(`bg-${role}-nope`, v, 'css')?.reason).toContain('not emitted');
  });

  it('flags md-* only in the tailwind format', () => {
    // Same class, opposite verdicts — the whole reason --format exists.
    expect(judge('md-flex-row', v, 'tailwind')?.suggestion).toContain('@md:flex-row');
    expect(judge('md-flex-row', v, 'css')).toBeNull();
    expect(judge('md-flex-row', v, 'bricks')).toBeNull();
  });

  it('sees through Tailwind variant prefixes', () => {
    expect(judge(`hover:bg-${hue}-d`, v, 'tailwind')?.reason).toContain('not a step');
    expect(judge(`@md:hover:bg-${hue}-500`, v, 'tailwind')).toBeNull();
  });

  it('stays silent on classes not anchored to this config', () => {
    // Tailwind's own utilities, arbitrary consumer classes, bare framework
    // structural classes — none of these are ours to judge, and guessing would
    // make the tool unusable in a Tailwind project.
    for (const cls of [
      'flex',
      'items-center',
      'p-4',
      'max-w-md',
      'bg-red-500', // a hue this config does not define
      'my-own-thing',
      'grid-cols-[1fr_2fr]',
      'text-[#ff0000]',
      'hover:underline',
    ])
      expect(judge(cls, v, 'tailwind'), cls).toBeNull();
  });

  it('flags an undefined shadow but not Tailwind drop-shadow utilities it cannot know', () => {
    const shadow = Object.keys(ds.shadows ?? {})[0] as string;
    expect(judge(`drop-shadow-${shadow}`, v, 'css')).toBeNull();
    expect(judge('drop-shadow-nonexistent', v, 'css')?.reason).toContain('not a defined shadow');
  });
});

describe('extractClasses', () => {
  it('reads class, className and :class with the right line numbers', () => {
    const src = ['<div class="a b">', '<i className="c" />', '<x :class="d" />'].join('\n');
    expect(extractClasses(src)).toEqual([
      { cls: 'a', line: 1 },
      { cls: 'b', line: 1 },
      { cls: 'c', line: 2 },
      { cls: 'd', line: 3 },
    ]);
  });

  it('skips dynamic fragments rather than judging a partial token', () => {
    const src = '<div class={`card ${active ? "is-open" : ""}`}>';
    expect(extractClasses(src).map((c) => c.cls)).not.toContain('${active');
  });
});

describe('lintSource', () => {
  it('reports file and line, and de-duplicates within a line', () => {
    const files = [
      { path: 'a.astro', text: `<div class="card bg-${hue}-d">` },
      { path: 'b.astro', text: `<div class="md-inline">` },
    ];
    const out = lintSource(files, v, 'tailwind');
    expect(out.map((f) => [f.file, f.line, f.cls])).toEqual([
      ['a.astro', 1, `bg-${hue}-d`],
      ['b.astro', 1, 'md-inline'],
    ]);
  });

  it('returns nothing for a clean file', () => {
    const clean = [{ path: 'c.astro', text: `<div class="card bg-${role} flex p-4">` }];
    expect(lintSource(clean, v, 'tailwind')).toEqual([]);
  });
});

/**
 * The format-spelling check used to run in one direction only. `md-split-1-2` in
 * a tailwind project was caught, but `@md:split-1-2` in a css/bricks project was
 * not: `stripVariants` removed the `@md:` regardless of format, leaving a bare
 * class that matched nothing and returned null. Same silent no-op, unreported.
 */
describe('format spelling, both directions', () => {
  it('flags the container-query spelling in css and bricks', () => {
    for (const format of ['css', 'bricks'] as const) {
      const verdict = judge('@md:split-1-2', v, format);
      expect(verdict?.reason, format).toContain('tailwind-format spelling');
      expect(verdict?.suggestion, format).toBe('md-split-1-2');
      expect(verdict?.severity).toBe('error');
    }
  });

  it('leaves it alone in tailwind, where it is the correct spelling', () => {
    expect(judge('@md:split-1-2', v, 'tailwind')).toBeNull();
  });

  it('still sees through non-container variants in every format', () => {
    // `hover:` is real everywhere — only the `@`-prefixed form is format-specific.
    expect(judge(`hover:bg-${hue}-d`, v, 'css')?.reason).toContain('not a step');
  });

  it('marks everything it already reported as an error, not a suggestion', () => {
    // Severity was added for the reuse rules; the pre-existing findings are all
    // "this resolves to nothing", which must keep failing the command.
    for (const cls of [`bg-${hue}-d`, 'md-flex-row'])
      expect(judge(cls, v, 'tailwind')?.severity, cls).toBe('error');
  });
});
