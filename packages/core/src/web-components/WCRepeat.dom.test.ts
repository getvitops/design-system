/**
 * @vitest-environment happy-dom
 *
 * `<wc-repeat>` over markup the real renderer wrote: the fallback rows stay usable, Add makes a
 * scrubbed row at a fresh index, Remove drops one without disturbing the others' names, a summary
 * follows its key, and a blocked submit unfolds the row it is about.
 */
import { resolveProjection, type JsonSchema, type Projection } from '@getvitops/config/forms';
import { formToConfig } from '@getvitops/config/forms';
import { renderProjectionHtml } from '@getvitops/utils/forms';
import { beforeAll, describe, expect, it } from 'vite-plus/test';
import type { WCRepeat } from './WCRepeat.ts';

beforeAll(async () => {
  await import('./WCField.ts');
  await import('./WCConfigForm.ts');
  await import('./WCRepeat.ts');
});

const SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    organization: {
      type: 'object',
      additionalProperties: false,
      properties: {
        locations: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            required: ['name'],
            properties: { name: { type: 'string', minLength: 1 }, phone: { type: 'string' } },
          },
        },
      },
    },
  },
};

const PROJECTION: Projection = {
  id: 't',
  title: 'T',
  items: [{ path: 'organization.locations', fields: ['name', 'phone'] }],
};

async function mount(values: unknown = {}): Promise<WCRepeat> {
  const fields = renderProjectionHtml(resolveProjection(SCHEMA, PROJECTION, { values }), {
    values,
    locales: ['en'],
  });
  document.body.innerHTML = `<form method="post">${fields}</form>`;
  await Promise.resolve();
  await Promise.resolve();
  return document.querySelector('wc-repeat') as WCRepeat;
}

const SEED = {
  organization: { locations: { ottawa: { name: 'Ottawa' }, kanata: { name: 'Kanata' } } },
};
const names = (repeat: WCRepeat) =>
  repeat.rows.map((row) => (row.querySelector('input[name$="$key"]') as HTMLInputElement).value);
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const value = () => formToConfig(new FormData(document.querySelector('form')!));

describe('<wc-repeat> fallback markup', () => {
  it('renders each row as an open <details> with a summary and one blank row last', async () => {
    document.body.innerHTML = '';
    const html = renderProjectionHtml(resolveProjection(SCHEMA, PROJECTION, { values: SEED }), {
      values: SEED,
      locales: ['en'],
    });
    expect(html).toContain('<wc-repeat');
    expect(html.match(/<details class="field__row"/g)).toHaveLength(3);
    expect(html.match(/data-blank/g)).toHaveLength(1);
    expect(html).toContain('field__row-title');
  });
});

describe('<wc-repeat> enhanced', () => {
  it('takes the blank row out, and adds Add and Remove buttons', async () => {
    const repeat = await mount(SEED);
    expect(repeat.hasAttribute('data-ready')).toBe(true);
    expect(repeat.rows).toHaveLength(2);
    expect(repeat.querySelectorAll('[data-repeat-action="delete"]')).toHaveLength(2);
    expect(repeat.querySelector('[data-repeat-action="add"]')?.textContent).toBe('Add location');
  });

  it('Add makes an empty row at the next free index and focuses it', async () => {
    const repeat = await mount(SEED);
    click(repeat.querySelector('[data-repeat-action="add"]')!);
    expect(repeat.rows).toHaveLength(3);
    const added = repeat.rows[2]!;
    const key = added.querySelector('input[name$="$key"]') as HTMLInputElement;
    expect(key.name).toBe('organization.locations$map.2.$key');
    expect(key.value).toBe('');
    expect(added.querySelector('summary')?.textContent).toBe('New location');
    expect(added.hasAttribute('data-blank')).toBe(false);
  });

  it('a new row posts as an entry once its key is filled in', async () => {
    const repeat = await mount(SEED);
    click(repeat.querySelector('[data-repeat-action="add"]')!);
    const added = repeat.rows[2]!;
    (added.querySelector('input[name$="$key"]') as HTMLInputElement).value = 'gatineau';
    (added.querySelector('input[name$="name"]:not([name$="$key"])') as HTMLInputElement).value =
      'Gatineau';
    expect(
      (value() as { organization: { locations: Record<string, unknown> } }).organization.locations,
    ).toMatchObject({ gatineau: { name: 'Gatineau' }, ottawa: { name: 'Ottawa' } });
  });

  it('Remove drops that row and leaves the others named as they were', async () => {
    const repeat = await mount(SEED);
    click(repeat.rows[0]!.querySelector('[data-repeat-action="delete"]')!);
    expect(names(repeat)).toEqual(['kanata']);
    expect((repeat.rows[0]!.querySelector('input[name$="$key"]') as HTMLInputElement).name).toBe(
      'organization.locations$map.1.$key',
    );
    expect((value() as { organization: { locations: object } }).organization.locations).toEqual({
      kanata: { name: 'Kanata' },
    });
  });

  it('does not reuse the index of a deleted row for the next one', async () => {
    const repeat = await mount(SEED);
    click(repeat.rows[1]!.querySelector('[data-repeat-action="delete"]')!);
    click(repeat.querySelector('[data-repeat-action="add"]')!);
    const key = repeat.rows[1]!.querySelector('input[name$="$key"]') as HTMLInputElement;
    expect(key.name).toBe('organization.locations$map.2.$key');
  });

  it('keeps the summary in step with the key, and announces changes', async () => {
    const repeat = await mount(SEED);
    const row = repeat.rows[0]!;
    const key = row.querySelector('input[name$="$key"]') as HTMLInputElement;
    key.value = 'Ottawa HQ';
    key.dispatchEvent(new Event('input', { bubbles: true }));
    expect(row.querySelector('summary')?.textContent).toBe('Ottawa HQ');
    click(row.querySelector('[data-repeat-action="delete"]')!);
    expect(repeat.querySelector('[role="status"]')?.textContent).toBe('Removed Ottawa HQ');
  });

  it('fires input and repeat-change on add and delete', async () => {
    const repeat = await mount(SEED);
    const seen: string[] = [];
    repeat.addEventListener('input', () => seen.push('input'));
    repeat.addEventListener('repeat-change', (e) =>
      seen.push((e as CustomEvent<{ action: string }>).detail.action),
    );
    click(repeat.querySelector('[data-repeat-action="add"]')!);
    click(repeat.rows[2]!.querySelector('[data-repeat-action="delete"]')!);
    expect(seen).toEqual(['input', 'add', 'input', 'delete']);
  });

  it('unfolds a folded row that holds the control a blocked submit is about', async () => {
    const repeat = await mount(SEED);
    const row = repeat.rows[0] as HTMLDetailsElement;
    row.open = false;
    const control = row.querySelector('input[name$="name"]:not([name$="$key"])')!;
    control.dispatchEvent(new Event('invalid'));
    expect(row.open).toBe(true);
  });

  it('can add a first row when none exist', async () => {
    const repeat = await mount({});
    expect(repeat.rows).toHaveLength(0);
    click(repeat.querySelector('[data-repeat-action="add"]')!);
    expect(repeat.rows).toHaveLength(1);
  });
});
