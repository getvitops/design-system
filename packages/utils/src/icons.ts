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
  ph: 'ph',
};

/**
 * Sets whose weights are a name SUFFIX inside one collection rather than
 * separate prefixed collections. Phosphor is the case that forced this:
 * `ph:lightning`, `ph:lightning-bold`, `ph:lightning-fill` all live in `ph`,
 * whereas Font Awesome splits the same idea across `fa7-solid`/`fa7-regular`/…
 * (which is what `prefixToMapKey` collapses).
 *
 * The first entry is the unsuffixed default — asking for it adds nothing.
 */
export const WEIGHTED_SETS: Record<string, readonly string[]> = {
  ph: ['regular', 'bold', 'duotone', 'fill', 'light', 'thin'],
};

export const iconMap = {
  fa7: {
    // Navigation / UI
    menu: 'bars',
    close: 'xmark',
    home: 'home',
    settings: 'gear',
    search: 'magnifying-glass',
    'chevron-left': 'chevron-left',
    'chevron-right': 'chevron-right',
    'chevron-up': 'chevron-up',
    'chevron-down': 'chevron-down',
    'arrow-left': 'arrow-left',
    'arrow-right': 'arrow-right',
    'arrow-up': 'arrow-up',
    'arrow-down': 'arrow-down',
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
    login: 'right-to-bracket',
    logout: 'right-from-bracket',

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
    backup: 'cloud-arrow-up',
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
    lightning: 'bolt',
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
    'chevron-left': 'chevron-left',
    'chevron-right': 'chevron-right',
    // Material Symbols' chevrons are only named `chevron-*` on the horizontal
    // axis; the vertical pair is `expand-more`/`expand-less`, same glyph.
    'chevron-up': 'expand-less',
    'chevron-down': 'expand-more',
    'arrow-left': 'arrow-back',
    'arrow-right': 'arrow-forward',
    'arrow-up': 'arrow-upward',
    'arrow-down': 'arrow-downward',
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
    lightning: 'bolt',
  },
  lucide: {
    // Navigation / UI
    menu: 'menu',
    close: 'x',
    home: 'house',
    settings: 'settings',
    search: 'search',
    'chevron-left': 'chevron-left',
    'chevron-right': 'chevron-right',
    'chevron-up': 'chevron-up',
    'chevron-down': 'chevron-down',
    'arrow-left': 'arrow-left',
    'arrow-right': 'arrow-right',
    'arrow-up': 'arrow-up',
    'arrow-down': 'arrow-down',
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
    lightning: 'zap',
  },
  // Phosphor. Unlike fa7, the weights are NOT separate collections — `ph` is one
  // collection and the weight is a name SUFFIX (`lightning`, `lightning-bold`,
  // `lightning-fill`, …), which is why `prefixToMapKey` maps `ph` to itself with
  // nothing to collapse. See WEIGHTED_SETS / resolveIcon's `weight` option.
  ph: {
    // Navigation / UI
    menu: 'list',
    close: 'x',
    home: 'house',
    settings: 'gear',
    search: 'magnifying-glass',
    // Phosphor's chevron is the `caret` family; `ph:chevron-*` doesn't exist.
    'chevron-left': 'caret-left',
    'chevron-right': 'caret-right',
    'chevron-up': 'caret-up',
    'chevron-down': 'caret-down',
    'arrow-left': 'arrow-left',
    'arrow-right': 'arrow-right',
    'arrow-up': 'arrow-up',
    'arrow-down': 'arrow-down',
    'external-link': 'arrow-square-out',
    'more-vert': 'dots-three-vertical',
    'more-horiz': 'dots-three',
    // Actions
    add: 'plus',
    remove: 'minus',
    delete: 'trash',
    edit: 'pencil',
    save: 'floppy-disk',
    copy: 'copy',
    paste: 'clipboard',
    attach: 'paperclip',
    upload: 'upload',
    download: 'download',
    share: 'share',
    bookmark: 'bookmark',
    favorite: 'heart',
    star: 'star',
    login: 'sign-in',
    logout: 'sign-out',
    // Communication
    email: 'envelope',
    phone: 'phone',
    location: 'map-pin',
    globe: 'globe',
    link: 'link',
    // Time
    clock: 'clock',
    calendar: 'calendar',
    schedule: 'calendar-dots',
    // People
    person: 'person',
    group: 'users',
    // Content / files
    file: 'file',
    'file-add': 'file-plus',
    folder: 'folder',
    'folder-open': 'folder-open',
    'folder-add': 'folder-plus',
    image: 'image',
    export: 'upload-simple',
    import: 'download-simple',
    backup: 'cloud-arrow-up',
    compress: 'arrows-in',
    // Status / feedback
    check: 'check',
    error: 'warning-circle',
    warning: 'warning',
    info: 'info',
    help: 'question',
    // Commerce
    cart: 'shopping-cart',
    tag: 'tag',
    'credit-card': 'credit-card',
    receipt: 'receipt',
    // Nature (landscaping)
    leaf: 'leaf',
    tree: 'tree',
    seedling: 'plant',
    trowel: 'shovel',
    droplet: 'drop',
    snowflake: 'snowflake',
    sun: 'sun',
    cloud: 'cloud',
    // Layout / view
    grid: 'squares-four',
    list: 'list',
    filter: 'funnel',
    sort: 'arrows-down-up',
    fullscreen: 'corners-out',
    collapse: 'corners-in',
    // Misc
    building: 'building',
    video: 'video',
    lock: 'lock',
    unlock: 'lock-open',
    eye: 'eye',
    'eye-off': 'eye-slash',
    print: 'printer',
    code: 'code',
    palette: 'palette',
    lightbulb: 'lightbulb',
    lightning: 'lightning',
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
 * @param prefix - astro-icon prefix, e.g. 'fa7-solid', 'material-symbols', 'lucide', 'ph'
 * @param opts.weight - Weight for suffix-weighted sets (see `WEIGHTED_SETS`), e.g.
 *   `resolveIcon('menu', 'ph', { weight: 'bold' })` → `'ph:list-bold'`. Ignored for
 *   sets that aren't suffix-weighted; an unknown weight throws rather than silently
 *   resolving to the regular glyph, which would be indistinguishable from a typo.
 */
export function resolveIcon(name: string, prefix: string, opts?: { weight?: string }): string {
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
  return `${prefix}:${applyWeight(resolved, prefix, opts?.weight)}`;
}

/** Append a weight suffix for suffix-weighted sets. The first weight is the bare default. */
function applyWeight(name: string, prefix: string, weight?: string): string {
  if (!weight) return name;
  const weights = WEIGHTED_SETS[prefix];
  if (!weights) return name;
  if (!weights.includes(weight))
    throw new Error(
      `Unknown weight "${weight}" for icon set "${prefix}". Valid: ${weights.join(', ')}.`,
    );
  return weight === weights[0] ? name : `${name}-${weight}`;
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
  weight?: string;
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
    if (
      key !== 'ui' &&
      key !== 'brand' &&
      key !== 'weight' &&
      key !== 'semantic' &&
      Array.isArray(val)
    ) {
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
    // The weight is part of the icon NAME for suffix-weighted sets, so the
    // bundled name has to carry it — including `ph:list-bold` but not
    // `ph:list` would ship the wrong glyph (or nothing) under output: 'server'.
    if (ui) addToInclude(uiPrefix, [applyWeight(ui, uiPrefix, iconsConfig?.weight)]);
    if (brand) addToInclude(brandPrefix, [applyWeight(brand, brandPrefix, iconsConfig?.weight)]);
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
