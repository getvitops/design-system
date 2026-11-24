/**
 * Turn an editor-pasted address into the iframe `src` for a provider, and say which
 * consent category loading it needs.
 *
 * Pure so the consequential cases — what is allowed to become a frame, and which
 * category it waits on — are asserted without rendering. The rule is **closed by
 * default**: a `custom` embed must still be `https:`, and each named provider only
 * accepts its own hosts, so a pasted `javascript:` or an unrelated site never reaches an
 * iframe `src`.
 */
export type EmbedProvider = 'youtube' | 'vimeo' | 'map' | 'custom';

export interface ResolvedEmbed {
  /** Address the consent runtime assigns to the iframe after the visitor allows it. */
  src: string;
  /** What the placeholder calls the third party ("YouTube"). */
  provider: string;
  /** Where the visitor can open the same content without embedding it. */
  openUrl: string;
}

const NAMES: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  map: 'Google Maps',
  custom: 'a third party',
};

function parse(input: unknown): URL | null {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const host = (url: URL, ...names: string[]) =>
  names.some((n) => url.hostname === n || url.hostname.endsWith(`.${n}`));

/** The id of a YouTube watch / short / embed address, or null. */
function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
  if (!host(url, 'youtube.com', 'youtube-nocookie.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const m = /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(url.pathname);
  return m ? m[1]! : null;
}

export function resolveEmbed(provider: unknown, input: unknown): ResolvedEmbed | null {
  const url = parse(input);
  if (!url) return null;
  const kind = (['youtube', 'vimeo', 'map', 'custom'] as const).includes(provider as EmbedProvider)
    ? (provider as EmbedProvider)
    : 'custom';
  const provider_ = NAMES[kind];
  const done = (src: string): ResolvedEmbed => ({ src, provider: provider_, openUrl: url.href });

  switch (kind) {
    case 'youtube': {
      const id = youtubeId(url);
      // The no-cookie host: the same player, and it sets nothing until the visitor plays.
      return id && /^[\w-]+$/.test(id)
        ? done(`https://www.youtube-nocookie.com/embed/${id}`)
        : null;
    }
    case 'vimeo': {
      const m = /^\/(?:video\/)?(\d+)/.exec(url.pathname);
      return host(url, 'vimeo.com') && m
        ? done(`https://player.vimeo.com/video/${m[1]}?dnt=1`)
        : null;
    }
    case 'map': {
      // Only the embed endpoints: a plain maps.google.com share link refuses framing.
      const google = host(url, 'google.com') && url.pathname.startsWith('/maps/embed');
      const osm =
        url.hostname === 'www.openstreetmap.org' && url.pathname.startsWith('/export/embed');
      return google || osm ? done(url.href) : null;
    }
    default:
      return done(url.href);
  }
}
