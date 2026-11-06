import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, cspScriptHash, inlineScriptHashes } from './csp.ts';
import { CONSENT_STUB, THEME_SCRIPT } from './inline-scripts.ts';

const sha = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

describe('cspScriptHash', () => {
  it('is the quoted sha256 of the exact bytes', () => {
    // Computed independently here, so the helper can't agree with itself.
    expect(cspScriptHash('alert(1)')).toBe(sha('alert(1)'));
    expect(cspScriptHash('alert(1)')).toMatch(/^'sha256-[A-Za-z0-9+/]{43}='$/);
  });

  it('is sensitive to a single byte (a trailing newline is a different script)', () => {
    expect(cspScriptHash('a')).not.toBe(cspScriptHash('a\n'));
  });
});

describe('inlineScriptHashes', () => {
  it('lists both <Head /> inline scripts by default', () => {
    expect(inlineScriptHashes()).toEqual([sha(THEME_SCRIPT), sha(CONSENT_STUB)]);
  });

  it('drops the hash of a script the page will not emit', () => {
    expect(inlineScriptHashes({ consent: false })).toEqual([sha(THEME_SCRIPT)]);
    expect(inlineScriptHashes({ webComponents: false })).toEqual([sha(CONSENT_STUB)]);
  });
});

describe('contentSecurityPolicy', () => {
  const directive = (csp: string, name: string) =>
    csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('allows <Head />’s inline scripts by hash and never by unsafe-inline', () => {
    const script = directive(contentSecurityPolicy(), 'script-src');
    for (const h of inlineScriptHashes()) expect(script).toContain(h);
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
  });

  it('starts closed: no plugins, no framing of other origins, same-origin forms', () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('threads caller-supplied sources into the right directives', () => {
    const csp = contentSecurityPolicy({
      scriptSrc: ["'sha256-abc='"],
      connectSrc: ['https://plausible.io'],
      frameSrc: ['https://www.youtube-nocookie.com'],
      reportUri: '/csp-report',
    });
    expect(directive(csp, 'script-src')).toContain("'sha256-abc='");
    expect(directive(csp, 'connect-src')).toContain('https://plausible.io');
    expect(directive(csp, 'frame-src')).toBe('frame-src https://www.youtube-nocookie.com');
    expect(csp).toContain('report-uri /csp-report');
  });
});
