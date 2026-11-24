import { describe, expect, it } from 'vite-plus/test';
import { controlValue, counterText, mergeDescribedBy, messageFor } from './field.ts';

describe('mergeDescribedBy', () => {
  it('keeps the ids an author wrote and appends ours', () => {
    expect(mergeDescribedBy('mine', ['help', 'err'])).toBe('mine help err');
  });

  it('never lists an id twice, and ignores stray whitespace', () => {
    expect(mergeDescribedBy('  help   mine ', ['help'])).toBe('help mine');
  });

  it('removes ids, and returns null so the attribute can go', () => {
    expect(mergeDescribedBy('help err', [], ['err'])).toBe('help');
    expect(mergeDescribedBy('err', [], ['err'])).toBeNull();
    expect(mergeDescribedBy(null, [])).toBeNull();
  });

  it('adds and removes in one call, removal winning for the same id', () => {
    expect(mergeDescribedBy('a', ['b', 'c'], ['c'])).toBe('a b');
  });
});

describe('counterText', () => {
  it('shows length against the limit, and nothing without one', () => {
    expect(counterText(12, 80)).toBe('12 / 80');
    expect(counterText(0, 80)).toBe('0 / 80');
    expect(counterText(12, null)).toBeNull();
    expect(counterText(12, 0)).toBeNull();
  });
});

describe('messageFor', () => {
  const base = { custom: '', native: '', touched: false, reported: false };

  it('shows a host message at once, over the browser one', () => {
    expect(messageFor({ ...base, custom: 'Must be a full URL', native: 'Fill this in' })).toBe(
      'Must be a full URL',
    );
  });

  it("holds the browser's message until the control is touched or a submit reports it", () => {
    const invalid = { ...base, native: 'Please fill out this field.' };
    expect(messageFor(invalid)).toBe('');
    expect(messageFor({ ...invalid, touched: true })).toBe('Please fill out this field.');
    expect(messageFor({ ...invalid, reported: true })).toBe('Please fill out this field.');
  });

  it('is empty for a valid control however touched', () => {
    expect(messageFor({ ...base, touched: true, reported: true })).toBe('');
  });
});

describe('controlValue', () => {
  it('reports a checkbox as on or off and anything else as its text', () => {
    expect(controlValue({ type: 'checkbox', value: 'on', checked: false })).toBe(false);
    expect(controlValue({ type: 'checkbox', value: 'on', checked: true })).toBe(true);
    expect(controlValue({ type: 'text', value: 'hi' })).toBe('hi');
    expect(controlValue({ value: 'x' })).toBe('x');
  });
});
