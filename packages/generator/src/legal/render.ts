/**
 * The legal documents are authored in markdown; consumers need markdown, HTML
 * and EmDash Portable Text. This parses the markdown **once** into a small block
 * model, and the three outputs render from that.
 *
 * The subset is **closed by construction** — we author every template, so the
 * parser does not need to be a markdown implementation, it needs to be exactly
 * as capable as the templates are. That is why it *throws* on anything outside
 * the subset rather than passing it through: an unrecognised construct that
 * silently degrades to a paragraph is how a published policy ends up with a
 * literal `| --- |` in it. A template that grows a table fails the test suite
 * instead.
 *
 * Supported, and nothing else:
 *   block   `#`/`##`/`###` headings, `- ` bullets, `> ` quote, paragraphs
 *   inline  `**strong**`, `` `code` ``, `[text](url)` links
 *
 * Links are the one addition made for a document that points somewhere (the accessibility statement's
 * feedback form and policy documents). The URL is carried through untouched and made safe at the
 * output: `nodesToHtml` runs every `href` through `safeHref`, which drops a `javascript:` URL and
 * leaves the text, and Portable Text does the same. Images stay outside the subset, and so do
 * tables: a template that grows one fails the test suite instead.
 *
 * HTML rendering delegates to `nodesToHtml` from `@getvitops/utils`, which
 * already solves escaping and void elements — this module maps to `ContentNode`
 * and stops there.
 */
import { nodesToHtml, type ContentNode } from '@getvitops/utils';
import { safeHref } from '@getvitops/utils/url';

export interface Span {
  text: string;
  strong?: boolean;
  code?: boolean;
  /** Present for a link; `text` is its label. */
  href?: string;
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; items: Span[][] }
  | { kind: 'quote'; spans: Span[] };

/** Constructs that look like markdown but are outside the subset. */
const UNSUPPORTED: [RegExp, string][] = [
  [/^#{4,}\s/, 'headings deeper than ###'],
  [/^\s*\d+[.)]\s/, 'ordered lists'],
  [/^\s*```/, 'code fences'],
  [/^\s*\|/, 'tables'],
  [/^\s*[*+]\s/, 'bullets other than `- `'],
  [/^\s+-\s/, 'nested lists'],
];

// Bold, code and link spans, in one pass so a `**` inside backticks stays literal.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function parseInline(text: string, where: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    if (token.startsWith('`')) spans.push({ text: token.slice(1, -1), code: true });
    else if (token.startsWith('[')) {
      // `![alt](src)` is an image, which would otherwise read as the text `!` followed by a link.
      if (text[m.index - 1] === '!')
        throw new Error(`legal template uses images, which are outside the subset: ${where}`);
      const link = LINK.exec(token)!;
      spans.push({ text: link[1]!, href: link[2]! });
    } else spans.push({ text: token.slice(2, -2), strong: true });
    last = m.index + token.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });

  // Check what's left as literal text, so `**bold**` doesn't trip the `*` guard
  // and a cookie name like `_ga` (already inside a code span) doesn't either.
  for (const span of spans) {
    if (span.strong || span.code || span.href != null) continue;
    if (/!\[/.test(span.text))
      throw new Error(`legal template uses images, which are outside the subset: ${where}`);
    // A link that did not match `[text](url)` — a space in the URL, say — is a template bug, not
    // prose: it would publish a literal bracket-and-paren string.
    if (/\[[^\]]*\]\(/.test(span.text))
      throw new Error(`legal template has a malformed link: ${where}`);
    if (span.text.includes('**'))
      throw new Error(`legal template has an unmatched \`**\`: ${where}`);
    if (span.text.includes('`'))
      throw new Error(`legal template has an unmatched backtick: ${where}`);
  }
  return spans;
}

