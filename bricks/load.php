<?php
/**
 * Vitops — Bricks theme bootstrap.
 *
 * One-line integration for the child theme. Add to the theme's functions.php:
 *
 *   require_once get_stylesheet_directory() . '/dist/bricks/load.php';
 *
 * It does the following:
 *   1. Registers every repo-owned Bricks element under dist/bricks/elements/.
 *   2. Enqueues the framework CSS + JS bundles — polyfills.js and elements.js as
 *      ES modules (so the Lit custom elements upgrade), deferred.js with `defer`.
 *      The enqueue runs on `wp_enqueue_scripts`, which the Bricks builder canvas
 *      iframe also fires, so the elements upgrade while editing too.
 *   3. Registers a "Vitops" builder category so the elements group together.
 *   4. Defaults the design system to dark mode.
 *   5. Registers [vitops_legal] for the generated legal documents.
 *   6. Registers vitops_icon() + [vitops_icon] for the generated SVG sprite.
 *
 * Owned by the framework repo (vitops: bricks/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 1. Register the custom Bricks elements.
 *
 * Bricks exposes `\Bricks\Elements::register_element( $file )`; each file defines
 * a `Vitops_Element_*` class extending `\Bricks\Element`.
 */
add_action(
	'init',
	function () {
		if ( ! class_exists( '\Bricks\Elements' ) ) {
			return;
		}

		foreach ( glob( __DIR__ . '/elements/*.php' ) as $file ) {
			\Bricks\Elements::register_element( $file );
		}
	},
	11
);

/**
 * 2. Enqueue the framework bundles. Handles listed in $module_handles are rewritten
 *    to <script type="module"> below.
 */
add_action(
	'wp_enqueue_scripts',
	function () {
		$dir  = get_stylesheet_directory_uri() . '/dist';
		$path = get_stylesheet_directory() . '/dist';

		// Version each asset by its file mtime so a deploy (which rewrites the file,
		// preserving a fresh mtime through rsync) busts any browser/CDN cache. A `null`
		// version leaves the URL query-less and highly cacheable, so post-deploy edits
		// never reach returning visitors. Missing file → null (WP's default behaviour).
		$ver = function ( $file ) use ( $path ) {
			$p = $path . '/' . $file;
			return file_exists( $p ) ? filemtime( $p ) : null;
		};

		wp_enqueue_style( 'vitops-styles', $dir . '/styles.min.css', array(), $ver( 'styles.min.css' ) );

		// Feature-detected polyfill loader — first, high, as a module.
		wp_enqueue_script( 'vitops-polyfills', $dir . '/polyfills.js', array(), $ver( 'polyfills.js' ), false );

		// Custom-element registrations — module; self-registers on load.
		wp_enqueue_script( 'vitops-elements', $dir . '/elements.js', array(), $ver( 'elements.js' ), true );

		// Non-critical progressive enhancement — plain deferred script.
		wp_enqueue_script( 'vitops-deferred', $dir . '/deferred.js', array(), $ver( 'deferred.js' ), true );
	}
);

/**
 * Rewrite the ES-module bundles to `type="module"` (WP has no first-class flag for
 * this on classic enqueues). deferred.js stays a plain `defer` script.
 */
add_filter(
	'script_loader_tag',
	function ( $tag, $handle ) {
		$module_handles = array( 'vitops-polyfills', 'vitops-elements' );

		if ( in_array( $handle, $module_handles, true ) ) {
			// Ensure a single type="module" attribute (replace any injected type).
			$tag = preg_replace( '/\stype=(["\']).*?\1/', '', $tag );
			$tag = str_replace( ' src=', ' type="module" src=', $tag );
		}

		return $tag;
	},
	10,
	2
);

/**
 * 3. Group the elements under a "Vitops" category, pinned to the TOP of the builder
 *    panel. Bricks renders categories in array order, so prepend rather than append.
 */
add_filter(
	'bricks/builder/element_categories',
	function ( $categories ) {
		// Drop any pre-existing key so the prepended one wins the ordering.
		unset( $categories['vitops'] );

		return array( 'vitops' => esc_html__( 'Vitops', 'bricks' ) ) + $categories;
	},
	5
);

/**
 * 4. Default the design system to dark mode: stamp data-brx-theme="dark" on <html>.
 *    The generated semantic colour roles (surface/brand-primary/success/…) remap under
 *    `:root[data-brx-theme="dark"]`, and the site's pages are dark-themed, so this keeps
 *    the framework's cards/badges/patterns consistent with the page. Server-side via
 *    language_attributes so there is no light-mode flash on load.
 */
add_filter(
	'language_attributes',
	function ( $output ) {
		// Bricks sets data-brx-theme from its default colour scheme (light); strip any
		// existing value and force dark. High priority so this runs after Bricks.
		$output = preg_replace( '/\s*data-brx-theme=(["\'][^"\']*["\']|\S+)/', '', (string) $output );
		return rtrim( $output ) . ' data-brx-theme="dark"';
	},
	99
);

