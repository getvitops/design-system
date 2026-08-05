/**
 * A pattern with two container-state presentations must express them as branches,
 * not as base-plus-override.
 *
 * `@container` contributes ZERO specificity. So a rule inside
 * `@container style(--_x: 1)` competes at its bare selector weight, and any rule
 * outside the block with a heavier selector wins *inside that state* — silently,
 * because the block reads like an override and mostly behaves like one. Three
 * defects shipped in `sitenav.css` this way:
 *
 *   - `.sitenav--drawer-end .sitenav__panel` (0,2,0) beat the navbar reset's
 *     `translate: none` (0,1,0), so a promoted navbar rendered one full
 *     panel-width off-screen.
 *   - the accordion's `.sitenav__item--branch > .sitenav__submenu` (0,2,0)
 *     `overflow: hidden` beat the dropdown's `overflow: visible` (0,1,0), which
 *     clipped away every third-level megamenu at width.
 *   - `.sitenav__item--branch:has(> .sitenav__disclosure[open])` (0,3,0) beat
 *     `grid-template-rows: none`, latent only because the block also flips
 *     `display`.
 *
 * This asserts the SHAPE rather than the three symptoms, so it catches the next
 * one. `navshell.css` hit the same class of bug and fixed it the other way — by
 * raising the state block's own selector to `.navshell__panel.drawer` — which is
 * also accepted here, since it is the inversion that is the defect, not the
 * remedy.
 *
 * Two deliberate limits, both erring toward silence rather than noise:
 *   - Same-file only. `navshell`'s original inversion came from `drawer.css`
 *     across an `@import`, which would need import-order resolution to see.
 *   - The property-family table is curated, not exhaustive. An unlisted longhand
 *     pair is a missed violation, never a false alarm; the browser probe is the
 *     backstop for what static analysis can't reach.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'css');

type Spec = [number, number, number];
type Rule = { selectors: string[]; props: Set<string>; inState: boolean; at: string };

/** Comments can hold braces — sitenav's header quotes a whole ruleset — so they
 *  must go before any brace counting. Strings are skipped, not stripped. */
function stripComments(css: string): string {
  let out = '';
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }
    if (css[i] === '"' || css[i] === "'") {
      const q = css[i];
      out += css[i++];
      while (i < css.length && css[i] !== q) out += css[i++];
    }
    out += css[i] ?? '';
  }
  return out;
}

/** Split one nesting level into `{ prelude, body }` pairs. */
function splitBlocks(css: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let preludeEnd = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) preludeEnd = i;
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        out.push({
          prelude: css.slice(start, preludeEnd).trim(),
          body: css.slice(preludeEnd + 1, i),
        });
        start = i + 1;
      }
    }
  }
  return out;
}

/** Declarations belonging to this rule itself — nested rules excluded. */
function ownProps(body: string): Set<string> {
  const props = new Set<string>();
  let depth = 0;
  let decl = '';
  for (const ch of body) {
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      decl = '';
    } else if (depth === 0) {
      if (ch === ';') {
        const name = decl.split(':')[0]?.trim();
        if (name && !name.startsWith('--')) props.add(name);
        decl = '';
      } else decl += ch;
    }
  }
  const tail = decl.split(':')[0]?.trim();
  if (tail && !tail.startsWith('--') && decl.includes(':')) props.add(tail);
  return props;
}

