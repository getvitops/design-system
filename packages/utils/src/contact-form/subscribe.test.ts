import { describe, expect, it } from 'vite-plus/test';
import { resolveFields } from './fields.ts';
import { resolveSubscribe, subscribeReserved } from './subscribe.ts';

describe('resolveSubscribe', () => {
  it('is null with no usable list', () => {
    expect(resolveSubscribe({})).toBeNull();
    expect(resolveSubscribe({ list: '   ' })).toBeNull();
    expect(resolveSubscribe({ list: 'has/slash' })).toBeNull();
  });

  it('defaults to a checkbox with the default names and label', () => {
    expect(resolveSubscribe({ list: 'waitlist' })).toEqual({
      mode: 'checkbox',
      list: 'waitlist',
      label: 'Email me updates',
      consentField: 'subscribe',
      listField: 'list',
    });
  });

  it('a dedicated signup carries a consent statement by default', () => {
    const c = resolveSubscribe({ list: 'blog', only: true });
    expect(c?.mode).toBe('only');
    expect(c?.label).toContain('unsubscribe at any time');
  });

  it('keeps the editor label', () => {
    expect(resolveSubscribe({ list: 'blog', label: ' Send me the blog ' })?.label).toBe(
      'Send me the blog',
    );
  });

  it('joins several keys, de-duplicated, and drops the unsafe ones instead of repairing them', () => {
    expect(resolveSubscribe({ list: 'a, b a  c/d' })?.list).toBe('a,b');
  });

  it('ignores an unusable field name, and never lets the two names collide', () => {
    expect(resolveSubscribe({ list: 'a', consentField: 'Bad Name' })?.consentField).toBe(
      'subscribe',
    );
    expect(resolveSubscribe({ list: 'a', consentField: 'opt', listField: 'opt' })).toMatchObject({
      consentField: 'opt',
      listField: 'list',
    });
  });
});

describe('resolveFields with reserved names', () => {
  it('renames an author field that would shadow the opt-in, and leaves others alone', () => {
    const reserved = subscribeReserved(resolveSubscribe({ list: 'a' }));
    expect(reserved).toEqual(['subscribe', 'list']);
    const names = resolveFields(
      [
        { label: 'Subscribe', name: 'subscribe', type: 'checkbox' },
        { label: 'List', type: 'text' },
        { label: 'Email', type: 'email' },
      ],
      reserved,
    ).map((f) => f.name);
    expect(names).toEqual(['subscribe_2', 'list_2', 'email']);
  });

  it('is unchanged with no reserved names', () => {
    expect(
      resolveFields([{ label: 'Subscribe', name: 'subscribe', type: 'checkbox' }]).map(
        (f) => f.name,
      ),
    ).toEqual(['subscribe']);
  });
});
