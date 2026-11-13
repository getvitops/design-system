/**
 * @vitest-environment happy-dom
 *
 * `<wc-config-form>` wiring, over markup the real renderer wrote. The pure decisions (which config
 * path a control is at, which message belongs to it, how a row is renumbered) are in
 * `utils/config-form.test.ts`; this is the DOM: that messages show at the right moment on the right
 * field, a submit with errors is stopped, and the blank row of a keyed map is replaced as it is used.
 */
import { resolveProjection, type JsonSchema, type Projection } from '@getvitops/config/forms';
import { renderProjectionHtml } from '@getvitops/utils/forms';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WCConfigForm } from './WCConfigForm.ts';

beforeAll(async () => {
  await import('./WCField.ts');
  await import('./WCConfigForm.ts');
});

const SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    organization: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
        services: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' }, price: { type: 'number', minimum: 0 } },
          },
        },
      },
    },
  },
};

const PROJECTION: Projection = {
  id: 't',
  title: 'T',
  items: ['organization.name', 'organization.email', 'organization.services'],
};

async function mount(
  values: unknown = {},
  attrs = 'schema="s" output="#out"',
  schema: JsonSchema | null = SCHEMA,
): Promise<WCConfigForm> {
  const fields = renderProjectionHtml(resolveProjection(SCHEMA, PROJECTION, { values }), {
    values,
    locales: ['en'],
  });
  document.body.innerHTML = `
    <wc-config-form ${attrs}><form method="post">${fields}</form></wc-config-form>
    ${schema ? `<script type="application/json" id="s">${JSON.stringify(schema)}</script>` : ''}
    <pre id="out"></pre>`;
  // Markup that arrives with `innerHTML` is connected before its children exist, so both elements
  // initialise on the retry microtask (see `utils/upgrade.ts`).
  await Promise.resolve();
  await Promise.resolve();
  return document.querySelector('wc-config-form') as WCConfigForm;
}

// Compared by property, not selector: names hold `$` and `.`, and escaping them for a selector is
// engine-dependent.
const input = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[name]')).find(
    (node) => node.name === name,
  ) as HTMLInputElement;
const fieldOf = (name: string) => input(name).closest('wc-field') as HTMLElement;
const errorOf = (name: string) => fieldOf(name).querySelector('.field__error') as HTMLElement;
const type = (name: string, value: string) => {
  const el = input(name);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const leave = (name: string) => input(name).dispatchEvent(new Event('focusout', { bubbles: true }));
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.field__row'));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<wc-config-form> value and output', () => {
  it('exposes the document the form describes, and fills the output element', async () => {
    const el = await mount({ organization: { name: 'Acme', email: 'a@b.ca' } });
    expect(el.value).toEqual({ organization: { name: 'Acme', email: 'a@b.ca' } });
    expect(JSON.parse(document.getElementById('out')!.textContent!)).toEqual(el.value);
  });

  it('follows what is typed, and tells the page', async () => {
    const el = await mount();
    const seen = vi.fn();
    el.addEventListener('config-change', (e) => seen((e as CustomEvent).detail.value));
    type('organization.name', 'Acme');
    expect(el.value).toEqual({ organization: { name: 'Acme' } });
    expect(seen).toHaveBeenLastCalledWith({ organization: { name: 'Acme' } });
    expect(JSON.parse(document.getElementById('out')!.textContent!)).toEqual({
      organization: { name: 'Acme' },
    });
  });

  it('still works with no schema: a value, and no errors', async () => {
    const el = await mount({}, 'output="#out"', null);
    type('organization.email', 'not-an-email');
    leave('organization.email');
    expect(el.value).toEqual({ organization: { email: 'not-an-email' } });
    expect(errorOf('organization.email').textContent).toBe('');
  });
});

describe('<wc-config-form> validation', () => {
  it('says nothing about a field the visitor has not left', async () => {
    await mount();
    type('organization.email', 'nope');
    expect(errorOf('organization.email').textContent).toBe('');
  });

  it('shows the schema message once the field is left, and clears it when fixed', async () => {
    await mount();
    type('organization.email', 'nope');
    leave('organization.email');
    expect(errorOf('organization.email').textContent).toBe('Must be an email address.');
    expect(fieldOf('organization.email').hasAttribute('data-invalid')).toBe(true);
    // The message also blocks the form's own reportValidity().
    expect(input('organization.email').validity.customError).toBe(true);

    type('organization.email', 'ada@example.com');
    expect(errorOf('organization.email').textContent).toBe('');
    expect(input('organization.email').validity.customError).toBe(false);
  });

  it('leaves a field it has no message for alone', async () => {
    await mount();
    type('organization.email', 'nope');
    leave('organization.email');
    expect(errorOf('organization.name').textContent).toBe('');
  });

  it('reports a bad value inside a map row on that row, found through its key', async () => {
    await mount({
      organization: { services: { roof: { name: 'Roof' }, gutters: { name: 'Gutters' } } },
    });
    type('organization.services$map.1.price$num', '-5');
    leave('organization.services$map.1.price$num');
    expect(errorOf('organization.services$map.1.price$num').textContent).toBe(
      'Must be at least 0.',
    );
    expect(errorOf('organization.services$map.0.price$num').textContent).toBe('');
  });
});

