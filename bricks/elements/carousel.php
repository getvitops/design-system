<?php
/**
 * Vitops — Carousel element (Bricks Builder).
 *
 * Renders the <wc-carousel> Lit component (src/web-components/WCCarousel.ts): an
 * infinite-loop carousel that progressively enhances the CSS-only `.carousel`. Each
 * direct child is a slide. Without JS the `.carousel` classes still yield a working
 * (non-looping) scroll-snap carousel, so the builder canvas stays functional.
 *
 * The `.carousel` base rides on the built-in "CSS classes" setting (defaulted below) so
 * it applies in the canvas and the frontend. Add modifier classes there:
 * `carousel--scroll-buttons`, `carousel--scroll-markers`, `carousel--auto-pages`.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Carousel extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-carousel';
	public $icon          = 'ti-layout-slider-alt';
	public $css_selector  = 'wc-carousel';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Carousel', 'bricks' );
	}

	public function get_keywords() {
		return array( 'carousel', 'slider', 'slides', 'gallery', 'scroll', 'vitops' );
	}

	public function set_controls() {
		$this->controls['autoplay'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Autoplay interval (ms)', 'bricks' ),
			'type'        => 'number',
			'placeholder' => '0',
			'description' => esc_html__( 'Milliseconds between slides. Leave empty / 0 to disable.', 'bricks' ),
		);

		$this->controls['label'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Accessible label (aria-label)', 'bricks' ),
			'type'  => 'text',
		);

		$this->controls['modifiersInfo'] = array(
			'tab'     => 'content',
			'type'    => 'info',
			'content' => esc_html__( 'Add modifier classes in "CSS classes": carousel--scroll-buttons, carousel--scroll-markers, carousel--auto-pages. Each direct child is a slide.', 'bricks' ),
		);

		// Base carousel class defaulted onto the built-in "CSS classes" setting.
		$this->controls['_cssClasses']['default'] = 'carousel';
	}

	// Seed three empty slides — the author fills each.
	public function get_nestable_children() {
		return array(
			array( 'name' => 'block', 'label' => esc_html__( 'Slide 1', 'bricks' ) ),
			array( 'name' => 'block', 'label' => esc_html__( 'Slide 2', 'bricks' ) ),
			array( 'name' => 'block', 'label' => esc_html__( 'Slide 3', 'bricks' ) ),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		if ( isset( $s['autoplay'] ) && '' !== $s['autoplay'] && (int) $s['autoplay'] > 0 ) {
			$attrs[] = 'autoplay="' . esc_attr( $s['autoplay'] ) . '"';
		}
		if ( ! empty( $s['label'] ) ) {
			$attrs[] = 'aria-label="' . esc_attr( $s['label'] ) . '"';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-carousel {$attr_str} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo '</wc-carousel>';
	}
}
