<?php
/**
 * Vitops — Split Panel element (Bricks Builder).
 *
 * Renders the <wc-split-panel> Lit component (src/web-components/WCSplitPanel.ts): a
 * resizable two-panel splitter with a draggable handle. Author fills the two seeded
 * columns, which carry slot="start" / slot="end" so the component picks them up.
 *
 * Nestable: the live shadow-DOM handle appears on the frontend; the builder canvas
 * shows the two columns stacked (upgrade happens client-side via dist/elements.js).
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Split_Panel extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-split-panel';
	public $icon          = 'ti-layout-sidebar-2';
	public $css_selector  = 'wc-split-panel';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Split Panel', 'bricks' );
	}

	public function get_keywords() {
		return array( 'split', 'panel', 'resize', 'splitter', 'drag', 'vitops' );
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
			'label' => esc_html__( 'Vertical (stack top/bottom)', 'bricks' ),
			'type'  => 'checkbox',
		);

		$this->controls['discrete'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Discrete (step) dragging', 'bricks' ),
			'type'  => 'checkbox',
		);

		$this->controls['minSize'] = array(
			'tab'     => 'content',
			'label'   => esc_html__( 'Min panel size (px)', 'bricks' ),
			'type'    => 'number',
			'default' => 100,
		);

		$this->controls['maxSize'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Max panel size (px)', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['keyboardStep'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Keyboard step (%)', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['collapseThreshold'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Collapse threshold (%)', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['snapPoints'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Snap points (%)', 'bricks' ),
			'type'        => 'text',
			'placeholder' => '25,50,75',
		);

		$this->controls['snapDistance'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Snap distance (%)', 'bricks' ),
			'type'  => 'number',
		);
	}

	// Two sides seeded, each tagged with the slot the component reads.
	public function get_nestable_children() {
		return array(
			array(
				'name'     => 'block',
				'label'    => esc_html__( 'Start panel', 'bricks' ),
				'settings' => array(
					'_attributes' => array(
						array( 'id' => 'vslotstart', 'name' => 'slot', 'value' => 'start' ),
					),
				),
			),
			array(
				'name'     => 'block',
				'label'    => esc_html__( 'End panel', 'bricks' ),
				'settings' => array(
					'_attributes' => array(
						array( 'id' => 'vslotend', 'name' => 'slot', 'value' => 'end' ),
					),
				),
			),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		// number/text attributes → kebab-case component attribute names.
		$num = array(
			'position'          => 'position',
			'minSize'           => 'min-size',
			'maxSize'           => 'max-size',
			'keyboardStep'      => 'keyboard-step',
			'collapseThreshold' => 'collapse-threshold',
			'snapDistance'      => 'snap-distance',
			'snapPoints'        => 'snap-points',
		);
		foreach ( $num as $key => $attr ) {
			if ( isset( $s[ $key ] ) && '' !== $s[ $key ] ) {
				$attrs[] = $attr . '="' . esc_attr( $s[ $key ] ) . '"';
			}
		}

		// boolean attributes → present only when true.
		if ( ! empty( $s['vertical'] ) ) {
			$attrs[] = 'vertical';
		}
		if ( ! empty( $s['discrete'] ) ) {
			$attrs[] = 'discrete';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-split-panel {$attr_str} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo '</wc-split-panel>';
	}
}
