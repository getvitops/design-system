/**
 * Overflow probe — drives a headless Chrome over CDP and reports, per page and
 * per viewport width, whether the document scrolls horizontally and which
 * element is responsible.
 *
 * Zero dependencies on purpose: Node's global WebSocket talks to CDP directly,
 * so this needs no playwright/puppeteer install and can run anywhere Chrome is.
 *
 *   node scripts/measure-overflow.mjs [baseUrl] [--widths=320,390]
 *
 * `document.documentElement.scrollWidth > clientWidth` is the acceptance test;
 * the culprit list is what makes a failure actionable rather than just red.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:4321';
const WIDTHS = (process.argv.find((a) => a.startsWith('--widths='))?.split('=')[1] ?? '320,390')
  .split(',')
  .map(Number);
const PATHS = [
  '/',
  '/reference/concepts-color/',
  '/reference/css-classes/',
  '/theme/',
  '/animation/',
  '/icons/',
  // The densest page in the site, and the only one holding every overlay at once.
  '/patterns/',
];

const CHROME = process.env.CHROME_BIN ?? '/usr/bin/google-chrome-stable';
const PORT = 9333;

/** Find the overflowing elements, not just the fact of overflow. */
const PROBE = `(() => {
  const de = document.documentElement;
  const limit = de.clientWidth;
  const culprits = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Fixed elements don't create scrollable overflow; skip the noise.
    if (getComputedStyle(el).position === 'fixed') continue;
    // Right-edge only. A negatively-positioned box (the skip link lives at
    // -100vw) is not scrollable-to in LTR, so flagging it is pure noise — it
    // showed up on every page including the ones that fit.
    if (r.right > limit + 1) {
      culprits.push({
        sel: el.tagName.toLowerCase() +
             (el.id ? '#' + el.id : '') +
             (typeof el.className === 'string' && el.className
               ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  // Only the outermost offenders matter — a wide child inside a wide parent is
  // one bug, not two. Keep the first few in document order.
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: limit,
    overflow: de.scrollWidth > limit,
    culprits: culprits.slice(0, 6),
  };
})()`;

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const cleanup = () => chrome.kill();
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(1));

/** Wait for the DevTools endpoint rather than guessing a startup delay. */
async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(100);
    }
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();
  #sessions = new Map();

  static async connect(url) {
    const c = new Cdp();
    c.#ws = new WebSocket(url);
    await new Promise((res, rej) => {
      c.#ws.addEventListener('open', res, { once: true });
      c.#ws.addEventListener('error', rej, { once: true });
    });
    c.#ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const p = c.#pending.get(msg.id);
      if (!p) return;
      c.#pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    });
    return c;
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id;
    return new Promise((res, rej) => {
      this.#pending.set(id, { res, rej });
      this.#ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  close() {
    this.#ws.close();
  }
}

const cdp = await Cdp.connect(await endpoint());
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

const rows = [];
for (const width of WIDTHS) {
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height: 844, deviceScaleFactor: 2, mobile: true },
    sessionId,
  );
  for (const path of PATHS) {
    await cdp.send('Page.navigate', { url: BASE + path }, sessionId);
    // Astro ships no client JS on these routes, so a short settle is enough for
    // layout; the web-component bundles are deferred and don't move the shell.
    await sleep(700);
    const { result } = await cdp.send(
      'Runtime.evaluate',
      { expression: PROBE, returnByValue: true },
      sessionId,
    );
    rows.push({ width, path, ...result.value });
  }
}

cdp.close();
chrome.kill();

let failed = 0;
for (const r of rows) {
  const tag = r.overflow ? 'OVERFLOW' : 'ok      ';
  if (r.overflow) failed++;
  console.log(
    `${tag} ${String(r.width).padStart(3)}px  ${r.path.padEnd(28)} ${r.scrollWidth}/${r.clientWidth}`,
  );
  // Only on a real failure. A wide <pre> line or table cell sticks out of the
  // viewport by design once its own scroll container clips it, so listing those
  // on a passing page reads as a problem that isn't one.
  if (r.overflow)
    for (const c of r.culprits) console.log(`           ↳ ${c.sel}  [${c.left} → ${c.right}]`);
}
console.log(`\n${rows.length - failed}/${rows.length} page/width combinations fit.`);
process.exit(failed ? 1 : 0);
