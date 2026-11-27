/**
 * Post-build CSS purge: drop rules no prerendered page uses.
 *
 * The tailwind format inlines every pattern partial into `@layer components`, which Tailwind never
 * prunes, so a site ships the carousel, tree and combobox rules whether or not a page has one.
 * The scan runs against the **built** HTML because some classes (`masthead--glass`,
 * `sitenav--bp-lg`) are assembled from template strings and never appear literally in source, and
 * against the web-component bundles because they add classes at runtime (`entries__nav`,
 * `combobox--enhanced`).
 *
 * The purged sheet is written under a new hashed name and only the prerendered pages are
 * repointed. The original stays for on-demand routes (CMS pages, admin), which render at request
 * time from a server chunk that still names it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DYNAMIC_ATTRIBUTES, SAFELIST, extractor } from './safelist.ts';

export { DYNAMIC_ATTRIBUTES, SAFELIST, extractor } from './safelist.ts';

export interface PurgeInput {
  css: string;
  /** Built HTML documents. */
  html: string[];
  /** Runtime scripts that add classes the HTML never carries. */
  js?: string[];
}

/** Purge one stylesheet. `purgecss` is loaded lazily so importing this module stays cheap. */
export async function purgeStylesheet(input: PurgeInput): Promise<string> {
  const { PurgeCSS } = await import('purgecss');
  const [result] = await new PurgeCSS().purge({
    content: [
      ...input.html.map((raw) => ({ raw, extension: 'html' })),
      ...(input.js ?? []).map((raw) => ({ raw, extension: 'js' })),
    ],
    css: [{ raw: input.css }],
    defaultExtractor: extractor,
    // Keep every @keyframes / @font-face / custom property: tokens are referenced by name from
    // rules this scan cannot see (inline styles, other sheets).
    keyframes: false,
    fontFace: false,
    variables: false,
    safelist: {
      greedy: [...SAFELIST.greedy],
      standard: [...SAFELIST.standard],
    },
    dynamicAttributes: [...DYNAMIC_ATTRIBUTES],
  });
  return result?.css ?? input.css;
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, ext, out);
    else if (path.endsWith(ext)) out.push(path);
  }
  return out;
}

export interface PurgeSheetReport {
  href: string;
  next: string;
  before: number;
  after: number;
}

export interface PurgeBuildOptions {
  /** The built client output (`dist/client`, or `dist`). */
  clientDir: string;
  /** Where the web-component bundles live, relative to `clientDir`. Default `vitops`. */
  scriptsDir?: string;
}

/**
 * Purge every `/_astro/*.css` the prerendered pages link, and repoint those pages. Returns what it
 * did; an empty list means there was nothing to do (no HTML, or no linked sheets).
 */
export async function purgeBuildOutput(options: PurgeBuildOptions): Promise<PurgeSheetReport[]> {
  const { clientDir } = options;
  const pages = new Map(walk(clientDir, '.html').map((file) => [file, readFileSync(file, 'utf8')]));
  if (!pages.size) return [];

  const linked = new Set<string>();
  for (const html of pages.values())
    for (const match of html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)) linked.add(match[1]!);

  // The theme editor is tooling and its classes are not on any visitor-facing page.
  const js = walk(join(clientDir, options.scriptsDir ?? 'vitops'), '.js')
    .filter((file) => !/[\\/]editor\.js$/.test(file))
    .map((file) => readFileSync(file, 'utf8'));
  const html = [...pages.values()];

  const reports: PurgeSheetReport[] = [];
  for (const href of linked) {
    const file = join(clientDir, href);
    if (!existsSync(file)) continue;
    const css = readFileSync(file, 'utf8');
    const out = await purgeStylesheet({ css, html, js });
    const hash = createHash('sha256').update(out).digest('hex').slice(0, 8);
    const next = href.replace(/\.css$/, `.p${hash}.css`);
    writeFileSync(join(clientDir, next), out);
    reports.push({ href, next, before: css.length, after: out.length });
  }

  for (const [file, text] of pages) {
    let updated = text;
    for (const { href, next } of reports) updated = updated.split(href).join(next);
    if (updated !== text) writeFileSync(file, updated);
  }
  return reports;
}
