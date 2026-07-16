<?php
/**
 * Vitops — Bricks theme bootstrap.
 *
 * One-line integration for the child theme. Add to the theme's functions.php:
 *
 *   require_once get_stylesheet_directory() . '/dist/bricks/load.php';
 *
 * It does three things:
 *   1. Registers every repo-owned Bricks element under dist/bricks/elements/.
 *   2. Enqueues the framework CSS + JS bundles — polyfills.js and elements.js as
 *      ES modules (so the Lit custom elements upgrade), deferred.js with `defer`.
 *      The enqueue runs on `wp_enqueue_scripts`, which the Bricks builder canvas
 *      iframe also fires, so the elements upgrade while editing too.
 *   3. Registers a "Vitops" builder category so the elements group together.
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
