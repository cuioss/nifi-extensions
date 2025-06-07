/**
 * DOM Builder utility for efficient element creation and DocumentFragment batching.
 * This module provides optimized DOM construction patterns to improve performance.
 */
'use strict';


/**
 * Creates a DocumentFragment for efficient batching of DOM operations.
 * @returns {DocumentFragment} Empty document fragment
 */
export const createFragment = () => {
    return document.createDocumentFragment();
};

/**
 * Creates a DOM element with attributes, content, and event listeners.
 * @param {string} tagName - HTML tag name (e.g., 'div', 'span', 'button')
 * @param {Object} [options] - Element configuration options
 * @param {Object} [options.attributes] - HTML attributes to set
 * @param {Object} [options.css] - CSS classes to add
 * @param {string} [options.text] - Text content
 * @param {string} [options.html] - HTML content (use with caution)
 * @param {Object} [options.events] - Event listeners to attach
 * @param {Array} [options.children] - Child elements to append
 * @returns {HTMLElement} Created DOM element
 */
export const createElement = (tagName, options = {}) => {
    const element = document.createElement(tagName);

    // Set attributes
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    // Add CSS classes
    if (options.css) {
        if (Array.isArray(options.css)) {
            element.classList.add(...options.css);
        } else if (typeof options.css === 'string') {
            element.className = options.css;
        }
    }

    // Set content
    if (options.text) {
        element.textContent = options.text;
    } else if (options.html) {
        element.innerHTML = options.html;
    }

    // Attach event listeners
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }

    // Append children
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
 * Builder class for efficient DOM construction with method chaining.
 */
export class DOMBuilder {
    constructor() {
        this.fragment = createFragment();
        this.elements = [];
    }

    /**
     * Add an element to the builder.
     * @param {string} tagName - HTML tag name
     * @param {Object} [options] - Element options (same as createElement)
     * @returns {DOMBuilder} This builder instance for chaining
     */
    addElement(tagName, options = {}) {
        const element = createElement(tagName, options);
        this.fragment.appendChild(element);
        this.elements.push(element);
        return this;
    }

    /**
     * Add a text node to the builder.
     * @param {string} text - Text content
     * @returns {DOMBuilder} This builder instance for chaining
     */
    addText(text) {
        const textNode = document.createTextNode(text);
        this.fragment.appendChild(textNode);
        return this;
    }

    /**
     * Add an existing element to the builder.
     * @param {HTMLElement} element - Element to add
     * @returns {DOMBuilder} This builder instance for chaining
     */
    addExisting(element) {
        this.fragment.appendChild(element);
        this.elements.push(element);
        return this;
    }

    /**
     * Build and return the DocumentFragment.
     * @returns {DocumentFragment} The constructed fragment
     */
    build() {
        return this.fragment;
    }

    /**
     * Append the built fragment to a parent element.
     * @param {HTMLElement|Object} parent - Parent element (DOM element or cash-dom wrapped)
     * @returns {Array} Array of created elements
     */
    appendTo(parent) {
        const parentElement = parent instanceof Element ? parent : parent[0];
        parentElement.appendChild(this.fragment);
        return this.elements;
    }

    /**
     * Get the first created element.
     * @returns {HTMLElement|null} First element or null
     */
    first() {
        return this.elements[0] || null;
    }

    /**
     * Get the last created element.
     * @returns {HTMLElement|null} Last element or null
     */
    last() {
        return this.elements[this.elements.length - 1] || null;
    }

    /**
     * Get all created elements.
     * @returns {Array} Array of all created elements
     */
    all() {
        return this.elements;
    }
}

/**
 * Specialized builder for form field creation (optimized for issuerConfigEditor).
 */
export class FormFieldBuilder {
    /**
     * Create a complete form field with label, input, and description.
     * @param {Object} config - Field configuration
     * @param {string} config.name - Field name (used for CSS classes)
     * @param {string} config.label - Field label text
     * @param {string} config.description - Field description text
     * @param {string} [config.value] - Initial field value
     * @param {string} [config.type='text'] - Input type
     * @param {string} [config.placeholder] - Input placeholder
     * @returns {DocumentFragment} Complete field structure
     */
    static createField(config) {
        const {
            name,
            label,
            description,
            value = '',
            type = 'text',
            placeholder = description
        } = config;

        // Field container
        const fieldContainer = createElement('div', {
            css: 'form-field'
        });

        // Label
        const labelElement = createElement('label', {
            text: label + ':'
        });

        // Input
        const inputElement = createElement('input', {
            attributes: {
                type: type,
                placeholder: placeholder
            },
            css: `field-${name}`
        });

        if (value) {
            inputElement.value = value;
        }

        // Description
        const descElement = createElement('div', {
            css: 'field-description',
            text: description
        });

        // Assemble field
        fieldContainer.appendChild(labelElement);
        fieldContainer.appendChild(inputElement);
        fieldContainer.appendChild(descElement);

        const fragment = createFragment();
        fragment.appendChild(fieldContainer);

        return fragment;
    }

