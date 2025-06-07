/**
 * Component Cleanup Manager for preventing memory leaks and managing resource cleanup.
 * This module provides utilities for tracking and cleaning up resources like event listeners,
 * timeouts, intervals, and AJAX requests to prevent memory leaks.
 */
'use strict';

/**
 * Component cleanup registry to track resources that need cleanup.
 * Maps component IDs to their cleanup functions.
 * @type {Map<string, Set<Function>>}
 */
const cleanupRegistry = new Map();

/**
 * Active timeout registry for timeout cleanup.
 * @type {Map<string, Set<number>>}
 */
const timeoutRegistry = new Map();

/**
 * Active interval registry for interval cleanup.
 * @type {Map<string, Set<number>>}
 */
const intervalRegistry = new Map();

/**
 * Active AJAX request registry for request cleanup.
 * @type {Map<string, Set<Object>>}
 */
const ajaxRegistry = new Map();

/**
 * Register a component for cleanup tracking.
 * @param {string} componentId - Unique identifier for the component
 */
export const registerComponent = (componentId) => {
    if (!cleanupRegistry.has(componentId)) {
        cleanupRegistry.set(componentId, new Set());
        timeoutRegistry.set(componentId, new Set());
        intervalRegistry.set(componentId, new Set());
        ajaxRegistry.set(componentId, new Set());
    }
};

/**
 * Add a cleanup function for a component.
 * @param {string} componentId - Component identifier
 * @param {Function} cleanupFn - Function to call during cleanup
 */
export const addCleanupFunction = (componentId, cleanupFn) => {
    registerComponent(componentId);
    cleanupRegistry.get(componentId).add(cleanupFn);
};

/**
 * Register a timeout for automatic cleanup.
 * @param {string} componentId - Component identifier
 * @param {number} timeoutId - Timeout ID returned by setTimeout
 */
export const registerTimeout = (componentId, timeoutId) => {
    registerComponent(componentId);
    timeoutRegistry.get(componentId).add(timeoutId);
};

/**
 * Register an interval for automatic cleanup.
 * @param {string} componentId - Component identifier
 * @param {number} intervalId - Interval ID returned by setInterval
 */
export const registerInterval = (componentId, intervalId) => {
    registerComponent(componentId);
    intervalRegistry.get(componentId).add(intervalId);
};

/**
 * Register an AJAX request for automatic cleanup.
 * @param {string} componentId - Component identifier
 * @param {Object} jqXHR - jQuery XHR object with abort method
 */
export const registerAjaxRequest = (componentId, jqXHR) => {
    registerComponent(componentId);
    ajaxRegistry.get(componentId).add(jqXHR);
};

/**
 * Unregister a timeout (when it completes naturally).
 * @param {string} componentId - Component identifier
 * @param {number} timeoutId - Timeout ID to unregister
 */
export const unregisterTimeout = (componentId, timeoutId) => {
    if (timeoutRegistry.has(componentId)) {
        timeoutRegistry.get(componentId).delete(timeoutId);
    }
};

/**
 * Unregister an interval (when it's cleared naturally).
 * @param {string} componentId - Component identifier
 * @param {number} intervalId - Interval ID to unregister
 */
export const unregisterInterval = (componentId, intervalId) => {
    if (intervalRegistry.has(componentId)) {
        intervalRegistry.get(componentId).delete(intervalId);
    }
};

/**
 * Unregister an AJAX request (when it completes naturally).
 * @param {string} componentId - Component identifier
 * @param {Object} jqXHR - jQuery XHR object to unregister
 */
export const unregisterAjaxRequest = (componentId, jqXHR) => {
    if (ajaxRegistry.has(componentId)) {
        ajaxRegistry.get(componentId).delete(jqXHR);
    }
};

/**
 * Clean up all resources for a specific component.
 * @param {string} componentId - Component identifier
 */
export const cleanupComponent = (componentId) => {
    // Clear timeouts
    if (timeoutRegistry.has(componentId)) {
        timeoutRegistry.get(componentId).forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        timeoutRegistry.get(componentId).clear();
    }

    // Clear intervals
    if (intervalRegistry.has(componentId)) {
        intervalRegistry.get(componentId).forEach(intervalId => {
            clearInterval(intervalId);
        });
        intervalRegistry.get(componentId).clear();
    }

    // Abort AJAX requests
    if (ajaxRegistry.has(componentId)) {
        ajaxRegistry.get(componentId).forEach(jqXHR => {
            if (jqXHR && typeof jqXHR.abort === 'function') {
                try {
                    jqXHR.abort();
                } catch (e) {
                    // Ignore abort errors - request might already be complete
                }
            }
        });
        ajaxRegistry.get(componentId).clear();
    }

    // Execute custom cleanup functions
    if (cleanupRegistry.has(componentId)) {
        cleanupRegistry.get(componentId).forEach(cleanupFn => {
            try {
                cleanupFn();
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Error during component cleanup:', e);
            }
        });
        cleanupRegistry.get(componentId).clear();
    }

    // Remove component from registries
    cleanupRegistry.delete(componentId);
    timeoutRegistry.delete(componentId);
    intervalRegistry.delete(componentId);
    ajaxRegistry.delete(componentId);
};

/**
 * Clean up all components and resources.
 * This should be called when the entire application is being unloaded.
 */
export const cleanupAll = () => {
    const componentIds = Array.from(cleanupRegistry.keys());
    componentIds.forEach(componentId => {
        cleanupComponent(componentId);
    });
};

