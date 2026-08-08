import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD, distance, shouldNavigate, type CardClick } from './card-click.ts';

/**
 * The decision, tested without a DOM — the point of splitting it out. `WCCards`'s
 * own test covers only that the right inputs reach here and the answer is acted on.
 *
 * The negative cases are the load-bearing ones. A false positive throws away a
 * selection the visitor was making, or hijacks a control that had its own
 * behaviour; a false negative just means the shortcut did not fire and the real
 * link is still there.
 */
const click = (over: Partial<CardClick> = {}): CardClick => ({
  moved: 0,
  onInteractive: false,
  platformHandled: false,
  hasLink: true,
  ...over,
});

describe('shouldNavigate', () => {
  it('navigates on a plain click over card whitespace', () => {
    expect(shouldNavigate(click())).toBe(true);
  });

  it('tolerates the small travel of a real tap', () => {
    // A trackpad tap routinely moves a pixel or three; zero tolerance would make
    // the card unclickable for some people.
    expect(shouldNavigate(click({ moved: 3 }))).toBe(true);
    expect(shouldNavigate(click({ moved: DRAG_THRESHOLD }))).toBe(true);
  });

  it('does not navigate once the pointer has dragged', () => {
    // This is the whole requirement: a drag over text is a selection.
    expect(shouldNavigate(click({ moved: DRAG_THRESHOLD + 1 }))).toBe(false);
    expect(shouldNavigate(click({ moved: 200 }))).toBe(false);
  });

  it('leaves anything already interactive alone', () => {
    expect(shouldNavigate(click({ onInteractive: true }))).toBe(false);
  });

  it('defers to the platform for modifier and non-primary clicks', () => {
    // cmd/ctrl-click opens a new tab, middle-click too, right-click opens a menu.
    // Forwarding on top of any of those duplicates or fights it.
    expect(shouldNavigate(click({ platformHandled: true }))).toBe(false);
  });

  it('does nothing when the card has no link to forward to', () => {
    expect(shouldNavigate(click({ hasLink: false }))).toBe(false);
  });

  it('refuses when several reasons apply at once', () => {
    expect(shouldNavigate(click({ moved: 50, onInteractive: true, hasLink: false }))).toBe(false);
  });
});

describe('distance', () => {
  it('measures pointer travel', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it('is direction-agnostic, so a drag up-left counts as much as down-right', () => {
    expect(distance({ x: 0, y: 0 }, { x: -3, y: -4 })).toBe(5);
  });
});
