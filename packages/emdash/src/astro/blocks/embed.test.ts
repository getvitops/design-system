import { describe, expect, it } from 'vite-plus/test';
import { resolveEmbed } from './embed.ts';

describe('resolveEmbed', () => {
  it('rewrites YouTube addresses to the no-cookie embed', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=abc_123-Z',
      'https://youtu.be/abc_123-Z',
      'https://www.youtube.com/shorts/abc_123-Z',
    ])
      expect(resolveEmbed('youtube', url)?.src).toBe(
        'https://www.youtube-nocookie.com/embed/abc_123-Z',
      );
  });

  it('rewrites Vimeo addresses and asks for do-not-track', () => {
    expect(resolveEmbed('vimeo', 'https://vimeo.com/123456')?.src).toBe(
      'https://player.vimeo.com/video/123456?dnt=1',
    );
  });

  it('accepts only the framing endpoints of a map provider', () => {
    expect(resolveEmbed('map', 'https://www.google.com/maps/embed?pb=!1m1')?.provider).toBe(
      'Google Maps',
    );
    expect(resolveEmbed('map', 'https://www.google.com/maps/place/Ottawa')).toBeNull();
    expect(
      resolveEmbed('map', 'https://www.openstreetmap.org/export/embed.html?bbox=1')?.src,
    ).toContain('openstreetmap.org/export/embed');
  });

  it('refuses anything that is not https, and a named provider’s foreign hosts', () => {
    expect(resolveEmbed('custom', 'javascript:alert(1)')).toBeNull();
    expect(resolveEmbed('custom', 'http://example.com/x')).toBeNull();
    expect(resolveEmbed('youtube', 'https://evil.example/watch?v=abc')).toBeNull();
    expect(resolveEmbed('vimeo', 'https://evil.example/123')).toBeNull();
    expect(resolveEmbed('custom', undefined)).toBeNull();
  });

  it('treats an unknown provider as custom https', () => {
    expect(resolveEmbed('nope', 'https://example.com/w')?.src).toBe('https://example.com/w');
  });
});
