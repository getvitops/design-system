/**
 * What the accessibility statement SAYS, and whether the document itself is accessible.
 *
 * Two halves. The first pins that it asserts only what the config declares: a public statement about
 * people's ability to use a site must not claim a test that was not run or a statute that does not
 * apply. The second holds the document to the Level AAA content criteria it asks the reader to trust
 * (reading level, abbreviations, unusual words, link purpose, headings), over **every combination of
 * optional sections**, so a later edit cannot lose one in a configuration nobody tried.
 *
 * Automation reaches only part of AAA, and these tests are a guard rather than proof: the reading-level
 * check in particular is a heuristic. A screen reader and keyboard pass by a person stays in the
 * `vitops-accessibility` skill's pre-publish checklist.
 */
import { describe, expect, test } from 'vite-plus/test';
import { GENERIC_LINK_TEXT, validateConfig, type Config } from '../config.ts';
import { enabledDocs, generateLegal, renderMarkdown } from './index.ts';
import { parseMarkdown, toHtmlFragment, toPortableText, type Block } from './render.ts';
import { statementConfig, type Statement } from './statement-fixture.ts';
import { DOC_SLUGS } from './templates/index.ts';

const md = (cfg: Config) => renderMarkdown(cfg, 'accessibility');

describe('the statement asserts only what the config declares', () => {
  test('an empty statement makes no claim: no conformance, no test date, no statute, no tested software', () => {
    const out = md(statementConfig());
    expect(out).not.toMatch(/fully meets|partly meets|last tested/);
    expect(out).not.toContain('AODA');
    expect(out).not.toContain('High contrast');
    expect(out).not.toMatch(/NVDA|JAWS|VoiceOver|TalkBack/);
    expect(out).toContain('We are not aware of any current accessibility problems');
    // It still states the goal, from `site.accessibility` (default WCAG 2.1 AA).
    expect(out).toContain(
      'aims to meet the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA',
    );
  });

  test('uses the declared standard and level, and names no level when there is no target', () => {
    const out = md(statementConfig({}, { accessibility: { standard: 'wcag20', level: 'AAA' } }));
    expect(out).toContain('(WCAG) 2.0, Level AAA');
    expect(md(statementConfig({}, { accessibility: { level: 'none' } }))).not.toMatch(
      /Level (A|AA|AAA)\b/,
    );
  });

  test('a conformance claim appears only with conformance, and says what it means', () => {
    const base = { testedOn: '2026-10-01' } as const;
    expect(md(statementConfig({ ...base, conformance: 'full' }))).toContain(
      'fully meets this standard',
    );
    const partial = md(statementConfig({ ...base, conformance: 'partial' }));
    expect(partial).toContain('partly meets this standard');
    expect(partial).toContain('We last tested the website on October 1, 2026.');
  });

  test('AODA wording needs law: "aoda", and the mandatory sentence names the version the AODA requires', () => {
    expect(md(statementConfig({ law: 'aoda' }))).toContain(
      'Accessibility for Ontarians with Disabilities Act (AODA)',
    );
    const mandatory = md(statementConfig({ law: 'aoda', mandatory: true }));
    expect(mandatory).toContain('The AODA requires our organization to meet WCAG 2.0 Level AA.');
    expect(md(statementConfig({ mandatory: true }))).toContain('The law requires our organization');
    expect(md(statementConfig({ mandatory: true }))).not.toContain('AODA');
  });

  test('the high-contrast note appears iff the site ships the toggle', () => {
    expect(md(statementConfig({}, { accessibility: { contrastToggle: true } }))).toContain(
      'This website has a "High contrast" option',
    );
    expect(md(statementConfig({}, { accessibility: { contrastToggle: false } }))).not.toContain(
      'High contrast',
    );
  });

  test('"tested with" lists appear only when stated, and then replace the build target', () => {
    const out = md(
      statementConfig({
        testedWith: { browsers: ['Firefox'], assistiveTech: ['NVDA on Windows'] },
      }),
    );
    expect(out).toContain('We tested the website in Firefox.');
    expect(out).toContain('- NVDA on Windows');
    expect(out).not.toContain('current and previous major versions');
  });

  test('acceptedRisk is internal and never published, in any output', () => {
    const cfg = statementConfig(
      { conformance: 'partial', testedOn: '2026-10-01' },
      { accessibility: { level: 'AA', acceptedRisk: 'SECRET-RISK J. Smith 2026-11-11' } },
    );
    for (const output of ['md', 'html', 'portable-text'] as const)
      expect(JSON.stringify(generateLegal(cfg, { output })), output).not.toContain('SECRET-RISK');
  });

  test('limitations list the other way to do it and the planned fix', () => {
    const out = md(
      statementConfig({
        limitations: [
          {
            content: 'Booking widget',
            issue: 'It needs a mouse',
            alternative: 'Call us',
            plannedFix: 'Spring',
          },
        ],
      }),
    );
    expect(out).toContain(
      '- **Booking widget**: It needs a mouse. Another way: Call us. Planned fix: Spring.',
    );
    expect(out).not.toContain('not aware of any current');
  });

  test('policies: a link when there is a URL, "on request" otherwise, and nothing when undeclared', () => {
    expect(md(statementConfig())).not.toContain('Accessibility policies and plans');
    expect(md(statementConfig({ policiesOnRequest: true }))).toContain('available on request');
    const out = md(
      statementConfig({
        policies: [
          { title: 'Accessibility policy', url: 'https://acme.example/p' },
          { title: 'Plan' },
        ],
      }),
    );
    expect(out).toContain('- [Accessibility policy](https://acme.example/p)');
    expect(out).toContain('- Plan (available on request)');
  });

  test('response time is stated only when given, with the right plural', () => {
    expect(md(statementConfig())).toContain('We will reply as soon as we can');
    expect(md(statementConfig({ responseDays: 1 }))).toContain('within 1 business day ');
    expect(md(statementConfig({ responseDays: 5 }))).toContain('within 5 business days');
  });

  test('a full stop is not doubled when a value already ends with one', () => {
    const out = md(
      statementConfig({
        testedOn: '2026-10-01',
        testing: ['external-audit'],
        auditor: 'Example Audit Co.',
      }),
    );
    expect(out).toContain('an outside audit by Example Audit Co.\n');
    expect(out).not.toContain('..');
  });

  test('markdown in a config value cannot break out of the document', () => {
    const cfg = statementConfig({
      limitations: [{ content: '**x** [y](https://evil.example)', issue: 'a `b` *c*' }],
      feedbackOwner: 'the **web** team',
    });
    const html = toHtmlFragment(parseMarkdown(md(cfg)));
    // The characters are stripped, so the text survives but never becomes a link.
    expect(html).not.toContain('href="https://evil');
    expect(html).not.toContain('<em>');
  });

  test('is a registered document under both jurisdictions, with its own file name', () => {
    expect(DOC_SLUGS.accessibility).toBe('accessibility-statement');
    for (const jurisdiction of ['ca', 'qc'] as const) {
      const cfg = statementConfig(
        {},
        {
          legal: { jurisdiction, accessibilityStatement: { enabled: true } },
        },
      );
      expect(enabledDocs(cfg)).toEqual(['accessibility']);
      expect(Object.keys(generateLegal(cfg, { output: 'html' }))).toEqual([
        'accessibility-statement.html',
      ]);
    }
  });
});

