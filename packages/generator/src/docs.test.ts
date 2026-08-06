import { describe, expect, it } from 'vitest';
import { generateDocs } from './docs.ts';
import { defaultConfig } from './index.ts';
import { BASE_HOOK, TW_CLASH } from './shared.ts';
import { TIER_NAMES, tierPatterns } from './tiers.ts';

// A nonexistent assetsDir is fine: renderElementsDoc guards with existsSync and
// emits an (empty) element reference, so no built package assets are required.
const docs = () => generateDocs(defaultConfig(), '/nonexistent-assets');

describe('generateDocs bundle', () => {
  it('emits exactly the expected OKF tree', () => {
    expect(Object.keys(docs()).sort()).toEqual(
      [
        'index.md',
        'authoring.md',
        'config.md',
        'formats.md',
        'concepts/index.md',
        'concepts/color.md',
        'concepts/scales.md',
        'concepts/patterns.md',
        'concepts/components.md',
        'concepts/icons.md',
        'concepts/consent.md',
        'concepts/tracking.md',
        'concepts/search.md',
        'concepts/legal.md',
        'css/index.md',
        'css/classes.md',
        'bricks/index.md',
        'bricks/elements.md',
      ].sort(),
    );
  });

  it('follows OKF frontmatter rules for every entry', () => {
    for (const [path, content] of Object.entries(docs())) {
      if (path.endsWith('index.md')) {
        expect(content.startsWith('---'), `${path} must not have frontmatter`).toBe(false);
      } else {
        expect(content.startsWith('---\n'), `${path} must start with frontmatter`).toBe(true);
        const fm = content.split('---')[1] ?? '';
        expect(fm, `${path} frontmatter needs a non-empty type`).toMatch(/^type: ".+"$/m);
      }
    }
  });

  it('is deterministic', () => {
    expect(docs()).toEqual(docs());
  });

  it('formats.md lists every TW_CLASH utility (no-drift guarantee)', () => {
    const formats = docs()['formats.md']!;
    for (const cls of TW_CLASH) expect(formats, `missing \`${cls}\``).toContain(`\`${cls}\``);
  });

  /**
   * The config reference is the only documentation of the three-section shape that
   * cannot fall behind the schema, so what is pinned is that it actually walked it:
   * all three sections present, and fields from each rendered underneath.
   */
  it('config.md walks the config JSON Schema (all three sections)', () => {
    const config = docs()['config.md']!;
    for (const section of ['designSystem', 'organization', 'site'])
      expect(config, `missing section \`${section}\``).toContain(`## \`${section}\``);
    // One field from each of the two sections the restructure created — if the
    // walker rendered headings but no children, these are what go missing.
    for (const field of ['defaultLocale', 'analytics', 'legal', 'locations', 'services'])
      expect(config, `missing field \`${field}\``).toContain(`### \`${field}\``);
    // It must NOT inline the whole design-system schema a second time.
    expect(config).toContain('[authoring.md](authoring.md)');
  });

  /**
   * `themes` is a map whose value node IS the design-system schema, so the default
   * walk happily re-emitted every token field under `## designSystem` — directly
   * beneath a sentence claiming "Only the wrapper is listed here". The two
   * references then documented the same fields twice, and config.md was 4x the
   * length of the page it delegates to.
   *
   * Pinned by a description that belongs to a design-system leaf: it must appear in
   * authoring.md and must NOT appear in config.md.
   */
  it('config.md delegates the token fields to authoring.md instead of copying them', () => {
    const bundle = docs();
    const leaf = 'Anchor size (a CSS length'; // typeScale.base / spaceScale.base
    expect(bundle['authoring.md']!, 'authoring.md should own the token fields').toContain(leaf);
    expect(bundle['config.md']!, 'config.md must not re-emit them').not.toContain(leaf);
    // The wrapper's own three fields still have to be there.
    for (const field of ['themes', 'defaultTheme', 'defaultColorScheme'])
      expect(bundle['config.md']!).toContain(`### \`${field}\``);
  });

  it('authoring.md walks the JSON Schema (top-level sections + descriptions)', () => {
    const authoring = docs()['authoring.md']!;
    for (const key of [
      'colors',
      'shadows',
      'fonts',
      'typeScale',
      'spaceScale',
      'patterns',
      'typography',
      'animations',
    ])
      expect(authoring).toContain(`## \`${key}\``);
    // A known nested description proves the walker reads jsonSchema, not a copy.
    expect(authoring).toContain('the seed is preserved at its natural step');
    expect(authoring).not.toContain('## `$schema`');
  });

  /**
   * A concept doc nothing links to is a doc no agent finds: the bundle is navigated
   * from the index listings, not by globbing. Derived from the bundle keys so adding
   * a concept without listing it fails here rather than shipping undiscoverable.
   */
  it('concepts/index.md links every concept doc', () => {
    const bundle = docs();
    const index = bundle['concepts/index.md']!;
    for (const path of Object.keys(bundle)) {
      const m = /^concepts\/(?!index\.md$)(.+\.md)$/.exec(path);
      if (m) expect(index, `concepts/index.md must link ${path}`).toContain(`(${m[1]})`);
    }
  });

  /**
   * The subsystem concept docs exist to carry invariants whose failure modes are
   * SILENT — a gate that fetches anyway, a consent call that never prompts, an
   * Indexing API call that violates Google's terms, a policy naming the wrong
   * processor. Prose can be freely reworded; losing one of these claims is what
   * makes the doc actively harmful, so each is pinned.
   */
  describe('subsystem concept docs keep their load-bearing warnings', () => {
    const cases: Record<string, string[]> = {
      'concepts/consent.md': [
        'type="text/plain"', // the gate is inert markup, not a polite request
        'Never give a gated tag a live', // the one-line version of the same rule
        'permanent no-op', // granted() without require() never prompts
        'store freely', // an absent gate is not "denied"
        'not a synonym for "declined"', // null is a third value
      ],
      'concepts/tracking.md': [
        '`require()`', // the bug that shipped: granted() was passive
        'never interrupted', // organic visitors raise no banner
        'synchronous', // the read cannot be deferred; only the write waits
        'wrangler email sending enable', // the un-checkable prerequisite
      ],
      'concepts/search.md': [
        'read-only', // URL Inspection cannot request indexing
        'Do not add it.', // the Indexing API is a terms violation
        'not a nice-to-have, it is the mechanism', // lastmod
        'submitted and ignored', // a stale IndexNow key returns 202
        'Write the snapshot last', // an eager write silently strands pages
        'no user/permission API', // fullUserGroup is a reminder, never automated
      ],
      'concepts/legal.md': [
        'the template owns prose', // the governing rule
        'corrected config', // hand-edits are overwritten
        'meaningfully different from', // cookies: [] asserts cookieless
        'do not reuse it', // ca/PIPEDA prose is jurisdiction-specific
      ],
    };
    // Collapse whitespace on both sides: these docs are prose the formatter reflows,
    // so a claim spanning a line break is still present. Asserting on the raw string
    // would fail on a rewrap that changed nothing.
    const flat = (s: string) => s.replace(/\s+/g, ' ');
    for (const [path, claims] of Object.entries(cases))
      it(path, () => {
        const doc = flat(docs()[path]!);
        for (const claim of claims) expect(doc, `lost: "${claim}"`).toContain(flat(claim));
      });
  });

  it('concepts/patterns.md documents every BASE_HOOK override var', () => {
    const patterns = docs()['concepts/patterns.md']!;
    for (const [prop, sfx] of Object.entries(BASE_HOOK)) {
      expect(patterns).toContain(`\`${prop}\``);
      expect(patterns).toContain(`\`--${sfx}-<pattern>\``);
    }
  });

  /**
   * The components doc is the ONLY agent-facing account of the four tiers, so the
   * guards are about completeness and about the one thing that is invisible when
   * wrong: the composition. A tier missing from it doesn't error, it just leaves an
   * agent hand-writing markup a component already emits.
   */
  describe('concepts/components.md', () => {
    const doc = () => docs()['concepts/components.md']!;

    it('carries every pattern in the manifest', () => {
      const md = doc();
      for (const name of TIER_NAMES)
        expect(md, `pattern \`${name}\` missing`).toContain(`\`${name}\``);
    });

    it('carries all four tiers, not just the one a reader asked about', () => {
      const md = doc();
      // Each tier's own detail table, keyed on something only that table emits.
      for (const { entry } of tierPatterns('wc'))
        expect(md, `tag missing`).toContain(`\`<${entry.wc!.tag}>\``);
      for (const { entry } of tierPatterns('astro'))
        for (const a of entry.astro!)
          expect(md, `component missing`).toContain(`\`${a.component}\``);
      for (const { entry } of tierPatterns('bricks'))
        expect(md, `element missing`).toContain(`\`${entry.bricks!}\``);
      for (const { entry } of tierPatterns('css'))
        if (entry.css.partial) expect(md, `partial missing`).toContain(`\`${entry.css.partial}\``);
    });

    it('warns against composing two tiers by hand', () => {
      // The failure the single projection exists to prevent — an agent that read
      // only about the Astro tier would never learn this.
      expect(doc()).toContain('`<wc-tree><Tree /></wc-tree>`');
    });

    it('says where each web component ships, including nowhere', () => {
      const md = doc();
      expect(md).toContain('`elements.js`');
      expect(md).toContain('`@getvitops/core/consent`');
      expect(md).toContain('`@getvitops/core/editor`');
      expect(md).toContain('registered but in no bundle');
    });

    /**
     * `TIERS.css.generated` is a fact about this repo's reference config, not about
     * a consumer's. `defaultConfig()` ships only btn/cta/card, so most generated
     * patterns are absent here — and a doc that listed their classes without saying
     * so would name classes the consumer's build emits nothing for.
     */
    it('flags config-authored patterns this config does not declare', () => {
      const md = doc();
      expect(md).toContain('absent from this config — no CSS emitted');
      // `card` IS in defaultConfig(), so it must not be flagged. Scope to the CSS
      // table: the overview table has a `| \`card\` |` row too, and it carries no
      // config column, so an unscoped search finds the wrong row and always fails.
      const cssTable = md.slice(md.lastIndexOf('\n## CSS\n'));
      const cardRow = cssTable.split('\n').find((l) => l.startsWith('| `card` |'));
      expect(cardRow, 'no CSS row for `card`').toBeDefined();
      expect(cardRow).toContain('declared');
      expect(cardRow).not.toContain('absent from this config');
    });

    it('never breaks a table with an unescaped pipe', () => {
      // `use` strings are prose and may contain a pipe; one would silently split a
      // column and shift every cell after it.
      for (const line of doc().split('\n'))
        if (line.startsWith('| `'))
          expect(
            line.replace(/\\\|/g, '').split('|').length - 1,
            `wrong cell count: ${line}`,
          ).toBeGreaterThanOrEqual(3);
    });
  });
});
