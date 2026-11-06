/**
 * The `behavior` for a programmatic `scrollIntoView`.
 *
 * `scroll-behavior: smooth` in CSS is overridden by an explicit `behavior: 'smooth'` in the
 * call, so a stylesheet's `prefers-reduced-motion` block cannot protect a script that always
 * asks for smooth. Read the preference at call time — not once at connect — so toggling the
 * OS setting while a page is open takes effect on the next scroll.
 */
export function scrollBehavior(): ScrollBehavior {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}
