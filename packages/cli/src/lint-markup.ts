/**
 * The third linting direction: markup that lays out a repeated set of things
 * without the framework's pattern for it.
 *
 * `lint.ts` catches a class that resolves to nothing. `lint-css.ts` catches
 * hand-written CSS that re-implements a primitive. Neither reaches the most common
 * reported drift, because it involves no bad class and no hand-written CSS at all:
 * a page renders a list of cards with `class="grid"`, or with nothing, and every
 * class in it is real. The design system has `.subgrid` for exactly this and it
 * goes unused, so across three cards the headings sit at three heights and the
 * CTAs float wherever the copy ended.
 *
 * That cannot be judged from a class token in isolation, so this module is the one
 * that looks at *shape*: is there a repeated card construct here, and is it inside
 * a subgrid?
 *
 * **It is heuristic, and the heuristics are chosen to under-report.** Every finding
 * is a `suggestion`, at most one per file, and each requires a repetition signal
 * strong enough to state in the message: a loop that renders a card, or three or
 * more sibling cards written out. Two cards in a file is not enough — they are as
 * likely to be in unrelated sections, and a rule that fires there would teach
 * people to stop reading the output, which costs more than the drift.
 */
import { extname } from 'node:path';
import type { LintFinding } from './lint.ts';

/**
 * Only real markup is examined.
 *
 * Markdown is excluded on purpose, and it is the exclusion that matters most: a
 * `.md` file is as likely to *discuss* `.card` as to use it. Run against this
 * repo's own docs site, the first version reported `changelog.md` and two
 * generated reference pages — prose about the framework, counted as drift by it.
 * A consumer's markdown content can hold real markup, so this does give up a
 * little coverage; that is the right side to err on for a heuristic.
 */
const MARKUP_EXT = new Set([
  '.astro',
  '.html',
  '.htm',
  '.jsx',
  '.tsx',
  '.vue',
  '.svelte',
  '.ts',
  '.js',
]);

/**
 * A class attribute's value, in the spellings the supported frameworks use.
 * Mirrors `lint.ts`'s extractor — the token must be in a real `class`, not merely
 * somewhere in the file.
 */
const CLASS_ATTR =
  /(?:class|className|class:list)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^}]*)\})/g;

/**
 * The card-ish classes worth caring about.
 *
 * Anchored to `card` as a whole word or suffix, which covers the framework's own
 * `card` / `subgrid-card` / `pricing-card` and a consumer's `service-card` alike.
 * Not `*-item` or `*-tile`: too many of those are not laid out as a set.
 */
