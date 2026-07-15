<?php
/**
 * Vitops — Multi Field element (Bricks Builder).
 *
 * Renders the <multi-field> Lit component (src/web-components/WCMultiField.ts): a
 * form-associated repeatable input group (add / remove entries, min / max). Default
 * entries are supplied as slotted <input value="…"> children, which the component reads
 * on connect.
 *
 * Non-nestable: PHP render() runs in the builder canvas too, so the field group upgrades
 * live while editing.
 *
 * Owned by the framework repo (vitops: bricks/elements/); copied into the theme's
 * dist/bricks/ on build — do not hand-edit in the theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vitops_Element_Multi_Field extends \Bricks\Element {
	public $category     = 'vitops';
	public $name         = 'vitops-multi-field';
	public $icon         = 'ti-list';
	public $css_selector = 'multi-field';

	public function get_label() {
		return esc_html__( 'Multi Field', 'bricks' );
	}

	public function get_keywords() {
		return array( 'multi', 'field', 'repeatable', 'form', 'input', 'vitops' );
	}

	public function set_controls() {
		$this->controls['name'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Field name', 'bricks' ),
			'type'        => 'text',
			'description' => esc_html__( 'Submitted as name[] for each entry.', 'bricks' ),
		);

		$this->controls['type'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Input type', 'bricks' ),
			'type'        => 'text',
			'placeholder' => 'text',
		);

		$this->controls['placeholder'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Placeholder', 'bricks' ),
			'type'  => 'text',
		);

		$this->controls['min'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Min entries', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['max'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Max entries', 'bricks' ),
			'type'  => 'number',
		);

		$this->controls['protectDefaults'] = array(
			'tab'   => 'content',
			'label' => esc_html__( 'Protect default entries', 'bricks' ),
			'type'  => 'checkbox',
		);

		$this->controls['addLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Add button label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Add', 'bricks' ),
		);

		$this->controls['clearLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Clear button label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Clear', 'bricks' ),
		);

		$this->controls['deleteLabel'] = array(
			'tab'         => 'content',
			'label'       => esc_html__( 'Delete button label', 'bricks' ),
			'type'        => 'text',
			'placeholder' => esc_html__( 'Delete', 'bricks' ),
		);

		$this->controls['defaults'] = array(
			'tab'           => 'content',
			'label'         => esc_html__( 'Default entries', 'bricks' ),
			'type'          => 'repeater',
			'titleProperty' => 'value',
			'fields'        => array(
				'value' => array(
					'label' => esc_html__( 'Value', 'bricks' ),
					'type'  => 'text',
				),
			),
		);
	}

	public function render() {
		$s     = $this->settings;
		$attrs = array();

		$text = array(
			'name'        => 'name',
			'type'        => 'type',
			'placeholder' => 'placeholder',
			'min'         => 'min',
			'max'         => 'max',
			'addLabel'    => 'add-label',
			'clearLabel'  => 'clear-label',
			'deleteLabel' => 'delete-label',
		);
		foreach ( $text as $key => $attr ) {
			if ( isset( $s[ $key ] ) && '' !== $s[ $key ] ) {
				$attrs[] = $attr . '="' . esc_attr( $s[ $key ] ) . '"';
			}
		}

		if ( ! empty( $s['protectDefaults'] ) ) {
			$attrs[] = 'protect-defaults';
		}

		$attr_str = implode( ' ', $attrs );

		// Default entries → slotted <input value="…"> children.
		$inputs = '';
		if ( ! empty( $s['defaults'] ) && is_array( $s['defaults'] ) ) {
			$input_type = ! empty( $s['type'] ) ? $s['type'] : 'text';
			foreach ( $s['defaults'] as $row ) {
				if ( isset( $row['value'] ) && '' !== $row['value'] ) {
					$inputs .= '<input type="' . esc_attr( $input_type ) . '" value="' . esc_attr( $row['value'] ) . '">';
				}
			}
		}

		echo "<multi-field {$attr_str} {$this->render_attributes( '_root' )}>{$inputs}</multi-field>";
	}
}
