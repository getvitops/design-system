/**
 * A tiny static server for a prerendered Cloudflare static-assets build (`dist/client`), used
 * by `e2e-audit.mjs` so the audit sees what the edge would serve.
 *
 * Why not `astro preview` or `wrangler dev`: `astro preview` is unverified against the
 * Cloudflare adapter, and `wrangler dev` needs the Workers runtime (workerd) and fetches
 * nothing offline-safe for a purely static check. Everything the audit measures is
 * prerendered HTML + assets, so serving the files is faithful — with one thing worth
 * reproducing: `public/_headers`. The report-only CSP and security headers are real
 * assets-layer behaviour, so this applies the file's rules the way Cloudflare does
 * (path patterns with `*` splats; header lines indented beneath). Not reproduced: `_redirects`,
 * and the Worker-rendered routes (`/_emdash/*`), which an audit of prerendered pages never hits.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

/** Parse a Cloudflare `_headers` file into `[{ test(path), headers: [[name, value]] }]`. */
export function parseHeaders(source) {
  const rules = [];
  let current = null;
  for (const raw of source.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      const pattern = raw.trim();
      // `*` splat matches anything (including `/`); `:name` placeholders match one segment.
      const re = new RegExp(
        `^${pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/:\w+/g, '[^/]+')
          .replace(/\*/g, '.*')}$`,
      );
      current = { test: (p) => re.test(p), headers: [] };
      rules.push(current);
    } else if (current) {
      const i = raw.indexOf(':');
      if (i > 0) current.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}

function resolveFile(root, pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = join(root, clean);
  if (!base.startsWith(root + sep) && base !== root) return null;
  const candidates = pathname.endsWith('/')
    ? [join(base, 'index.html')]
    : [base, `${base}.html`, join(base, 'index.html')];
  return candidates.find((f) => existsSync(f) && statSync(f).isFile()) ?? null;
}

/** Start serving `root` on `port` (127.0.0.1). Returns `{ url, stop() }`. */
export function serveStatic(root, port) {
  const headersFile = join(root, '_headers');
  const rules = existsSync(headersFile) ? parseHeaders(readFileSync(headersFile, 'utf8')) : [];
  const notFound = join(root, '404.html');

  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const file = resolveFile(root, pathname);
    const status = file ? 200 : 404;
    const body = file ?? (existsSync(notFound) ? notFound : null);
    /** @type {Record<string, string>} */
    const headers = {
      'content-type': TYPES[extname(body ?? '.txt')] ?? 'application/octet-stream',
      // Cloudflare assets serve with `max-age=0, must-revalidate` unless `_headers` says otherwise.
      'cache-control': 'public, max-age=0, must-revalidate',
    };
    for (const rule of rules) {
      if (!rule.test(pathname)) continue;
      for (const [name, value] of rule.headers) {
        const key = name.toLowerCase();
        // A repeated name is joined, as `_headers` documents.
        headers[key] =
          headers[key] && key !== 'cache-control' ? `${headers[key]}, ${value}` : value;
      }
    }
    res.writeHead(status, headers);
    res.end(body ? readFileSync(body) : 'Not found');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${port}`,
        stop: () => server.close(),
        headerRules: rules.length,
      }),
    );
  });
}
