import { afterEach, describe, expect, it } from 'vitest';
import { vitopsHosting } from './hosting.ts';

afterEach(() => {
  delete process.env.HOSTING;
});

describe('vitopsHosting', () => {
  // Higher timeout: this is the first test to dynamically import()
  // @astrojs/cloudflare / @emdash-cms/cloudflare, and under a full monorepo
  // test run (many workers cold-loading modules at once) that first-import
  // cost occasionally exceeds vitest's 5s default — every later test in this
  // file reuses the warm module cache and stays fast.
  it('defaults to the cloudflare target with DB/MEDIA bindings', async () => {
    const hosting = await vitopsHosting();
    expect(hosting.target).toBe('cloudflare');
    // @astrojs/cloudflare returns an Astro adapter integration.
    expect(hosting.adapter).toMatchObject({ name: '@astrojs/cloudflare' });
    expect(hosting.database).toBeTruthy();
    expect(hosting.storage).toBeTruthy();
  }, 15000);

  it('passes cloudflare binding overrides through', async () => {
    const hosting = await vitopsHosting({
      cloudflare: { dbBinding: 'MY_DB', mediaBinding: 'MY_MEDIA', session: 'first-primary' },
    });
    // The descriptors are opaque to us; assert the overrides landed somewhere
    // in their serialized config rather than depending on emdash internals.
    expect(JSON.stringify(hosting.database)).toContain('MY_DB');
    expect(JSON.stringify(hosting.storage)).toContain('MY_MEDIA');
  });

  it('node target fails with install instructions while @astrojs/node is absent', async () => {
    await expect(vitopsHosting({ target: 'node' })).rejects.toThrow(
      /needs @astrojs\/node[\s\S]*pnpm add @astrojs\/node better-sqlite3/,
    );
  });

  it('HOSTING env var wins over options.target', async () => {
    process.env.HOSTING = 'node';
    await expect(vitopsHosting({ target: 'cloudflare' })).rejects.toThrow(/@astrojs\/node/);
  });

  it('rejects unknown targets, naming the valid ones', async () => {
    process.env.HOSTING = 'vercel';
    await expect(vitopsHosting()).rejects.toThrow(
      /unknown hosting target 'vercel'.*cloudflare, node/,
    );
  });
});
