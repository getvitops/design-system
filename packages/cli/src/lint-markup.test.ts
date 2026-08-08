import { describe, expect, it } from 'vitest';
import { lintMarkup } from './lint-markup.ts';

/**
 * Both halves of the contract, and the second half is the load-bearing one. This
 * rule is a heuristic over shape, so the cases it must stay QUIET on are what
 * decide whether anyone keeps reading the command's output.
 */
const at = (path: string, text: string) => [{ path, text }];

describe('the subgrid rule', () => {
  it('catches a loop that renders cards', () => {
    const src = [
      '<ul class="grid">',
      '  {services.map((s) => <li class="card">{s.name}</li>)}',
      '</ul>',
    ].join('\n');
    const [f] = lintMarkup(at('a.astro', src));
    expect(f?.severity).toBe('suggestion');
    expect(f?.reason).toContain('subgrid');
    expect(f?.suggestion).toContain('subgrid-card');
  });

  it('reports the line the repetition is on', () => {
    const src = [
      '---',
      'const x = 1;',
      '---',
      '<div>',
      '{a.map((c) => <div class="card" />)}',
      '</div>',
    ].join('\n');
    expect(lintMarkup(at('a.astro', src))[0]?.line).toBe(5);
  });

  it('names what made it a repeated set, so the finding is checkable', () => {
    const src = '{items.map((i) => <article class="service-card" />)}';
    expect(lintMarkup(at('a.astro', src))[0]?.reason).toContain('.service-card');
  });

  it('catches three cards written out', () => {
    const src = [
      '<div class="card">a</div>',
      '<div class="card">b</div>',
      '<div class="card">c</div>',
    ].join('\n');
    expect(lintMarkup(at('a.astro', src))[0]?.cls).toContain('×3');
  });

  it('stays quiet on two cards, which are as likely to be unrelated', () => {
    const src = ['<div class="card">a</div>', '<section><div class="card">b</div></section>'].join(
      '\n',
    );
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it("does not count a card's own child classes as more cards", () => {
    // `.card` + `.card__body` + `.card__footer` is ONE card. Counting element
    // classes rather than block classes would report every single-card file.
    const src =
      '<div class="card"><div class="card__body">b</div><div class="card__footer">f</div></div>';
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it('stays quiet once the file uses subgrid, in any tier spelling', () => {
    const loop = '{a.map((c) => <li class="card" />)}';
    expect(lintMarkup(at('a.astro', `<ul class="subgrid">${loop}</ul>`))).toEqual([]);
    expect(lintMarkup(at('b.astro', `<Subgrid>${loop}</Subgrid>`))).toEqual([]);
  });

  it('stays quiet on a loop that renders something other than a card', () => {
    expect(lintMarkup(at('a.astro', '{nav.map((n) => <li class="link">{n.label}</li>)}'))).toEqual(
      [],
    );
  });

  /**
   * Both of these were real false positives on the first run against this repo's
   * own docs site — the rule reported `changelog.md` and two generated reference
   * pages, which discuss `.card` rather than using it.
   */
  it('ignores markdown, which is as likely to discuss a class as to use it', () => {
    const src = ['| `card` | a card |', 'Use `card` for a card. See `card` above.'].join('\n');
    expect(lintMarkup(at('changelog.md', src))).toEqual([]);
  });

  it('requires a real class attribute, not the name appearing in prose', () => {
    // A page documenting the framework names these constantly.
    const src = '<p>The card pattern: card, subgrid-card, pricing-card.</p>';
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it('reads the JSX and Astro class spellings', () => {
    const loop = (attr: string) => `{a.map((c) => <li ${attr}>x</li>)}`;
    expect(lintMarkup(at('a.tsx', loop('className="card"')))).toHaveLength(1);
    expect(lintMarkup(at('b.astro', loop('class:list={["card"]}')))).toHaveLength(1);
  });

  /**
   * Reported from downstream: agents dislike the `<li>` wrapper when the card is a
   * link and reach for `<li><a class="card">`, which renders fine and is not a
   * subgrid at all.
   */
  it('catches a card class on an anchor inside a subgrid', () => {
    const src = '<ul class="subgrid"><li><a class="card" href="/x">Title</a></li></ul>';
    const [f] = lintMarkup(at('a.astro', src));
    expect(f?.reason).toContain('does not align');
    expect(f?.suggestion).toContain('stretched-link');
  });

  it('does not report a link card as a missed subgrid as well', () => {
    // One decision, one finding — the file IS a subgrid, it is just built wrong.
    const src = '<ul class="subgrid"><li><a class="card" href="/x">T</a></li></ul>';
    expect(lintMarkup(at('a.astro', src))).toHaveLength(1);
  });

  it('leaves an anchor inside a subgrid card alone when it is stretched', () => {
    const src =
      '<ul class="subgrid"><li class="card subgrid-card"><a class="link stretched-link" href="/x">T</a></li></ul>';
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it('does not fire on an ordinary link inside a subgrid', () => {
    const src = '<ul class="subgrid"><li class="card"><a class="link" href="/x">T</a></li></ul>';
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it('leaves a standalone anchor-card alone, even in a file that has a subgrid', () => {
    // Caught for real on apps/docs/src/pages/patterns.astro: a page documenting many
    // patterns mentions `subgrid` somewhere, and `<a class="tile card">` is a
    // perfectly good anchor-as-card — outside a grid there is no grid item for it to
    // compete with. The defect is the anchor NESTED in the item, not any anchor card.
    const src = [
      '<a class="tile card" href="#x"><p>Clickable tile</p></a>',
      '<ul class="subgrid"><li class="card subgrid-card"><p>ok</p></li></ul>',
    ].join('\n');
    expect(lintMarkup(at('a.astro', src))).toEqual([]);
  });

  it('still fires when the anchor card is nested in the list item', () => {
    const src = [
      '<a class="tile card" href="#x">standalone, fine</a>',
      '<ul class="subgrid"><li><a class="card" href="/y">nested, broken</a></li></ul>',
    ].join('\n');
    expect(lintMarkup(at('a.astro', src))[0]?.line).toBe(2);
  });
});

/**
 * The two whole-card-click mechanisms are alternatives, and layering them silently
 * picks the worse one: the overlay takes the pointer-drag, so text selection — the
 * only reason to use `<wc-cards>` — is lost, and the element's click-vs-drag logic
 * never runs because the browser follows the overlaid link first.
 */
describe('the layered card-link rule', () => {
  const card = (cls: string) =>
    `<li class="card subgrid-card"><p><a class="${cls}" href="/x">T</a></p></li>`;

  it('catches stretched-link inside wc-cards', () => {
    const [f] = lintMarkup(
      at('a.astro', `<wc-cards><ul>${card('link stretched-link')}</ul></wc-cards>`),
    );
    expect(f?.reason).toContain('two ways to do the same thing');
    expect(f?.suggestion).toContain('drop one');
  });

  it('catches it through the Astro component too', () => {
    expect(lintMarkup(at('a.astro', `<Cards>${card('link stretched-link')}</Cards>`))).toHaveLength(
      1,
    );
  });

  it('leaves stretched-link alone without the element', () => {
    // The CSS-only path is a legitimate choice; only the combination is the defect.
    expect(
      lintMarkup(at('a.astro', `<ul class="subgrid">${card('link stretched-link')}</ul>`)),
    ).toEqual([]);
  });

  it('leaves the element alone without stretched-link', () => {
    expect(lintMarkup(at('a.astro', `<Cards>${card('link')}</Cards>`))).toEqual([]);
  });

  it('treats `<Cards>` and `<wc-cards>` as already using the pattern', () => {
    // `<Cards>` renders a Subgrid and `<wc-cards>` only ever wraps one, so reporting
    // either as a missed subgrid would be reporting correct code.
    const loop = '{a.map((c) => <li class="card" />)}';
    expect(lintMarkup(at('a.astro', `<Cards>${loop}</Cards>`))).toEqual([]);
    expect(lintMarkup(at('b.astro', `<wc-cards><ul>${loop}</ul></wc-cards>`))).toEqual([]);
  });

  it('reports once per file, not once per card', () => {
    const src = ['{a.map((c) => <li class="card" />)}', '{b.map((c) => <li class="card" />)}'].join(
      '\n',
    );
    expect(lintMarkup(at('a.astro', src))).toHaveLength(1);
  });
});
