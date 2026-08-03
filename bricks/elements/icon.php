<?php
/**
 * Vitops — Icon element (Bricks Builder).
 *
 * Renders one icon from the generated sprite (dist/icons.svg) as
 * `<span class="icon"><svg><use href="…#id"></svg></span>`. Pure markup: no
 * JavaScript, no request to an icon API, and the glyph inherits `currentColor`,
 * so a colour utility on this element or an ancestor just works.
 *
 * The sprite only exists when the site config sets `icons.sprite` — without it
 * this renders an empty box rather than failing, which is the same thing a
 * missing icon name does.
 *
 * Two id forms resolve: a semantic name ('menu'), which the build also emits as
 * a set-independent alias so the page survives an icon-set change, and a
 * qualified one ('ph:list' / 'ph--list'). Rendering is delegated to
 * vitops_icon() in load.php so the element, the shortcode and any theme PHP all
 * emit identical markup.
 *
 * Non-nestable: PHP render() runs in the builder canvas too, so the icon appears
 * live while editing.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Icon extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-icon';
	public $icon         = 'ti-star';
	public $css_selector = '.icon';

	public function get_label() {
		return esc_html__( 'Icon', 'bricks' );
	}

	public function get_keywords() {
		return array( 'icon', 'svg', 'sprite', 'symbol', 'vitops' );
	}

	public function set_controls() {
		$this->controls['name'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Icon name', 'bricks' ),
			'type'        => 'text',
			'placeholder' => 'menu',
			'description' => esc_html__(
				'A semantic name (menu, close, forward) or a set-specific one (ph:list). Only icons listed in the site config are in the sprite.',
				'bricks'
			),
		);

		$this->controls['size'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Size', 'bricks' ),
			'type'        => 'text',
			'placeholder' => '1.25em',
			'description' => esc_html__(
				'Any CSS length. Sets --icon-size; em units track the surrounding text.',
				'bricks'
			),
		);

		$this->controls['label'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Accessible label', 'bricks' ),
			'type'        => 'text',
			'description' => esc_html__(
				'Leave empty for decorative icons — they are then hidden from screen readers. Fill it in only when the icon carries meaning on its own.',
				'bricks'
			),
		);
	}

	public function render() {
		$settings = $this->settings;
		$name     = isset( $settings['name'] ) ? $settings['name'] : '';

		if ( ! function_exists( 'vitops_icon' ) ) {
			return;
		}

		// The root attributes carry Bricks' own classes and any the author added,
		// so they are merged onto the same wrapper vitops_icon() emits rather than
		// wrapping it in a second element.
		$this->set_attribute( '_root', 'class', 'icon' );

		echo '<div ' . $this->render_attributes( '_root' ) . '>'
			. vitops_icon(
				$name,
				array(
					'size'  => isset( $settings['size'] ) ? $settings['size'] : '',
					'label' => isset( $settings['label'] ) ? $settings['label'] : '',
				)
			)
			. '</div>';
	}
}
