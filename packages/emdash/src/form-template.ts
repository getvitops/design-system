/**
 * A saved `vitops_form` block as a `site.templates` form entry.
 *
 * `vitops legal` derives "what personal information we collect" from `site.templates` entries
 * of type `form`, and a build cannot read the CMS database the editor's block lives in, so a
 * form added in the admin is invisible to the generated privacy policy. This turns a block's
 * saved value (copy it from the admin's JSON view, or from `emdash` content export) into the
 * entry to paste under `site.templates` in `site.json`.
 *
 * It resolves fields through the SAME `resolveFields` the renderer uses, so the names are the
 * ones the form actually submits (`phone` becomes `tel`, reserved names are renamed) and rows
 * the renderer drops (no label) are dropped here too. A `checkboxes` becomes a `checkbox`
 * with its choices as `options`: the policy's schema has no group type and both read as
 * "your answers to the questions we ask".
 */
import { resolveFields, safeAction } from './astro/blocks/form.ts';

/** The `fields` row shape of a `site.templates` form entry (`FormFieldSchema`). */
export interface FormTemplateField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  label: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface FormTemplate {
  type: 'form';
  action: string;
  method: 'post';
  honeypot: true;
  fields: FormTemplateField[];
}

/** `block` is a saved `vitops_form` value (the object with `fields`, `action`, …). */
export function formTemplateFromBlock(block: unknown): FormTemplate {
  const value = (block && typeof block === 'object' ? block : {}) as Record<string, unknown>;
  const rawRows = Array.isArray(value['fields']) ? value['fields'] : [];
  const rows = rawRows.filter(
    (r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r),
  );
  const action = safeAction(value['action']);
  return {
    type: 'form',
    action,
    method: 'post',
    honeypot: true,
    fields: resolveFields(rows).map((f) => ({
      name: f.name,
      type: f.type === 'checkboxes' ? 'checkbox' : f.type,
      label: f.label,
      ...(f.required ? { required: true } : {}),
      ...(f.options.length ? { options: f.options.map((o) => ({ label: o, value: o })) } : {}),
    })),
  };
}
