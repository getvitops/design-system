<?php
/**
 * Vitops — Copy Button element (Bricks Builder).
 *
 * Renders the <copy-button> Lit component (src/web-components/WCCopy.ts): a
 * copy-to-clipboard button, hidden until connected (Clipboard API gate). The `value`
 * is copied; `label` is the button text (falls back to slotted text).
 *
 * Non-nestable: PHP render() runs in the builder canvas too, so the button upgrades
 * live while editing.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Copy extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-copy-button';
	public $icon         = 'ti-clipboard';
	public $css_selector = 'copy-button';

	public function get_label() {
		return esc_html__( 'Copy Button', 'bricks' );
	}

	public function get_keywords() {
		return array( 'copy', 'clipboard', 'button', 'vitops' );
	}

	public function set_controls() {
		$this->controls['value'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Value to copy', 'bricks' ),
			'type'        => 'text',
		);

		$this->controls['label'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Button label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Copy to clipboard', 'bricks' ),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		if ( isset( $s['value'] ) && '' !== $s['value'] ) {
			$attrs[] = 'value="' . esc_attr( $s['value'] ) . '"';
		}
		if ( ! empty( $s['label'] ) ) {
			$attrs[] = 'label="' . esc_attr( $s['label'] ) . '"';
		}

		$attr_str = implode( ' ', $attrs );
		$fallback = ! empty( $s['label'] ) ? esc_html( $s['label'] ) : esc_html__( 'Copy to clipboard', 'bricks' );

		echo "<copy-button {$attr_str} {$this->render_attributes( '_root' )}>{$fallback}</copy-button>";
	}
}
