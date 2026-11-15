import { describe, expect, it } from 'vite-plus/test';
import { astroDevArgs } from './emdash.js';

describe('prepare-db', () => {
  // Astro 7 only detaches `astro dev` by itself when it detects an AI agent. In CI it ran in the
  // foreground and the 5-minute spawn timeout killed it, so the flag has to be explicit.
  it('starts the dev server with --background', () => {
    expect(astroDevArgs(4321)).toEqual([
      'dev',
      '--background',
      '--port',
      '4321',
      '--host',
      '127.0.0.1',
    ]);
  });
});
