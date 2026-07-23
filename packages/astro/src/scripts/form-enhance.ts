// Form enhancement: submit via fetch with inline success/error.
// Loaded by FormRenderer.astro independently of analytics/tracking.

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll<HTMLFormElement>(
    'form[action*="/api/"], form[data-track-form]'
  );

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // Clear any previous error
      form.querySelector('.form-error')?.remove();

      const formData = new FormData(form);
      const data = Object.fromEntries(
        [...formData.entries()].map(([k, v]) => [k, String(v)])
      );

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          // Replace form with success message
          const msg = document.createElement('div');
          msg.className = 'form-success';
          msg.setAttribute('role', 'status');
          msg.textContent = json.message ?? 'Thank you! We will be in touch soon.';
          form.replaceWith(msg);
        } else {
          const detail = json.errors?.length ? `\n${json.errors.join('\n')}` : '';
          showError(form, (json.error ?? 'Something went wrong.') + detail, submitBtn);
        }
      } catch {
        showError(form, 'Network error. Please try again.', submitBtn);
      }
    });
  });
});

function showError(form: HTMLFormElement, message: string, btn: HTMLButtonElement | null): void {
  const err = document.createElement('div');
  err.className = 'form-error';
  err.setAttribute('role', 'alert');
  err.textContent = message;
  form.prepend(err);
  if (btn) btn.disabled = false;
}
