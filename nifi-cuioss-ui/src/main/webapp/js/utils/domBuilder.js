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

    // Handle CSS classes
    if (options.css) {
        if (Array.isArray(options.css)) {
            element.classList.add(...options.css);
        } else if (typeof options.css === 'string') {
            element.className = options.css;
        }
    }
    if (options.className) element.className = options.className;

    // Handle content
    if (options.text) element.textContent = options.text;
    if (options.html) {
        // Security: Only allow pre-sanitized HTML or use textContent for user input
        if (options.sanitized === true) {
            element.innerHTML = options.html;
        } else {
            element.textContent = options.html; // Safer default: treat as text
        }
    }

    // Handle attributes
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            // Special handling for boolean attributes like disabled, checked, etc.
            if (key === 'disabled' || key === 'checked' || key === 'readonly' || key === 'required') {
                if (value === true || value === 'true' || value === '') {
                    element.setAttribute(key, '');
                } else if (value === false || value === 'false' || value === null || value === undefined) {
                    // Don't set the attribute at all if it's false
                    return;
                } else {
                    // For any other value, set it as is (e.g., disabled="disabled")
                    element.setAttribute(key, value);
                }
            } else {
                element.setAttribute(key, value);
            }
        });
    }

    // Handle events
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }

    // Handle children
    if (options.children) {
        options.children.forEach(child => {
            if (child instanceof Element) {
                element.appendChild(child);
            } else if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
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
 * SimpleDOMFieldBuilder class for compatibility - simple wrapper around createFormField.
 * Note: This is a legacy implementation that returns DocumentFragments.
 * For new code, use FormFieldBuilder from formBuilder.js which returns HTMLElements.
 */
export class SimpleDOMFieldBuilder {
    static createField(config) {
        return createFormField(config);
    }

    static createFields(fieldConfigs) {
        const builder = new DOMBuilder();
        fieldConfigs.forEach(config => {
            const fieldFragment = SimpleDOMFieldBuilder.createField(config);
            builder.addExisting(fieldFragment.firstElementChild);
        });
        return builder.build();
    }
}

// Legacy compatibility exports
export const createFragment = () => document.createDocumentFragment();
export const FormFieldBuilder = SimpleDOMFieldBuilder;

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

    addText(text) {
        const textNode = document.createTextNode(text);
        this.fragment.appendChild(textNode);
        return this;
    }

    addExisting(element) {
        this.fragment.appendChild(element);
        this.elements.push(element);
        return this;
    }

    build() {
        return this.fragment;
    }

    appendTo(parent) {
        // Standardized on cash-dom wrapped elements
        const parentElement = parent[0] || parent;
        parentElement.appendChild(this.fragment);
        return this.elements;
    }

    all() {
        return this.elements;
    }

    first() {
        return this.elements[0] || null;
    }

    last() {
        return this.elements[this.elements.length - 1] || null;
    }
}

export const DOMUtils = {
    clearChildren(element) {
        // Standardized on cash-dom wrapped elements
        const domElement = element[0] || element;
        while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
        }
    },

    replaceContent(element, content) {
        // Standardized on cash-dom wrapped elements
        const domElement = element[0] || element;
        this.clearChildren(domElement);

        if (content instanceof DocumentFragment) {
            domElement.appendChild(content);
        } else if (content instanceof Element) {
            domElement.appendChild(content);
        } else if (Array.isArray(content)) {
            const fragment = createFragment();
            content.forEach(item => {
                if (item instanceof Element) {
                    fragment.appendChild(item);
                } else if (typeof item === 'string') {
                    fragment.appendChild(document.createTextNode(item));
                }
            });
            domElement.appendChild(fragment);
        }
    },

    appendMultiple(parent, elements) {
        const builder = new DOMBuilder();
        elements.forEach(config => {
            if (typeof config === 'string') {
                builder.addElement('div', { text: config });
            } else {
                builder.addElement(config.tag || 'div', config.options || {});
            }
        });
        return builder.appendTo(parent);
    }
};
