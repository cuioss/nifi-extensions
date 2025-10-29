/**
 * Form Field Factory for standardized form creation across NiFi CUIOSS UI components.
 *
 * This module provides a comprehensive factory pattern for creating consistent,
 * accessible, and validated form fields. It eliminates code duplication and
 * ensures uniform styling, validation, and behavior across all UI components.
 *
 * @fileoverview Form field factory with validation, styling, and event handling
 * @author CUIOSS Team
 * @since 1.0.0
 */

'use strict';

import { createElement } from './domBuilder.js';
import { CSS } from './constants.js';

/**
 * Configuration object for form field creation.
 * @typedef {Object} FieldConfig
 * @property {string} name - Field identifier and name attribute
 * @property {string} label - Display label for the field
 * @property {string} [description] - Help text or description
 * @property {string} [value=''] - Initial field value
 * @property {string} [type='text'] - Input type (text, textarea, email, url, etc.)
 * @property {boolean} [required=false] - Whether the field is required
 * @property {string} [placeholder] - Placeholder text (defaults to description)
 * @property {Function|Object} [validation] - Validation function or configuration
 * @property {Object} [events={}] - Event handlers (e.g., {blur: fn, input: fn})
 * @property {string} [cssClass=''] - Additional CSS classes
 * @property {string} [helpText] - Tooltip help text
 * @property {boolean} [disabled=false] - Whether the field is disabled
 * @property {Object} [attributes={}] - Additional HTML attributes
 */

/**
 * Configuration object for button creation.
 * @typedef {Object} ButtonConfig
 * @property {string} text - Button text content
 * @property {string} [type='button'] - Button type attribute
 * @property {string} [cssClass=''] - Additional CSS classes
 * @property {string} [variant='primary'] - Style variant (primary, secondary, danger, success)
 * @property {Function} [onClick] - Click event handler
 * @property {boolean} [disabled=false] - Whether button is disabled
 * @property {string} [icon] - FontAwesome icon class
 * @property {Object} [attributes={}] - Additional HTML attributes
 */

/**
 * Configuration object for form section creation.
 * @typedef {Object} SectionConfig
 * @property {string} [title] - Section header title
 * @property {Array<HTMLElement>} [content=[]] - Content elements
 * @property {string} [cssClass=''] - Additional CSS classes
 * @property {boolean} [collapsible=false] - Whether section can be collapsed
 * @property {boolean} [expanded=true] - Initial expanded state
 */

/**
 * Enhanced form field factory for NiFi CUIOSS UI components.
 * Provides standardized form field creation with validation, styling, and event handling.
 */
export class FormFieldFactory {
    /**
     * Creates a new FormFieldFactory instance.
     * @param {Object} [options={}] - Factory configuration options
     * @param {Object} [options.i18n={}] - Internationalization object
     * @param {Object} [options.cssClasses] - CSS classes configuration
     * @param {boolean} [options.validationEnabled=true] - Enable automatic validation
     * @param {string} [options.containerClass='form-field'] - Default container class
     * @param {string} [options.labelSuffix=':'] - Label suffix character
     * @param {boolean} [options.showDescriptions=true] - Show field descriptions
     */
    constructor(options = {}) {
        this.defaultOptions = {
            i18n: options.i18n || {},
            cssClasses: options.cssClasses || CSS,
            validationEnabled: options.validationEnabled !== false,
            containerClass: 'form-field',
            labelSuffix: ':',
            showDescriptions: options.showDescriptions !== false
        };
    }

