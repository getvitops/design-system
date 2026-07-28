/**
 * Semantic icon name mapping across icon sets.
 *
 * Keys are functional/semantic names (what the icon means).
 * Values are the actual icon names in each set.
 *
 * Two consumers:
 *   - `generateIconInclude()` (below) — build time. Turns the semantic names a project
 *     declares into the `include` map astro-icon needs, so the icon set can be swapped
 *     without touching call sites.
 *   - `<wc-icon-picker>` (@getvitops/core) — browser. Its `semantic` mode lists these
 *     keys so an icon can be chosen by meaning rather than by set-specific name.
 *
 * `resolveIcon`/`resolveBrandIcon` map one semantic name to a fully-qualified
 * `prefix:name` string for a given set.
 */

/**
 * Maps astro-icon prefixes to iconMap lookup keys.
 * FA7 variants (fa7-solid, fa7-regular, etc.) all share the same icon names
 * and map to the 'fa7' key. Other sets map to themselves.
 */
export const prefixToMapKey: Record<string, string> = {
  'fa7-solid': 'fa7',
  'fa7-regular': 'fa7',
  'fa7-light': 'fa7',
  'fa7-thin': 'fa7',
  'fa7-brands': 'fa7-brands',
  'simple-icons': 'simple-icons',
  'material-symbols': 'material-symbols',
  lucide: 'lucide',
};

