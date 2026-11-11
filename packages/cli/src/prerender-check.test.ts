import { describe, expect, it } from 'vitest';
import {
  unrenderedBlocks,
  brokenInternalLinks,
  formFieldNames,
  uninventoriedFields,
  deliveryProblem,
  hasConversionForm,
  routeOf,
  sitemapOrphans,
  h1Count,
  missingBlockComponents,
  missingTypeRoleRules,
  prerenderProblem,
} from './prerender-check.ts';

describe('prerenderProblem', () => {
  it('accepts a real page', () => {
    expect(prerenderProblem('<!doctype html><html><head><title>Home</title></head></html>')).toBe(
      undefined,
    );
  });
  it('rejects the pending-migrations body', () => {
    expect(prerenderProblem('Database migrations are required. Run emdash migrate.')).toMatch(
      /pending-migrations/,
    );
  });
  it('rejects a bare text response', () => {
    expect(prerenderProblem('Internal Server Error')).toMatch(/not an HTML document/);
  });
  it('rejects a document with no title', () => {
    expect(prerenderProblem('<html><body>hi</body></html>')).toMatch(/no <title>/);
  });
});

describe('missingTypeRoleRules', () => {
  const page = '<p class="stats__figure font-display">11</p><p class="font-heading x">a</p>';

  it('names a type role the stylesheet has no rule for', () => {
    expect(missingTypeRoleRules(page, '.font-heading{font-size:1rem}')).toEqual(['font-display']);
  });
  it('is quiet when every used role is defined, in minified css too', () => {
    expect(missingTypeRoleRules(page, '.font-display{a:b}.font-heading,.x{c:d}')).toEqual([]);
  });
  it('does not treat a longer class as the role', () => {
    expect(missingTypeRoleRules('<i class="font-display">', '.font-display-x{a:b}')).toEqual([
      'font-display',
    ]);
  });
  it('ignores classes outside the type roles', () => {
    expect(missingTypeRoleRules('<i class="font-bold">', '')).toEqual([]);
  });
});

describe('missingBlockComponents', () => {
  it('lists each missing block type once', () => {
    const log = [
      'warn PortableText [components.type] is missing "vitops_cards"',
      '\u001b[33mPortableText [components.type] is missing "vitops_cards"\u001b[39m',
      'PortableText [components.type] is missing "vitops_actionLink"',
      'something else',
    ].join('\n');
    expect(missingBlockComponents(log)).toEqual(['vitops_actionLink', 'vitops_cards']);
  });
  it('is empty for a clean build', () => {
    expect(missingBlockComponents('built 12 pages')).toEqual([]);
  });
});

describe('h1Count', () => {
  it('counts live h1s only', () => {
    expect(h1Count('<h1>a</h1><h1 class="x">b</h1>')).toBe(2);
    expect(h1Count('<p>x</p><!-- <h1>c</h1> --><template><h1>d</h1></template>')).toBe(0);
    expect(h1Count('<h1>one</h1>')).toBe(1);
  });
});

describe('routeOf / brokenInternalLinks', () => {
  it('maps built files to the routes they serve', () => {
    expect(routeOf('index.html')).toBe('/');
    expect(routeOf('about/index.html')).toBe('/about');
    expect(routeOf('terms.html')).toBe('/terms');
  });
  it('reports links to routes that were not built, and only those', () => {
    const routes = new Set(['/', '/about']);
    const html =
      '<a href="/about">a</a><a href="/pricing/">p</a><a href="/about#x">b</a>' +
      '<a href="#top">t</a><a href="/logo.svg">f</a><a href="/api/track">w</a>' +
      '<a href="https://x.com/y">e</a><a href="/industries?x=1">i</a><!-- <a href="/hidden"> -->';
    expect(brokenInternalLinks(html, routes)).toEqual(['/industries', '/pricing']);
  });
});

describe('form delivery', () => {
  it('spots the form post', () => {
    expect(hasConversionForm('<form method="post" action="/api/track">')).toBe(true);
    expect(hasConversionForm('<form action="/search">')).toBe(false);
  });
  it('wants a recipient or a CRM', () => {
    expect(deliveryProblem({})).toMatch(/no recipient/);
    expect(deliveryProblem({ site: { notifications: { email: 'a@b.ca' } } })).toBeUndefined();
    expect(
      deliveryProblem({ site: { notifications: { email: { to: 'a@b.ca' } } } }),
    ).toBeUndefined();
    expect(
      deliveryProblem({ organization: { locations: { hq: { email: 'a@b.ca' } } } }),
    ).toBeUndefined();
    expect(deliveryProblem({ site: { crm: { provider: 'hubspot' } } })).toBeUndefined();
  });
});

describe('form field inventory', () => {
  const html =
    '<form method="post" action="/api/track"><input type="hidden" name="_next" value="/c">' +
    '<input name="name"><input type="email" name="email"><textarea name="message"></textarea>' +
    '<input type="checkbox" name="interests" value="a"><input type="checkbox" name="interests" value="b">' +
    '<input type="text" name="website" tabindex="-1"></form><form action="/search"><input name="q"></form>';
  it('lists what the visitor supplies, once each', () => {
    expect(formFieldNames(html)).toEqual(['email', 'interests', 'message', 'name']);
  });
  it('reports fields no form template lists', () => {
    const config = {
      site: {
        templates: { contact: { type: 'form', fields: [{ name: 'name' }, { name: 'email' }] } },
      },
    };
    expect(uninventoriedFields(config, ['email', 'interests', 'message', 'name'])).toEqual([
      'interests',
      'message',
    ]);
    expect(uninventoriedFields({}, ['name'])).toEqual(['name']);
  });
});

describe('unrenderedBlocks / prerenderProblem', () => {
  const page = (body: string) =>
    `<!doctype html><html><head><title>T</title></head><body>${body}</body></html>`;
  it('lists the dropped block types once', () => {
    const html = page(
      '<template data-vitops-unrendered="vitops_cards"></template><template data-vitops-unrendered="vitops_cards"></template><template data-vitops-unrendered="vitops_hero"></template>',
    );
    expect(unrenderedBlocks(html)).toEqual(['vitops_cards', 'vitops_hero']);
  });
  it('fails a page that dropped a block', () => {
    expect(
      prerenderProblem(page('<template data-vitops-unrendered="vitops_cards"></template>')),
    ).toMatch(/dropped block.*vitops_cards/);
    expect(prerenderProblem(page('<p>ok</p>'))).toBeUndefined();
  });
});

describe('sitemapOrphans', () => {
  const routes = new Set(['/', '/about', '/blog/hello']);
  it('names listed URLs the build has no page for', () => {
    const xml = `<urlset><url><loc>https://x.ca/</loc></url><url><loc>https://x.ca/pages/about</loc></url><url><loc>https://x.ca/about/</loc></url></urlset>`;
    expect(sitemapOrphans(xml, routes)).toEqual(['/pages/about']);
  });
  it('ignores nested sitemaps and assets', () => {
    expect(sitemapOrphans('<loc>https://x.ca/sitemap-0.xml</loc>', routes)).toEqual([]);
  });
});
