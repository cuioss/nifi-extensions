/**
 * Simple DOM utilities - replaces 417 lines of over-engineered builder patterns.
 * For a simple form UI, we just need basic element creation helpers.
 */
'use strict';

/**
 * Apply CSS classes to element
 * @param {HTMLElement} element - The element
 * @param {Object} options - Options containing css/className
 */
const applyCssClasses = (element, options) => {
    if (options.css) {
        if (Array.isArray(options.css)) {
            element.classList.add(...options.css);
        } else if (typeof options.css === 'string') {
            element.className = options.css;
        }
    }
    if (options.className) {
        element.className = options.className;
    }
};

/**
 * Apply content to element
 * @param {HTMLElement} element - The element
 * @param {Object} options - Options containing text/html
 */
const applyContent = (element, options) => {
    if (options.text) {
        element.textContent = options.text;
    }
    if (options.html) {
        if (options.sanitized === true) {
            element.innerHTML = options.html;
        } else {
            element.textContent = options.html;
        }
    }
};

/**
 * Check if attribute is boolean type
 * @param {string} key - Attribute name
 * @returns {boolean} True if boolean attribute
 */
const isBooleanAttribute = (key) => {
    return key === 'disabled' || key === 'checked' || key === 'readonly' || key === 'required';
};

/**
 * Apply single attribute to element
 * @param {HTMLElement} element - The element
 * @param {string} key - Attribute name
 * @param {*} value - Attribute value
 */
const applyAttribute = (element, key, value) => {
    if (isBooleanAttribute(key)) {
        if (value === true || value === 'true' || value === '') {
            element.setAttribute(key, '');
        } else if (value !== false && value !== 'false' && value !== null && value !== undefined) {
            element.setAttribute(key, value);
        }
    } else {
        element.setAttribute(key, value);
    }
};

/**
 * Apply attributes to element
 * @param {HTMLElement} element - The element
 * @param {Object} options - Options containing attributes
 */
const applyAttributes = (element, options) => {
    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            applyAttribute(element, key, value);
        }
    }
};

/**
 * Apply event handlers to element
 * @param {HTMLElement} element - The element
 * @param {Object} options - Options containing events
 */
const applyEvents = (element, options) => {
    if (options.events) {
        for (const [event, handler] of Object.entries(options.events)) {
            element.addEventListener(event, handler);
        }
    }
};

/**
 * Apply children to element
 * @param {HTMLElement} element - The element
 * @param {Object} options - Options containing children
 */
const applyChildren = (element, options) => {
    if (options.children) {
        for (const child of options.children) {
            if (child instanceof Element) {
                element.appendChild(child);
            } else if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
        }
    }
};

/**
 * Simple element creation - replaces complex createElement patterns.
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement} Created element
 */
export const createElement = (tag, options = {}) => {
    const element = document.createElement(tag);

    applyCssClasses(element, options);
    applyContent(element, options);
    applyAttributes(element, options);
    applyEvents(element, options);
    applyChildren(element, options);

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
        for (const config of fieldConfigs) {
            const fieldFragment = SimpleDOMFieldBuilder.createField(config);
            builder.addExisting(fieldFragment.firstElementChild);
        }
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
            for (const item of content) {
                if (item instanceof Element) {
                    fragment.appendChild(item);
                } else if (typeof item === 'string') {
                    fragment.appendChild(document.createTextNode(item));
                }
            }
            domElement.appendChild(fragment);
        }
    },

    appendMultiple(parent, elements) {
        const builder = new DOMBuilder();
        for (const config of elements) {
            if (typeof config === 'string') {
                builder.addElement('div', { text: config });
            } else {
                builder.addElement(config.tag || 'div', config.options || {});
            }
        }
        return builder.appendTo(parent);
    }
};
