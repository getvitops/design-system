<?php
/**
 * Vitops — Menu element (Bricks Builder).
 *
 * Renders a responsive navigation from a WordPress menu. Leaf items are plain
 * links; branch items (with children) are split-links — a parent <a> flush with a
 * <details> disclosure whose <summary> carries the toggle caret and whose content
 * is the submenu. Pure native platform, no JS:
 *
 *   • Mobile (base): each branch is a native <details> accordion — tap the caret to
 *     expand the submenu inline.
 *   • Desktop (≥ the chosen container breakpoint, .menu--bp-{sm,md,lg,xl}): the top
 *     list goes horizontal and submenus promote to pop-outs revealed on hover,
 *     keyboard focus, OR click (the [open] state pins them). See menu.css.
 *
 * Per-breakpoint depth caps: "Desktop depth" / "Mobile depth" limit how deep the
 * tree shows at each breakpoint. PHP resolves the caps into `menu__item--desktop-
 * branch` / `--mobile-branch` classes on the boundary nodes; menu.css then hides
 * just the caret + submenu at the capped breakpoint, leaving the parent link — so a
 * 3-tier desktop megamenu collapses to a 2-tier tap-through on mobile.
 *
 * Non-nestable: the tree comes from the WP menu, so render() drives all markup and
 * runs in the builder canvas too.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Menu extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-menu';
	public $icon         = 'ti-menu';
	public $css_selector = '.menu';

	public function get_label() {
		return esc_html__( 'Menu', 'bricks' );
	}

	public function get_keywords() {
		return array( 'menu', 'nav', 'navigation', 'dropdown', 'megamenu', 'split', 'vitops' );
	}

	public function set_controls() {
		// Populate the menu picker from registered WP nav menus (available in the
		// builder/admin context where set_controls runs).
		$menu_options = array();
		if ( function_exists( 'wp_get_nav_menus' ) ) {
			foreach ( wp_get_nav_menus() as $menu ) {
				$menu_options[ $menu->term_id ] = $menu->name;
			}
		}

		$this->controls['menu'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'WordPress menu', 'bricks' ),
			'type'        => 'select',
			'options'     => $menu_options,
			'placeholder' => esc_html__( 'Select a menu', 'bricks' ),
		);

		if ( empty( $menu_options ) ) {
			$this->controls['menuInfo'] = array(
				'tab'     => 'content',
				'type'    => 'info',
				'content' => esc_html__( 'No WordPress menus found. Create one under Appearance → Menus.', 'bricks' ),
			);
		}

		$this->controls['ariaLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Accessible label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Primary', 'bricks' ),
			'description' => esc_html__( 'aria-label for the <nav> landmark.', 'bricks' ),
		);

		$this->controls['breakpoint'] = array(
			'tab'     => 'content',
			'label'   => esc_html__( 'Desktop breakpoint', 'bricks' ),
			'type'    => 'select',
			'inline'  => true,
			'options' => array(
				'sm' => esc_html__( 'sm — 30rem', 'bricks' ),
				'md' => esc_html__( 'md — 48rem', 'bricks' ),
				'lg' => esc_html__( 'lg — 64rem', 'bricks' ),
				'xl' => esc_html__( 'xl — 80rem', 'bricks' ),
			),
			'default' => 'md',
			'description' => esc_html__( 'Container width at/above which submenus become pop-out dropdowns.', 'bricks' ),
		);

		$this->controls['depthDesktop'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Desktop depth', 'bricks' ),
			'type'        => 'number',
			'min'         => 1,
			'default'     => 3,
			'description' => esc_html__( 'Levels shown at/above the breakpoint. Empty = unlimited.', 'bricks' ),
		);

		$this->controls['depthMobile'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Mobile depth', 'bricks' ),
			'type'        => 'number',
			'min'         => 1,
			'default'     => 2,
			'description' => esc_html__( 'Levels shown below the breakpoint; deeper toggles/markers are hidden. Empty = unlimited.', 'bricks' ),
		);
	}

	public function render() {
		$s   = $this->settings;
		$bp  = ! empty( $s['breakpoint'] ) ? $s['breakpoint'] : 'md';
		$dd  = isset( $s['depthDesktop'] ) && '' !== $s['depthDesktop'] ? (int) $s['depthDesktop'] : PHP_INT_MAX;
		$dm  = isset( $s['depthMobile'] ) && '' !== $s['depthMobile'] ? (int) $s['depthMobile'] : PHP_INT_MAX;
		$label = ! empty( $s['ariaLabel'] ) ? $s['ariaLabel'] : esc_html__( 'Primary', 'bricks' );

		$this->set_attribute( '_root', 'class', array( 'menu', 'menu--bp-' . $bp ) );
		$this->set_attribute( '_root', 'aria-label', $label );

		echo "<nav {$this->render_attributes( '_root' )}>";

		$menu_id = isset( $s['menu'] ) ? $s['menu'] : '';
		$items   = $menu_id && function_exists( 'wp_get_nav_menu_items' ) ? wp_get_nav_menu_items( $menu_id ) : array();

		if ( empty( $items ) ) {
			// Builder/empty state: keep the element discoverable.
			echo '<p class="menu__empty">' . esc_html__( 'Select a WordPress menu.', 'bricks' ) . '</p>';
		} else {
			// Group flat items by parent id to walk as a tree.
			$by_parent = array();
			foreach ( $items as $item ) {
				$by_parent[ (int) $item->menu_item_parent ][] = $item;
			}
			echo $this->render_level( $by_parent, 0, 1, $dd, $dm, true );
		}

		echo '</nav>';
	}

	/**
	 * Render one <ul> level and recurse. $depth is 1-based (top list = 1).
	 * $top marks the outer list (gets .menu__list vs nested .menu__submenu).
	 */
	private function render_level( $by_parent, $parent_id, $depth, $dd, $dm, $top ) {
		if ( empty( $by_parent[ $parent_id ] ) ) {
			return '';
		}

		$list_class = $top ? 'menu__list' : 'menu__submenu';
		$html       = '<ul class="' . $list_class . '">';

		foreach ( $by_parent[ $parent_id ] as $item ) {
			$id          = (int) $item->ID;
			$child_depth = $depth + 1;
			$has_kids    = ! empty( $by_parent[ $id ] );

			// A child list at $child_depth is shown per breakpoint if within its cap.
			$show_desktop = $has_kids && $child_depth <= $dd;
			$show_mobile  = $has_kids && $child_depth <= $dm;

			$link = $this->link_markup( $item );

			// Leaf (no children, or children capped out at BOTH breakpoints).
			if ( ! $has_kids || ( ! $show_desktop && ! $show_mobile ) ) {
				$html .= '<li class="menu__item">' . $link . '</li>';
				continue;
			}

			// Branch: caret/submenu may be capped at one breakpoint.
			$item_classes = array( 'menu__item', 'menu__item--branch' );
			if ( $show_desktop && ! $show_mobile ) {
				$item_classes[] = 'menu__item--desktop-branch';
			} elseif ( $show_mobile && ! $show_desktop ) {
				$item_classes[] = 'menu__item--mobile-branch';
			}

			$submenu = $this->render_level( $by_parent, $id, $child_depth, $dd, $dm, false );

			$html .= '<li class="' . esc_attr( implode( ' ', $item_classes ) ) . '">'
				. '<details class="menu__disclosure">'
				. '<summary class="menu__summary split-link">'
				. $link
				. '<span class="menu__toggle split-link__toggle" aria-hidden="true">'
				. '<span class="split-link__caret">&#9662;</span>'
				. '</span>'
				. '</summary>'
				. $submenu
				. '</details>'
				. '</li>';
		}

		return $html . '</ul>';
	}

	// Build the item's <a> from WP menu-item fields.
	private function link_markup( $item ) {
		$url    = ! empty( $item->url ) ? $item->url : '#';
		$target = ! empty( $item->target ) ? ' target="' . esc_attr( $item->target ) . '"' : '';
		$rel    = ! empty( $item->xfn ) ? ' rel="' . esc_attr( $item->xfn ) . '"' : '';
		$title  = ! empty( $item->attr_title ) ? ' title="' . esc_attr( $item->attr_title ) . '"' : '';
		$classes = 'menu__link split-link__link';
		if ( ! empty( $item->classes ) && is_array( $item->classes ) ) {
			$extra = trim( implode( ' ', array_filter( $item->classes ) ) );
			if ( '' !== $extra ) {
				$classes .= ' ' . $extra;
			}
		}

		return '<a class="' . esc_attr( $classes ) . '" href="' . esc_url( $url ) . '"'
			. $target . $rel . $title . '>' . esc_html( $item->title ) . '</a>';
	}
}
