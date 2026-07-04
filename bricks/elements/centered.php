<?php
/**
 * Vitops — Centered layout element (Bricks Builder).
 *
 * A nestable container that renders the framework's named-track grid, `.centered`
 * (src/css/layout.css). Children auto-place in the reading `measure` track; a child
 * widens by adding `breakout` / `spotlight` / `fullbleed` (+ responsive `-sm/-md/-lg/-xl`)
 * in its own Bricks "CSS classes" field.
 *
 * The framework classes ride on the built-in "CSS classes" setting (defaulted below):
 * a nestable element's root is assembled from settings in the builder canvas, so classes
 * added only in render()/set_root_attributes() never appear there — _cssClasses does.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Centered extends \Bricks\Element {
	public $category      = 'layout';
	public $name          = 'vitops-centered';
	public $icon          = 'ti-layout-width-default';
	public $css_selector  = '.centered';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Centered', 'bricks' );
	}

	public function get_keywords() {
		return [ 'centered', 'measure', 'grid', 'container', 'layout', 'track', 'vitops' ];
	}

	public function set_control_groups() {
		$this->control_groups['tracks'] = [
			'title' => esc_html__( 'Track widths', 'bricks' ),
			'tab'   => 'content',
		];
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

		// Each width control writes a CSS custom property onto the element root
		// (.centered), where the grid template reads it. Defaults mirror layout.css.
		$this->controls['measure'] = [
			'tab'     => 'content',
			'group'   => 'tracks',
			'label'   => esc_html__( 'Measure (reading width)', 'bricks' ),
			'type'    => 'number',
			'units'   => true,
			'default' => '65ch',
			'css'     => [ [ 'property' => '--width-measure', 'selector' => '' ] ],
		];

		$this->controls['breakout'] = [
			'tab'     => 'content',
			'group'   => 'tracks',
			'label'   => esc_html__( 'Breakout width', 'bricks' ),
			'type'    => 'number',
			'units'   => true,
			'default' => '90ch',
			'css'     => [ [ 'property' => '--width-breakout', 'selector' => '' ] ],
		];

		$this->controls['spotlight'] = [
			'tab'     => 'content',
			'group'   => 'tracks',
			'label'   => esc_html__( 'Spotlight width', 'bricks' ),
			'type'    => 'number',
			'units'   => true,
			'default' => '120ch',
			'css'     => [ [ 'property' => '--width-spotlight', 'selector' => '' ] ],
		];

		// Gutter is a `text` control so it accepts the framework default clamp().
		$this->controls['gutter'] = [
			'tab'         => 'content',
			'group'       => 'tracks',
			'label'       => esc_html__( 'Gutter', 'bricks' ),
			'type'        => 'text',
			'placeholder' => 'clamp(1rem, 4cqi, 3rem)',
			'css'         => [ [ 'property' => '--gutter', 'selector' => '' ] ],
		];

		// Framework classes default onto the built-in "CSS classes" setting so they
		// apply in the builder canvas AND the frontend. `rhythm` (relationship-based
		// vertical spacing) is on by default — remove it in the CSS-classes field to
		// disable. (It's a class, not a checkbox, because a nestable element can't
		// reflect a PHP-computed root class in the builder.)
		$this->controls['_cssClasses']['default'] = 'centered rhythm';
	}

	// No seeded children: a Centered container starts empty. Each direct child is
	// auto-placed in the reading `measure` track; the author widens one by adding
	// `breakout` / `spotlight` / `fullbleed` (+ `-sm/-md/-lg/-xl`) in its own
	// Bricks "CSS classes" field — no wrapper or preset child needed.

	public function render() {
		// $this->tag is resolved from the `tag` setting by the base (get_tag()).
		// render_children() returns child HTML on the frontend and the nestable
		// drag-drop placeholder inside the builder.
		echo "<{$this->tag} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo "</{$this->tag}>";
	}
}
