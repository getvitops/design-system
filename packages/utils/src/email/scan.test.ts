import { describe, expect, test } from 'vite-plus/test';
import { extractFromRefs } from './scan.ts';

describe('from-address scan', () => {
  test('bare string literal, the REST/Workers-string form', () => {
    const { refs } = extractFromRefs(`await env.EMAIL.send({ from: "noreply@acme.ca", to });`);
    expect(refs).toEqual([{ address: 'noreply@acme.ca', kind: 'bare', file: '<source>', line: 1 }]);
  });

  test('object literal, Workers binding form: { email: "…" }', () => {
    const { refs } = extractFromRefs(`from: { email: "noreply@acme.ca", name: "Acme" },`);
    expect(refs).toEqual([
      { address: 'noreply@acme.ca', kind: 'object', file: '<source>', line: 1 },
    ]);
  });

  test('object literal, REST form: { address: "…" }', () => {
    const { refs } = extractFromRefs(`from: { address: 'noreply@acme.ca' },`);
    expect(refs).toEqual([
      { address: 'noreply@acme.ca', kind: 'object', file: '<source>', line: 1 },
    ]);
  });

  test('a computed value is reported as dynamic, never guessed', () => {
    const { refs, dynamic } = extractFromRefs(`from: cfg.notifications.email.from,`);
    expect(refs).toEqual([]);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]?.expr).toMatch(/cfg\.notifications/);
  });

  test('a template literal with interpolation is dynamic, not a literal', () => {
    const { refs, dynamic } = extractFromRefs('from: `noreply@${domain}`,');
    expect(refs).toEqual([]);
    expect(dynamic).toHaveLength(1);
  });

  test('an object value with no static email/address key is dynamic', () => {
    const { refs, dynamic } = extractFromRefs(`from: { email: getSender() },`);
    expect(refs).toEqual([]);
    expect(dynamic).toHaveLength(1);
  });

  test('a bare string with no "@" is not treated as an address', () => {
    const { refs, dynamic } = extractFromRefs(`from: "Acme Notifications",`);
    expect(refs).toEqual([]);
    expect(dynamic).toEqual([]);
  });

  test('no false hit on a hyphenated attribute like data-from', () => {
    const { refs, dynamic } = extractFromRefs(`<div data-from="noreply@acme.ca">`);
    expect(refs).toEqual([]);
    expect(dynamic).toEqual([]);
  });

  test('line numbers are reported for a match on a later line', () => {
    const { refs } = extractFromRefs(`const x = 1;\nconst y = 2;\nfrom: "noreply@acme.ca",`);
    expect(refs[0]?.line).toBe(3);
  });
});