export const iconMap = {
  fa7: {
    // Navigation / UI
    menu: 'bars',
    close: 'xmark',
    home: 'home',
    settings: 'gear',
    search: 'magnifying-glass',
    'expand-more': 'chevron-down',
    'expand-less': 'chevron-up',
    'chevron-right': 'chevron-right',
    'chevron-left': 'chevron-left',
    'arrow-back': 'arrow-left',
    'arrow-forward': 'arrow-right',
    'external-link': 'arrow-up-right-from-square',
    'more-vert': 'ellipsis-vertical',
    'more-horiz': 'ellipsis',

    // Actions
    add: 'plus',
    remove: 'minus',
    delete: 'trash',
    edit: 'pen',
    save: 'floppy-disk',
    copy: 'copy',
    paste: 'paste',
    attach: 'paperclip',
    upload: 'upload',
    download: 'download',
    share: 'share',
    bookmark: 'bookmark',
    favorite: 'heart',
    star: 'star',
    login: 'login',
    logout: 'logout',

    // Communication
    email: 'envelope',
    phone: 'phone',
    location: 'location-dot',
    globe: 'globe',
    link: 'link',

    // Time
    clock: 'clock',
    calendar: 'calendar',
    schedule: 'calendar-days',

    // People
    person: 'user',
    group: 'users',

    // Content / Files
    file: 'file',
    'file-add': 'file-circle-plus',
    folder: 'folder',
    'folder-open': 'folder-open',
    'folder-add': 'folder-plus',
    image: 'image',
    export: 'file-export',
    import: 'file-import',
    backup: 'backup',
    compress: 'compress',

    // Status / Feedback
    check: 'check',
    error: 'circle-exclamation',
    warning: 'triangle-exclamation',
    info: 'circle-info',
    help: 'circle-question',

    // Commerce
    cart: 'cart-shopping',
    tag: 'tag',
    'credit-card': 'credit-card',
    receipt: 'receipt',

    // Nature (landscaping context)
    leaf: 'leaf',
    tree: 'tree',
    seedling: 'seedling',
    trowel: 'trowel',
    droplet: 'droplet',
    snowflake: 'snowflake',
    sun: 'sun',
    cloud: 'cloud',

    // Layout / View
    grid: 'table-cells',
    list: 'list',
    filter: 'filter',
    sort: 'sort',
    fullscreen: 'expand',
    collapse: 'compress',

    // Misc
    building: 'building',
    video: 'video',
    lock: 'lock',
    unlock: 'lock-open',
    eye: 'eye',
    'eye-off': 'eye-slash',
    print: 'print',
    code: 'code',
    palette: 'palette',
    lightbulb: 'lightbulb',
  },

  'fa7-brands': {
    // Social Media
    facebook: 'facebook',
    instagram: 'instagram',
    x: 'x-twitter',
    bluesky: 'bluesky',
    threads: 'threads',
    mastodon: 'mastodon',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    pinterest: 'pinterest-p',
    reddit: 'reddit',
    snapchat: 'snapchat',
    github: 'github',

    // Messaging
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    discord: 'discord',

    // Payment
    stripe: 'stripe',
    paypal: 'paypal',
    visa: 'cc-visa',
    mastercard: 'cc-mastercard',
    amex: 'cc-amex',
    discover: 'cc-discover',
    'apple-pay': 'apple-pay',
    'google-pay': 'google-pay',
    'amazon-pay': 'amazon-pay',

    // Review / Directory
    yelp: 'yelp',
    google: 'google',

    // Platforms
    apple: 'apple',
    microsoft: 'microsoft',
    amazon: 'amazon',
    shopify: 'shopify',
    wordpress: 'wordpress',
    cloudflare: 'cloudflare',
  },

  'simple-icons': {
    // Social Media
    facebook: 'facebook',
    instagram: 'instagram',
    x: 'x',
    bluesky: 'bluesky',
    threads: 'threads',
    mastodon: 'mastodon',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    pinterest: 'pinterest',
    reddit: 'reddit',
    snapchat: 'snapchat',
    github: 'github',

    // Messaging
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    discord: 'discord',

    // Payment
    stripe: 'stripe',
    paypal: 'paypal',
    visa: 'visa',
    mastercard: 'mastercard',
    amex: 'americanexpress',
    discover: 'discover',
    'apple-pay': 'applepay',
    'google-pay': 'googlepay',
    'amazon-pay': 'amazonpay',
    klarna: 'klarna',
    afterpay: 'afterpay',
    square: 'square',
    cashapp: 'cashapp',
    interac: 'interac',

    // Review / Directory
    yelp: 'yelp',
    google: 'google',
    tripadvisor: 'tripadvisor',
    trustpilot: 'trustpilot',
    'google-maps': 'googlemaps',
    homeadvisor: 'homeadvisor',
    houzz: 'houzz',
    nextdoor: 'nextdoor',
    bbb: 'bbb',

    // Platforms
    apple: 'apple',
    microsoft: 'microsoft',
    amazon: 'amazon',
    shopify: 'shopify',
    wordpress: 'wordpress',
    cloudflare: 'cloudflare',
    waze: 'waze',
  },

  'material-symbols': {
    // Navigation / UI
    menu: 'menu',
    close: 'close',
    home: 'home',
    settings: 'settings',
    search: 'search',
    'expand-more': 'expand-more',
    'expand-less': 'expand-less',
    'chevron-right': 'chevron-right',
    'chevron-left': 'chevron-left',
    'arrow-back': 'arrow-back',
    'arrow-forward': 'arrow-forward',
    'external-link': 'open-in-new',
    'more-vert': 'more-vert',
    'more-horiz': 'more-horiz',

    // Actions
    add: 'add',
    remove: 'remove',
    delete: 'delete',
    edit: 'edit',
    save: 'save',
    copy: 'content-copy',
    paste: 'content-paste',
    attach: 'attach-file',
    upload: 'upload',
    download: 'download',
    share: 'share',
    bookmark: 'bookmark',
    favorite: 'favorite',
    star: 'star',
    login: 'login',
    logout: 'logout',

    // Communication
    email: 'mail',
    phone: 'call',
    location: 'location-on',
    globe: 'language',
    link: 'link',

    // Time
    clock: 'schedule',
    calendar: 'calendar-today',
    schedule: 'calendar-month',

    // People
    person: 'person',
    group: 'group',

    // Content / Files
    file: 'description',
    'file-add': 'note-add',
    folder: 'folder',
    'folder-open': 'folder-open',
    'folder-add': 'create-new-folder',
    image: 'image',
    export: 'upload-file',
    import: 'download',
    backup: 'backup',
    compress: 'compress',

    // Status / Feedback
    check: 'check-circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
    help: 'help',

    // Commerce
    cart: 'shopping-cart',
    tag: 'sell',
    'credit-card': 'credit-card',
    receipt: 'receipt-long',

    // Nature (landscaping context)
    leaf: 'eco',
    tree: 'forest',
    seedling: 'potted-plant',
    trowel: 'construction',
    droplet: 'water-drop',
    snowflake: 'ac-unit',
    sun: 'light-mode',
    cloud: 'cloud',

    // Layout / View
    grid: 'grid-view',
    list: 'list',
    filter: 'filter-list',
    sort: 'sort',
    fullscreen: 'fullscreen',
    collapse: 'fullscreen-exit',

    // Misc
    building: 'domain',
    video: 'videocam',
    lock: 'lock',
    unlock: 'lock-open',
    eye: 'visibility',
    'eye-off': 'visibility-off',
    print: 'print',
    code: 'code',
    palette: 'palette',
    lightbulb: 'lightbulb',
  },
  lucide: {
    // Navigation / UI
    menu: 'menu',
    close: 'x',
    home: 'house',
    settings: 'settings',
    search: 'search',
    'expand-more': 'chevron-down',
    'expand-less': 'chevron-up',
    'chevron-right': 'chevron-right',
    'chevron-left': 'chevron-left',
    'arrow-back': 'arrow-left',
    'arrow-forward': 'arrow-right',
    'external-link': 'external-link',
    'more-vert': 'ellipsis-vertical',
    'more-horiz': 'ellipsis',

    // Actions
    add: 'plus',
    remove: 'minus',
    delete: 'trash-2',
    edit: 'pencil',
    save: 'save',
    copy: 'copy',
    paste: 'clipboard-paste',
    attach: 'paperclip',
    upload: 'upload',
    download: 'download',
    share: 'share-2',
    bookmark: 'bookmark',
    favorite: 'heart',
    star: 'star',
    login: 'log-in',
    logout: 'log-out',

    // Communication
    email: 'mail',
    phone: 'phone',
    location: 'map-pin',
    globe: 'globe',
    link: 'link',

    // Time
    clock: 'clock',
    calendar: 'calendar',
    schedule: 'calendar-days',

    // People
    person: 'user',
    group: 'users',

    // Content / Files
    file: 'file',
    'file-add': 'file-plus',
    folder: 'folder',
    'folder-open': 'folder-open',
    'folder-add': 'folder-plus',
    image: 'image',
    export: 'file-output',
    import: 'file-input',
    backup: 'hard-drive-upload',
    compress: 'minimize-2',

    // Status / Feedback
    check: 'check-circle',
    error: 'circle-alert',
    warning: 'triangle-alert',
    info: 'info',
    help: 'circle-help',

    // Commerce
    cart: 'shopping-cart',
    tag: 'tag',
    'credit-card': 'credit-card',
    receipt: 'receipt',

    // Nature (landscaping context)
    leaf: 'leaf',
    tree: 'tree-pine',
    seedling: 'sprout',
    trowel: 'shovel',
    droplet: 'droplet',
    snowflake: 'snowflake',
    sun: 'sun',
    cloud: 'cloud',

    // Layout / View
    grid: 'layout-grid',
    list: 'list',
    filter: 'filter',
    sort: 'arrow-up-down',
    fullscreen: 'maximize',
    collapse: 'minimize',

    // Misc
    building: 'building-2',
    video: 'video',
    lock: 'lock',
    unlock: 'lock-open',
    eye: 'eye',
    'eye-off': 'eye-off',
    print: 'printer',
    code: 'code',
    palette: 'palette',
    lightbulb: 'lightbulb',
  },
} as const satisfies Record<string, Record<string, string>>;

