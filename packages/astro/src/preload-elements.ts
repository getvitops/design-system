/**
 * `modulepreload` hints for the `<wc-*>` elements a prerendered page uses.
 *
 * The on-demand loader finds a tag, imports `elements/<tag>.js`, which imports Lit's chunk, which
 * imports its helpers: each hop is a round trip the browser could not start until the one before
 * landed. A page that is prerendered already says which tags it uses, so the build can hand the
 * browser the whole closure up front (`elements/manifest.json`, emitted by `@getvitops/core`).
 * Pages rendered on demand skip this and simply rely on the loader.
 */

export interface ElementManifestEntry {
  file: string;
  /** Chunks the module imports statically, transitively, relative to the bundle root. */
  imports: string[];
  dependencies: string[];
}

export type ElementManifest = Record<string, ElementManifestEntry>;

/** The owned `<wc-*>` tags in a page's markup. */
export function usedTags(html: string, manifest: ElementManifest): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/<(wc-[a-z0-9-]+)[\s>/]/g)) if (m[1]! in manifest) found.add(m[1]!);
  return [...found];
}

/** Every file those tags need, dependencies included, in a stable order. */
export function preloadFiles(tags: string[], manifest: ElementManifest): string[] {
  const files = new Set<string>();
  const seen = new Set<string>();
  const visit = (tag: string) => {
    const entry = manifest[tag];
    if (!entry || seen.has(tag)) return;
    seen.add(tag);
    files.add(entry.file);
    for (const chunk of entry.imports) files.add(chunk);
    for (const dep of entry.dependencies) visit(dep);
  };
  for (const tag of tags) visit(tag);
  return [...files].sort();
}

/**
 * Add the hints before `</head>`. Returns the input unchanged when the page loads no element
 * script, has no `<wc-*>` it owns, or already carries the hints (a second run changes nothing).
 */
export function injectElementPreloads(
  html: string,
  manifest: ElementManifest,
  base: string,
): string {
  if (!html.includes(`${base}/loader.js`)) return html;
  const files = preloadFiles(usedTags(html, manifest), manifest);
  if (!files.length) return html;
  const links = files
    .map((file) => `${base}/${file}`)
    .filter((href) => !html.includes(`rel="modulepreload" href="${href}"`))
    .map((href) => `<link rel="modulepreload" href="${href}">`)
    .join('');
  if (!links) return html;
  const at = html.indexOf('</head>');
  return at < 0 ? html : `${html.slice(0, at)}${links}${html.slice(at)}`;
}