/** Top-level commas only — a comma inside `:is(a, b)` does not split a list. */
function splitSelectorList(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of prelude) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const STATE_BLOCK = /^@container\s+style\(/;

/** Flatten a stylesheet to rules, tagging each with whether it sits inside a
 *  `@container style()` block. Other at-rules (`@media`, `@starting-style`,
 *  width `@container`) add no specificity either, so their contents are
 *  flattened into the surrounding context rather than treated as a state. */
function collect(css: string): Rule[] {
  const rules: Rule[] = [];
  const walk = (src: string, inState: boolean, at: string) => {
    for (const { prelude, body } of splitBlocks(src)) {
      if (prelude.startsWith('@')) {
        const state = inState || STATE_BLOCK.test(prelude);
        walk(body, state, state && !inState ? prelude : at);
        continue;
      }
      rules.push({ selectors: splitSelectorList(prelude), props: ownProps(body), inState, at });
    }
  };
  walk(css, false, '');
  return rules;
}

/** Author-level specificity. `:where()` is 0; `:is()`/`:not()`/`:has()` take the
 *  weight of their heaviest argument. */
function specificity(sel: string): Spec {
  let s: Spec = [0, 0, 0];
  let rest = sel;
  const fn = /:(where|is|not|has|matches|any)\(/i;
  let m: RegExpExecArray | null;
  while ((m = fn.exec(rest))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < rest.length && depth > 0; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')') depth--;
    }
    const args = rest.slice(m.index + m[0].length, i - 1);
    if (m[1]?.toLowerCase() !== 'where') {
      let best: Spec = [0, 0, 0];
      for (const a of splitSelectorList(args)) {
        const c = specificity(a);
        if (cmp(c, best) > 0) best = c;
      }
      s = [s[0] + best[0], s[1] + best[1], s[2] + best[2]];
    }
    rest = rest.slice(0, m.index) + ' ' + rest.slice(i);
  }
  rest = rest.replace(/::[\w-]+/g, () => {
    s[2]++;
    return ' ';
  });
  for (const _ of rest.matchAll(/#[\w-]+/g)) s[0]++;
  for (const _ of rest.matchAll(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g)) s[1]++;
  for (const _ of rest.matchAll(/(^|[\s>+~])([a-zA-Z][\w-]*)/g)) s[2]++;
  return s;
}

const cmp = (a: Spec, b: Spec): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Classes on the rightmost compound — what the rule actually selects. */
function keyClasses(sel: string): Set<string> {
  const key =
    sel
      .trim()
      .split(/[\s>+~]+(?![^(]*\))/)
      .pop() ?? '';
  return new Set([...key.matchAll(/\.([\w-]+)/g)].flatMap((m) => m[1] ?? []));
}

const ALIAS: Record<string, string> = {
  'column-gap': 'gap',
  'row-gap': 'gap',
  top: 'inset',
  right: 'inset',
  bottom: 'inset',
  left: 'inset',
};
const ROOTS = [
  'padding',
  'margin',
  'border',
  'inset',
  'overflow',
  'background',
  'grid',
  'gap',
  'font',
  'transition',
  'animation',
  'outline',
  'list-style',
  'flex',
  'place',
];

function family(prop: string): string {
  if (ALIAS[prop]) return ALIAS[prop];
  let best = prop;
  for (const r of ROOTS) {
    if ((prop === r || prop.startsWith(`${r}-`)) && r.length < best.length) best = r;
  }
  return best === prop ? prop : best;
}

const isSuperset = (a: Set<string>, b: Set<string>) => [...b].every((x) => a.has(x));

/** Discovered, not listed — a new two-state pattern is covered on arrival. */
const FILES = readdirSync(join(CSS_ROOT, 'patterns'))
  .filter((f) => f.endsWith('.css'))
  .filter((f) => /@container\s+style\(/.test(readFileSync(join(CSS_ROOT, 'patterns', f), 'utf8')))
  .map((f) => join('patterns', f));

describe('container-state branches', () => {
  it('covers every pattern that has one', () => {
    // If this drops to nothing, the walk broke rather than the CSS getting clean.
    expect(FILES.length).toBeGreaterThanOrEqual(3);
  });

  it.each(FILES)('%s: no outside rule outranks its state block', (rel) => {
    const rules = collect(stripComments(readFileSync(join(CSS_ROOT, rel), 'utf8')));
    const violations: string[] = [];

    for (const w of rules.filter((r) => r.inState)) {
      for (const t of rules.filter((r) => !r.inState)) {
        for (const ws of w.selectors) {
          for (const ts of t.selectors) {
            if (!isSuperset(keyClasses(ts), keyClasses(ws))) continue;
            if (keyClasses(ws).size === 0) continue;
            const [st, sw] = [specificity(ts), specificity(ws)];
            if (cmp(st, sw) <= 0) continue;
            const shared = [...t.props].filter((p) =>
              [...w.props].some((q) => family(p) === family(q)),
            );
            if (shared.length)
              violations.push(
                `  ${ts} (${st.join(',')})\n    beats  ${w.at} { ${ws} } (${sw.join(',')})\n    on     ${shared.join(', ')}`,
              );
          }
        }
      }
    }

    expect(violations, `\n${violations.join('\n\n')}\n`).toEqual([]);
  });
});
