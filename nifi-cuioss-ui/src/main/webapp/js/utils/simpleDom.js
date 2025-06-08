/**
 * Simple DOM utilities - replaces 417 lines of over-engineered builder patterns.
 * For a simple form UI, we just need basic element creation helpers.
 */
'use strict';

/**
 * Simple element creation - replaces complex createElement patterns.
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement} Created element
 */
export const createElement = (tag, options = {}) => {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.html) element.innerHTML = options.html;
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    return element;
};

/**
 * Simple form field creation - replaces FormFieldBuilder complexity.
 * @param {Object} config - Field configuration
 * @returns {DocumentFragment} Complete field structure
 */
export const createFormField = (config) => {
    const {
        name,
        label,
        description,
        value = '',
        type = 'text',
        placeholder = description
    } = config;

    // Create field container
    const fieldContainer = createElement('div', { className: 'form-field' });

    // Create label
    const labelElement = createElement('label', { text: label + ':' });

    // Create input
    const inputElement = createElement('input', {
        className: `field-${name}`,
        attributes: { type, placeholder }
    });

    if (value) {
        inputElement.value = value;
    }

    // Create description
    const descElement = createElement('div', {
        className: 'field-description',
        text: description
    });

    // Assemble field
    fieldContainer.appendChild(labelElement);
    fieldContainer.appendChild(inputElement);
    fieldContainer.appendChild(descElement);

    // Return as DocumentFragment for compatibility
    const fragment = document.createDocumentFragment();
    fragment.appendChild(fieldContainer);

    return fragment;
};

/**
 * FormFieldBuilder class for compatibility - simple wrapper around createFormField.
 */
export class FormFieldBuilder {
    static createField(config) {
        return createFormField(config);
    }
}

// Legacy compatibility exports
export const createFragment = () => document.createDocumentFragment();
export class DOMBuilder {
    constructor() {
        this.fragment = createFragment();
        this.elements = [];
    }

    addElement(tag, options = {}) {
        const element = createElement(tag, options);
        this.fragment.appendChild(element);
        this.elements.push(element);
        return this;
    }

    build() {
        return this.fragment;
    }
}

export const DOMUtils = {
    clearChildren(element) {
        const domElement = element instanceof Element ? element : element[0];
        while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
        }
    }
};
