/**
 * ComponentManager - Centralized component initialization and lifecycle management.
 * Provides standardized initialization patterns and replaces global state management.
 */
import { managedSetTimeout } from './componentCleanup.js';
import { createLogger } from './logger.js';

const logger = createLogger('ComponentManager');

/**
 * Component registration states
 */
const COMPONENT_STATES = {
    UNREGISTERED: 'unregistered',
    REGISTERING: 'registering',
    REGISTERED: 'registered',
    ERROR: 'error'
};

/**
 * ComponentManager class for managing component lifecycle and initialization.
 */
export class ComponentManager {
    constructor() {
        this.registeredComponents = new Map();
        this.initializationPromises = new Map();
        this.errorHandlers = [];
        this.globalState = {
            nifiReady: false,
            domReady: false,
            componentsInitialized: false
        };
    }

    /**
     * Registers a component with the manager.
     * @param {string} componentId - Unique identifier for the component
     * @param {object} component - The component module with init function
     * @param {object} options - Component registration options
     * @returns {Promise<boolean>} True if registration was successful
     */
    async registerComponent(componentId, component, options = {}) {
        if (this.registeredComponents.has(componentId)) {
            logger.debug(`Component ${componentId} already registered`);
            return true;
        }

        const componentInfo = {
            id: componentId,
            component,
            options: {
                retryCount: 3,
                retryDelay: 1000,
                timeout: 10000,
                requiresNifi: true,
                requiresDOM: true,
                ...options
            },
            state: COMPONENT_STATES.UNREGISTERED,
            registrationTime: null,
            lastError: null,
            retryAttempts: 0
        };

        this.registeredComponents.set(componentId, componentInfo);

        try {
            await this._initializeComponent(componentInfo);
            return true;
        } catch (error) {
            componentInfo.state = COMPONENT_STATES.ERROR;
            componentInfo.lastError = error;
            this._notifyErrorHandlers(componentId, error);
            return false;
        }
    }

    /**
     * Initializes a component with proper error handling and retry logic.
     * @param {object} componentInfo - Component information object
     * @returns {Promise<void>}
     * @private
     */
    async _initializeComponent(componentInfo) {
        const { id, options } = componentInfo;

        // Check prerequisites
        if (options.requiresNifi && !this.globalState.nifiReady) {
            await this._waitForNifiReady();
        }

        if (options.requiresDOM && !this.globalState.domReady) {
            await this._waitForDOMReady();
        }

        componentInfo.state = COMPONENT_STATES.REGISTERING;

        const initPromise = this._executeWithTimeout(
            () => this._tryInitializeWithRetry(componentInfo),
            options.timeout
        );

        this.initializationPromises.set(id, initPromise);

        try {
            await initPromise;
            componentInfo.state = COMPONENT_STATES.REGISTERED;
            componentInfo.registrationTime = Date.now();
            logger.debug(`Component ${id} initialized successfully`);
        } finally {
            this.initializationPromises.delete(id);
        }
    }

    /**
     * Attempts to initialize a component with retry logic.
     * @param {object} componentInfo - Component information object
     * @returns {Promise<void>}
     * @private
     */
    async _tryInitializeWithRetry(componentInfo) {
        const { id, options } = componentInfo;
        let lastError;

        for (let attempt = 0; attempt <= options.retryCount; attempt++) {
            try {
                componentInfo.retryAttempts = attempt;

                if (typeof componentInfo.component.init === 'function') {
                    await componentInfo.component.init();
                } else {
                    throw new Error(`Component ${id} does not have an init function`);
                }

                return; // Success
            } catch (error) {
                lastError = error;
                logger.warn(
                    `Component ${id} initialization attempt ${attempt + 1} failed:`,
                    error
                );

                if (attempt < options.retryCount) {
                    await this._delay(options.retryDelay * (attempt + 1)); // Exponential backoff
                }
            }
        }

        // eslint-disable-next-line max-len
        throw new Error(`Component ${id} failed to initialize after ${options.retryCount + 1} attempts. Last error: ${lastError.message}`);
    }