// ── The document is held to Level AAA content criteria ──────────────────────────

/** Syllables by vowel groups: crude, but stable, and the same crudeness on every run. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

const spanText = (spans: { text: string }[]) => spans.map((s) => s.text).join('');

/** Prose only: not headings, the review banner, or contact data (an email is not a sentence). */
function proseSentences(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'paragraph') out.push(...spanText(b.spans).split(/(?<=[.!?])\s+/));
    if (b.kind === 'list')
      for (const item of b.items) {
        const t = spanText(item);
        if (!/^(Email|Phone|Mail|In person):/.test(t)) out.push(t);
      }
  }
  return out.filter((s) => s.trim().length > 0);
}

/** Flesch-Kincaid grade. A heuristic: it catches a regression, it cannot prove WCAG 3.1.5. */
function gradeLevel(sentences: string[]): number {
  const words = sentences.flatMap((s) => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)));
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

type Patch = (st: Partial<Statement>) => Partial<Statement>;

/** Each feature switches one group of optional sections on. All keep the config valid. */
const FEATURES: Patch[] = [
  (st) => ({ ...st, law: 'aoda' }),
  (st) => ({ ...st, mandatory: true }),
  (st) => ({
    ...st,
    conformance: 'partial',
    testedOn: '2026-10-01',
    limitations: [
      {
        content: 'Online booking widget',
        issue: 'It cannot be used with a keyboard only',
        alternative: 'Book by phone',
        plannedFix: 'We are reviewing vendors',
      },
    ],
  }),
  (st) => ({
    ...st,
    testedOn: '2026-10-01',
    testing: ['automated', 'keyboard', 'screen-reader', 'external-audit'],
    auditor: 'Example Audit Co.',
  }),
  (st) => ({
    ...st,
    testedWith: {
      browsers: ['Chrome', 'Firefox'],
      assistiveTech: ['NVDA on Windows', 'VoiceOver on iPhone'],
    },
  }),
  (st) => ({
    ...st,
    formats: ['large print', 'accessible PDF'],
    supports: ['captioning'],
    inPerson: '1 Elgin St, weekdays 9 to 5',
    responseDays: 3,
  }),
  (st) => ({
    ...st,
    feedbackUrl: 'https://acme.example/feedback',
    feedbackOwner: 'our web manager',
  }),
  (st) => ({
    ...st,
    policies: [
      { title: 'Accessibility policy', url: 'https://acme.example/policy' },
      { title: 'Accessible customer service policy' },
    ],
  }),
  (st) => ({ ...st, policiesOnRequest: true }),
  (st) => ({ ...st, lastUpdated: '2026-11-01', reviewCadence: 'annually' }),
];

