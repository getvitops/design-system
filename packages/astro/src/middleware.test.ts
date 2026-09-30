import { describe, expect, it } from 'vite-plus/test';
import { assignVariant, vitopsAbTesting, type AbTestingExperiment } from './middleware.ts';

function stubCookies(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  const sets: { name: string; value: string; opts: Record<string, unknown> }[] = [];
  return {
    sets,
    cookies: {
      get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
      set: (name: string, value: string, opts: Record<string, unknown>) => {
        jar.set(name, value);
        sets.push({ name, value, opts });
      },
    },
  };
}

function stubContext(url: string, cookies: ReturnType<typeof stubCookies>['cookies']) {
  return { url: new URL(url), cookies } as unknown as Parameters<
    ReturnType<typeof vitopsAbTesting>
  >[0];
}

const nextResult = Symbol('next');
const next = () => nextResult as never;

describe('assignVariant', () => {
  it('always picks variants[0] when splitRatio is 0', () => {
    const experiment = { splitRatio: 0, variants: ['control', 'new-form'] as const };
    for (let i = 0; i < 20; i++) expect(assignVariant(experiment, () => 0.999)).toBe('control');
  });

  it('always picks variants[1] when splitRatio is 1', () => {
    const experiment = { splitRatio: 1, variants: ['control', 'new-form'] as const };
    for (let i = 0; i < 20; i++) expect(assignVariant(experiment, () => 0)).toBe('new-form');
  });

  it('defaults splitRatio to 0.5 when unset', () => {
    const experiment = { variants: ['control', 'new-form'] as const };
    expect(assignVariant(experiment, () => 0.4)).toBe('new-form');
    expect(assignVariant(experiment, () => 0.6)).toBe('control');
  });
});

describe('vitopsAbTesting', () => {
  const experiment: AbTestingExperiment = {
    cookieName: '_ab_contact-form-v2',
    cookieMaxAge: 2_592_000,
    splitRatio: 0.5,
    variants: ['control', 'new-form'],
  };

  it('assigns and sets the cookie when none is present', async () => {
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': experiment } });
    const result = await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(result).toBe(nextResult);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.name).toBe('_ab_contact-form-v2');
    expect(['control', 'new-form']).toContain(sets[0]!.value);
  });

  it('never overwrites an existing assignment', async () => {
    const { cookies, sets } = stubCookies({ '_ab_contact-form-v2': 'control' });
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': experiment } });
    await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(sets).toHaveLength(0);
  });

  it('a recognized query param forces the variant, even overriding an existing cookie', async () => {
    const { cookies, sets } = stubCookies({ '_ab_contact-form-v2': 'control' });
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': experiment } });
    await handler(
      stubContext('https://acme.example/contact?_ab_contact-form-v2=new-form', cookies),
      next,
    );
    expect(sets).toHaveLength(1);
    expect(sets[0]!.value).toBe('new-form');
  });

  it('an unrecognized query param value is ignored, falling back to normal assignment', async () => {
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': experiment } });
    await handler(
      stubContext('https://acme.example/contact?_ab_contact-form-v2=not-a-real-variant', cookies),
      next,
    );
    expect(sets).toHaveLength(1);
    expect(['control', 'new-form']).toContain(sets[0]!.value);
  });

  it('splitRatio: 0 plus a query-param link is the blue/green preview mode', async () => {
    const blueGreen: AbTestingExperiment = { ...experiment, splitRatio: 0 };
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': blueGreen } });
    // Ordinary traffic: always control.
    await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(sets[0]!.value).toBe('control');
    // The preview link still reaches the other variant.
    const { cookies: cookies2, sets: sets2 } = stubCookies();
    await handler(
      stubContext('https://acme.example/contact?_ab_contact-form-v2=new-form', cookies2),
      next,
    );
    expect(sets2[0]!.value).toBe('new-form');
  });

  it('omits maxAge from the cookie options when cookieMaxAge is unset', async () => {
    const { cookies, sets } = stubCookies();
    const { cookieMaxAge: _omit, ...noMaxAge } = experiment;
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': noMaxAge } });
    await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(sets[0]!.opts).not.toHaveProperty('maxAge');
  });

  it('sets secure only over https', async () => {
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({ experiments: { 'contact-form-v2': experiment } });
    await handler(stubContext('http://localhost:4321/contact', cookies), next);
    expect(sets[0]!.opts['secure']).toBe(false);
  });

  it('handles two concurrent experiments independently', async () => {
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({
      experiments: {
        'contact-form-v2': experiment,
        'pricing-layout': {
          cookieName: '_ab_pricing-layout',
          splitRatio: 1,
          variants: ['grid', 'table'],
        },
      },
    });
    await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.name).sort()).toEqual(['_ab_contact-form-v2', '_ab_pricing-layout']);
  });

  it('does nothing when no experiments are configured', async () => {
    const { cookies, sets } = stubCookies();
    const handler = vitopsAbTesting({ experiments: {} });
    const result = await handler(stubContext('https://acme.example/contact', cookies), next);
    expect(sets).toHaveLength(0);
    expect(result).toBe(nextResult);
  });
});
