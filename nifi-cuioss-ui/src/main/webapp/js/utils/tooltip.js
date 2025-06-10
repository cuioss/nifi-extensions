/**
 * Tooltip utility module for NiFi CUIOSS UI components.
 *
 * This module provides a wrapper around tippy.js for creating tooltips
 * with consistent styling and behavior throughout the application.
 *
 * @fileoverview Tooltip initialization and management utilities
 * @module utils/tooltip
 * @requires tippy.js
 * @requires nf.Common
 */
import tippy from 'tippy.js';
import * as nfCommon from 'nf.Common';
// Note: CSS files for tippy.js should be included in the main HTML or via separate CSS build process

/**
 * Initializes tooltips on the specified elements with configurable options.
 *
 * @param {string|Element|Element[]|NodeList} selector - CSS selector string, DOM element, or array of elements
 * @param {Object} [options={}] - Tippy.js configuration options
 * @param {Document|Element} [context=document] - DOM context for selector query
 * @returns {Object|null} Tippy instance or null if initialization failed
 *
 * @example
 * // Initialize tooltips on all elements with title attribute
 * initTooltips('[title]');
 *
 * // Initialize tooltips with custom options
 * initTooltips('.help-icon', { placement: 'right', theme: 'dark' });
 */
export function initTooltips(selector, options = {}, context = document) {
    // Handle null and undefined selectors early
    if (selector == null) {
        return null;
    }

    let elements;
    if (typeof selector === 'string') {
        elements = context.querySelectorAll(selector);
    } else if (Array.isArray(selector)) {
        elements = selector;
    } else {
        elements = [selector];
    }

    if (elements.length === 0) return null;

    // Default options similar to our jQuery UI tooltip config
    const defaultOptions = {
        placement: 'bottom-start', // Similar to our jQuery UI positioning
        arrow: true,
        theme: 'light-border',
        appendTo: 'parent' // Attaches tooltip to parent instead of document.body
    };

    // Merge default options with provided options
    const tippyOptions = { ...defaultOptions, ...options };

    try {
        return tippy(Array.from(elements), tippyOptions);
    } catch (error) {
        // Log error if Tippy.js initialization fails.
        nfCommon?.logError?.('Error initializing tooltip: ' + error.message);
        // It's important to return null or an empty instance array if tippy fails,
        // consistent with tippy's behavior on empty selectors.
        return null;
    }
}
