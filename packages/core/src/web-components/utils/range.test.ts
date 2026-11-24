import { describe, expect, it } from 'vite-plus/test';
import { clampPair, fillStops, outputText, percent } from './range.ts';

describe('percent', () => {
  it('maps a value onto 0-100 and clamps outside it', () => {
    expect(percent(50, 0, 100)).toBe(50);
    expect(percent(25, 20, 30)).toBe(50);
    expect(percent(-10, 0, 100)).toBe(0);
    expect(percent(500, 0, 100)).toBe(100);
  });
  it('is 0 for a zero-width or inverted range rather than NaN', () => {
    expect(percent(5, 5, 5)).toBe(0);
    expect(percent(5, 10, 0)).toBe(0);
  });
});

describe('clampPair', () => {
  it('lets the lower thumb stop at the upper, and leaves the upper where it was', () => {
    expect(clampPair('lower', 70, 50)).toEqual([50, 50]);
    expect(clampPair('lower', 30, 50)).toEqual([30, 50]);
  });
  it('lets the upper thumb stop at the lower, and leaves the lower where it was', () => {
    expect(clampPair('upper', 50, 30)).toEqual([50, 50]);
    expect(clampPair('upper', 50, 80)).toEqual([50, 80]);
  });
  it('allows the two to meet', () => {
    expect(clampPair('lower', 50, 50)).toEqual([50, 50]);
  });
});

describe('fillStops', () => {
  it('gives the filled span as ordered percentages', () => {
    expect(fillStops(20, 80, 0, 100)).toEqual({ start: 20, end: 80 });
    expect(fillStops(80, 20, 0, 100)).toEqual({ start: 20, end: 80 });
    expect(fillStops(1500, 4500, 1000, 5000)).toEqual({ start: 12.5, end: 87.5 });
  });
});

describe('outputText', () => {
  it('shows a single value, or a pair with an en dash', () => {
    const fmt = (n: number) => `$${n}`;
    expect(outputText([40], fmt)).toBe('$40');
    expect(outputText([20, 80], fmt)).toBe('$20 – $80');
  });
});
