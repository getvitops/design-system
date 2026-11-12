import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUDGETS,
  AXE_TAGS,
  auditedPage,
  axeTagsFor,
  budgetsForTarget,
  describeTarget,
  renderHtml,
  buildReport,
  classifyStatus,
  evaluatePage,
  formatSummary,
  normalizeImpact,
  normalizePath,
  pageSlug,
  parseImpacts,
  pathsFromSeed,
  isSitemapIndex,
  pathsFromSitemapLocs,
  planPages,
  sitemapLocs,
  renderMarkdown,
  reportFiles,
  unauditedPage,
} from './plan.ts';
import type { AxeViolation, PageMetrics } from './types.ts';

const ok: PageMetrics = { lcpMs: 1200, cls: 0.01, tbtMs: 50, scores: { performance: 99 } };
const violation = (impact: AxeViolation['impact'], id = 'color-contrast'): AxeViolation => ({
  id,
  impact,
  help: 'Elements must meet contrast',
  helpUrl: 'https://dequeuniversity.com/rules/axe/x',
  nodeCount: 2,
  targets: ['a.link'],
});

describe('normalizePath', () => {
  it('keeps site-relative pages, dropping query, hash and trailing slash', () => {
    expect(normalizePath('/contact/')).toBe('/contact');
    expect(normalizePath('/contact?x=1#form')).toBe('/contact');
    expect(normalizePath('/')).toBe('/');
  });
  it('rejects anything that is not an auditable page of this site', () => {
    for (const u of [
      'https://x.test/a',
      '//x.test/a',
      '#top',
      'mailto:a@b.c',
      'tel:+1',
      '/brochure.pdf',
      '/_emdash/admin',
      '',
      null,
      undefined,
    ])
      expect(normalizePath(u as string), String(u)).toBeUndefined();
  });
});

describe('pathsFromSeed', () => {
  const seed = {
    menus: [
      { name: 'primary', items: [{ url: '/contact' }, { url: 'https://x.test' }] },
      {
        name: 'footer-legal',
        items: [{ url: '/privacy' }, { url: '/terms', children: [{ url: '/terms/ca' }] }],
      },
      { name: 'primary-mobile', items: [{ url: '/call' }] },
      { name: 'other', items: [{ url: '/ignored' }] },
    ],
  };
  it('reads only primary* and footer* menus, including nested children', () => {
    expect(pathsFromSeed(seed)).toEqual(['/contact', '/privacy', '/terms', '/terms/ca', '/call']);
  });
  it('tolerates a seed with no menus', () => {
    expect(pathsFromSeed({})).toEqual([]);
    expect(pathsFromSeed(null)).toEqual([]);
  });
});

describe('planPages', () => {
  it('always starts at / and tries the legal + contact defaults', () => {
    expect(planPages()).toEqual(['/', '/privacy', '/terms', '/cookies', '/contact']);
  });
  it('adds menu and --pages paths, de-duplicated and normalised', () => {
    expect(
      planPages({ menuPaths: ['/about', '/contact'], extra: ['/pricing/', '/about'] }),
    ).toEqual(['/', '/about', '/contact', '/pricing']);
  });
  it('uses the sitemap instead of guessing, ahead of menus', () => {
    expect(
      planPages({ sitemapPaths: ['/privacy', '/about'], menuPaths: ['/about', '/x'] }),
    ).toEqual(['/', '/privacy', '/about', '/x']);
  });
  it('--no-defaults gives exactly / plus what was asked for', () => {
    expect(planPages({ includeDefaults: false, extra: ['/a'] })).toEqual(['/', '/a']);
  });
});

describe('sitemap parsing', () => {
  const index =
    '<sitemapindex><sitemap><loc>https://x.ca/sitemap-0.xml</loc></sitemap></sitemapindex>';
  const urlset =
    '<urlset><url><loc>https://x.ca/</loc></url><url><loc>https://x.ca/about/?a=1&amp;b=2</loc></url></urlset>';
  it('tells an index from a urlset', () => {
    expect(isSitemapIndex(index)).toBe(true);
    expect(isSitemapIndex(urlset)).toBe(false);
  });
  it('reduces locs to paths on whatever host serves them, skipping sitemap files', () => {
    expect(pathsFromSitemapLocs(sitemapLocs(urlset))).toEqual(['/', '/about']);
    expect(pathsFromSitemapLocs(sitemapLocs(index))).toEqual([]);
  });
});