    /**
     * Creates a complete form field with label, input, description, and validation.
     *
     * @param {FieldConfig} config - Field configuration object
     * @returns {HTMLElement} Complete form field element with container
     *
     * @example
     * // Create a validated URL field
     * const factory = new FormFieldFactory({ i18n: nfCommon.getI18n() });
     * const field = factory.createField({
     *   name: 'jwks-url',
     *   label: 'JWKS URL',
     *   description: 'The URL of the JWKS endpoint',
     *   type: 'url',
     *   required: true,
     *   validation: validateUrl,
     *   events: { blur: (e) => console.log('URL changed:', e.target.value) }
     * });
     */
    createField(config) {
        const {
            name,
            label,
            description,
            value = '',
            type = 'text',
            required = false,
            placeholder = description,
            validation = null,
            events = {},
            cssClass = '',
            helpText = null,
            disabled = false,
            attributes = {}
        } = config;

        // Create field container
        const fieldContainer = this._createFieldContainer(name, cssClass);

        // Create and append label
        const labelElement = this._createLabel(name, label, required);
        fieldContainer.appendChild(labelElement);

        // Create and append input
        const inputElement = this._createInput(
            name, type, value, placeholder, disabled, attributes
        );
        fieldContainer.appendChild(inputElement);

        // Add description if enabled
        if (this.defaultOptions.showDescriptions && description) {
            const descElement = this._createDescription(description);
            fieldContainer.appendChild(descElement);
        }

        // Add help text/tooltip if provided
        if (helpText) {
            const helpElement = this._createHelpText(helpText);
            fieldContainer.appendChild(helpElement);
        }

        // Add validation if enabled
        if (this.defaultOptions.validationEnabled && validation) {
            this._addValidation(inputElement, validation);
        }

        // Attach event handlers
        this._attachEventHandlers(inputElement, events);

        // Add error container for validation messages
        const errorContainer = this._createErrorContainer(name);
        fieldContainer.appendChild(errorContainer);

        return fieldContainer;
    }