describe('<wc-config-form> submit', () => {
  const submit = (): SubmitEvent => {
    const event = new Event('submit', { cancelable: true, bubbles: true }) as SubmitEvent;
    document.querySelector('form')!.dispatchEvent(event);
    return event;
  };

  it('stops a submit that has errors, shows every one and focuses the first', async () => {
    await mount();
    type('organization.email', 'nope');
    // First invalid in document order is the required `name`, not the email typed into.
    const focus = vi.spyOn(input('organization.name'), 'focus');
    const event = submit();
    expect(event.defaultPrevented).toBe(true);
    expect(errorOf('organization.email').textContent).toBe('Must be an email address.');
    // `name` is required by the schema, and never touched: shown now that a submit was attempted.
    expect(errorOf('organization.name').textContent).not.toBe('');
    expect(focus).toHaveBeenCalled();
  });

  it('lets a clean form through', async () => {
    await mount({ organization: { name: 'Acme' } });
    expect(submit().defaultPrevented).toBe(false);
  });

  it('lets an invalid one through when told the server decides', async () => {
    await mount({}, 'schema="s" novalidate');
    expect(submit().defaultPrevented).toBe(false);
  });

  it('shows everything on validate(), for a caller that is not submitting', async () => {
    const el = await mount();
    // An empty `organization` is valid; `name` is only required once the section exists.
    type('organization.email', 'ada@example.com');
    expect(errorOf('organization.name').textContent).toBe('');
    expect(el.validate().length).toBeGreaterThan(0);
    expect(errorOf('organization.name').textContent).not.toBe('');
  });
});

describe('<wc-config-form> keyed-map rows', () => {
  it('starts with one blank row', async () => {
    await mount();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.hasAttribute('data-blank')).toBe(true);
  });

  it('replaces the blank row once its key is filled in, so there is always one to use', async () => {
    const el = await mount();
    type('organization.services$map.0.$key', 'roof');
    expect(rows()).toHaveLength(2);
    expect(rows()[0]!.hasAttribute('data-blank')).toBe(false);
    expect(rows()[1]!.hasAttribute('data-blank')).toBe(true);

    type('organization.services$map.1.$key', 'gutters');
    expect(rows()).toHaveLength(3);
    expect(rows().filter((r) => r.hasAttribute('data-blank'))).toHaveLength(1);
    expect(el.value).toEqual({}); // keys with nothing in them are not entries
  });

  it('numbers the new row after the old one, in names and in ids', async () => {
    await mount();
    type('organization.services$map.0.$key', 'roof');
    const added = rows()[1]!;
    const names = Array.from(added.querySelectorAll<HTMLInputElement>('[name]')).map((n) => n.name);
    expect(names).toContain('organization.services$map.1.$key');
    expect(names).toContain('organization.services$map.1.name');
    expect(names.some((n) => n.includes('$map.0.'))).toBe(false);
    const ids = Array.from(added.querySelectorAll('[id]')).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(document.getElementById(id)).toBe(added.querySelector(`[id="${id}"]`));
    }
  });

  it('starts the new row empty, whatever the used row held', async () => {
    await mount();
    type('organization.services$map.0.name', 'Roofing');
    type('organization.services$map.0.price$num', '120');
    type('organization.services$map.0.$key', 'roof');
    expect(input('organization.services$map.1.name').value).toBe('');
    expect(input('organization.services$map.1.price$num').value).toBe('');
    expect(input('organization.services$map.1.$key').value).toBe('');
  });

  it('lets the new row be used straight away', async () => {
    const el = await mount();
    type('organization.services$map.0.$key', 'roof');
    type('organization.services$map.0.name', 'Roofing');
    type('organization.services$map.1.$key', 'gutters');
    type('organization.services$map.1.name', 'Gutters');
    expect(el.value).toEqual({
      organization: { services: { roof: { name: 'Roofing' }, gutters: { name: 'Gutters' } } },
    });
  });

  it("does not carry the used row's error or its counter into the new one", async () => {
    await mount();
    type('organization.services$map.0.$key', 'roof');
    type('organization.services$map.0.price$num', '-1');
    leave('organization.services$map.0.price$num');
    type('organization.services$map.0.name', 'x');
    const added = rows()[1]!;
    expect(added.querySelectorAll('[data-invalid]')).toHaveLength(0);
    expect(added.querySelector('.field__error:not(:empty)')).toBeNull();
  });
});
