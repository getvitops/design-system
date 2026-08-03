<?php
/**
 * Vitops — Split layout element (Bricks Builder).
 *
 * A nestable flex row rendering the framework's `.split` (layout.css) — equal columns
 * by default. Set a ratio by adding a class in the CSS-classes field: `split-1-2` /
 * `2-1` / `1-3` / `3-1` / `1-4` / `4-1` / `2-3` / `3-2`, each with an optional
 * `sm-`/`md-`/`lg-`/`xl-` PREFIX to engage the ratio from a container breakpoint.
 * `flex-col` stacks the columns below that breakpoint; `split-reverse` (also
 * breakpoint-prefixable) swaps the two panels. Reversing puts visual order out of
 * step with DOM order, so keep focusable content in only one of the two columns.
 *
 * The `.split` base rides on the built-in "CSS classes" setting (defaulted below) so it
 * shows in the builder canvas (assembled from settings) and the frontend.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Split extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-split';
	public $icon          = 'ti-layout-column2';
	public $css_selector  = '.split';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Split', 'bricks' );
	}

	public function get_keywords() {
		return [ 'split', 'columns', 'ratio', 'flex', 'container', 'layout', 'vitops' ];
	}

	public function set_controls() {
		$this->controls['tag'] = [
			'tab'       => 'content',
			'label'     => esc_html__( 'HTML tag', 'bricks' ),
			'type'      => 'select',
			'inline'    => true,
			'options'   => [
				'div'     => 'div',
				'section' => 'section',
				'article' => 'article',
				'aside'   => 'aside',
				'main'    => 'main',
				'header'  => 'header',
				'footer'  => 'footer',
				'nav'     => 'nav',
			],
			'default'   => 'div',
			'lowercase' => true,
		];

		$this->controls['ratioInfo'] = [
			'tab'     => 'content',
			'type'    => 'info',
			'content' => esc_html__( 'Equal columns by default. Add a class in "CSS classes" for a ratio: split-1-2, 2-1, 1-3, 3-1, 1-4, 4-1, 2-3, 3-2 (prefix with sm-/md-/lg-/xl- to engage it from a breakpoint). Add flex-col to stack the columns below that breakpoint, and split-reverse to swap the two panels — when reversing, keep focusable content in only one column so the tab order stays linear.', 'bricks' ),
		];

		// Base flex class, defaulted onto the built-in "CSS classes" setting so it
		// shows in the builder canvas (assembled from settings) and the frontend.
		$this->controls['_cssClasses']['default'] = 'split';
	}

	// Seed two empty columns — a split is inherently two sides. No opinionated
	// classes; the author fills each column (and can make it a rhythm container).
	public function get_nestable_children() {
		return [
			[ 'name' => 'block', 'label' => esc_html__( 'Column 1', 'bricks' ) ],
			[ 'name' => 'block', 'label' => esc_html__( 'Column 2', 'bricks' ) ],
		];
	}

	public function render() {
		// $this->tag is resolved from the `tag` setting by the base (get_tag()).
		echo "<{$this->tag} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo "</{$this->tag}>";
	}
}
