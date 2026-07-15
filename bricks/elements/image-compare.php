<?php
/**
 * Vitops — Image Compare element (Bricks Builder).
 *
 * Renders the <wc-image-compare> Lit component (src/web-components/WCImageCompare.ts):
 * a before/after comparison slider. Author fills the two seeded slots (slot="before" /
 * slot="after") — typically an Image element in each.
 *
 * Nestable: the live slider appears on the frontend; the builder canvas shows the two
 * images stacked (upgrade happens client-side via dist/elements.js).
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Image_Compare extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-image-compare';
	public $icon          = 'ti-layout-slider';
	public $css_selector  = 'wc-image-compare';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Image Compare', 'bricks' );
	}

	public function get_keywords() {
		return array( 'image', 'compare', 'before', 'after', 'slider', 'vitops' );
	}

	public function set_controls() {
		$this->controls['position'] = array(
			'tab'     => 'content',
			'label'   => esc_html__( 'Initial position (%)', 'bricks' ),
			'type'    => 'number',
			'min'     => 0,
			'max'     => 100,
			'default' => 50,
		);

		$this->controls['vertical'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Vertical split', 'bricks' ),
			'type'  => 'checkbox',
		);

		$this->controls['discrete'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Discrete (step) dragging', 'bricks' ),
			'type'  => 'checkbox',
		);

		$this->controls['keyboardStep'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Keyboard step (%)', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['beforeLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Before label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Before', 'bricks' ),
		);

		$this->controls['afterLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'After label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'After', 'bricks' ),
		);
	}

	// Two slots seeded: before / after (drop an Image into each).
	public function get_nestable_children() {
		return array(
			array(
				'name'     => 'image',
				'label'    => esc_html__( 'Before', 'bricks' ),
				'settings' => array(
					'_attributes' => array(
						array( 'id' => 'vslotbefore', 'name' => 'slot', 'value' => 'before' ),
					),
				),
			),
			array(
				'name'     => 'image',
				'label'    => esc_html__( 'After', 'bricks' ),
				'settings' => array(
					'_attributes' => array(
						array( 'id' => 'vslotafter', 'name' => 'slot', 'value' => 'after' ),
					),
				),
			),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		$num = array(
			'position'     => 'position',
			'keyboardStep' => 'keyboard-step',
			'beforeLabel'  => 'before-label',
			'afterLabel'   => 'after-label',
		);
		foreach ( $num as $key => $attr ) {
			if ( isset( $s[ $key ] ) && '' !== $s[ $key ] ) {
				$attrs[] = $attr . '="' . esc_attr( $s[ $key ] ) . '"';
			}
		}

		if ( ! empty( $s['vertical'] ) ) {
			$attrs[] = 'vertical';
		}
		if ( ! empty( $s['discrete'] ) ) {
			$attrs[] = 'discrete';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-image-compare {$attr_str} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo '</wc-image-compare>';
	}
}