    /**
     * Create multiple form fields efficiently.
     * @param {Array} fieldConfigs - Array of field configuration objects
     * @returns {DocumentFragment} Fragment containing all fields
     */
    static createFields(fieldConfigs) {
        const builder = new DOMBuilder();

        fieldConfigs.forEach(config => {
            const fieldFragment = FormFieldBuilder.createField(config);
            builder.addExisting(fieldFragment.firstElementChild);
        });

        return builder.build();
    }
}

/**
 * Specialized builder for token details table (optimized for tokenVerifier).
 */
export class TokenTableBuilder {
    constructor() {
        this.builder = new DOMBuilder();
    }

    /**
     * Create a token details table structure.
     * @param {Object} tokenData - Token data object
     * @param {Object} i18n - Internationalization object
     * @param {boolean} [isSimulated=false] - Whether this is simulated data
     * @returns {DocumentFragment} Complete token details structure
     */
    static createTokenDetails(tokenData, i18n, isSimulated = false) {
        const builder = new DOMBuilder();

        // Main container
        builder.addElement('div', {
            css: 'token-valid',
            children: [
                createElement('span', { css: 'fa fa-check-circle' }),
                document.createTextNode(' ' + (i18n['processor.jwt.tokenValid'] || 'Token is valid')),
                ...(isSimulated ? [createElement('em', { text: ' (Simulated response)' })] : [])
            ]
        });

        // Details container
        const detailsContainer = createElement('div', { css: 'token-details' });

        // Details header
        detailsContainer.appendChild(createElement('h4', {
            text: i18n['processor.jwt.tokenDetails'] || 'Token Details'
        }));

        // Claims table
        const table = TokenTableBuilder._createClaimsTable(tokenData, i18n);
        detailsContainer.appendChild(table);

        // Raw claims section
        if (tokenData.claims) {
            detailsContainer.appendChild(createElement('h4', {
                text: i18n['processor.jwt.allClaims'] || 'All Claims'
            }));

            detailsContainer.appendChild(createElement('pre', {
                css: 'token-raw-claims',
                text: JSON.stringify(tokenData.claims, null, 2)
            }));
        }

        builder.addExisting(detailsContainer);

        return builder.build();
    }

    /**
     * Create the claims table structure.
     * @param {Object} tokenData - Token data
     * @param {Object} i18n - Internationalization object
     * @returns {HTMLElement} Table element
     * @private
     */
    static _createClaimsTable(tokenData, i18n) {
        const table = createElement('table', { css: 'token-claims-table' });
        const tbody = createElement('tbody');

        // Standard claims
        const claims = [
            { key: 'subject', label: i18n['processor.jwt.subject'] || 'Subject' },
            { key: 'issuer', label: i18n['processor.jwt.issuer'] || 'Issuer' },
            { key: 'audience', label: i18n['processor.jwt.audience'] || 'Audience' },
            { key: 'expiration', label: i18n['processor.jwt.expiration'] || 'Expiration' }
        ];

        claims.forEach(claim => {
            const row = createElement('tr');
            row.appendChild(createElement('th', { text: claim.label }));
            row.appendChild(createElement('td', { text: tokenData[claim.key] || '' }));
            tbody.appendChild(row);
        });

        // Additional claims (roles, scopes)
        if (tokenData.roles && tokenData.roles.length > 0) {
            const rolesRow = createElement('tr');
            rolesRow.appendChild(createElement('th', {
                text: i18n['processor.jwt.roles'] || 'Roles'
            }));
            rolesRow.appendChild(createElement('td', {
                text: tokenData.roles.join(', ')
            }));
            tbody.appendChild(rolesRow);
        }

        if (tokenData.scopes && tokenData.scopes.length > 0) {
            const scopesRow = createElement('tr');
            scopesRow.appendChild(createElement('th', {
                text: i18n['processor.jwt.scopes'] || 'Scopes'
            }));
            scopesRow.appendChild(createElement('td', {
                text: tokenData.scopes.join(' ')
            }));
            tbody.appendChild(scopesRow);
        }

        table.appendChild(tbody);
        return table;
    }
}

/**
 * Utility functions for common DOM operations.
 */
export const DOMUtils = {
    /**
     * Efficiently clear all children from an element.
     * @param {HTMLElement|Object} element - Element to clear (DOM or cash-dom)
     */
    clearChildren(element) {
        const domElement = element instanceof Element ? element : element[0];
        while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
        }
    },

    /**
     * Replace element content with new content using DocumentFragment.
     * @param {HTMLElement|Object} element - Target element
     * @param {DocumentFragment|HTMLElement|Array} content - New content
     */
    replaceContent(element, content) {
        const domElement = element instanceof Element ? element : element[0];
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

    /**
     * Create and append multiple elements efficiently.
     * @param {HTMLElement|Object} parent - Parent element
     * @param {Array} elements - Array of element configurations
     * @returns {Array} Array of created elements
     */
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
