/**
 * DOM Element Caching utility for efficient element reuse and performance optimization.
 * This module provides centralized element caching to reduce redundant DOM queries.
 */
'use strict';

import $ from 'cash-dom';

/**
 * Internal cache storage for DOM elements.
 * @type {Map<string, Object>}
 */
const elementCache = new Map();

/**
 * Internal cache for component-specific elements.
 * @type {Map<string, Map<string, Object>>}
 */
const componentCache = new Map();

/**
 * Cache a DOM element with a unique key.
 * @param {string} key - Unique identifier for the cached element
 * @param {string|Function} selector - CSS selector string or function that returns an element
 * @param {Object} [context] - Context element to search within (optional)
 * @returns {Object} The cached cash-dom wrapped element
 */
export const cacheElement = (key, selector, context = null) => {
    if (elementCache.has(key)) {
        return elementCache.get(key);
    }

    let $element;
    if (typeof selector === 'function') {
        $element = selector();
    } else if (context) {
        $element = $(context).find(selector);
    } else {
        $element = $(selector);
    }

    // Only cache if element exists
    if ($element && $element.length > 0) {
        elementCache.set(key, $element);
    }

    return $element;
};

/**
 * Get a cached element by key, with optional fallback selector.
 * @param {string} key - Unique identifier for the cached element
 * @param {string} [fallbackSelector] - Fallback selector if not cached
 * @param {Object} [context] - Context element for fallback search
 * @returns {Object|null} The cached cash-dom wrapped element or null
 */
export const getCachedElement = (key, fallbackSelector = null, context = null) => {
    if (elementCache.has(key)) {
        const $element = elementCache.get(key);
        // Verify element still exists in DOM
        if ($element.length > 0 && document.contains($element[0])) {
            return $element;
        } else {
            // Element was removed from DOM, clear from cache
            elementCache.delete(key);
        }
    }

    // Try fallback selector if provided
    if (fallbackSelector) {
        return cacheElement(key, fallbackSelector, context);
    }

    return null;
};

/**
 * Cache elements specific to a component instance.
 * @param {string} componentId - Unique identifier for the component
 * @param {string} elementKey - Key for the specific element within the component
 * @param {string|Function} selector - CSS selector or function
 * @param {Object} [context] - Context element to search within
 * @returns {Object} The cached cash-dom wrapped element
 */
export const cacheComponentElement = (componentId, elementKey, selector, context = null) => {
    if (!componentCache.has(componentId)) {
        componentCache.set(componentId, new Map());
    }

    const cache = componentCache.get(componentId);

    if (cache.has(elementKey)) {
        return cache.get(elementKey);
    }

    let $element;
    if (typeof selector === 'function') {
        $element = selector();
    } else if (context) {
        $element = $(context).find(selector);
    } else {
        $element = $(selector);
    }

    if ($element && $element.length > 0) {
        cache.set(elementKey, $element);
    }

    return $element;
};

/**
 * Get a cached component element.
 * @param {string} componentId - Component identifier
 * @param {string} elementKey - Element key within the component
 * @param {string} [fallbackSelector] - Fallback selector if not cached
 * @param {Object} [context] - Context for fallback search
 * @returns {Object|null} The cached element or null
 */
export const getComponentElement = (componentId, elementKey,
    fallbackSelector = null, context = null) => {
    if (componentCache.has(componentId)) {
        const cache = componentCache.get(componentId);
        if (cache.has(elementKey)) {
            const $element = cache.get(elementKey);
            // Verify element still exists in DOM
            if ($element.length > 0 && document.contains($element[0])) {
                return $element;
            } else {
                // Element was removed, clear from cache
                cache.delete(elementKey);
            }
        }
    }

    // Try fallback
    if (fallbackSelector) {
        return cacheComponentElement(componentId, elementKey, fallbackSelector, context);
    }

    return null;
};

/**
 * Clear cached element by key.
 * @param {string} key - Key of the element to clear
 */
export const clearCachedElement = (key) => {
    elementCache.delete(key);
};

/**
 * Clear all cached elements for a component.
 * @param {string} componentId - Component identifier
 */
export const clearComponentCache = (componentId) => {
    componentCache.delete(componentId);
};

/**
 * Clear all cached elements.
 */
export const clearAllCache = () => {
    elementCache.clear();
    componentCache.clear();
};

/**
 * Utility class for managing form field caching in issuerConfigEditor.
 */
export class FormFieldCache {
    constructor($form) {
        this.$form = $form;
        this.fieldCache = new Map();
    }

    /**
     * Get a cached form field element.
     * @param {string} fieldName - Name of the field (e.g., 'issuer', 'jwks-url')
     * @returns {Object} Cash-dom wrapped field element
     */
    getField(fieldName) {
        if (this.fieldCache.has(fieldName)) {
            return this.fieldCache.get(fieldName);
        }

        const $field = this.$form.find(`.field-${fieldName}`);
        if ($field.length > 0) {
            this.fieldCache.set(fieldName, $field);
        }

        return $field;
    }

    /**
     * Get the issuer name field.
     * @returns {Object} Cash-dom wrapped issuer name field
     */
    getIssuerName() {
        if (this.fieldCache.has('issuer-name')) {
            return this.fieldCache.get('issuer-name');
        }

        const $field = this.$form.find('.issuer-name');
        if ($field.length > 0) {
            this.fieldCache.set('issuer-name', $field);
        }

        return $field;
    }

    /**
     * Extract all form field values using cached elements.
     * @returns {Object} Object containing all form field values
     */
    extractValues() {
        return {
            issuerName: this._extractFieldValue(this.getIssuerName()),
            issuer: this._extractFieldValue(this.getField('issuer')),
            'jwks-url': this._extractFieldValue(this.getField('jwks-url')),
            audience: this._extractFieldValue(this.getField('audience')),
            'client-id': this._extractFieldValue(this.getField('client-id'))
        };
    }

    /**
     * Extract value from a field element safely.
     * @param {Object} $field - Cash-dom wrapped field element
     * @returns {string} Trimmed value or empty string
     * @private
     */
    _extractFieldValue($field) {
        return $field && $field[0] && $field[0].value ? $field[0].value.trim() : '';
    }

    /**
     * Clear the field cache.
     */
    clear() {
        this.fieldCache.clear();
    }
}

/**
 * Global element cache for commonly accessed elements across components.
 */
export const GlobalElementCache = {
    /**
     * Get the global error messages container.
     * @returns {Object|null} Cash-dom wrapped error container or null
     */
    getGlobalErrorContainer() {
        return getCachedElement('global-error-messages', '.global-error-messages');
    },

    /**
     * Get the main application container.
     * @returns {Object|null} Cash-dom wrapped main container or null
     */
    getMainContainer() {
        return getCachedElement('main-container', '.main-container, body');
    },

    /**
     * Clear global element cache.
     */
    clear() {
        clearCachedElement('global-error-messages');
        clearCachedElement('main-container');
    }
};