const CARD_CLASS = /(?:^|[\s"'`])((?:[a-z0-9]+-)*card)(?:__[a-z0-9-]+)?(?=[\s"'`]|$)/i;

/** Every card class named in a real class attribute, with its offset in `src`. */
function cardsInClassAttrs(src: string): { name: string; index: number }[] {
  const out: { name: string; index: number }[] = [];
  for (const m of src.matchAll(CLASS_ATTR)) {
    const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
    for (const tok of value.split(/[\s'"`]+/)) {
      const card = CARD_CLASS.exec(` ${tok} `);
      // Element classes (`card__body`) belong to a card already counted by its
      // block class — counting them would report every single-card file as three.
      if (card && !tok.includes('__')) out.push({ name: card[1] as string, index: m.index ?? 0 });
    }
  }
  return out;
}

/**
 * Already using the pattern — in any tier's spelling.
 *
 * `<Cards>` and `<wc-cards>` count: `<Cards>` renders a `Subgrid`, and `<wc-cards>`
 * only ever wraps one. Omitting them reported a correct card grid as a missed one.
 */
const HAS_SUBGRID = /\bsubgrid\b|<Subgrid\b|<Cards\b|<wc-cards\b/;

/**
 * Constructs that render one item many times.
 *
 * The JS/Astro/JSX `.map(`, and the block forms Svelte/Vue/Handlebars use. A loop
 * whose body contains a card is a repeated card set by construction — no counting
 * and no sibling analysis needed, which is why it is the primary signal.
 */
const LOOPS = [/\.\s*map\s*\(/g, /\{#each\b/g, /v-for\s*=/g, /\{%\s*for\b/g];

/** Line number of a character offset. */
const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;

/**
 * The body of a loop, approximated by taking the text that follows it.
 *
 * A real brace-matcher would be more precise and is not worth it: the question is
 * only "does a card appear inside this repetition", and a card 600 characters past
 * a `.map(` is inside it in every realistic template. Over-reaching here can only
 * produce a suggestion on a file that does render cards somewhere.
 */
const LOOP_WINDOW = 600;

interface CardSignal {
  line: number;
  /** What made this a repeated set, phrased for the message. */
  evidence: string;
  cls: string;
}

/** The strongest repetition signal in one file, or none. */
function cardSignal(text: string): CardSignal | null {
  const cards = cardsInClassAttrs(text);
  if (!cards.length) return null;

  // ── a loop that renders a card ────────────────────────────────────────────
  // The stronger signal, and it needs no counting: one card inside a repetition
  // is a set by construction.
  for (const loop of LOOPS)
    for (const m of text.matchAll(loop)) {
      const start = (m.index ?? 0) + m[0].length;
      const card = cards.find((c) => c.index >= start && c.index < start + LOOP_WINDOW);
      if (!card) continue;
      return {
        line: lineAt(text, m.index ?? 0),
        evidence: `a \`${m[0].trim()}\` loop renders \`.${card.name}\``,
        cls: `${m[0].trim()} … .${card.name}`,
      };
    }

  // ── three or more cards written out ──────────────────────────────────────
  if (cards.length >= 3) {
    const first = cards[0] as { name: string; index: number };
    return {
      line: lineAt(text, first.index),
      evidence: `\`.${first.name}\` appears on ${cards.length} elements in this file`,
      cls: `.${first.name} ×${cards.length}`,
    };
  }
  return null;
}

/**
 * Lint markup for repeated card sets laid out without `.subgrid`.
 *
 * Takes raw text like the other linters — discovery stays with the caller. One
 * finding per file: the drift is a decision about a layout, not about a line, and
 * repeating it per card would bury every other finding the command prints.
 */
/**
 * An anchor carrying a card class inside a subgrid.
 *
 * The shape everyone reaches for when the whole card is a link — and it renders
 * fine, which is why it survives. The `<li>` is the grid item, so the anchor is an
 * ordinary block inside it and the tranches within the anchor never reach the
 * parent's shared row lines: the alignment `.subgrid` exists for silently does not
 * happen, and the anchor doesn't fill the cell either. This is the one markup
 * finding that reports a *broken* result rather than a missed primitive.
 */
const LINK_CARD = /<a\b[^>]*\bclass(?:Name)?\s*=\s*["'{][^"'}]*\b(?:[a-z0-9]+-)*card\b/gi;

/**
 * Is this offset inside an `<li>`?
 *
 * The rule's claim is "the anchor is nested inside the grid item rather than being
 * it", and only an anchor within an `<li>` is that. Checking the file merely
 * *mentions* subgrid is far too coarse: a page documenting several patterns tripped
 * on a standalone `<a class="tile card">`, which is a perfectly good anchor-as-card —
 * outside a grid there is no grid item for it to compete with.
 */
function insideListItem(text: string, index: number): boolean {
  const before = text.slice(0, index);
  return before.lastIndexOf('<li') > before.lastIndexOf('</li');
}

function linkCardFinding(file: { path: string; text: string }): LintFinding | null {
  const m = [...file.text.matchAll(LINK_CARD)].find((hit) =>
    insideListItem(file.text, hit.index ?? 0),
  );
  if (!m || m.index === undefined) return null;
  return {
    file: file.path,
    line: lineAt(file.text, m.index),
    cls: '<a class="…card">',
    severity: 'suggestion',
    reason:
      'a card class on an `<a>` inside a `subgrid` does not align — the `<li>` is the grid ' +
      "item, so the anchor's tranches never reach the parent's shared row lines, and the " +
      'anchor does not fill the cell either. It renders, it just silently is not a subgrid',
    suggestion:
      'keep the card as the item (`<li class="card subgrid-card">`) and make the whole card ' +
      'clickable from inside it — either `class="stretched-link"` on a link (no JS, but the ' +
      "card's text stops being selectable) or `<Cards>` / `<wc-cards>` around the list " +
      '(keeps selection, needs JS, falls back to the link). Both keep the accessible name on ' +
      'real text. Lift anything that must stay above a stretched overlay with `raised`',
  };
}

/**
 * `.stretched-link` inside `<wc-cards>` — the two whole-card-click mechanisms layered.
 *
 * They are alternatives, not layers, and combining them is silently the worse of the
 * two: the overlay takes the pointer-drag, so the card's text stops being selectable
 * — which is the only reason to reach for `<wc-cards>` — and the element's
 * click-vs-drag logic never gets a chance to run, because the browser follows the
 * overlaid link natively first.
 */
const WC_CARDS = /<wc-cards\b|<Cards\b/;
const STRETCHED = /\bclass(?:Name)?\s*=\s*["'{][^"'}]*\bstretched-link\b/;

function layeredCardLinkFinding(file: { path: string; text: string }): LintFinding | null {
  if (!WC_CARDS.test(file.text)) return null;
  const m = STRETCHED.exec(file.text);
  if (!m) return null;
  return {
    file: file.path,
    line: lineAt(file.text, m.index),
    cls: 'stretched-link inside wc-cards',
    severity: 'suggestion',
    reason:
      '`.stretched-link` and `<wc-cards>` are two ways to do the same thing, and layering ' +
      "them silently picks the worse one — the overlay takes the pointer-drag, so the card's " +
      'text is no longer selectable, which is the only reason to use `<wc-cards>` at all',
    suggestion:
      'drop one. Keep `stretched-link` and use `<Subgrid>` if you want zero JS and can accept ' +
      'unselectable card text; keep `<Cards>` / `<wc-cards>` and remove `stretched-link` if ' +
      'selectable text matters — the plain `link` class on the heading is then the fallback',
  };
}

export function lintMarkup(files: { path: string; text: string }[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const file of files) {
    if (!MARKUP_EXT.has(extname(file.path).toLowerCase())) continue;
    // Layering the two whole-card-click mechanisms is judged wherever it appears —
    // `<wc-cards>` governs any container, not only a subgrid.
    const layered = layeredCardLinkFinding(file);
    if (layered) findings.push(layered);
    if (HAS_SUBGRID.test(file.text)) {
      // Already using the pattern, so the missed-primitive rule does not apply —
      // but the link-card mistake only exists *inside* a subgrid, so it is checked
      // here rather than skipped with everything else.
      const broken = linkCardFinding(file);
      if (broken) findings.push(broken);
      continue;
    }
    const signal = cardSignal(file.text);
    if (!signal) continue;
    // `.grid-auto` and `.grid` ARE framework classes, so a message implying no
    // framework layout was used would be wrong on exactly the sites that are
    // trying — and a linter that misreads what you wrote stops being read. The
    // point stands either way; only the framing changes.
    const usingGrid = /\bgrid-auto\b|class(?:Name)?="[^"]*\bgrid\b/.test(file.text);
    findings.push({
      file: file.path,
      line: signal.line,
      cls: signal.cls,
      severity: 'suggestion',
      reason:
        `${signal.evidence}, ${
          usingGrid
            ? 'laid out with a plain grid rather than a `subgrid`'
            : 'and nothing here is a `subgrid`'
        } — more than one card is what \`.subgrid\` is for. A plain grid aligns the outer boxes ` +
        "but not the tranches inside them, so the set's headings, bodies and footers land at " +
        'different heights',
      suggestion:
        '`<ul class="subgrid subgrid-cols-3" role="list">` with ' +
        '`<li class="card subgrid-card">` items (a set of cards is a list; `role="list"` is ' +
        'needed because `.subgrid` is markerless and Safari stops announcing a marker-less ' +
        '`ul` as a list); set `--subgrid-row-span` to the number of row bands each card ' +
        'contains. In Astro, `<Subgrid />` adds the role for you. If the items genuinely have ' +
        'no internal tranches to align (a bare image gallery), `.grid-auto` is the right call ' +
        'and this is a false positive',
    });
  }
  return findings;
}
