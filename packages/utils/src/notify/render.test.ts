/**
 * The subject line names who submitted the form, and it used to read
 * `formData['name']` and nothing else.
 *
 * Most forms aren't written that way. A downstream site had
 * `first_name`/`last_name` on five of six forms, so every notification arrived
 * as "from Unknown" — and that single line is why they could not adopt the
 * renderer and hand-wrote ~40 lines instead.
 */
import { describe, expect, it } from 'vitest';
import { describeEvent } from './render.ts';
import type { ConversionEvent } from '../tracking/types.ts';

const form = (formData: Record<string, string>): ConversionEvent => ({
  type: 'form',
  at: Date.parse('2026-01-01T00:00:00Z'),
  tracking: null,
  formData,
});

const subjectFor = (formData: Record<string, string>) => describeEvent(form(formData)).subject;

describe('describeEvent: who submitted', () => {
  it('prefers an explicit name field', () => {
    expect(subjectFor({ name: 'Ada Lovelace' })).toContain('Ada Lovelace');
  });

  it('joins a split name', () => {
    expect(subjectFor({ first_name: 'Ada', last_name: 'Lovelace' })).toContain('Ada Lovelace');
  });

  it.each([
    ['full_name', { full_name: 'Ada Lovelace' }],
    ['fullName', { fullName: 'Ada Lovelace' }],
    ['your-name', { 'your-name': 'Ada Lovelace' }],
    ['firstName/lastName', { firstName: 'Ada', lastName: 'Lovelace' }],
  ])('reads %s', (_label, data) => {
    expect(subjectFor(data)).toContain('Ada Lovelace');
  });

  it('accepts a half-filled split name', () => {
    expect(subjectFor({ first_name: 'Ada' })).toContain('Ada');
  });

  it('falls back to the email — an address still identifies the person', () => {
    expect(subjectFor({ email: 'ada@acme.ca', message: 'hi' })).toContain('ada@acme.ca');
  });

  it('says Unknown only when nothing identifies them', () => {
    expect(subjectFor({ message: 'hi' })).toContain('Unknown');
  });

  it('ignores a field that is present but blank', () => {
    expect(subjectFor({ name: '   ', email: 'ada@acme.ca' })).toContain('ada@acme.ca');
  });

  it('still lists every field in the body', () => {
    const { sections } = describeEvent(form({ first_name: 'Ada', message: 'hi' }));
    const lines = sections.flatMap((s) => s.lines.map(([k]) => k));
    expect(lines.join(' ').toLowerCase()).toContain('message');
  });
});
