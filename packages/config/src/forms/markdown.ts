/**
 * Inline markdown for schema prose: backticks, `**strong**` and `*em*`, escaped first.
 *
 * Moved here from `@getvitops/generator`'s `docs.ts` (which re-exports it, so nothing that imports
 * it changed) because form renderers print the same `description` text under a field, and the
 * generator's main entry cannot load on a Worker.
 */
const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

/**
 * Sentinel for a lifted code span. Cannot occur in authored schema prose.
 *
 * Written as an ESCAPE, never as the literal byte. A raw NUL made the file `data` rather than
 * `text` to libmagic, so grep and ripgrep classified it as binary and silently skipped it.
 */
const CODE_SLOT = '\u0000';

/**
 * Render the inline markdown subset schema descriptions use, to escaped HTML.
 *
 * **Code spans are lifted out FIRST, and that is load-bearing rather than tidy.** A description may
 * name a family as `` `bg-*` `` and `` `text-*` `` — literal asterisk wildcards. Run emphasis over
 * the raw string and the `*` closing `bg-*` pairs with the one closing `text-*`, wrapping the text
 * between two unrelated utilities in `<em>` and eating both asterisks. Lifting code spans first
 * makes emphasis structurally unable to see inside them.
 */
export const renderInlineMarkdown = (s: string): string => {
  const spans: string[] = [];
  const lifted = s.replace(/`([^`]+)`/g, (_, body: string) => {
    spans.push(body);
    return `${CODE_SLOT}${spans.length - 1}${CODE_SLOT}`;
  });
  return (
    escapeHtml(lifted)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Single-asterisk emphasis, after strong so `**x**` is already consumed.
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(
        new RegExp(`${CODE_SLOT}(\\d+)${CODE_SLOT}`, 'g'),
        (_, i: string) => `<code>${escapeHtml(spans[Number(i)] ?? '')}</code>`,
      )
  );
};
