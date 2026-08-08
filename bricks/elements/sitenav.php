<?php
/**
 * Vitops — Site Nav element (Bricks Builder).
 *
 * The site's primary navigation, generated from a WordPress menu. Two presentations
 * from one markup tree, switched purely by container width — no JS beyond the native
 * Popover API:
 *
 *   • Mobile (below the chosen breakpoint, .sitenav--bp-{sm,md,lg,xl}): a hamburger
 *     button (a Popover API invoker) opens a slide-in DRAWER — its own sibling
 *     [popover] element. Light-dismiss, Esc, and focus handling come free from the
 *     platform. Inside the drawer, branch items are native <details> ACCORDIONS.
 *   • Desktop (≥ the breakpoint): the hamburger + drawer chrome fall away and the same
 *     list lays out inline as a NAVBAR; branch submenus promote to hover/focus/click
 *     pop-out DROPDOWNS. See sitenav.css.
 *
 * Each branch item is a SPLIT-LINK: a real parent <a> that navigates, flush with a
 * separate <details> disclosure whose <summary> is *only* the caret toggle. The link
 * sits OUTSIDE the summary (a sibling of <details>), so there is no interactive control
 * nested inside the summary's button role — valid HTML and axe-clean (no
 * nested-interactive). The submenu lives inside <details> and reveals as an accordion
 * (mobile) or a dropdown (desktop).
 *
 * Per-breakpoint depth caps: "Desktop depth" / "Mobile depth" limit how deep the tree
 * shows at each breakpoint. PHP resolves the caps into `sitenav__item--desktop-branch`
 * / `--mobile-branch` classes on the boundary nodes; sitenav.css then hides just the
 * caret + submenu at the capped breakpoint, leaving the parent link — so a 3-tier
 * desktop megamenu collapses to a 2-tier tap-through on mobile.
 *
 * "Menu" was this element's former name; it was renamed to Site Nav so "Menu" can name
 * a more generic interactive dropdown. Non-nestable: the tree comes from the WP menu,
 * so render() drives all markup and runs in the builder canvas too.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Sitenav extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-sitenav';
	public $icon         = 'ti-menu';
	public $css_selector = '.sitenav';

	public function get_label() {
		return esc_html__( 'Site Nav', 'bricks' );
	}

	public function get_keywords() {
		return array( 'sitenav', 'site nav', 'nav', 'navigation', 'navbar', 'drawer', 'header', 'menu', 'megamenu', 'vitops' );
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
			'tab'         => 'content',
			'label'       => esc_html__( 'Navbar breakpoint', 'bricks' ),
			'type'        => 'select',
			'inline'      => true,
			'options'     => array(
				'sm' => esc_html__( 'sm — 30rem', 'bricks' ),
				'md' => esc_html__( 'md — 48rem', 'bricks' ),
				'lg' => esc_html__( 'lg — 64rem', 'bricks' ),
				'xl' => esc_html__( 'xl — 80rem', 'bricks' ),
			),
			'default'     => 'md',
			'description' => esc_html__( 'Container width at/above which the drawer becomes an inline navbar with pop-out dropdowns. Below it, a hamburger opens a drawer with accordions.', 'bricks' ),
		);

		$this->controls['drawerSide'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Drawer side', 'bricks' ),
			'type'        => 'select',
			'inline'      => true,
			'options'     => array(
				'start' => esc_html__( 'Inline-start (left)', 'bricks' ),
				'end'   => esc_html__( 'Inline-end (right)', 'bricks' ),
			),
			'default'     => 'end',
			'description' => esc_html__( 'Edge the mobile drawer slides in from.', 'bricks' ),
		);

		$this->controls['toggleLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Toggle label (accessible name)', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Menu', 'bricks' ),
			'description' => esc_html__( 'aria-label for the mobile hamburger button.', 'bricks' ),
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
		$s     = $this->settings;
		$bp    = ! empty( $s['breakpoint'] ) ? $s['breakpoint'] : 'md';
		$side  = ! empty( $s['drawerSide'] ) && 'start' === $s['drawerSide'] ? 'start' : 'end';
		$dd    = isset( $s['depthDesktop'] ) && '' !== $s['depthDesktop'] ? (int) $s['depthDesktop'] : PHP_INT_MAX;
		$dm    = isset( $s['depthMobile'] ) && '' !== $s['depthMobile'] ? (int) $s['depthMobile'] : PHP_INT_MAX;
		$label = ! empty( $s['ariaLabel'] ) ? $s['ariaLabel'] : esc_html__( 'Primary', 'bricks' );
		$toggle_label = ! empty( $s['toggleLabel'] ) ? $s['toggleLabel'] : esc_html__( 'Menu', 'bricks' );

		// Unique id ties the hamburger invoker to its sibling drawer popover.
		$drawer_id = 'sitenav-' . $this->id;

		$this->set_attribute( '_root', 'class', array( 'sitenav', 'sitenav--bp-' . $bp, 'sitenav--drawer-' . $side ) );
		$this->set_attribute( '_root', 'aria-label', $label );

		echo "<nav {$this->render_attributes( '_root' )}>";

		// Hamburger — a Popover API invoker controlling the sibling drawer. Hidden at
		// the navbar breakpoint via CSS.
		echo '<button type="button" class="sitenav__toggle" popovertarget="' . esc_attr( $drawer_id ) . '"'
			. ' aria-label="' . esc_attr( $toggle_label ) . '">'
			. $this->hamburger_svg()
			. '</button>';

		// Drawer (mobile) / navbar body (desktop): the popover sibling.
		echo '<div id="' . esc_attr( $drawer_id ) . '" popover class="sitenav__panel">';

		echo '<button type="button" class="sitenav__close" popovertarget="' . esc_attr( $drawer_id ) . '"'
			. ' popovertargetaction="hide" aria-label="' . esc_attr__( 'Close menu', 'bricks' ) . '">'
			. $this->close_svg()
			. '</button>';

		$menu_id = isset( $s['menu'] ) ? $s['menu'] : '';
		$items   = $menu_id && function_exists( 'wp_get_nav_menu_items' ) ? wp_get_nav_menu_items( $menu_id ) : array();

		if ( empty( $items ) ) {
			// Builder/empty state: keep the element discoverable.
			echo '<p class="sitenav__empty">' . esc_html__( 'Select a WordPress menu.', 'bricks' ) . '</p>';
		} else {
			// Group flat items by parent id to walk as a tree.
			$by_parent = array();
			foreach ( $items as $item ) {
				$by_parent[ (int) $item->menu_item_parent ][] = $item;
			}
			echo $this->render_level( $by_parent, 0, 1, $dd, $dm, true );
		}

		echo '</div>'; // .sitenav__panel
		echo '</nav>';
	}

	/**
	 * Render one <ul> level and recurse. $depth is 1-based (top list = 1).
	 * $top marks the outer list (gets .sitenav__list vs nested .sitenav__submenu).
	 */
	private function render_level( $by_parent, $parent_id, $depth, $dd, $dm, $top ) {
		if ( empty( $by_parent[ $parent_id ] ) ) {
			return '';
		}

		$list_class = $top ? 'sitenav__list' : 'sitenav__submenu';
		// `role="list"` restores what `list-style: none` takes away: Safari + VoiceOver
		// stop announcing a marker-less <ul> as a list, so the reset silently costs the
		// semantics the <ul> was chosen for. Both classes set it (sitenav.css).
		$html = '<ul class="' . $list_class . '" role="list">';

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
				$html .= '<li class="sitenav__item">' . $link . '</li>';
				continue;
			}

			// Branch: caret/submenu may be capped at one breakpoint. (The item-level
			// split-link styling comes from the `split-link__*` element classes below,
			// not the `.split-link` wrapper, whose inline-flex would fight the layout.)
			$item_classes = array( 'sitenav__item', 'sitenav__item--branch' );
			if ( $show_desktop && ! $show_mobile ) {
				$item_classes[] = 'sitenav__item--desktop-branch';
			} elseif ( $show_mobile && ! $show_desktop ) {
				$item_classes[] = 'sitenav__item--mobile-branch';
			}

			$submenu     = $this->render_level( $by_parent, $id, $child_depth, $dd, $dm, false );
			$toggle_name = sprintf(
				/* translators: %s: parent menu item title */
				esc_attr__( 'Show %s submenu', 'bricks' ),
				wp_strip_all_tags( $item->title )
			);

			// SPLIT-LINK, restructured for accessibility + a robust layout:
			//   • The parent <a> is a SIBLING of <details> (not nested in <summary>), so
			//     no interactive control sits inside the summary's button role — valid
			//     HTML, axe-clean (no nested-interactive).
			//   • <details> holds ONLY the caret <summary>; the submenu <ul> is a further
			//     SIBLING, controlled via `:has(> details[open])` in CSS. Keeping the ul
			//     out of <details> avoids the global ::details-content accordion in
			//     details.css and lets the ul be a real grid child of the <li> — inline
			//     accordion on mobile, absolute dropdown on desktop.
			$html .= '<li class="' . esc_attr( implode( ' ', $item_classes ) ) . '">'
				. $link
				. '<details class="sitenav__disclosure">'
				. '<summary class="sitenav__subtoggle split-link__toggle" aria-label="' . esc_attr( $toggle_name ) . '">'
				. '<span class="split-link__caret" aria-hidden="true">&#9662;</span>'
				. '</summary>'
				. '</details>'
				. $submenu
				. '</li>';
		}

		return $html . '</ul>';
	}

	// Build the item's <a> from WP menu-item fields.
	private function link_markup( $item ) {
		$url     = ! empty( $item->url ) ? $item->url : '#';
		$target  = ! empty( $item->target ) ? ' target="' . esc_attr( $item->target ) . '"' : '';
		$rel     = ! empty( $item->xfn ) ? ' rel="' . esc_attr( $item->xfn ) . '"' : '';
		$title   = ! empty( $item->attr_title ) ? ' title="' . esc_attr( $item->attr_title ) . '"' : '';
		$classes = 'sitenav__link split-link__link';
		if ( ! empty( $item->classes ) && is_array( $item->classes ) ) {
			$extra = trim( implode( ' ', array_filter( $item->classes ) ) );
			if ( '' !== $extra ) {
				$classes .= ' ' . $extra;
			}
		}

		return '<a class="' . esc_attr( $classes ) . '" href="' . esc_url( $url ) . '"'
			. $target . $rel . $title . '>' . esc_html( $item->title ) . '</a>';
	}

	// Inline hamburger glyph (three bars). aria-hidden — the button is labelled.
	private function hamburger_svg() {
		return '<svg class="sitenav__toggle-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"'
			. ' stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">'
			. '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
			. '</svg>';
	}

	// Inline close (✕) glyph. aria-hidden — the button is labelled.
	private function close_svg() {
		return '<svg class="sitenav__close-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"'
			. ' stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">'
			. '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'
			. '</svg>';
	}
}