/**
 * Wrapper for setTimeout that automatically registers for cleanup.
 * @param {string} componentId - Component identifier
 * @param {Function} callback - Function to execute
 * @param {number} delay - Delay in milliseconds
 * @returns {number} Timeout ID
 */
export const managedSetTimeout = (componentId, callback, delay) => {
    const timeoutId = setTimeout(() => {
        unregisterTimeout(componentId, timeoutId);
        callback();
    }, delay);

    registerTimeout(componentId, timeoutId);
    return timeoutId;
};

/**
 * Wrapper for setInterval that automatically registers for cleanup.
 * @param {string} componentId - Component identifier
 * @param {Function} callback - Function to execute
 * @param {number} interval - Interval in milliseconds
 * @returns {number} Interval ID
 */
export const managedSetInterval = (componentId, callback, interval) => {
    const intervalId = setInterval(callback, interval);
    registerInterval(componentId, intervalId);
    return intervalId;
};

/**
 * Enhanced event listener helper that tracks listeners for cleanup.
 */
export class ManagedEventListener {
    constructor(componentId) {
        this.componentId = componentId;
        this.listeners = new Map(); // element -> Set of {event, handler, options}
        registerComponent(componentId);

        // Register cleanup function for this listener manager
        addCleanupFunction(componentId, () => this.removeAllListeners());
    }

    /**
     * Add an event listener with automatic cleanup tracking.
     * @param {Element|Object} element - DOM element or cash-dom wrapped element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} [options] - Event listener options
     */
    addEventListener(element, event, handler, options = {}) {
        const domElement = element instanceof Element ? element : element[0];

        if (!domElement) {
            throw new Error('Invalid element provided to addEventListener');
        }

        if (!this.listeners.has(domElement)) {
            this.listeners.set(domElement, new Set());
        }

        const listenerInfo = { event, handler, options };
        this.listeners.get(domElement).add(listenerInfo);

        domElement.addEventListener(event, handler, options);
    }

    /**
     * Remove a specific event listener.
     * @param {Element|Object} element - DOM element or cash-dom wrapped element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} [options] - Event listener options
     */
    removeEventListener(element, event, handler, options = {}) {
        const domElement = element instanceof Element ? element : element[0];

        if (!domElement || !this.listeners.has(domElement)) {
            return;
        }

        const elementListeners = this.listeners.get(domElement);
        const listenerToRemove = Array.from(elementListeners).find(
            listener => listener.event === event &&
                       listener.handler === handler &&
                       listener.options === options
        );

        if (listenerToRemove) {
            elementListeners.delete(listenerToRemove);
            domElement.removeEventListener(event, handler, options);

            // Clean up empty sets
            if (elementListeners.size === 0) {
                this.listeners.delete(domElement);
            }
        }
    }

    /**
     * Remove all event listeners for this component.
     */
    removeAllListeners() {
        this.listeners.forEach((elementListeners, domElement) => {
            elementListeners.forEach(({ event, handler, options }) => {
                try {
                    domElement.removeEventListener(event, handler, options);
                } catch (e) {
                    // Ignore errors - element might be removed from DOM
                }
            });
        });
        this.listeners.clear();
    }

    /**
     * Get the number of active listeners (for debugging).
     * @returns {number} Number of active event listeners
     */
    getListenerCount() {
        let count = 0;
        this.listeners.forEach(elementListeners => {
            count += elementListeners.size;
        });
        return count;
    }
}

/**
 * Component lifecycle manager that handles initialization and cleanup.
 */
export class ComponentLifecycle {
    constructor(componentId) {
        this.componentId = componentId;
        this.isInitialized = false;
        this.isDestroyed = false;
        this.eventManager = new ManagedEventListener(componentId);

        registerComponent(componentId);
    }

    /**
     * Initialize the component.
     * @param {Function} initFn - Initialization function
     * @returns {Promise} Promise that resolves when initialization is complete
     */
    async initialize(initFn) {
        if (this.isInitialized || this.isDestroyed) {
            throw new Error(`Component ${this.componentId} is already initialized or destroyed`);
        }

        try {
            await initFn(this);
            this.isInitialized = true;
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    /**
     * Destroy the component and clean up all resources.
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        this.isInitialized = false;

        cleanupComponent(this.componentId);
    }

    /**
     * Add a timeout with automatic cleanup.
     * @param {Function} callback - Function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Timeout ID
     */
    setTimeout(callback, delay) {
        return managedSetTimeout(this.componentId, callback, delay);
    }

    /**
     * Add an interval with automatic cleanup.
     * @param {Function} callback - Function to execute
     * @param {number} interval - Interval in milliseconds
     * @returns {number} Interval ID
     */
    setInterval(callback, interval) {
        return managedSetInterval(this.componentId, callback, interval);
    }

    /**
     * Add an event listener with automatic cleanup.
     * @param {Element|Object} element - DOM element or cash-dom wrapped element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} [options] - Event listener options
     */
    addEventListener(element, event, handler, options = {}) {
        this.eventManager.addEventListener(element, event, handler, options);
    }

    /**
     * Get the managed event listener instance.
     * @returns {ManagedEventListener} Event listener manager
     */
    getEventManager() {
        return this.eventManager;
    }

    /**
     * Check if component is initialized.
     * @returns {boolean} True if initialized
     */
    isComponentInitialized() {
        return this.isInitialized && !this.isDestroyed;
    }
}

// Global cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        cleanupAll();
    });
}
