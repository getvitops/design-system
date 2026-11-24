import { describe, expect, it } from 'vite-plus/test';
import { SAMPLE_FORM_BLOCK } from './astro/blocks/form.sample.ts';
import { formTemplateFromBlock } from './form-template.ts';

describe('formTemplateFromBlock', () => {
  it('uses the names the form submits, and maps a group to a checkbox with options', () => {
    const tpl = formTemplateFromBlock(SAMPLE_FORM_BLOCK);
    expect(tpl).toMatchObject({
      type: 'form',
      action: '/api/track',
      method: 'post',
      honeypot: true,
    });
    const byName = Object.fromEntries(tpl.fields.map((f) => [f.name, f]));
    expect(byName['tel']).toMatchObject({ type: 'tel', label: 'Phone' });
    expect(byName['phone']).toBeUndefined();
    expect(byName['name']).toMatchObject({ type: 'text', required: true });
    expect(byName['interests']).toMatchObject({
      type: 'checkbox',
      options: [
        { label: 'Managed IT', value: 'Managed IT' },
        { label: 'Web design', value: 'Web design' },
        { label: 'SEO', value: 'SEO' },
      ],
    });
  });

  it('drops unlabeled rows like the renderer and survives junk', () => {
    expect(formTemplateFromBlock({ fields: [{ name: 'x' }, 'no', null] }).fields).toEqual([]);
    expect(formTemplateFromBlock(undefined).fields).toEqual([]);
    expect(formTemplateFromBlock({ action: '//evil.example' }).action).toBe('/api/track');
  });
});