export type IconSet = keyof typeof iconMap;
export type SemanticIcon = keyof (typeof iconMap)['fa7'];
export type BrandIcon = keyof (typeof iconMap)['simple-icons'];

/**
 * Resolve a semantic icon name to a fully-qualified astro-icon string.
 * Names containing ':' are returned as-is (pass-through for fully-qualified names).
 *
 * @param name - Semantic name ('email') or fully-qualified ('fa7-solid:envelope')
 * @param prefix - astro-icon prefix, e.g. 'fa7-solid', 'material-symbols', 'lucide'
 */
export function resolveIcon(name: string, prefix: string): string {
  if (name.includes(':')) return name;
  const mapKey = prefixToMapKey[prefix] as IconSet | undefined;
  if (!mapKey)
    throw new Error(
      `Unknown icon prefix "${prefix}". Valid: ${Object.keys(prefixToMapKey).join(', ')}`,
    );
  const map = iconMap[mapKey];
  const resolved = map[name as keyof typeof map];
  if (!resolved)
    throw new Error(`Icon "${name}" not found in set "${prefix}" (map key: "${mapKey}")`);
  return `${prefix}:${resolved}`;
}

/**
 * Resolve a brand icon name to a fully-qualified astro-icon string.
 * Names containing ':' are returned as-is (pass-through).
 *
 * @param name - Semantic brand name ('facebook') or fully-qualified ('simple-icons:facebook')
 * @param prefix - astro-icon prefix, e.g. 'simple-icons', 'fa7-brands'
 */
