/**
 * `.table--bordered` draws every seam once, including around `colspan`, `rowspan`, a two-row
 * header, a `<colgroup>` and a `<tfoot>`. Measured from geometry, not assumed: for every pair of
 * abutting cells the two facing borders must add up to ONE line, and a cell on the outer edge
 * draws none because the table's own border is the frame. Run at three device pixel ratios, where
 * Chromium snaps a 1px border to a different physical width.
 */
import { expect, test, type Page } from '@playwright/test';

type Cell = {
  l: number;
  r: number;
  t: number;
  b: number;
  bl: number;
  br: number;
  bt: number;
  bb: number;
  text: string;
};

async function measure(page: Page, id: string) {
  return page.evaluate((tid) => {
    const table = document.getElementById(tid)!;
    const cs = getComputedStyle(table);
    const frame = {
      top: parseFloat(cs.borderTopWidth),
      right: parseFloat(cs.borderRightWidth),
      bottom: parseFloat(cs.borderBottomWidth),
      left: parseFloat(cs.borderLeftWidth),
      collapse: cs.borderCollapse,
    };
    const tr = table.getBoundingClientRect();
    const cells: Cell[] = Array.from(table.querySelectorAll('th, td')).map((el) => {
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        l: r.left,
        r: r.right,
        t: r.top,
        b: r.bottom,
        bl: parseFloat(c.borderLeftWidth),
        br: parseFloat(c.borderRightWidth),
        bt: parseFloat(c.borderTopWidth),
        bb: parseFloat(c.borderBottomWidth),
        text: (el.textContent ?? '').trim().slice(0, 20),
      };
    });
    return {
      frame,
      cells,
      box: { l: tr.left, r: tr.right, t: tr.top, b: tr.bottom },
    };
  }, id);
}

const EPS = 0.6;
const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) - Math.max(a0, b0) > EPS;

for (const dpr of [1, 1.25, 1.5]) {
  test.describe(`device pixel ratio ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr, viewport: { width: 1200, height: 900 } });

    for (const id of ['pt-table-simple', 'pt-table-complex']) {
      test(`${id}: every seam is one line, the frame is the table's border`, async ({ page }) => {
        await page.goto('/patterns');
        await page.locator(`#${id}`).scrollIntoViewIfNeeded();
        const { frame, cells, box } = await measure(page, id);
        expect(frame.collapse).toBe('separate');
        const line = frame.top;
        expect(line).toBeGreaterThan(0);
        expect([frame.right, frame.bottom, frame.left]).toEqual([line, line, line]);

        const problems: string[] = [];

        // Facing borders between neighbours sum to exactly one line.
        for (const a of cells) {
          for (const b of cells) {
            if (a === b) continue;
            if (Math.abs(a.r - b.l) < EPS && overlap(a.t, a.b, b.t, b.b)) {
              const sum = a.br + b.bl;
              if (Math.abs(sum - line) > 0.01)
                problems.push(`inline seam "${a.text}"|"${b.text}" drawn ${sum} (want ${line})`);
            }
            if (Math.abs(a.b - b.t) < EPS && overlap(a.l, a.r, b.l, b.r)) {
              const sum = a.bb + b.bt;
              if (Math.abs(sum - line) > 0.01)
                problems.push(`block seam "${a.text}"/"${b.text}" drawn ${sum} (want ${line})`);
            }
          }
        }

        // A cell on the outer edge draws nothing there: the table's border is the frame.
        const inner = {
          l: box.l + frame.left,
          r: box.r - frame.right,
          t: box.t + frame.top,
          b: box.b - frame.bottom,
        };
        for (const c of cells) {
          if (Math.abs(c.l - inner.l) < EPS && c.bl !== 0)
            problems.push(`"${c.text}" doubles the left frame`);
          if (Math.abs(c.r - inner.r) < EPS && c.br !== 0)
            problems.push(`"${c.text}" doubles the right frame`);
          if (Math.abs(c.t - inner.t) < EPS && c.bt !== 0)
            problems.push(`"${c.text}" doubles the top frame`);
          if (Math.abs(c.b - inner.b) < EPS && c.bb !== 0)
            problems.push(`"${c.text}" doubles the bottom frame`);
        }

        expect(problems).toEqual([]);
      });
    }
  });
}

test('the rounded corner clips cell backgrounds (a header cell is not square at the corner)', async ({
  page,
}) => {
  await page.goto('/patterns');
  await page.locator('#pt-table-complex').scrollIntoViewIfNeeded();
  const hit = await page.evaluate(() => {
    const table = document.getElementById('pt-table-complex')!;
    const r = table.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(table).borderTopLeftRadius);
    // A point inside the bounding box but outside the curve, one pixel in from each edge.
    const el = document.elementFromPoint(r.left + 1, r.top + 1);
    return { radius, tag: el?.tagName ?? null };
  });
  expect(hit.radius).toBeGreaterThan(2);
  expect(hit.tag).not.toBe('TH');
});

test('a sticky header still sticks inside a bordered table', async ({ page }) => {
  await page.goto('/patterns');
  const stuck = await page.evaluate(async () => {
    const table = document.getElementById('pt-table-simple')!;
    table.classList.add('table--sticky-header');
    const th = table.querySelector('th')!;
    const cs = getComputedStyle(th);
    // `overflow: clip` must not make the table a scroll container.
    return {
      position: cs.position,
      tableOverflow: getComputedStyle(table).overflow,
    };
  });
  expect(stuck.position).toBe('sticky');
  expect(stuck.tableOverflow).toBe('clip');
});
