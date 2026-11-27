import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { serveStatic } from './static-server.mjs';

let server;
let base;
const css = `.a{color:red}${'.b{margin:0}'.repeat(500)}`;

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), 'vitops-static-'));
  writeFileSync(join(root, 'index.html'), '<html></html>');
  writeFileSync(join(root, 'a.css'), css);
  writeFileSync(join(root, 'p.png'), Buffer.from([137, 80, 78, 71]));
  server = await serveStatic(root, 0 + 43000 + Math.floor(Math.random() * 1000));
  base = server.url;
});
afterAll(() => server.stop());

/** Raw request: `fetch` decodes transparently, and the point is what is on the wire. */
const get = (path, acceptEncoding) =>
  new Promise((resolve, reject) => {
    request(`${base}${path}`, { headers: { 'accept-encoding': acceptEncoding } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ res, bytes: Buffer.concat(chunks) }));
    })
      .on('error', reject)
      .end();
  });

describe('static audit server', () => {
  it('serves brotli to a client that accepts it, smaller than the file, and it round-trips', async () => {
    const { res, bytes } = await get('/a.css', 'br, gzip');
    expect(res.headers['content-encoding']).toBe('br');
    expect(bytes.length).toBeLessThan(css.length / 4);
    expect(brotliDecompressSync(bytes).toString()).toBe(css);
  });

  it('falls back to gzip, then to identity', async () => {
    const gz = await get('/a.css', 'gzip');
    expect(gz.res.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.bytes).toString()).toBe(css);
    const plain = await get('/a.css', 'identity');
    expect(plain.res.headers['content-encoding']).toBeUndefined();
    expect(plain.bytes.toString()).toBe(css);
  });

  it('marks compressible responses as varying on accept-encoding', async () => {
    expect((await get('/a.css', 'br')).res.headers.vary).toBe('accept-encoding');
  });

  it('does not compress images', async () => {
    expect((await get('/p.png', 'br')).res.headers['content-encoding']).toBeUndefined();
  });
});
