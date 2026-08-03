import { describe, expect, it } from 'vitest';
import { collectIconRefs, extractIconRefs } from './icons-scan.ts';

/**
 * The contract worth protecting is the split between "resolvable" and "dynamic".
 * Getting it wrong is silent in both directions: harvest too eagerly and the
 * `include` map looks complete while missing the glyph that actually renders;
 * skip too eagerly and a real icon is dropped from the bundle. The fixtures
 * below are taken from real consumer source for that reason.
 */

describe('static references', () => {
  it('reads a quoted name off an icon component', () => {
    const { refs } = extractIconRefs('<Icon name="ph:lightning" />', 'a.astro');
    expect(refs).toEqual([
      { name: 'ph:lightning', kind: 'component', attr: 'name', file: 'a.astro', line: 1 },
    ]);
  });

  it('reads braced and template literals with no interpolation', () => {
    const { refs, dynamic } = extractIconRefs('<Icon name={"menu"} />\n<Icon name={`close`} />');
    expect(refs.map((r) => r.name)).toEqual(['menu', 'close']);
    expect(dynamic).toEqual([]);
  });

  it('reads icon-bearing props and start/end adornments', () => {
    const src = '<a class="cta" startIcon="menu" endIcon="arrow-right">Go</a>';
    const { refs } = extractIconRefs(src);
    expect(refs.map((r) => [r.attr, r.name])).toEqual([
      ['startIcon', 'menu'],
      ['endIcon', 'arrow-right'],
    ]);
    expect(refs.every((r) => r.kind === 'prop')).toBe(true);
  });

  it('reads object-literal icon keys', () => {
    // Popover/Drawer take trigger={{ label, icon }}, and data arrays carry the
    // same shape — neither is an attribute, so the attribute regexes miss them.
    const src = `const partners = [{ name: 'Zoho', icon: 'simple-icons:zoho' }];
<Popover trigger={{ label: 'More', icon: 'more-vert' }} />`;
    const { refs } = extractIconRefs(src);
    expect(refs.map((r) => r.name).sort()).toEqual(['more-vert', 'simple-icons:zoho']);
  });

  it('reads sprite <use> ids, including xlink:href', () => {
    const src = `<svg><use href="/vitops/icons.svg#ph--list" /></svg>
<svg><use xlink:href="/icons.svg#menu" /></svg>`;
    const { refs } = extractIconRefs(src);
    expect(refs.map((r) => r.name)).toEqual(['ph--list', 'menu']);
    expect(refs.every((r) => r.kind === 'sprite')).toBe(true);
  });

  it('reports the line a reference sits on', () => {
    const src = ['<p>one</p>', '<p>two</p>', '<Icon name="menu" />'].join('\n');
    expect(extractIconRefs(src).refs[0]!.line).toBe(3);
  });
});

describe('dynamic references', () => {
  it('reports a computed name and harvests nothing from it', () => {
    // Verbatim from Features.astro. The inner "ph:sparkle" is a FALLBACK, not
    // the icon that renders — harvesting it would half-fill the bundle and
    // suppress the warning that tells the author to declare the real ones.
    const src = '<Icon name={iconMap[feature.icon] || "ph:sparkle"} aria-hidden="true" />';
    const { refs, dynamic } = extractIconRefs(src, 'Features.astro');
    expect(refs).toEqual([]);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]!.file).toBe('Features.astro');
  });

  it('treats an interpolated template literal as dynamic', () => {
    // Verbatim from StackAnimation.astro.
    const src = '<Icon name={`simple-icons:${slug}`} />';
    const { refs, dynamic } = extractIconRefs(src);
    expect(refs).toEqual([]);
    expect(dynamic).toHaveLength(1);
  });

  it('flags a dynamic value on an icon prop too', () => {
    const { refs, dynamic } = extractIconRefs('<a startIcon={someVar}>x</a>');
    expect(refs).toEqual([]);
    expect(dynamic.map((d) => d.attr)).toEqual(['startIcon']);
  });
});

describe('false positives', () => {
  it('ignores lookalike tags, props and custom properties', () => {
    const src = `<IconTile name="nope" />
<div iconClass="nope" data-icon="nope" style="--icon-size: 1rem">x</div>
<div class="icon-button">y</div>`;
    const { refs, dynamic } = extractIconRefs(src);
    expect(refs).toEqual([]);
    expect(dynamic).toEqual([]);
  });

  it('does not treat a plain <use> without a fragment as an icon', () => {
    const { refs } = extractIconRefs('<svg><use href="/sprite.svg" /></svg>');
    expect(refs).toEqual([]);
  });
});

describe('collectIconRefs', () => {
  it('dedupes names across files and keeps first-seen order', () => {
    const files = [
      { path: 'a.astro', text: '<Icon name="menu" /><Icon name="close" />' },
      { path: 'b.astro', text: '<Icon name="menu" /><Icon name="search" />' },
    ];
    const r = collectIconRefs(files);
    expect(r.names).toEqual(['menu', 'close', 'search']);
    expect(r.refs).toHaveLength(4);
  });

  it('accumulates dynamic findings with their file and line', () => {
    const files = [
      { path: 'ok.astro', text: '<Icon name="menu" />' },
      { path: 'dyn.astro', text: '\n<Icon name={x} />' },
    ];
    const r = collectIconRefs(files);
    expect(r.names).toEqual(['menu']);
    expect(r.dynamic).toEqual([{ expr: '{x}', attr: 'name', file: 'dyn.astro', line: 2 }]);
  });
});
