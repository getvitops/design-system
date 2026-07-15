<?php
/**
 * Vitops — Split Link element (Bricks Builder).
 *
 * A "split button": a primary <a> flush with a <button> that toggles an anchored
 * [popover] holding secondary, nestable content. Pure native platform — the toggle
 * is a Popover API invoker (`popovertarget`, which the browser also wires to
 * `aria-expanded`/`aria-details` for free), and the panel is placed with CSS Anchor
 * Positioning. No Lit component; the framework's split-link.css does the styling.
 *
 * Placement is authored via the "Placement" control, which writes a `position-area`
 * value (logical keywords) to `--split-link-area` on the root; it inherits down to
 * the panel. Each instance gets a unique anchor-name derived from the element id.
 *
 * Nestable: the popover's children are authored in the canvas. A live [popover] is
 * display:none, so in the builder the panel renders WITHOUT the `popover` attribute
 * (as `.split-link__panel--editing`) to stay visible and droppable; on the frontend
 * it is a real top-layer popover.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Split_Link extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-split-link';
	public $icon          = 'ti-direction-alt';
	public $css_selector  = '.split-link';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Split Link', 'bricks' );
	}

	public function get_keywords() {
		return array( 'split', 'link', 'button', 'popover', 'dropdown', 'menu', 'vitops' );
	}

	public function set_controls() {
		$this->controls['linkText'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Link text', 'bricks' ),
			'type'        => 'text',
			'default'     => esc_html__( 'View', 'bricks' ),
		);

		$this->controls['link'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Link', 'bricks' ),
			'type'  => 'link',
		);

		$this->controls['toggleLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Toggle label (accessible name)', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'More options', 'bricks' ),
			'description' => esc_html__( 'aria-label for the popover toggle button.', 'bricks' ),
		);

		$this->controls['caret'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Toggle glyph', 'bricks' ),
			'type'        => 'text',
			'placeholder' => '▾',
			'description' => esc_html__( 'Character/HTML inside the toggle. It flips 180° while the panel is open.', 'bricks' ),
		);

		// Placement writes a position-area value (logical keywords) onto the root,
		// where it inherits down to the panel. TODO: replace this select with a
		// visual grid control — position-area is richer than a 3×3 grid (span-*
		// keywords), so the picker must model spans, not just the 9 corners/edges.
		$this->controls['placement'] = array(
			'tab'     => 'content',
			'label'   => esc_html__( 'Placement', 'bricks' ),
			'type'    => 'select',
			'inline'  => true,
			'options' => array(
				'block-start span-inline-end'   => esc_html__( 'Top · start-aligned', 'bricks' ),
				'block-start center'            => esc_html__( 'Top · center', 'bricks' ),
				'block-start span-inline-start' => esc_html__( 'Top · end-aligned', 'bricks' ),
				'inline-start center'           => esc_html__( 'Inline-start (left)', 'bricks' ),
				'center'                        => esc_html__( 'Center (over trigger)', 'bricks' ),
				'inline-end center'             => esc_html__( 'Inline-end (right)', 'bricks' ),
				'block-end span-inline-end'     => esc_html__( 'Bottom · start-aligned', 'bricks' ),
				'block-end center'              => esc_html__( 'Bottom · center', 'bricks' ),
				'block-end span-inline-start'   => esc_html__( 'Bottom · end-aligned', 'bricks' ),
			),
			'default' => 'block-end span-inline-end',
			'css'     => array( array( 'property' => '--split-link-area', 'selector' => '' ) ),
		);

		$this->controls['gap'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Panel gap', 'bricks' ),
			'type'        => 'number',
			'units'       => true,
			'placeholder' => '0.5rem',
			'css'         => array( array( 'property' => '--split-link-gap', 'selector' => '' ) ),
		);

		$this->controls['_cssClasses']['default'] = 'split-link';
	}

	// Seed one block so authors have a target to drop popover content into.
	public function get_nestable_children() {
		return array(
			array( 'name' => 'block', 'label' => esc_html__( 'Popover content', 'bricks' ) ),
		);
	}

	// Builder canvas render() runs in the iframe; a live [popover] would be hidden
	// there, so we reveal the panel while editing. Defensive: any true signal means
	// builder; otherwise treat as frontend (the safe default — a false negative only
	// makes the hidden content harder to reach via the canvas, not broken).
	private function is_in_builder() {
		foreach ( array( 'bricks_is_builder_iframe', 'bricks_is_builder_call', 'bricks_is_builder' ) as $fn ) {
			if ( function_exists( $fn ) && $fn() ) {
				return true;
			}
		}
		return false;
	}

	public function render() {
		$s      = $this->settings;
		$id     = $this->id;
		$pop_id = 'sl-' . $id;
		$anchor = '--sl-' . $id;

		// Unique anchor-name on the wrapper; the panel points at it (top-layer
		// popovers can't be contained by a positioned ancestor).
		$this->set_attribute( '_root', 'style', "anchor-name:{$anchor};" );

		$link_text    = isset( $s['linkText'] ) && '' !== $s['linkText'] ? $s['linkText'] : esc_html__( 'View', 'bricks' );
		$toggle_label = ! empty( $s['toggleLabel'] ) ? $s['toggleLabel'] : esc_html__( 'More options', 'bricks' );
		$caret        = isset( $s['caret'] ) && '' !== $s['caret'] ? $s['caret'] : '&#9662;'; // ▾

		// Primary link — Bricks resolves href/target/rel from the link control.
		if ( ! empty( $s['link'] ) ) {
			$this->set_link_attributes( '_link', $s['link'] );
		}
		$link_attrs = $this->render_attributes( '_link' );

		// Builder: drop the `popover` attribute so nested content stays visible.
		$editing      = $this->is_in_builder();
		$panel_class  = 'split-link__panel' . ( $editing ? ' split-link__panel--editing' : '' );
		$popover_attr = $editing ? '' : 'popover';

		echo "<div {$this->render_attributes( '_root' )}>";

		echo "<a class=\"split-link__link\" {$link_attrs}>" . esc_html( $link_text ) . '</a>';

		echo '<button type="button" class="split-link__toggle" popovertarget="' . esc_attr( $pop_id ) . '"'
			. ' aria-label="' . esc_attr( $toggle_label ) . '">'
			. '<span class="split-link__caret" aria-hidden="true">' . $caret . '</span>'
			. '</button>';

		echo "<div id=\"{$pop_id}\" {$popover_attr} class=\"{$panel_class}\" style=\"position-anchor:{$anchor};\">";
		echo \Bricks\Frontend::render_children( $this );
		echo '</div>';

		echo '</div>';
	}
}
