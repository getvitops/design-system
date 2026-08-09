<?php
/**
 * Vitops — Carousel element (Bricks Builder).
 *
 * Renders the <wc-carousel> Lit component (src/web-components/WCCarousel.ts) around a
 * `.carousel__track` scroll container. Each direct child of the element is a slide.
 *
 * Without JS the `.carousel` classes still yield a working scroll-snap carousel with a
 * visible scrollbar, a "scroll for more" hint and — in Chromium — native prev/next
 * buttons and dot navigation, so the builder canvas stays functional. Where those
 * pseudo-elements are missing (Firefox, older Safari) the component builds real
 * buttons and dots styled to match.
 *
 * The `.carousel` base rides on the built-in "CSS classes" setting (defaulted below) so
 * it applies in the canvas and the frontend. Add modifier classes there:
 * `carousel--scroll-buttons`, `carousel--scroll-markers`, `carousel--auto-pages`,
 * `carousel--inert`, `carousel--force-stop`, `carousel--no-scrollbar`,
 * `carousel--markers-below`.
 *
 * Note the slide track here is a <div>, not a <ul>: Bricks children are blocks, so the
 * list semantics the Astro component emits are not available on this platform. The CSS
 * targets `> *`, so everything else is identical.
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
			'description' => esc_html__( 'Milliseconds between slides. Leave empty / 0 to disable. Autoplay implies looping.', 'bricks' ),
		);

		$this->controls['loop'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Loop', 'bricks' ),
			'type'        => 'checkbox',
			'description' => esc_html__( 'Clone the slides at both ends for a seamless infinite strip. Off by default: it triples the markup and duplicates every image.', 'bricks' ),
		);

		$this->controls['label'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Accessible label (aria-label)', 'bricks' ),
			'type'  => 'text',
		);

		$this->controls['aspect'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Slide media aspect ratio', 'bricks' ),
			'type'        => 'text',
			'placeholder' => '16 / 9',
			'description' => esc_html__( 'Sets --carousel-slide-aspect, the ratio each slide\'s media box takes. Keeps slide heights equal whatever the image.', 'bricks' ),
		);

		$this->controls['hint'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Scroll hint', 'bricks' ),
			'type'        => 'text',
			'placeholder' => 'Scroll for more',
			'description' => esc_html__( 'Shown beside the strip and dimmed once the visitor scrolls. Clear to omit it.', 'bricks' ),
		);

		$this->controls['modifiersInfo'] = array(
			'tab'     => 'content',
			'type'    => 'info',
			'content' => esc_html__( 'Add modifier classes in "CSS classes": carousel--scroll-buttons, carousel--scroll-markers, carousel--auto-pages, carousel--inert, carousel--force-stop, carousel--no-scrollbar, carousel--markers-below. Each direct child is a slide.', 'bricks' ),
		);

		// Base carousel class defaulted onto the built-in "CSS classes" setting.
		$this->controls['_cssClasses']['default'] = 'carousel carousel--scroll-buttons carousel--scroll-markers';
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
		$style = '';

		if ( isset( $s['autoplay'] ) && '' !== $s['autoplay'] && (int) $s['autoplay'] > 0 ) {
			$attrs[] = 'autoplay="' . esc_attr( $s['autoplay'] ) . '"';
		}
		if ( ! empty( $s['loop'] ) ) {
			$attrs[] = 'loop';
		}
		if ( ! empty( $s['label'] ) ) {
			$attrs[] = 'aria-label="' . esc_attr( $s['label'] ) . '"';
		}
		if ( ! empty( $s['aspect'] ) ) {
			$style = ' style="--carousel-slide-aspect:' . esc_attr( $s['aspect'] ) . '"';
		}

		$attr_str = implode( ' ', $attrs );
		$hint     = isset( $s['hint'] ) ? $s['hint'] : esc_html__( 'Scroll for more', 'bricks' );

		echo "<wc-carousel {$attr_str} {$this->render_attributes( '_root' )}{$style}>";
		echo '<div class="carousel__track" tabindex="0">';
		echo \Bricks\Frontend::render_children( $this );
		echo '</div>';
		if ( '' !== $hint ) {
			echo '<p class="carousel__hint font-footnote" aria-hidden="true">' . esc_html( $hint ) . '</p>';
		}
		echo '</wc-carousel>';
	}
}
