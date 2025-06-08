/**
 * Simple cleanup utilities - replaces 412 lines of over-engineered resource tracking.
 * For a simple form UI, we just need basic timeout management.
 */
'use strict';

// Simple global timeout tracking
const activeTimeouts = new Set();
const activeIntervals = new Set();

/**
 * Simple managed timeout that tracks itself for cleanup.
 * @param {string} componentId - Component identifier (kept for API compatibility)
 * @param {Function} callback - Function to call
 * @param {number} delay - Delay in milliseconds
 * @returns {number} Timeout ID
 */
export const managedSetTimeout = (componentId, callback, delay) => {
    const timeoutId = setTimeout(() => {
        activeTimeouts.delete(timeoutId);
        callback();
    }, delay);

    activeTimeouts.add(timeoutId);
    return timeoutId;
};

/**
 * Simple managed interval that tracks itself for cleanup.
 * @param {string} componentId - Component identifier (kept for API compatibility)
 * @param {Function} callback - Function to call
 * @param {number} delay - Delay in milliseconds
 * @returns {number} Interval ID
 */
export const managedSetInterval = (componentId, callback, delay) => {
    const intervalId = setInterval(callback, delay);
    activeIntervals.add(intervalId);
    return intervalId;
};

/**
 * Simple component lifecycle class - replaces complex state management.
 */
export class ComponentLifecycle {
    constructor(componentId) {
        this.componentId = componentId;
        this.initialized = false;
        this.timeouts = new Set();
    }

    /**
     * Initialize the component.
     * @param {Function} initFn - Initialization function
     */
    async initialize(initFn) {
        try {
            if (initFn) {
                await initFn();
            }
            this.initialized = true;
        } catch (error) {
            console.error(`Component ${this.componentId} initialization failed:`, error);
        }
    }

    /**
     * Check if component is initialized.
     * @returns {boolean} True if initialized
     */
    isComponentInitialized() {
        return this.initialized;
    }

    /**
     * Set a timeout with automatic cleanup.
     * @param {Function} callback - Function to call
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Timeout ID
     */
    setTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(timeoutId);
            callback();
        }, delay);

        this.timeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Destroy the component and clean up resources.
     */
    destroy() {
        // Clear all timeouts for this component
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
        this.initialized = false;
    }
}

/**
 * Clean up all global resources.
 */
const cleanupAllResources = () => {
    activeTimeouts.forEach(clearTimeout);
    activeIntervals.forEach(clearInterval);
    activeTimeouts.clear();
    activeIntervals.clear();
};

// Legacy API compatibility - minimal implementation for existing tests
const componentCleanupFunctions = new Map();

export const registerComponent = (componentId) => {
    if (!componentCleanupFunctions.has(componentId)) {
        componentCleanupFunctions.set(componentId, new Set());
    }
};

export const addCleanupFunction = (componentId, cleanupFn) => {
    if (!componentCleanupFunctions.has(componentId)) {
        componentCleanupFunctions.set(componentId, new Set());
    }
    componentCleanupFunctions.get(componentId).add(cleanupFn);
};

export const cleanupComponent = (componentId) => {
    const cleanupFns = componentCleanupFunctions.get(componentId);
    if (cleanupFns) {
        cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (error) {
                console.debug('Cleanup function failed:', error);
            }
        });
        cleanupFns.clear();
    }
};

export const cleanupAll = () => {
    // Clean up timers
    cleanupAllResources();

    // Clean up legacy component cleanup functions
    componentCleanupFunctions.forEach((cleanupFns) => {
        cleanupFns.forEach(fn => {
            try {
                fn();
            } catch (error) {
                console.debug('Cleanup function failed:', error);
            }
        });
        cleanupFns.clear();
    });
    componentCleanupFunctions.clear();
};
