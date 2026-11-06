import { describe, expect, it } from 'vite-plus/test';
import { holdSubmit, scriptSrc, validSiteKey } from './turnstile.ts';

describe('turnstile helpers', () => {
  it('accepts a real-shaped site key and refuses junk', () => {
    expect(validSiteKey('0x4AAAAAAAbcdefGHIJ')).toBe(true);
    expect(validSiteKey('')).toBe(false);
    expect(validSiteKey('"><script>')).toBe(false);
    expect(validSiteKey(null)).toBe(false);
  });
  it('requests explicit rendering with the named onload hook', () => {
    expect(scriptSrc('cb')).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=cb',
    );
  });
  it('holds a submit only while a live widget has no token', () => {
    expect(holdSubmit({ live: true, token: '' })).toBe(true);
    expect(holdSubmit({ live: true, token: 'x' })).toBe(false);
    expect(holdSubmit({ live: false, token: '' })).toBe(false);
  });
});
