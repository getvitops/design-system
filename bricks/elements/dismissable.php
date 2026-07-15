<?php
/**
 * Vitops — Dismissable element (Bricks Builder).
 *
 * Renders the <wc-dismissable> Lit component (src/web-components/WCDismissable.ts): a
 * light-DOM progressive-enhancement wrapper. A click on any descendant marked
 * `data-dismiss` (e.g. the seeded close button) fades the wrapper out and removes it.
 * Optional `duration` auto-dismisses after N ms; `exit` sets the fade time.
 *
 * Without JS the wrapper is an inert unknown tag and its content still renders, so the
 * builder canvas stays functional.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Dismissable extends \Bricks\Element {
	public $category      = 'vitops';
	public $name          = 'vitops-dismissable';
	public $icon          = 'ti-close';
	public $css_selector  = 'wc-dismissable';
	public $nestable      = true;
	public $vue_component = 'bricks-nestable';

	public function get_label() {
		return esc_html__( 'Dismissable', 'bricks' );
	}

	public function get_keywords() {
		return array( 'dismiss', 'close', 'banner', 'notice', 'alert', 'vitops' );
	}

	public function set_controls() {
		$this->controls['duration'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Auto-dismiss after (ms)', 'bricks' ),
			'type'        => 'number',
			'description' => esc_html__( 'Leave empty to require a click on a [data-dismiss] element.', 'bricks' ),
		);

		$this->controls['exit'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Fade-out time (ms)', 'bricks' ),
			'type'        => 'number',
		);

		$this->controls['dismissInfo'] = array(
			'tab'     => 'content',
			'type'    => 'info',
			'content' => esc_html__( 'Any child with a data-dismiss attribute acts as a close trigger. The seeded button already has it.', 'bricks' ),
		);
	}

	// Seed content + a close button carrying data-dismiss.
	public function get_nestable_children() {
		return array(
			array( 'name' => 'block', 'label' => esc_html__( 'Content', 'bricks' ) ),
			array(
				'name'     => 'text-basic',
				'label'    => esc_html__( 'Close (×)', 'bricks' ),
				'settings' => array(
					'text'        => '&times;',
					'_attributes' => array(
						array( 'id' => 'vdismiss', 'name' => 'data-dismiss', 'value' => '' ),
						array( 'id' => 'vdismisslbl', 'name' => 'aria-label', 'value' => 'Dismiss' ),
					),
				),
			),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		if ( isset( $s['duration'] ) && '' !== $s['duration'] ) {
			$attrs[] = 'duration="' . esc_attr( $s['duration'] ) . '"';
		}
		if ( isset( $s['exit'] ) && '' !== $s['exit'] ) {
			$attrs[] = 'exit="' . esc_attr( $s['exit'] ) . '"';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-dismissable {$attr_str} {$this->render_attributes( '_root' )}>";
		echo \Bricks\Frontend::render_children( $this );
		echo '</wc-dismissable>';
	}
}
