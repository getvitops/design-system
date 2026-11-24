/**
 * Serialise a JSON-LD object for inlining in a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not safe there: the HTML parser ends a script element at the first
 * `</script`, whatever JSON string it sits inside, so a review, FAQ answer or forum post
 * containing `</script><script>…` would break out and run. The escapes below are still valid
 * JSON (`<` parses back to `<`), so search engines read the same document.
 *
 * U+2028/U+2029 are escaped too: they are legal in JSON but were line terminators in JS source
 * before ES2019, and this string is also embedded in HTML contexts that predate that.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}