    /**
     * Creates a button with standardized styling and behavior.
     *
     * @param {ButtonConfig} config - Button configuration object
     * @returns {HTMLElement} Configured button element
     *
     * @example
     * // Create a primary button with icon
     * const button = factory.createButton({
     *   text: 'Test Connection',
     *   variant: 'primary',
     *   icon: 'fa-check',
     *   onClick: () => testConnection()
     * });
     */
    createButton(config) {
        const {
            text,
            type = 'button',
            cssClass = '',
            variant = 'primary',
            onClick = null,
            disabled = false,
            icon = null,
            attributes = {}
        } = config;

        const buttonClasses = ['btn', `btn-${variant}`, cssClass].filter(Boolean);
        const buttonAttributes = { type, disabled, ...attributes };

        const button = createElement('button', {
            css: buttonClasses,
            attributes: buttonAttributes
        });

        // Add icon if provided
        if (icon) {
            const iconElement = createElement('i', { css: ['fa', icon] });
            button.appendChild(iconElement);
            button.appendChild(document.createTextNode(' '));
        }

        button.appendChild(document.createTextNode(text));

        // Attach click handler
        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * Creates a form section with optional header and collapsible content.
     *
     * @param {SectionConfig} config - Section configuration object
     * @returns {HTMLElement} Complete section element
     *
     * @example
     * // Create a collapsible section
     * const section = factory.createSection({
     *   title: 'Advanced Settings',
     *   collapsible: true,
     *   expanded: false,
     *   content: [field1, field2, button]
     * });
     */
    createSection(config) {
        const {
            title,
            content = [],
            cssClass = '',
            collapsible = false,
            expanded = true
        } = config;

        const section = createElement('div', {
            css: ['form-section', cssClass].filter(Boolean)
        });

        // Create header if title provided
        if (title) {
            const header = createElement('div', {
                css: ['form-section-header'],
                text: title
            });

            if (collapsible) {
                const toggleIcon = createElement('i', {
                    css: ['fa', expanded ? 'fa-chevron-down' : 'fa-chevron-right']
                });
                header.appendChild(toggleIcon);
                header.addEventListener('click', () => this._toggleSection(section));
                header.style.cursor = 'pointer';
            }

            section.appendChild(header);
        }

        // Create content area
        const contentArea = createElement('div', {
            css: ['form-section-content', !expanded && collapsible ? 'hidden' : ''].filter(Boolean)
        });

        // Add content elements
        for (const element of content) {
            if (element instanceof Element) {
                contentArea.appendChild(element);
            }
        }

        section.appendChild(contentArea);
        return section;
    }

    /**
     * Validates all fields within a container element.
     *
     * @param {HTMLElement} container - Container element with form fields
     * @returns {Object} Validation result with isValid flag and errors array
     *
     * @example
     * // Validate all fields in a form
     * const result = factory.validateContainer(formElement);
     * if (!result.isValid) {
     *   console.log('Validation errors:', result.errors);
     * }
     */
    validateContainer(container) {
        const inputs = container.querySelectorAll('input, textarea, select');
        const errors = [];
        let isValid = true;

        for (const input of inputs) {
            if (input._validate) {
                const result = input._validate();
                if (!result.isValid) {
                    isValid = false;
                    errors.push({
                        field: input.name,
                        error: result.error
                    });
                }
            }
        }

        return { isValid, errors };
    }

    /**
     * Resets all fields within a container element.
     *
     * @param {HTMLElement} container - Container element with form fields
     *
     * @example
     * // Reset all fields in a form
     * factory.resetContainer(formElement);
     */
    resetContainer(container) {
        const inputs = container.querySelectorAll('input, textarea, select');
        for (const input of inputs) {
            input.value = '';
            input.classList.remove('valid', 'invalid');

            const errorContainer = input.parentElement?.querySelector('.field-error');
            if (errorContainer) {
                errorContainer.classList.add('hidden');
                errorContainer.textContent = '';
            }
        }
    }

    // Private helper methods

    /**
     * Creates field container with proper classes.
     * @private
     */
    _createFieldContainer(name, additionalClass = '') {
        return createElement('div', {
            css: [
                this.defaultOptions.containerClass,
                `field-container-${name}`,
                additionalClass
            ].filter(Boolean)
        });
    }

    /**
     * Creates label element with accessibility attributes.
     * @private
     */
    _createLabel(name, label, required) {
        const labelText = label + this.defaultOptions.labelSuffix + (required ? ' *' : '');
        return createElement('label', {
            text: labelText,
            attributes: { for: `field-${name}` },
            css: ['field-label', required ? 'required' : ''].filter(Boolean)
        });
    }

    /**
     * Creates input element with proper attributes.
     * @private
     */
    _createInput(name, type, value, placeholder, disabled, additionalAttributes) {
        const baseAttributes = {
            id: `field-${name}`,
            name: name,
            placeholder: placeholder,
            ...additionalAttributes
        };

        // Only add disabled attribute if it's true
        if (disabled === true) {
            baseAttributes.disabled = disabled;
        }

        const inputElement = createElement(type === 'textarea' ? 'textarea' : 'input', {
            css: [`field-${name}`, 'form-input'],
            attributes: baseAttributes
        });

        if (type !== 'textarea') {
            inputElement.setAttribute('type', type);
        }

        if (value) {
            if (type === 'textarea') {
                inputElement.textContent = value;
            } else {
                inputElement.value = value;
            }
        }

        return inputElement;
    }

    /**
     * Creates description element.
     * @private
     */
    _createDescription(description) {
        return createElement('div', {
            css: ['field-description'],
            text: description
        });
    }

    /**
     * Creates help text element with tooltip.
     * @private
     */
    _createHelpText(helpText) {
        return createElement('div', {
            css: ['field-help', 'help-tooltip'],
            text: helpText,
            attributes: { title: helpText }
        });
    }

    /**
     * Creates error display container for validation messages.
     * @private
     */
    _createErrorContainer(fieldName) {
        return createElement('div', {
            css: [`field-error-${fieldName}`, 'field-error', 'hidden'],
            attributes: { role: 'alert', 'aria-live': 'polite' }
        });
    }

    /**
     * Adds validation functionality to an input element.
     * @private
     */
    _addValidation(inputElement, validation) {
        const validateField = () => {
            const value = inputElement.value;
            const result = typeof validation === 'function' ? validation(value) : validation.validate(value);

            const errorContainer = inputElement.parentElement.querySelector('.field-error');

            if (result.isValid) {
                inputElement.classList.remove('invalid');
                inputElement.classList.add('valid');
                if (errorContainer) {
                    errorContainer.classList.add('hidden');
                    errorContainer.textContent = '';
                }
            } else {
                inputElement.classList.remove('valid');
                inputElement.classList.add('invalid');
                if (errorContainer) {
                    errorContainer.classList.remove('hidden');
                    errorContainer.textContent = result.error || 'Invalid input';
                }
            }

            return result;
        };

        // Add validation event listeners
        inputElement.addEventListener('blur', validateField);
        inputElement.addEventListener('input', () => {
            // Clear error state on input
            if (inputElement.classList.contains('invalid')) {
                inputElement.classList.remove('invalid');
                const errorContainer = inputElement.parentElement.querySelector('.field-error');
                if (errorContainer) {
                    errorContainer.classList.add('hidden');
                }
            }
        });

        // Store validation function for external access
        inputElement._validate = validateField;
    }

    /**
     * Attaches event handlers to an element.
     * @private
     */
    _attachEventHandlers(element, events) {
        for (const [event, handler] of Object.entries(events)) {
            if (typeof handler === 'function') {
                element.addEventListener(event, handler);
            }
        }
    }

    /**
     * Toggles section visibility for collapsible sections.
     * @private
     */
    _toggleSection(section) {
        const content = section.querySelector('.form-section-content');
        const icon = section.querySelector('.fa');

        if (content && icon) {
            content.classList.toggle('hidden');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-right');
        }
    }
}

/**
 * Factory function for creating form fields with backward compatibility.
 *
 * @param {FieldConfig} config - Field configuration object
 * @returns {HTMLElement} Complete form field element
 *
 * @example
 * // Simple field creation
 * const field = createFormField({
 *   name: 'username',
 *   label: 'Username',
 *   type: 'text',
 *   required: true
 * });
 */
export const createFormField = (config) => {
    const factory = new FormFieldFactory();
    return factory.createField(config);
};

/**
 * Factory function for creating buttons with backward compatibility.
 *
 * @param {ButtonConfig} config - Button configuration object
 * @returns {HTMLElement} Configured button element
 */
export const createFormButton = (config) => {
    const factory = new FormFieldFactory();
    return factory.createButton(config);
};

/**
 * Factory function for creating form sections with backward compatibility.
 *
 * @param {SectionConfig} config - Section configuration object
 * @returns {HTMLElement} Complete section element
 */
export const createFormSection = (config) => {
    const factory = new FormFieldFactory();
    return factory.createSection(config);
};

/**
 * Enhanced FormFieldBuilder class for backward compatibility with existing code.
 * Provides static methods that delegate to the new factory pattern.
 */
export class FormFieldBuilder {
    /**
     * Creates a form field using the factory pattern.
     * @param {FieldConfig} config - Field configuration
     * @returns {HTMLElement} Form field element
     */
    static createField(config) {
        return createFormField(config);
    }

    /**
     * Creates a button using the factory pattern.
     * @param {ButtonConfig} config - Button configuration
     * @returns {HTMLElement} Button element
     */
    static createButton(config) {
        return createFormButton(config);
    }

    /**
     * Creates a section using the factory pattern.
     * @param {SectionConfig} config - Section configuration
     * @returns {HTMLElement} Section element
     */
    static createSection(config) {
        return createFormSection(config);
    }

    /**
     * Creates a factory instance with specific configuration.
     * @param {Object} options - Factory options
     * @returns {FormFieldFactory} Configured factory instance
     */
    static createFactory(options) {
        return new FormFieldFactory(options);
    }
}
