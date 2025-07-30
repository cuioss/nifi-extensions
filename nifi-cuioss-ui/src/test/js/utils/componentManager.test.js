/**
 * Comprehensive tests for ComponentManager - targeting improved coverage
 */
import { COMPONENT_STATES, ComponentManager } from '../../../main/webapp/js/utils/componentManager.js';

// Mock componentCleanup with simple implementation
jest.mock('../../../main/webapp/js/utils/componentCleanup.js', () => ({
    managedSetTimeout: jest.fn((key, callback, delay) => {
        // For delay operations, use real setTimeout with small delays
        if (delay && delay > 0) {
            return setTimeout(callback, Math.min(delay, 10));
        }
        // For timeout operations, execute immediately
        setTimeout(callback, 0);
        return 123;
    })
}));

describe('ComponentManager - Comprehensive Coverage Tests', () => {
    let componentManager;

    beforeEach(() => {
        componentManager = new ComponentManager();
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        componentManager.cleanup();
        jest.clearAllMocks();
    });

    describe('basic functionality', () => {
        it('should register component successfully', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            const result = await componentManager.registerComponent('test', mockComponent);
            expect(result).toBe(true);
            expect(componentManager.getComponentState('test')).toBe(COMPONENT_STATES.REGISTERED);
        });

        it('should not register same component twice', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };

            await componentManager.registerComponent('test', mockComponent);
            mockComponent.init.mockClear();

            const result = await componentManager.registerComponent('test', mockComponent);
            expect(result).toBe(true);
            expect(mockComponent.init).not.toHaveBeenCalled();
        });

        it('should return null for non-existent component', () => {
            expect(componentManager.getComponentState('nonexistent')).toBeNull();
            expect(componentManager.getComponentInfo('nonexistent')).toBeNull();
        });

        it('should check if component is ready', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            await componentManager.registerComponent('test', mockComponent);
            expect(componentManager.isComponentReady('test')).toBe(true);
            expect(componentManager.isComponentReady('nonexistent')).toBe(false);
        });

        it('should get all components', async () => {
            const mockComponent1 = { init: jest.fn().mockResolvedValue(true) };
            const mockComponent2 = { init: jest.fn().mockResolvedValue(true) };

            await componentManager.registerComponent('test1', mockComponent1);
            await componentManager.registerComponent('test2', mockComponent2);

            const components = componentManager.getAllComponents();
            expect(components).toHaveLength(2);
        });

        it('should handle component info correctly', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            await componentManager.registerComponent('test', mockComponent);

            const info = componentManager.getComponentInfo('test');
            expect(info.id).toBe('test');
            expect(info.state).toBe(COMPONENT_STATES.REGISTERED);
            expect(info.registrationTime).toBeTruthy();
        });
    });

    describe('error handling', () => {
        it('should handle component registration failure', async () => {
            const failingComponent = {
                init: jest.fn().mockRejectedValue(new Error('Init failed'))
            };

            const result = await componentManager.registerComponent('failing', failingComponent, { retryCount: 0 });
            expect(result).toBe(false);
            expect(componentManager.getComponentState('failing')).toBe(COMPONENT_STATES.ERROR);
        });

        it('should handle component without init function', async () => {
            const componentWithoutInit = {};
            const result = await componentManager.registerComponent('noInit', componentWithoutInit, { retryCount: 0 });
            
            expect(result).toBe(false);
            expect(componentManager.getComponentState('noInit')).toBe(COMPONENT_STATES.ERROR);
        });


        it('should call error handlers when component fails', async () => {
            const errorHandler = jest.fn();
            componentManager.addErrorHandler(errorHandler);

            const failingComponent = {
                init: jest.fn().mockRejectedValue(new Error('Component failed'))
            };

            await componentManager.registerComponent('failing', failingComponent, { retryCount: 0 });

            expect(errorHandler).toHaveBeenCalledWith('failing', expect.any(Error));
        });

        it('should handle error in error handler gracefully', async () => {
            const badErrorHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });
            componentManager.addErrorHandler(badErrorHandler);

            const failingComponent = {
                init: jest.fn().mockRejectedValue(new Error('Component failed'))
            };

            // Should not throw even if error handler throws
            await expect(componentManager.registerComponent('failing', failingComponent, { retryCount: 0 }))
                .resolves.toBe(false);
        });
    });

    describe('error handlers', () => {
        it('should add and remove error handlers', () => {
            const handler = jest.fn();
            componentManager.addErrorHandler(handler);
            expect(componentManager.errorHandlers).toContain(handler);

            componentManager.removeErrorHandler(handler);
            expect(componentManager.errorHandlers).not.toContain(handler);
        });

        it('should ignore non-function error handlers', () => {
            const initialLength = componentManager.errorHandlers.length;
            componentManager.addErrorHandler('not a function');
            componentManager.addErrorHandler(null);
            componentManager.addErrorHandler(undefined);
            
            expect(componentManager.errorHandlers).toHaveLength(initialLength);
        });
    });

    describe('component lifecycle', () => {
        it('should unregister component with cleanup', async () => {
            const mockComponent = {
                init: jest.fn().mockResolvedValue(true),
                cleanup: jest.fn()
            };

            await componentManager.registerComponent('test', mockComponent);
            const result = componentManager.unregisterComponent('test');

            expect(result).toBe(true);
            expect(mockComponent.cleanup).toHaveBeenCalled();
            expect(componentManager.getComponentInfo('test')).toBeNull();
        });

        it('should handle component without cleanup method', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };

            await componentManager.registerComponent('test', mockComponent);
            const result = componentManager.unregisterComponent('test');

            expect(result).toBe(true);
        });

        it('should return false when unregistering non-existent component', () => {
            const result = componentManager.unregisterComponent('nonexistent');
            expect(result).toBe(false);
        });

        it('should handle cleanup error gracefully', async () => {
            const componentWithBadCleanup = {
                init: jest.fn().mockResolvedValue(true),
                cleanup: jest.fn().mockImplementation(() => {
                    throw new Error('Cleanup failed');
                })
            };

            await componentManager.registerComponent('badCleanup', componentWithBadCleanup);
            
            // Should not throw even if cleanup throws
            expect(() => componentManager.unregisterComponent('badCleanup')).not.toThrow();
        });

        it('should cleanup all components', async () => {
            const mockComponent = {
                init: jest.fn().mockResolvedValue(true),
                cleanup: jest.fn()
            };

            await componentManager.registerComponent('test', mockComponent);
            componentManager.cleanup();

            expect(componentManager.getAllComponents()).toHaveLength(0);
            expect(componentManager.errorHandlers).toHaveLength(0);
        });
    });

    describe('prerequisites', () => {
        it('should handle NiFi readiness when already initialized', async () => {
            global.nf = { Canvas: { initialized: true } };
            
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            const result = await componentManager.registerComponent('nifiReady', mockComponent, {
                requiresNifi: true
            });

            expect(result).toBe(true);
            
            delete global.nf;
        });

        it('should handle NiFi readiness in test environment', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            const result = await componentManager.registerComponent('nifiTest', mockComponent, {
                requiresNifi: true
            });

            expect(result).toBe(true);
        });

        it('should handle DOM readiness in test environment', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            
            const result = await componentManager.registerComponent('domReady', mockComponent, {
                requiresDOM: true
            });

            expect(result).toBe(true);
        });

        it('should skip requirements when disabled', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            
            const result = await componentManager.registerComponent('noRequirements', mockComponent, {
                requiresNifi: false,
                requiresDOM: false
            });

            expect(result).toBe(true);
        });
    });

    describe('advanced functionality', () => {
        it('should wait for all components to be ready', async () => {
            const mockComponent1 = { init: jest.fn().mockResolvedValue(true) };
            const mockComponent2 = { init: jest.fn().mockResolvedValue(true) };

            await componentManager.registerComponent('test1', mockComponent1);
            await componentManager.registerComponent('test2', mockComponent2);

            const allReady = await componentManager.waitForAllComponents(100);
            expect(allReady).toBe(true);
            expect(componentManager.globalState.componentsInitialized).toBe(true);
        });


        it('should maintain correct component options with defaults', async () => {
            const mockComponent = { init: jest.fn().mockResolvedValue(true) };
            const customOptions = {
                retryCount: 5,
                retryDelay: 500,
                timeout: 5000,
                requiresNifi: false,
                requiresDOM: false
            };

            await componentManager.registerComponent('custom', mockComponent, customOptions);
            
            const info = componentManager.getComponentInfo('custom');
            expect(info.options.retryCount).toBe(5);
            expect(info.options.retryDelay).toBe(500);
            expect(info.options.timeout).toBe(5000);
            expect(info.options.requiresNifi).toBe(false);
            expect(info.options.requiresDOM).toBe(false);
        });

        it('should handle pending initialization during unregister', async () => {
            const slowComponent = {
                init: jest.fn().mockImplementation(() => 
                    new Promise(resolve => setTimeout(resolve, 50))
                )
            };

            // Start registration but don't wait
            const registerPromise = componentManager.registerComponent('slow', slowComponent);
            
            // Immediately unregister while initialization is pending
            const result = componentManager.unregisterComponent('slow');
            expect(result).toBe(true);

            // Wait for the registration to complete (should be handled gracefully)
            await registerPromise;
        });
    });
});