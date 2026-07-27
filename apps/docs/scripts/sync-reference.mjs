/**
 * Sync the generated OKF docs bundle into Starlight's content collection.
 *
 * Source of truth is `generateDocs()` in @getvitops/generator — the same bundle
 * that `vitops docs <topic>` prints and that ships to WordPress consumers under
 * `<theme>/dist/docs/`. Rendering it live here means the site cannot claim
 * something the toolchain does not emit.
 *
 * Two shape differences to reconcile:
 *   • OKF reserves `index.md` for frontmatter-less directory listings. Starlight
 *     builds its own nav from the sidebar config, so those are dropped.
 *   • OKF concept docs carry extra frontmatter (`type`, `resource`, `tags`,
 *     `generator`) that Starlight has no use for. Its schema ignores unknown
 *     keys, but they're stripped anyway so the emitted pages stay legible, and a
 *     Starlight-native banner + sidebar order are added.
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
  ['authoring.md', 'design-system.json reference', 10],
  ['formats.md', 'Output formats', 20],
  ['concepts/color.md', 'Colour system', 30],
  ['concepts/scales.md', 'Type & space scales', 40],
  ['concepts/patterns.md', 'Component patterns', 50],
  ['css/classes.md', 'CSS class vocabulary', 60],
  ['bricks/elements.md', 'Bricks elements', 70],
];

const { generateDocs } = await import('@getvitops/generator');

// The generator's own package assets hold the Bricks PHP that the element
// reference is parsed from — resolve them the way the CLI does.
const assetsDir = join(dirname(require.resolve('@getvitops/generator/package.json')), 'assets');
const configPath = join(APP, '..', '..', 'src', 'design-system.json');
const ds = JSON.parse(readFileSync(configPath, 'utf8'));

const docs = generateDocs(ds, assetsDir);

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
    if (m) meta[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return [meta, md.slice(end + 4).replace(/^\n+/, '')];
}

const yaml = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const SLUG = new Map(PAGES.map(([path]) => [path, `/reference/${path.replace(/\//g, '-').replace(/\.md$/, '')}/`]));

/**
 * Rewrite the bundle's internal cross-links to Starlight URLs.
 *
 * The OKF bundle links by relative file path (`../authoring.md`) against a nested
 * tree; Starlight serves these pages flattened under /reference/. Links to the
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
    return slug ? `[${text}](${slug}${hash})` : whole;
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
  // Drop the body's leading H1: Starlight renders the frontmatter title as the
  // page heading, so keeping it would show the title twice.
  const withoutH1 = rewriteLinks(body.replace(/^#\s+.*\n+/, ''), path);

  const page = [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(meta.description ?? '')}`,
    'sidebar:',
    `  order: ${order}`,
    '---',
    '',
    ':::note[Generated page]',
    'Rendered from this project’s `design-system.json` by `@getvitops/generator`.',
    'Run `vitops docs` to print the same reference against **your** config.',
    ':::',
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
      '---',
      '',
      body,
    ].join('\n'),
  );
  written++;
}

console.log(`sync-reference: ${written} pages → ${OUT.replace(APP + '/', '')}/`);
