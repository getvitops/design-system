/**
 * A minimal reader for hand-written CSS: rule selector, declarations as authored,
 * and the at-rule conditions the rule sits inside.
 *
 * **Why not lightningcss.** The generator owns it, and exposing an `analyzeCss`
 * from there was the obvious move — but lightningcss parses declarations into a
 * typed value model, and the typed model is exactly what these rules need to see
 * through. `display: flex` comes back as `pair`, `grid-template-columns: 1fr 1fr`
 * as `track-list`, and `margin-inline: auto` as an empty structured node. Every
 * rule here matches on *authored text*, so recovering it property-by-property
 * would mean re-implementing a serialiser for each one.
 *
 * A brace-depth scanner keeps the text intact, needs no native binary in the
 * CLI's dependency tree, and follows what `generate.ts` already does twice
 * (`stripForTailwind`, `isVariantBlock`).
 *
 * It is deliberately shallow: no specificity, no cascade, no `@supports`
 * semantics. It answers "what did someone type in this rule", which is all a
 * reuse suggestion needs.
 */

export interface CssDeclaration {
  property: string;
  value: string;
}

export interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
  /** Enclosing at-rule preludes, outermost first (`@media (min-width: 48rem)`). */
  conditions: string[];
  /** 1-indexed line of the selector. */
  line: number;
}

/** Strip comments, preserving newlines so line numbers survive. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;

/**
 * Parse declarations from a rule body. Splits on top-level `;` only, so a
 * `var(--x, a; b)` or a data URI cannot end a declaration early.
 */
function parseDeclarations(body: string): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  let depth = 0;
  let start = 0;
  const push = (chunk: string) => {
    const colon = chunk.indexOf(':');
    if (colon < 0) return;
    const property = chunk.slice(0, colon).trim();
    const value = chunk.slice(colon + 1).trim();
    // A nested block leaks in as a property containing `{`; skip it rather than
    // reporting a declaration that was never written.
    if (!property || property.includes('{') || !value) return;
    out.push({ property, value });
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ';' && depth === 0) {
      push(body.slice(start, i));
      start = i + 1;
    }
  }
  push(body.slice(start));
  return out;
}

/**
 * Scan a stylesheet into its style rules.
 *
 * Never throws: this runs over consumer source that may be a fragment, and a
 * linter that dies on one unparseable file is one nobody keeps in CI.
 */
export function scanCss(css: string): CssRule[] {
  const src = stripComments(css);
  const rules: CssRule[] = [];
  // Each open brace pushes its prelude; at-rule preludes become `conditions` for
  // everything nested inside, style-rule preludes become a selector.
  const stack: { prelude: string; index: number }[] = [];
  let depth = 0;
  let preludeStart = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      // Skip strings whole — a brace inside content: "{" would desync the depth.
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '{') {
      const raw = src.slice(preludeStart, i);
      const prelude = raw.trim();
      // Offset of the first non-whitespace character, not of `preludeStart` —
      // that sits where the previous rule ended, so a rule's reported line would
      // be the blank line above it.
      stack.push({ prelude, index: preludeStart + raw.indexOf(prelude.slice(0, 1)) });
      depth++;
      preludeStart = i + 1;
      continue;
    }
    if (ch === '}') {
      const frame = stack.pop();
      depth--;
      if (frame && !frame.prelude.startsWith('@')) {
        // A style rule: its body is everything since it opened, minus any nested
        // blocks, which `parseDeclarations` discards.
        const bodyStart = src.indexOf('{', frame.index) + 1;
        rules.push({
          selector: frame.prelude,
          declarations: parseDeclarations(src.slice(bodyStart, i)),
          conditions: stack.filter((f) => f.prelude.startsWith('@')).map((f) => f.prelude),
          line: lineAt(src, frame.index),
        });
      }
      preludeStart = i + 1;
      continue;
    }
  }
  // Unbalanced braces (a fragment, a truncated file) leave frames on the stack;
  // returning what was parsed beats reporting nothing.
  return rules.filter((r) => r.selector && depth >= 0);
}

/** `<style>` block contents from an .astro/.vue/.svelte/.html file. */
export function extractStyleBlocks(src: string): { css: string; line: number }[] {
  const out: { css: string; line: number }[] = [];
  for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    // Offset so a finding's line number points into the original file, not into
    // the extracted block.
    const line = lineAt(src, (m.index ?? 0) + m[0].indexOf('>') + 1);
    out.push({ css: m[1] ?? '', line });
  }
  return out;
}
