import { describe, expect, it } from 'vite-plus/test';
import {
  announcementText,
  canShowNow,
  normalizeDuration,
  normalizeTone,
  remainingAfterPause,
  shouldHold,
} from './notifications.ts';

describe('normalizeTone', () => {
  it('keeps a tone the stylesheet has a rule for', () => {
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger']) {
      expect(normalizeTone(tone)).toBe(tone);
    }
  });

  it('turns anything else into neutral, so a value cannot become a class', () => {
    expect(normalizeTone('x" onmouseover="alert(1)')).toBe('neutral');
    expect(normalizeTone(undefined)).toBe('neutral');
    expect(normalizeTone(3)).toBe('neutral');
    expect(normalizeTone('')).toBe('neutral');
  });
});

describe('normalizeDuration', () => {
  it('accepts a positive number or numeric string, rounded', () => {
    expect(normalizeDuration(4000)).toBe(4000);
    expect(normalizeDuration('2500')).toBe(2500);
    expect(normalizeDuration(1500.6)).toBe(1501);
  });

  it('treats zero, negatives, NaN and junk as persistent', () => {
    for (const bad of [0, -1, Number.NaN, Infinity, 'soon', null, undefined, {}]) {
      expect(normalizeDuration(bad)).toBe(0);
    }
  });
});

describe('announcementText', () => {
  it('speaks the title and message, trimmed, and nothing else', () => {
    expect(announcementText({ title: ' Saved ', message: ' Your draft is safe. ' })).toBe(
      'Saved. Your draft is safe.',
    );
    expect(announcementText({ message: 'Done' })).toBe('Done');
  });

  it('says when there are actions besides Close', () => {
    expect(announcementText({ message: 'Moved to trash', actions: [{ label: 'Undo' }] })).toBe(
      'Moved to trash. Actions available',
    );
    expect(announcementText({ message: 'Moved to trash', actions: [] })).toBe('Moved to trash');
  });
});

describe('modal gating, pause and hold', () => {
  it('does not show while a modal is open', () => {
    expect(canShowNow(true)).toBe(false);
    expect(canShowNow(false)).toBe(true);
  });

  it('resumes with the time that was left, never negative', () => {
    expect(remainingAfterPause(5000, 1000, 3000)).toBe(3000);
    expect(remainingAfterPause(5000, 1000, 9000)).toBe(0);
    expect(remainingAfterPause(5000, 4000, 1000)).toBe(5000);
  });

  it('holds while hovered or focused', () => {
    expect(shouldHold(true, false)).toBe(true);
    expect(shouldHold(false, true)).toBe(true);
    expect(shouldHold(false, false)).toBe(false);
  });
});