describe('classifyStatus', () => {
  it('audits 2xx', () => expect(classifyStatus('/privacy', 200).status).toBe('audited'));
  it('skips a 404 on an optional page (a single-page site passes)', () => {
    expect(classifyStatus('/contact', 404).status).toBe('skipped');
    expect(classifyStatus('/contact', 410).status).toBe('skipped');
  });
  it('makes a 404 on / an error', () => {
    const v = classifyStatus('/', 404);
    expect(v.status).toBe('error');
    expect(v.reason).toMatch(/home page must exist/);
  });
  it('treats 5xx and no response as errors, never as skips', () => {
    expect(classifyStatus('/terms', 500).status).toBe('error');
    expect(classifyStatus('/terms', undefined).status).toBe('error');
  });
});

describe('evaluatePage', () => {
  it('passes within budget', () => {
    expect(evaluatePage(ok, [], DEFAULT_BUDGETS)).toEqual([]);
  });
  it('fails each breached metric, with the numbers in the message', () => {
    const f = evaluatePage({ lcpMs: 3100, cls: 0.25, tbtMs: 450, scores: {} }, [], DEFAULT_BUDGETS);
    expect(f.map((x) => x.kind)).toEqual(['lcp', 'cls', 'tbt']);
    expect(f[0]!.message).toContain('3100 ms');
    expect(f[0]!.message).toContain('2500 ms');
  });
  it('treats exactly-at-budget as a pass', () => {
    expect(
      evaluatePage({ lcpMs: 2500, cls: 0.1, tbtMs: 200, scores: {} }, [], DEFAULT_BUDGETS),
    ).toEqual([]);
  });
  it('fails (rather than passes) a metric that could not be measured', () => {
    const f = evaluatePage({ scores: {} }, [], DEFAULT_BUDGETS);
    expect(f.map((x) => x.kind)).toEqual(['metric-missing', 'metric-missing', 'metric-missing']);
  });
  it('fails serious and critical axe violations only by default', () => {
    const f = evaluatePage(
      ok,
      [violation('critical'), violation('serious', 'label'), violation('moderate', 'region')],
      DEFAULT_BUDGETS,
    );
    expect(f.filter((x) => x.kind === 'axe')).toHaveLength(2);
    expect(f.map((x) => x.message).join('\n')).not.toContain('region');
  });
  it('honours a stricter impact budget', () => {
    const f = evaluatePage(ok, [violation('moderate')], {
      ...DEFAULT_BUDGETS,
      blockingImpacts: parseImpacts('moderate,serious,critical'),
    });
    expect(f).toHaveLength(1);
  });
});

describe('impacts', () => {
  it('normalises a null impact to moderate rather than dropping it', () => {
    expect(normalizeImpact(null)).toBe('moderate');
    expect(normalizeImpact('critical')).toBe('critical');
    expect(normalizeImpact('nonsense')).toBe('moderate');
  });
  it('rejects a typo in the budget', () => {
    expect(() => parseImpacts('serius')).toThrow(/unknown axe impact/);
    expect(() => parseImpacts('')).toThrow();
  });
});

describe('report', () => {
  const pages = [
    auditedPage('/', 'http://x/', 200, ok, [], DEFAULT_BUDGETS),
    auditedPage('/privacy', 'http://x/privacy', 200, ok, [violation('serious')], DEFAULT_BUDGETS),
    unauditedPage('/contact', 'http://x/contact', 404, { status: 'skipped', reason: '404' }),
  ];
  const report = buildReport({
    generatedAt: '2030-01-01T00:00:00.000Z',
    baseUrl: 'http://x',
    formFactor: 'mobile',
    budgets: DEFAULT_BUDGETS,
    pages,
  });

  it('fails overall when any page fails; skipped pages do not fail it', () => {
    expect(report.passed).toBe(false);
    expect(buildReport({ ...report, pages: [pages[0]!, pages[2]!] }).passed).toBe(true);
  });

  it('a missing / is a failure', () => {
    const r = buildReport({
      ...report,
      pages: [unauditedPage('/', 'http://x/', 404, { status: 'error', reason: 'x' })],
    });
    expect(r.passed).toBe(false);
    expect(r.pages[0]!.failures[0]!.kind).toBe('required-page-missing');
  });

  it('every output states that a pass is not AODA certification and lists manual checks', () => {
    const md = renderMarkdown(report);
    expect(md).toMatch(/NOT an AODA/);
    for (const k of [
      'Keyboard order',
      'Focus visibility',
      'Screen reader',
      'reduced-motion',
      '200% zoom',
    ])
      expect(md).toContain(k);
    expect(report.disclaimer).toMatch(/NOT an AODA/);
    expect(formatSummary(report)).toMatch(/NOT AODA certification/);
  });

  it('writes json + markdown overall and per audited page (not for skipped pages)', () => {
    const files = reportFiles(report);
    expect(Object.keys(files).sort()).toEqual([
      'pages/home.json',
      'pages/home.md',
      'pages/privacy.json',
      'pages/privacy.md',
      'report.html',
      'report.json',
      'report.md',
    ]);
    expect(JSON.parse(files['report.json']!).passed).toBe(false);
    expect(files['pages/privacy.md']).toContain('FAIL');
    expect(files['pages/privacy.md']).toContain('color-contrast');
  });

  it('slugs paths into filenames', () => {
    expect(pageSlug('/')).toBe('home');
    expect(pageSlug('/a/b-c')).toBe('a-b-c');
  });
});

