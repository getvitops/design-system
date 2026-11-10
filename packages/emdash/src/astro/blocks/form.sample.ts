/**
 * A realistic saved `vitops_form` block, for tests and the e2e fixtures: the fields a small
 * service business asks for, including the two names the conversion route treats specially.
 */
export const SAMPLE_FORM_BLOCK = {
  _type: 'vitops_form',
  _key: 'contact',
  heading: 'Get in touch',
  level: '2',
  intro: 'Tell us about your project and we will reply within one business day.',
  fields: [
    { label: 'Your name', name: 'name', type: 'text', required: true },
    {
      label: 'Email',
      name: 'email',
      type: 'email',
      required: true,
      help: 'We only use it to reply.',
    },
    { label: 'Phone', name: 'phone', type: 'tel', required: false },
    {
      label: 'Service',
      name: 'service',
      type: 'select',
      required: false,
      options: 'Maintenance\nDesign\nInstallation',
    },
    {
      label: 'Interested in',
      name: 'interests',
      type: 'checkboxes',
      options: 'Managed IT\nWeb design\nSEO',
    },
    { label: 'Message', name: 'message', type: 'textarea', required: true },
    { label: 'Add me to your newsletter', name: 'newsletter', type: 'checkbox' },
  ],
  submitLabel: 'Send message',
  successMessage: 'Thanks, we will be in touch.',
};