/**
 * 5. [vitops_legal doc="privacy"] — render a generated legal document.
 *
 * The build emits dist/legal/*.html from the site config, so the document updates
 * on the next deploy with no action in WordPress. Drop this shortcode into a
 * Bricks page (or any content) and the fragment renders there, styled by the
 * framework CSS the theme already loads.
 *
 * `doc` is matched against a fixed allowlist rather than interpolated into the
 * path. The attribute is author-supplied and lands in a filesystem read, so
 * anything less would be a traversal waiting to happen — an unknown value
 * renders nothing.
 *
 * The fragment is generated by our own build from a closed markdown subset, and
 * is already HTML-escaped at render time. It is echoed as-is deliberately:
 * running it through wp_kses would strip the markup the document depends on.
 */
add_shortcode(
	'vitops_legal',
	function ( $atts ) {
		$allowed = array(
			'privacy' => 'privacy-policy',
			'terms'   => 'terms-of-service',
			'cookies' => 'cookie-notice',
		);

		$atts = shortcode_atts( array( 'doc' => 'privacy' ), $atts, 'vitops_legal' );
		$key  = is_string( $atts['doc'] ) ? strtolower( trim( $atts['doc'] ) ) : '';

		if ( ! isset( $allowed[ $key ] ) ) {
			return '';
		}

		$path = get_stylesheet_directory() . '/dist/legal/' . $allowed[ $key ] . '.html';

		if ( ! file_exists( $path ) ) {
			return '';
		}

		return file_get_contents( $path );
	}
);

/**
 * 6. vitops_icon() / [vitops_icon name="menu"] — render an icon from the sprite.
 *
 * The build emits dist/icons.svg (a hidden <svg> of <symbol>s) when the site
 * config sets `icons.sprite`. Referencing one is a plain `<use>`: no JavaScript,
 * no request to an icon API, and it inherits `currentColor` like any other glyph.
 *
 * Two ids resolve. A qualified icon is `ph--caret-down` (the `prefix:name`
 * separator becomes `--`, since `:` is not valid in a fragment identifier), and
 * a semantic name also gets a set-independent `icon-menu` alias — so markup
 * written here survives changing icon sets, the same guarantee the Astro
 * components get from resolveIcon().
 *
 * IMPORTANT: an external-file <use> is same-origin only, and dead under file://.
 * That is fine for a theme-relative dist/, but if you ever serve dist/ from a
 * CDN on another origin the icons vanish silently — no console error, just
 * empty boxes. Inline the sprite into the page instead if that day comes.
 *
 * `$name` is charset-gated rather than allowlisted (unlike [vitops_legal], whose
 * value lands in a filesystem read): here it only ever reaches an HTML
 * attribute, so restricting it to id-safe characters plus escaping is the
 * matching level of care.
 */
if ( ! defined( 'VITOPS_SPRITE_URI' ) ) {
	define( 'VITOPS_SPRITE_URI', get_stylesheet_directory_uri() . '/dist/icons.svg' );
}

/**
 * @param string $name  Sprite id — 'menu' (semantic) or 'ph--list' (qualified).
 * @param array  $args  'size' => any CSS length, 'label' => accessible name,
 *                      'class' => extra classes on the wrapper.
 * @return string HTML, or '' when the name is unusable.
 */
function vitops_icon( $name, $args = array() ) {
	$name = is_string( $name ) ? strtolower( trim( $name ) ) : '';

	// Sprite ids are ASCII word characters, hyphens and colons only. Anything
	// else is a mistake, and echoing it would put author input into markup.
	if ( '' === $name || ! preg_match( '/^[a-z0-9:_-]+$/', $name ) ) {
		return '';
	}

	// Accept a qualified `prefix:name` too, and normalise it to the sprite's id.
	$id = str_replace( ':', '--', $name );

	$defaults = array(
		'size'  => '',
		'label' => '',
		'class' => '',
	);
	$args     = array_merge( $defaults, is_array( $args ) ? $args : array() );

	$classes = trim( 'icon ' . $args['class'] );
	$style   = '' !== $args['size'] ? ' style="--icon-size:' . esc_attr( $args['size'] ) . '"' : '';

	// Decorative by default — an icon beside a label must not be announced twice.
	$a11y = '' !== $args['label']
		? ' role="img" aria-label="' . esc_attr( $args['label'] ) . '"'
		: ' aria-hidden="true"';

	return '<span class="' . esc_attr( $classes ) . '"' . $style . $a11y . '>'
		. '<svg><use href="' . esc_url( VITOPS_SPRITE_URI ) . '#' . esc_attr( $id ) . '"></use></svg>'
		. '</span>';
}

add_shortcode(
	'vitops_icon',
	function ( $atts ) {
		$atts = shortcode_atts(
			array(
				'name'  => '',
				'size'  => '',
				'label' => '',
				'class' => '',
			),
			$atts,
			'vitops_icon'
		);

		return vitops_icon(
			$atts['name'],
			array(
				'size'  => $atts['size'],
				'label' => $atts['label'],
				'class' => $atts['class'],
			)
		);
	}
);