/** Markdown (our subset) → blocks. Throws on anything it does not model. */
export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push({ kind: 'paragraph', spans: parseInline(text, text.slice(0, 60)) });
    paragraph = [];
  };

  for (const line of lines) {
    for (const [re, what] of UNSUPPORTED)
      if (re.test(line))
        throw new Error(`legal template uses ${what}, outside the subset: ${line}`);

    if (line.trim() === '') {
      flush();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        spans: parseInline(heading[2]!.trim(), line),
      });
      continue;
    }

    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: 'quote', spans: parseInline(quote[1]!.trim(), line) });
      continue;
    }

    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const item = parseInline(bullet[1]!.trim(), line);
      // Consecutive `- ` lines are one list; a blank line between them starts a
      // new one, which is what markdown means and what the templates rely on.
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === 'list') prev.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
      continue;
    }

    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

// ── ContentNode / HTML ──────────────────────────────────────────────────────────

function spanNodes(spans: Span[]): ContentNode[] {
  return spans.map((s) =>
    s.href != null
      ? { tag: 'a', attrs: { href: s.href }, text: s.text }
      : s.strong
        ? { tag: 'strong', text: s.text }
        : s.code
          ? { tag: 'code', text: s.text }
          : s.text,
  );
}

/**
 * Blocks → `ContentNode[]`, the framework-agnostic tree the site config already
 * uses for `templates` of type `nodes` and `NodeRenderer.astro` already renders.
 */
export function toContentNodes(blocks: Block[]): ContentNode[] {
  return blocks.map((b): ContentNode => {
    switch (b.kind) {
      case 'heading':
        return { tag: `h${b.level}`, children: spanNodes(b.spans) };
      case 'paragraph':
        return { tag: 'p', children: spanNodes(b.spans) };
      case 'quote':
        return { tag: 'blockquote', children: [{ tag: 'p', children: spanNodes(b.spans) }] };
      case 'list':
        return {
          tag: 'ul',
          children: b.items.map((item) => ({ tag: 'li', children: spanNodes(item) })),
        };
    }
  });
}

export function toHtmlFragment(blocks: Block[]): string {
  return nodesToHtml(toContentNodes(blocks));
}

// ── Portable Text (EmDash) ──────────────────────────────────────────────────────

/**
 * Blocks → EmDash Portable Text, matching the shape already seeded in
 * `packages/create/templates/emdash/seed/seed.json`.
 *
 * Two deliberate mappings:
 *  - the `# ` heading is **dropped** — in EmDash the page title is a field
 *    (`data.title`), and repeating it as the first content block renders twice;
 *  - the review blockquote becomes a `vitops_banner` with `tone: "warning"`,
 *    which is exactly the block the hand-written placeholder pages used.
 *
 * `_key`s are derived from position rather than randomness, so regenerating an
 * unchanged config produces an identical seed and a clean diff.
 */
export function toPortableText(blocks: Block[], prefix: string): unknown[] {
  const out: unknown[] = [];
  blocks.forEach((b, i) => {
    const key = `${prefix}-${i}`;
    if (b.kind === 'heading' && b.level === 1) return;

    if (b.kind === 'quote') {
      out.push({
        _type: 'vitops_banner',
        _key: key,
        message: b.spans.map((s) => s.text).join(''),
        tone: 'warning',
        dismissible: false,
      });
      return;
    }

    const block = (spans: Span[], k: string, extra: Record<string, unknown>) => {
      // A link is a mark that names an annotation in `markDefs`. An unsafe URL (`javascript:`) is
      // dropped, same as the HTML path: the label stays, the link does not.
      const markDefs: { _type: 'link'; _key: string; href: string }[] = [];
      const children = spans.map((s, j) => {
        const href = s.href != null ? safeHref(s.href) : undefined;
        const marks: string[] = [];
        if (s.strong) marks.push('strong');
        if (s.code) marks.push('code');
        if (href != null) {
          const _key = `${k}-${j}-link`;
          markDefs.push({ _type: 'link', _key, href });
          marks.push(_key);
        }
        return { _type: 'span', _key: `${k}-${j}`, text: s.text, marks };
      });
      return { _type: 'block', _key: k, markDefs, children, ...extra };
    };

    if (b.kind === 'list') {
      b.items.forEach((item, j) =>
        out.push(block(item, `${key}-${j}`, { style: 'normal', listItem: 'bullet', level: 1 })),
      );
      return;
    }

    out.push(block(b.spans, key, { style: b.kind === 'heading' ? `h${b.level}` : 'normal' }));
  });
  return out;
}