function combinations(): { label: string; cfg: Config }[] {
  const out: { label: string; cfg: Config }[] = [];
  for (let mask = 0; mask < 1 << FEATURES.length; mask++)
    for (const toggle of [false, true]) {
      let st: Partial<Statement> = {};
      FEATURES.forEach((f, i) => {
        if (mask & (1 << i)) st = f(st);
      });
      out.push({
        label: `features ${mask.toString(2).padStart(FEATURES.length, '0')}, toggle ${toggle}`,
        cfg: statementConfig(st, { accessibility: { contrastToggle: toggle } }),
      });
    }
  return out;
}

describe('Level AAA content criteria hold for every combination of sections', () => {
  const all = combinations();

  test('covers every combination, and every one is a valid config', () => {
    expect(all.length).toBe((1 << FEATURES.length) * 2);
    for (const { label, cfg } of all) expect(validateConfig(cfg).ok, label).toBe(true);
  });

  test('3.1.5 reading level: at or below grade 9 everywhere, and well under it on average', () => {
    let total = 0;
    for (const { label, cfg } of all) {
      const grade = gradeLevel(proseSentences(parseMarkdown(md(cfg))));
      expect(grade, label).toBeLessThanOrEqual(9);
      total += grade;
    }
    expect(total / all.length).toBeLessThan(8.5);
  });

  test('3.1.4 abbreviations: AODA and WCAG are spelled out where first used', () => {
    const expansions: [string, string][] = [
      ['AODA', 'Accessibility for Ontarians with Disabilities Act ('],
      ['WCAG', 'Web Content Accessibility Guidelines ('],
    ];
    for (const { label, cfg } of all) {
      const text = md(cfg)
        .split('\n')
        .filter((l) => !l.startsWith('>'))
        .join('\n');
      for (const [abbr, spelled] of expansions) {
        const first = text.indexOf(abbr);
        if (first === -1) continue;
        expect(first, `${abbr}, ${label}`).toBe(text.indexOf(spelled) + spelled.length);
      }
    }
  });

  test('3.1.3 unusual words: "screen reader" and "assistive technology" are explained at first use', () => {
    for (const { label, cfg } of all) {
      const text = md(cfg);
      const sr = text.indexOf('screen reader');
      expect(sr, label).toBeGreaterThan(-1);
      expect(text.slice(sr, sr + 70), label).toContain('(software that reads the screen aloud)');
      expect(text, label).toContain(
        'Assistive technology is software or equipment that helps people use a computer',
      );
    }
  });

  test('2.4.9 link purpose: no generic link text, and one text never points two places', () => {
    for (const { label, cfg } of all) {
      const html = toHtmlFragment(parseMarkdown(md(cfg)));
      const links = [...html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => ({
        href: m[1]!,
        text: m[2]!,
      }));
      const seen = new Map<string, string>();
      for (const l of links) {
        expect(l.text.trim().length, label).toBeGreaterThan(0);
        expect(GENERIC_LINK_TEXT.test(l.text.trim()), `${l.text}, ${label}`).toBe(false);
        expect(seen.get(l.text) ?? l.href, `${l.text}, ${label}`).toBe(l.href);
        seen.set(l.text, l.href);
      }
    }
  });

  test('2.4.10 headings: one h1, then h2 sections, no skipped level', () => {
    for (const { label, cfg } of all) {
      const levels = parseMarkdown(md(cfg))
        .filter((b) => b.kind === 'heading')
        .map((b) => (b as { level: number }).level);
      expect(
        levels.filter((l) => l === 1),
        label,
      ).toHaveLength(1);
      expect(levels[0], label).toBe(1);
      levels.slice(1).forEach((l, i) => expect(l <= levels[i]! + 1, label).toBe(true));
    }
  });

  test('1.3.1 / 1.4.5: real lists and headings, no tables, no images, nothing active', () => {
    for (const { label, cfg } of all) {
      const html = toHtmlFragment(parseMarkdown(md(cfg)));
      expect(html, label).not.toMatch(/<(table|img|svg|iframe|script|style)\b/);
      expect(html, label).toMatch(/^<h1>/);
    }
  });

  test('renders to Portable Text for EmDash without error, with the h1 left to the page title', () => {
    for (const { cfg } of all.filter((_, i) => i % 17 === 0)) {
      const pt = toPortableText(parseMarkdown(md(cfg)), 'accessibility-statement');
      expect(JSON.stringify(pt)).not.toContain('"Accessibility Statement"');
    }
  });
});
