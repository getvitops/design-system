/**
 * Sync the generated OKF docs bundle into the site's `docs` content collection.
 *
 * Source of truth is `generateDocs()` in @getvitops/generator — the same bundle
 * that `vitops docs <topic>` prints and that ships to WordPress consumers under
 * `<theme>/dist/docs/`. Rendering it live here means the site cannot claim
 * something the toolchain does not emit.
 *
 * Two shape differences to reconcile:
 *   • OKF reserves `index.md` for frontmatter-less directory listings. The site
 *     builds its nav from the collection itself, so those are dropped.
 *   • OKF concept docs carry frontmatter the site has no use for (`type`,
 *     `resource`, `tags`, `generator`); it's replaced with the flat
 *     `section` / `order` / `generated` shape the docs collection expects.
 *     `generated: true` is what makes the layout render the "don't edit this"
 *     banner, so it must be set here rather than written into the body.
 *
 * Output is gitignored: regenerate with `vp run docs:sync` (or any docs task).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const OUT = join(APP, 'src', 'content', 'docs', 'reference');
const require = createRequire(import.meta.url);

/** Sidebar order + the human-facing title for each generated topic. */
const PAGES = [
  ['formats.md', 'Output formats', 20],
  ['concepts/color.md', 'Colour system', 30],
  ['concepts/scales.md', 'Type & space scales', 40],
  ['concepts/patterns.md', 'Component patterns', 50],
  ['concepts/icons.md', 'Icons', 55],
  ['concepts/consent.md', 'Consent gate', 60],
  ['concepts/tracking.md', 'Conversion tracking', 65],
  ['concepts/search.md', 'Search', 70],
  ['concepts/legal.md', 'Legal documents', 75],
  ['css/classes.md', 'CSS class vocabulary', 100],
  ['bricks/elements.md', 'Bricks elements', 110],
];

const { generateDocs } = await import('@getvitops/generator');

// The generator's own package assets hold the Bricks PHP that the element
// reference is parsed from — resolve them the way the CLI does.
const assetsDir = join(dirname(require.resolve('@getvitops/generator/package.json')), 'assets');
const configPath = join(APP, '..', '..', 'src', 'design-system.json');
const ds = JSON.parse(readFileSync(configPath, 'utf8'));

const docs = generateDocs(ds, assetsDir);

/**
 * Bundle docs the site deliberately does NOT carry as markdown.
 *
 * `concepts/components.md` is projected instead by the four pages under
 * `src/pages/components/`, one per tier. That inverts deliberately: the bundle keeps
 * all four tiers in ONE doc because an agent knows the pattern it needs and must be
 * told how the tiers compose, while a human arrives already knowing their stack and
 * wants only that tier's list. Carrying the combined doc here as well would publish
 * a fifth page saying the same thing in a worse shape.
 *
 * `config.md` and `authoring.md` are both rendered instead by
 * `src/pages/reference/config.astro`, which walks the same schema into a
 * filterable `<wc-tree>`. They overlapped as markdown — `themes.<name>` in the
 * config schema *is* a design system — and a 600-line flat bullet list is the
 * worst shape for 370 fields. The agent bundle still ships both, because
 * `vitops docs` prints to a terminal with no filter.
 *
 * Anything skipped must be reachable some other way; this is not a mute button.
 */
const RENDERED_ELSEWHERE = new Set(['config.md', 'authoring.md', 'concepts/components.md']);

/**
 * PAGES is an allowlist, so a doc the generator emits but nobody listed is simply
 * absent from the site — and the loop below only warns the other way round (a
 * listed page the generator dropped). That asymmetry silently cost the four
 * subsystem concept docs their public pages, while the run still reported success.
 *
 * Carrying a new doc is a deliberate editorial choice (it needs a title and a
 * sidebar position), so this can't be derived — but it must not be forgettable.
 */