export function resolveBrandIcon(name: string, prefix: string): string {
  if (name.includes(':')) return name;
  const mapKey = prefixToMapKey[prefix] as IconSet | undefined;
  if (!mapKey) throw new Error(`Unknown brand icon prefix "${prefix}"`);
  const map = iconMap[mapKey];
  const resolved = map[name as keyof typeof map];
  if (!resolved)
    throw new Error(`Brand icon "${name}" not found in set "${prefix}" (map key: "${mapKey}")`);
  return `${prefix}:${resolved}`;
}

/**
 * Generate the astro-icon `include` map from configured icon sets.
 *
 * Resolves two kinds of entries from the `icons` section of `site.config.yaml`:
 * - Per-set lists (e.g. `'fa7-solid': ['bars', 'plus']`) are passed through as-is.
 * - `semantic` names are looked up in the configured `ui` and `brand` prefix maps,
 *   and the resolved icon names are merged into those sets' lists.
 *
 * Only explicitly configured icons are included — there is no fallback to all icons.
 *
 * @param iconsConfig - Icons config from site.config.yaml (icons section)
 * @returns Record<string, string[]> for astro-icon's `include` option
 */
export function generateIconInclude(iconsConfig?: {
  ui?: string;
  brand?: string;
  semantic?: string[];
  [prefix: string]: string | string[] | undefined;
}): Record<string, string[]> {
  const uiPrefix = iconsConfig?.ui ?? 'fa7-solid';
  const brandPrefix = iconsConfig?.brand ?? 'simple-icons';
  const include: Record<string, string[]> = {};

  const addToInclude = (prefix: string, names: string[]) => {
    include[prefix] = [...new Set([...(include[prefix] ?? []), ...names])];
  };

  // Pass through per-set explicit lists directly
  for (const [key, val] of Object.entries(iconsConfig ?? {})) {
    if (key !== 'ui' && key !== 'brand' && key !== 'semantic' && Array.isArray(val)) {
      addToInclude(key, val as string[]);
    }
  }

  // Resolve semantic names through ui and brand prefix maps.
  const uiMapKey = prefixToMapKey[uiPrefix] as IconSet | undefined;
  const brandMapKey = prefixToMapKey[brandPrefix] as IconSet | undefined;
  const unknownPrefix: string[] = [];
  if (!uiMapKey) unknownPrefix.push(`ui: '${uiPrefix}'`);
  if (!brandMapKey) unknownPrefix.push(`brand: '${brandPrefix}'`);
  if (unknownPrefix.length)
    throw new Error(
      `[vitops icons] Unknown icon set ${unknownPrefix.join(' and ')}. ` +
        `Known sets: ${Object.keys(prefixToMapKey).join(', ')}.`,
    );

  const unresolved: string[] = [];
  for (const name of iconsConfig?.semantic ?? []) {
    const ui = (iconMap[uiMapKey!] as Record<string, string>)[name];
    const brand = (iconMap[brandMapKey!] as Record<string, string>)[name];
    if (ui) addToInclude(uiPrefix, [ui]);
    if (brand) addToInclude(brandPrefix, [brand]);
    if (!ui && !brand) unresolved.push(name);
  }

  // Fail the build rather than silently omitting the icon. Skipping quietly is
  // what makes swapping icon sets frightening: the swap "succeeds" and the gaps
  // only show up as missing glyphs in production.
  if (unresolved.length)
    throw new Error(
      `[vitops icons] ${unresolved.length} semantic icon name(s) not found in ` +
        `ui set '${uiPrefix}' or brand set '${brandPrefix}': ${unresolved.join(', ')}.\n` +
        `Either add them to iconMap in @getvitops/core, or drop them from the ` +
        `\`semantic\` list. Available in '${uiPrefix}': ` +
        `${Object.keys(iconMap[uiMapKey!]).slice(0, 12).join(', ')}…`,
    );

  return include;
}
