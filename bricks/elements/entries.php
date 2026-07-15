<?php
/**
 * Vitops — Entries element (Bricks Builder).
 *
 * Renders the <wc-entries> Lit component (src/web-components/WCEntries.ts): an adaptive
 * data display that enhances a series of heading + <dl> pairs into a table / column
 * projection based on container width. Without JS the heading + <dl> pairs render
 * stacked (semantic), so the builder canvas stays functional.
 *
 * Slotted content structure (add via Code / HTML children):
 *   <h3>Group title</h3>
 *   <dl><dt>Label</dt><dd>Value</dd> …</dl>
 *   (repeat)
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Entries extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-entries';
	public $icon          = 'ti-layout-list-thumb';
	public $css_selector  = 'wc-entries';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Entries', 'bricks' );
	}

	public function get_keywords() {
		return array( 'entries', 'data', 'table', 'definition', 'list', 'dl', 'vitops' );
	}

	public function set_controls() {
		$this->controls['breakpoint'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Breakpoint', 'bricks' ),
			'type'        => 'text',
			'placeholder' => '40rem',
			'description' => esc_html__( 'Container width below which the projected/table view engages.', 'bricks' ),
		);

		$this->controls['projection'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Column projection (table)', 'bricks' ),
			'type'        => 'checkbox',
			'description' => esc_html__( 'Project heading + <dl> pairs into a table.', 'bricks' ),
		);

		$this->controls['singular'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Singular (one row at a time)', 'bricks' ),
			'type'        => 'checkbox',
			'description' => esc_html__( 'With projection + narrow: show one row with nav.', 'bricks' ),
		);

		$this->controls['structureInfo'] = array(
			'tab'     => 'content',
			'type'    => 'info',
			'content' => esc_html__( 'Add children as heading + <dl> pairs: an <h3> group title followed by a <dl> of <dt>Label</dt><dd>Value</dd> pairs. Use a Code / HTML element for the <dl>.', 'bricks' ),
		);
	}

	// Seed a heading so the structure is discoverable; the author adds the <dl>.
	public function get_nestable_children() {
		return array(
			array( 'name' => 'heading', 'label' => esc_html__( 'Group title', 'bricks' ) ),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		if ( ! empty( $s['breakpoint'] ) ) {
			$attrs[] = 'breakpoint="' . esc_attr( $s['breakpoint'] ) . '"';
		}
		if ( ! empty( $s['projection'] ) ) {
			$attrs[] = 'projection';
		}
		if ( ! empty( $s['singular'] ) ) {
			$attrs[] = 'singular';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-entries {$attr_str} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo '</wc-entries>';
	}
}
