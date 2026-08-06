<?php
/**
 * Vitops — Color Scheme Toggle element (Bricks Builder).
 *
 * Renders the <wc-color-scheme-toggle> Lit component (src/web-components/WCColorSchemeToggle.ts):
 * a segmented System / Light / Dark theme toggle, hidden until JS loads. Optionally seed
 * the initial `scheme`.
 *
 * Non-nestable: PHP render() runs in the builder canvas too, so the toggle upgrades
 * live while editing.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Color_Scheme_Toggle extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-color-scheme-toggle';
	public $icon         = 'ti-shine';
	public $css_selector = 'wc-color-scheme-toggle';

	public function get_label() {
		return esc_html__( 'Color Scheme Toggle', 'bricks' );
	}

	public function get_keywords() {
		return array( 'color', 'scheme', 'theme', 'dark', 'light', 'toggle', 'vitops' );
	}

	public function set_controls() {
		$this->controls['scheme'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Initial scheme', 'bricks' ),
			'type'        => 'select',
			'inline'      => true,
			'options'     => array(
				'system' => esc_html__( 'System', 'bricks' ),
				'light'  => esc_html__( 'Light', 'bricks' ),
				'dark'   => esc_html__( 'Dark', 'bricks' ),
			),
			'placeholder' => esc_html__( 'System', 'bricks' ),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		if ( ! empty( $s['scheme'] ) ) {
			$attrs[] = 'scheme="' . esc_attr( $s['scheme'] ) . '"';
		}

		$attr_str = implode( ' ', $attrs );

		echo "<wc-color-scheme-toggle {$attr_str} {$this->render_attributes( '_root' )}></wc-color-scheme-toggle>";
	}
}
