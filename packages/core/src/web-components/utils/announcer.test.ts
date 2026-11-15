/**
 * @vitest-environment happy-dom
 *
 * The page-level polite region: created before it is written to, delayed, and a burst collapses
 * to the last message rather than queueing speech.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ANNOUNCE_DELAY_MS, announce, ensureAnnouncer, resetAnnouncer } from './announcer.ts';
import { shouldAnnounce, spokenError } from './field.ts';

beforeEach(() => {
  document.body.innerHTML = '';
  resetAnnouncer();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('announcer', () => {
  it('creates a single polite, visually hidden region that stays in the a11y tree', () => {
    const region = ensureAnnouncer();
    expect(ensureAnnouncer()).toBe(region);
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(region.getAttribute('aria-live')).toBe('polite');
    // Never display:none / visibility:hidden, which would drop it from the accessibility tree.
    expect(region.style.cssText).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(region.textContent).toBe('');
  });

  it('writes the message only after the delay', () => {
    announce('Email: Must be an email address.');
    const region = ensureAnnouncer();
    expect(region.textContent).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1);
    expect(region.textContent).toBe('');
    vi.advanceTimersByTime(1);
    expect(region.textContent).toBe('Email: Must be an email address.');
  });

  it('collapses a burst to the last message', () => {
    announce('first');
    announce('second');
    announce('third');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(ensureAnnouncer().textContent).toBe('third');
  });

  it('clears first, so an identical message is still a change', () => {
    announce('same');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    announce('same');
    expect(ensureAnnouncer().textContent).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(ensureAnnouncer().textContent).toBe('same');
  });

  it('recreates the region if the page removed it', () => {
    const first = ensureAnnouncer();
    first.remove();
    const second = ensureAnnouncer();
    expect(second).not.toBe(first);
    expect(second.isConnected).toBe(true);
  });
});

describe('shouldAnnounce', () => {
  it('speaks a new message and not an empty one', () => {
    expect(shouldAnnounce('', 'Fill this in.')).toBe(true);
    expect(shouldAnnounce('', '')).toBe(false);
  });

  it('does not repeat a message that was already spoken', () => {
    expect(shouldAnnounce('Fill this in.', 'Fill this in.')).toBe(false);
  });

  it('speaks a different message for the same field', () => {
    expect(shouldAnnounce('Fill this in.', 'Must be an email address.')).toBe(true);
  });
});

describe('spokenError', () => {
  it('leads with the field name so the message makes sense out of context', () => {
    expect(spokenError('  First name ', 'Fill this in.')).toBe('First name: Fill this in.');
  });

  it('is just the message when the field has no label text', () => {
    expect(spokenError('', 'Fill this in.')).toBe('Fill this in.');
  });
});