    /**
     * Executes a function with a timeout.
     * @param {Function} fn - Function to execute
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<any>}
     * @private
     */
    _executeWithTimeout(fn, timeout) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => {
                managedSetTimeout('component-manager', () => {
                    reject(new Error(`Operation timed out after ${timeout}ms`));
                }, timeout);
            })
        ]);
    }

    /**
     * Waits for NiFi to be ready.
     * @returns {Promise<void>}
     * @private
     */
    _waitForNifiReady() {
        if (this.globalState.nifiReady) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const checkNifiReady = () => {
                // In test environments, skip NiFi readiness check
                // eslint-disable-next-line no-undef
                if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
                    this.globalState.nifiReady = true;
                    resolve();
                    return;
                }

                if (typeof nf !== 'undefined' && nf?.Canvas?.initialized) {
                    this.globalState.nifiReady = true;
                    resolve();
                } else {
                    const handler = () => {
                        this.globalState.nifiReady = true;
                        document.removeEventListener('nfCanvasInitialized', handler);
                        resolve();
                    };
                    document.addEventListener('nfCanvasInitialized', handler);
                }
            };

            checkNifiReady();
        });
    }

    /**
     * Waits for DOM to be ready.
     * @returns {Promise<void>}
     * @private
     */
    _waitForDOMReady() {
        if (this.globalState.domReady) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            // In test environments, DOM is typically already ready
            // eslint-disable-next-line no-undef
            if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
                this.globalState.domReady = true;
                resolve();
                return;
            }

            if (document.readyState === 'loading') {
                const handler = () => {
                    this.globalState.domReady = true;
                    document.removeEventListener('DOMContentLoaded', handler);
                    resolve();
                };
                document.addEventListener('DOMContentLoaded', handler);
            } else {
                this.globalState.domReady = true;
                resolve();
            }
        });
    }

    /**
     * Creates a delay promise.
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => {
            managedSetTimeout('component-manager', resolve, ms);
        });
    }

    /**
     * Gets the current state of a component.
     * @param {string} componentId - Component identifier
     * @returns {string|null} Component state or null if not found
     */
    getComponentState(componentId) {
        const componentInfo = this.registeredComponents.get(componentId);
        return componentInfo ? componentInfo.state : null;
    }

    /**
     * Gets detailed information about a component.
     * @param {string} componentId - Component identifier
     * @returns {object|null} Component information or null if not found
     */
    getComponentInfo(componentId) {
        const componentInfo = this.registeredComponents.get(componentId);
        if (!componentInfo) return null;

        return {
            id: componentInfo.id,
            state: componentInfo.state,
            registrationTime: componentInfo.registrationTime,
            lastError: componentInfo.lastError,
            retryAttempts: componentInfo.retryAttempts,
            options: { ...componentInfo.options }
        };
    }

    /**
     * Checks if a component is registered and ready.
     * @param {string} componentId - Component identifier
     * @returns {boolean} True if component is registered and ready
     */
    isComponentReady(componentId) {
        return this.getComponentState(componentId) === COMPONENT_STATES.REGISTERED;
    }

    /**
     * Gets all registered components and their states.
     * @returns {Array<object>} Array of component information objects
     */
    getAllComponents() {
        return Array.from(this.registeredComponents.values()).map(info =>
            this.getComponentInfo(info.id)
        );
    }

    /**
     * Adds an error handler for component initialization failures.
     * @param {Function} handler - Error handler function (componentId, error) => void
     */
    addErrorHandler(handler) {
        if (typeof handler === 'function') {
            this.errorHandlers.push(handler);
        }
    }

    /**
     * Removes an error handler.
     * @param {Function} handler - Error handler function to remove
     */
    removeErrorHandler(handler) {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1) {
            this.errorHandlers.splice(index, 1);
        }
    }

    /**
     * Notifies all error handlers about a component error.
     * @param {string} componentId - Component identifier
     * @param {Error} error - The error that occurred
     * @private
     */
    _notifyErrorHandlers(componentId, error) {
        this.errorHandlers.forEach(handler => {
            try {
                handler(componentId, error);
            } catch (handlerError) {
                logger.error('Error in component error handler:', handlerError);
            }
        });
    }

    /**
     * Waits for all registered components to be ready.
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<boolean>} True if all components are ready, false if timeout
     */
    async waitForAllComponents(timeout = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const allReady = Array.from(this.registeredComponents.values())
                .every(info => info.state === COMPONENT_STATES.REGISTERED);

            if (allReady) {
                this.globalState.componentsInitialized = true;
                return true;
            }

            await this._delay(100); // Check every 100ms
        }

        return false;
    }

    /**
     * Unregisters a component and cleans up its resources.
     * @param {string} componentId - Component identifier
     * @returns {boolean} True if component was unregistered
     */
    unregisterComponent(componentId) {
        const componentInfo = this.registeredComponents.get(componentId);
        if (!componentInfo) {
            return false;
        }

        // Cancel any pending initialization
        const initPromise = this.initializationPromises.get(componentId);
        if (initPromise) {
            this.initializationPromises.delete(componentId);
        }

        // Call cleanup if available
        if (componentInfo.component && typeof componentInfo.component.cleanup === 'function') {
            try {
                componentInfo.component.cleanup();
            } catch (error) {
                logger.warn(`Error during cleanup of component ${componentId}:`, error);
            }
        }

        this.registeredComponents.delete(componentId);
        logger.debug(`Component ${componentId} unregistered`);
        return true;
    }

    /**
     * Cleans up all components and resets the manager.
     */
    cleanup() {
        // Clean up all components
        for (const componentId of this.registeredComponents.keys()) {
            this.unregisterComponent(componentId);
        }

        // Clear error handlers
        this.errorHandlers.length = 0;

        // Reset global state
        this.globalState = {
            nifiReady: false,
            domReady: false,
            componentsInitialized: false
        };
    }
}

// Global instance for the application
export const componentManager = new ComponentManager();

// Add default error handler
componentManager.addErrorHandler((componentId, error) => {
    logger.error(`Component ${componentId} initialization failed:`, error);
});

export { COMPONENT_STATES };
