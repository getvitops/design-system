import { describe, expect, it } from 'vitest';
import { easingToken, formatterFor, parseFigure } from './counter.ts';

describe('parseFigure', () => {
  it('parses a bare integer', () => {
    expect(parseFigure('94')).toEqual({
      prefix: '',
      suffix: '',
      value: 94,
      decimals: 0,
      grouping: false,
    });
  });

  it('keeps a percent suffix', () => {
    expect(parseFigure('94%')).toEqual({
      prefix: '',
      suffix: '%',
      value: 94,
      decimals: 0,
      grouping: false,
    });
  });

  it('keeps a currency prefix and infers decimals', () => {
    expect(parseFigure('$1,234.50')).toEqual({
      prefix: '$',
      suffix: '',
      value: 1234.5,
      decimals: 2,
      grouping: true,
    });
  });

  it('detects grouping with no decimal part', () => {
    expect(parseFigure('1,284')).toEqual({
      prefix: '',
      suffix: '',
      value: 1284,
      decimals: 0,
      grouping: true,
    });
  });

  it('keeps a plus or times suffix', () => {
    expect(parseFigure('+250')).toEqual({
      prefix: '+',
      suffix: '',
      value: 250,
      decimals: 0,
      grouping: false,
    });
    expect(parseFigure('3×')).toEqual({
      prefix: '',
      suffix: '×',
      value: 3,
      decimals: 0,
      grouping: false,
    });
  });

  it('an explicit decimals override wins over what the text implies', () => {
    expect(parseFigure('94', 2).decimals).toBe(2);
    expect(parseFigure('94.500', 1).decimals).toBe(1);
  });

  it('trims surrounding whitespace', () => {
    expect(parseFigure('  94%  ')).toEqual({
      prefix: '',
      suffix: '%',
      value: 94,
      decimals: 0,
      grouping: false,
    });
  });

  it('falls back to zero for text with no digits', () => {
    expect(parseFigure('—').value).toBe(0);
  });
});

describe('formatterFor', () => {
  it('renders grouping and decimals the way the parsed text had them', () => {
    const parsed = parseFigure('$1,234.50');
    expect(formatterFor(parsed).format(parsed.value)).toBe('1,234.50');
  });

  it('renders no grouping and no decimals for a bare integer', () => {
    const parsed = parseFigure('94');
    expect(formatterFor(parsed).format(parsed.value)).toBe('94');
  });
});

describe('easingToken', () => {
  it('maps a known name to its CSS token', () => {
    expect(easingToken('ease-out')).toBe('var(--custom-ease-out)');
    expect(easingToken('linear')).toBe('linear');
  });

  it('returns undefined for an unrecognised or absent name', () => {
    expect(easingToken('bounce-house')).toBeUndefined();
    expect(easingToken(null)).toBeUndefined();
    expect(easingToken(undefined)).toBeUndefined();
  });
});