describe('accessibility target', () => {
  it('maps standard and level to cumulative axe tags', () => {
    expect(axeTagsFor({ standard: 'wcag20', level: 'AA' })).toEqual(['wcag2a', 'wcag2aa']);
    expect(axeTagsFor({ standard: 'wcag20', level: 'A' })).toEqual(['wcag2a']);
    expect(axeTagsFor({ standard: 'wcag21', level: 'AA' })).toEqual([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
    ]);
    expect(axeTagsFor({ standard: 'wcag22', level: 'AA' })).toContain('wcag22aa');
    expect(axeTagsFor({ standard: 'wcag21', level: 'AAA' })).toContain('wcag2aaa');
  });
  it('`none` still reports against the version at AA, it just stops gating', () => {
    expect(axeTagsFor({ standard: 'wcag21', level: 'none' })).toEqual(
      axeTagsFor({ standard: 'wcag21', level: 'AA' }),
    );
  });
  it('level none clears the axe gate; performance budgets are untouched', () => {
    const b = budgetsForTarget(DEFAULT_BUDGETS, { level: 'none' });
    expect(b.blockingImpacts).toEqual([]);
    expect(b.lcpMs).toBe(DEFAULT_BUDGETS.lcpMs);
    expect(evaluatePage(ok, [violation('critical')], b)).toEqual([]);
    expect(evaluatePage(ok, [violation('critical')], DEFAULT_BUDGETS)).toHaveLength(1);
    expect(budgetsForTarget(DEFAULT_BUDGETS, { level: 'AA' })).toBe(DEFAULT_BUDGETS);
    expect(budgetsForTarget(DEFAULT_BUDGETS, undefined)).toBe(DEFAULT_BUDGETS);
  });
  const report = (target?: Parameters<typeof buildReport>[0]['target']) =>
    buildReport({
      generatedAt: '2026-11-11T00:00:00Z',
      baseUrl: 'http://x.test',
      formFactor: 'mobile',
      budgets: DEFAULT_BUDGETS,
      pages: [auditedPage('/', 'http://x.test/', 200, ok, [violation('serious')], DEFAULT_BUDGETS)],
      target,
    });
  it('keeps the legacy tags when no target is declared', () => {
    expect(report().axeTags).toEqual(AXE_TAGS);
    expect(describeTarget(undefined)).toBeUndefined();
  });
  it('prints the declared target and any accepted risk', () => {
    const r = report({ standard: 'wcag20', level: 'none', acceptedRisk: 'Client, 2026-11-11' });
    expect(describeTarget(r.target)).toMatch(/WCAG 2\.0.*no minimum level.*Client, 2026-11-11/);
    expect(renderMarkdown(r)).toContain('Declared target');
    expect(renderHtml(r)).toContain('Client, 2026-11-11');
  });
  it('report.html is self-contained, noindex and escapes page content', () => {
    const html = renderHtml(
      report({ standard: 'wcag21', level: 'AA', acceptedRisk: '<script>x</script>' }),
    );
    expect(html).toContain('noindex');
    expect(html).not.toMatch(/<script|src=|href="http/);
    expect(html).not.toContain('<script>x');
  });
  it('writes only report-relative paths, so nothing can land in a build output by name', () => {
    for (const name of Object.keys(reportFiles(report())))
      expect(name, name).toMatch(/^(report\.(json|md|html)|pages\/[\w-]+\.(json|md))$/);
  });
});
