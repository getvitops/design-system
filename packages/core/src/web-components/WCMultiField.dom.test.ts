/**
 * @vitest-environment happy-dom
 *
 * `<wc-multifield>` over markup the real renderer wrote: the fallback rows stay usable, Add makes a
 * scrubbed row at a fresh index, Remove drops one without disturbing the others' names, a summary
 * follows its key, and a blocked submit unfolds the row it is about.
 */
import { resolveProjection, type JsonSchema, type Projection } from '@getvitops/config/forms';
import { formToConfig } from '@getvitops/config/forms';
import { renderProjectionHtml } from '@getvitops/utils/forms';
import { beforeAll, describe, expect, it } from 'vite-plus/test';
import type { WCMultiField } from './WCMultiField.ts';

beforeAll(async () => {
  await import('./WCField.ts');
  await import('./WCConfigForm.ts');
  await import('./WCMultiField.ts');
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

async function mount(values: unknown = {}): Promise<WCMultiField> {
  const fields = renderProjectionHtml(resolveProjection(SCHEMA, PROJECTION, { values }), {
    values,
    locales: ['en'],
  });
  document.body.innerHTML = `<form method="post">${fields}</form>`;
  await Promise.resolve();
  await Promise.resolve();
  return document.querySelector('wc-multifield') as WCMultiField;
}

const SEED = {
  organization: { locations: { ottawa: { name: 'Ottawa' }, kanata: { name: 'Kanata' } } },
};
const names = (repeat: WCMultiField) =>
  repeat.entries.map((row) => (row.querySelector('input[name$="$key"]') as HTMLInputElement).value);
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const value = () => formToConfig(new FormData(document.querySelector('form')!));

describe('<wc-multifield> fallback markup', () => {
  it('renders each row as an open <details> with a summary and one blank row last', async () => {
    document.body.innerHTML = '';
    const html = renderProjectionHtml(resolveProjection(SCHEMA, PROJECTION, { values: SEED }), {
      values: SEED,
      locales: ['en'],
    });
    expect(html).toContain('<wc-multifield');
    expect(html.match(/<details class="field__row"/g)).toHaveLength(3);
    expect(html.match(/data-blank/g)).toHaveLength(1);
    expect(html).toContain('field__row-title');
  });
});

describe('<wc-multifield> enhanced', () => {
  it('takes the blank row out, and adds Add and Remove buttons', async () => {
    const repeat = await mount(SEED);
    expect(repeat.hasAttribute('data-ready')).toBe(true);
    expect(repeat.entries).toHaveLength(2);
    expect(repeat.querySelectorAll('[data-multifield-action="delete"]')).toHaveLength(2);
    expect(repeat.querySelector('[data-multifield-action="add"]')?.textContent).toBe(
      'Add location',
    );
  });

  it('Add makes an empty row at the next free index and focuses it', async () => {
    const repeat = await mount(SEED);
    click(repeat.querySelector('[data-multifield-action="add"]')!);
    expect(repeat.entries).toHaveLength(3);
    const added = repeat.entries[2]!;
    const key = added.querySelector('input[name$="$key"]') as HTMLInputElement;
    expect(key.name).toBe('organization.locations$map.2.$key');
    expect(key.value).toBe('');
    expect(added.querySelector('summary')?.textContent).toBe('New location');
    expect(added.hasAttribute('data-blank')).toBe(false);
  });

  it('a new row posts as an entry once its key is filled in', async () => {
    const repeat = await mount(SEED);
    click(repeat.querySelector('[data-multifield-action="add"]')!);
    const added = repeat.entries[2]!;
    (added.querySelector('input[name$="$key"]') as HTMLInputElement).value = 'gatineau';
    (added.querySelector('input[name$="name"]:not([name$="$key"])') as HTMLInputElement).value =
      'Gatineau';
    expect(
      (value() as { organization: { locations: Record<string, unknown> } }).organization.locations,
    ).toMatchObject({ gatineau: { name: 'Gatineau' }, ottawa: { name: 'Ottawa' } });
  });

  it('Remove drops that row and leaves the others named as they were', async () => {
    const repeat = await mount(SEED);
    click(repeat.entries[0]!.querySelector('[data-multifield-action="delete"]')!);
    expect(names(repeat)).toEqual(['kanata']);
    expect((repeat.entries[0]!.querySelector('input[name$="$key"]') as HTMLInputElement).name).toBe(
      'organization.locations$map.1.$key',
    );
    expect((value() as { organization: { locations: object } }).organization.locations).toEqual({
      kanata: { name: 'Kanata' },
    });
  });

  it('does not reuse the index of a deleted row for the next one', async () => {
    const repeat = await mount(SEED);
    click(repeat.entries[1]!.querySelector('[data-multifield-action="delete"]')!);
    click(repeat.querySelector('[data-multifield-action="add"]')!);
    const key = repeat.entries[1]!.querySelector('input[name$="$key"]') as HTMLInputElement;
    expect(key.name).toBe('organization.locations$map.2.$key');
  });

  it('keeps the summary in step with the key, and announces changes', async () => {
    const repeat = await mount(SEED);
    const row = repeat.entries[0]!;
    const key = row.querySelector('input[name$="$key"]') as HTMLInputElement;
    key.value = 'Ottawa HQ';
    key.dispatchEvent(new Event('input', { bubbles: true }));
    expect(row.querySelector('summary')?.textContent).toBe('Ottawa HQ');
    click(row.querySelector('[data-multifield-action="delete"]')!);
    expect(repeat.querySelector('[role="status"]')?.textContent).toBe('Removed Ottawa HQ');
  });

  it('fires input and multi-field-change on add and delete', async () => {
    const repeat = await mount(SEED);
    const seen: string[] = [];
    repeat.addEventListener('input', () => seen.push('input'));
    repeat.addEventListener('multi-field-change', (e) =>
      seen.push((e as CustomEvent<{ action: string }>).detail.action),
    );
    click(repeat.querySelector('[data-multifield-action="add"]')!);
    click(repeat.entries[2]!.querySelector('[data-multifield-action="delete"]')!);
    expect(seen).toEqual(['input', 'add', 'input', 'delete']);
  });

  it('unfolds a folded row that holds the control a blocked submit is about', async () => {
    const repeat = await mount(SEED);
    const row = repeat.entries[0] as HTMLDetailsElement;
    row.open = false;
    const control = row.querySelector('input[name$="name"]:not([name$="$key"])')!;
    control.dispatchEvent(new Event('invalid'));
    expect(row.open).toBe(true);
  });

  it('can add a first row when none exist', async () => {
    const repeat = await mount({});
    expect(repeat.entries).toHaveLength(0);
    click(repeat.querySelector('[data-multifield-action="add"]')!);
    expect(repeat.entries).toHaveLength(1);
  });
});

describe('<wc-multifield> repeated fields', () => {
  const mountFields = async (attrs = '', inner = '<input type="email" value="a@x.ca">') => {
    document.body.innerHTML = `<form><wc-multifield name="emails" ${attrs}>${inner}</wc-multifield></form>`;
    await Promise.resolve();
    await Promise.resolve();
    return document.querySelector('wc-multifield') as WCMultiField;
  };
  const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const btn = (host: WCMultiField, kind: string) =>
    host.querySelector(`[data-multifield-action="${kind}"]`) as HTMLButtonElement;

  it('keeps the authored input as a native control and names it as a list', async () => {
    const host = await mountFields();
    const input = host.querySelector('input')!;
    expect(input.value).toBe('a@x.ca');
    expect(input.name).toBe('emails[]');
    expect(host.entries).toHaveLength(1);
  });

  it('Add copies the field empty, same name, and the form submits every value', async () => {
    const host = await mountFields();
    click(btn(host, 'add'));
    expect(host.entries).toHaveLength(2);
    const added = host.entries[1]!.querySelector('input')!;
    expect(added.value).toBe('');
    expect(added.name).toBe('emails[]');
    added.value = 'b@x.ca';
    expect(new FormData(document.querySelector('form')!).getAll('emails[]')).toEqual([
      'a@x.ca',
      'b@x.ca',
    ]);
    expect(host.values).toEqual(['a@x.ca', 'b@x.ca']);
  });

  it('wraps a label+input group and keeps the copy’s label tied to its own input', async () => {
    const host = await mountFields(
      '',
      '<div class="form-group"><label for="mf">Item</label><input id="mf" name="item[]"></div>',
    );
    click(btn(host, 'add'));
    const copy = host.entries[1]!;
    const input = copy.querySelector('input')!;
    expect(input.id).not.toBe('mf');
    expect(copy.querySelector('label')!.htmlFor).toBe(input.id);
  });

  it('will not delete below min, and disables the button', async () => {
    const host = await mountFields();
    expect(
      host.querySelector<HTMLButtonElement>('[data-multifield-action="delete"]')!.disabled,
    ).toBe(true);
    click(btn(host, 'add'));
    expect(
      host.querySelector<HTMLButtonElement>('[data-multifield-action="delete"]')!.disabled,
    ).toBe(false);
  });

  it('stops adding at max', async () => {
    const host = await mountFields('max="2"');
    click(btn(host, 'add'));
    expect(btn(host, 'add').disabled).toBe(true);
    click(btn(host, 'add'));
    expect(host.entries).toHaveLength(2);
  });

  it('protect-defaults keeps the entries it started with', async () => {
    const host = await mountFields('protect-defaults');
    click(btn(host, 'add'));
    const deletes = host.querySelectorAll<HTMLButtonElement>('[data-multifield-action="delete"]');
    expect(deletes[0]!.disabled).toBe(true);
    expect(deletes[1]!.disabled).toBe(false);
    click(btn(host, 'clear'));
    expect(host.entries).toHaveLength(1);
    expect(host.values).toEqual(['a@x.ca']);
  });

  it('Clear empties the list back to min, and says so', async () => {
    const host = await mountFields('min="1"');
    click(btn(host, 'add'));
    click(btn(host, 'add'));
    const seen: string[] = [];
    host.addEventListener('multi-field-clear', () => seen.push('clear'));
    click(btn(host, 'clear'));
    expect(host.entries).toHaveLength(1);
    expect(host.values).toEqual(['']);
    expect(seen).toEqual(['clear']);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Cleared');
  });

  it('fills type and placeholder in where the control sets none', async () => {
    const host = await mountFields('type="email" placeholder="Another"', '<input>');
    const input = host.querySelector('input')!;
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('Another');
  });

  it('pads to min on upgrade', async () => {
    const host = await mountFields('min="3"');
    expect(host.entries).toHaveLength(3);
  });
});
