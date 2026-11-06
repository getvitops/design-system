import { describe, expect, it } from 'vite-plus/test';
import { jsonLdScript } from './json-ld.ts';

describe('jsonLdScript', () => {
  it('cannot be closed early by a </script> inside a value', () => {
    const out = jsonLdScript({ reviewBody: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script');
    expect(out).not.toContain('<');
  });

  it('round-trips to the original value', () => {
    const value = {
      name: 'A & B <i>',
      body: 'line sep ',
      nested: [{ x: '</script>' }],
    };
    expect(JSON.parse(jsonLdScript(value))).toEqual(value);
  });

  it('leaves ordinary JSON-LD untouched', () => {
    const value = { '@context': 'https://schema.org', '@type': 'FAQPage' };
    expect(jsonLdScript(value)).toBe(JSON.stringify(value));
  });
});
