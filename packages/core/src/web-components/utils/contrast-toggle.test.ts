import { describe, expect, it } from 'vite-plus/test';
import {
  CONTRAST_STORAGE_KEY,
  choiceFor,
  initialChecked,
  readChoice,
  shouldApplyOnLoad,
} from './contrast-toggle.ts';

describe('readChoice', () => {
  it('accepts only the two choices', () => {
    expect(readChoice('more')).toBe('more');
    expect(readChoice('standard')).toBe('standard');
    for (const bad of [null, undefined, '', 'on', 'true', 'MORE'])
      expect(readChoice(bad as string | null)).toBeNull();
  });
});

describe('initialChecked', () => {
  it('follows the OS when nothing is stored', () => {
    expect(initialChecked(null, true)).toBe(true);
    expect(initialChecked(null, false)).toBe(false);
  });

  it('lets an explicit choice win in both directions', () => {
    // A visitor whose OS asks for more contrast can still turn it off on this site.
    expect(initialChecked('standard', true)).toBe(false);
    expect(initialChecked('more', false)).toBe(true);
  });
});

describe('choiceFor / shouldApplyOnLoad', () => {
  it('maps the checkbox to the attribute value', () => {
    expect(choiceFor(true)).toBe('more');
    expect(choiceFor(false)).toBe('standard');
  });

  it('writes the attribute on load only for an explicit stored choice', () => {
    // With none, the `prefers-contrast` media query already does the right thing.
    expect(shouldApplyOnLoad(null)).toBe(false);
    expect(shouldApplyOnLoad('more')).toBe(true);
    expect(shouldApplyOnLoad('standard')).toBe(true);
  });
});

describe('storage key', () => {
  it('is the one the <Head /> pre-paint script reads', () => {
    // `head.test.ts` in @getvitops/astro asserts the other half.
    expect(CONTRAST_STORAGE_KEY).toBe('vitops-contrast');
  });
});