const unlisted = Object.keys(docs).filter(
  (p) =>
    !p.endsWith('index.md') &&
    !RENDERED_ELSEWHERE.has(p) &&
    !PAGES.some(([listed]) => listed === p),
);
if (unlisted.length)
  throw new Error(
    `sync-reference: the generator emits ${unlisted.length} doc(s) this site does not carry:\n` +
      unlisted.map((p) => `  • ${p}`).join('\n') +
      `\n\nAdd each to PAGES (path, title, sidebar order) in ${'apps/docs/scripts/sync-reference.mjs'}.`,
  );

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** Strip the OKF frontmatter block and return `[meta, body]`. */
function splitFrontmatter(md) {
  if (!md.startsWith('---\n')) return [{}, md];
  const end = md.indexOf('\n---', 4);
  if (end === -1) return [{}, md];
  const meta = {};
  for (const line of md.slice(4, end).split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    // Unescape `\"` on the way in. The OKF frontmatter is a quoted YAML scalar, so
    // a description containing a double quote arrives escaped; leaving it escaped
    // meant `yaml()` re-escaped the backslash and the emitted string terminated
    // early, failing the content sync with a YAML indentation error.
    if (m) meta[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
  }
  return [meta, md.slice(end + 4).replace(/^\n+/, '')];
}

const yaml = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const SLUG = new Map(PAGES.map(([path]) => [path, `/reference/${path.replace(/\//g, '-').replace(/\.md$/, '')}/`]));

/**
 * The two schema references resolve into the one interactive page that replaced
 * them — each at the section it actually documents, since the config tree carries
 * all three as top-level anchors:
 *
 *   - `authoring.md` documented `design-system.json`, so it lands on
 *     `#designSystem`. A link labelled "every design-system.json field" that
 *     dropped a reader at the top of a 370-field tree would technically resolve
 *     and still be wrong.
 *   - `config.md` is the whole document, so it lands on the page.
 *
 * Without this, four carried pages (`concepts/color`, `concepts/scales`,
 * `concepts/patterns`, `css/classes`) keep their `../authoring.md` href verbatim —
 * a literal `.md` link that 404s, which is the silent breakage the rewriter exists
 * to prevent.
 */
SLUG.set('authoring.md', '/reference/config/#designSystem');
SLUG.set('config.md', '/reference/config/');
// The combined tier doc lands on the section that projects it, since no single tier
// page is the whole document. A carried page linking `components.md` gets the
// overview, which is the only place all four tiers are named together.
SLUG.set('concepts/components.md', '/components/');

/**
 * Rewrite the bundle's internal cross-links to site URLs.
 *
 * The OKF bundle links by relative file path (`../authoring.md`) against a nested
 * tree; the site serves these pages flattened under /reference/. Links to the
 * reserved `index.md` listings are unwrapped to plain text — those pages aren't
 * carried over, because the sidebar already does that job.
 */
function rewriteLinks(md, fromPath) {
  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  return md.replace(/\[([^\]]+)\]\(([^)\s]+\.md)(#[^)\s]*)?\)/g, (whole, text, target, hash = '') => {
    const segs = (fromDir ? `${fromDir}/${target}` : target).split('/');
    const stack = [];
    for (const s of segs) {
      if (s === '..') stack.pop();
      else if (s !== '.' && s !== '') stack.push(s);
    }
    const resolved = stack.join('/');
    if (resolved.endsWith('index.md')) return text; // listing page — no equivalent here
    const slug = SLUG.get(resolved);
    if (!slug) return whole;
    // A slug may already carry an anchor (the schema references land on a section
    // of the config tree). A source hash is more specific, so it wins; otherwise
    // keep the slug's. Appending blindly would emit `#designSystem#colors`.
    const href = hash ? `${slug.replace(/#.*$/, '')}${hash}` : slug;
    return `[${text}](${href})`;
  });
}

let written = 0;

for (const [path, title, order] of PAGES) {
  const src = docs[path];
  if (!src) {
    console.warn(`sync-reference: generator emitted no "${path}" — skipping`);
    continue;
  }
  const [meta, body] = splitFrontmatter(src);
  // Drop the body's leading H1: the layout renders the frontmatter title as the
  // page heading, so keeping it would show the title twice.
  const withoutH1 = rewriteLinks(body.replace(/^#\s+.*\n+/, ''), path);

  const page = [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(meta.description ?? '')}`,
    'section: "Reference"',
    `order: ${order}`,
    'generated: true',
    '---',
    '',
    withoutH1,
  ].join('\n');

  const dest = join(OUT, path.replace(/\//g, '-'));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, page);
  written++;
}

// The curated toolchain changelog, surfaced as a page rather than duplicated.
const changelogSrc = join(APP, '..', '..', 'CHANGELOG.md');
if (existsSync(changelogSrc)) {
  const body = readFileSync(changelogSrc, 'utf8').replace(/^#\s+.*\n+/, '');
  writeFileSync(
    join(APP, 'src', 'content', 'docs', 'changelog.md'),
    [
      '---',
      'title: "Changelog"',
      'description: "Release notes for the @getvitops/* packages — what changed, what broke, and how to migrate."',
      'section: "Releases"',
      'order: 10',
      '---',
      '',
      body,
    ].join('\n'),
  );
  written++;
}

console.log(`sync-reference: ${written} pages → ${OUT.replace(APP + '/', '')}/`);
